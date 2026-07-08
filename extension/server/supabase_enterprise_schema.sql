-- ============================================================================
-- DopaQueue Enterprise SaaS Schema for Supabase (PostgreSQL)
-- ============================================================================
-- Designed for high-scale video library management, custom user tagging,
-- rich note-taking, manual transcription storage, and fast full-text search.
-- ============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. SAVED QUEUE / VIDEO LIBRARY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'channel', 'short')),
  genre TEXT,
  channel TEXT,
  youtube_tags TEXT[] DEFAULT '{}',
  custom_tags TEXT[] DEFAULT '{}',
  user_notes TEXT,
  manual_transcript TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  watched BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure user_id + id index for fast user library queries
CREATE INDEX IF NOT EXISTS queue_user_id_idx ON queue(user_id);
CREATE INDEX IF NOT EXISTS queue_user_saved_at_idx ON queue(user_id, saved_at DESC) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS queue_custom_tags_gin_idx ON queue USING GIN (custom_tags);
CREATE INDEX IF NOT EXISTS queue_youtube_tags_gin_idx ON queue USING GIN (youtube_tags);

-- Full-text search index across title, user_notes, and manual_transcript
CREATE INDEX IF NOT EXISTS queue_fts_idx ON queue USING GIN (
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(user_notes, '') || ' ' || COALESCE(manual_transcript, ''))
);

-- ----------------------------------------------------------------------------
-- 2. CUSTOM USER TAGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#84cc16', -- Default lime green
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tags_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS user_tags_user_id_idx ON user_tags(user_id);

-- ----------------------------------------------------------------------------
-- 3. USER NOTES & METADATA TABLE (Optional separate table for long-form notes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_notes_video_id_idx ON video_notes(video_id);

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_notes ENABLE ROW LEVEL SECURITY;

-- Queue policies
CREATE POLICY IF NOT EXISTS "Users can manage their own queue library"
  ON queue
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tags policies
CREATE POLICY IF NOT EXISTS "Users can manage their own custom tags"
  ON user_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notes policies
CREATE POLICY IF NOT EXISTS "Users can manage their own video notes"
  ON video_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. AUTO-UPDATE UPDATED_AT TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS queue_set_updated_at ON queue;
CREATE TRIGGER queue_set_updated_at
  BEFORE UPDATE ON queue
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

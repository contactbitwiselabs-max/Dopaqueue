-- DopaQueue Database Migrations
-- Run these in your Supabase database to set up tables for server-side transcript fallback

-- Create transcript_queue table to track pending server-side transcript fetches
CREATE TABLE IF NOT EXISTS transcript_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  video_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient queue polling
CREATE INDEX IF NOT EXISTS transcript_queue_status_idx ON transcript_queue(status, created_at);
CREATE INDEX IF NOT EXISTS transcript_queue_user_idx ON transcript_queue(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS transcript_queue_user_url_idx ON transcript_queue(user_id, url) WHERE status = 'pending';

-- Enhance scrape_cache table (if not already done)
-- Assumes scrape_cache table already exists with columns: user_id, url, genre, channel, transcript, scrapedAt
-- Add a column to track server-side scraping attempt metadata
ALTER TABLE scrape_cache ADD COLUMN IF NOT EXISTS last_attempts jsonb;
ALTER TABLE scrape_cache ADD COLUMN IF NOT EXISTS server_scraped boolean DEFAULT false;
ALTER TABLE scrape_cache ADD COLUMN IF NOT EXISTS server_scraped_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS scrape_cache_user_url_idx ON scrape_cache(user_id, url);
CREATE INDEX IF NOT EXISTS scrape_cache_server_scraped_idx ON scrape_cache(server_scraped);

-- Enable RLS (Row Level Security) for transcript_queue
ALTER TABLE transcript_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own transcript queue entries
CREATE POLICY IF NOT EXISTS "Users can manage their own transcript queue"
  ON transcript_queue
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only access their own scrape_cache
CREATE POLICY IF NOT EXISTS "Users can manage their own scrape cache"
  ON scrape_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create a function to clean up old transcript queue entries (older than 30 days, completed)
CREATE OR REPLACE FUNCTION cleanup_transcript_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM transcript_queue
  WHERE status != 'pending'
    AND created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcript_queue_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transcript_queue_timestamp ON transcript_queue;
CREATE TRIGGER transcript_queue_timestamp
  BEFORE UPDATE ON transcript_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_queue_timestamp();

// DopaQueue Transcript Fallback Worker
// A minimal Node.js server that runs youtube-transcript-api for videos
// where the client failed to fetch transcripts.
// 
// Can be deployed as:
// - A standalone Node service (this file)
// - A Supabase Edge Function (wrap with appropriate HTTP handler)
// - A serverless function (AWS Lambda, Vercel, etc.)
//
// Expected to run as a queue consumer:
// 1. Poll Supabase `transcript_queue` table for entries with status='pending'
// 2. Call youtube-transcript-api to fetch the transcript
// 3. Update the `scrape_cache` table with results
// 4. Mark queue entry as status='done' or 'failed'

import { createClient } from '@supabase/supabase-js';
import { getTranscript } from 'youtube-transcript-api';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://orietzrziyrwnjqljvmv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const WORKER_INTERVAL_MS = process.env.WORKER_INTERVAL_MS || 30000;
const MAX_BATCH_SIZE = 5;

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Extract video ID from YouTube URL.
 */
function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    return u.searchParams.get('v') || null;
  } catch {
    return null;
  }
}

/**
 * Fetch transcript for a single video ID using youtube-transcript-api.
 * Returns { transcript: string, language: string } or null if unavailable.
 */
async function fetchTranscriptForVideoId(videoId) {
  try {
    const transcripts = await getTranscript(videoId, { lang: 'en' });
    if (!transcripts || transcripts.length === 0) return null;

    const transcript = transcripts.map((t) => t.text).join(' ');
    return { transcript, language: 'en' };
  } catch (err) {
    console.warn(`Failed to fetch transcript for ${videoId}:`, err.message);
    return null;
  }
}

/**
 * Process a single pending transcript queue entry.
 */
async function processQueueEntry(entry) {
  const { id, user_id, url } = entry;
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    console.log(`[${id}] Fetching transcript for ${videoId}...`);
    const result = await fetchTranscriptForVideoId(videoId);

    if (result) {
      console.log(`[${id}] Success! Transcript length: ${result.transcript.length}`);

      // Update scrape_cache with the transcript
      const { error: cacheError } = await supabase
        .from('scrape_cache')
        .upsert(
          {
            user_id,
            url,
            transcript: result.transcript,
            language: result.language,
            scrapedAt: new Date().toISOString(),
          },
          { onConflict: 'user_id,url' }
        );

      if (cacheError) throw cacheError;

      // Mark queue entry as done
      const { error: queueError } = await supabase
        .from('transcript_queue')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (queueError) throw queueError;
    } else {
      throw new Error('Transcript not available (no captions or error fetching)');
    }
  } catch (err) {
    console.error(`[${id}] Error:`, err.message);

    // Mark queue entry as failed with error message
    const { error: queueError } = await supabase
      .from('transcript_queue')
      .update({
        status: 'failed',
        error_message: String(err.message),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (queueError) console.error('Failed to update queue entry:', queueError.message);
  }
}

/**
 * Poll and process pending queue entries in batches.
 */
async function processPendingQueue() {
  try {
    console.log(`[worker] Polling for pending transcript requests...`);

    // Fetch pending entries
    const { data: entries, error } = await supabase
      .from('transcript_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (error) throw error;

    if (!entries || entries.length === 0) {
      console.log('[worker] No pending entries.');
      return;
    }

    console.log(`[worker] Processing ${entries.length} pending request(s)...`);

    // Process each entry sequentially to avoid rate limits
    for (const entry of entries) {
      await processQueueEntry(entry);
    }

    console.log(`[worker] Batch complete.`);
  } catch (err) {
    console.error('[worker] Fatal error:', err.message);
  }
}

/**
 * Start the worker loop.
 */
function startWorker() {
  console.log(`DopaQueue Transcript Fallback Worker started.`);
  console.log(`Interval: ${WORKER_INTERVAL_MS}ms, Batch size: ${MAX_BATCH_SIZE}`);

  // Process immediately on start
  processPendingQueue();

  // Then run on interval
  setInterval(processPendingQueue, WORKER_INTERVAL_MS);
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker();
}

export { processPendingQueue };

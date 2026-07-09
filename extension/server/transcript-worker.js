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

// Configuration - ALL values must come from environment variables
// NO hardcoded credentials allowed
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_MS || '30000');
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '5');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '5000');

// Validate required environment variables
function validateEnvironment() {
  const errors = [];
  
  if (!SUPABASE_URL) {
    errors.push('SUPABASE_URL');
  }
  
  if (!SUPABASE_SERVICE_KEY) {
    errors.push('SUPABASE_SERVICE_KEY');
  }
  
  if (errors.length > 0) {
    console.error(`[DopaQueue Worker] Missing required environment variables: ${errors.join(', ')}`);
    console.error('Please set these environment variables before starting the worker.');
    console.error('Example:');
    console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
    console.error('  export SUPABASE_SERVICE_KEY="your-service-key"');
    process.exit(1);
  }
  
  return true;
}

// Initialize Supabase client
function createSupabaseClient() {
  validateEnvironment();
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return supabase;
}

const supabase = createSupabaseClient();

/**
 * Extract video ID from YouTube URL.
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
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
 * @param {string} videoId - YouTube video ID
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<{transcript: string, language: string}|null>}
 */
async function fetchTranscriptForVideoId(videoId, retryCount = 0) {
  try {
    const transcripts = await getTranscript(videoId, { lang: 'en' });
    if (!transcripts || transcripts.length === 0) return null;

    const transcript = transcripts.map((t) => t.text).join(' ');
    return { transcript, language: 'en' };
  } catch (err) {
    console.warn(`[Worker] Failed to fetch transcript for ${videoId} (attempt ${retryCount + 1}):`, err.message);
    
    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[Worker] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchTranscriptForVideoId(videoId, retryCount + 1);
    }
    
    console.error(`[Worker] Max retries (${MAX_RETRIES}) exceeded for ${videoId}`);
    return null;
  }
}

/**
 * Process a single pending transcript queue entry.
 * @param {Object} entry - Queue entry from Supabase
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} Success status
 */
async function processQueueEntry(entry) {
  const { id, user_id, url, created_at } = entry;
  
  // Validate entry has required fields
  if (!id || !user_id || !url) {
    console.error(`[Worker] Invalid queue entry: missing required fields`, { id, user_id, url });
    return false;
  }
  
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error(`[Worker] [${id}] Could not extract video ID from URL: ${url}`);
      
      // Mark as failed
      await supabase
        .from('transcript_queue')
        .update({
          status: 'failed',
          error_message: 'Could not extract video ID from URL',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      return false;
    }

    console.log(`[Worker] [${id}] Fetching transcript for ${videoId}...`);
    const result = await fetchTranscriptForVideoId(videoId);

    if (result) {
      console.log(`[Worker] [${id}] Success! Transcript length: ${result.transcript.length}`);

      // Update scrape_cache with the transcript
      const { error: cacheError } = await supabase
        .from('scrape_cache')
        .upsert(
          {
            user_id,
            url,
            video_id: videoId,
            transcript: result.transcript,
            language: result.language,
            scrapedAt: new Date().toISOString(),
            source: 'server_worker',
          },
          { onConflict: 'user_id,url' }
        );

      if (cacheError) {
        console.error(`[Worker] [${id}] Failed to update scrape_cache:`, cacheError);
        throw cacheError;
      }

      // Mark queue entry as done
      const { error: queueError } = await supabase
        .from('transcript_queue')
        .update({
          status: 'done',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (queueError) {
        console.error(`[Worker] [${id}] Failed to update queue:`, queueError);
        throw queueError;
      }
      
      return true;
    } else {
      console.warn(`[Worker] [${id}] No transcript found for ${videoId}`);
      
      // Mark as failed
      await supabase
        .from('transcript_queue')
        .update({
          status: 'failed',
          error_message: 'No transcript available for video',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      return false;
    }
  } catch (err) {
    console.error(`[Worker] [${id}] Error processing entry:`, err);
    
    // Mark as failed with error message
    await supabase
      .from('transcript_queue')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    return false;
  }
}

/**
 * Process a batch of pending queue entries.
 * @param {Object[]} entries - Array of queue entries
 * @returns {Promise<{success: number, failed: number}>}
 */
async function processBatch(entries) {
  const results = {
    success: 0,
    failed: 0,
  };
  
  // Process in parallel with limit
  const batchSize = Math.min(entries.length, MAX_BATCH_SIZE);
  console.log(`[Worker] Processing batch of ${batchSize} entries...`);
  
  for (let i = 0; i < batchSize; i++) {
    const entry = entries[i];
    const success = await processQueueEntry(entry);
    if (success) {
      results.success++;
    } else {
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Poll the transcript queue for pending entries.
 * @returns {Promise<Object>} Polling results
 */
async function pollQueue() {
  try {
    // Get pending entries, ordered by creation time
    const { data: pendingEntries, error } = await supabase
      .from('transcript_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH_SIZE);
    
    if (error) {
      console.error('[Worker] Error fetching pending entries:', error);
      return { success: 0, failed: 0, error: error.message };
    }
    
    if (!pendingEntries || pendingEntries.length === 0) {
      console.log('[Worker] No pending entries in queue.');
      return { success: 0, failed: 0, error: null };
    }
    
    console.log(`[Worker] Found ${pendingEntries.length} pending entries.`);
    
    // Process batch
    const results = await processBatch(pendingEntries);
    
    return {
      ...results,
      error: null,
      processed: pendingEntries.length,
    };
  } catch (err) {
    console.error('[Worker] Error polling queue:', err);
    return { success: 0, failed: 0, error: err.message };
  }
}

/**
 * Main worker loop.
 */
async function runWorker() {
  console.log('[Worker] Starting DopaQueue Transcript Worker...');
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`[Worker] Polling interval: ${WORKER_INTERVAL_MS}ms`);
  console.log(`[Worker] Max batch size: ${MAX_BATCH_SIZE}`);
  
  // Validate environment on startup
  validateEnvironment();
  
  // Initial poll
  const initialResults = await pollQueue();
  console.log(`[Worker] Initial poll results:`, initialResults);
  
  // Set up periodic polling
  setInterval(async () => {
    try {
      const results = await pollQueue();
      if (results.processed > 0) {
        console.log(`[Worker] Poll results: ${results.success} success, ${results.failed} failed`);
      }
    } catch (err) {
      console.error('[Worker] Error in polling loop:', err);
    }
  }, WORKER_INTERVAL_MS);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('[Worker] Received SIGTERM, shutting down...');
    process.exit(0);
  });
}

// Start the worker
runWorker().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});

export { extractVideoId, fetchTranscriptForVideoId, processQueueEntry, pollQueue, runWorker };

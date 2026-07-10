// @ts-nocheck
// DopaQueue Analytics Storage Engine
// Pre-computes and aggregates daily snapshots to avoid excessive parsing of raw timer history.

export async function captureDailyAnalyticsSnapshot(snapshotDate, metrics) {
  // Save a summarized view of the day for fast retrieval
  const key = `dq_analytics_daily_${snapshotDate}`;
  
  await new Promise(resolve => {
    chrome.storage.local.set({
      [key]: {
        date: snapshotDate,
        heatmap: metrics.heatmap,
        platformSplit: metrics.platformSplit,
        streak: metrics.streak,
        capturedAt: Date.now()
      }
    }, resolve);
  });
}

export async function getDailyAnalyticsSnapshots(days = 7) {
  const keys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    keys.push(`dq_analytics_daily_${dateStr}`);
  }

  return new Promise(resolve => {
    chrome.storage.local.get(keys, (res) => {
      resolve(res);
    });
  });
}


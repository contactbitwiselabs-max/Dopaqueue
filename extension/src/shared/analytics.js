// DopaQueue Enterprise Analytics Engine
// Pure computation module — no DOM, no React.

export * from './analytics_insights.js';
export * from './analytics_storage.js';

/**
 * 1. Attention Decay Curve
 * Computes time-per-reel across a session using scrollTimestamps.
 * A declining curve = worsening attention / autopilot scrolling.
 */
export function computeAttentionDecay(sessions) {
  // Only use sessions that have scrollTimestamps with at least 3 data points
  const valid = sessions.filter(s => s.scrollTimestamps && s.scrollTimestamps.length >= 3);
  if (valid.length === 0) return { avgCurve: [], sessionsAnalyzed: 0 };

  // Compute per-session decay curves
  const curves = valid.map(session => {
    const ts = session.scrollTimestamps;
    const deltas = [];
    for (let i = 1; i < ts.length; i++) {
      deltas.push(ts[i] - ts[i - 1]);
    }
    return deltas;
  });

  // Compute average across all sessions at each reel index position
  const maxLen = Math.max(...curves.map(c => c.length));
  const avgCurve = [];
  for (let i = 0; i < Math.min(maxLen, 50); i++) { // Cap at 50 data points
    const values = curves.filter(c => c[i] !== undefined).map(c => c[i]);
    if (values.length === 0) break;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    avgCurve.push({
      reelIndex: i + 1,
      avgMsSpent: Math.round(avg),
      avgSecondsSpent: +(avg / 1000).toFixed(1),
    });
  }

  return { avgCurve, sessionsAnalyzed: valid.length };
}

/**
 * 2. Scrolls Per Minute (SPM) Trend
 * Aggregates SPM per day over the given time range.
 */
export function computeSPMTrend(sessions, days = 30) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const filtered = sessions.filter(s => {
    const d = new Date(s.startTime);
    return d >= startDate && d <= now;
  });

  // Group by date
  const grouped = {};
  filtered.forEach(s => {
    const dateKey = s.date || new Date(s.startTime).toISOString().split('T')[0];
    if (!grouped[dateKey]) grouped[dateKey] = { totalScrolls: 0, totalMinutes: 0 };
    grouped[dateKey].totalScrolls += (s.scrollCount || 1);
    grouped[dateKey].totalMinutes += ((s.duration || 0) / 60000);
  });

  return Object.entries(grouped)
    .map(([date, data]) => ({
      date,
      avgSPM: data.totalMinutes > 0 ? +(data.totalScrolls / data.totalMinutes).toFixed(1) : 0,
      totalScrolls: data.totalScrolls,
      totalMinutes: +data.totalMinutes.toFixed(1),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 3. Vulnerability Heatmap (24 hourly buckets)
 * Shows which hours the user is most prone to scrolling.
 */
export function computeVulnerabilityHeatmap(sessions) {
  const buckets = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i === 0 ? '12' : i > 12 ? i - 12 : i}${i < 12 ? 'am' : 'pm'}`,
    totalMinutes: 0,
    sessionCount: 0,
  }));

  sessions.forEach(s => {
    const hour = s.hourOfDay ?? new Date(s.startTime).getHours();
    buckets[hour].totalMinutes += (s.duration || 0) / 60000;
    buckets[hour].sessionCount += 1;
  });

  // Round
  buckets.forEach(b => { b.totalMinutes = +b.totalMinutes.toFixed(1); });

  const maxMinutes = Math.max(...buckets.map(b => b.totalMinutes), 1);
  buckets.forEach(b => { b.intensity = +(b.totalMinutes / maxMinutes).toFixed(2); });

  return buckets;
}

/**
 * 4. Platform Split
 * Groups sessions by pageType (shorts vs reels).
 */
export function computePlatformSplit(sessions) {
  const platforms = {};
  sessions.forEach(s => {
    const p = s.pageType || 'unknown';
    if (!platforms[p]) platforms[p] = { platform: p, totalMinutes: 0, totalScrolls: 0, sessionCount: 0 };
    platforms[p].totalMinutes += (s.duration || 0) / 60000;
    platforms[p].totalScrolls += (s.scrollCount || 1);
    platforms[p].sessionCount += 1;
  });

  return Object.values(platforms).map(p => ({
    ...p,
    totalMinutes: +p.totalMinutes.toFixed(1),
    avgSessionMinutes: p.sessionCount > 0 ? +(p.totalMinutes / p.sessionCount).toFixed(1) : 0,
    label: p.platform === 'shorts' ? 'YouTube Shorts' : p.platform === 'reels' ? 'Instagram Reels' : 'Other',
    color: p.platform === 'shorts' ? '#f87171' : '#e879f9',
  }));
}

/**
 * 5. Session Length Distribution
 * Buckets sessions by duration.
 */
export function computeSessionDistribution(sessions) {
  const bucketDefs = [
    { key: '<2m', label: 'Under 2 min', min: 0, max: 2 * 60000 },
    { key: '2-5m', label: '2–5 min', min: 2 * 60000, max: 5 * 60000 },
    { key: '5-15m', label: '5–15 min', min: 5 * 60000, max: 15 * 60000 },
    { key: '15-30m', label: '15–30 min', min: 15 * 60000, max: 30 * 60000 },
    { key: '30m+', label: '30+ min', min: 30 * 60000, max: Infinity },
  ];

  const result = bucketDefs.map(def => ({ ...def, count: 0, totalMinutes: 0 }));

  sessions.forEach(s => {
    const dur = s.duration || 0;
    const bucket = result.find(b => dur >= b.min && dur < b.max);
    if (bucket) {
      bucket.count += 1;
      bucket.totalMinutes += dur / 60000;
    }
  });

  result.forEach(b => { b.totalMinutes = +b.totalMinutes.toFixed(1); });

  return result;
}

/**
 * 6. Weekly Trend Comparison
 * Compares this week's total scroll time vs last week.
 */
export function computeWeeklyComparison(sessions) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  let thisWeekMs = 0;
  let lastWeekMs = 0;

  sessions.forEach(s => {
    const d = new Date(s.startTime);
    if (d >= thisWeekStart && d <= now) thisWeekMs += (s.duration || 0);
    else if (d >= lastWeekStart && d <= lastWeekEnd) lastWeekMs += (s.duration || 0);
  });

  const thisWeekMinutes = +(thisWeekMs / 60000).toFixed(1);
  const lastWeekMinutes = +(lastWeekMs / 60000).toFixed(1);
  const changePercent = lastWeekMinutes > 0
    ? +(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100).toFixed(0)
    : (thisWeekMinutes > 0 ? 100 : 0);

  let direction = 'stable';
  if (changePercent < -5) direction = 'improving';
  else if (changePercent > 5) direction = 'worsening';

  return { thisWeekMinutes, lastWeekMinutes, changePercent, direction };
}

/**
 * 7. Flow Breaker Effectiveness
 * Analyzes flow breaker intervention outcomes.
 */
export function computeFlowBreakerStats(flowBreakerLog) {
  if (!flowBreakerLog || flowBreakerLog.length === 0) {
    return { totalShown: 0, divertedCount: 0, divertedRate: 0, unblockedCount: 0, breakdown: {} };
  }

  const breakdown = {};
  flowBreakerLog.forEach(entry => {
    const r = entry.result || 'unknown';
    breakdown[r] = (breakdown[r] || 0) + 1;
  });

  const totalShown = flowBreakerLog.length;
  const divertedCount = (breakdown['library_opened'] || 0) + (breakdown['saved_and_left'] || 0);
  const unblockedCount = breakdown['unblocked'] || 0;
  const divertedRate = totalShown > 0 ? +((divertedCount / totalShown) * 100).toFixed(0) : 0;

  return { totalShown, divertedCount, divertedRate, unblockedCount, breakdown };
}

/**
 * 8. Streak Tracker
 * Counts consecutive days with 0 minutes of scrolling.
 * Strict: 0 minutes = clean day (no grace period).
 */
export function computeStreakTracker(sessions) {
  // Build a set of dates that had scrolling activity
  const scrollDates = new Set();
  sessions.forEach(s => {
    const d = s.date || new Date(s.startTime).toISOString().split('T')[0];
    scrollDates.add(d);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Current streak: count consecutive days backwards from today with NO scrolling
  let currentStreak = 0;
  const d = new Date(today);
  while (true) {
    const ds = d.toISOString().split('T')[0];
    if (scrollDates.has(ds)) break;
    currentStreak++;
    d.setDate(d.getDate() - 1);
    if (currentStreak > 365) break; // safety cap
  }

  // Longest streak: scan the entire date range
  let longestStreak = 0;
  let tempStreak = 0;
  if (sessions.length > 0) {
    const allDates = sessions.map(s => s.date || new Date(s.startTime).toISOString().split('T')[0]);
    const minDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
    const maxDate = new Date(today);
    const iter = new Date(minDate);
    while (iter <= maxDate) {
      const ds = iter.toISOString().split('T')[0];
      if (!scrollDates.has(ds)) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
      iter.setDate(iter.getDate() + 1);
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  const lastScrollDate = sessions.length > 0
    ? sessions[sessions.length - 1].date || new Date(sessions[sessions.length - 1].startTime).toISOString().split('T')[0]
    : null;

  return { currentStreak, longestStreak, lastScrollDate };
}

/**
 * Filter sessions by time range.
 * range: 'hour' | 'day' | 'week' | 'month' | 'year'
 */
export function filterSessionsByRange(sessions, range) {
  const now = new Date();
  let cutoff;

  switch (range) {
    case 'hour':
      cutoff = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case 'day':
      cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
      break;
    case 'week':
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 6);
      cutoff.setHours(0, 0, 0, 0);
      break;
    case 'month':
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 29);
      cutoff.setHours(0, 0, 0, 0);
      break;
    case 'year':
      cutoff = new Date(now);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      cutoff.setHours(0, 0, 0, 0);
      break;
    default:
      cutoff = new Date(0);
  }

  return sessions.filter(s => new Date(s.startTime) >= cutoff);
}

/**
 * Build chart data grouped by appropriate interval for the selected range.
 * Returns: [{ displayDate, minutes, scrolls }]
 */
export function buildChartData(sessions, range) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (range === 'hour') {
    // Group by 5-minute intervals (12 buckets)
    const buckets = [];
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    for (let i = 0; i < 12; i++) {
      const start = new Date(hourAgo.getTime() + i * 5 * 60000);
      const end = new Date(start.getTime() + 5 * 60000);
      const label = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const matching = sessions.filter(s => {
        const d = new Date(s.startTime);
        return d >= start && d < end;
      });
      buckets.push({
        displayDate: label,
        minutes: +matching.reduce((sum, s) => sum + (s.duration || 0) / 60000, 0).toFixed(1),
        scrolls: matching.reduce((sum, s) => sum + (s.scrollCount || 1), 0),
      });
    }
    return buckets;
  }

  if (range === 'day') {
    // Group by hour (24 buckets)
    const buckets = [];
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    for (let h = 0; h < 24; h++) {
      const label = `${h === 0 ? '12' : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`;
      const matching = sessions.filter(s => {
        const d = new Date(s.startTime);
        return d >= dayStart && d.getHours() === h;
      });
      buckets.push({
        displayDate: label,
        minutes: +matching.reduce((sum, s) => sum + (s.duration || 0) / 60000, 0).toFixed(1),
        scrolls: matching.reduce((sum, s) => sum + (s.scrollCount || 1), 0),
      });
    }
    return buckets;
  }

  if (range === 'week') {
    // Group by day (7 buckets)
    const buckets = [];
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const ds = day.toISOString().split('T')[0];
      const label = day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      const matching = sessions.filter(s => (s.date || new Date(s.startTime).toISOString().split('T')[0]) === ds);
      buckets.push({
        displayDate: label,
        minutes: +matching.reduce((sum, s) => sum + (s.duration || 0) / 60000, 0).toFixed(1),
        scrolls: matching.reduce((sum, s) => sum + (s.scrollCount || 1), 0),
      });
    }
    return buckets;
  }

  if (range === 'month') {
    // Group by day (30 buckets)
    const buckets = [];
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 29);
    monthStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const day = new Date(monthStart);
      day.setDate(day.getDate() + i);
      const ds = day.toISOString().split('T')[0];
      const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const matching = sessions.filter(s => (s.date || new Date(s.startTime).toISOString().split('T')[0]) === ds);
      buckets.push({
        displayDate: label,
        minutes: +matching.reduce((sum, s) => sum + (s.duration || 0) / 60000, 0).toFixed(1),
        scrolls: matching.reduce((sum, s) => sum + (s.scrollCount || 1), 0),
      });
    }
    return buckets;
  }

  if (range === 'year') {
    // Group by month (12 buckets)
    const buckets = [];
    const yearStart = new Date(now);
    yearStart.setFullYear(yearStart.getFullYear() - 1);
    yearStart.setDate(1);
    yearStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(yearStart);
      monthDate.setMonth(monthDate.getMonth() + i);
      const monthNum = monthDate.getMonth();
      const yearNum = monthDate.getFullYear();
      const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const matching = sessions.filter(s => {
        const d = new Date(s.startTime);
        return d.getMonth() === monthNum && d.getFullYear() === yearNum;
      });
      buckets.push({
        displayDate: label,
        minutes: +matching.reduce((sum, s) => sum + (s.duration || 0) / 60000, 0).toFixed(1),
        scrolls: matching.reduce((sum, s) => sum + (s.scrollCount || 1), 0),
      });
    }
    return buckets;
  }

  return [];
}

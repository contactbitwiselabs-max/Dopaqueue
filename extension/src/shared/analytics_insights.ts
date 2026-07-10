// @ts-nocheck
// DopaQueue Analytics Insights Engine
// Generates natural language insights from raw metrics

export function generateNaturalLanguageInsights(metrics) {
  const insights = [];

  // 1. Mindless Scrolling Intensity & Peak Hour
  if (metrics.heatmap && metrics.heatmap.length > 0) {
    const peakHourData = [...metrics.heatmap].sort((a, b) => b.totalMinutes - a.totalMinutes)[0];
    if (peakHourData && peakHourData.totalMinutes > 15) {
      const hourFmt = formatHour(peakHourData.hour);
      insights.push({
        type: 'warning',
        title: 'Peak Vulnerability Window',
        message: `Your mindless scrolling peaks intensely around ${hourFmt} (${Math.round(peakHourData.totalMinutes)} mins). Consider setting a hard stop alert before this time.`,
      });
    }
  }

  // 2. Attention Decay
  if (metrics.attentionDecay && metrics.attentionDecay.avgCurve.length >= 5) {
    const start = metrics.attentionDecay.avgCurve[0].avgDelta;
    const end = metrics.attentionDecay.avgCurve[metrics.attentionDecay.avgCurve.length - 1].avgDelta;
    if (start > 0 && end > 0 && end < start * 0.6) {
      insights.push({
        type: 'warning',
        title: 'Attention Span Drop',
        message: `Your attention span drops drastically after scrolling past ${metrics.attentionDecay.avgCurve.length} reels. You start swiping ${(100 - (end/start * 100)).toFixed(0)}% faster. Try limiting sessions to ${Math.max(1, Math.floor(metrics.attentionDecay.avgCurve.length / 2))} items.`,
      });
    }
  }

  // 3. Platform Distribution
  if (metrics.platformSplit) {
    const total = metrics.platformSplit.total;
    if (total > 0) {
      const highest = Object.entries(metrics.platformSplit).filter(([k]) => k !== 'total').sort((a, b) => b[1] - a[1])[0];
      if (highest && (highest[1] / total) > 0.7) {
        insights.push({
          type: 'info',
          title: 'Platform Monoculture',
          message: `${highest[0]} consumes ${Math.round((highest[1] / total) * 100)}% of your mindless scroll time. Consider applying stricter limits specifically to this platform.`,
        });
      }
    }
  }

  // 4. Streak & Success
  if (metrics.streak && metrics.streak.current > 0) {
    if (metrics.streak.current >= 3) {
      insights.push({
        type: 'success',
        title: 'Focus Streak!',
        message: `You are on a ${metrics.streak.current}-day focus streak with zero budget overflow! Keep protecting your dopamine budget.`,
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Good start!',
        message: `You've maintained your budget for ${metrics.streak.current} day(s). Let's make it a streak!`,
      });
    }
  } else {
    insights.push({
      type: 'info',
      title: 'Reset and Recover',
      message: `Your streak was recently broken. Don't worry, every day is a fresh start to rebuild your focus habits.`,
    });
  }

  return insights;
}

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}


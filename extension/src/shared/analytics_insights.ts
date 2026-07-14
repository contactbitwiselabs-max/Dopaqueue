// @ts-nocheck
// DopaQueue Analytics Insights Engine
// Generates natural language insights from raw metrics

export function generateNaturalLanguageInsights(metrics) {
  const insights = [];

  // 1. Habit Loop Recognition (Context-Aware)
  if (metrics.heatmap && metrics.heatmap.length > 0 && metrics.platformSplit && metrics.platformSplit.length > 0) {
    const peakHourData = [...metrics.heatmap].sort((a, b) => b.totalMinutes - a.totalMinutes)[0];
    const topPlatform = [...metrics.platformSplit].sort((a, b) => b.totalMinutes - a.totalMinutes)[0];

    if (peakHourData && peakHourData.totalMinutes > 15) {
      const hourFmt = formatHour(peakHourData.hour);
      insights.push({
        type: 'warning',
        title: 'Vulnerability Window Identified',
        message: `You are highly likely to binge${topPlatform ? ` ${topPlatform.label}` : ''} around ${hourFmt}, averaging ${Math.round(peakHourData.totalMinutes)} minutes. We recommend setting a strict app block at this time to break this habit loop.`,
      });
    }
  }

  // 2. Velocity & Binge Detection
  if (metrics.attentionDecay && metrics.attentionDecay.avgCurve && metrics.attentionDecay.avgCurve.length >= 5) {
    const start = metrics.attentionDecay.avgCurve[0].avgSecondsSpent;
    const end = metrics.attentionDecay.avgCurve[metrics.attentionDecay.avgCurve.length - 1].avgSecondsSpent;
    
    if (start > 0 && end > 0 && end < start * 0.7) {
      const dropPercentage = (100 - (end/start * 100)).toFixed(0);
      insights.push({
        type: 'warning',
        title: 'Dopamine Velocity Spike',
        message: `Your scrolling speed accelerates by ${dropPercentage}% after viewing ${metrics.attentionDecay.avgCurve.length} items. This indicates autopilot doomscrolling. We suggest limiting sessions to ${Math.max(1, Math.floor(metrics.attentionDecay.avgCurve.length / 2))} items.`,
      });
    }
  }

  // 3. Flow Breaker Optimization
  if (metrics.flowStats && metrics.flowStats.totalShown > 0) {
    const rate = metrics.flowStats.divertedRate;
    if (rate < 30) {
      insights.push({
        type: 'info',
        title: 'Intervention Fatigue',
        message: `You've ignored ${100 - rate}% of mindful check-ins recently. The current flow-breakers aren't working. We recommend increasing the required breathing duration in settings to break your momentum.`,
      });
    } else if (rate > 70) {
      insights.push({
        type: 'success',
        title: 'High Mindfulness Success',
        message: `Great job! You successfully step away ${rate}% of the time when prompted. Your flow-breakers are perfectly tuned.`,
      });
    }
  }

  // 4. Progressive Goal Setting
  if (metrics.sessionDist && metrics.sessionDist.length > 0) {
    const totalSessions = metrics.sessionDist.reduce((acc, curr) => acc + curr.count, 0);
    if (totalSessions > 0) {
      const longSessions = metrics.sessionDist.find(b => b.key === '30m+');
      if (longSessions && (longSessions.count / totalSessions) > 0.4) {
         insights.push({
          type: 'info',
          title: 'Session Target Adjusted',
          message: `40%+ of your sessions exceed 30 minutes. Let's practice progressive overload: aim to keep all sessions under 25 minutes this week.`,
        });
      }
    }
  }

  // 5. Streak & Success
  if (metrics.streak) {
    if (metrics.streak.current > 0) {
      if (metrics.streak.current >= 3) {
        insights.push({
          type: 'success',
          title: 'Focus Streak!',
          message: `You are on a ${metrics.streak.current}-day focus streak keeping your scroll time under control! Keep protecting your dopamine budget.`,
        });
      } else {
        insights.push({
          type: 'success',
          title: 'Good start!',
          message: `You've maintained your budget for ${metrics.streak.current} day(s). Let's make it a streak!`,
        });
      }
    } else if (metrics.streak.longestStreak > 0) {
      insights.push({
        type: 'info',
        title: 'Reset and Recover',
        message: `Your streak was recently broken. Don't worry, every day is a fresh start. Your best was ${metrics.streak.longestStreak} days—let's beat it!`,
      });
    }
  }

  // Fallback insight if none triggered
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: 'Keep Gathering Data',
      message: `We need a bit more scroll data to generate deep, personalized insights. Keep using DopaQueue and check back later.`,
    });
  }

  return insights;
}

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}


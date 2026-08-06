// @ts-nocheck
import React, { useEffect, useState, useMemo, useTransition, useOptimistic } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  LineChart, Line
} from 'recharts';
import {
  Shield, TrendingUp, TrendingDown, Zap, Flame, Clock, Activity, BarChart3,
  Target, Award, ShieldCheck, Minus, Sparkles
} from 'lucide-react';
import {
  computeAttentionDecay, computeVulnerabilityHeatmap,
  computePlatformSplit, computeSessionDistribution, computeWeeklyComparison,
  computeFlowBreakerStats, computeStreakTracker, filterSessionsByRange, buildChartData
} from '../../shared/analytics';
import { generateNaturalLanguageInsights } from '../../shared/analytics_insights';
import { getGameState } from '../../shared/storage';
import { DEFAULT_DAILY_BUDGET, todayLocalDateString } from '../../shared/constants';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { FadeIn, SlideUp, StaggerList, StaggerItem } from '../../components/motion';
import { useI18n } from '../../shared/i18n';

const RANGE_OPTIONS = [
  { key: 'hour', label: 'Hour' },
  { key: 'day', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function DigitalWellbeing() {
  const { t } = useI18n();
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [flowLog, setFlowLog] = useState<any[]>([]);
  const [range, setRange] = useState('week');

  // C2: React 19 useTransition for non-blocking range changes
  const [isPending, startTransition] = useTransition();
  
  // C2: React 19 useOptimistic for optimistic range updates
  const [optimisticRange, setOptimisticRange] = useOptimistic<string>(range);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(null, (res) => {
        const history = res['dq_timer_history'] || [];
        
        // Find active sessions and merge them into history for real-time analytics
        const activeSessions = Object.keys(res)
          .filter(k => k.startsWith('activeTimer_'))
          .map(k => {
            const active = res[k];
            const now = Date.now();
            return {
              startTime: active.startTime || (now - (active.accumulatedTime || 0)),
              duration: active.accumulatedTime || 0,
              scrollCount: active.scrollCount || 1,
              scrollTimestamps: active.scrollTimestamps || [],
              date: todayLocalDateString(),
              hourOfDay: new Date().getHours()
            };
          })
          .filter(s => s.duration > 0);

        setAllSessions([...history, ...activeSessions]);
        setFlowLog(res['dq_flow_breaker_log'] || []);
      });
    }
  }, []);

  const sessions = useMemo(() => filterSessionsByRange(allSessions, optimisticRange), [allSessions, optimisticRange]);
  const chartData = useMemo(() => buildChartData(sessions, optimisticRange), [sessions, optimisticRange]);
  const attentionDecay = useMemo(() => computeAttentionDecay(sessions), [sessions]);
  const heatmap = useMemo(() => computeVulnerabilityHeatmap(sessions), [sessions]);
  const platformSplit = useMemo(() => computePlatformSplit(sessions), [sessions]);
  const sessionDist = useMemo(() => computeSessionDistribution(sessions), [sessions]);
  const weeklyComp = useMemo(() => computeWeeklyComparison(allSessions), [allSessions]);
  const flowStats = useMemo(() => computeFlowBreakerStats(flowLog), [flowLog]);
  
  const dailyBudget = getGameState()?.budgetMinutesTotal || DEFAULT_DAILY_BUDGET;
  const streak = useMemo(() => computeStreakTracker(allSessions, dailyBudget), [allSessions, dailyBudget]);

  const insights = useMemo(() => generateNaturalLanguageInsights({
    heatmap,
    attentionDecay,
    platformSplit,
    streak,
    flowStats,
    sessionDist
  }), [heatmap, attentionDecay, platformSplit, streak, flowStats, sessionDist]);
  
  const totalMinutes = sessions.reduce((s: number, x: any) => s + (x.duration || 0) / 60000, 0);
  const totalScrolls = sessions.reduce((s: number, x: any) => s + (x.scrollCount || 1), 0);
  const avgSPM = totalMinutes > 0 ? (totalScrolls / totalMinutes).toFixed(1) : '0.0';

  const TrendIcon = weeklyComp.direction === 'improving' ? TrendingDown : weeklyComp.direction === 'worsening' ? TrendingUp : Minus;
  const trendColor = weeklyComp.direction === 'improving' ? 'text-lime-400' : weeklyComp.direction === 'worsening' ? 'text-red-400' : 'text-[var(--dq-text-muted)]';

  const peakHour = heatmap.reduce((max: any, b: any) => b.totalMinutes > max.totalMinutes ? b : max, heatmap[0]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-lime-400" /> {t('dashboard.analysis')}
          </h2>
          <p className="text-sm text-[var(--dq-text-muted)] mt-1">
            {t('dashboard.analysis')}
          </p>
        </div>

        {/* Time Range Filter Pills */}
        <div className="flex items-center gap-1 bg-[var(--dq-surface)]/80 border border-white/10 rounded-2xl p-1 backdrop-blur-md">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => startTransition(() => { setRange(opt.key); setOptimisticRange(opt.key); })}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                optimisticRange === opt.key
                  ? 'bg-lime-400 text-black shadow-lg'
                  : 'text-[var(--dq-text-muted)] hover:text-[var(--dq-text)] hover:bg-white/5'
              }`}
            >
              {opt.label}
              {isPending && optimisticRange === opt.key && <span className="ml-1 animate-pulse">⏳</span>}
            </button>
          ))}
        </div>
      </SlideUp>

      {/* ─── Actionable Insights Panel ─── */}
      {insights.length > 0 && (
        <SlideUp delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight, idx) => {
              const Icon = insight.type === 'warning' ? Flame : insight.type === 'success' ? ShieldCheck : Sparkles;
              const colorClass = insight.type === 'warning' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' 
                               : insight.type === 'success' ? 'text-lime-400 bg-lime-500/10 border-lime-500/20' 
                               : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
              const iconColor = insight.type === 'warning' ? 'text-orange-400' 
                               : insight.type === 'success' ? 'text-lime-400' 
                               : 'text-blue-400';

              return (
                <div key={idx} className={`border rounded-xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] ${colorClass}`}>
                  <div className="flex items-start gap-3 relative z-10">
                    <div className={`p-2 rounded-lg mt-1 ${colorClass.split(' ')[1]}`}>
                      <Icon size={20} className={iconColor} />
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-1 ${iconColor}`}>{insight.title}</h3>
                      <p className="text-zinc-300 text-sm leading-relaxed">{insight.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SlideUp>
      )}

      {/* ─── Scorecard Row ─── */}
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard
          label="Scroll Time"
          value={`${Math.round(totalMinutes)}m`}
          sub={
            <span className={trendColor + ' flex items-center gap-1'}>
              <TrendIcon className="w-3.5 h-3.5" />
              {weeklyComp.direction === 'stable' ? 'Stable' : `${Math.abs(weeklyComp.changePercent)}% vs last week`}
            </span>
          }
          icon={<Clock className="w-5 h-5 text-lime-400" />}
        />
        <ScoreCard
          label="Avg Scrolls/Min"
          value={avgSPM}
          sub={<span className="text-[var(--dq-text-muted)]">{totalScrolls} total scrolls</span>}
          icon={<Zap className="w-5 h-5 text-amber-400" />}
        />
        <ScoreCard
          label="Clean Streak"
          value={`${streak.currentStreak}d`}
          sub={<span className="text-[var(--dq-text-muted)]">Best: {streak.longestStreak}d</span>}
          icon={<Flame className="w-5 h-5 text-orange-400" />}
        />
        <ScoreCard
          label="Flow Breaker"
          value={`${flowStats.divertedRate}%`}
          sub={<span className="text-[var(--dq-text-muted)]">{flowStats.divertedCount}/{flowStats.totalShown} diverted</span>}
          icon={<ShieldCheck className="w-5 h-5 text-blue-400" />}
        />
      </StaggerList>

      {/* ─── Daily Scroll Trends Chart ─── */}
      <FadeIn delay={0.2}>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-lime-400" /> Scroll Trends
            </CardTitle>
            <p className="text-xs text-[var(--dq-text-muted)]">Total scroll time over the selected time range</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full mt-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={10} interval="preserveStartEnd" />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val: any) => `${val}m`} />
                    <Tooltip
                      cursor={{ fill: '#27272a', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#a3e635', fontWeight: 'bold' }}
                      labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                      formatter={(value: any) => [`${value} min`, 'Scroll Time']}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.minutes > 30 ? '#f87171' : entry.minutes > 15 ? '#fbbf24' : '#a3e635'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--dq-text-muted)] text-sm">No data for this range</div>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ─── Two-Column Row: Attention Decay + Vulnerability Heatmap ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attention Decay */}
        <FadeIn delay={0.3}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-400" /> Attention Decay
              </CardTitle>
              <p className="text-xs text-[var(--dq-text-muted)]">
                {attentionDecay.sessionsAnalyzed > 0
                  ? `Avg time per reel across ${attentionDecay.sessionsAnalyzed} sessions`
                  : 'Scroll through a few videos to start tracking'
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-52 w-full mt-4">
                {attentionDecay.avgCurve.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attentionDecay.avgCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="reelIndex" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} label={{ value: 'Reel #', position: 'insideBottomRight', offset: -5, fill: '#71717a', fontSize: 10 }} />
                      <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: any) => `${v}s`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(value: any) => [`${value}s`, 'Avg Time']}
                        labelFormatter={(v: any) => `Reel #${v}`}
                      />
                      <Line type="monotone" dataKey="avgSecondsSpent" stroke="#f87171" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--dq-text-muted)] text-sm">Need more scroll data</div>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Vulnerability Heatmap */}
        <FadeIn delay={0.4}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" /> Vulnerability Heatmap
              </CardTitle>
              <p className="text-xs text-[var(--dq-text-muted)]">
                {peakHour && peakHour.totalMinutes > 0
                  ? `Peak danger zone: ${peakHour.label} (${peakHour.totalMinutes.toFixed(0)} min)`
                  : 'Your most vulnerable scrolling hours'
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1.5 pt-6">
                {heatmap.map((bucket: any) => (
                  <div key={bucket.hour} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full aspect-square rounded-lg transition-all"
                      style={{
                        backgroundColor: bucket.intensity > 0.7
                          ? `rgba(248, 113, 113, ${0.3 + bucket.intensity * 0.7})`
                          : bucket.intensity > 0.3
                            ? `rgba(251, 191, 36, ${0.2 + bucket.intensity * 0.6})`
                            : bucket.intensity > 0
                              ? `rgba(163, 230, 53, ${0.15 + bucket.intensity * 0.5})`
                              : 'rgba(39, 39, 42, 0.5)',
                      }}
                      title={`${bucket.label}: ${bucket.totalMinutes.toFixed(0)} min (${bucket.sessionCount} sessions)`}
                    />
                    <span className="text-[9px] text-[var(--dq-text-muted)]">{bucket.hour % 3 === 0 ? bucket.label : ''}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--dq-text-muted)] pt-3">
                <span>Low</span>
                <div className="flex gap-1">
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }} />
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(163, 230, 53, 0.4)' }} />
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(251, 191, 36, 0.5)' }} />
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(248, 113, 113, 0.8)' }} />
                </div>
                <span>High</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ─── Two-Column Row: Platform Split + Session Distribution ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <FadeIn delay={0.5}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle>Platform Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {platformSplit.length > 0 ? (
                <div className="space-y-5">
                  {platformSplit.map((p: any) => {
                    const pct = totalMinutes > 0 ? (p.totalMinutes / totalMinutes * 100).toFixed(0) : 0;
                    return (
                      <div key={p.platform} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[var(--dq-text)] font-semibold text-lg">{p.label}</span>
                          </div>
                          <div>
                            <span className="text-[var(--dq-text-muted)]">{p.totalMinutes.toFixed(0)}m · {p.totalScrolls} scrolls</span>
                          </div>
                        </div>
                        <div className="w-full h-3 bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: p.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[var(--dq-text-muted)] text-sm py-8 text-center">No platform data yet</div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Session Length Distribution */}
        <FadeIn delay={0.6}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle>Session Length Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionDist.map((bucket: any) => {
                  const maxCount = Math.max(...sessionDist.map((b: any) => b.count), 1);
                  const pct = (bucket.count / maxCount * 100).toFixed(0);
                  return (
                    <div key={bucket.key} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--dq-text-subtle)] font-medium">{bucket.label}</span>
                        <span className="text-[var(--dq-text-muted)]">{bucket.count} sessions</span>
                      </div>
                      <div className="w-full h-2.5 bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: bucket.key === '30m+' ? '#f87171' : bucket.key === '15-30m' ? '#fbbf24' : '#a3e635',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ─── Flow Breaker Report ─── */}
      <FadeIn delay={0.7}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-400" /> Mindful Flow Breaker Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flowStats.totalShown > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-2xl p-5 text-center shadow-inner">
                  <div className="text-2xl font-extrabold text-[var(--dq-text)]">{flowStats.totalShown}</div>
                  <div className="text-xs text-[var(--dq-text-muted)] mt-1">Interventions Shown</div>
                </div>
                <div className="bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-2xl p-5 text-center shadow-inner">
                  <div className="text-2xl font-extrabold text-lime-400">{flowStats.divertedCount}</div>
                  <div className="text-xs text-[var(--dq-text-muted)] mt-1">Successfully Diverted</div>
                </div>
                <div className="bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-2xl p-5 text-center shadow-inner">
                  <div className="text-2xl font-extrabold text-amber-400">{flowStats.unblockedCount}</div>
                  <div className="text-xs text-[var(--dq-text-muted)] mt-1">Continued Scrolling</div>
                </div>
                <div className="bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-2xl p-5 text-center shadow-inner">
                  <div className="text-2xl font-extrabold" style={{ color: flowStats.divertedRate > 50 ? '#a3e635' : '#fbbf24' }}>
                    {flowStats.divertedRate}%
                  </div>
                  <div className="text-xs text-[var(--dq-text-muted)] mt-1">Success Rate</div>
                </div>
              </div>
            ) : (
              <div className="text-[var(--dq-text-muted)] text-sm py-8 text-center">
                No flow breaker interactions recorded yet. The Mindful Check-In overlay will appear on Shorts and Reels pages.
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function ScoreCard({ label, value, sub, icon }: { label: string, value: string | number, sub: React.ReactNode, icon: React.ReactNode }) {
  return (
    <StaggerItem>
      <Card className="glass-card relative overflow-hidden h-full">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--dq-text-muted)] uppercase tracking-wider">{label}</span>
            {icon}
          </div>
          <div className="text-3xl font-extrabold text-[var(--dq-text)]">{value}</div>
          <p className="text-xs mt-2">{sub}</p>
        </CardContent>
      </Card>
    </StaggerItem>
  );
}




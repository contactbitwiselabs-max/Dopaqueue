import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import {
  Shield, TrendingUp, TrendingDown, Zap, Flame, Clock, Activity, BarChart3,
  Target, Award, ShieldCheck, Minus
} from 'lucide-react';
import {
  computeAttentionDecay, computeSPMTrend, computeVulnerabilityHeatmap,
  computePlatformSplit, computeSessionDistribution, computeWeeklyComparison,
  computeFlowBreakerStats, computeStreakTracker, filterSessionsByRange, buildChartData,
} from '../../shared/analytics.js';

const RANGE_OPTIONS = [
  { key: 'hour', label: 'Hour' },
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function DigitalWellbeing() {
  const [allSessions, setAllSessions] = useState([]);
  const [flowLog, setFlowLog] = useState([]);
  const [range, setRange] = useState('week');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['dq_timer_history', 'dq_flow_breaker_log'], (res) => {
        setAllSessions(res['dq_timer_history'] || []);
        setFlowLog(res['dq_flow_breaker_log'] || []);
      });
    }
  }, []);

  const sessions = useMemo(() => filterSessionsByRange(allSessions, range), [allSessions, range]);
  const chartData = useMemo(() => buildChartData(sessions, range), [sessions, range]);
  const attentionDecay = useMemo(() => computeAttentionDecay(sessions), [sessions]);
  const heatmap = useMemo(() => computeVulnerabilityHeatmap(sessions), [sessions]);
  const platformSplit = useMemo(() => computePlatformSplit(sessions), [sessions]);
  const sessionDist = useMemo(() => computeSessionDistribution(sessions), [sessions]);
  const weeklyComp = useMemo(() => computeWeeklyComparison(allSessions), [allSessions]);
  const flowStats = useMemo(() => computeFlowBreakerStats(flowLog), [flowLog]);
  const streak = useMemo(() => computeStreakTracker(allSessions), [allSessions]);

  const totalMinutes = sessions.reduce((s, x) => s + (x.duration || 0) / 60000, 0);
  const totalScrolls = sessions.reduce((s, x) => s + (x.scrollCount || 1), 0);
  const avgSPM = totalMinutes > 0 ? (totalScrolls / totalMinutes).toFixed(1) : '0.0';

  const TrendIcon = weeklyComp.direction === 'improving' ? TrendingDown : weeklyComp.direction === 'worsening' ? TrendingUp : Minus;
  const trendColor = weeklyComp.direction === 'improving' ? 'text-green-400' : weeklyComp.direction === 'worsening' ? 'text-red-400' : 'text-zinc-400';

  const peakHour = heatmap.reduce((max, b) => b.totalMinutes > max.totalMinutes ? b : max, heatmap[0]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-lime-400" /> Digital Wellbeing
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Enterprise-grade pattern detection for your short-form video consumption
          </p>
        </div>

        {/* Time Range Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-900/80 border border-white/10 rounded-2xl p-1">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                range === opt.key
                  ? 'bg-lime-400 text-black shadow-lg'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Scorecard Row ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          sub={<span className="text-zinc-500">{totalScrolls} total scrolls</span>}
          icon={<Zap className="w-5 h-5 text-amber-400" />}
        />
        <ScoreCard
          label="Clean Streak"
          value={`${streak.currentStreak}d`}
          sub={<span className="text-zinc-500">Best: {streak.longestStreak}d</span>}
          icon={<Flame className="w-5 h-5 text-orange-400" />}
        />
        <ScoreCard
          label="Flow Breaker"
          value={`${flowStats.divertedRate}%`}
          sub={<span className="text-zinc-500">{flowStats.divertedCount}/{flowStats.totalShown} diverted</span>}
          icon={<ShieldCheck className="w-5 h-5 text-blue-400" />}
        />
      </div>

      {/* ─── Daily Scroll Trends Chart ─── */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-lime-400" /> Scroll Trends
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Total scroll time over the selected time range</p>
          </div>
        </div>

        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={10} interval="preserveStartEnd" />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}m`} />
                <Tooltip
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#a3e635', fontWeight: 'bold' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                  formatter={(value) => [`${value} min`, 'Scroll Time']}
                />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.minutes > 30 ? '#f87171' : entry.minutes > 15 ? '#fbbf24' : '#a3e635'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No data for this range</div>
          )}
        </div>
      </div>

      {/* ─── Two-Column Row: Attention Decay + Vulnerability Heatmap ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attention Decay */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-400" /> Attention Decay
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {attentionDecay.sessionsAnalyzed > 0
                ? `Avg time per reel across ${attentionDecay.sessionsAnalyzed} sessions`
                : 'Scroll through a few videos to start tracking'
              }
            </p>
          </div>

          <div className="h-52 w-full">
            {attentionDecay.avgCurve.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attentionDecay.avgCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="reelIndex" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} label={{ value: 'Reel #', position: 'insideBottomRight', offset: -5, fill: '#71717a', fontSize: 10 }} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}s`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value) => [`${value}s`, 'Avg Time']}
                    labelFormatter={(v) => `Reel #${v}`}
                  />
                  <Line type="monotone" dataKey="avgSecondsSpent" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Need more scroll data</div>
            )}
          </div>
        </div>

        {/* Vulnerability Heatmap */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" /> Vulnerability Heatmap
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {peakHour && peakHour.totalMinutes > 0
                ? `Peak danger zone: ${peakHour.label} (${peakHour.totalMinutes.toFixed(0)} min)`
                : 'Your most vulnerable scrolling hours'
              }
            </p>
          </div>

          <div className="grid grid-cols-12 gap-1.5 pt-2">
            {heatmap.map(bucket => (
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
                <span className="text-[9px] text-zinc-600">{bucket.hour % 3 === 0 ? bucket.label : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
            <span>Low</span>
            <div className="flex gap-1">
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(163, 230, 53, 0.4)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(251, 191, 36, 0.5)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(248, 113, 113, 0.8)' }} />
            </div>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* ─── Two-Column Row: Platform Split + Session Distribution ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-4">
          <h3 className="text-lg font-bold text-white">Platform Breakdown</h3>
          {platformSplit.length > 0 ? (
            <div className="space-y-4">
              {platformSplit.map(p => {
                const pct = totalMinutes > 0 ? (p.totalMinutes / totalMinutes * 100).toFixed(0) : 0;
                return (
                  <div key={p.platform} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-200">{p.label}</span>
                      <span className="text-zinc-400">{p.totalMinutes.toFixed(0)}m · {p.totalScrolls} scrolls</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
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
            <div className="text-zinc-600 text-sm py-8 text-center">No platform data yet</div>
          )}
        </div>

        {/* Session Length Distribution */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-4">
          <h3 className="text-lg font-bold text-white">Session Length Distribution</h3>
          <div className="space-y-3">
            {sessionDist.map(bucket => {
              const maxCount = Math.max(...sessionDist.map(b => b.count), 1);
              const pct = (bucket.count / maxCount * 100).toFixed(0);
              return (
                <div key={bucket.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{bucket.label}</span>
                    <span className="text-zinc-500">{bucket.count} sessions</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
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
        </div>
      </div>

      {/* ─── Flow Breaker Report ─── */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
          <Award className="w-5 h-5 text-blue-400" /> Mindful Flow Breaker Report
        </h3>
        {flowStats.totalShown > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold text-white">{flowStats.totalShown}</div>
              <div className="text-xs text-zinc-400 mt-1">Interventions Shown</div>
            </div>
            <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold text-green-400">{flowStats.divertedCount}</div>
              <div className="text-xs text-zinc-400 mt-1">Successfully Diverted</div>
            </div>
            <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold text-amber-400">{flowStats.unblockedCount}</div>
              <div className="text-xs text-zinc-400 mt-1">Continued Scrolling</div>
            </div>
            <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold" style={{ color: flowStats.divertedRate > 50 ? '#4ade80' : '#fbbf24' }}>
                {flowStats.divertedRate}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">Success Rate</div>
            </div>
          </div>
        ) : (
          <div className="text-zinc-600 text-sm py-8 text-center">
            No flow breaker interactions recorded yet. The Mindful Check-In overlay will appear on Shorts and Reels pages.
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, sub, icon }) {
  return (
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-extrabold text-white">{value}</div>
      <p className="text-xs mt-2">{sub}</p>
    </div>
  );
}

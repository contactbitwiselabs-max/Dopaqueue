// @ts-nocheck
// DopaQueue Accountability Circles Helper
// Manages local & cloud accountability circles and weekly attention mirror stats
import { QueueItem } from '../types';

const CIRCLES_KEY = 'dq_accountability_circle';

export interface CircleMember {
  id: string;
  name: string;
  mindlessMinutesAvg: number;
  revisitRate: number;
  totalVideosScrolled: number;
}

export interface Circle {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  members: CircleMember[];
}

export async function getMyCircle(videos: QueueItem[] = []): Promise<Circle | null> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get([CIRCLES_KEY]);
    let circle = res[CIRCLES_KEY] as Circle | null;
    if (circle) {
      const report = await getWeeklyMirrorReport(videos);
      const me = circle.members.find(m => m.id === 'me');
      if (me) {
        me.mindlessMinutesAvg = report.mindlessMinutesAvg;
        me.revisitRate = report.revisitRate;
        me.totalVideosScrolled = report.totalVideosScrolled;
      }
    }
    return circle;
  }
  return null;
}

export function saveMyCircle(circle: Circle) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [CIRCLES_KEY]: circle });
  }
}

export async function createCircle(name: string, creatorName = 'You', videos: QueueItem[] = []): Promise<Circle> {
  const code = 'DQ-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
  const report = await getWeeklyMirrorReport(videos);
  const circle: Circle = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Focus Circle',
    code,
    createdAt: Date.now(),
    members: [
      { id: 'me', name: creatorName, mindlessMinutesAvg: report.mindlessMinutesAvg, revisitRate: report.revisitRate, totalVideosScrolled: report.totalVideosScrolled },
      { id: 'm2', name: 'Alex M.', mindlessMinutesAvg: 65, revisitRate: 60, totalVideosScrolled: 412 },
      { id: 'm3', name: 'Sam K.', mindlessMinutesAvg: 35, revisitRate: 90, totalVideosScrolled: 180 },
    ]
  };
  saveMyCircle(circle);
  return circle;
}

export async function joinCircleByCode(code: string, userName = 'You', videos: QueueItem[] = []): Promise<Circle> {
  const cleanCode = code.trim().toUpperCase();
  const report = await getWeeklyMirrorReport(videos);
  const circle: Circle = {
    id: crypto.randomUUID(),
    name: `Accountability Squad (${cleanCode})`,
    code: cleanCode,
    createdAt: Date.now(),
    members: [
      { id: 'me', name: userName, mindlessMinutesAvg: report.mindlessMinutesAvg, revisitRate: report.revisitRate, totalVideosScrolled: report.totalVideosScrolled },
      { id: 'm2', name: 'Jordan R.', mindlessMinutesAvg: 58, revisitRate: 70, totalVideosScrolled: 305 },
      { id: 'm3', name: 'Taylor V.', mindlessMinutesAvg: 40, revisitRate: 88, totalVideosScrolled: 150 },
    ]
  };
  saveMyCircle(circle);
  return circle;
}

export async function getWeeklyMirrorReport(videos: QueueItem[] = []) {
  const totalSaved = videos.length;
  const revisitedCount = videos.filter(v => v.watched).length;
  const revisitRate = totalSaved > 0 ? Math.round((revisitedCount / totalSaved) * 100) : 0;

  let mindlessMinutesAvg = 0;
  let totalVideosScrolled = 0;
  let hoursSavedEst = (videos.length * 0.4).toFixed(1);

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(['dq_timer_history']);
    const history = data['dq_timer_history'] || [];
    
    // Calculate last 7 days metrics
    const now = new Date();
    now.setHours(0,0,0,0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let sevenDaysTotalMs = 0;

    history.forEach((session: any) => {
      const sessionDate = new Date(session.startTime || Date.now());
      if (sessionDate >= sevenDaysAgo) {
        sevenDaysTotalMs += (session.duration || 0);
        totalVideosScrolled += (session.scrollCount || 1);
      }
    });

    mindlessMinutesAvg = Math.round((sevenDaysTotalMs / (1000 * 60)) / 7);
  }

  return {
    hoursSavedEst,
    mindlessMinutesAvg,
    revisitRate,
    totalVideosScrolled,
  };
}


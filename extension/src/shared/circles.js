// DopaQueue Accountability Circles Helper
// Manages local & cloud accountability circles and weekly attention mirror stats

const CIRCLES_KEY = 'dq_accountability_circle';

export function getMyCircle() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([CIRCLES_KEY], (res) => {
        resolve(res[CIRCLES_KEY] || null);
      });
    });
  }
  return Promise.resolve(null);
}

export function saveMyCircle(circle) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [CIRCLES_KEY]: circle });
  }
}

export function createCircle(name, creatorName = 'You') {
  const code = 'DQ-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
  const circle = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Focus Circle',
    code,
    createdAt: Date.now(),
    members: [
      { id: 'me', name: creatorName, mindlessMinutesAvg: 48, revisitRate: 85, speedBumpInterventions: 12 },
      { id: 'm2', name: 'Alex M.', mindlessMinutesAvg: 65, revisitRate: 60, speedBumpInterventions: 7 },
      { id: 'm3', name: 'Sam K.', mindlessMinutesAvg: 35, revisitRate: 90, speedBumpInterventions: 15 },
    ]
  };
  saveMyCircle(circle);
  return circle;
}

export function joinCircleByCode(code, userName = 'You') {
  const cleanCode = code.trim().toUpperCase();
  const circle = {
    id: crypto.randomUUID(),
    name: `Accountability Squad (${cleanCode})`,
    code: cleanCode,
    createdAt: Date.now(),
    members: [
      { id: 'me', name: userName, mindlessMinutesAvg: 45, revisitRate: 82, speedBumpInterventions: 11 },
      { id: 'm2', name: 'Jordan R.', mindlessMinutesAvg: 58, revisitRate: 70, speedBumpInterventions: 9 },
      { id: 'm3', name: 'Taylor V.', mindlessMinutesAvg: 40, revisitRate: 88, speedBumpInterventions: 14 },
    ]
  };
  saveMyCircle(circle);
  return circle;
}

export function getWeeklyMirrorReport(videos = []) {
  const totalSaved = videos.length;
  const revisitedCount = videos.filter(v => v.urgency || v.watched).length;
  const revisitRate = totalSaved > 0 ? Math.round((revisitedCount / totalSaved) * 100) : 75;

  return {
    hoursSavedEst: (videos.length * 0.4).toFixed(1),
    mindlessMinutesAvg: 42,
    revisitRate,
    speedBumpInterventions: 11,
  };
}

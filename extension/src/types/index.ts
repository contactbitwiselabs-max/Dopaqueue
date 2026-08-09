// Central types for DopaQueue Chrome Extension

export type ContentType = 'video' | 'short' | 'reel' | 'post' | 'image' | 'article' | 'screenshot' | 'link';
export type UrgencyLevel = 'Tomorrow' | 'Weekend' | 'Reference' | 'Unscheduled';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ExportFormat = 'markdown' | 'csv' | 'json' | 'notion' | 'obsidian' | 'image';
export type AuthProvider = 'google' | 'github';
export type BlobType = 'screenshot' | 'article' | 'image';

// ─── Queue / Saved Item ────────────────────────────────────────────
export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  savedAt: string | number; // allow string or number to accommodate both
  type?: ContentType | 'channel'; // Some logic uses 'channel' type
  tags?: string[];
  urgency?: UrgencyLevel;
  note?: string;
  notes?: string;
  watched?: boolean;
  channelId?: string;
  channelName?: string;
  channel?: string; // used widely as string
  author?: string;
  authorUrl?: string;
  platform?: string;
  contentType?: string;
  transcript?: string;
  description?: string;
  deleted?: boolean;
  group?: string;
  collection?: string;       // user-defined collection name
  blobId?: string;           // references IndexedDB BlobEntry for large content
  sourceDomain?: string;     // auto-extracted from URL hostname
  wordCount?: number;        // for article type items
  altText?: string;          // for image type items
  fromContentScript?: boolean;
  updatedAt?: number;
  expiryDate?: number;
  notifiedExpiry?: boolean;
}

// ─── Channel ─────────────────────────────────────────────────────
export interface Channel {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  savedAt: number;
  group?: string;
  whitelist?: boolean;
  description?: string;
}

// ─── Scrape Result ───────────────────────────────────────────────
export interface ScrapeData {
  url: string;
  transcript?: string;
  genre?: string;
  channel?: string;
  author?: string;
  authorUrl?: string;
  authorImage?: string;
  platform?: string;
  thumbnail?: string;
  title?: string;
  scrapedAt?: number;
  scrapedTags?: string[];
}
export type ScrapeResult = ScrapeData;

// ─── Game State (Plant system) ────────────────────────────────────
export interface GameState {
  health: number;
  streak: number;
  lastActive: number;
  savedToday: number;
  watchedToday: number;
  xp: number;
  level: number;
  
  // Game/Budget logic properties
  budgetMinutesTotal: number;
  budgetMinutesUsed: number;
  lastResetDate?: string;
  lastReset?: string;
  notifiedZeroToday: boolean;
  plant: string;
  coins: number;
  updatedAt?: number;
}

// ─── User / Auth ─────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  plan?: 'free' | 'pro' | 'team';
}

// ─── Circles / Social ─────────────────────────────────────────────
export interface Circle {
  id: string;
  name: string;
  code: string;
  members: CircleMember[];
  createdAt: number;
  ownerId: string;
}

export interface CircleMember {
  id: string; // Used in circles.ts
  userId?: string;
  email?: string;
  name?: string;
  joinedAt?: number;
  weeklyCount?: number;
  mindlessMinutesAvg?: number;
  revisitRate?: number;
  totalVideosScrolled?: number;
}

export interface WeeklyMirrorReport {
  userId: string;
  week: string;
  savedCount: number;
  watchedCount: number;
  topTags: string[];
  topChannels: string[];
}

// ─── Share ───────────────────────────────────────────────────────
export interface SharePayload {
  title: string;
  items: QueueItem[];
  createdAt: number;
  creatorId?: string;
}

// ─── Pomodoro ────────────────────────────────────────────────────
export interface PomodoroState {
  seconds?: number; // legacy
  remainingSeconds: number; // used in storage.ts
  active: boolean;
  mode?: 'focus' | 'break';
  label?: string; // used in storage.ts
  completedSessions?: number;
}

// ─── Export ──────────────────────────────────────────────────────
export interface ExportItem {
  title: string;
  url: string;
  type: ContentType;
  genre: string;
  channel: string;
  savedAt: number;
  transcript?: string;
  tags: string[];
  urgency?: UrgencyLevel;
}

// ─── Blob Store (IndexedDB) ───────────────────────────────────────
export interface BlobEntry {
  id: string;
  itemId: string;
  type: BlobType;
  data: string;       // base64 data URL or plain text
  mimeType?: string;
  createdAt: number;
  sizeBytes?: number;
}

// ─── Collections ─────────────────────────────────────────────────
export interface SavedCollection {
  id: string;
  name: string;
  color?: string;   // hex color e.g. '#84cc16'
  icon?: string;    // emoji or lucide icon name
  createdAt: number;
  updatedAt?: number;
}

// ─── Storage Keys ────────────────────────────────────────────────
export interface StorageData {
  dq_queue?: QueueItem[];
  dq_channels?: Channel[];
  dq_game_state?: GameState;
  dq_whitelist?: string[];
  dq_scrape_cache?: Record<string, ScrapeResult>;
  dq_pomodoro?: PomodoroState;
  dq_theme?: ThemeMode;
  dq_onboarding_complete?: boolean;
  dq_collections?: SavedCollection[];
}

// ─── Config ──────────────────────────────────────────────────────
export interface DopaQueueConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: string;
  SHARE_BASE_URL: string;
  ENABLE_ANALYTICS: boolean;
}

// ─── AI ──────────────────────────────────────────────────────────
export interface ActionChecklist {
  actions: string[];
  summary: string;
  tags: string[];
}

export interface AIConfig {
  provider: 'local' | 'gemini' | 'openai';
  apiKey: string;
}

export interface AppSettings {
  dailyBudgetMinutes: number;
  reminderHours: number;
  aiProvider: 'local' | 'gemini' | 'openai';
  aiApiKey: string;
  notificationsEnabled: boolean;
  enableAnalytics: boolean;
  autoSync: boolean;
  autoSyncEnabled: boolean;  // always-on sync: push to Supabase on every save
  webhookUrl: string | null;
  exportTemplate: string;
  updatedAt?: number;
}

// ─── Analytics ───────────────────────────────────────────────────
export interface AnalyticsSummary {
  totalSaved: number;
  totalWatched: number;
  byContentType: Record<ContentType, number>;
  byTag: Record<string, number>;
  byChannel: Record<string, number>;
  todayCount: number;
  weekCount: number;
  monthCount: number;
  avgPerDay: number;
  peakHour: number;
}

// ─── Validation ──────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Webhook ─────────────────────────────────────────────────────
export interface WebhookPayload {
  event: 'video_saved' | 'video_watched' | 'video_deleted';
  item: QueueItem;
  timestamp: number;
}

// ─── Status Toast ─────────────────────────────────────────────────
export interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

// ─── Component Props ──────────────────────────────────────────────
export interface WithClassName {
  className?: string;
}

export interface WithChildren {
  children: React.ReactNode;
}

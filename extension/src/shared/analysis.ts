// @ts-nocheck
// DopaQueue Analysis Engine
// Core analysis functionality for processing saved videos and user data
// Enhanced with efficient data processing and insights generation

import { getSavedVideos, getQueue, getScrapeCache, getNotes } from './storage.js';
import { validateString, validateUrl } from './validation.js';
import { getLicenseTier, hasFeature } from './licensing.js';

/**
 * Analysis Types
 */
export const ANALYSIS_TYPES = {
  // Content analysis
  CONTENT_SUMMARY: 'content_summary',
  CONTENT_TAGS: 'content_tags',
  CONTENT_CATEGORIES: 'content_categories',
  
  // Usage analysis
  USAGE_PATTERNS: 'usage_patterns',
  TIME_ANALYSIS: 'time_analysis',
  PLATFORM_ANALYSIS: 'platform_analysis',
  
  // Insights
  WEEKLY_REPORT: 'weekly_report',
  MONTHLY_REPORT: 'monthly_report',
  TRENDS: 'trends',
  
  // Recommendations
  RECOMMENDATIONS: 'recommendations',
  SIMILAR_CONTENT: 'similar_content',
  LEARNING_PATH: 'learning_path',
};

/**
 * Content Categories
 */
export const CONTENT_CATEGORIES = {
  EDUCATION: 'education',
  TECHNOLOGY: 'technology',
  BUSINESS: 'business',
  HEALTH: 'health',
  FINANCE: 'finance',
  DESIGN: 'design',
  DEVELOPMENT: 'development',
  PRODUCTIVITY: 'productivity',
  MARKETING: 'marketing',
  SCIENCE: 'science',
  PSYCHOLOGY: 'psychology',
  PHILOSOPHY: 'philosophy',
  ENTERTAINMENT: 'entertainment',
  NEWS: 'news',
  OTHER: 'other',
};

/**
 * Platform Types
 */
export const PLATFORMS = {
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  TWITTER: 'twitter',
  X: 'x',
  OTHER: 'other',
};

/**
 * Time Ranges
 */
export const TIME_RANGES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  ALL_TIME: 'all_time',
};

/**
 * Analysis Cache
 * Caches analysis results for performance
 */
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear analysis cache
 */
export function clearAnalysisCache() {
  analysisCache.clear();
}

/**
 * Get cached analysis or compute new
 */
function getCachedAnalysis(key, computeFn) {
  const cached = analysisCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = computeFn();
  analysisCache.set(key, { data, timestamp: Date.now() });
  
  return data;
}

/**
 * Extract platform from URL
 */
export function extractPlatform(url) {
  if (!url) return PLATFORMS.OTHER;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
      return PLATFORMS.YOUTUBE;
    }
    if (hostname.includes('instagram.com')) {
      return PLATFORMS.INSTAGRAM;
    }
    if (hostname.includes('tiktok.com')) {
      return PLATFORMS.TIKTOK;
    }
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return PLATFORMS.X;
    }
    
    return PLATFORMS.OTHER;
  } catch {
    return PLATFORMS.OTHER;
  }
}

/**
 * Extract video ID from URL
 */
export function extractVideoId(url) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }
    
    if (hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Categorize content based on title, description, and transcript
 */
export function categorizeContent(item) {
  if (!item) return CONTENT_CATEGORIES.OTHER;
  
  const text = [
    item.title || '',
    item.description || '',
    item.transcript || '',
  ].join(' ').toLowerCase();
  
  // Education keywords
  const educationKeywords = [
    'tutorial', 'course', 'lecture', 'lesson', 'learn', 'education',
    'teach', 'teacher', 'student', 'study', 'class', 'school',
    'university', 'college', 'academy', 'masterclass', 'workshop'
  ];
  
  // Technology keywords
  const technologyKeywords = [
    'tech', 'technology', 'software', 'hardware', 'code', 'programming',
    'developer', 'engineer', 'coding', 'javascript', 'python', 'react',
    'node', 'backend', 'frontend', 'devops', 'cloud', 'aws', 'azure'
  ];
  
  // Business keywords
  const businessKeywords = [
    'business', 'startup', 'entrepreneur', 'marketing', 'sales',
    'finance', 'invest', 'money', 'economy', 'stock', 'trade',
    'ceo', 'founder', 'company', 'strategy', 'management'
  ];
  
  // Health keywords
  const healthKeywords = [
    'health', 'fitness', 'workout', 'exercise', 'gym', 'yoga',
    'meditation', 'mental', 'wellness', 'diet', 'nutrition',
    'doctor', 'medical', 'therapy', 'mindfulness'
  ];
  
  // Design keywords
  const designKeywords = [
    'design', 'ui', 'ux', 'user experience', 'user interface',
    'graphic', 'logo', 'brand', 'typography', 'color',
    'figma', 'sketch', 'adobe', 'photoshop', 'illustrator'
  ];
  
  // Check for category matches
  if (educationKeywords.some(kw => text.includes(kw))) {
    return CONTENT_CATEGORIES.EDUCATION;
  }
  if (technologyKeywords.some(kw => text.includes(kw))) {
    return CONTENT_CATEGORIES.TECHNOLOGY;
  }
  if (businessKeywords.some(kw => text.includes(kw))) {
    return CONTENT_CATEGORIES.BUSINESS;
  }
  if (healthKeywords.some(kw => text.includes(kw))) {
    return CONTENT_CATEGORIES.HEALTH;
  }
  if (designKeywords.some(kw => text.includes(kw))) {
    return CONTENT_CATEGORIES.DESIGN;
  }
  
  return CONTENT_CATEGORIES.OTHER;
}

/**
 * Extract tags from content
 */
export function extractTags(item, maxTags = 5) {
  if (!item) return [];
  
  const text = [
    item.title || '',
    item.description || '',
    item.transcript || '',
  ].join(' ').toLowerCase();
  
  // Common tags to extract
  const tagPatterns = [
    // Programming languages
    { pattern: /\b(javascript|js|typescript|ts|python|py|java|go|rust|c\+\+|ruby|php|swift|kotlin)\b/g, category: 'language' },
    // Frameworks
    { pattern: /\b(react|vue|angular|svelte|next\.?js|express|django|flask|laravel|rails|spring)\b/g, category: 'framework' },
    // Concepts
    { pattern: /\b(ai|artificial intelligence|machine learning|ml|deep learning|neural network|blockchain|crypto|web3)\b/g, category: 'concept' },
    // Tools
    { pattern: /\b(figma|sketch|adobe|photoshop|illustrator|blender|git|docker|kubernetes|aws|azure|gcp)\b/g, category: 'tool' },
  ];
  
  const tags = new Set();
  
  for (const { pattern, category } of tagPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (tags.size < maxTags) {
          tags.add(match.charAt(0).toUpperCase() + match.slice(1));
        }
      });
    }
  }
  
  // If we have existing tags, use those first
  if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
    item.tags.slice(0, maxTags).forEach(tag => tags.add(tag));
  }
  
  return Array.from(tags).slice(0, maxTags);
}

/**
 * Get content statistics
 */
export function getContentStats(items = null) {
  const videos = items || getSavedVideos();
  
  return getCachedAnalysis('content_stats', () => {
    const stats = {
      total: videos.length,
      byPlatform: {},
      byCategory: {},
      byContentType: {},
      totalDuration: 0,
      averageDuration: 0,
      totalViews: 0,
    };
    
    videos.forEach(video => {
      // Platform
      const platform = extractPlatform(video.url);
      stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
      
      // Category
      const category = categorizeContent(video);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Content type
      const contentType = video.contentType || 'video';
      stats.byContentType[contentType] = (stats.byContentType[contentType] || 0) + 1;
    });
    
    return stats;
  });
}

/**
 * Get time-based analysis
 */
export function getTimeAnalysis(timeRange = TIME_RANGES.LAST_7_DAYS) {
  const videos = getSavedVideos();
  
  return getCachedAnalysis(`time_analysis_${timeRange}`, () => {
    const now = new Date();
    let startDate = new Date(0); // Default to all time
    
    switch (timeRange) {
      case TIME_RANGES.TODAY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case TIME_RANGES.YESTERDAY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case TIME_RANGES.LAST_7_DAYS:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case TIME_RANGES.LAST_30_DAYS:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case TIME_RANGES.THIS_MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case TIME_RANGES.LAST_MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        return analyzeTimeRange(videos, startDate, endDate);
      default:
        break;
    }
    
    return analyzeTimeRange(videos, startDate, now);
  });
}

/**
 * Analyze time range
 */
function analyzeTimeRange(videos, startDate, endDate) {
  const analysis = {
    count: 0,
    byDay: {},
    byHour: {},
    totalDuration: 0,
    platforms: {},
    categories: {},
  };
  
  videos.forEach(video => {
    const savedAt = new Date(video.savedAt);
    
    if (savedAt >= startDate && savedAt <= endDate) {
      analysis.count++;
      
      // By day
      const dayKey = savedAt.toISOString().split('T')[0];
      analysis.byDay[dayKey] = (analysis.byDay[dayKey] || 0) + 1;
      
      // By hour
      const hour = savedAt.getHours();
      analysis.byHour[hour] = (analysis.byHour[hour] || 0) + 1;
      
      // Platform
      const platform = extractPlatform(video.url);
      analysis.platforms[platform] = (analysis.platforms[platform] || 0) + 1;
      
      // Category
      const category = categorizeContent(video);
      analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    }
  });
  
  return analysis;
}

/**
 * Get usage patterns
 */
export function getUsagePatterns() {
  const videos = getSavedVideos();
  
  return getCachedAnalysis('usage_patterns', () => {
    const patterns = {
      totalSaves: videos.length,
      savesPerDay: {},
      peakHours: [],
      mostActiveDay: null,
      mostActiveHour: null,
      averageSavesPerDay: 0,
    };
    
    const byDay = {};
    const byHour = {};
    
    videos.forEach(video => {
      const savedAt = new Date(video.savedAt);
      const dayKey = savedAt.toISOString().split('T')[0];
      const hour = savedAt.getHours();
      
      byDay[dayKey] = (byDay[dayKey] || 0) + 1;
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    patterns.savesPerDay = byDay;
    
    // Find most active day
    let maxDayCount = 0;
    for (const [day, count] of Object.entries(byDay)) {
      if (count > maxDayCount) {
        maxDayCount = count;
        patterns.mostActiveDay = day;
      }
    }
    
    // Find most active hour
    let maxHourCount = 0;
    for (const [hour, count] of Object.entries(byHour)) {
      if (count > maxHourCount) {
        maxHourCount = count;
        patterns.mostActiveHour = parseInt(hour);
      }
    }
    
    // Calculate average saves per day
    const dayCount = Object.keys(byDay).length;
    patterns.averageSavesPerDay = dayCount > 0 ? Math.round(videos.length / dayCount) : 0;
    
    // Find peak hours (top 3)
    patterns.peakHours = Object.entries(byHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    return patterns;
  });
}

/**
 * Get platform analysis
 */
export function getPlatformAnalysis() {
  const videos = getSavedVideos();
  
  return getCachedAnalysis('platform_analysis', () => {
    const analysis = {
      total: videos.length,
      byPlatform: {},
      mostUsedPlatform: null,
      platformDistribution: [],
    };
    
    videos.forEach(video => {
      const platform = extractPlatform(video.url);
      analysis.byPlatform[platform] = (analysis.byPlatform[platform] || 0) + 1;
    });
    
    // Find most used platform
    let maxCount = 0;
    for (const [platform, count] of Object.entries(analysis.byPlatform)) {
      if (count > maxCount) {
        maxCount = count;
        analysis.mostUsedPlatform = platform;
      }
    }
    
    // Create distribution array
    analysis.platformDistribution = Object.entries(analysis.byPlatform)
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: Math.round((count / videos.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);
    
    return analysis;
  });
}

/**
 * Generate weekly report
 */
export function generateWeeklyReport() {
  const videos = getSavedVideos();
  const timeAnalysis = getTimeAnalysis(TIME_RANGES.LAST_7_DAYS);
  const usagePatterns = getUsagePatterns();
  const platformAnalysis = getPlatformAnalysis();
  const contentStats = getContentStats();
  
  return {
    period: TIME_RANGES.LAST_7_DAYS,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    
    summary: {
      totalSaves: timeAnalysis.count,
      averagePerDay: Math.round(timeAnalysis.count / 7),
      mostActiveDay: usagePatterns.mostActiveDay,
      peakHours: usagePatterns.peakHours,
    },
    
    platforms: platformAnalysis.platformDistribution,
    categories: Object.entries(contentStats.byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    
    insights: generateInsights(timeAnalysis, usagePatterns, platformAnalysis, contentStats),
    
    recommendations: generateRecommendations(timeAnalysis, usagePatterns, platformAnalysis, contentStats),
  };
}

/**
 * Generate insights from analysis
 */
function generateInsights(timeAnalysis, usagePatterns, platformAnalysis, contentStats) {
  const insights = [];
  
  // Check for high usage
  if (timeAnalysis.count >= 20) {
    insights.push({
      type: 'positive',
      title: 'High Engagement',
      description: `You saved ${timeAnalysis.count} videos this week. Keep up the great work!`,
    });
  }
  
  // Check for consistent usage
  const dayCount = Object.keys(timeAnalysis.byDay).length;
  if (dayCount >= 5) {
    insights.push({
      type: 'positive',
      title: 'Consistent Usage',
      description: `You used DopaQueue on ${dayCount} out of 7 days. Building a great habit!`,
    });
  }
  
  // Check for platform diversity
  if (Object.keys(platformAnalysis.byPlatform).length >= 3) {
    insights.push({
      type: 'positive',
      title: 'Diverse Content',
      description: `You're saving from ${Object.keys(platformAnalysis.byPlatform).length} different platforms.`,
    });
  }
  
  // Check for category focus
  const topCategory = Object.entries(contentStats.byCategory)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topCategory && topCategory[1] > timeAnalysis.count * 0.5) {
    insights.push({
      type: 'neutral',
      title: 'Focused Learning',
      description: `${topCategory[1]} of your saves are in ${topCategory[0]}. Consider exploring other topics!`,
    });
  }
  
  // Check for low usage
  if (timeAnalysis.count < 5) {
    insights.push({
      type: 'suggestion',
      title: 'Get More Value',
      description: 'Try saving more videos to build your knowledge library!',
    });
  }
  
  return insights;
}

/**
 * Generate recommendations
 */
function generateRecommendations(timeAnalysis, usagePatterns, platformAnalysis, contentStats) {
  const recommendations = [];
  
  // Recommend based on usage patterns
  if (usagePatterns.mostActiveHour) {
    recommendations.push({
      title: 'Optimal Time',
      description: `You're most active at ${usagePatterns.mostActiveHour}:00. Schedule your learning sessions then!`,
      action: 'Set reminder',
    });
  }
  
  // Recommend based on categories
  const topCategory = Object.entries(contentStats.byCategory)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topCategory && topCategory[0] !== CONTENT_CATEGORIES.OTHER) {
    recommendations.push({
      title: 'Deep Dive',
      description: `You enjoy ${topCategory[0]} content. Explore more in this category!`,
      action: 'Browse recommendations',
    });
  }
  
  // Recommend based on platform
  if (platformAnalysis.mostUsedPlatform === PLATFORMS.YOUTUBE) {
    recommendations.push({
      title: 'YouTube Power User',
      description: 'You save a lot from YouTube. Try using the transcript feature for deeper insights!',
      action: 'Enable transcripts',
    });
  }
  
  // Recommend cloud sync if not enabled
  if (!hasFeature('cloudSync')) {
    recommendations.push({
      title: 'Sync Across Devices',
      description: 'Upgrade to Pro to sync your saves across all your devices.',
      action: 'Upgrade now',
      premium: true,
    });
  }
  
  return recommendations;
}

/**
 * Get similar content recommendations
 */
export function getSimilarContent(item, limit = 5) {
  if (!item) return [];
  
  const videos = getSavedVideos();
  const category = categorizeContent(item);
  const platform = extractPlatform(item.url);
  const tags = extractTags(item);
  
  return videos
    .filter(video => video.id !== item.id)
    .map(video => ({
      video,
      score: calculateSimilarityScore(video, item, category, platform, tags),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ video }) => video);
}

/**
 * Calculate similarity score between two items
 */
function calculateSimilarityScore(video, item, category, platform, tags) {
  let score = 0;
  
  // Same category
  if (categorizeContent(video) === category) {
    score += 30;
  }
  
  // Same platform
  if (extractPlatform(video.url) === platform) {
    score += 20;
  }
  
  // Similar tags
  const videoTags = extractTags(video);
  const matchingTags = tags.filter(tag => videoTags.includes(tag));
  score += matchingTags.length * 10;
  
  // Similar title
  const titleSimilarity = calculateTextSimilarity(
    video.title || '',
    item.title || ''
  );
  score += titleSimilarity * 20;
  
  // Recent saves get slight boost
  const videoDate = new Date(video.savedAt);
  const now = new Date();
  const daysAgo = (now - videoDate) / (1000 * 60 * 60 * 24);
  if (daysAgo < 7) {
    score += 10;
  }
  
  return Math.min(100, score);
}

/**
 * Calculate text similarity (simple implementation)
 */
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = [...new Set([...words1, ...words2])].length;
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
}

/**
 * Get learning path recommendations
 */
export function getLearningPath(category = null, limit = 10) {
  const videos = getSavedVideos();
  
  // If no category specified, use the most common one
  if (!category) {
    const stats = getContentStats();
    const topCategory = Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    category = topCategory || CONTENT_CATEGORIES.OTHER;
  }
  
  // Filter videos by category
  const categoryVideos = videos.filter(video => 
    categorizeContent(video) === category
  );
  
  // Sort by saved date (newest first for learning path)
  return categoryVideos
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .slice(0, limit);
}

/**
 * Search videos with advanced filtering
 */
export function searchVideos(query, filters = {}) {
  const videos = getSavedVideos();
  
  if (!query && Object.keys(filters).length === 0) {
    return videos;
  }
  
  return videos.filter(video => {
    // Text search
    if (query) {
      const searchText = query.toLowerCase();
      const videoText = [
        video.title || '',
        video.channel || '',
        video.description || '',
        video.transcript || '',
        ...(video.tags || []),
      ].join(' ').toLowerCase();
      
      if (!videoText.includes(searchText)) {
        return false;
      }
    }
    
    // Platform filter
    if (filters.platform) {
      const videoPlatform = extractPlatform(video.url);
      if (videoPlatform !== filters.platform) {
        return false;
      }
    }
    
    // Category filter
    if (filters.category) {
      const videoCategory = categorizeContent(video);
      if (videoCategory !== filters.category) {
        return false;
      }
    }
    
    // Content type filter
    if (filters.contentType) {
      if (video.contentType !== filters.contentType) {
        return false;
      }
    }
    
    // Date range filter
    if (filters.startDate || filters.endDate) {
      const videoDate = new Date(video.savedAt);
      if (filters.startDate && videoDate < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && videoDate > new Date(filters.endDate)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get analysis summary for dashboard
 */
export function getAnalysisSummary() {
  const videos = getSavedVideos();
  const stats = getContentStats();
  const usage = getUsagePatterns();
  const platform = getPlatformAnalysis();
  
  return {
    totalVideos: videos.length,
    totalCategories: Object.keys(stats.byCategory).length,
    totalPlatforms: Object.keys(stats.byPlatform).length,
    averageSavesPerDay: usage.averageSavesPerDay,
    mostActiveDay: usage.mostActiveDay,
    mostUsedPlatform: platform.mostUsedPlatform,
    topCategory: Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other',
  };
}

/**
 * Export analysis data for backup/export
 */
export function exportAnalysisData() {
  const videos = getSavedVideos();
  const notes = getNotes();
  const cache = getScrapeCache();
  
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    summary: getAnalysisSummary(),
    contentStats: getContentStats(),
    platformAnalysis: getPlatformAnalysis(),
    usagePatterns: getUsagePatterns(),
    weeklyReport: generateWeeklyReport(),
    videos: videos.map(video => ({
      ...video,
      // Add analysis metadata
      category: categorizeContent(video),
      platform: extractPlatform(video.url),
      tags: extractTags(video),
    })),
    notes,
    cacheMetadata: {
      count: Object.keys(cache).length,
      size: Object.values(cache).reduce((sum, item) => 
        sum + (item.transcript?.length || 0), 0),
    },
  };
}

export default {
  // Constants
  ANALYSIS_TYPES,
  CONTENT_CATEGORIES,
  PLATFORMS,
  TIME_RANGES,
  
  // Utility functions
  clearAnalysisCache,
  extractPlatform,
  extractVideoId,
  categorizeContent,
  extractTags,
  calculateTextSimilarity,
  
  // Analysis functions
  getContentStats,
  getTimeAnalysis,
  getUsagePatterns,
  getPlatformAnalysis,
  generateWeeklyReport,
  getSimilarContent,
  getLearningPath,
  searchVideos,
  getAnalysisSummary,
  exportAnalysisData,
};


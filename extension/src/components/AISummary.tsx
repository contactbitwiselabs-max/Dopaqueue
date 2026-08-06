import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Zap, FileText, Copy, Download, Share2, 
  Loader2, Sparkles, Check, AlertTriangle,
  Eye, EyeOff, Settings, RefreshCw
} from 'lucide-react';
import { useI18n } from '../shared/i18n';

interface AISummaryProps {
  content: string;
  url: string;
  title: string;
  onSave?: (summary: string) => void;
  onShare?: (summary: string) => void;
  onCopy?: (text: string) => void;
  isPro?: boolean;
  className?: string;
}

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  readingTime: number;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export function AISummary({
  content,
  url,
  title,
  onSave,
  onShare,
  onCopy,
  isPro = false,
  className = '',
}: AISummaryProps {
  const { t } = useI18n();
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const generateSummary = useCallback(async () => {
    if (!content.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setAnimationKey(k => k + 1);
    
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would call an actual AI service
      const mockSummary: SummaryResult = {
        summary: generateMockSummary(content),
        keyPoints: extractKeyPoints(content),
        actionItems: extractActionItems(content),
        readingTime: Math.ceil(content.split(' ').length / 200),
        topics: extractTopics(content),
        sentiment: analyzeSentiment(content),
      };
      
      setSummary(mockSummary);
    } catch (err) {
      setError('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [content]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(text);
  };

  const handleShare = () => {
    if (summary) {
      const text = `${title}\n\n${summary.summary}\n\nKey Points:\n${summary.keyPoints.map(p => `• ${p}`).join('\n')}\n\nSource: ${url}`;
      navigator.share?.({ text }).catch(() => handleCopy(
        `${title}\n\n${summary.summary}\n\nSource: ${url}`
      ));
      onShare?.(summary.summary);
    }
  };

  const handleSave = () => {
    if (summary) {
      onSave?.(summary.summary);
    }
  };

  // Auto-generate on mount if content is available
  useEffect(() => {
    if (content.trim() && !summary && !isGenerating) {
      generateSummary();
    }
  }, [content, generateSummary, summary, isGenerating]);

  if (!content.trim()) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-8 text-center bg-slate-800/50 border border-slate-700 ${className}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-500 flex items-center justify-center"
        >
          <Brain className="w-8 h-8 text-black" />
        </motion.div>
        <h3 className="text-xl font-bold text-white mb-2">AI Summary Available</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Click "Generate Summary" to get an AI-powered summary with key points, action items, and reading time estimate.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {}}
          className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-lime-500 to-emerald-500 text-black"
        >
          Generate Summary
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={animationKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="p-3 rounded-xl bg-gradient-to-br from-lime-500 to-emerald-500"
          >
            <Brain className="w-6 h-6 text-black" />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-white">AI Summary</h3>
            <p className="text-sm text-slate-400">Powered by AI • {content.split(' ').length} words</p>
          </div>
        </div>
        
        {isPro && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-lime-500 to-emerald-500 text-black rounded-full"
          >
            Pro Feature
          </motion.span>
        )}
      </div>

      {/* Generate Button / Loading State */}
      <AnimatePresence mode="wait">
        {!summary && !isGenerating && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateSummary}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-lime-500 to-emerald-500 text-black flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              <span>Generate AI Summary</span>
              <Sparkles className="w-5 h-5 animate-pulse" />
            </motion.button>
            
            <p className="text-center text-sm text-slate-500 mt-3">
              This will analyze the content and generate a summary with key points, action items, and reading time.
            </p>
          </motion.div>
        )}

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
                <div>
                  <p className="font-medium text-white">Analyzing content...</p>
                  <p className="text-sm text-slate-400">AI is reading and understanding the content</p>
                </div>
              </div>
              
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-lime-500 to-emerald-500"
                />
              </div>
              
              <p className="text-center text-sm text-slate-500">
                This usually takes 10-30 seconds depending on content length
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-300">Failed to generate summary</p>
                <p className="text-sm text-slate-400">{error}</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateSummary}
              className="mt-3 w-full py-2 px-4 rounded-xl font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Try Again
            </motion.button>
          </motion.div>
        )}

        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl p-6 bg-gradient-to-br from-lime-500/10 to-emerald-500/10 border border-lime-500/30"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="p-2 rounded-lg bg-lime-500/20 text-lime-400"
                  >
                    <FileText className="w-5 h-5" />
                  </motion.div>
                  <div>
                    <h4 className="font-bold text-white">Summary</h4>
                    <p className="text-sm text-slate-400">
                      ~{summary.readingTime} min read • {summary.topics.slice(0, 3).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCopy(summary.summary)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title={copied ? 'Copied!' : 'Copy summary'}
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-lime-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-slate-400" />
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Share summary"
                  >
                    <Share2 className="w-5 h-5 text-slate-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Save to queue"
                  >
                    <Download className="w-5 h-5 text-slate-400" />
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>
                {showFull ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="prose dark:prose-invert max-w-none mt-4"
                  >
                    {summary.summary}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="prose dark:prose-invert max-w-none line-clamp-3"
                  >
                    {summary.summary}
                  </motion.div>
                )}
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFull(!showFull)}
                  className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  {showFull ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Read More
                    </>
                  )}
                </motion.button>
                
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${
                      summary.sentiment === 'positive' ? 'bg-green-500' :
                      summary.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    <span className="capitalize">{summary.sentiment}</span>
                  </span>
                </div>
              </motion.div>
            </motion.div>

            {/* Key Points */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-6 bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-lime-400" />
                <h4 className="font-bold text-white">Key Points</h4>
              </div>
              <ul className="space-y-3">
                {summary.keyPoints.map((point, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-700/50 border border-slate-600/50"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 + i * 0.1 }}
                      className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-lime-500/20 text-lime-400 rounded-full"
                    >
                      {i + 1}
                    </motion.span>
                    <p className="text-slate-300 text-sm">{point}</p>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Action Items */}
            {summary.actionItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl p-6 bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-white">Action Items</h4>
                </div>
                <ul className="space-y-2">
                  {summary.actionItems.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 border border-slate-600/50"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.4 + i * 0.1 }}
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-emerald-400/20 text-emerald-400 rounded-full"
                      >
                        <Check className="w-4 h-4" />
                      </motion.div>
                      <p className="text-slate-300 text-sm">{item}</p>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Topics & Metadata */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl p-6 bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white">Topics</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.topics.map((topic, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.05, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ scale: 1.05 }}
                    className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium"
                  >
                    {topic}
                  </motion.span>
                ))}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-700/50">
                <div className="text-center p-3 rounded-xl bg-slate-700/50">
                  <p className="text-2xl font-bold text-white">{summary.readingTime}</p>
                  <p className="text-xs text-slate-400">min read</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-700/50">
                  <p className="text-2xl font-bold text-white">{summary.keyPoints.length}</p>
                  <p className="text-xs text-slate-400">key points</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-700/50">
                  <p className="text-2xl font-bold text-white">{summary.actionItems.length}</p>
                  <p className="text-xs text-slate-400">actions</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-700/50">
                  <p className="text-2xl font-bold text-white">{summary.topics.length}</p>
                  <p className="text-xs text-slate-400">topics</p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-3 pt-4"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCopy(summary.summary)}
                className="flex-1 py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-lime-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Summary
                  </>
                )}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleShare}
                className="px-6 py-3 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-lime-500 to-emerald-500 text-black flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Save
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Mock AI generation functions (replace with actual AI service)
function generateMockSummary(content: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const topSentences = sentences.slice(0, 3).join('. ') + '.';
  return topSentences || 'Summary not available.';
}

function extractKeyPoints(content: string): string[] {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  return sentences.slice(0, 5).map(s => s.trim() + '.');
}

function extractActionItems(content: string): string[] {
  const actionKeywords = ['should', 'must', 'need to', 'action', 'todo', 'follow up', 'next step'];
  const sentences = content.split(/[.!?]+/).filter(s => 
    actionKeywords.some(k => s.toLowerCase().includes(k))
  );
  return sentences.slice(0, 3).map(s => s.trim() + '.');
}

function extractTopics(content: string): string[] {
  // Simple topic extraction (in production, use NLP)
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'great', 'best', 'awesome', 'fantastic', 'wonderful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'disappointing', 'frustrating', 'annoying', 'broken'];
  
  const words = content.toLowerCase().split(/\s+/);
  let positive = 0, negative = 0;
  
  words.forEach(w => {
    if (positiveWords.includes(w)) positive++;
    if (negativeWords.includes(w)) negative++;
  });
  
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

export default AISummary;
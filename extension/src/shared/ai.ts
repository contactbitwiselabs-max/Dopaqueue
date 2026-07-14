// @ts-nocheck
// DopaQueue Local-First AI & Action Checklist Extractor
// BYOK (Bring Your Own Key) for Google Gemini / OpenAI, plus a Free Local Heuristic Extractor

// --- Chrome AI Nano Helpers ---
export async function isChromeAIAvailable() {
  return typeof window !== 'undefined' && 'ai' in window && 'summarizer' in (window as any).ai;
}

export async function summarizeWithChromeAI(text: string): Promise<string | null> {
  if (!await isChromeAIAvailable()) return null;
  try {
    const ai = (window as any).ai;
    const canSummarize = await ai.summarizer.capabilities();
    if (canSummarize.available === 'no') {
      console.warn("Chrome AI summarizer is not available on this device.");
      return null;
    }
    
    // Use shared or standard mode depending on Chrome version
    let summarizer;
    if (canSummarize.available === 'readily') {
      summarizer = await ai.summarizer.create({ type: 'tl;dr', format: 'markdown', length: 'medium' });
    } else {
      summarizer = await ai.summarizer.create({ type: 'tl;dr', format: 'markdown', length: 'medium' });
      await summarizer.ready;
    }
    
    // Chunking if text is huge (Nano has limit)
    const MAX_CHARS = 15000;
    const truncatedText = text.slice(0, MAX_CHARS);
    
    const summary = await summarizer.summarize(truncatedText);
    return summary;
  } catch (err) {
    console.error("Chrome AI Summarizer error:", err);
    return null;
  }
}

export async function isChromeAILanguageModelAvailable() {
  return typeof window !== 'undefined' && 'ai' in window && 'languageModel' in (window as any).ai;
}

export async function generateChromeAIInsights(metrics: any): Promise<string | null> {
  if (!await isChromeAILanguageModelAvailable()) return null;
  try {
    const ai = (window as any).ai;
    const canUse = await ai.languageModel.capabilities();
    if (canUse.available === 'no') return null;

    let session;
    if (canUse.available === 'readily') {
      session = await ai.languageModel.create({
        systemPrompt: "You are an empathetic digital wellbeing coach. Read the user's focus metrics and provide one concise, encouraging paragraph with a single specific piece of advice to improve their focus health.",
        temperature: 0.7,
      });
    } else {
      session = await ai.languageModel.create({
        systemPrompt: "You are an empathetic digital wellbeing coach. Read the user's focus metrics and provide one concise, encouraging paragraph with a single specific piece of advice to improve their focus health.",
        temperature: 0.7,
      });
      await session.ready;
    }

    const prompt = `Here are my scrolling metrics:
- Peak scrolling hour: ${metrics.heatmap?.[0] ? metrics.heatmap[0].hour + ':00' : 'Unknown'}
- Attention span: ${metrics.attentionDecay?.avgCurve?.length || 'Unknown'} reels before losing focus
- Current healthy focus streak: ${metrics.streak?.current || 0} days
- Longest focus streak: ${metrics.streak?.longest || 0} days
Please give me a short, empathetic paragraph (max 3 sentences) interpreting these stats and suggesting one actionable improvement.`;

    const result = await session.prompt(prompt);
    return result;
  } catch (err) {
    console.error("Chrome AI LanguageModel error:", err);
    return null;
  }
}
// ------------------------------

export async function getAIConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(['dq_ai_config']);
    return data.dq_ai_config || { provider: 'local', apiKey: '' };
  }
  return { provider: 'local', apiKey: '' };
}

export async function setAIConfig(config) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ dq_ai_config: config });
  }
}

// Extractive local heuristic fallback (100% free, offline, instant)
function extractLocalInsights(title, transcript) {
  if (!transcript || transcript.length < 20) {
    return {
      summary: [
        `Video overview: ${title}`,
        'No full spoken transcript found to analyze details.',
        'Watch the video directly to review core concepts.'
      ],
      checklist: [
        { id: '1', text: `Watch "${title}" and take notes`, done: false },
        { id: '2', text: 'Identify one key action item for your workflow', done: false }
      ]
    };
  }

  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  // Score sentences for summary (look for significance keywords)
  const summaryKeywords = /important|key|remember|conclusion|summary|takeaway|learn|first|main|focus/i;
  const scoredForSummary = sentences.map((s, idx) => {
    let score = 0;
    if (summaryKeywords.test(s)) score += 3;
    if (idx < 5 || idx > sentences.length - 5) score += 1;
    return { sentence: s, score };
  }).sort((a, b) => b.score - a.score);

  const topSummary = scoredForSummary.slice(0, 3).map(item => item.sentence);
  while (topSummary.length < 3 && sentences.length > topSummary.length) {
    topSummary.push(sentences[topSummary.length]);
  }

  // Score sentences for checklist (look for action verbs and imperative hints)
  const actionKeywords = /should|need to|make sure|step|try|build|create|use|install|apply|practice|avoid/i;
  const scoredForAction = sentences
    .filter(s => actionKeywords.test(s))
    .slice(0, 4)
    .map((s, idx) => ({
      id: String(idx + 1),
      text: s.replace(/^([A-Z][a-z]+ ),?\s*/, '').trim(),
      done: false
    }));

  if (scoredForAction.length === 0) {
    scoredForAction.push({ id: '1', text: `Review key concepts from "${title}"`, done: false });
    scoredForAction.push({ id: '2', text: 'Apply one idea to your active project today', done: false });
  }

  return {
    summary: topSummary,
    checklist: scoredForAction
  };
}

// Main generation function
export async function generateActionChecklist(video, transcript) {
  const config = await getAIConfig();

  // 1. Google Gemini API
  if (config.provider === 'gemini' && config.apiKey) {
    try {
      const prompt = `You are a productivity AI assistant for DopaQueue. Analyze the following video title and transcript.
Title: "${video.title}"
Transcript: "${(transcript || '').slice(0, 8000)}"

Return ONLY a valid JSON object with:
- "summary": array of exactly 3 concise, highly valuable bullet points summarizing the key takeaways.
- "checklist": array of 3 to 5 actionable steps the user should complete, formatted as objects {"id": "1", "text": "action text", "done": false}.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.summary && parsed.checklist) return parsed;
    } catch (err) {
      console.warn('Gemini AI call failed, falling back to local heuristic:', err);
    }
  }

  // 2. OpenAI API
  if (config.provider === 'openai' && config.apiKey) {
    try {
      const prompt = `Analyze this video transcript and return valid JSON with "summary" (array of 3 strings) and "checklist" (array of objects {"id": "1", "text": "...", "done": false}). Title: "${video.title}". Transcript: "${(transcript || '').slice(0, 6000)}"`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      const data = await res.json();
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
      if (parsed.summary && parsed.checklist) return parsed;
    } catch (err) {
      console.warn('OpenAI call failed, falling back to local heuristic:', err);
    }
  }

  // 3. Free Local Heuristic Fallback
  return extractLocalInsights(video.title, transcript);
}

// Auto-tagging heuristic engine (instant local keyword topic matching + URL metadata scraping)
export function autoTagItem(title = '', transcript = '', url = '') {
  const matched = new Set();

  // 1. Extract explicit hashtags (#coding, #shorts, #tech, etc.) from title/transcript
  const hashtagRegex = /#([a-zA-Z0-9_-]{2,25})/g;
  let match;
  while ((match = hashtagRegex.exec(`${title} ${transcript}`))) {
    matched.add(match[1].toLowerCase());
  }

  // 2. Extract keywords from URL slug / path metadata
  if (url) {
    try {
      const u = new URL(url);
      const slugWords = u.pathname
        .split(/[\/\-_]/)
        .filter((w) => w.length > 3 && !/^\d+$/.test(w));
      slugWords.forEach((w) => {
        if (['shorts', 'watch', 'video', 'reel', 'reels', 'channel'].includes(w.toLowerCase())) {
          matched.add(w.toLowerCase());
        }
      });
    } catch (e) {
      // Ignore URL parse errors
    }
  }

  const combined = `${title} ${transcript} ${url}`.toLowerCase();

  // 3. Built-in common tags taxonomy (30+ topics)
  const taxonomy = [
    { tag: 'ai', keywords: ['ai', 'artificial intelligence', 'llm', 'gpt', 'gemini', 'neural', 'deep learning', 'machine learning'] },
    { tag: 'react', keywords: ['react', 'next.js', 'jsx', 'hooks', 'frontend', 'tailwind', 'redux'] },
    { tag: 'javascript', keywords: ['javascript', 'typescript', 'js', 'node.js', 'npm', 'es6'] },
    { tag: 'python', keywords: ['python', 'django', 'flask', 'fastapi', 'pytorch', 'pandas'] },
    { tag: 'systems', keywords: ['systems', 'architecture', 'distributed', 'microservices', 'kernel', 'linux', 'docker', 'kubernetes'] },
    { tag: 'database', keywords: ['sql', 'postgres', 'database', 'supabase', 'redis', 'nosql', 'mongodb'] },
    { tag: 'rust', keywords: ['rust', 'cargo', 'borrow checker', 'concurrency'] },
    { tag: 'neuroscience', keywords: ['dopamine', 'brain', 'neuroscience', 'focus', 'attention', 'habit', 'psychology'] },
    { tag: 'productivity', keywords: ['productivity', 'workflow', 'time management', 'second brain', 'pomodoro', 'notion', 'obsidian'] },
    { tag: 'career', keywords: ['interview', 'career', 'resume', 'engineering manager', 'leadership', 'job search'] },
    { tag: 'design', keywords: ['ui/ux', 'design', 'figma', 'typography', 'user experience', 'css'] },
    { tag: 'finance', keywords: ['finance', 'investing', 'money', 'stocks', 'crypto', 'wealth', 'budget'] },
    { tag: 'business', keywords: ['business', 'startup', 'marketing', 'sales', 'entrepreneur', 'saas'] },
    { tag: 'fitness', keywords: ['fitness', 'workout', 'health', 'nutrition', 'exercise', 'gym'] },
    { tag: 'tutorial', keywords: ['tutorial', 'how to', 'guide', 'walkthrough', 'course', 'learn'] },
    { tag: 'podcast', keywords: ['podcast', 'interview', 'talk', 'conversation', 'episode'] },
    { tag: 'review', keywords: ['review', 'vs', 'comparison', 'unboxing', 'first impressions'] },
    { tag: 'coding', keywords: ['code', 'coding', 'developer', 'programming', 'software', 'bug', 'algorithm'] },
    { tag: 'data-science', keywords: ['data science', 'analytics', 'statistics', 'data engineering'] },
  ];

  for (const { tag, keywords } of taxonomy) {
    if (keywords.some((k) => combined.includes(k))) {
      matched.add(tag);
    }
  }

  const result = Array.from(matched);
  return result.length > 0 ? result : ['learning', 'general'];
}

// ----------------------------------------------------
// Chrome AI Auto Tagging & Urgency (Phase 4)
// ----------------------------------------------------

export async function autoTagItemWithChromeAI(title = '', transcript = ''): Promise<string[] | null> {
  if (!await isChromeAILanguageModelAvailable()) return null;
  
  try {
    const ai = (window as any).ai;
    const canUse = await ai.languageModel.capabilities();
    if (canUse.available === 'no') return null;

    const session = await ai.languageModel.create({
      systemPrompt: "You are an AI that tags content. Given a title and transcript, reply ONLY with up to 3 short, lowercase, relevant tags separated by commas. No spaces after commas. Example: ai,programming,productivity",
      temperature: 0.1,
    });
    
    if (canUse.available !== 'readily') await session.ready;

    const prompt = `Title: ${title}\nTranscript: ${(transcript || '').slice(0, 3000)}`;
    const result = await session.prompt(prompt);
    
    if (result) {
      return result.split(',').map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean).slice(0, 3);
    }
  } catch (err) {
    console.error("Chrome AI AutoTag error:", err);
  }
  return null;
}

export async function suggestUrgencyWithChromeAI(title = '', transcript = ''): Promise<number | null> {
  if (!await isChromeAILanguageModelAvailable()) return null;
  
  try {
    const ai = (window as any).ai;
    const canUse = await ai.languageModel.capabilities();
    if (canUse.available === 'no') return null;

    const session = await ai.languageModel.create({
      systemPrompt: "You evaluate the urgency and educational value of content. Return ONLY a single integer from 1 (low urgency/entertainment) to 5 (high urgency/highly actionable learning/career impact). Do not explain.",
      temperature: 0.1,
    });
    
    if (canUse.available !== 'readily') await session.ready;

    const prompt = `Title: ${title}\nTranscript: ${(transcript || '').slice(0, 3000)}`;
    const result = await session.prompt(prompt);
    
    const score = parseInt(result.trim().replace(/\D/g, ''), 10);
    if (!isNaN(score) && score >= 1 && score <= 5) {
      return score;
    }
  } catch (err) {
    console.error("Chrome AI Urgency error:", err);
  }
  return null;
}



import { Type } from "@google/genai";
import { createAIClient, retryAICall as retryOperation } from "@pathway/ai";

export interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  textColor: string;
  gradientAngle: number;
}

const DEFAULT_PALETTE: ThemePalette = {
  primary: '#0f172a',
  secondary: '#1e293b',
  accent: '#E91E63',
  textColor: '#FFFFFF',
  gradientAngle: 135,
};

export const generateThemePalette = async (
  theme: string,
  location?: string,
): Promise<ThemePalette> => {
  const ai = createAIClient();

  const systemInstruction = `You are a brand color designer for "Nature Compass", a children's nature education brand under "Pathway Academy".

PATHWAY ACADEMY BRAND COLORS (choose ONE as accent):
- Navy Blue: #1A2B58
- Fuchsia Pink: #E91E63
- Golden Yellow: #FFC107
- Sky Blue: #87CEEB

NATURE COMPASS BRAND COLOR:
- Emerald Green: #059669

TASK: Given a workshop theme and optional location, generate a color palette for social media poster backgrounds.

RULES:
1. "primary" and "secondary" should be dark enough for white text readability.
2. "accent" must be one of the 4 Pathway Academy colors above.
3. "textColor" is usually #FFFFFF or a very light tint.
4. "gradientAngle" should be 45, 135, or 180.

Return ONLY valid JSON, no markdown fences.`;

  try {
    const result = await retryOperation(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction,
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primary: { type: Type.STRING, description: 'Dark gradient start color hex' },
              secondary: { type: Type.STRING, description: 'Dark gradient end color hex' },
              accent: { type: Type.STRING, description: 'One of #1A2B58, #E91E63, #FFC107, or #87CEEB' },
              textColor: { type: Type.STRING, description: 'Text color hex, usually white or light tint' },
              gradientAngle: { type: Type.NUMBER, description: 'CSS gradient angle: 45, 135, or 180' },
            },
            required: ['primary', 'secondary', 'accent', 'textColor', 'gradientAngle'],
          },
        },
        contents: [{
          role: 'user',
          parts: [{ text: `Theme: ${theme}${location ? `\nLocation: ${location}` : ''}\n\nGenerate the poster color palette.` }],
        }],
      });

      const text = response.text;
      if (!text) throw new Error('Empty response');
      return JSON.parse(text) as ThemePalette;
    });

    const validAccents = ['#1A2B58', '#E91E63', '#FFC107', '#87CEEB'];
    if (!validAccents.includes(result.accent?.toUpperCase())) {
      result.accent = '#E91E63';
    }
    return result;
  } catch (error) {
    console.error('Failed to generate theme palette, using default:', error);
    return DEFAULT_PALETTE;
  }
};

export const generateSocialMediaCopy = async (
  platform: 'wechat' | 'xhs',
  theme: string,
  learningGoals: string[],
  language: 'en' | 'zh'
): Promise<string> => {
  const ai = createAIClient();
  const platformGuideline = platform === 'xhs'
    ? `XIAOHONGSHU STYLE GUIDELINES:
- Use an extremely catchy headline.
- Use energetic, highly skimmable structure.
- Break down the learning goals into "pain points solved" or "aha moments".
- Keep paragraphs very short and snappy.
- End with an engaging question plus relevant hashtags like #NatureEducation #ParentingTips.
- The tone should be enthusiastic, trendy, and appealing to young parents.`
    : `WECHAT MOMENTS STYLE GUIDELINES:
- Use a warm, natural, and personal tone.
- Focus on the deeper educational philosophy and the child's growth.
- Keep formatting clean and elegant.
- Weave the learning goals naturally into a narrative about discovery and nature.
- End with a gentle invitation to join the activity or reflect on the theme.
- The tone should be trustworthy, professional yet intimate.`;

  const systemInstruction = `You are a top-tier social media copywriter specializing in educational and parenting content.
Your task is to write promotional copy for a new Nature Compass educational activity.

Activity Theme: ${theme}
Core Learning Goals:
${learningGoals.map(g => `- ${g}`).join('\n')}

${platformGuideline}

[CRITICAL MARKETING GOAL]
This post is specifically designed to promote and sell the "Student Handbook / Lesson Kit" for this activity.
1. You MUST explicitly mention the "Student Handbook" in the copy.
2. You MUST add an interaction hook telling parents the handbook can be customized for their child and encourage comments or direct messages.

[LANGUAGE REQUIREMENT]
Write the entire copy in ${language === 'zh' ? 'Chinese' : 'English'}.

Return ONLY the plain text copy ready to be pasted.`;

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      contents: [{ role: 'user', parts: [{ text: 'Generate the social media copy for this activity.' }] }],
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  });
};

// ---------- STEAM Activity Poster Highlights ----------

export interface SteamHighlight {
  emoji: string;
  label: string;
  desc: string;
}

export interface SteamHookItem {
  title: string;
  painPoint: string;
  salesLine: string;
}

export interface SteamCopyStyleOption {
  styleName: string;
  headline: string;
  subtitle: string;
  englishLine: string;
  hookLead: string;
}

export interface SteamPosterData {
  highlights: SteamHighlight[];
  goal: string;
  hooks: SteamHookItem[];
  englishLine: string;
  timeText: string;
  dateText: string;
  ageText: string;
  copyStyles: SteamCopyStyleOption[];
}

export const extractSteamHighlights = async (
  roadmapPhases: Array<{ phase: string; activity: string; description: string; activityType: string; learningObjective: string; timeRange?: string }>,
  learningGoals: string[],
  theme: string,
  options?: {
    durationText?: string;
    dateText?: string;
    audienceText?: string;
    language?: 'en' | 'zh';
  },
): Promise<SteamPosterData> => {
  const ai = createAIClient();
  const language = options?.language || 'zh';

  const phaseSummary = roadmapPhases
    .map((p, i) => `${i + 1}. ${p.phase} - ${p.activity}${p.timeRange ? ` [${p.timeRange}]` : ''} (${p.activityType}): ${p.description}`)
    .join('\n');

  const systemInstruction = `You are a marketing copywriter for "Nature Compass", a children's STEAM education brand.

TASK: Given STEAM workshop phases and learning goals, extract 4-6 key activity highlights for a promotional poster.

Each highlight needs:
- "emoji": a relevant single emoji
- "label": a short label (2-8 chars in Chinese, or 1-3 words in English)
- "desc": a concise action description (8-30 chars in Chinese, or <= 12 words in English)

Also provide:
- "goal": one concise sentence summarizing learning outcomes.
- "englishLine": one concise sentence explicitly showing English integration (vocabulary / sentence frames / speaking practice), parent-friendly and concrete.
- "timeText": concise duration text for poster metadata.
- "dateText": concise date text for poster metadata.
- "ageText": concise age suitability text for poster metadata.
- "hooks": 2-3 parent conversion hooks. Each hook includes:
  - "title": short hook label
  - "painPoint": concrete parent pain point
  - "salesLine": persuasive buy-in line tied to this activity
- "copyStyles": 3 optional poster copy styles for user selection. Each style includes:
  - "styleName": style tag (e.g. Professional / Warm Story / Conversion)
  - "headline": poster title option
  - "subtitle": subtitle option
  - "englishLine": English-integration line in that style
  - "hookLead": one CTA / conversion lead sentence

RULES:
- Pick visually exciting and parent-appealing activities.
- Highlight STEAM elements (science, tools/technology, building/engineering, art creation, math measurement).
- Every output MUST include explicit English-learning value, not just STEAM value.
- Hooks must directly address parent decision concerns (engagement, confidence, language exposure, practical outcomes).
- Keep all text concise and poster-ready.
- Output language: ${language === 'zh' ? 'Simplified Chinese' : 'English'}.
- Return valid JSON only, no markdown.`;

  try {
    const result = await retryOperation(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction,
          temperature: 0.6,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              highlights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    emoji: { type: Type.STRING },
                    label: { type: Type.STRING },
                    desc: { type: Type.STRING },
                  },
                  required: ['emoji', 'label', 'desc'],
                },
              },
              goal: { type: Type.STRING },
              englishLine: { type: Type.STRING },
              timeText: { type: Type.STRING },
              dateText: { type: Type.STRING },
              ageText: { type: Type.STRING },
              hooks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    painPoint: { type: Type.STRING },
                    salesLine: { type: Type.STRING },
                  },
                  required: ['title', 'painPoint', 'salesLine'],
                },
              },
              copyStyles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    styleName: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    englishLine: { type: Type.STRING },
                    hookLead: { type: Type.STRING },
                  },
                  required: ['styleName', 'headline', 'subtitle', 'englishLine', 'hookLead'],
                },
              },
            },
            required: ['highlights', 'goal', 'englishLine', 'timeText', 'dateText', 'ageText', 'hooks', 'copyStyles'],
          },
        },
        contents: [{
          role: 'user',
          parts: [{
            text:
              `Workshop theme: ${theme}\n\n` +
              `Phases:\n${phaseSummary}\n\n` +
              `Learning Goals:\n${learningGoals.map(g => `- ${g}`).join('\n')}\n\n` +
              `Duration context: ${options?.durationText || ''}\n` +
              `Date context: ${options?.dateText || ''}\n` +
              `Audience context: ${options?.audienceText || ''}\n\n` +
              `Extract poster highlights, conversion hooks, English integration line, metadata lines, and 3 copy style options.`,
          }],
        }],
      });

      const text = response.text;
      if (!text) throw new Error('Empty response');
      return JSON.parse(text) as SteamPosterData;
    });

    return {
      highlights: (result.highlights || []).slice(0, 6),
      goal: result.goal || learningGoals[0] || '',
      hooks: (result.hooks || []).slice(0, 3),
      englishLine: result.englishLine || '',
      timeText: result.timeText || '',
      dateText: result.dateText || '',
      ageText: result.ageText || '',
      copyStyles: (result.copyStyles || []).slice(0, 3),
    };
  } catch (error) {
    console.error('Failed to extract STEAM highlights:', error);
    const now = new Date();
    const durationText = options?.durationText || (language === 'zh' ? '沉浸式活动' : 'Immersive workshop');
    const dateText = options?.dateText || (
      language === 'zh'
        ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
        : now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    );
    const ageText = options?.audienceText || (language === 'zh' ? '适合儿童参与' : 'Suitable for young learners');
    return {
      highlights: roadmapPhases.slice(0, 4).map(p => ({
        emoji: '🧪',
        label: p.activity.slice(0, 12),
        desc: p.description.slice(0, 24),
      })),
      goal: learningGoals[0] || theme,
      hooks: language === 'zh'
        ? [
          { title: '专注力与表达', painPoint: '担心孩子只玩不学、表达弱。', salesLine: '每个环节都有可见学习产出，边做边说英语词句。' },
          { title: '亲子可复用', painPoint: '活动结束后难以延续学习。', salesLine: '配套手册可带回家复练，家长可直接跟做。' },
        ]
        : [
          { title: 'Focus & Expression', painPoint: 'Parents worry kids play but do not learn deeply.', salesLine: 'Each phase has visible outcomes with guided English speaking moments.' },
          { title: 'Reusable at Home', painPoint: 'Learning often stops after one class.', salesLine: 'The companion handbook enables easy parent-child follow-up practice.' },
        ],
      englishLine: language === 'zh'
        ? '英语融合：每个阶段融入关键词、句型跟读与情景表达。'
        : 'English integration: every phase includes key vocabulary, sentence frames, and guided speaking.',
      timeText: durationText,
      dateText,
      ageText,
      copyStyles: language === 'zh'
        ? [
          {
            styleName: '专业可信',
            headline: `${theme} · STEAM英语融合课`,
            subtitle: '看得见的探究过程，看得见的语言进步',
            englishLine: '每个环节都含英语关键词与口语输出任务。',
            hookLead: '私信获取可定制手册，按孩子水平匹配任务难度。',
          },
          {
            styleName: '温暖故事',
            headline: `和孩子一起走进${theme}`,
            subtitle: '在真实体验里建立科学好奇与英语自信',
            englishLine: '边探索边开口，让英语在情境里自然发生。',
            hookLead: '留言孩子年龄，我们给你推荐最适合的活动版本。',
          },
          {
            styleName: '强转化',
            headline: '不止好看，更有学习结果的活动课',
            subtitle: `${theme} 家长可见成果版`,
            englishLine: '词汇、句型、表达三步闭环，现场就能看到变化。',
            hookLead: '现在领取活动手册模板，支持按孩子个性化调整。',
          },
        ]
        : [
          {
            styleName: 'Professional',
            headline: `${theme} | STEAM + English`,
            subtitle: 'Visible inquiry outcomes with clear language growth',
            englishLine: 'Every phase includes vocabulary, sentence frames, and speaking output.',
            hookLead: 'DM for a customizable handbook matched to your child’s level.',
          },
          {
            styleName: 'Warm Story',
            headline: `Discover ${theme} with your child`,
            subtitle: 'Build curiosity, confidence, and communication through hands-on moments',
            englishLine: 'English appears naturally in each activity scenario.',
            hookLead: 'Tell us your child’s age for a tailored version.',
          },
          {
            styleName: 'Conversion',
            headline: 'More than fun: learning outcomes you can see',
            subtitle: `${theme} parent-friendly workshop edition`,
            englishLine: 'A practical 3-step loop: vocabulary, sentence frames, and expression.',
            hookLead: 'Get the take-home handbook template now.',
          },
        ],
    };
  }
};

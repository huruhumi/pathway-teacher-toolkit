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

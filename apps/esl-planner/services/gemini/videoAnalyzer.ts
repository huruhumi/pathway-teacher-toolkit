import { createAIClient } from '@pathway/ai';

export async function analyzeVideoWithGemini(url: string, topic?: string, videoName?: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
        throw new Error('Missing VITE_GEMINI_API_KEY.');
    }

    if (!url) {
        throw new Error('No video URL provided.');
    }

    const ai = createAIClient();

    const context = topic ? `This video is related to the lesson topic: "${topic}".` : '';
    const nameContext = videoName ? `The video/song is titled: "${videoName}". Use this title in your Google Search to find the exact lyrics or transcript.` : '';

    const prompt = `You are an AI assistant helping an ESL teacher prepare a lesson.
The teacher wants to use the following video URL in their class.
${context}
${nameContext}
Input Video URL: ${url}

Please use your Google Search tool to find as much reliable transcript, lyrics, or detailed summary for this exact video as possible.
Return ONLY the transcript, lyrics, or key script lines (in plain text, no markdown formatting other than line breaks).
If you cannot find any specific transcript or lyrics for this exact video, please reply exactly with: "提取失败：找不到公开的歌词或视频脚本。请手动输入。"`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            }
        });

        const text = response.text || '';
        return text.trim();
    } catch (error: any) {
        console.error("Video Analysis Error:", error);
        throw new Error(error?.message || 'Failed to analyze video.');
    }
}

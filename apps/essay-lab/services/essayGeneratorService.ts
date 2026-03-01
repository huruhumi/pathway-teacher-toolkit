import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedEssay, StudentGrade, CEFRLevel, EssayGenre, WordBankItem } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

const genreLabels: Record<EssayGenre, string> = {
    [EssayGenre.NARRATIVE]: 'Narrative Essay (记叙文)',
    [EssayGenre.ARGUMENTATIVE]: 'Argumentative Essay (议论文)',
    [EssayGenre.EXPOSITORY]: 'Expository Essay (说明文)',
    [EssayGenre.PRACTICAL]: 'Practical Writing (应用文)',
    [EssayGenre.PICTURE]: 'Picture-based Writing (看图写话)',
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A concise title for the essay" },
        content: { type: Type.STRING, description: "The full model essay text" },
        wordCount: { type: Type.NUMBER, description: "Actual word count of the essay" },
        highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 highlight sentences showcasing advanced expressions"
        },
        vocabulary: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    example: { type: Type.STRING }
                },
                required: ["word", "meaning", "example"]
            },
            description: "5-8 key vocabulary items"
        },
        structure: { type: Type.STRING, description: "Brief structural analysis of the essay (e.g., chronological, compare-contrast)" },
        teacherTip: { type: Type.STRING, description: "Teaching tip: how to use this essay in a classroom setting" }
    },
    required: ["title", "content", "wordCount", "highlights", "vocabulary", "structure", "teacherTip"]
};

export async function generateModelEssay(
    topic: string,
    grade: StudentGrade,
    cefr: CEFRLevel,
    genre: EssayGenre,
    targetWords: number
): Promise<GeneratedEssay> {
    const prompt = `You are an expert ESL teacher writing a model essay for Chinese students.

**Task**: Write a high-quality model essay (范文) with the following specifications:

- **Topic**: ${topic}
- **Student Grade**: ${grade}
- **Target CEFR Level**: ${cefr}
- **Genre**: ${genreLabels[genre]}
- **Target Word Count**: approximately ${targetWords} words

**Requirements**:
1. The essay must be age-appropriate and match the CEFR level precisely.
2. Use vocabulary and sentence structures that are slightly above the target level to serve as a learning model.
3. Include varied sentence structures (simple, compound, complex).
4. The essay should be culturally relevant to Chinese students.
5. Highlight 3-5 sentences that showcase particularly good expressions or techniques.
6. Provide 5-8 key vocabulary items with meanings and example sentences.
7. Analyze the essay structure briefly.
8. Give a practical teaching tip for classroom use.

Write naturally — this should read like a genuine high-scoring student essay, not a textbook example.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema as any,
            temperature: 0.8,
        },
    });

    const text = response.text;
    if (!text) throw new Error("AI generation failed");

    const data = JSON.parse(text);

    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        topic,
        grade,
        cefr,
        genre,
        targetWords,
        title: data.title,
        content: data.content,
        wordCount: data.wordCount,
        highlights: data.highlights,
        vocabulary: data.vocabulary as WordBankItem[],
        structure: data.structure,
        teacherTip: data.teacherTip,
        source: 'generated',
        favorite: false,
    };
}

import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';

export const generateImagePromptCore = async (
  subject: string,
  theme: string,
  activityType: string,
  style: string
): Promise<string> => {
  const ai = createAIClient();
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a detailed image generation prompt for "${subject}".
Context: Educational workshop theme "${theme}", Activity type "${activityType}".
Art Style: ${style}.
The prompt should be descriptive, specifying lighting, composition, and mood, suitable for a text-to-image model. Return ONLY the prompt.`,
    });
    return response.text?.trim() || `A detailed illustration of ${subject} in ${style} style.`;
  });
};

export const generateBadgePromptCore = async (theme: string, activityType: string): Promise<string> => {
  const ai = createAIClient();
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a prompt to generate a circular achievement badge icon for a workshop.
Theme: ${theme}. Activity: ${activityType}.
The badge should be simple, vector style, white background, suitable for a sticker.
Return ONLY the prompt.`,
    });
    return response.text?.trim() || `A vector badge icon for ${theme}`;
  });
};

export const generatePosterBgPromptCore = async (
  theme: string,
  stylePrompt: string,
  location: string,
  architecturalRef?: string
): Promise<string> => {
  const ai = createAIClient();
  return await retryOperation(async () => {
    const refBlock = architecturalRef
      ? `\n\nVISUAL REFERENCE (from verified sources - use these EXACT architectural details, DO NOT substitute with generic or Japanese-style buildings):
${architecturalRef.slice(0, 3000)}`
      : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert art director. I need an image generation prompt for a promotional poster background.

Theme: ${theme}
Location: ${location}
Base Style: ${stylePrompt}
${refBlock}

Your task is to rewrite the "Base Style" into an image generation prompt that specifically asks for a "visually rich, full-bleed background illustration".
The image must NOT contain any text, typography, or letters.

CRITICAL REQUIREMENTS:
1. ARCHITECTURAL ACCURACY: If a specific real-world location is mentioned, the buildings MUST match that location's actual architectural style. ${location ? `For "${location}", use the exact building features described in the VISUAL REFERENCE above. Do NOT default to generic East Asian temple/pagoda styles.` : ''}
2. SEAMLESS BLENDING: The artwork must be borderless and full-bleed. Do NOT create a "picture frame", "box", or strict split. The illustration should seamlessly fill the entire canvas.
3. BOTTOM FADE: The bottom 40% of the image must smoothly dissolve into deep dark tones (near-black) using a natural atmospheric fade - NOT a hard gradient line. Think of it as the scene naturally darkening into shadow/mist/twilight. The transition should be imperceptible.
4. NO HARD EDGES: There must be NO visible boundary between the illustrated area and the dark area. Use atmospheric perspective, fog, scattered petals, or ambient light particles to create a natural dissolution.

Return ONLY the final image generation prompt.`
    });
    return response.text?.trim() || `A rich atmospheric full-bleed background for ${theme} at ${location}, ${stylePrompt}, smoothly fading into dark empty space at the bottom, no text, clean atmospheric illustration.`;
  });
};

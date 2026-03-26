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
    const locationText = (location || '').trim();
    const refBlock = architecturalRef
      ? `\n\nVISUAL REFERENCE (from verified sources - use these EXACT architectural details, DO NOT substitute with generic or Japanese-style buildings):
${architecturalRef.slice(0, 3000)}`
      : '';
    const locationBlock = locationText ? `Location: ${locationText}` : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert art director. I need an image generation prompt for a poster BACKGROUND SCENE ONLY.

Theme: ${theme}
${locationBlock}
Base Style: ${stylePrompt}
${refBlock}

Your task is to rewrite the "Base Style" into an image generation prompt that specifically asks for a "visually rich, full-bleed background scene illustration".
Important: this is NOT a poster mockup. It must be a direct scene, not a photo print/card/frame shown inside another background.
The image must NOT contain any text, typography, or letters.

CRITICAL REQUIREMENTS:
1. ARCHITECTURAL ACCURACY: If a specific real-world location is provided, the buildings MUST match that location's actual architectural style. ${locationText ? `For "${locationText}", use the exact building features described in the VISUAL REFERENCE above. Do NOT default to generic East Asian temple/pagoda styles.` : ''}
2. SEAMLESS BLENDING: The artwork must be borderless and full-bleed. Do NOT create a "picture frame", "box", or strict split. The illustration should seamlessly fill the entire canvas.
3. COMPOSITION PRIORITY: Put the main visual subject and important details in the TOP 55-65% of the frame.
4. LOWER SAFE AREA: Keep the LOWER 35-45% visually calm as a dark low-detail area (deep navy/charcoal, mostly solid with subtle texture) so text can overlay without covering essential scene content.
5. NO HARD SPLITS: The transition from upper focal area to lower calm area must feel natural and atmospheric, not a sharp boundary or synthetic panel.
6. NO INSET LAYOUT: Never render an inner poster, framed mini-image, postcard, paper block, white margin area, irregular silhouette cutout, or sticker-like island scene. The scene must occupy the whole canvas from edge to edge.
7. NARRATIVE COHERENCE: The scene should feel like one believable moment, not a collage of unrelated mini-scenes. Avoid clutter and random unrelated objects.
8. ACTIVITY-FIRST PRIORITY: Emphasize activity actions, participants, and relevant props first. Only include landmark/location cues when location is explicitly provided.
9. HARD NEGATIVE OBJECTS: Do NOT include binder clips, clothespins, tape corners, hanging strings, pinboards, paper borders, or any mounted photo/polaroid effect.
10. TONAL BASE: Background base color should remain dark and cohesive; avoid large pale or blank areas.

Return ONLY the final image generation prompt.`
    });
    return response.text?.trim() || `A rich atmospheric full-bleed background for ${theme}${locationText ? ` in ${locationText}` : ''}, ${stylePrompt}, with focal subject in the upper half and a low-detail decorative lower half, no text, clean atmospheric illustration.`;
  });
};

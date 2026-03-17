import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';

export const generateImageCore = async (prompt: string, aspectRatio: string = "4:3"): Promise<string> => {
  const ai = createAIClient();

  try {
    return await retryOperation(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: { aspectRatio: aspectRatio }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType;
          const b64Data = part.inlineData.data;
          return `data:${mimeType};base64,${b64Data}`;
        }
      }
      throw new Error("No image generated");
    });
  } catch (e: unknown) {
    console.error("Image generation failed", e);
    return "";
  }
};

/**
 * Generate a stylized illustration using a reference photo.
 *
 * 2-step approach:
 * Step 1: analyze the photo with text model
 * Step 2: enrich prompt and generate image
 */
export const generateImageWithRefCore = async (
  prompt: string,
  referenceImageDataUrl: string,
  aspectRatio: string = "4:3"
): Promise<string> => {
  const ai = createAIClient();

  const match = referenceImageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    console.warn('Invalid reference image data URL, falling back to text-only');
    return generateImageCore(prompt, aspectRatio);
  }

  const [, mimeType, base64Data] = match;

  try {
    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            }
          },
          {
            text: `Analyze this photo for an illustrator. Describe in detail:
1. ARCHITECTURE: Building shapes, rooflines, materials, colors, proportions, number of stories, window styles, decoration elements
2. SURROUNDINGS: Trees, flowers, paths, sky conditions, lighting direction
3. COMPOSITION: Camera angle, depth, foreground/background elements
4. DISTINCTIVE FEATURES: Any unique architectural details that make this building recognizable

Be extremely specific and visual. Use short, punchy phrases an artist can follow.
Output 150-250 words. No introduction, just the description.`
          }
        ]
      },
      config: {
        temperature: 0.3,
      }
    });

    const photoDescription = analysisResponse.text || '';
    console.log('[RefImage] Photo analysis:', photoDescription.slice(0, 200));

    const enrichedPrompt = `${prompt}

REFERENCE PHOTO DESCRIPTION (reproduce these architectural details accurately):
${photoDescription}`;

    return await generateImageCore(enrichedPrompt, aspectRatio);
  } catch (e: unknown) {
    console.error("Reference image analysis failed, falling back to text-only", e);
    return generateImageCore(prompt, aspectRatio);
  }
};

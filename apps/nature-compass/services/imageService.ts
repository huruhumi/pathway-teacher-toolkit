// Image generation and prompt creation (barrel wrappers)

import { generateImageCore, generateImageWithRefCore } from './gemini/imageGeneration';
import { generateImagePromptCore, generateBadgePromptCore, generatePosterBgPromptCore } from './gemini/imagePrompting';

export const generateImagePrompt = async (
  subject: string,
  theme: string,
  activityType: string,
  style: string
): Promise<string> => generateImagePromptCore(subject, theme, activityType, style);

export const generateImage = async (prompt: string, aspectRatio: string = "4:3"): Promise<string> =>
  generateImageCore(prompt, aspectRatio);

export const generateImageWithRef = async (
  prompt: string,
  referenceImageDataUrl: string,
  aspectRatio: string = "4:3"
): Promise<string> => generateImageWithRefCore(prompt, referenceImageDataUrl, aspectRatio);

export const generateBadgePrompt = async (theme: string, activityType: string): Promise<string> =>
  generateBadgePromptCore(theme, activityType);

export const generatePosterBgPrompt = async (
  theme: string,
  stylePrompt: string,
  location: string,
  architecturalRef?: string
): Promise<string> => generatePosterBgPromptCore(theme, stylePrompt, location, architecturalRef);

import { generateAIImage } from '@pathway/ai';

export const generateLessonImage = (
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<string> => generateAIImage(prompt, aspectRatio);

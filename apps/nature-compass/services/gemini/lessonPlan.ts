import { Part } from "@google/genai";
import { LessonInput, LessonPlanResponse } from "../../types";
import { getTotalPages } from '../../constants/handbookDefaults';
import { resolvePageConfig, buildHandbookRules } from './handbookRules';
import { lessonPlanSchema } from './schema';
import { extractJSON } from './parsing';
import { NatureLessonPlanResponseSchema } from '@shared/types/schemas';
import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';

export async function generateLessonPlanCore(input: LessonInput, signal?: AbortSignal): Promise<LessonPlanResponse> {
  const ai = createAIClient();

  // Compute handbook page target for roadmap scaling
  const pageConfig = resolvePageConfig(input);
  const handbookPageTarget = pageConfig
    ? getTotalPages(pageConfig)
    : (input.autoPageTarget || (input.duration <= 60 ? 10 : input.duration <= 90 ? 15 : input.duration <= 120 ? 20 : input.duration <= 150 ? 25 : 30));
  // Content pages = total minus system pages (Cover, ToC, Certificate, BackCover -> 4)
  const contentPages = Math.max(5, handbookPageTarget - 4);
  // Each roadmap phase should map to ~3 content pages (1 BgKnow + 1-2 Activity/Worksheet)
  const minRoadmapPhases = Math.max(5, Math.ceil(contentPages / 3));

  const systemInstruction = `
    You are an expert STEAM Curriculum Designer and TESOL Specialist. 
    Goal: Generate a comprehensive ${input.duration}-minute "Nature Compass" weekend workshop plan for ESL students (Ages ${input.studentAge}).
    
    [Pedagogical Framework: 5E Instructional Model]
    You MUST structure the 'Roadmap' following the 5E sequence to ensure a systematic learning experience:
    1. ENGAGE: Hook the students, activate prior knowledge, and introduce the narrative.
    2. EXPLORE: Hands-on exploration where students interact with materials/nature.
    3. EXPLAIN: Formal introduction of vocabulary and scientific concepts.
    4. ELABORATE: Apply knowledge to a new challenge or creative project.
    5. EVALUATE: Review learning, check understanding, and celebrate success.

    [Parameters]
    - Theme: ${input.theme || "Derived from uploaded materials"}
    - Context/Introduction: ${input.topicIntroduction}
    - Season: ${input.season}
    - Weather Condition: ${input.weather}
    - Activity Focus: ${input.activityFocus.join(', ')}
    - CEFR Level: ${input.cefrLevel || 'A1 (Beginner)'}
    - Family Mode Rule: If this is a Family mode lesson, write ALL instructor-facing content directly addressing parents. When providing background scientific knowledge for parents, MUST include a simplified analogy or 'how to explain this to your child' version.

    [Core Logic: Weather-Adaptive Strategy]
    - If "Sunny", prioritize high-engagement Outdoor exploration and data collection.
    - [Safety & Risk Management] Provide COMPREHENSIVE safety protocols:
      * Adult-to-child ratios (minimum 1:5 for water activities, 1:8 for land activities)
      * Explicit safe-zone boundaries (e.g. "do NOT go past the marked rope/cone line")
      * Tool handling rules (scissors, magnifying glasses, collection jars)
      * Biological contact principles ("look but don't touch" for unknown species, hand-washing protocol)
      * Sun/bug protection checklist (sunscreen, hats, insect repellent, long sleeves near water)
      * Emergency response flow: injury 闂?first aid kit location 闂?emergency contact 闂?nearest hospital
      * Weather-specific risks: heat stroke signs (for sunny), slippery surfaces (for rainy)
      * Allergy awareness: check for bee/pollen/plant allergies before nature walks
    
    - [Location & Transportation Constraints] The recommended outdoor venue MUST be:
      * A REAL, existing location in or near the specified city
      * Reachable within 30 minutes by public transport or school bus from the city center
      * For single-session courses (闂?180 min), NEVER recommend locations requiring > 1 hour round-trip travel
      * If the location is remote, the course MUST include a detailed transportation plan and adjusted activity timing
    - [Duration Limits] If duration is <= 90 minutes, strictly limit to 1-2 major core activities to avoid rushing. Ensure ample time for setup, instruction, and student output.
    - If "Rainy", pivot to Indoor Maker/Lab scenarios using natural specimens, simulations, or indoor experiments.
    - [Indoor Alternative Equivalence] When designing rainy-day indoor alternatives:
      * The indoor activity MUST achieve the SAME learning objectives as the outdoor version
      * Use real specimens, interactive multimedia, model-building, or role-play to maintain hands-on engagement
      * Include explicit ESL scaffolding even in indoor mode (sentence frames, vocabulary walls, pair discussions)
      * Avoid passive alternatives (just watching videos) 闂?students must still DO something physical

    [Roadmap Requirements]
    - The Roadmap MUST have enough phases to support the handbook. For a ${handbookPageTarget}-page handbook, generate ${minRoadmapPhases}-${minRoadmapPhases + 2} phases.
    - If ${minRoadmapPhases} > 5, subdivide 5E stages into sub-phases (e.g. EXPLORE: Field Observation, EXPLORE: Specimen Collection, EXPLORE: Data Recording).
    - Each phase must include detailed 'steps' (5-7 actionable steps, plus explicit classroom management/grouping tips for outdoor environments), 'backgroundInfo' (5-8 RICH factual points with specific data, names, numbers, cause-effect explanations 闂?these are the PRIMARY source material for handbook Background Knowledge pages and MUST be substantive enough to fill full pages), 'teachingTips' (ESL scaffolding, outdoor classroom management signals, group role assignments, and differentiation strategies), and 'activityInstructions' (student-facing instructions that include: activity goal in 1 sentence, materials needed, numbered step-by-step instructions with specific actions, and time allocation per step 闂?this text will be used directly in handbook Activity pages).
    - Description for each phase MUST be 6-8 sentences minimum with concrete actions, scientific/historical/cultural facts, and specific details. This description serves as source material for handbook pages 闂?vague summaries will produce thin, useless handbook content.

    ${buildHandbookRules(input)}

    Structure Requirement:
    - Mission Briefing: Engaging title & narrative.
    - Vocabulary: 8-10 key terms with simple definitions.
    - Handbook: Meticulously structured instructional design following the handbook rules above.
    [LANGUAGE] ALL output 闂?titles, descriptions, steps, vocabulary, handbook content 闂?MUST be written entirely in English. Even if the theme, city, or location name is in Chinese, translate everything to English. Do NOT mix Chinese into any field.
    [EASY MATERIALS ONLY] All supplies and materials must be everyday items easily found at home, a convenience store, or the natural environment (magnifying glass, notebook, colored pencils, ziplock bags, string, recycled bottles, phone apps, etc.). Absolutely NO 3D printers, professional sensors, drones, expensive lab kits, or specialty online-order materials.
  `;

  // Handle uploaded files for context
  let contents: any = [{ text: "Please generate the lesson plan based on these requirements." }];

  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = [];
    input.uploadedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data
          }
        });
      } else {
        // For text/pdf we use inlineData
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data
          }
        });
      }
    });
    parts.push({ text: "Reference materials attached above. Use them to shape the theme and activities." });
    contents = [{ parts }];
  }

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Complex task
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
      contents: contents
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return NatureLessonPlanResponseSchema.parse(extractJSON(text)) as LessonPlanResponse;
  }, signal);
}

/**
 * Generates a fact sheet using Gemini's Google Search grounding.
 * Used in single lesson kit flow to provide RAG-like knowledge base
 * without requiring the full NotebookLM pipeline.
 */
export async function generateFactSheetCore(
  input: LessonInput,
  signal?: AbortSignal
): Promise<{ content: string; quality: 'good' | 'low' | 'insufficient' }> {
  const ai = createAIClient();

  const themeLabel = input.theme || 'Nature education STEAM lesson';
  const ageLabel = input.studentAge || '6-8 years';
  const durationLabel = input.duration || 90;

  const prompt = [
    `You are a nature education curriculum research assistant. Research the following topic thoroughly and generate a structured bilingual (English + Chinese) teaching knowledge base.`,
    ``,
    `## Course Info`,
    `- Theme: ${themeLabel}`,
    `- Target Age: ${ageLabel}`,
    `- Duration: ${durationLabel} minutes`,
    ``,
    `## Research Requirements`,
    `1. Core scientific knowledge related to the theme (appropriate depth for ${ageLabel})`,
    `2. Relevant natural ecology, history, culture, and geography from authoritative sources`,
    `3. STEAM teaching entry points (scientific observation, technology tools, engineering builds, art creation, math measurement)`,
    `4. Safety considerations and seasonal tips for outdoor teaching`,
    `5. Specific guidance for activity steps (materials, tools, time allocation)`,
    `6. Accurate descriptions of related species, cultural heritage, geographic features`,
    ``,
    `## Output Format`,
    `Generate the fact sheet in TWO sections:`,
    ``,
    `### PART 1: ENGLISH`,
    `Write the full research fact sheet in English with clear headings and paragraphs.`,
    ``,
    `### PART 2: CHINESE`,
    `Write the same content in Chinese (Simplified) with matching structure.`,
    ``,
    `## Rules`,
    `- Cite all sources as [1], [2], etc. 闂?share the same citation list for both languages`,
    `- Do NOT fabricate facts. If information is unavailable, state it clearly`,
    `- Prioritize educational, government, and academic sources`,
    `- Total length: 4000-8000 characters (both languages combined)`,
  ].join('\n');

  try {
    const response = await retryOperation(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
        },
      }),
      signal
    );

    const text = response?.text || '';

    // Assess quality based on content length and citation count
    const citationCount = (text.match(/\[\d+\]/g) || []).length;
    const wordCount = text.length;

    let quality: 'good' | 'low' | 'insufficient';
    if (wordCount > 1500 && citationCount >= 3) {
      quality = 'good';
    } else if (wordCount > 500) {
      quality = 'low';
    } else {
      quality = 'insufficient';
    }

    return { content: text, quality };
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.error('FactSheet generation failed:', err);
    return { content: '', quality: 'insufficient' };
  }
}

import { Type, Schema, Part } from "@google/genai";
import { LessonInput, LessonPlanResponse, UploadedFile, HandbookPageConfig } from "../types";
import { getPresetPageConfig, getTotalPages } from '../constants/handbookDefaults';

// --- Shared AI Utilities ---
import { NatureLessonPlanResponseSchema } from '@shared/types/schemas';
import { createAIClient } from '@shared/ai/client';
import { retryAICall as retryOperation } from '@shared/ai/retry';

export { retryOperation }; // Re-export for sub-modules to use without rewriting all imports immediately

export const THEME_PERSPECTIVES = [
  "Microscopic View (Zoom in on tiny details)",
  "Time Travel (Ancient past or distant future)",
  "Detective Mystery (Solving a nature riddle)",
  "Survival Mode (Living off the land)",
  "Alien Explorer (First time seeing Earth)",
  "Superhero Academy (Nature's superpowers)",
  "Chef's Kitchen (Edible science)",
  "Art Heist (Stealing colors/textures)",
  "Underground Kingdom (Roots and bugs)",
  "Sky Pirates (Wind and weather)"
];

export const PATHWAY_BRAND_STYLE_BLOCK = `
[Pathway Academy Brand Identity (MANDATORY)]
The generated 'handbookStylePrompt' MUST incorporate these brand elements:
- Primary: Deep Navy Blue (#1A2B58) for headings & borders
- Accent 1: Vibrant Fuchsia Pink (#E91E63) for CTA boxes & subtitles
- Accent 2: Warm Golden Yellow (#FFC107) for icons & highlights
- Accent 3: Sky Blue (#87CEEB) for soft background tints
- Style: Modern flat vector illustrations, geometric shapes (hexagons & chevrons)
- Background: White (#FFFFFF) or near-white (#F8F9FA)
- Typography: Geometric sans-serif (Montserrat, Open Sans)
- Layout: Rounded-corner bordered activity zones, high negative space
`;


export const lessonPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    missionBriefing: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A catchy title for the workshop." },
        narrative: { type: Type.STRING, description: "A 2-sentence hook narrative." },
      },
      required: ["title", "narrative"],
    },
    basicInfo: {
      type: Type.OBJECT,
      description: "Overview of the workshop details.",
      properties: {
        theme: { type: Type.STRING },
        activityType: { type: Type.STRING, description: "e.g. 'Outdoor STEAM / Biology' or 'Indoor Maker / Physics'" },
        targetAudience: { type: Type.STRING, description: "e.g. 'ESL Students Ages 6-8'" },
        location: { type: Type.STRING, description: "The primary venue/location for this workshop, e.g. 'Wuhan Wetland Park', 'School Garden', 'Classroom'. If derived from curriculum, use the curriculum-specified location." },
        learningGoals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 specific learning objectives (Language & STEAM)."
        },
      },
      required: ["theme", "activityType", "targetAudience", "location", "learningGoals"],
    },
    vocabulary: {
      type: Type.OBJECT,
      properties: {
        keywords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              definition: { type: Type.STRING },
            },
            required: ["word", "definition"],
          },
        },
        phrases: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Essential classroom phrases.",
        },
      },
      required: ["keywords", "phrases"],
    },
    roadmap: {
      type: Type.ARRAY,
      description: "The schedule of activities.",
      items: {
        type: Type.OBJECT,
        properties: {
          timeRange: { type: Type.STRING, description: "e.g., 00-30m" },
          phase: { type: Type.STRING, description: "Phase name like 'Ice-breaking' or 'Core Challenge'" },
          activity: { type: Type.STRING, description: "Name of the specific activity" },
          activityType: { type: Type.STRING, description: "Type of activity e.g. 'Science', 'Art', 'Movement'." },
          location: { type: Type.STRING, description: "Specific setting for this step, e.g. 'Classroom Rug', 'Outdoor Garden', 'Science Lab'." },
          description: { type: Type.STRING, description: "A detailed narrative (6-8 sentences minimum) including specific theme, context, factual content, and enough detail to serve as source material for handbook Activity/Worksheet pages. Do NOT write a vague summary — include concrete actions, locations, and subject matter." },
          learningObjective: { type: Type.STRING, description: "Specific learning goal for this time block." },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5-7 detailed, actionable instructional steps for the teacher. Each step should be specific enough to follow without additional explanation."
          },
          backgroundInfo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5-8 detailed factual points with specific data, names, numbers, and explanations. These WILL BE transformed into student-facing Reading/Background Knowledge handbook pages, so they must be rich enough to fill a full page. Include scientific names, historical dates, measurable quantities, cause-effect explanations."
          },
          teachingTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 specific tips covering: (1) ESL scaffolding (TPR, visual aids, sentence frames), (2) outdoor classroom management (attention signals like clapping patterns, boundary markers, buddy system, countdown timers), (3) group activity structure (clear role assignments like recorder/observer/collector, rotation protocols), (4) differentiation strategies."
          },
        },
        required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips"],
      },
    },
    supplies: {
      type: Type.OBJECT,
      properties: {
        permanent: { type: Type.ARRAY, items: { type: Type.STRING } },
        consumables: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["permanent", "consumables"],
    },
    safetyProtocol: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A comprehensive list of 6-10 specific safety measures covering: adult-child ratios, boundary rules, tool handling, biological contact, sun/bug protection, emergency procedures, weather-specific risks, and allergy awareness."
    },
    visualReferences: {
      type: Type.ARRAY,
      description: "A list of 3-5 visual aids needed for the lesson (e.g. finished craft example, process diagram).",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Short title of the visual aid." },
          description: { type: Type.STRING, description: "Detailed visual description for an artist or AI generator." },
          type: { type: Type.STRING, description: "Type of visual: 'Photo', 'Diagram', 'Illustration'." },
        },
        required: ["label", "description", "type"],
      },
    },
    handbookStylePrompt: {
      type: Type.STRING,
      description: "A comprehensive, universal style prompt for Notebook LM (or Midjourney) that defines the global aesthetic, color palette, and illustration style so all handbook pages look unified."
    },
    handbook: {
      type: Type.ARRAY,
      description: "A detailed design plan for a student handbook.",
      items: {
        type: Type.OBJECT,
        properties: {
          pageNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          section: { type: Type.STRING, description: "Category: 'Cover', 'Introduction', 'Table of Contents', 'Safety', 'Prop Checklist', 'Background Knowledge', 'Reading', 'Instructions', 'Activity/Worksheet', 'Reflection', 'Certificate', 'Back Cover'." },
          layoutDescription: { type: Type.STRING, description: "How the page should look (e.g. 'Split screen with large hero image')." },
          visualPrompt: { type: Type.STRING, description: "Prompt for generating the visual assets for this page." },
          contentPrompt: { type: Type.STRING, description: "Prompt to generate the text content for this page." },
        },
        required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt"]
      }
    },
    notebookLMPrompt: { type: Type.STRING, description: "A summary prompt for NotebookLM." },
    handbookStructurePlan: { type: Type.STRING, description: "Auto mode only: a short text plan listing the chosen section breakdown before generating the handbook array. Required when handbook mode is auto." },
    imagePrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 descriptions for generating AI images/flashcards."
    },
  },
  required: ["missionBriefing", "basicInfo", "vocabulary", "roadmap", "supplies", "safetyProtocol", "visualReferences", "handbookStylePrompt", "handbook", "notebookLMPrompt", "imagePrompts"],
};

/**
 * Resolve the effective page config array from input (handles auto/preset/custom).
 */
function resolvePageConfig(input: LessonInput): HandbookPageConfig[] | null {
  if (input.handbookMode === 'auto') {
    // If user confirmed a page target and config distribution matches, use the config
    if (input.autoPageTarget && input.handbookPageConfig.some(c => c.enabled && c.count > 0)) {
      const configTotal = input.handbookPageConfig.filter(c => c.enabled).reduce((sum, c) => sum + c.count, 0);
      // Only use config if its total matches the user's target; otherwise fall through to pure auto
      if (configTotal === input.autoPageTarget) {
        return input.handbookPageConfig;
      }
    }
    return null; // pure auto — AI decides everything, using autoPageTarget as the target count
  }
  if (input.handbookMode === 'preset') return getPresetPageConfig(input.handbookPreset);
  return input.handbookPageConfig;
}

/**
 * Build family-mode prompt adaptations.
 * Injected into the system prompt when input.mode === 'family'.
 */
function buildFamilyModeRules(input: LessonInput): string {
  if (input.mode !== 'family') return '';

  const eslBlock = input.familyEslEnabled
    ? `
    [Natural English Immersion for Parent-Child]
    Since the parent chose English Exploration mode:
    - Weave natural English exposure into activities: name plants, animals, colors, shapes in English together.
    - Use conversational prompts like "Let's say this in English: ..." or "Can you point to something green?"
    - NO formal classroom ESL techniques (no TPR drills, no choral repetition, no flashcard games).
    - The tone should be playful bilingual discovery, not language instruction.
    `
    : `
    [Pure STEAM Exploration — No English]
    This is a pure parent-child STEAM exploration. Do NOT include any English teaching content.
    All vocabulary should be STEAM terms in Chinese with Chinese definitions.
    `;

  return `
    [CRITICAL: PARENT-CHILD MODE]
    This workshop is designed for ONE PARENT + 1-2 CHILDREN exploring nature together on a weekend.
    It is NOT for a classroom teacher with a group of students.

    Key adaptations:
    1. ROLE: You are a parent-child nature exploration designer, NOT a classroom teacher.
    2. AUDIENCE: Write for a parent who may not have teaching experience. Use warm, encouraging tone.
    3. STEPS (roadmap.steps): Write as conversational PARENT DIALOGUE GUIDES, not teacher instructions.
       - Use phrasing like: "和孩子一起观察..." / "Ask your child: Do you notice...?"
       - "Pick up a leaf together and compare: which one is bigger?"
       - "Let your child lead — follow their curiosity!"
       - Do NOT use classroom management language ("distribute worksheets", "have students form groups").
    4. TEACHING TIPS → PARENT INTERACTION TIPS (teachingTips):
       - Focus on: how to engage a curious child, how to handle "I don't know" moments, 
         how to turn mistakes into discoveries, safety reminders for outdoor exploration.
       - Do NOT reference TPR, checking questions, scaffolding, or formal pedagogy.
    5. HANDBOOK CONTENT ADAPTATION:
       - Activity/Worksheet pages become: scavenger hunt checklists, "draw what you see" pages,
         parent-child Q&A games, nature bingo, sticker collection spots, observation journals.
       - Certificate becomes: "Parent-Child Explorer Certificate" with a photo spot.
       - Remove institutional elements (attendance, assessment rubrics).
    6. SUPPLIES: Only include items a family would realistically bring on a weekend outing
       (magnifying glass, notebook, colored pencils, ziplock bags — NOT classroom supplies).

        - [STEAM Integration] Each roadmap phase's 'activityType' MUST explicitly label which STEAM discipline(s) it covers (Science/Technology/Engineering/Art/Math). The overall lesson MUST include at least ONE activity that explicitly integrates Technology (e.g. digital identification tools, data recording apps, measurement devices) and at least ONE that integrates Mathematics (e.g. size estimation, area calculation, data graphing, counting/sorting). Do NOT let tech/math be implicit — name the specific tool or calculation.

    ${eslBlock}

    IMPORTANT: The handbook's visual style (handbookStylePrompt) MUST be IDENTICAL to school mode — same Pathway Academy brand colors, same white (#FFFFFF) page backgrounds, same age-appropriate illustration style and decorative motifs. Only the page CONTENT (contentPrompt) differs between modes.
  `;
}

/**
 * Build mode-aware handbook rules for system prompts.
 */
function buildHandbookRules(input: LessonInput): string {
  const age = input.studentAge;
  const cefr = input.cefrLevel || 'A1 (Beginner)';
  const pageConfig = resolvePageConfig(input);

  // --- Age-adaptive style guidance ---
  const ageNum = parseInt(String(age)) || 8; // parse lower bound from e.g. "6-8"
  const ageStyleGuide = ageNum <= 5
    ? `Illustration Style for Ages 3-5: Soft, rounded, cute cartoon characters with big eyes. Pastel-accented elements on WHITE backgrounds. Chunky hand-drawn feel. Large playful shapes. Think: picture book aesthetic.`
    : ageNum <= 8
      ? `Illustration Style for Ages 6-8: Friendly flat vector illustrations with bold outlines. Bright accent colors on WHITE backgrounds. Geometric shapes (hexagons, chevrons). Clean and inviting. Think: modern educational workbook.`
      : `Illustration Style for Ages 9-14: Sophisticated flat vector or low-poly illustrations. Muted accent colors on WHITE backgrounds. Infographic-quality layouts with clean data visualizations. Think: National Geographic Kids aesthetic.`;

  // --- Shared rules across all modes ---
  const sharedRules = `
    [Handbook Quality Rules]
    1. GLOBAL STYLE: Generate a 'handbookStylePrompt' that follows these rules:
       - PAGE BACKGROUNDS MUST BE WHITE (#FFFFFF). No colored backgrounds on any page.
       - Only UI elements (headers, borders, call-out boxes, icons, accents) use the Pathway Academy brand colors.
       - ${ageStyleGuide}
       - The style must be detailed enough for Midjourney/NotebookLM to reproduce a consistent visual across all pages.
       - Reference the workshop THEME in the style (e.g., nature/garden themes should use leaf, plant, insect motifs in decorative elements).
    2. STRICT SYNCHRONIZATION: Every Roadmap phase MUST have ≥1 corresponding 'Activity/Worksheet' or 'Reading' page. The handbook is the student's physical guide.
    3. BACKGROUND KNOWLEDGE INTEGRATION: Extract facts from the Roadmap's 'backgroundInfo' into student-facing 'Background Knowledge' / 'Reading' passages. Use inquiry-based tone — pose questions and paradoxes.
    4. RICH, EXACT CONTENT: 'contentPrompt' must contain EXACT text for the page — actual paragraphs, questions, fill-in-the-blanks, or instructions. No vague summaries.
    5. AGE & LANGUAGE ADAPTATION (Age ${age}, CEFR ${cefr}):
       CRITICAL: The ENTIRE handbook content — every page type — MUST be calibrated to the student's cognitive and linguistic level. Apply THESE age-specific rules:

       [Ages 3-5 / Pre-A1 — Preschool]
       - Activity/Worksheet: ONE simple task per page. Only tracing dotted letters, circling correct pictures, coloring, sticker placement, matching with lines. Max 3 English words per instruction (e.g., "Circle the leaf"). Illustration-to-text ratio 80:20. Use large icons to show what to do instead of written instructions.
       - Reading: Picture story format. 1-2 simple repetitive sentences per page ("I see a ___", "This is a ___"). Font size 24pt+. One key vocabulary word highlighted per page with a large labeled illustration.
       - Background Knowledge: Visual fact cards — single large image with one labeled caption. No paragraphs. "This is a [butterfly]" format. Use real photos or clear illustrations.
       - Reflection: Draw-only. "Draw your favorite thing today" with a large empty box. Smiley face circles to rate feelings (😊😐😢). No writing required.
       - Vocabulary: Max 5 words. Each with a large picture, the English word, and phonetic guide. No definitions in text.
       - Roadmap phases: Max 5 minutes per phase. Simple action verbs: look, touch, smell, draw, find.

       [Ages 6-9 / A1 — Primary Lower]
       - Activity/Worksheet: 1-2 tasks per page. Short 3-5 word commands. Matching, drawing what they observe, simple fill-in-blanks with word banks, tick/cross exercises. Illustrations guide each step.
       - Reading: EN version: 15-30 words per page (ESL A1). ZH version: 50-90 chars per page (native). Use/字 per page. Use 1-2 very short paragraphs with controlled vocabulary (sight words + theme-specific words). Provide explicit language scaffolding (sentence frames, simple definitions) embedded in the text. Large font (18pt+). Picture support for key concepts. MUST include: 1 "Did You Know?" fun fact box with a surprising real-world detail, and 1 simple comprehension check question. Content must teach REAL subject knowledge — not filler sentences.
       - Background Knowledge: "Did You Know?" format with 3-4 fun facts (not just 2). Each fact should be 2-3 sentences with specific numbers or names (e.g. "A butterfly has 12,000 eyes!" not "Butterflies have many eyes"). Paired with illustrations. Use speech bubbles from cartoon characters.
       - Reflection: Simple sentence starters ("Today I learned ___", "My favorite part was ___"). Draw + write 1 sentence.
       - Vocabulary: 6-8 words with pictures, simple 3-5 word definitions.

       [Ages 10-12 / A2 — Primary Upper]
       - Activity/Worksheet: Multi-step tasks okay. Simple data tables, observation logs, labeled diagrams to complete. Short paragraph instructions. Can include simple graphs to read.
       - Reading: EN version: 30-50 words per page (ESL A2). ZH version: 100-180 chars per page (native). 2-3/字 per page. 2-3 substantive paragraphs with cause-effect reasoning. Break text into small chunks with heavy visual support. MUST include explicit language scaffolding for new terminology. Include labeled diagrams or infographic elements. MUST include: vocabulary callouts (bold key terms with brief definitions), and 2-3 comprehension questions (mix of multiple choice + short answer). Reading content should provide enough background knowledge for the student to understand and complete the associated activity independently.
       - Background Knowledge: Infographic-style with labeled diagrams, comparison charts, and "Fast Facts" sidebars. 3-4 paragraphs MINIMUM with specific data points (measurements, dates, scientific names). Include at least one "Think About It" inquiry question.
       - Reflection: Guided journal prompts. "What surprised you? Why do you think...?" 3-4 sentence responses expected.

       [Ages 13-15 / B1 — Middle School]
       - Activity/Worksheet: Complex multi-step investigations. Data collection tables, graph plotting, hypothesis testing. Scientific method framework. Can include math calculations.
       - Reading: EN version: 50-80 words per page (ESL B1). ZH version: 180-250 chars per page (native). 4-6/字 per page. 4-6 substantive paragraphs with academic vocabulary, cross-references, and embedded critical thinking prompts. Can reference real research findings (simplified). Include annotation suggestions. MUST have 3-4 comprehension + analysis questions.
       - Background Knowledge: Detailed explanations with cross-references and simplified scientific terminology. 4-5 paragraphs with data visualizations, process diagrams, or comparison tables. Include "Deep Dive" sidebars for advanced learners.
       - Reflection: Open-ended analytical questions. "Compare and contrast...", "What evidence supports...?" Extended writing expected.

       [Ages 16-18 / B2+ — High School]
       - Activity/Worksheet: Research-level tasks. Independent data analysis, experimental design, statistical reasoning. Professional lab report format.
       - Reading: EN version: 75-110 words per page (ESL B1-B2). ZH version: 250-350 chars per page (native). Academic/字 per page. Academic-level passages with citations to real sources. Include annotation prompts, margin notes, and Socratic discussion questions. Content should challenge assumptions and present multiple perspectives.
       - Background Knowledge: University-prep depth. 5-6 paragraphs with simplified research findings, methodology explanations, and connections to cutting-edge developments in the field.
       - Reflection: Essay-style reflection. Connect to broader concepts, propose extensions, evaluate methodology.
    6. PROMPT DETAIL:
       - 'visualPrompt': Exact illustration description (style, subject, composition). Always specify WHITE background (to save printer ink), but MUST include instructions for nature-themed decorative borders, page margin elements, and age-appropriate illustration styles so pages aren't visually empty.
       - 'contentPrompt': Exact printed text, questions, worksheet structure.
    7. TEXT/UI FORMATTING: All student-facing reading pages MUST prioritize text-image integration. Break large text blocks into short sentences paired with small icons, dialogue bubbles, or infographics. DO NOT output dense paragraphs.
    8. CERTIFICATE: Design a premium certificate that matches the workshop's THEME and Nature Compass outdoor exploration aesthetic. Include nature-themed decorative borders (leaves, vines, compass roses, or elements related to the workshop topic). Use the Pathway Academy color palette for accents on a WHITE background. Include a CIRCULAR dashed-border placeholder (diameter 4cm) labeled 'Place Your Pathway Badge Here', positioned bottom-center. Use decorative serif typography for the award title. Include lines for student name, date, and teacher signature.
    9. BACK COVER: Pathway Academy branding, inspirational nature quote, contact info. WHITE background.

    
    [CROSS-REFERENCE RULES — MANDATORY]
    The handbook MUST directly reference content from other generated sections. Do NOT generate handbook content in isolation.
    10. PROP CHECKLIST pages: contentPrompt MUST list the EXACT items from the 'supplies' output (permanent + consumables). ALL teaching aids, tools, or materials mentioned in 'teachingTips' or activities MUST be explicitly included in this list. output (permanent + consumables) — same names, same quantities. Do NOT invent different supply items or rename them.
    10. SAFETY pages: contentPrompt MUST incorporate the EXACT rules from the 'safetyProtocol' output, reformulated into student-friendly language with icons/illustrations.
    11. ACTIVITY/WORKSHEET pages: Each page MUST explicitly state which Roadmap phase it corresponds to (e.g. "Phase 2: Explore — Field Observation"). The page title MUST reference the specific activity name from that roadmap phase.
    12. BACKGROUND KNOWLEDGE pages: contentPrompt MUST contain the 'backgroundInfo' text from the corresponding Roadmap phases, rewritten as age-appropriate student-facing passages with inquiry-based questions.
    13. READING pages: MUST reference vocabulary words from the 'vocabulary' output where relevant, using bold formatting or call-out boxes for key terms.
    14. Page ordering MUST follow the Roadmap sequence: pages should appear in the same chronological order as the phases they correspond to.

    ${PATHWAY_BRAND_STYLE_BLOCK}
  `;

  // --- AUTO mode ---
  if (!pageConfig) {
    const pageTarget = input.autoPageTarget || (input.duration <= 60 ? 10 : input.duration <= 90 ? 15 : input.duration <= 120 ? 20 : input.duration <= 150 ? 25 : 30);
    return `
    [Handbook Structure: AUTO MODE — Target ${pageTarget} pages]
    You have full autonomy to decide the optimal page composition for this workshop.
    Consider theme complexity, student age (${age}), workshop duration (${input.duration}min), and number of Roadmap phases.

    Available section types:
      Cover, Table of Contents, Safety, Prop Checklist,
      Background Knowledge, Activity/Worksheet, Reading,
      Reflection, Certificate, Back Cover

    Constraints:
    - Cover (exactly 1), Certificate (exactly 1), Back Cover (exactly 1) are MANDATORY.
    - You MUST generate EXACTLY ${pageTarget} pages total. This is the user's requested page count.
    - Each Roadmap phase MUST have ≥1 Activity/Worksheet page.
    - Insert a Background Knowledge page before each major activity cluster.
    - You MUST output a 'handbookStructurePlan' field (a short text summary) listing your chosen section breakdown BEFORE generating the 'handbook' array.

    ${sharedRules}
    `;
  }

  // --- PRESET / CUSTOM mode ---
  const enabledSections = pageConfig.filter(s => s.enabled && s.count > 0);
  const totalPages = getTotalPages(pageConfig);

  // Separate system pages from content pages for phase-interleaved layout
  const systemPageTypes = ['Cover', 'Table of Contents', 'Safety', 'Prop Checklist', 'Reflection', 'Certificate', 'Back Cover'];
  const contentPageTypes = ['Background Knowledge', 'Activity/Worksheet', 'Reading'];

  const systemPages = enabledSections.filter(s => systemPageTypes.includes(s.section));
  const contentPages = enabledSections.filter(s => contentPageTypes.includes(s.section));

  const frontMatter = systemPages
    .filter(s => ['Cover', 'Table of Contents', 'Safety', 'Prop Checklist'].includes(s.section))
    .map(s => `${s.section} × ${s.count}`).join(', ');
  const backMatter = systemPages
    .filter(s => ['Reflection', 'Certificate', 'Back Cover'].includes(s.section))
    .map(s => `${s.section} × ${s.count}`).join(', ');
  const contentSummary = contentPages.map(s => `${s.section} × ${s.count}`).join(', ');

  return `
    [Handbook Structure: FIXED — ${totalPages} pages total]
    The user chose this page composition. Generate EXACTLY this structure:

    FRONT MATTER (in order): ${frontMatter || 'none'}

    CONTENT PAGES (${contentSummary}):
    CRITICAL ORDERING RULE — Do NOT group all Activity pages together or all Reading pages together.
    Instead, INTERLEAVE content pages by Roadmap phase:
      For EACH Roadmap phase (in chronological order), place:
        1. Background Knowledge page(s) for this phase (if any remain)
        2. Activity/Worksheet page(s) for this phase (if any remain)
        3. Reading page(s) for this phase (if any remain)
    Distribute the total content pages proportionally across all phases.
    The result should read like a guided journey that follows the workshop flow,
    NOT a reference book sorted by section type.

    BACK MATTER (in order): ${backMatter || 'none'}

    Do NOT add sections the user did not select. Do NOT omit selected sections.
    Number pages sequentially from 1 to ${totalPages}.

    ${sharedRules}
  `;
}

export const generateLessonPlan = async (input: LessonInput, signal?: AbortSignal): Promise<LessonPlanResponse> => {
  const ai = createAIClient();

  // Compute handbook page target for roadmap scaling
  const pageConfig = resolvePageConfig(input);
  const handbookPageTarget = pageConfig
    ? getTotalPages(pageConfig)
    : (input.autoPageTarget || (input.duration <= 60 ? 10 : input.duration <= 90 ? 15 : input.duration <= 120 ? 20 : input.duration <= 150 ? 25 : 30));
  // Content pages = total minus system pages (Cover, ToC, Certificate, BackCover ≈ 4)
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
      * Emergency response flow: injury → first aid kit location → emergency contact → nearest hospital
      * Weather-specific risks: heat stroke signs (for sunny), slippery surfaces (for rainy)
      * Allergy awareness: check for bee/pollen/plant allergies before nature walks
    
    - [Location & Transportation Constraints] The recommended outdoor venue MUST be:
      * A REAL, existing location in or near the specified city
      * Reachable within 30 minutes by public transport or school bus from the city center
      * For single-session courses (≤ 180 min), NEVER recommend locations requiring > 1 hour round-trip travel
      * If the location is remote, the course MUST include a detailed transportation plan and adjusted activity timing
    - [Duration Limits] If duration is <= 90 minutes, strictly limit to 1-2 major core activities to avoid rushing. Ensure ample time for setup, instruction, and student output.
    - If "Rainy", pivot to Indoor Maker/Lab scenarios using natural specimens, simulations, or indoor experiments.
    - [Indoor Alternative Equivalence] When designing rainy-day indoor alternatives:
      * The indoor activity MUST achieve the SAME learning objectives as the outdoor version
      * Use real specimens, interactive multimedia, model-building, or role-play to maintain hands-on engagement
      * Include explicit ESL scaffolding even in indoor mode (sentence frames, vocabulary walls, pair discussions)
      * Avoid passive alternatives (just watching videos) — students must still DO something physical

    [Roadmap Requirements]
    - The Roadmap MUST have enough phases to support the handbook. For a ${handbookPageTarget}-page handbook, generate ${minRoadmapPhases}-${minRoadmapPhases + 2} phases.
    - If ${minRoadmapPhases} > 5, subdivide 5E stages into sub-phases (e.g. EXPLORE: Field Observation, EXPLORE: Specimen Collection, EXPLORE: Data Recording).
    - Each phase must include detailed 'steps' (5-7 actionable steps, plus explicit classroom management/grouping tips for outdoor environments), 'backgroundInfo' (5-8 RICH factual points with specific data, names, numbers, cause-effect explanations — these are the PRIMARY source material for handbook Reading/Background Knowledge pages and MUST be substantive enough to fill full pages), 'teachingTips' (ESL scaffolding, outdoor classroom management signals, group role assignments, and differentiation strategies).
    - Description for each phase MUST be 6-8 sentences minimum with concrete actions, scientific/historical/cultural facts, and specific details. This description serves as source material for handbook pages — vague summaries will produce thin, useless handbook content.

    ${buildHandbookRules(input)}

    Structure Requirement:
    - Mission Briefing: Engaging title & narrative.
    - Vocabulary: 8-10 key terms with simple definitions.
    - Handbook: Meticulously structured instructional design following the handbook rules above.
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
      model: 'gemini-3-flash-preview', // Complex task
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
};


// --- JSON sanitizer ---

/** Extract the outermost JSON object from a string, ignoring trailing text */
function extractJSON(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return JSON.parse(raw.slice(start, i + 1)); }
  }
  // fallback: try raw parse
  return JSON.parse(raw);
}

// --- Shared Streaming Helpers ---

/**
 * Attempts to parse accumulated JSON text, closing any unclosed braces/brackets.
 * Calls onPartialResult when new top-level keys are detected.
 */
function tryPartialParse(
  text: string,
  lastKnownKeys: string[],
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
): string[] {
  try {
    const parsed = JSON.parse(text);
    const keys = Object.keys(parsed);
    if (keys.length > lastKnownKeys.length) {
      onPartialResult(parsed, keys);
      return keys;
    }
  } catch {
    let attempt = text;
    const openBraces = (attempt.match(/{/g) || []).length;
    const closeBraces = (attempt.match(/}/g) || []).length;
    const openBrackets = (attempt.match(/\[/g) || []).length;
    const closeBrackets = (attempt.match(/\]/g) || []).length;
    attempt = attempt.replace(/,\s*$/, '');
    for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}';
    try {
      const parsed = JSON.parse(attempt);
      const keys = Object.keys(parsed);
      if (keys.length > lastKnownKeys.length) {
        onPartialResult(parsed, keys);
        return keys;
      }
    } catch { /* skip */ }
  }
  return lastKnownKeys;
}

/**
 * Builds the `contents` payload, handling optional uploaded files.
 */
function buildContents(input: LessonInput, fallbackText: string): any {
  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = input.uploadedFiles.map(file => ({
      inlineData: { mimeType: file.type, data: file.data }
    }));
    parts.push({ text: fallbackText });
    return [{ parts }];
  }
  return [{ text: fallbackText }];
}

/**
 * Shared streaming core for both EN and CN lesson plan generation.
 */
async function _streamLessonPlanCore(
  systemInstruction: string,
  contents: any,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> {
  const ai = createAIClient();
  let accumulatedText = '';
  let lastKnownKeys: string[] = [];

  return await retryOperation(async () => {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
      contents,
    });

    for await (const chunk of response) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        lastKnownKeys = tryPartialParse(accumulatedText, lastKnownKeys, onPartialResult);
      }
    }

    if (!accumulatedText) throw new Error("No response from Gemini stream");
    return NatureLessonPlanResponseSchema.parse(extractJSON(accumulatedText)) as LessonPlanResponse;
  }, signal);
}

// --- Streaming Version (English / ESL) ---
export const generateLessonPlanStreaming = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  const familyMode = buildFamilyModeRules(input);
  const isFamily = input.mode === 'family';

  // Compute handbook page target for roadmap scaling (same as generateLessonPlan)
  const pageConfig = resolvePageConfig(input);
  const handbookPageTarget = pageConfig
    ? getTotalPages(pageConfig)
    : (input.autoPageTarget || (input.duration <= 60 ? 15 : input.duration <= 90 ? 20 : input.duration <= 120 ? 25 : 30));
  const contentPages = Math.max(5, handbookPageTarget - 4);
  const minRoadmapPhases = Math.max(5, Math.ceil(contentPages / 3));

  const roleBlock = isFamily
    ? `You are an expert parent-child nature exploration activity designer.
    Goal: Generate a fun, engaging ${input.duration}-minute "Nature Compass" weekend parent-child exploration plan for a family with children (Ages ${input.studentAge}).`
    : `You are an expert STEAM Curriculum Designer and TESOL Specialist. 
    Goal: Generate a comprehensive ${input.duration}-minute "Nature Compass" weekend workshop plan for ESL students (Ages ${input.studentAge}).`;

  const eslBlock = (!isFamily || input.familyEslEnabled) ? `
    [CRITICAL: ESL Integration in ${isFamily ? 'Parent Dialogue Guides' : 'Teacher Instructions'} (steps)]
    ${isFamily
      ? `Because the parent chose English Exploration mode, weave natural English exposure into activities:
    - ENGAGE: Introduce 3-5 fun English words related to the theme through games or songs.
    - EXPLORE: Encourage naming discoveries in English: "This is called a..." "Can you say...?"
    - EXPLAIN: Use simple bilingual explanations — say the concept in both languages.
    - ELABORATE: Have the child describe their creation using new English words.
    - EVALUATE: Play a fun word recall game together.`
      : `Because this is an ESL-focused workshop, the 'steps' array in EACH roadmap phase MUST integrate explicit English language teaching activities alongside the STEAM activity flow. Specifically:
    - ENGAGE: Include a step for introducing 3-5 target vocabulary words using flashcards or picture cards.
    - EXPLORE: Include steps where students practice target sentence frames while doing hands-on activities.
    - EXPLAIN: Include explicit vocabulary instruction steps — word-card matching games, TPR drills, choral repetition, or fill-in-the-blank exercises.
    - ELABORATE: Include steps for ESL output activities — students present their work using target vocabulary, do pair sharing with sentence starters.
    - EVALUATE: Include language review steps — vocabulary quiz games, show-and-tell with learned words.
    Every phase should weave ESL teaching seamlessly into the activity, NOT as a separate section.`}
  ` : '';

  const systemInstruction = `
    ${roleBlock}
    
    [Pedagogical Framework: 5E ${isFamily ? 'Exploration' : 'Instructional'} Model]
    You MUST structure the 'Roadmap' following the 5E sequence to ensure a systematic ${isFamily ? 'exploration' : 'learning'} experience:
    1. ENGAGE: ${isFamily ? 'Spark curiosity — get the child excited about today\'s adventure.' : 'Hook the students, activate prior knowledge, and introduce the narrative.'}
    2. EXPLORE: ${isFamily ? 'Hands-on discovery together — touch, observe, collect, wonder.' : 'Hands-on exploration where students interact with materials/nature.'}
    3. EXPLAIN: ${isFamily ? 'Share fun facts together — "Did you know that...?"' : 'Formal introduction of vocabulary and scientific concepts.'}
    4. ELABORATE: ${isFamily ? 'Creative challenge — build, draw, or experiment together.' : 'Apply knowledge to a new challenge or creative project.'}
    5. EVALUATE: ${isFamily ? 'Celebrate discoveries — share what you found, take photos, high-five!' : 'Review learning, check understanding, and celebrate success.'}

    [Parameters]
    - Theme: ${input.theme || "Derived from uploaded materials"}
    - Context/Introduction: ${input.topicIntroduction}
    - Season: ${input.season}
    - Weather Condition: ${input.weather}
    - Activity Focus: ${input.activityFocus.join(', ')}
    ${(!isFamily || input.familyEslEnabled) ? `- CEFR Level: ${input.cefrLevel || 'A1 (Beginner)'}` : ''}

    [Core Logic: Weather-Adaptive Strategy]
    - If "Sunny", prioritize high-engagement Outdoor exploration and data collection.
    - If "Rainy", pivot to Indoor ${isFamily ? 'home activities' : 'Maker/Lab scenarios'} using natural specimens, simulations, or ${isFamily ? 'kitchen experiments' : 'indoor experiments'}.

    [Roadmap Requirements]
    - The Roadmap MUST have enough phases to support the handbook. For a ${handbookPageTarget}-page handbook, generate ${minRoadmapPhases}-${minRoadmapPhases + 2} phases.
    - If ${minRoadmapPhases} > 5, subdivide 5E stages into sub-phases (e.g. EXPLORE: Field Observation, EXPLORE: Specimen Collection, EXPLORE: Data Recording).
    - Each phase must include detailed 'steps' (5-7 actionable steps), 'backgroundInfo' (3-5 factual points for the teacher AND for handbook Background Knowledge pages), and 'teachingTips' (${isFamily ? 'parent interaction advice' : 'ESL scaffolding like TPR, visual aids, or sentence frames'}).
    - Description for each phase should be detailed enough (3-4 sentences minimum) to serve as source material for handbook Activity/Worksheet pages.

    ${eslBlock}

    ${familyMode}

    - [Pre/Post Class Activities] The Roadmap SHOULD include:
      * A brief pre-class preparation task that students/families can do 1-2 days before
      * A post-class extension activity that continues learning after the session
      * A simple assessment mechanism: observation checklist, portfolio show-and-tell, or peer sharing circle

    ${buildHandbookRules(input)}

    Structure Requirement:
    - Mission Briefing: Engaging title & narrative.
    - Vocabulary: 8-10 key terms with simple definitions.
    - Handbook: Meticulously structured ${isFamily ? 'parent-child activity guide' : 'instructional design'} following the handbook rules above.
  `;

  const contents = buildContents(input, "Reference materials attached above. Use them to shape the theme and activities.");
  return _streamLessonPlanCore(systemInstruction, contents, onPartialResult, signal);
};

// --- Barrel re-exports from sub-modules ---
// Consumers can keep importing from 'geminiService' unchanged.
export { generateRandomTheme } from './themeService';
export { generateImagePrompt, generateImage, generateBadgePrompt } from './imageService';
export { generateSingleStep, generateVocabularyItem, generateVisualReferenceItem, generateRoadmapItem, generateSingleBackgroundInfo, generateSingleTeachingTip, translateLessonPlan } from './contentGenerators';
export { suggestLocations, generateCurriculum, generateCurriculumCN } from './curriculumService';

// --- Streaming Version (Chinese / no ESL) ---
export const generateLessonPlanStreamingCN = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  const isFamily = input.mode === 'family';
  const familyMode = buildFamilyModeRules(input);

  const cnRoleBlock = isFamily
    ? `你是一位资深亲子自然探索活动设计师（纯中文版）。所有内容必须用中文回答。
目标：生成一个${input.duration}分钟的"Nature Compass自然指南针"亲子周末探索方案，适用于一个家长带${input.studentAge}岁孩子。`
    : `你是一位资深STEAM自然研学课程设计师（纯中文版，非ESL版本）。所有内容必须用中文回答。
目标：生成一个${input.duration}分钟的"Nature Compass自然指南针"STEAM周末研学方案，适用于${input.studentAge}岁学生。`;

  const cnFamilyBlock = isFamily ? `
[极其重要：这是亲子模式]
这个版本面向一个家长+1-2个孩子的周末自然探索，不是课堂教学。
- steps必须写成亲子对话引导（例如："和孩子一起观察..." "问孩子：你觉得为什么..."）
- 不要使用课堂管理用语（"让学生分组"、"发放工作表"）
- teachingTips改为亲子互动建议（如何引导好奇心、如何处理"不知道"的时刻、户外安全提醒）
- 物资清单仅包含家庭周末出行会带的东西（放大镜、笔记本、彩色铅笔、密封袋）
- 手册内容改为：寻宝清单、"画出你看到的"页面、亲子问答游戏、自然宾果、贴纸收集点、观察日记
- 证书改为"亲子探索家证书"，预留合影位
` : `
[极其重要：这是纯研学版本，完全排除ESL/英语教学内容]
这个版本是面向中国学生的中文STEAM研学课件，不是ESL英语教学课件。你必须严格遵守以下规则：
- 绝对不要包含任何英语教学步骤（例如：展示英文单词卡、英文句型练习、TPR、英语跟读、choral repetition等）
- 绝对不要在steps中提到flashcards、sentence frames、vocabulary drills等英语学习活动
- vocabulary部分的keywords请使用STEAM科学术语的中文定义（例如：{word: "光合作用", definition: "植物利用阳光将二氧化碳和水转化为有机物和氧气的过程"}）
- 所有步骤(steps)仅关注：研学活动流程、科学探究步骤、背景知识讲解、实验操作指导、户外观察方法
- 教学建议(teachingTips)应聚焦于：STEAM教学法、探究式学习、小组合作策略、安全注意事项、分层教学
`;

  const systemInstruction = `
${cnRoleBlock}

${cnFamilyBlock}

[${isFamily ? '探索' : '教学'}框架：5E${isFamily ? '探索' : '教学'}模型]
你必须按照5E顺序构建"${isFamily ? '探索流程' : '教学流程'}"，确保系统化的${isFamily ? '探索' : '学习'}体验：
1. 引入(Engage)：${isFamily ? '激发好奇心——让孩子对今天的冒险充满期待。' : '吸引学生注意力，激活已有知识，引入故事线。'}
2. 探索(Explore)：${isFamily ? '一起动手发现——触摸、观察、收集、好奇。' : '动手探索，学生与材料/自然互动。'}
3. 解释(Explain)：${isFamily ? '分享有趣知识——"你知道吗...?"' : '正式引入科学概念和专业术语（中文）。'}
4. 拓展(Elaborate)：${isFamily ? '创意挑战——一起搭建、绘画或做实验。' : '将知识应用于新的挑战或创意项目。'}
5. 评估(Evaluate)：${isFamily ? '庆祝发现——分享收获、拍照、击掌！' : '回顾学习成果，检验理解，庆祝成功。'}

[参数]
- 主题：${input.theme || "来自上传材料"}
- 背景/介绍：${input.topicIntroduction}
- 季节：${input.season}
- 天气条件：${input.weather}
- 活动重点：${input.activityFocus.join(', ')}

[核心逻辑：天气适应性策略]
- "晴天"：优先安排高参与度的户外探索和数据收集。
- "雨天"：转向${isFamily ? '家庭室内活动' : '室内创客/实验场景'}，使用自然标本、模拟或${isFamily ? '厨房实验' : '室内实验'}。

[${isFamily ? '探索' : '教学'}流程要求]
- 生成恰好5-6个遵循5E模型的逻辑阶段。
- 每个阶段的steps必须是具体可操作的${isFamily ? '亲子活动引导和对话建议' : '研学活动步骤和科学探究指导'}，不包含任何英语教学活动。
- 每个阶段必须包含丰富的"背景知识"（科学事实、生态知识、历史文化）和"${isFamily ? '亲子互动建议' : '教学建议'}"。

[${isFamily ? '亲子手册' : '学生手册'}设计规则（关键）]
以下英文规范为手册页面设计的完整规则（JSON key名保持英文），仅手册文本内容（contentPrompt）使用中文书写。背景知识页面请使用启发式、探究式语气——通过提问和悖论引发好奇心，而非直接陈述事实。
${buildHandbookRules(input)}

额外中文规则：
- 所有手册文本内容（contentPrompt、title）必须用中文书写。
- visualPrompt 和 handbookStylePrompt 保持英文，以确保图像生成质量。
${isFamily
      ? `- 手册重点应该是：寻宝清单、亲子互动游戏、"画出你看到的"、观察日记、自然宾果、贴纸收集。
- 证书改为"亲子探索家证书"，预留亲子合影位。`
      : `- 手册中不要包含任何英语单词学习页面、英语句型练习或英语相关活动工作表。
- 手册重点应该是：科学探究记录、实验观察表、知识问答、创意设计、反思日志。`}

结构要求：
- 任务简报：引人入胜的标题和叙事（中文）。
- 词汇：8-10个STEAM科学关键术语及中文定义。
- 手册：精心设计的${isFamily ? '亲子探索内容' : '研学内容'}，按照上述手册规则生成。
`;

  const contents = buildContents(input, "以上是参考材料，请据此设计主题和活动。");
  return _streamLessonPlanCore(systemInstruction, contents, onPartialResult, signal);
};
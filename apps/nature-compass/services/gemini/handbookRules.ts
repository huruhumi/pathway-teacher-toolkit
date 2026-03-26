import { HandbookPageConfig, LessonInput } from "../../types";
import { getPresetPageConfig, getTotalPages } from '../../constants/handbookDefaults';
import { PATHWAY_BRAND_STYLE_BLOCK } from './constants';
export function resolvePageConfig(input: LessonInput): HandbookPageConfig[] | null {
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
export function buildFamilyModeRules(input: LessonInput): string {
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
export function buildHandbookRules(input: LessonInput): string {
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

  // --- Family Mode Involvement Guidance ---
  const familyInvolvementRule = input.mode === 'family'
    ? (ageNum <= 9
      ? `\n    [Family Mode - Parent Collaboration (Ages 3-9)]\n    CRITICAL: Activities MUST be designed for strong parent-child interaction. Include explicit "Parent Tips" or "Together Time" moments where parents scaffold the learning, assist with complex steps, or co-create with the child.`
      : `\n    [Family Mode - Independent Exploration (Ages 10+)]\n    CRITICAL: Activities MUST be designed for 100% INDEPENDENT student execution. ZERO parent involvement is expected. You MUST provide exceptionally rich, detailed background information, data, and clear instructions so the student can complete the entire workbook completely autonomously.`)
    : '';

  // --- Shared rules across all modes ---
  const sharedRules = `
    [Handbook Quality Rules]
    1. GLOBAL STYLE: Generate a 'handbookStylePrompt' that follows these rules:
       - PAGE BACKGROUNDS MUST BE WHITE (#FFFFFF). No colored backgrounds on any page.
       - Only UI elements (headers, borders, call-out boxes, icons, accents) use the Pathway Academy brand colors.
       - ${ageStyleGuide}
       - The style must be detailed enough for Midjourney/NotebookLM to reproduce a consistent visual across all pages.
       - Reference the workshop THEME in the style (e.g., nature/garden themes should use leaf, plant, insect motifs in decorative elements).
    2. OCR-FRIENDLY FONTS STRICTLY REQUIRED: MUST use standard, highly legible sans-serif fonts to ensure perfect OCR text extraction later.
       - English text: Arial, Helvetica, or Verdana.
       - Chinese text: Microsoft YaHei (微软雅黑) or Noto Sans SC (思源黑体).
       - NEVER use serif (e.g., Times New Roman, 宋体), cursive, or decorative fonts on ANY page.${familyInvolvementRule}
    3. STRICT SYNCHRONIZATION: Every Roadmap phase MUST have ≥1 corresponding 'Activity/Worksheet' or 'Reading' page. The handbook is the student's physical guide.
    4. BACKGROUND KNOWLEDGE INTEGRATION: Extract facts from the Roadmap's 'backgroundInfo' into student-facing 'Background Knowledge' / 'Reading' passages. Use inquiry-based tone — pose questions and paradoxes.
    5. RICH, EXACT CONTENT: 'contentPrompt' must contain EXACT text for the page — actual paragraphs, questions, fill-in-the-blanks, or instructions. No vague summaries.
    6. AGE & LANGUAGE ADAPTATION (Age ${age}, CEFR ${cefr}):
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
    7. TEXT/UI FORMATTING (CLEAN TEXT, NO MARKDOWN TAGS): Break large text blocks into short sentences. DO NOT use raw markdown tags like "#" or "**" as they might bleed into UI presentations or plain text prints. Instead, use ALL CAPS for titles/emphasis, and simple unicode emojis (e.g. 🔹, 📍, 💡) for bullet points.
    8. AIRTIGHT TEACHER/STUDENT BOUNDARY: 'contentPrompt' is STRICTLY for the STUDENT. 'teacherContentPrompt' is STRICTLY for the TEACHER. NEVER put answer keys, conclusions, or full explanations in the 'contentPrompt' for interactive sections. Use empty underscores "_______" or checkboxes "[  ]" for students to figure out the answers. Provide the actual answers ONLY in the 'teacherContentPrompt'.
    9. HANDS-ON ACTIVITY TEMPLATES: If a Phase involves crafting, baking, building, or experimenting, the Activity page's 'contentPrompt' MUST explicitly generate: 1. A 'Materials Needed' checklist. 2. A numbered 'Step-by-Step Guide'. 3. A labeled blank placeholder for the student's output (e.g., "[Template Area: Attach your work here]").
    10. CERTIFICATE: Design a premium certificate that matches the workshop's THEME and Nature Compass outdoor exploration aesthetic. Include nature-themed decorative borders (leaves, vines, compass roses, or elements related to the workshop topic). Use the Pathway Academy color palette for accents on a WHITE background. Include a CIRCULAR dashed-border placeholder (diameter 4cm) labeled 'Place Your Pathway Badge Here', positioned bottom-center. Use decorative serif typography for the award title. Include lines for student name, date, and teacher signature.
    11. BACK COVER: Pathway Academy branding, inspirational nature quote, contact info. WHITE background.

    [CROSS-REFERENCE RULES — MANDATORY]
    The handbook MUST directly reference content from other generated sections. Do NOT generate handbook content in isolation.
    12. PROP CHECKLIST pages: contentPrompt MUST list the EXACT items from the 'supplies' output (permanent + consumables). ALL teaching aids, tools, or materials mentioned in 'teachingTips' or activities MUST be explicitly included in this list. output (permanent + consumables) — same names, same quantities. Do NOT invent different supply items or rename them.
    13. SAFETY pages: contentPrompt MUST incorporate the EXACT rules from the 'safetyProtocol' output, reformulated into student-friendly language with icons/illustrations.
    14. ACTIVITY/WORKSHEET pages: Each page MUST explicitly state which Roadmap phase it corresponds to (e.g. "Phase X: Explore — Field Observation"). The page title MUST reference the specific activity name from that roadmap phase.
    15. BACKGROUND KNOWLEDGE pages: contentPrompt MUST contain the 'backgroundInfo' text from the corresponding Roadmap phases, rewritten as age-appropriate student-facing passages with inquiry-based questions. MUST pull exactly 1 fun fact from the 'FactSheet' for every Background Knowledge page if available.
    16. READING pages: MUST embed 2-3 target words from the provided 'Vocabulary' list into every Reading page clearly.
    17. Page ordering MUST follow the Roadmap sequence: pages should appear in the same chronological order as the phases they correspond to.

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

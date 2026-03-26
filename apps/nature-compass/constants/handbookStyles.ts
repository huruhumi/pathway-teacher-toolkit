import { HANDBOOK_BRAND_COLORS, HANDBOOK_STYLE_COLOR_PALETTES } from './handbookColorSchemes';

/**
 * NotebookLM-aligned visual style presets for handbook slide deck generation.
 * Each preset includes a global style prompt incorporating Nature Compass brand colors.
 */

export interface HandbookStylePreset {
    id: string;
    /** Display label (EN) */
    label: string;
    /** Display label (ZH) */
    labelZh: string;
    /** Short description */
    description: string;
    descriptionZh: string;
    /** NotebookLM visual_style value for workflow export */
    notebookLMStyle: string;
    /** Full global style prompt template — {{THEME}} will be replaced with the actual theme */
    prompt: string;
}

const BRAND = HANDBOOK_BRAND_COLORS;

export const HANDBOOK_STYLE_PRESETS: HandbookStylePreset[] = [
    {
        id: 'classic',
        label: 'Classic',
        labelZh: '经典风格',
        description: 'Clean, professional educational design',
        descriptionZh: '简洁专业的教育设计',
        notebookLMStyle: 'classic',
        prompt: `Global Visual Style — Classic Educational
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.classic}
Typography: Clean modern sans-serif like Source Han Sans (思源黑体) or Microsoft YaHei (微软雅黑) for all body text. Bold geometric sans-serif for headings.
Layout: Clean grid-based layouts with rounded-corner bordered activity zones. High negative space. Color-coded section headers. Professional infographic quality.
Illustration Style: Modern flat vector illustrations with bold outlines. Geometric shapes (hexagons, chevrons). Subject-matter icons in Nature Compass brand colors. Consistent icon set throughout.
Theme Integration: All decorative elements, borders, and illustrations must relate to the workshop theme "{{THEME}}". Use thematic icons in headers and page corners.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'whiteboard',
        label: 'Whiteboard',
        labelZh: '白板手绘',
        description: 'Hand-drawn whiteboard sketch aesthetic',
        descriptionZh: '手绘白板素描美学',
        notebookLMStyle: 'whiteboard',
        prompt: `Global Visual Style — Whiteboard Sketch
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.whiteboard}
Typography: Clean, highly legible sans-serif like Source Han Sans (思源黑体) for all body text to maintain readability. Handwritten-style markers ONLY for large main headings.
Layout: Freeform whiteboard aesthetic with drawn boxes, arrows, and connection lines. Dashed borders, hand-drawn circles around key concepts. Sticky-note style call-out boxes. Casual, approachable layout.
Illustration Style: Sketch-style line drawings as if drawn on a whiteboard with markers. Simple diagrams, mind maps, and doodle-style icons. Imperfect hand-drawn feel with natural variations.
Theme Integration: Whiteboard sketches of "{{THEME}}" related concepts. Hand-drawn diagrams and labeled illustrations specific to the topic.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'kawaii',
        label: 'Kawaii',
        labelZh: '可爱卡通',
        description: 'Cute, rounded, playful characters (ages 3-8)',
        descriptionZh: '圆润可爱的卡通角色（3-8岁）',
        notebookLMStyle: 'kawaii',
        prompt: `Global Visual Style — Kawaii Cute
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.kawaii}
Typography: Clean rounded sans-serif like Source Han Sans (思源黑体) for all body text (18pt+). Bubbly font ONLY for large headings. Emoji-style decorative elements. Speech bubbles for instructions.
Layout: Rounded everything — rounded corners, circular badges, pill-shaped buttons. Generous spacing. Large illustration-to-text ratio (70:30). Sticker-like labels. Chunky bordered sections with dotted lines.
Illustration Style: Kawaii cute characters with oversized heads, big sparkly eyes, tiny bodies. Blushing cheeks, star sparkles. Soft pastel color fills. Cute animal mascots (bunny scientists, fox explorers, bear teachers). Every page has at least one character guiding the student.
Theme Integration: Kawaii mascot characters exploring and learning about "{{THEME}}". Characters interact with topic-specific props and environments in an adorable way.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'anime',
        label: 'Anime',
        labelZh: '动漫风格',
        description: 'Dynamic manga-inspired illustration style',
        descriptionZh: '充满活力的漫画风格',
        notebookLMStyle: 'anime',
        prompt: `Global Visual Style — Anime / Manga
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.anime}
Typography: Clean sans-serif like Source Han Sans (思源黑体) for all body text readability. Bold impact-style fonts ONLY for large headings with slight italic tilt. Manga-style sound effects and exclamation marks for emphasis. Dynamic text sizing.
Layout: Comic panel-style page divisions. Speed lines and action borders. Dramatic reveal layouts. Two-column manga reading sections. Star-burst call-out boxes. Dynamic diagonal compositions.
Illustration Style: Anime-style character illustrations with expressive faces, dynamic poses, and detailed hair. Cel-shaded coloring with visible highlights. Action lines for movement. Sparkle and glow effects. Characters aged to match student demographic.
Theme Integration: Anime characters on an exciting adventure exploring "{{THEME}}". Dynamic scenes showing discovery, experiments, and team collaboration in anime style.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'watercolor',
        label: 'Watercolor',
        labelZh: '水彩画风',
        description: 'Soft, artistic watercolor painting aesthetic',
        descriptionZh: '柔和唯美的水彩画风格',
        notebookLMStyle: 'watercolor',
        prompt: `Global Visual Style — Watercolor Art
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.watercolor}
Typography: Clean sans-serif like Source Han Sans (思源黑体) body text on white panels for strict readability. Elegant thin serif or calligraphy-style ONLY for large main headings (watercolor ink feel). Hand-lettered accent words.
Layout: Organic, flowing layouts. No harsh geometric borders — use watercolor splashes as section dividers. Torn-paper edges for content boxes. Botanical frame borders. Plenty of breathing room with natural negative space.
Illustration Style: Delicate watercolor illustrations with visible brush strokes and color gradients. Botanical watercolor paintings for nature elements. Soft edges, transparent overlays, paint splatter accents. Realistic yet artistic rendering. No hard outlines.
Theme Integration: Beautiful watercolor scenes depicting "{{THEME}}" — painted landscapes, flora, fauna, and cultural elements. Each page features a unique watercolor vignette related to the lesson content.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'retro_print',
        label: 'Retro Print',
        labelZh: '复古印刷',
        description: 'Vintage print, risograph, and letterpress aesthetic',
        descriptionZh: '复古印刷、活版印刷美学',
        notebookLMStyle: 'retro_print',
        prompt: `Global Visual Style — Retro Print
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.retro_print}
Typography: Retro rounded sans-serif like Source Han Sans (思源黑体) for all body text. Vintage slab-serif and bold condensed typefaces ONLY for large headings. Monospaced typewriter font for labels and data. Stamp-style badges and tags.
Layout: Newspaper/zine-inspired multi-column layouts. Thick rule lines as dividers. Circular badge stamps. Vintage label banners. Pull-quote boxes with ornamental borders. Numbered lists with retro bullet styles.
Illustration Style: Risograph/screen-print aesthetic — limited color, visible grain texture, halftone dots. Woodcut-style simplified illustrations. Vintage scientific diagrams. Retro botanical prints. Mid-century modern icon style.
Theme Integration: Retro-printed field guide aesthetic for "{{THEME}}". Vintage scientific illustrations, stamp-collection style visuals, and old-school educational poster design.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'heritage',
        label: 'Heritage',
        labelZh: '传统文化',
        description: 'Traditional cultural motifs and patterns',
        descriptionZh: '传统文化纹样与元素',
        notebookLMStyle: 'heritage',
        prompt: `Global Visual Style — Heritage / Traditional Culture
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.heritage}
Typography: Clean modern sans-serif like Source Han Sans (思源黑体) for all body text. Traditional calligraphy-inspired headings (楷体/regular script feel) ONLY for large titles. Seal stamp (印章) style page numbers and section markers.
Layout: Scroll-inspired page headers. Traditional cloud/wave (云纹/水波纹) pattern borders. Lattice window (窗棂) frame layouts for content sections. Red seal stamps as bullet points. Symmetric, balanced compositions honoring traditional design principles.
Illustration Style: Traditional Chinese painting (国画) inspired illustrations — ink wash landscapes, detailed line drawings of cultural artifacts, architectural elements in traditional style. Gold foil accents. Embroidery-inspired pattern borders. Cultural motifs specific to the region.
Theme Integration: Heritage-style illustrations of "{{THEME}}" — traditional paintings of the location, cultural artifacts rendered in classical style, historical elements with traditional artistic treatment.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'paper_craft',
        label: 'Paper Craft',
        labelZh: '纸艺手工',
        description: 'Cut paper, origami, and collage aesthetic',
        descriptionZh: '剪纸、折纸、拼贴美学',
        notebookLMStyle: 'paper_craft',
        prompt: `Global Visual Style — Paper Craft
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.paper_craft}
Typography: Clean sans-serif like Source Han Sans (思源黑体) body text on white panels. Cut-out letter style ONLY for large main headings (as if cut from magazines or colored paper). Handwritten labels on torn paper strips. Washi tape labels for section dividers.
Layout: Scrapbook-style compositions with layered paper elements. Torn-edge borders. Paper clip and tape attachments holding content boxes. Folded paper tab dividers. Envelope/pocket elements for activities. 3D paper shadow effects showing depth.
Illustration Style: Paper craft aesthetic — cut paper silhouettes, origami figures, paper collage compositions. Layered paper with visible depth and shadows. Tissue paper transparency effects. Construction paper landscapes. Paper plate/cup craft-inspired characters.
Theme Integration: Paper craft representations of "{{THEME}}" — cut-paper dioramas of the location, origami animals and objects related to the topic, collage-style information displays.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'realistic',
        label: 'Realistic',
        labelZh: '实物写实',
        description: 'Photographic real-object illustration style',
        descriptionZh: '实物摄影写实风格插图',
        notebookLMStyle: 'classic',
        prompt: `Global Visual Style — Realistic / Photographic
Color Palette: ${HANDBOOK_STYLE_COLOR_PALETTES.realistic}
Typography: Clean modern sans-serif like Source Han Sans (思源黑体), Montserrat, or Inter for all text. Strong heading hierarchy. Captions in slightly smaller italic for photo descriptions. Professional magazine-quality typesetting.
Layout: Editorial magazine-style layouts. Full-width and half-width photo placements. Photo-caption pairs. Info cards with rounded corners overlaid on images. Clean grid system with generous whitespace. Photo-strip sections for step-by-step activities.
Illustration Style: HIGH-FIDELITY REALISTIC PHOTOGRAPHY and 3D-rendered objects. Real photographs of locations, animals, plants, artifacts, and cultural items. Studio-quality product shots for activity materials and tools. Photorealistic close-ups of textures, specimens, and details. Real maps and satellite imagery. NO cartoons, NO vector illustrations, NO hand-drawn elements — everything must look like a real photograph or photorealistic 3D render.
Theme Integration: Real photographs and photorealistic images of "{{THEME}}" — actual locations, real specimens, genuine cultural artifacts, authentic materials. Each page features documentary-style photography that educates through visual authenticity.
UNIVERSAL RULES (apply to ALL pages regardless of style):
1. BRAND COLOR ACCENTS ONLY: Do NOT use brand colors (Navy #1A2B58, Fuchsia #E91E63, Gold #FFC107) as large fills or body backgrounds. Reserve them exclusively for small decorative details: thin border lines, corner ornaments, bullet dot accents, divider rules, icon outlines, and badge trims.
2. PHYSICAL OBJECT IMAGES - REALISTIC + FRAMED: Any image depicting a real physical object (materials, tools, food, plants, animals, specimens, artifacts, activity supplies) MUST use a photorealistic/high-fidelity photograph style - never cartoon or flat vector. Each such image MUST be placed inside a clearly defined square photo frame (thin solid border or subtle drop-shadow), functioning as a swappable photo placeholder.
3. TEXT AREAS - SOLID OPAQUE BACKGROUNDS: Every text region (body copy, captions, labels, callout boxes, instruction blocks) MUST sit on a solid-color opaque panel (white #FFFFFF, light grey #F8F9FA, or a pale brand-color tint). No text should appear directly over a photograph, illustration, or textured background without a solid color shield underneath.
CRITICAL RULE: Except for the Cover and Back Cover (which should be fully colored), all other content pages MUST have a pure white (#FFFFFF) background to save printer ink. Colors should be restricted to borders, headers, and illustrations.`,
    },
    {
        id: 'custom',
        label: 'Custom',
        labelZh: '自定义',
        description: 'Keep the AI-generated style prompt',
        descriptionZh: '保留 AI 生成的风格提示词',
        notebookLMStyle: 'auto_select',
        prompt: '', // Will use the existing handbookStylePrompt
    },
];

/** Replace {{THEME}} placeholder in a style prompt */
export function resolveStylePrompt(preset: HandbookStylePreset, theme: string): string {
    return preset.prompt.replace(/\{\{THEME\}\}/g, theme);
}

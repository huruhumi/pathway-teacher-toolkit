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
    "Sky Pirates (Wind and weather)",
];

export const PATHWAY_BRAND_STYLE_BLOCK = `
[Nature Compass / 自然指针 Brand Identity (MANDATORY)]
The generated 'handbookStylePrompt' MUST incorporate these brand elements:
- Primary: Deep Navy Blue (#1A2B58) for headings and borders
- Accent 1: Vibrant Fuchsia Pink (#E91E63) for CTA boxes and subtitles
- Accent 2: Warm Golden Yellow (#FFC107) for icons and highlights
- Accent 3: Sky Blue (#87CEEB) for soft background tints
- Style: Modern flat vector illustrations, geometric shapes (hexagons and chevrons)
- Background: White (#FFFFFF) or near-white (#F8F9FA)
- Typography: Geometric sans-serif (Montserrat, Open Sans)
- Layout: Rounded-corner bordered activity zones, high negative space
- Brand name: "Nature Compass" (English) / "自然指针" (Chinese). Do NOT use "Pathway Academy" anywhere.
- Do NOT include website URLs or fabricated links.

[WHITE BACKGROUND FOR TEXT - ABSOLUTE RULE]
CRITICAL: Every area containing readable body text (facts, instructions, questions, tables, fill-in lines) MUST have pure WHITE (#FFFFFF) background for print readability.
- Borders and decorative frames around text zones can use brand colors.
- Section headers can use colored banners.
- Cover and Back Cover are the only exceptions and may use full-color backgrounds.
- For callouts ("Did You Know?", "Fun Fact"), border/header can be colored, but body text area must remain white.
- Drawing/data-table/writing workspaces must remain white.
- Never place readable body text on colored, gradient, or patterned backgrounds.
`;

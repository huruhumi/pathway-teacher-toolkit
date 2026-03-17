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
[Nature Compass / 鑷劧鎸囬拡 Brand Identity (MANDATORY)]
The generated 'handbookStylePrompt' MUST incorporate these brand elements:
- Primary: Deep Navy Blue (#1A2B58) for headings & borders
- Accent 1: Vibrant Fuchsia Pink (#E91E63) for CTA boxes & subtitles
- Accent 2: Warm Golden Yellow (#FFC107) for icons & highlights
- Accent 3: Sky Blue (#87CEEB) for soft background tints
- Style: Modern flat vector illustrations, geometric shapes (hexagons & chevrons)
- Background: White (#FFFFFF) or near-white (#F8F9FA)
- Typography: Geometric sans-serif (Montserrat, Open Sans)
- Layout: Rounded-corner bordered activity zones, high negative space
- Brand name: "Nature Compass" (English) / "鑷劧鎸囬拡" (Chinese). Do NOT use "Pathway Academy" anywhere.
- Do NOT include any website URLs or fabricated links.

[WHITE BACKGROUND FOR TEXT 鈥?ABSOLUTE RULE]
CRITICAL: Every area that contains readable text (paragraphs, facts, instructions, questions, fill-in-blanks, observation tables, etc.) MUST have a pure WHITE (#FFFFFF) background. This ensures maximum readability when printed.
- Borders, frames, and decorative edges around text zones CAN use brand colors (navy, pink, yellow, sky blue).
- Page headers / section titles CAN have colored banners or ribbons.
- Cover and Back Cover pages are the ONLY exceptions 鈥?they use full-color backgrounds.
- "Did You Know?" boxes, "Fun Fact" callouts, and sidebar panels: the BORDER and HEADER BAR can be colored, but the TEXT BODY AREA inside MUST remain white.
- Activity workspace zones (drawing boxes, data tables, writing lines): background MUST be white.
- NEVER place readable body text on colored, gradient, or patterned backgrounds. This severely harms readability.
`;

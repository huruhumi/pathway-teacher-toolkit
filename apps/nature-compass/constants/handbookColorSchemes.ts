/**
 * Shared color scheme tokens used by handbook global style prompts.
 * Keep palette narratives centralized so style prompts stay concise.
 */

export const HANDBOOK_BRAND_COLORS = {
    navy: '#1A2B58',
    fuchsia: '#E91E63',
    gold: '#FFC107',
    skyBlue: '#87CEEB',
    emerald: '#059669',
    white: '#FFFFFF',
    nearWhite: '#F8F9FA',
} as const;

const C = HANDBOOK_BRAND_COLORS;

export const HANDBOOK_STYLE_COLOR_PALETTES: Record<string, string> = {
    classic: `Primary Navy Blue (${C.navy}) for headings, titles, and borders. Fuchsia Pink (${C.fuchsia}) for activity call-out boxes and key highlights. Golden Yellow (${C.gold}) for stars, badges, and icon accents. Sky Blue (${C.skyBlue}) for soft panel backgrounds and divider lines. Nature Compass Emerald Green (${C.emerald}) for nature-themed icons, outdoor exploration badges, and ecological elements. White (${C.white}) page backgrounds for content pages.`,
    whiteboard: `Charcoal hand-drawn lines on white background. Accent highlights in Fuchsia Pink (${C.fuchsia}) dry-erase marker style. Navy Blue (${C.navy}) for section titles drawn in thick marker strokes. Golden Yellow (${C.gold}) for circled key terms and drawn star highlights. Sky Blue (${C.skyBlue}) for light shading and underlines. Emerald Green (${C.emerald}) for nature doodles, leaf sketches, and eco-themed whiteboard elements.`,
    kawaii: `Soft pastel versions of Nature Compass brand — light pink (softened ${C.fuchsia}), baby blue (${C.skyBlue}), sunny yellow (${C.gold}), mint green (softened ${C.emerald}), and lavender accents. Navy Blue (${C.navy}) only for main titles.`,
    anime: `Bold and vibrant. Deep Navy Blue (${C.navy}) for dramatic headers and panel borders. Hot Fuchsia Pink (${C.fuchsia}) for action highlights and speech bubbles. Bright Golden Yellow (${C.gold}) for energy effects and emphasis markers. Sky Blue (${C.skyBlue}) for sky and background tones. Emerald Green (${C.emerald}) for nature/forest scenes and power-up effects. High contrast with white.`,
    watercolor: `Watercolor washes of Nature Compass brand colors — watery Navy Blue (${C.navy}) for titles with paint-drip edges, soft pink wash (${C.fuchsia}) for highlight boxes, pale golden glow (${C.gold}) for sun/warmth elements, watercolor Sky Blue (${C.skyBlue}) for sky backgrounds, and lush Emerald Green (${C.emerald}) washes for foliage and nature elements. Natural paper texture feel. Colors blend and bleed softly at edges.`,
    retro_print: `Limited ink palette — Navy Blue (${C.navy}) as primary ink, Fuchsia Pink (${C.fuchsia}) as spot color overlay, Golden Yellow (${C.gold}) as accent third color, Emerald Green (${C.emerald}) for botanical/nature spot prints. Halftone dot patterns for shading. Misregistration-style color offsets for artistic effect.`,
    heritage: `Rich traditional palette — Deep Navy Blue (${C.navy}) as primary (echoing traditional indigo dye). Chinese Red replacing Fuchsia (${C.fuchsia}) for auspicious accents. Antique Gold (${C.gold}) for imperial/ornamental borders. Jade Green (${C.emerald}) and Sky Blue (${C.skyBlue}) for nature and landscape elements.`,
    paper_craft: `Textured paper colors — construction paper Navy Blue (${C.navy}), tissue paper Pink (${C.fuchsia}), crepe paper Yellow (${C.gold}), cardstock Sky Blue (${C.skyBlue}), green construction paper (${C.emerald}) for leaves and nature cutouts. Visible paper grain textures. Multi-layered paper depth with visible shadows.`,
    realistic: `Clean, modern design system — Deep Navy Blue (${C.navy}) for headings, section headers, and card borders. Fuchsia Pink (${C.fuchsia}) for call-to-action boxes and key highlight labels. Golden Yellow (${C.gold}) for star ratings, award badges, and warm accent details. Sky Blue (${C.skyBlue}) for info panels and soft background tints. Emerald Green (${C.emerald}) for nature callouts, eco badges, and field-guide markers. White (${C.white}) page backgrounds for content pages. Muted earth tones complement the realistic imagery.`,
};

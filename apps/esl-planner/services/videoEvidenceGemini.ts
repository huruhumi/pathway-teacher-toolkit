type DirectGeminiVideoEvidenceResult = {
    factSheet: string;
    evidenceUrls: string[];
    error?: string;
};

type GeminiGroundingChunk = {
    web?: {
        uri?: string;
    };
};

type GeminiResponseShape = {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
        groundingMetadata?: {
            groundingChunks?: GeminiGroundingChunk[];
        };
    }>;
    error?: {
        message?: string;
    };
};

type RawUrlEvidenceItem = {
    inputUrl?: string;
    status?: string;
    matchedTitle?: string;
    matchedVideoUrl?: string;
    confidence?: string;
    reason?: string;
    lines?: string[];
    sourceUrls?: string[];
};

type RawUrlEvidencePayload = {
    items?: RawUrlEvidenceItem[];
};

type NormalizedUrlEvidenceItem = {
    inputUrl: string;
    status: 'ready' | 'unavailable';
    matchedTitle?: string;
    matchedVideoUrl?: string;
    confidence?: 'high' | 'medium' | 'low';
    reason?: string;
    lines: string[];
    sourceUrls: string[];
};

const GEMINI_MODEL = 'gemini-2.5-flash';

const toUnique = <T>(arr: T[]) => [...new Set(arr)];

const cleanLine = (line: string): string => line.replace(/\s+/g, ' ').trim();

const extractYouTubeVideoId = (rawUrl: string): string | null => {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
            return url.pathname.replace('/', '').trim() || null;
        }
        if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            const id = url.searchParams.get('v');
            return id?.trim() || null;
        }
    } catch {
        return null;
    }
    return null;
};

const isSameYouTubeVideo = (a: string, b: string): boolean => {
    const aid = extractYouTubeVideoId(a);
    const bid = extractYouTubeVideoId(b);
    return Boolean(aid && bid && aid === bid);
};

const isValidUrl = (raw: string): boolean => {
    try {
        const u = new URL(raw);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const toJsonObject = (text: string): RawUrlEvidencePayload | null => {
    const trimmed = (text || '').trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as RawUrlEvidencePayload;
    } catch {
        // Try extracting first JSON object block
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const maybe = trimmed.slice(start, end + 1);
            try {
                return JSON.parse(maybe) as RawUrlEvidencePayload;
            } catch {
                return null;
            }
        }
        return null;
    }
};

const toConfidence = (value?: string): 'high' | 'medium' | 'low' => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'high' || normalized === 'medium') return normalized;
    return 'low';
};

const sanitizeItem = (
    inputUrl: string,
    raw: RawUrlEvidenceItem | undefined,
): NormalizedUrlEvidenceItem => {
    if (!raw) {
        return {
            inputUrl,
            status: 'unavailable',
            reason: 'No item returned for this URL.',
            lines: [],
            sourceUrls: [],
        };
    }

    const matchedVideoUrl = cleanLine(raw.matchedVideoUrl || '');
    const matchedTitle = cleanLine(raw.matchedTitle || '');
    const confidence = toConfidence(raw.confidence);
    const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = rawLines.map((line) => cleanLine(String(line))).filter(Boolean).slice(0, 8);
    const rawSources = Array.isArray(raw.sourceUrls) ? raw.sourceUrls : [];
    const sourceUrls = toUnique(
        rawSources
            .map((url) => cleanLine(String(url)))
            .filter((url) => isValidUrl(url))
            .filter((url) => isSameYouTubeVideo(url, inputUrl)),
    );

    const isReadyRequested = (raw.status || '').toLowerCase() === 'ready';
    const matchedById = matchedVideoUrl ? isSameYouTubeVideo(matchedVideoUrl, inputUrl) : false;
    const finalReady = isReadyRequested && (matchedById || !matchedVideoUrl) && lines.length > 0;

    if (!finalReady) {
        const reason = matchedVideoUrl && !matchedById
            ? `matched_video_id_mismatch: ${matchedVideoUrl}`
            : cleanLine(raw.reason || 'No strict transcript evidence for this URL.');
        return {
            inputUrl,
            status: 'unavailable',
            reason,
            lines: [],
            sourceUrls: [],
        };
    }

    const finalMatchedUrl = matchedById ? matchedVideoUrl : inputUrl;
    return {
        inputUrl,
        status: 'ready',
        matchedTitle: matchedTitle || 'Untitled',
        matchedVideoUrl: finalMatchedUrl,
        confidence,
        lines,
        sourceUrls: toUnique([inputUrl, finalMatchedUrl, ...sourceUrls]),
    };
};

const buildFactSheet = (items: NormalizedUrlEvidenceItem[]): string => {
    const lines: string[] = [];
    lines.push('DIRECT_GEMINI_URL_MODE=TRUE');
    lines.push('Source policy: keep only evidence mapped to exact input YouTube video IDs.');
    lines.push('');
    lines.push('Input URL verification:');
    items.forEach((item) => {
        if (item.status === 'ready') {
            lines.push(`- READY | input=${item.inputUrl} | source=${item.matchedVideoUrl || item.inputUrl} | confidence=${item.confidence || 'low'}`);
        } else {
            lines.push(`- VIDEO_SOURCE_UNAVAILABLE | input=${item.inputUrl} | reason=${item.reason || 'unknown'}`);
        }
    });

    const readyItems = items.filter((item) => item.status === 'ready');
    if (readyItems.length === 0) {
        lines.push('');
        lines.push('NO_USABLE_SOURCE');
        return lines.join('\n');
    }

    lines.push('');
    lines.push('Transcript/key evidence:');
    readyItems.forEach((item, idx) => {
        lines.push('');
        lines.push(`[URL ${idx + 1}] ${item.inputUrl}`);
        if (item.matchedTitle) lines.push(`title: ${item.matchedTitle}`);
        lines.push(`source: ${item.matchedVideoUrl || item.inputUrl}`);
        item.lines.forEach((line) => lines.push(`- ${line}`));
    });

    lines.push('');
    lines.push('Teachable summary:');
    readyItems.forEach((item) => {
        lines.push(`- ${item.inputUrl}: Use extracted lines only; avoid adding uncited details.`);
    });
    return lines.join('\n');
};

export async function extractVideoEvidenceWithDirectGemini(
    videoUrls: string[],
    lessonTitle: string,
    level: string,
): Promise<DirectGeminiVideoEvidenceResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
        return {
            factSheet: '',
            evidenceUrls: [],
            error: 'Missing VITE_GEMINI_API_KEY.',
        };
    }

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
        return {
            factSheet: '',
            evidenceUrls: [],
            error: 'No video URLs provided.',
        };
    }

    const prompt = `You are validating transcript evidence for exact YouTube video URLs for ESL teaching.

Lesson: "${lessonTitle}" | Level: ${level}
Input URLs:
${videoUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

Return JSON only:
{
  "items": [
    {
      "inputUrl": "<exact input URL>",
      "status": "ready" | "unavailable",
      "matchedTitle": "<title if ready>",
      "matchedVideoUrl": "<must be same YouTube video ID as inputUrl when ready>",
      "confidence": "high" | "medium" | "low",
      "reason": "<required when unavailable>",
      "lines": ["<short line>", "<short line>"],
      "sourceUrls": ["<urls used for lines>"]
    }
  ]
}

Hard rules:
1) Evaluate each input URL independently.
2) status="ready" only when matchedVideoUrl has the same YouTube video ID as inputUrl.
3) If exact ID cannot be verified, set unavailable (do NOT guess).
4) lines must be short, transcript/lyric/key points only, max 8 lines per URL.
5) No markdown, no tables, no extra fields.`;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                tools: [{ google_search: {} }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                },
            }),
        });

        const data: GeminiResponseShape = await response.json();
        if (!response.ok) {
            return {
                factSheet: '',
                evidenceUrls: [],
                error: data?.error?.message || `Gemini request failed (${response.status})`,
            };
        }

        const text = (data?.candidates?.[0]?.content?.parts || [])
            .map((part) => part.text || '')
            .join('')
            .trim();
        const parsed = toJsonObject(text);
        const byInput = new Map<string, RawUrlEvidenceItem>();
        (parsed?.items || []).forEach((item) => {
            const key = cleanLine(item?.inputUrl || '');
            if (key) byInput.set(key, item);
        });

        const normalized = videoUrls.map((url) => sanitizeItem(url, byInput.get(url)));
        const factSheet = buildFactSheet(normalized);

        const evidenceUrls = toUnique(
            normalized
                .filter((item) => item.status === 'ready')
                .flatMap((item) => [item.inputUrl, item.matchedVideoUrl || '', ...(item.sourceUrls || [])])
                .filter(Boolean),
        );

        // Keep grounding URLs only as diagnostics; do not expose unrelated links in evidence.
        const _groundingUrls = toUnique(
            ((data?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as GeminiGroundingChunk[])
                .map((chunk) => chunk.web?.uri || '')
                .filter(Boolean),
        );
        void _groundingUrls;

        return {
            factSheet,
            evidenceUrls,
        };
    } catch (error: any) {
        return {
            factSheet: '',
            evidenceUrls: [],
            error: error?.message || 'Direct Gemini URL extraction failed.',
        };
    }
}

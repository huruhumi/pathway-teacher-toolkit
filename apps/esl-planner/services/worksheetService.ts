// Worksheet generation, games, reading tasks, web resources, trivia, reading passages

import { Type, GenerateContentResponse } from "@google/genai";
import { CEFRLevel, Game, Worksheet, ReadingPlanDay, ReadingTask, WebResource } from '../types';
import { createAIClient } from '@pathway/ai';
import { retryApiCall, responseSchemaFragments } from './gemini/shared';

const DEFAULT_RESOURCE_URL = 'https://learnenglishkids.britishcouncil.org/';
const ADVICE_STYLE_TRIVIA_REGEX = /(tip|tips|how to|strategy|practice|remember|study|homework|worksheet|you should|students should|try this|in class|at home|learn faster|improve|method)/i;
const ADVICE_STYLE_TRIVIA_CN_REGEX = /(学习方法|记忆方法|技巧|建议|练习|复习|作业|课堂上|在家|你应该|同学们应该|提升)/;

interface RoutineTheme {
    focus: string;
    focusCn: string;
    activity: string;
    activityCn: string;
    taskSeeds: Array<{ text: string; text_cn: string }>;
    triviaEn: string;
    triviaCn: string;
}

interface GenerateReadingTaskOptions {
    dayNumber?: number;
    dayFocus?: string;
    dayActivity?: string;
    existingTasks?: string[];
    ageGroup?: string;
}

interface GenerateTriviaOptions {
    dayNumber?: number;
    taskTexts?: string[];
}

interface LearnerProfile {
    band: 'young' | 'middle' | 'older';
    guidance: string;
}

const ROUTINE_THEMES: RoutineTheme[] = [
    {
        focus: 'Vocabulary Recall',
        focusCn: '词汇复习',
        activity: 'Review and use target words from today\'s lesson through hands-on activities.',
        activityCn: '通过动手活动复习并使用本课目标词汇。',
        taskSeeds: [
            { text: 'Draw 5 lesson words as pictures. Label each one in English.', text_cn: '把5个本课词画成图片，每张标上英文。' },
            { text: 'Stick Post-it notes on real things at home that match lesson words. Say each word aloud.', text_cn: '在家里找到和本课词汇匹配的实物，贴上便签并读出英文。' },
            { text: 'Make word cards with a family member: write the word on one side, draw the meaning on the other.', text_cn: '和家人一起做词卡：一面写词，另一面画意思。' },
        ],
        triviaEn: 'Many common English words come from older languages such as Latin, Greek, and French.',
        triviaCn: '许多常见英语词汇都来源于更早的语言，如拉丁语、希腊语和法语。',
    },
    {
        focus: 'Phonics and Pronunciation',
        focusCn: '自然拼读与发音',
        activity: 'Practice sound-letter links and pronunciation from lesson words with hands-on activities.',
        activityCn: '通过动手活动练习字母与发音对应关系，并清晰读出本课词汇。',
        taskSeeds: [
            { text: 'Use playdough or your finger to shape 3 letters from today\'s words. Say each sound while shaping.', text_cn: '用橡皮泥或手指捏/写3个今天单词里的字母，边做边读发音。' },
            { text: 'Clap out the syllables of 5 lesson words with a parent.', text_cn: '和爸妈一起拍手念5个本课词的音节。' },
            { text: 'Go on a letter hunt at home: find objects that start with the same letters as lesson words.', text_cn: '在家里找以本课单词首字母开头的物品。' },
        ],
        triviaEn: 'English has 5 vowel letters but around 20 vowel sounds in everyday speech.',
        triviaCn: '英语只有5个元音字母，但在日常语音中大约有20种元音音值。',
    },
    {
        focus: 'Sentence Patterns and Grammar',
        focusCn: '句型与语法',
        activity: 'Practice the core sentence pattern through daily-life and hands-on activities.',
        activityCn: '通过生活场景和动手活动练习核心句型。',
        taskSeeds: [
            { text: 'Look around your home and say 3 sentences using today\'s sentence pattern with real objects.', text_cn: '看看家里，用今天的句型说出3个和实物相关的句子。' },
            { text: 'Draw a 4-panel comic strip using today\'s sentence pattern.', text_cn: '画一个4格漫画，使用今天的句型。' },
            { text: 'Ask a parent 3 questions using today\'s lesson pattern and note their answers.', text_cn: '用今天的句型问爸妈3个问题，记下他们的回答。' },
        ],
        triviaEn: 'In English questions, word order often changes, such as "You are..." to "Are you...?"',
        triviaCn: '在英语疑问句中，语序常会变化，例如 "You are..." 会变成 "Are you...?"。',
    },
    {
        focus: 'Listening and Comprehension',
        focusCn: '听力与理解',
        activity: 'Listen for key words and meaning cues through parent-child activities.',
        activityCn: '通过亲子活动听辨关键词和意义线索。',
        taskSeeds: [
            { text: 'A parent says a lesson word: point to or run to the matching object at home! Do 5 rounds.', text_cn: '家长说一个本课单词——指向或跑到家里对应的物品！玩5轮。' },
            { text: 'Close your eyes. A parent describes something using lesson words. Guess what it is!', text_cn: '闭上眼睛，家长用本课词汇描述一样东西，猜猜是什么！' },
            { text: 'Listen to a parent say 5 lesson words. Draw each one quickly (stick figures OK!).', text_cn: '听家长说5个本课词汇，快速画出来（简笔画就行！）。' },
        ],
        triviaEn: 'In spoken English, nearby words often connect, so the sound can be smoother than the written form.',
        triviaCn: '在英语口语中，相邻词常会连读，因此听起来会比书写形式更连贯。',
    },
    {
        focus: 'Speaking Interaction',
        focusCn: '口语互动',
        activity: 'Use lesson language in real-life conversations and role-play.',
        activityCn: '在生活对话和角色扮演中使用本课语言。',
        taskSeeds: [
            { text: 'Interview a family member using today\'s lesson pattern. Record a short video (under 30 seconds).', text_cn: '用今天的句型采访一位家人，录一段30秒以内的小视频。' },
            { text: 'Use a stuffed animal or puppet as your "guest": describe things using lesson words.', text_cn: '用毛绒玩具当"客人"——用本课词汇介绍东西。' },
            { text: 'Give a family member a short "tour" in English: name 5 things using lesson words.', text_cn: '用英语给家人做一次简短"导览"：用本课词汇介绍5样东西。' },
        ],
        triviaEn: 'In many English-speaking places, "How are you?" is often a greeting formula, not a medical question.',
        triviaCn: '在许多英语语境中，"How are you?" 常是问候套语，不一定是询问健康状况。',
    },
    {
        focus: 'Reading and Mini Writing',
        focusCn: '阅读与小写作',
        activity: 'Read and write through craft and creative activities.',
        activityCn: '通过手工和创意活动进行阅读与书写练习。',
        taskSeeds: [
            { text: 'Fold a paper in half: draw something about today\'s topic on one side, label 4 things in English on the other.', text_cn: '把纸对折——一面画与今天主题相关的内容，另一面用英文标注4样东西。' },
            { text: 'Write a short "postcard" to a friend using 3 lesson words. Draw a picture on the front.', text_cn: '用3个本课词汇给朋友写一张"明信片"，正面画图。' },
            { text: 'Find one English word on any real object at home (toy package, shampoo bottle) and read it aloud.', text_cn: '在家里任何实物上（玩具包装、洗发水瓶）找到1个英文词并读出来。' },
        ],
        triviaEn: 'Children\'s reading books often repeat high-frequency words to build reading fluency.',
        triviaCn: '儿童读物常会重复高频词，以帮助建立阅读流畅度。',
    },
    {
        focus: 'Integrated Review and Performance',
        focusCn: '综合复习与展示',
        activity: 'Review this week\'s learning through a creative mini-project.',
        activityCn: '通过创意小项目复习本周学习内容。',
        taskSeeds: [
            { text: 'Make a mini-book: fold paper in half, draw one word per page, present it to your family.', text_cn: '做一本小书：纸对折，每页画一个词，讲给家人听。' },
            { text: 'Tell a parent 3 things you learned this week in English. They give you a star for each!', text_cn: '用英文告诉爸妈你这周学到的3样东西——每说对一个得一颗星！' },
            { text: 'Pick your favorite word this week and make a poster: decorate it with colors and stickers!', text_cn: '选一个本周最喜欢的词做一张海报——用彩色笔和贴纸装饰！' },
        ],
        triviaEn: 'Short performances help learners connect language chunks into real communication.',
        triviaCn: '短时展示能帮助学习者把语言片段整合成真实交流。',
    },
];

const normalizeTextKey = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const inferLearnerProfile = (level: CEFRLevel, ageGroup?: string): LearnerProfile => {
    const normalizedLevel = String(level || '').toLowerCase();
    const normalizedAge = String(ageGroup || '').toLowerCase();

    if (/(4-6|k|kindergarten|pre-k)/i.test(normalizedAge) || /(pre-a1|a1)/i.test(normalizedLevel)) {
        return {
            band: 'young',
            guidance: 'Use simple hands-on activities (drawing, playdough, stickers), very short language chunks, and parent-assisted tasks.',
        };
    }

    if (/(14-16|16\+|teen)/i.test(normalizedAge) || /(b1|b2|c1|c2)/i.test(normalizedLevel)) {
        return {
            band: 'older',
            guidance: 'Use creative projects, interviews, and real-life tasks with richer sentence output.',
        };
    }

    return {
        band: 'middle',
        guidance: 'Use a mix of craft activities and daily-life tasks with moderate language load.',
    };
};

const toHandsOnTask = (
    task: { text: string; text_cn: string },
    theme: RoutineTheme,
): { text: string; text_cn: string } => {
    const en = String(task.text || '').trim();
    const cn = String(task.text_cn || '').trim();
    if (!en) {
        return {
            text: `Do a short ${theme.focus.toLowerCase()} activity using lesson words.`,
            text_cn: `完成一个"${theme.focusCn}"小活动，使用本课词汇。`,
        };
    }
    return {
        text: en,
        text_cn: cn || en,
    };
};

const getRoutineTheme = (dayNumber?: number): RoutineTheme => {
    const idx = Math.max(1, Number(dayNumber) || 1) - 1;
    return ROUTINE_THEMES[idx % ROUTINE_THEMES.length];
};

const buildTaskCandidates = (theme: RoutineTheme, topic: string): Array<{ text: string; text_cn: string }> =>
    theme.taskSeeds.map((seed) => ({
        text: seed.text.replace('today\'s topic', `"${topic}" topic`),
        text_cn: seed.text_cn,
    }));

const pickFallbackTask = (
    theme: RoutineTheme,
    topic: string,
    existingSet: Set<string>,
): { text: string; text_cn: string } => {
    const candidates = buildTaskCandidates(theme, topic);
    const nonDuplicate = candidates.find((item) => !existingSet.has(normalizeTextKey(item.text)));
    if (nonDuplicate) return nonDuplicate;
    return {
        text: `Do one short ${theme.focus.toLowerCase()} task using language from "${topic}".`,
        text_cn: `完成一个与“${theme.focusCn}”相关的简短任务，并使用“${topic}”的课堂语言。`,
    };
};

const sanitizeTriviaFact = (
    input: { en?: string; cn?: string } | null | undefined,
    theme: RoutineTheme,
): { en: string; cn: string } => {
    const en = String(input?.en || '').trim();
    const cn = String(input?.cn || '').trim();
    const invalid =
        !en ||
        ADVICE_STYLE_TRIVIA_REGEX.test(en) ||
        ADVICE_STYLE_TRIVIA_CN_REGEX.test(cn);

    if (invalid) {
        return { en: theme.triviaEn, cn: theme.triviaCn };
    }
    return { en, cn: cn || theme.triviaCn };
};

export const generateWorksheet = async (level: CEFRLevel, topic: string, configs: any[]): Promise<Worksheet> => {
    const ai = createAIClient();

    let instructionsText = `Generate a worksheet for Level: ${level}, Topic: ${topic} based on these configs: ${JSON.stringify(configs)}. `;

    if (configs.some(c => c.type === 'Cloze Test')) {
        instructionsText += `CRITICAL for "Cloze Test" type: You MUST generate a reading passage in the 'passage' field with numbered blanks like (1), (2), (3), etc. The corresponding items in that section MUST have 'question' text like "Blank (1)", "Blank (2)", etc., and MUST use 'multiple-choice' layout with exactly 4 options each. Set the 'layout' field of the Cloze Test section to 'multiple-choice'. `;
    }

    if (configs.some(c => c.type === 'Error Correction')) {
        instructionsText += `CRITICAL for "Error Correction" type: You MUST generate a short reading passage in the 'passage' field that contains a specific number of errors (equal to the 'count' provided). Each section item should identify the wrong word/phrase in 'question' and the correct version in 'answer'. Set the 'layout' field of the Error Correction section to 'error-correction'. `;
    }

    if (configs.some(c => c.type === 'Picture Description')) {
        instructionsText += `CRITICAL for "Picture Description" type: This is a writing task. Set the 'layout' to 'essay'. Provide a descriptive writing prompt in 'question' and suggest a target word count (e.g. 50 or 100) in the 'wordCount' field of the item. `;
    }

    if (configs.some(c => c.type === 'Tracing / Handwriting')) {
        instructionsText += `CRITICAL for "Tracing / Handwriting" type: Generate words, short phrases, or simple sentences that students will practice writing by hand. Each item's 'question' field should contain ONLY the text to be traced (a single word or short phrase). The 'answer' field should be the same text. Set the 'layout' field to 'tracing'. Items should be level-appropriate and related to the topic. Generate simple, common vocabulary for lower levels and short sentences for higher levels. `;
    }

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: instructionsText,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    sections: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                passageTitle: { type: Type.STRING },
                                passage: { type: Type.STRING },
                                layout: { type: Type.STRING, enum: ["standard", "matching", "multiple-choice", "essay", "error-correction", "tracing"] },
                                items: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            question: { type: Type.STRING },
                                            answer: { type: Type.STRING },
                                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                            visualPrompt: { type: Type.STRING },
                                            wordCount: { type: Type.NUMBER, description: "Suggested word count for writing tasks" }
                                        },
                                        required: ["question", "answer"]
                                    }
                                }
                            },
                            required: ["title", "items"]
                        }
                    }
                },
                required: ["title", "instructions", "sections"]
            }
        }
    }));

    return JSON.parse(response.text || "{}");
};

export const generateSingleGame = async (level: CEFRLevel, topic: string, skill: string, type: string, context: string): Promise<Game> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a single educational game for Level: ${level}, Topic: ${topic}, Skill: ${skill}, Type: ${type}. Context: ${context}. Return the result in the specified JSON format.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    interactionType: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    materials: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "type", "interactionType", "instructions", "materials"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateReadingTask = async (
    level: CEFRLevel,
    topic: string,
    focus: string,
    options: GenerateReadingTaskOptions = {},
): Promise<ReadingTask> => {
    const ai = createAIClient();
    const theme = getRoutineTheme(options.dayNumber);
    const learnerProfile = inferLearnerProfile(level, options.ageGroup);
    const existingTasks = (options.existingTasks || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    const existingSet = new Set(existingTasks.map(normalizeTextKey));
    const dayFocus = String(options.dayFocus || focus || theme.focus).trim();
    const dayActivity = String(options.dayActivity || theme.activity).trim();

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create ONE additional Step-by-Step task for an ESL 7-day home review routine.

Level: ${level}
Lesson Topic: ${topic}
Day Focus: ${dayFocus}
Day Activity: ${dayActivity}
Routine Anchor: ${theme.focus}
Learner Profile: ${learnerProfile.band} (${learnerProfile.guidance})

Existing tasks for this day (MUST avoid duplication):
${existingTasks.length ? existingTasks.map((task, index) => `${index + 1}. ${task}`).join('\n') : '(none)'}

Rules:
1) Output exactly one NEW task, strongly related to "${topic}" and the day focus.
2) Task must be concrete, student-facing, and doable in 3-8 minutes.
3) Add modality diversity (speaking/listening/reading/writing/TPR/role-play), not the same pattern as existing tasks.
4) Task must be a practical hands-on or daily-life parent-child activity (drawing, crafts, labeling objects, parent interviews), completable in 3-5 minutes.
5) Keep setup easy (no printing required, 0-2 simple materials max).
6) No generic lines like "practice English words" or "review at home"; be specific.
7) Return JSON only with fields text, text_cn, isCompleted.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    text_cn: { type: Type.STRING },
                    isCompleted: { type: Type.BOOLEAN }
                },
                required: ["text", "text_cn"]
            }
        }
    }));
    const data = JSON.parse(response.text || "{}");
    const generatedText = String(data?.text || '').trim();
    const generatedTextCn = String(data?.text_cn || '').trim();
    const isDuplicate = existingSet.has(normalizeTextKey(generatedText));
    const tooGeneric = /(practice english|review at home|remember words|learn new words)/i.test(generatedText);

    if (!generatedText || isDuplicate || tooGeneric) {
        const fallback = pickFallbackTask(theme, topic, existingSet);
        const gameified = toHandsOnTask(fallback, theme);
        return {
            text: gameified.text,
            text_cn: gameified.text_cn,
            isCompleted: false,
        };
    }

    const gameified = toHandsOnTask(
        {
            text: generatedText,
            text_cn: generatedTextCn || pickFallbackTask(theme, topic, existingSet).text_cn,
        },
        theme,
    );

    return {
        text: gameified.text,
        text_cn: gameified.text_cn,
        isCompleted: false,
    };
};

export const generateWebResource = async (topic: string, focus: string): Promise<WebResource> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Suggest a high-quality educational web resource (YouTube, National Geographic, etc.) for Topic: ${topic}, Focus: ${focus}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    title_cn: { type: Type.STRING },
                    url: { type: Type.STRING },
                    description: { type: Type.STRING },
                    description_cn: { type: Type.STRING }
                },
                required: ["title", "title_cn", "url", "description", "description_cn"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateNewCompanionDay = async (
    level: CEFRLevel,
    topic: string,
    dayNum: number,
    options: { ageGroup?: string } = {},
): Promise<ReadingPlanDay> => {
    const ai = createAIClient();
    const theme = getRoutineTheme(dayNum);
    const learnerProfile = inferLearnerProfile(level, options.ageGroup);
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate Day ${dayNum} for an ESL home-review companion.

Level: ${level}
Topic: ${topic}
Fixed Day Routine Anchor: ${theme.focus} / ${theme.focusCn}
Target Activity: ${theme.activity}
Learner Profile: ${learnerProfile.band} (${learnerProfile.guidance})

Rules:
1) focus/focus_cn must follow the fixed routine anchor above.
2) Generate exactly 3 varied sub-tasks aligned to this day focus and topic.
3) Every sub-task must be a practical hands-on or daily-life parent-child activity (drawing, crafts, labeling objects, parent interviews), completable in 3-5 minutes.
4) Keep setup easy (no printing required, 0-2 simple materials max).
5) trivia must be ONE fun fact related to the day focus/topic. Do NOT output study tips, methods, or advice.
6) resources must include at least 1 real URL.
7) Return JSON only.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchemaFragments.readingCompanionDay
        }
    }));
    const data = JSON.parse(response.text || "{}");
    const existingSet = new Set<string>();
    const normalizedTasks = (Array.isArray(data?.tasks) ? data.tasks : [])
        .map((task: any) => ({
            text: String(task?.text || '').trim(),
            text_cn: String(task?.text_cn || '').trim(),
            isCompleted: false,
        }))
        .filter((task) => task.text)
        .filter((task) => {
            const key = normalizeTextKey(task.text);
            if (existingSet.has(key)) return false;
            existingSet.add(key);
            return true;
        })
        .slice(0, 3)
        .map((task) => ({
            ...toHandsOnTask(task, theme),
            isCompleted: false,
        }));

    const candidates = buildTaskCandidates(theme, topic);
    for (const candidate of candidates) {
        if (normalizedTasks.length >= 3) break;
        const key = normalizeTextKey(candidate.text);
        if (existingSet.has(key)) continue;
        existingSet.add(key);
        normalizedTasks.push({ ...toHandsOnTask(candidate, theme), isCompleted: false });
    }

    const resources = Array.isArray(data?.resources)
        ? data.resources.filter((resource: any) => String(resource?.url || '').trim())
        : [];
    const finalResources = resources.length > 0
        ? resources
        : [{
            title: `Day ${dayNum} practice resource`,
            title_cn: `第${dayNum}天练习资源`,
            url: DEFAULT_RESOURCE_URL,
            description: `Practice ${theme.focus.toLowerCase()} with this child-friendly resource.`,
            description_cn: `使用该儿童友好资源练习“${theme.focusCn}”。`,
        }];

    return {
        day: Number(data?.day) || dayNum,
        focus: theme.focus,
        focus_cn: theme.focusCn,
        activity: theme.activity,
        activity_cn: theme.activityCn,
        tasks: normalizedTasks.slice(0, 3),
        resources: finalResources,
        trivia: sanitizeTriviaFact(data?.trivia, theme),
    };
};

export const generateTrivia = async (
    topic: string,
    focus: string,
    options: GenerateTriviaOptions = {},
): Promise<{ en: string; cn: string }> => {
    const ai = createAIClient();
    const theme = getRoutineTheme(options.dayNumber);
    const finalFocus = String(focus || theme.focus).trim();
    const taskContext = options.taskTexts?.length
        ? `\nToday's specific tasks:\n${options.taskTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        : '';
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate ONE short fun fact for an ESL lesson companion.
Topic: ${topic}
Day focus: ${finalFocus}
${taskContext}

Strict rules:
1) The fun fact MUST directly relate to the specific vocabulary, objects, or activities mentioned in today's tasks — NOT the general day focus theme.
2) Connect to something concrete the child will encounter during the tasks (e.g. if tasks mention "clap", the fact could be about hands/muscles/sound).
3) Must be a fact-style line — NOT a learning tip, strategy, method, or encouragement.
4) Do NOT tell students what to do.
5) Return JSON only with "en" and "cn".`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    en: { type: Type.STRING },
                    cn: { type: Type.STRING }
                },
                required: ["en", "cn"]
            }
        }
    }));
    const data = JSON.parse(response.text || "{}");
    return sanitizeTriviaFact(data, theme);
};

export const generateReadingPassage = async (level: string, topic: string, vocab: string[]): Promise<{ title: string, text: string }> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a short reading passage (about 100-150 words) appropriate for ESL Level: ${level}, Topic: ${topic}. Try to incorporate some of this target vocabulary if relevant: ${vocab.join(", ")}. Return the result as a JSON object with 'title' and 'text' fields.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    text: { type: Type.STRING }
                },
                required: ["title", "text"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

/**
 * Translate a single task text between English and Chinese.
 * Auto-detects the input language by checking for CJK characters.
 */
export const translateTaskText = async (
    text: string,
): Promise<{ translated: string; targetField: 'text' | 'text_cn' }> => {
    if (!text.trim()) return { translated: '', targetField: 'text_cn' };

    const isChinese = /[\u4e00-\u9fff]/.test(text);
    const fromLang = isChinese ? 'Chinese' : 'English';
    const toLang = isChinese ? 'English' : 'Chinese';
    const targetField: 'text' | 'text_cn' = isChinese ? 'text' : 'text_cn';

    const ai = createAIClient();
    const response = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following ${fromLang} text to ${toLang}. Return ONLY the translated text, nothing else.\n\nText: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    translated: { type: Type.STRING, description: `The ${toLang} translation` },
                },
                required: ["translated"]
            }
        }
    }));
    const data = JSON.parse(response.text || "{}");
    return { translated: data.translated || '', targetField };
};

import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });

const lessonPlanSchema = {
    type: Type.OBJECT,
    properties: {
        missionBriefing: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, narrative: { type: Type.STRING } }, required: ["title", "narrative"] },
        basicInfo: { type: Type.OBJECT, properties: { theme: { type: Type.STRING }, activityType: { type: Type.STRING }, targetAudience: { type: Type.STRING }, location: { type: Type.STRING }, learningGoals: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["theme", "activityType", "targetAudience", "location", "learningGoals"] },
        vocabulary: { type: Type.OBJECT, properties: { keywords: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ["word", "definition"] } }, phrases: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["keywords", "phrases"] },
        roadmap: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { timeRange: { type: Type.STRING }, phase: { type: Type.STRING }, activity: { type: Type.STRING }, activityType: { type: Type.STRING }, location: { type: Type.STRING }, description: { type: Type.STRING }, learningObjective: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.STRING } }, backgroundInfo: { type: Type.ARRAY, items: { type: Type.STRING } }, teachingTips: { type: Type.ARRAY, items: { type: Type.STRING } }, activityInstructions: { type: Type.STRING } }, required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips", "activityInstructions"] } },
        supplies: { type: Type.OBJECT, properties: { permanent: { type: Type.ARRAY, items: { type: Type.STRING } }, consumables: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["permanent", "consumables"] },
        safetyProtocol: { type: Type.ARRAY, items: { type: Type.STRING } },
        visualReferences: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["label", "description", "type"] } },
        handbookStylePrompt: { type: Type.STRING },
        handbookStructurePlan: { type: Type.STRING },
        handbook: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pageNumber: { type: Type.NUMBER }, title: { type: Type.STRING }, section: { type: Type.STRING }, layoutDescription: { type: Type.STRING }, visualPrompt: { type: Type.STRING }, contentPrompt: { type: Type.STRING }, phaseIndex: { type: Type.NUMBER } }, required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt"] } },
        notebookLMPrompt: { type: Type.STRING },
        imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    // Intentionally omitting handbookStructurePlan from required array to test Gemini behavior
    required: ["missionBriefing", "basicInfo", "vocabulary", "roadmap", "supplies", "safetyProtocol", "visualReferences", "handbookStylePrompt", "handbook", "notebookLMPrompt", "imagePrompts"],
};

const systemInstruction = `
你是一位资深STEAM自然研学课程设计师（纯中文版，非ESL版本）。所有内容必须用中文回答。
目标：生成一个180分钟的"Nature Compass自然指南针"STEAM周末研学方案，适用于6-8岁学生。

[极其重要：这是纯研学版本，完全排除ESL/英语教学内容]
这个版本是面向中国学生的中文STEAM研学课件，不是ESL英语教学课件。你必须严格遵守以下规则：
- 绝对不要包含任何英语教学步骤
- vocabulary部分的keywords请使用STEAM科学术语的中文定义

[教学流程要求]
- 生成恰好5-6个遵循5E模型的逻辑阶段。
- 每个阶段必须包含丰富的"背景知识"（5-8条具体的科学事实、数据、专有名词、因果关系——这些是手册的【核心素材】，必须足够详实以支撑完整的页面内容）和"教学建议"。

[学生手册设计规则（关键）]
以下英文规范为手册页面设计的完整规则（JSON key名保持英文），仅手册文本内容（contentPrompt）使用中文书写。背景知识页面请使用启发式、探究式语气——通过提问和悖论引发好奇心，而非直接陈述事实。
[Handbook Structure: AUTO MODE — Target 15 pages]
You have full autonomy to decide the optimal page composition for this workshop.
Consider theme complexity, student age, workshop duration (180min), and number of Roadmap phases.

Available section types:
  Cover, Table of Contents, Safety, Prop Checklist, Background Knowledge, Activity/Worksheet, Reflection, Certificate, Back Cover

Constraints:
- Cover (exactly 1), Certificate (exactly 1), Back Cover (exactly 1) are MANDATORY.
- You MUST generate EXACTLY 15 pages total. This is the user's requested page count.
- Each Roadmap phase MUST have ≥1 Background Knowledge page AND ≥1 Activity/Worksheet page.
- Every Background Knowledge and Activity/Worksheet page MUST include a 'phaseIndex' field.
- Pages must be ordered by phaseIndex (ascending), with Background Knowledge before Activity/Worksheet within each phase.
- You MUST output a 'handbookStructurePlan' field (a short text summary) listing your chosen section breakdown BEFORE generating the 'handbook' array.

额外中文规则：
- 所有手册文本内容（contentPrompt、title）必须用中文书写。
- visualPrompt 和 handbookStylePrompt 保持英文，以确保图像生成质量。
- 手册重点应该是：科学探究记录、实验观察表、知识问答、创意设计、反思日志。

结构要求：
- 任务简报：引人入胜的标题和叙事（中文）。
- 词汇：8-10个STEAM科学关键术语及中文定义。
- 手册：精心设计的研学内容，按照上述手册规则生成。
`;

async function main() {
    try {
        console.log("Generating...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: lessonPlanSchema as any,
                temperature: 0.5,
            },
            contents: [{ text: "Theme: Spring Urban Nature Exploration. Activities: Leaf collecting, weather observation." }]
        });
        const text = response.text;
        const parsed = JSON.parse(text);

        console.log("Handbook Plan:", parsed.handbookStructurePlan);
        console.log("Handbook array length:", parsed.handbook?.length);
        console.log("Roadmap phases:", parsed.roadmap?.length);
    } catch (e) {
        console.error(e);
    }
}
main();

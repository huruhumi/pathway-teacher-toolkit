
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CorrectionReport, Grade, StudentGrade, CEFRLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `你是一位专门指导中国 K12 (小学至高中) 学生的资深 ESL (英语作为第二语言) 专家。你拥有雅思/托福考官的专业眼光，同时具备极强的同理心。

任务：分析学生作文及命题，生成结构化批改报告。

评分标准需严格遵守以下量化等级 (A+, A, A-, B+, B, B-, C+, C, C-, F)：
1. **书写规范 (Mechanics)**: 标点(严禁中文标点)、大小写、间距。
2. **语法准确性 (Grammar)**: 时态、主谓一致、句式结构。
3. **词汇丰富度 (Vocabulary)**: 用词准确性、拼写、多样性。
4. **逻辑与连贯 (Logic)**: 分段、连接词使用。
5. **内容完成度 (Content)**: 是否跑题、论述充分度、字数要求。

新增要求：
1. **高分范文 (Golden Version)**: 生成一篇基于学生原意但语言地道的满分范文。
2. **句式分析**: 估算简单句、并列句、复合句比例，并给出建议。
3. **搭配禁忌 (Collocations)**: 找出中式搭配错误 (如 "learn knowledge")。
4. **定制测验**: 基于文中错误生成 3 道单选题。
5. **语言升级 (Language Enhancement)**: 选取文中 2-3 个基础/简单句子进行三级跳升级：
   - Level 1: 学生原句或基础表达。
   - Level 2: 进阶版 (使用更好的词汇)。
   - Level 3: 雅思/托福高分版 (地道句式)。
   - **重要**: 在 Level 2 和 Level 3 中，必须用星号 *包裹* 升级的亮点词汇或句式 (例如：*significantly impact*)。
6. **地道习语建议 (Idioms & Phrasal Verbs)**: 识别文中可以用地道成语(Idioms)或短语动词(Phrasal Verbs)表达的地方。提供推荐表达、原句语境(Original Context)、含义(Meaning)及用法说明(Usage)。请优先推荐成语。

报告主体使用中文，改写和专业术语保持英文。`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    originalText: { type: Type.STRING },
    topicText: { type: Type.STRING },
    goldenVersion: { type: Type.STRING, description: "A native-level rewrite of the full essay." },
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dimension: { type: Type.STRING },
          grade: { type: Type.STRING, enum: Object.values(Grade) },
          comment: { type: Type.STRING }
        },
        required: ["dimension", "grade", "comment"]
      }
    },
    overallGrade: { type: Type.STRING, enum: Object.values(Grade) },
    approximateCEFR: { type: Type.STRING, description: "Evaluated CEFR range like 'A2-B1' or 'B2'" },
    approximateCEQ: { type: Type.STRING, description: "Evaluated CEQ score like 'KET 130-140' or 'PET 155'" },
    mechanicsAnalysis: { type: Type.STRING },
    grammarErrors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          refined: { type: Type.STRING },
          explanation: { type: Type.STRING },
          type: { type: Type.STRING, description: "Type of error, e.g., Tense, Article, Chinglish" }
        },
        required: ["original", "refined", "explanation"]
      }
    },
    collocationErrors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["original", "suggestion", "explanation"]
      }
    },
    sentenceVariety: {
      type: Type.OBJECT,
      properties: {
        simple: { type: Type.INTEGER, description: "Percentage of simple sentences (0-100)" },
        compound: { type: Type.INTEGER, description: "Percentage of compound sentences (0-100)" },
        complex: { type: Type.INTEGER, description: "Percentage of complex sentences (0-100)" },
        advice: { type: Type.STRING, description: "Advice on improving sentence variety" }
      },
      required: ["simple", "compound", "complex", "advice"]
    },
    idiomSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          expression: { type: Type.STRING },
          originalContext: { type: Type.STRING },
          meaning: { type: Type.STRING },
          usage: { type: Type.STRING }
        },
        required: ["expression", "originalContext", "meaning", "usage"]
      }
    },
    vocabularyUpgrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          basicWord: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          exampleSentence: { type: Type.STRING }
        },
        required: ["basicWord", "suggestion", "exampleSentence"]
      }
    },
    wordBank: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          meaning: { type: Type.STRING },
          example: { type: Type.STRING }
        },
        required: ["word", "meaning", "example"]
      }
    },
    topicExtensions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          expression: { type: Type.STRING },
          meaning: { type: Type.STRING },
          usage: { type: Type.STRING }
        },
        required: ["expression", "meaning", "usage"]
      }
    },
    languageEnhancement: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "Level 1: Basic sentence" },
          level2: { type: Type.STRING, description: "Level 2: Improved sentence with *highlights*" },
          level3: { type: Type.STRING, description: "Level 3: Advanced sentence with *highlights*" }
        },
        required: ["original", "level2", "level3"]
      }
    },
    errorQuiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer", "explanation"]
      }
    },
    teacherNote: {
      type: Type.OBJECT,
      properties: {
        zh: { type: Type.STRING },
        en: { type: Type.STRING }
      },
      required: ["zh", "en"]
    }
  },
  required: ["originalText", "goldenVersion", "grades", "overallGrade", "approximateCEFR", "approximateCEQ", "mechanicsAnalysis", "grammarErrors", "collocationErrors", "sentenceVariety", "idiomSuggestions", "vocabularyUpgrades", "wordBank", "topicExtensions", "languageEnhancement", "errorQuiz", "teacherNote"]
};

export const analyzeEssay = async (
  essayInput: string | { base64: string, mimeType: string },
  studentGrade: StudentGrade,
  cefrLevel: CEFRLevel,
  topicInput?: string | { base64: string, mimeType: string }
): Promise<CorrectionReport> => {
  const parts: any[] = [];
  parts.push({ text: `学生年级: ${studentGrade}, 目标 CEFR 等级: ${cefrLevel}` });
  if (topicInput) {
    if (typeof topicInput === 'string') parts.push({ text: `【命题】：\n${topicInput}` });
    else parts.push({ text: "【命题图片】：", inlineData: { data: topicInput.base64, mimeType: topicInput.mimeType } });
  }
  if (typeof essayInput === 'string') parts.push({ text: `【作文】：\n${essayInput}` });
  else parts.push({ text: "【作文图片】：", inlineData: { data: essayInput.base64, mimeType: essayInput.mimeType } });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: "application/json", responseSchema: responseSchema },
  });

  if (!response.text) throw new Error("Failed to get response");
  return JSON.parse(response.text) as CorrectionReport;
};

export const generateAdditionalItem = async (
  type: 'wordBank' | 'grammarErrors' | 'idiomSuggestions' | 'vocabularyUpgrades' | 'topicExtensions' | 'languageEnhancement',
  essay: string,
  topic: string,
  existingItems: any[]
): Promise<any> => {
  const schemaMap = {
    wordBank: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, meaning: { type: Type.STRING }, example: { type: Type.STRING } }, required: ["word", "meaning", "example"] },
    grammarErrors: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, refined: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ["original", "refined", "explanation"] },
    idiomSuggestions: { type: Type.OBJECT, properties: { expression: { type: Type.STRING }, originalContext: { type: Type.STRING }, meaning: { type: Type.STRING }, usage: { type: Type.STRING } }, required: ["expression", "originalContext", "meaning", "usage"] },
    vocabularyUpgrades: { type: Type.OBJECT, properties: { basicWord: { type: Type.STRING }, suggestion: { type: Type.STRING }, exampleSentence: { type: Type.STRING } }, required: ["basicWord", "suggestion", "exampleSentence"] },
    topicExtensions: { type: Type.OBJECT, properties: { expression: { type: Type.STRING }, meaning: { type: Type.STRING }, usage: { type: Type.STRING } }, required: ["expression", "meaning", "usage"] },
    languageEnhancement: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, level2: { type: Type.STRING }, level3: { type: Type.STRING } }, required: ["original", "level2", "level3"] },
  };

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `根据命题 "${topic}" 和作文 "${essay}"，再生成一条全新的、不重复于 [${JSON.stringify(existingItems)}] 的 "${type}" 条目。对于 languageEnhancement，确保 Level 2 和 Level 3 中使用星号 * 包裹升级词汇。`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: schemaMap[type],
    },
  });

  if (!response.text) throw new Error("Generation failed");
  return JSON.parse(response.text);
};

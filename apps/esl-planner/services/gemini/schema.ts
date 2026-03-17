import { Type, Schema } from "@google/genai";

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structuredLessonPlan: {
      type: Type.OBJECT,
      properties: {
        classInformation: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING },
            topic: { type: Type.STRING },
            students: { type: Type.STRING },
            date: { type: Type.STRING },
          },
          required: ["level", "topic", "students", "date"]
        },
        lessonDetails: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            aim: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
            targetVocab: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING, description: "A simple, level-appropriate English explanation" }
                },
                required: ["word", "definition"]
              }
            },
            grammarSentences: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key grammar patterns as Q&A dialogue pairs for conversation practice. Each item MUST include BOTH a question AND an answer in the format: 'Q: What's your name? → A: I'm Sofia.' or 'Q: Is he your friend? → A: Yes, he is.' DO NOT return answer-only sentences. DO NOT use markdown bold headers."
            },
            anticipatedProblems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  problem: { type: Type.STRING },
                  solution: { type: Type.STRING }
                }
              }
            }
          },
          required: ["type", "aim", "objectives", "materials", "targetVocab", "grammarSentences", "anticipatedProblems"]
        },
        stages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stage: { type: Type.STRING },
              stageAim: { type: Type.STRING },
              timing: { type: Type.STRING },
              interaction: { type: Type.STRING, description: "Comma-separated interaction modes, one per numbered step in teacherActivity/studentActivity. Use standard ESL codes: T-S (teacher to students), S-S (student to student), S-S (pairs), S-S (groups), T-Ss, S-T, etc. Must have the same count as the numbered steps." },
              teacherActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ teacher actions" },
              studentActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ student responses" },
              teachingTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 practical ESL teaching methodology tips for this specific stage (e.g., scaffolding techniques, TPR suggestions, visual aids, sentence frames, error correction strategies)." },
              backgroundKnowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 relevant background knowledge points for the teacher about this stage's content (cultural context, linguistic notes, common misconceptions, subject matter facts)." },
              fillerActivity: { type: Type.STRING, description: "SHORT NAME ONLY (2-5 words, e.g. 'Vocabulary Hot Seat'). A quick filler/extension activity name for this stage. Do NOT include instructions or descriptions — just the activity name." },
              suggestedGameName: { type: Type.STRING, description: "SHORT NAME ONLY (2-5 words, e.g. 'Information Gap Race'). Name of a game/activity for this stage. Do NOT include instructions — just the activity name." }
            },
            required: ["stage", "stageAim", "timing", "interaction", "teacherActivity", "studentActivity", "teachingTips", "backgroundKnowledge", "fillerActivity", "suggestedGameName"]
          }
        }
      },
      required: ["classInformation", "lessonDetails", "stages"]
    },
    lessonPlanMarkdown: {
      type: Type.STRING,
      description: "A summary of the lesson plan in Markdown format."
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING, description: "Slide text content, expanding on the topic from an ESL expert perspective. Do not blindly copy uploaded materials." },
          visual: { type: Type.STRING, description: "Visual description (what the slide should show, such as images, diagrams, or illustrations), referencing uploaded context but creatively adapted." },
          layoutDesign: { type: Type.STRING, description: "Layout design instructions (how the content and visual should be arranged on the slide for maximum ESL learning impact)." }
        },
        required: ["title", "content", "visual", "layoutDesign"]
      }
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The target vocabulary word or phrase" },
          definition: { type: Type.STRING, description: "Simple definition or sentence example" },
          visualPrompt: { type: Type.STRING, description: "A simple visual description of the word for AI image generation (e.g. 'A red apple')" },
          type: { type: Type.STRING, enum: ["vocabulary", "concept"] }
        },
        required: ["word", "definition", "visualPrompt", "type"]
      }
    },
    games: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, description: "Game Category e.g., Warm-up, Review" },
          interactionType: {
            type: Type.STRING,
            enum: ["Physical Movement", "Group Collaboration", "Digital Tool", "Individual Focus"],
            description: "Type of student interaction required."
          },
          instructions: { type: Type.STRING, description: "Detailed numbered instructions. Every step MUST start with a number and a new line." },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } },
          linkedStage: { type: Type.STRING, description: "The exact stage name this game/activity is designed for. Must match one of the stage names in structuredLessonPlan.stages[].stage." }
        },
        required: ["name", "type", "interactionType", "instructions", "materials", "linkedStage"]
      }
    },
    phonics: {
      type: Type.OBJECT,
      properties: {
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 phonics patterns, sounds, or rules found in the uploaded teaching materials or target vocabulary." },
        decodableTexts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A few level-appropriate short rhyming stories or texts. Constraints: EXACTLY 5-8 lines long. EXACTLY 5-8 words per line. IMPORTANT: The story MUST be highly logical and make sense. Include phonics extension words (wrap in <span style='color: #10b981; font-weight: bold;'>word</span>), sight words (wrap in <span style='color: #eab308; font-weight: bold;'>word</span>), and target lesson words (wrap in <span style='color: #8b5cf6; font-weight: bold;'>word</span>). Do NOT use more than 5 words that are outside of the target lesson vocabulary or standard sight words. Each text MUST start with a Catchy TITLE in ALL CAPS on the first line. The story should be written in a rhythmic, rhyming style (e.g., AABB or ABAB). EVERY SINGLE SENTENCE MUST start on its own new line (use <br/> for line breaks instead of \\n since it is HTML)." },
        decodableTextPrompts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Simple visual prompts for AI image generation describing the scene in each decodable text." }
      },
      required: ["keyPoints", "decodableTexts", "decodableTextPrompts"]
    },
    readingCompanion: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.ARRAY,
          description: "MUST contain EXACTLY 7 items, covering Day 1 to Day 7 in chronological order.",
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.NUMBER },
              focus: { type: Type.STRING },
              focus_cn: { type: Type.STRING, description: "Chinese translation of focus" },
              activity: { type: Type.STRING },
              activity_cn: { type: Type.STRING, description: "Chinese translation of activity" },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Task description in English" },
                    text_cn: { type: Type.STRING, description: "Task description in Chinese" },
                    isCompleted: { type: Type.BOOLEAN, description: "Always false initially" }
                  },
                  required: ["text", "text_cn"]
                }
              },
              resources: {
                type: Type.ARRAY,
                description: "MUST contain at least 1 relevant web resource (YouTube video, article, interactive tool) related to the day's focus. Always provide real, working URLs.",
                items: {
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
              },
              trivia: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING, description: "A short, engaging trivia fact in English related to the day's focus." },
                  cn: { type: Type.STRING, description: "Chinese translation of the trivia fact." }
                },
                required: ["en", "cn"]
              }
            },
            required: ["day", "focus", "focus_cn", "activity", "activity_cn", "tasks", "trivia", "resources"]
          }
        },
        webResources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              title_cn: { type: Type.STRING, description: "Chinese translation of title" },
              url: { type: Type.STRING },
              description: { type: Type.STRING },
              description_cn: { type: Type.STRING, description: "Chinese translation of description" }
            },
            required: ["title", "title_cn", "url", "description", "description_cn"]
          },
          description: "Suggested external web resources (videos, articles) related to the topic."
        }
      },
      required: ["days", "webResources"]
    },
    notebookLMPrompt: {
      type: Type.STRING,
      description: "A specialized prompt for NotebookLM to generate the slides. Must instruct NotebookLM to use the newly provided 'Visual' and 'Layout Design' for each slide. CRITICAL: Provide a 'Global Style & Formatting Guidelines' section at the top of this prompt to ensure consistent colors, fonts, and illustration styles across all slides."
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        objectives: { type: Type.STRING },
        targetVocab: { type: Type.ARRAY, items: { type: Type.STRING } },
        grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["objectives", "targetVocab", "grammarPoints"]
    }
  },
  required: ["structuredLessonPlan", "lessonPlanMarkdown", "slides", "flashcards", "games", "readingCompanion", "notebookLMPrompt", "summary", "phonics"]
} satisfies Schema;

/**
 * Reduced schema for Phase 1 (plan_only mode).
 * Only structuredLessonPlan + summary + lessonPlanMarkdown are generated.
 * This focuses AI attention on lesson plan quality.
 */
export const PLAN_ONLY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structuredLessonPlan: RESPONSE_SCHEMA.properties.structuredLessonPlan,
    lessonPlanMarkdown: RESPONSE_SCHEMA.properties.lessonPlanMarkdown,
    summary: RESPONSE_SCHEMA.properties.summary,
  },
  required: ["structuredLessonPlan", "lessonPlanMarkdown", "summary"]
} satisfies Schema;

/**
 * Schema for Phase 2 (supporting content generation).
 * Contains only slides, flashcards, games, phonics, readingCompanion, notebookLMPrompt.
 * structuredLessonPlan is NOT included — it's passed in via prompt context.
 */
export const SUPPORTING_CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slides: RESPONSE_SCHEMA.properties.slides,
    flashcards: RESPONSE_SCHEMA.properties.flashcards,
    games: RESPONSE_SCHEMA.properties.games,
    phonics: RESPONSE_SCHEMA.properties.phonics,
    readingCompanion: RESPONSE_SCHEMA.properties.readingCompanion,
    notebookLMPrompt: RESPONSE_SCHEMA.properties.notebookLMPrompt,
  },
  required: ["slides", "flashcards", "games", "readingCompanion", "notebookLMPrompt", "phonics"]
} satisfies Schema;

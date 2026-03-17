import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import { Curriculum, CurriculumParams, LessonPlanResponse, RoadmapItem } from '../../types';
import { curriculumSchema, downstreamSchema, roadmapItemSchema } from './curriculumSchemas';

export const regenerateCurriculumWithFeedback = async (
  currentCurriculum: Curriculum,
  params: CurriculumParams,
  feedback: string,
  language: 'en' | 'zh',
): Promise<Curriculum> => {
  const ai = createAIClient();
  const isCN = language === 'zh';

  const systemInstruction = isCN
    ? `你是一名课程修订专家。请根据用户反馈，修订下面的 STEAM 户外课程大纲。

[当前大纲]
${JSON.stringify(currentCurriculum, null, 2)}

[用户反馈]
"${feedback}"

[要求]
1. 按反馈调整课程内容与侧重点。
2. 保持课程数量为 ${params.lessonCount}，每节时长 ${params.duration}。
3. 目标年龄 ${params.ageGroup}，地点 ${params.city}。
4. 保留 STEAM 框架，且每节课都有户外活动与室内替代方案。
5. 全部输出为中文。`
    : `You are a curriculum revision specialist. Revise the following STEAM outdoor curriculum based on user feedback.

[CURRENT CURRICULUM]
${JSON.stringify(currentCurriculum, null, 2)}

[USER FEEDBACK]
"${feedback}"

[INSTRUCTIONS]
1. Adjust the curriculum to address the feedback.
2. Maintain exactly ${params.lessonCount} lessons, each ${params.duration} minutes.
3. Target: ${params.ageGroup}, Location: ${params.city}.
4. Keep the STEAM framework with outdoor activities and indoor alternatives.
5. ALL output in English.`;

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: isCN
        ? '请根据上面的反馈重新生成课程大纲。'
        : 'Please regenerate the curriculum based on the feedback above.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: curriculumSchema,
        temperature: 0.5,
      },
    });

    const text = response.text;
    if (!text) throw new Error('AI returned an empty response.');
    return JSON.parse(text) as Curriculum;
  });
};

export const regenerateSinglePhase = async (
  plan: LessonPlanResponse,
  phaseIndex: number,
  feedback: string,
  language: 'en' | 'zh',
): Promise<RoadmapItem> => {
  const ai = createAIClient();
  const isCN = language === 'zh';
  const currentPhase = plan.roadmap[phaseIndex];
  const allPhases = plan.roadmap.map((p, i) => `[Phase ${i + 1}] ${p.phase}: ${p.activity}`).join('\n');

  const systemInstruction = isCN
    ? `你是一名课程活动设计专家。请根据用户反馈修订指定教学阶段。

[整体上下文]
主题: ${plan.basicInfo.theme}
活动类型: ${plan.basicInfo.activityType}
对象: ${plan.basicInfo.targetAudience}
地点: ${plan.basicInfo.location}
全部阶段:
${allPhases}

[待修订阶段 #${phaseIndex + 1}]
${JSON.stringify(currentPhase, null, 2)}

[用户反馈]
"${feedback}"

[要求]
1. 修订该阶段并保持与其他阶段连贯。
2. 保持相同时间段 (${currentPhase.timeRange})。
3. backgroundInfo 5-8 条，steps 5-7 条，teachingTips 3-5 条。
4. activityInstructions 为可直接执行的学生视角说明。`
    : `You are an expert activity designer. Revise the following teaching phase based on user feedback.

[OVERALL LESSON CONTEXT]
Theme: ${plan.basicInfo.theme}
Activity Type: ${plan.basicInfo.activityType}
Audience: ${plan.basicInfo.targetAudience}
Location: ${plan.basicInfo.location}
All phases:
${allPhases}

[CURRENT PHASE #${phaseIndex + 1}]
${JSON.stringify(currentPhase, null, 2)}

[USER FEEDBACK]
"${feedback}"

[INSTRUCTIONS]
1. Revise this phase while maintaining coherence with other phases.
2. Keep the same time range (${currentPhase.timeRange}).
3. backgroundInfo needs 5-8 detailed facts; steps 5-7 items; teachingTips 3-5 items.
4. activityInstructions must include student-facing instructions.`;

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: isCN
        ? '请根据上面的反馈重新生成这个教学阶段。'
        : 'Please regenerate this phase based on the feedback above.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: roadmapItemSchema,
        temperature: 0.5,
      },
    });

    const text = response.text;
    if (!text) throw new Error('AI returned an empty response.');
    return JSON.parse(text) as RoadmapItem;
  });
};

export const regenerateDownstreamFromRoadmap = async (
  plan: LessonPlanResponse,
  language: 'en' | 'zh',
): Promise<Pick<LessonPlanResponse, 'handbook' | 'supplies' | 'imagePrompts' | 'notebookLMPrompt' | 'handbookStylePrompt'>> => {
  const ai = createAIClient();
  const isCN = language === 'zh';

  const systemInstruction = isCN
    ? `你是一名教育内容设计专家。请根据更新后的 roadmap 重新生成下游内容。

[课程信息]
主题: ${plan.basicInfo.theme}
活动类型: ${plan.basicInfo.activityType}
对象: ${plan.basicInfo.targetAudience}
地点: ${plan.basicInfo.location}

[更新后的 Roadmap]
${JSON.stringify(plan.roadmap, null, 2)}

[当前手册风格]
${plan.handbookStylePrompt}

[输出要求]
1. 重新生成 handbook。
2. 重新生成 supplies。
3. 重新生成 imagePrompts（3-5）。
4. 重新生成 notebookLMPrompt。
5. 保持或优化 handbookStylePrompt。`
    : `You are an educational content designer. Based on the updated roadmap, regenerate downstream content.

[LESSON INFO]
Theme: ${plan.basicInfo.theme}
Activity Type: ${plan.basicInfo.activityType}
Audience: ${plan.basicInfo.targetAudience}
Location: ${plan.basicInfo.location}

[UPDATED ROADMAP]
${JSON.stringify(plan.roadmap, null, 2)}

[CURRENT HANDBOOK STYLE]
${plan.handbookStylePrompt}

[OUTPUT]
1. Regenerate handbook.
2. Regenerate supplies.
3. Regenerate imagePrompts (3-5).
4. Regenerate notebookLMPrompt.
5. Maintain or improve handbookStylePrompt.`;

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: isCN
        ? '请基于更新后的 roadmap 重新生成下游内容。'
        : 'Please regenerate downstream content based on the updated roadmap.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: downstreamSchema,
        temperature: 0.3,
      },
    });

    const text = response.text;
    if (!text) throw new Error('AI returned an empty response.');
    return JSON.parse(text);
  });
};

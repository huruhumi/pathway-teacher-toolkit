// Content Review v2 — Step 9: Architecture & UI/UX Pipeline Review
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review';
// Get the most recent run directory
const runs = readdirSync(DIR).filter(f => f.startsWith('202')).sort().reverse();
const CURRENT_RUN = `${DIR}/${runs[0]}`;

async function main() {
    console.log('=== Step 9: Architecture & UI/UX Pipeline Review ===\n');

    const curriculumCode = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/services/curriculumService.ts', 'utf8');
    const geminiCode = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/services/geminiService.ts', 'utf8');
    const workflowDoc = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.agents/workflows/content-review.md', 'utf8');

    const prompt = `You are a Senior AI Software Engineer and Lead UI/UX Designer reviewing the content generation pipeline for a STEAM education app (Nature Compass).
  
We use Gemini APIs to generate Curriculum outlines and detailed Lesson Kits (JSON with visuals and markdown handbook content).
Below are the core service files and the actual workflow we use for batch generation and expert-review:

=== curriculumService.ts ===
${curriculumCode.substring(0, 8000)} // Truncated for token limit

=== geminiService.ts ===
${geminiCode}

=== content-review.md (Workflow) ===
${workflowDoc}

Please review this entire generation logic, pipeline, and UI/UX instruction approach. Output MUST be in Chinese.
Provide a high-level optimization report structurally addressing:

## 从 AI 软件工程师的视角
1. 提示词工程架构：系统提示(System Prompt)与JSON Schema结合的方式是否高效？是否有缩减Token、提升稳定性的优化空间？
2. 代码容错与可维护性：对于长文本生成、结构化输出和API错误重试的逻辑，是否有业界最佳实践建议？
3. 工作流自动化设计：目前的评审链路（生成->自动验证->专家评审->最终报告）设计是否合理？痛点及优化建议。

## 从 网页设计师/UI 视角
1. 视觉结构生成逻辑：在 \`buildHandbookRules\` 中对页面排版、图文比例的指令设定，是否能有效支撑后续网页或PDF的视觉渲染？
2. 审美与排版提示词：当前的 \`visualPrompt\` 和 \`layoutDescription\` 生成约束是否足够，有哪些缺失的要素？
3. 用户体验 (UX)：针对学生(阅读体验)、教师(执行便捷性)和家长(亲子互动)的输出格式，在工程侧如何进一步强化？

## 执行总结 (Executive Summary)
列出最有价值的 3 条工程重构或流程优化建议 (Top 3 Recommendations)。
`;

    try {
        console.log('  Generating architecture review using gemini-2.5-pro...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { temperature: 0.2 }
        });

        // Check if report exists to append to it
        const reportPath = `${CURRENT_RUN}/07-final-report/content-review-report.md`;
        let reportContent = '';
        if (existsSync(reportPath)) {
            reportContent = readFileSync(reportPath, 'utf8');
        }

        reportContent += `\n\n## 架构与生成逻辑审查 (Architecture & UI/UX Pipeline Review)\n\n`;
        reportContent += response.text;

        writeFileSync(reportPath, reportContent);
        console.log(`  ✅ Report appended to ${reportPath}`);

    } catch (e) {
        console.error(`  ❌ Failed to generate architecture review:`, e.message);
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

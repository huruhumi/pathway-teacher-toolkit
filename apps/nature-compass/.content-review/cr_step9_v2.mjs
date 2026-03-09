// Content Review v2 — Step 9: Regression Testing
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';

async function main() {
    console.log('=== Step 9: Regression Testing (A14) ===\n');

    const baselinePath = `${DIR}/00-baseline/baseline-scores.md`;
    const newReportPath = `${DIR}/07-final-report/content-review-report.md`;

    if (!existsSync(baselinePath) || !existsSync(newReportPath)) {
        console.log('Missing baseline or new report. Skipping regression test.');
        return;
    }

    const baseline = readFileSync(baselinePath, 'utf8');
    const newReport = readFileSync(newReportPath, 'utf8');

    const prompt = `You are an AI QA Engineer conducting a regression analysis on our prompt improvements.
    
    We recently implemented 8 major prompt enhancements (including explicit safety protocols, 30m location limits, STEAM integration checks, indoor equivalence rules, and pre/post-class activities) to fix previous failures.

    === BASELINE SCORES (BEFORE FIXES) ===
    ${baseline.substring(0, 3000)} // Truncated to just scores and automated checks section

    === NEW SCORES (AFTER PROMPT FIXES) ===
    ${newReport.substring(0, 3000)} // Truncated strictly to tables and automated checks section

    Task:
    Compare the baseline automated checks & expert review scores against the new scores.
    1. Did the prompt fixes resolve the previous issues (e.g. word count, missing data)?
    2. Did the new prompt introduce any regressions in scores or generation success? 
    3. Output a simple comparison table and a 3-bullet-point summary of the regression status.
    Write in Chinese.`;

    console.log('  Generating regression report...');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.2 }
    });

    const reportContent = `\n\n## 回归测试分析 (Regression Testing - A14)\n\n` + response.text;

    // Append to final report
    let fullReport = readFileSync(newReportPath, 'utf8');
    fullReport += reportContent;
    writeFileSync(newReportPath, fullReport);

    console.log('  ✅ Regression testing appended to final report');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

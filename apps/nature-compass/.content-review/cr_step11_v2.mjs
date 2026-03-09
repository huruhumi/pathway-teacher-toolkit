// Content Review v2 - Step 11: Generate Implementation Plan
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';
const TIMING = `${DIR}/_timing.log`;
const ERRORS = `${DIR}/_errors.log`;

if (!existsSync(`${DIR}/08-implementation-plan`)) {
    mkdirSync(`${DIR}/08-implementation-plan`, { recursive: true });
}

appendFileSync(TIMING, `\n=== Step 11: ${new Date().toISOString()} ===\n`);
appendFileSync(ERRORS, `\n=== Step 11: ${new Date().toISOString()} ===\n`);

async function main() {
    console.log('=== Step 11: Generate Implementation Plan ===\n');
    const t0 = Date.now();

    try {
        let report = '';
        try {
            report = readFileSync(`${DIR}/07-final-report/content-review-report.md`, 'utf8');
        } catch (e) {
            console.error('Final report not strictly found, proceeding anyway if we have optimization plans.');
        }

        let optimizationPlan = '';
        try {
            optimizationPlan = readFileSync(`${DIR}/06-kit-fixes/optimization-plan.md`, 'utf8');
        } catch (e) { }

        const prompt = `
        You are an expert Principal Engineer and AI Architect.
        Based on the following Content Review Report and Kit Optimization Plan, design a concrete, multi-stage implementation plan.
        Ensure the plan evaluates feasibility and safety, clearly detailing how prompt changes or UI code changes should be applied globally across the codebase.
        Output valid MARKDOWN.

        === FINAL REPORT ===
        ${report}
        
        === OPTIMIZATION PLAN ===
        ${optimizationPlan}
        `;

        const resp = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt
        });

        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        writeFileSync(`${DIR}/08-implementation-plan/implementation_plan.md`, resp.text);
        appendFileSync(TIMING, `Step 11 Implementation Plan: ${sec}s\n`);
        console.log(`  ✅ Implementation Plan generated in ${sec}s`);
    } catch (e) {
        console.error(`  ❌ Step 11 Error: ${e.message}`);
        appendFileSync(ERRORS, `Step 11: ${e.message}\n`);
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

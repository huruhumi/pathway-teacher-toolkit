import { StructuredLessonPlan, Slide, Game, ReadingCompanionContent, Worksheet } from '../types';

export const formatLessonPlanMd = (plan: StructuredLessonPlan) => {
    let md = `# Lesson Plan: ${plan.classInformation.topic}\n\n`;
    md += `## 📋 Class Information\n- **Level:** ${plan.classInformation.level}\n- **Date:** ${plan.classInformation.date}\n- **Topic:** ${plan.classInformation.topic}\n- **Students:** ${plan.classInformation.students}\n\n`;
    md += `## 🎯 Objectives\n`;
    plan.lessonDetails.objectives.forEach(obj => md += `- ${obj}\n`);
    md += `\n## 🛠️ Materials & Equipment\n`;
    plan.lessonDetails.materials.forEach(mat => md += `- ${mat}\n`);
    md += `\n## 📚 Target Vocabulary\n`;
    plan.lessonDetails.targetVocab.forEach(v => md += `- **${v.word}**: ${v.definition}\n`);
    md += `\n## 📝 Grammar & Target Sentences\n`;
    plan.lessonDetails.grammarSentences.forEach(s => md += `- ${s}\n`);
    md += `\n## ⚠️ Anticipated Problems & Solutions\n`;
    plan.lessonDetails.anticipatedProblems.forEach(p => md += `### Problem: ${p.problem}\n**Solution:** ${p.solution}\n\n`);
    md += `## 🏃 Teaching Stages\n\n| Stage | Timing | Interaction | Aim |\n| :--- | :--- | :--- | :--- |\n`;
    plan.stages.forEach(s => md += `| ${s.stage} | ${s.timing} | ${s.interaction} | ${s.stageAim} |\n`);
    md += `\n\n`;
    plan.stages.forEach(s => { md += `### Stage: ${s.stage} (${s.timing})\n**Teacher Activity:**\n${s.teacherActivity}\n\n**Student Activity:**\n${s.studentActivity}\n\n---\n\n`; });
    return md;
};

export const formatSlidesMd = (slides: Slide[]) => {
    let md = `# PPT Presentation Outline\n\n`;
    slides.forEach((s, i) => { md += `## Slide ${i + 1}: ${s.title}\n### 📄 Content\n${s.content}\n\n### 👁️ Visual\n${s.visual}\n\n### 🎤 Layout Design\n${s.layoutDesign}\n\n---\n\n`; });
    return md;
};

export const formatGamesMd = (games: Game[]) => {
    let md = `# Classroom Games & Activities\n\n`;
    games.forEach(g => { md += `## 🎮 ${g.name}\n- **Type:** ${g.type}\n- **Interaction:** ${g.interactionType}\n- **Materials Needed:** ${g.materials.join(', ') || 'None'}\n\n### Instructions\n${g.instructions}\n\n---\n\n`; });
    return md;
};

export const formatCompanionMd = (companion: ReadingCompanionContent) => {
    let md = `# 📅 Learning Companion\n\n`;
    companion.days.forEach(day => {
        md += `## Day ${day.day}: ${day.focus} (${day.focus_cn})\n### ✅ Tasks\n`;
        day.tasks?.forEach(t => md += `- [ ] ${t.text} (${t.text_cn})\n`);
        if (day.trivia) md += `\n### 💡 Day Trivia Fact\n- **EN:** ${day.trivia.en}\n- **CN:** ${day.trivia.cn}\n`;
        md += `\n### 🔗 Resources\n`;
        day.resources?.forEach(r => md += `- [${r.title}](${r.url}) - ${r.description}\n`);
        md += `\n---\n\n`;
    });
    return md;
};

export const formatWorksheetQuestionsMd = (worksheets: Worksheet[]) => {
    let md = `# 📝 Review Worksheets (Questions)\n\n`;
    worksheets.forEach(ws => {
        md += `## ${ws.title}\n*${ws.instructions}*\n\n`;
        ws.sections?.forEach((sec, sIdx) => {
            md += `### Section ${sIdx + 1}: ${sec.title}\n`;
            if (sec.description) md += `*${sec.description}*\n\n`;
            if (sec.passage) md += `> ${sec.passage}\n\n`;
            if (sec.layout === 'matching') {
                md += `| Column A | Column B |\n| :--- | :--- |\n`;
                sec.items.forEach(item => md += `| ${item.question} | [ ] |\n`);
            } else {
                sec.items.forEach((item, i) => {
                    md += `${i + 1}. ${item.question}\n`;
                    if (item.options?.length) { md += `\n`; item.options.forEach((opt, oi) => md += `   ${String.fromCharCode(65 + oi)}) ${opt}\n`); }
                    md += `\n`;
                });
            }
            md += `\n---\n\n`;
        });
    });
    return md;
};

export const formatWorksheetAnswersMd = (worksheets: Worksheet[]) => {
    let md = `# ✅ Worksheet Answer Key\n\n`;
    worksheets.forEach(ws => {
        md += `## ${ws.title} - Answers\n\n`;
        ws.sections?.forEach((sec, sIdx) => {
            md += `### Section ${sIdx + 1}: ${sec.title}\n`;
            sec.items.forEach((item, i) => {
                const optIdx = item.options?.indexOf(item.answer) ?? -1;
                const optPrefix = optIdx !== -1 ? `${String.fromCharCode(65 + optIdx)}) ` : "";
                md += `${i + 1}. **${optPrefix}${item.answer}**\n`;
            });
            md += `\n`;
        });
        md += `---\n\n`;
    });
    return md;
};

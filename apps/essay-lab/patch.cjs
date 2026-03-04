const fs = require('fs');
const file = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/essay-lab/components/ReportDisplay.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "import GradeBadge from './GradeBadge';",
    "import GradeBadge from './GradeBadge';\nimport {\n  ReportHeader,\n  TranscriptSection,\n  GradeSection,\n  DetailedAnalysis,\n  EnhancementSection,\n  WordBankSection,\n  QuizSection,\n  TeacherNoteSection,\n  ReportActions,\n  ReportState,\n  ReportActions as ActionsType\n} from './report';"
);

// We find the exact main return block string that we want to replace
const targetStr = `  return (
    <div className={\`space-y-8 pb-12`;

const returnStartIndex = content.indexOf(targetStr);
if (returnStartIndex !== -1) {
    const replacement = `  const state: ReportState = {
    editableReport,
    generating,
    showGolden,
    showHighlights,
    quizState,
    quizResult,
    readOnly,
    orderedMatches,
    isGrammarResolved
  };

  const actions: ActionsType = {
    updateField,
    updateNestedField,
    updateArrayItem,
    addArrayItem,
    removeArrayItem,
    handleAIAdd,
    setShowGolden,
    setShowHighlights,
    setQuizState,
    setQuizResult,
    handleOpenPreview,
    handleClosePreview,
    handleQuizAnswer,
    renderParagraphs,
    renderWithHighlights,
    onReset
  };

  return (
    <div className={\`space-y-8 pb-12 print:pb-0 print:space-y-6 print:w-full \${readOnly ? 'animate-in fade-in duration-500' : ''}\`}>
      <ReportHeader state={state} actions={actions} t={t} lang={lang} />
      <TranscriptSection state={state} actions={actions} t={t} lang={lang} />
      <GradeSection state={state} actions={actions} t={t} lang={lang} />
      <DetailedAnalysis state={state} actions={actions} t={t} lang={lang} />
      <EnhancementSection state={state} actions={actions} t={t} lang={lang} />
      <WordBankSection state={state} actions={actions} t={t} lang={lang} />
      <QuizSection state={state} actions={actions} t={t} lang={lang} />
      <TeacherNoteSection state={state} actions={actions} t={t} lang={lang} />
      <ReportActions state={state} actions={actions} t={t} lang={lang} />
    </div>
  );
};

export default ReportDisplay;
`;
    content = content.substring(0, returnStartIndex) + replacement;
    fs.writeFileSync(file, content);
    console.log("Patch applied successfully");
} else {
    console.log("Could not find the target string!");
}

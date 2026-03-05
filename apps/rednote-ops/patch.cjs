const fs = require('fs');
const file = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/academy-ops/src/components/ContentGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace( // find line 10
    "import { applyLogoToImage, LogoPosition, LogoSize } from '../utils/imageProcessor';",
    "import { applyLogoToImage, LogoPosition, LogoSize } from '../utils/imageProcessor';\nimport { InputSection, ImageSettings, ResourceImages, ContentOutput, SaveCalendarModal, ContentGeneratorState, ContentGeneratorActions } from './content-generator';"
);

// 2. Remove BANNED_WORDS
const bannedWordsRegex = /\/\/ Xiaohongshu banned.*?\];/s;
content = content.replace(bannedWordsRegex, "");

// 3. Replace the return block
const returnStartIndex = content.indexOf(`  return (`);
if (returnStartIndex !== -1) {
    const replacement = `  const state: ContentGeneratorState = {
    topic, style, isGenerating, generatedContent, copiedField, editingNoteId,
    showCustomPrompt, customPrompt,
    showSaveModal, publishDate, calendarMonth,
    previewMode, selectedFramework, contentHistory,
    imageCount, imageStyle, imageState, addLogoIndices, logoSize, logoPosition,
    brandData, currentPlan, savedNotes, PROMPT_FRAMEWORKS
  };

  const actions: ContentGeneratorActions = {
    setTopic, setStyle, setIsGenerating, setGeneratedContent, setCopiedField, setEditingNoteId,
    setShowCustomPrompt, setCustomPrompt, setShowSaveModal, setPublishDate, setCalendarMonth,
    setPreviewMode, setSelectedFramework, setContentHistory, setImageCount, setImageStyle,
    setIsGeneratingImages, setGeneratedImages, setEditablePrompts, setGeneratingImageIndices, setIsRefreshingResource,
    setAddLogoIndices, setLogoSize, setLogoPosition,
    handleQuickSelect, handleSaveToCalendar, handleGenerate, handleGenerateCustom,
    handleGenerateImages, handleGenerateSingleImage, handleRefreshResourceImage, copyToClipboard,
    handlePrevMonth, handleNextMonth, isDateOccupied, getFirstDayOfMonth, getDaysInMonth
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 relative pb-20">
      {/* Left Column: Input */}
      <div className="space-y-8">
        <InputSection state={state} actions={actions} />
        <ImageSettings state={state} actions={actions} />
        <ResourceImages state={state} actions={actions} />
      </div>

      {/* Right Column: Output */}
      <div className="space-y-6">
        <ContentOutput state={state} actions={actions} />
      </div>

      <SaveCalendarModal state={state} actions={actions} />
    </div>
  );
}
`;
    content = content.substring(0, returnStartIndex) + replacement;
}

fs.writeFileSync(file, content);
console.log("Patch applied successfully");

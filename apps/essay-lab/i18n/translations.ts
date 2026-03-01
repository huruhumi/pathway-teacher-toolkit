export const translations = {
    // Nav tabs
    'nav.home': { en: 'Correction', zh: '批改' },
    'nav.about': { en: 'Essays', zh: '范文' },
    'nav.resources': { en: 'Records', zh: '记录' },

    // Hero / Input page
    'hero.title': { en: 'Better Writing Starts with a', zh: '提升写作，从一份' },
    'hero.titleHighlight': { en: 'Thorough Review', zh: '精细批改' },
    'hero.titleEnd': { en: '', zh: '开始' },
    'hero.desc': { en: 'Upload a photo of your handwritten essay or paste the text — our ESL expert will provide a thorough, targeted evaluation.', zh: '上传你的手写作文照片或粘贴原文，ESL 专家将提供针对性的深度评估。' },
    'input.grade': { en: 'Student Grade (K-12)', zh: '学生年级 (K-12)' },
    'input.cefr': { en: 'Target CEFR Level', zh: '目标 CEFR 等级' },
    'input.prompt': { en: 'Essay Prompt', zh: '作文命题 (Prompt)' },
    'input.uploadImage': { en: 'Upload Image', zh: '上传图片' },
    'input.changeImage': { en: 'Change Image', zh: '更改图片' },
    'input.promptPlaceholder': { en: 'Enter the prompt or paste the topic...', zh: '输入命题内容或粘贴题目...' },
    'input.essay': { en: 'Student Essay', zh: '学生作文 (Essay)' },
    'input.takePhoto': { en: 'Upload Photo', zh: '拍照上传' },
    'input.changePhoto': { en: 'Change Photo', zh: '更改手写图片' },
    'input.essayPlaceholder': { en: 'Paste essay text here...', zh: '在此粘贴作文文本...' },
    'input.submit': { en: 'Start Expert Correction', zh: '开始专家级批改' },
    'input.noContent': { en: 'Please upload or enter essay content first', zh: '请先上传或输入作文内容' },
    'input.error': { en: 'Analysis failed. Please check your network and try again.', zh: '分析失败，请检查网络或重新上传。' },

    // Loading messages
    'loading.title': { en: 'AI Expert is Reviewing...', zh: 'AI 专家正在深度审阅' },
    'loading.1': { en: 'Starting analysis engine...', zh: '正在启动分析引擎...' },
    'loading.2': { en: 'Scanning document structure...', zh: '正在扫描文档结构...' },
    'loading.3': { en: 'Comparing prompt and essay content...', zh: '对比命题与作文内容...' },
    'loading.4': { en: 'Evaluating relevance...', zh: '正在评估切题程度...' },
    'loading.5': { en: 'Generating vocabulary and expressions...', zh: '生成主题词库与表达扩展...' },
    'loading.6': { en: 'Detecting Chinglish patterns...', zh: '查找中式英语痕迹...' },
    'loading.7': { en: 'Formatting report...', zh: '排版生成精美报告...' },

    // Footer
    'footer': { en: '© 2024 English Essay Lab. Professional. Deep. Student-Centric.', zh: '© 2024 English Essay Lab. 专业、深度、懂中国学生。' },

    // Report Display
    'report.title': { en: 'Correction Report', zh: '批改报告' },
    'report.titleAccent': { en: 'Report', zh: 'Report' },
    'report.subtitle': { en: 'Essay Lab In-depth Assessment & Smart Heuristic Editing', zh: 'Essay Lab 深度评估 & 智能启发式编辑' },
    'report.docTitle': { en: 'Essay Lab - Essay Correction', zh: 'Essay Lab - 英语作文批改' },
    'report.overallGrade': { en: 'Overall Grade', zh: 'Overall Grade' },
    'report.aiFailed': { en: 'AI generation failed. Please try again.', zh: 'AI 生成条目失败，请重试' },

    // Original Text section
    'report.goldenVersion': { en: 'Golden Version', zh: '高分范文 (Golden Version)' },
    'report.originalText': { en: 'Original Text', zh: '原文转录 (Original Text)' },
    'report.highlightsOn': { en: 'Errors Highlighted', zh: '已高亮错误' },
    'report.highlightsOff': { en: 'Show Corrections', zh: '显示纠错' },
    'report.viewOriginal': { en: 'View Original', zh: '查看原文' },
    'report.viewGolden': { en: 'View Golden', zh: '查看范文' },

    // Grade Report
    'report.gradeReport': { en: 'Grade Report', zh: '成绩单 (Grade Report)' },
    'report.dimension': { en: 'Dimension', zh: '评估维度' },
    'report.grade': { en: 'Grade', zh: '等级' },
    'report.comment': { en: 'Key Comment', zh: '关键评语' },

    // Sentence Variety
    'report.sentenceVariety': { en: 'Sentence Variety Analysis', zh: '句式多样性分析' },
    'report.simple': { en: 'Simple', zh: '简单句 (Simple)' },
    'report.compound': { en: 'Compound', zh: '并列句 (Compound)' },
    'report.complex': { en: 'Complex', zh: '复合句 (Complex)' },
    'report.defaultAdvice': { en: 'Consider using more relative clauses and participial phrases.', zh: '建议增加定语从句和分词状语的使用。' },

    // Detailed Analysis
    'report.detailedAnalysis': { en: 'Detailed Analysis', zh: '细节诊断 (Detailed Analysis)' },
    'report.mechanics': { en: 'Mechanics', zh: '规范专栏' },
    'report.collocation': { en: 'Collocation Issues', zh: '搭配禁忌 (Collocation)' },
    'report.grammarSummary': { en: 'Grammar Diagnosis Summary', zh: '语法诊断汇总' },
    'report.grammarSummaryDesc': { en: (n: string) => `Found ${n} optimizable point(s). See original text sidebar above.`, zh: (n: string) => `共发现 ${n} 处可优化点，详见上方原文侧边栏。` } as any,

    // Language Enhancement
    'report.enhancement': { en: 'Language Enhancement', zh: '语言升级计划 (Language Enhancement)' },
    'report.wordBank': { en: 'Word Bank', zh: '主题词库 (Word Bank)' },
    'report.expressions': { en: 'Expressions', zh: '地道表达 (Expressions)' },
    'report.practice': { en: 'Practice Exercises', zh: '举一反三·即刻练习 (Practice)' },
    'report.explanation': { en: 'Explanation:', zh: '解析：' },

    // Teacher's Note
    'report.teacherNote': { en: "Teacher's Note", zh: '教师寄语 (Teacher\'s Note)' },
    'report.chineseComment': { en: 'Chinese Comment', zh: '中文点评' },

    // Action buttons
    'report.backToEdit': { en: 'Back to Edit', zh: '返回编辑' },
    'report.startOver': { en: 'Start Over', zh: '重新开始' },
    'report.reportView': { en: 'Report View', zh: '报告视图' },
    'report.saveConfirm': { en: 'Changes saved!\\nThis report has been synced to local analysis log.', zh: '修改已保存！\\n该报告已同步至本地分析日志。' },
    'report.finalize': { en: 'Finalize Report', zh: '确认并结项' },

    // Records page
    'records.title': { en: 'Correction Records', zh: '批改记录' },
    'records.empty': { en: 'No correction records yet. Submit an essay for correction to get started!', zh: '暂无批改记录。提交一篇作文开始批改吧！' },
    'records.delete': { en: 'Delete', zh: '删除' },
    'records.deleteConfirm': { en: 'Delete this record?', zh: '确定删除此记录？' },
    'records.viewReport': { en: 'View Report', zh: '查看报告' },
    'records.back': { en: 'Back to Records', zh: '返回记录列表' },
    'records.grade': { en: 'Grade', zh: '评分' },
    'records.filterAll': { en: 'All', zh: '全部' },

    // Essays page
    'essays.title': { en: 'Essay Library', zh: '范文库' },
    'essays.empty': { en: 'No essays yet. Generate a model essay or submit a correction to build your library!', zh: '暂无范文。生成一篇范文或提交批改来积累你的范文库！' },
    'essays.generate': { en: 'Generate Model Essay', zh: '生成范文' },
    'essays.generating': { en: 'Generating...', zh: '正在生成...' },
    'essays.topic': { en: 'Essay Topic', zh: '作文命题' },
    'essays.topicPlaceholder': { en: 'e.g., My Favorite Holiday', zh: '例如：My Favorite Holiday' },
    'essays.genre': { en: 'Genre', zh: '体裁' },
    'essays.targetWords': { en: 'Target Words', zh: '目标字数' },
    'essays.fromCorrection': { en: 'From Correction', zh: '批改提取' },
    'essays.aiGenerated': { en: 'AI Generated', zh: 'AI 生成' },
    'essays.highlights': { en: 'Highlight Sentences', zh: '亮点句' },
    'essays.vocabulary': { en: 'Key Vocabulary', zh: '核心词汇' },
    'essays.structure': { en: 'Structure Analysis', zh: '结构分析' },
    'essays.teacherTip': { en: 'Teaching Tip', zh: '教学提示' },
    'essays.words': { en: 'words', zh: '词' },
    'essays.copy': { en: 'Copy', zh: '复制' },
    'essays.copied': { en: 'Copied!', zh: '已复制！' },
    'essays.regenerate': { en: 'Regenerate', zh: '重新生成' },
    'essays.favorite': { en: 'Favorite', zh: '收藏' },
    'essays.delete': { en: 'Delete', zh: '删除' },
    'essays.collapse': { en: 'Collapse', zh: '收起' },
    'essays.expand': { en: 'Expand', zh: '展开' },

    // Genre labels
    'genre.narrative': { en: 'Narrative', zh: '记叙文' },
    'genre.argumentative': { en: 'Argumentative', zh: '议论文' },
    'genre.expository': { en: 'Expository', zh: '说明文' },
    'genre.practical': { en: 'Practical', zh: '应用文' },
    'genre.picture': { en: 'Picture-based', zh: '看图写话' },
} as const;

export type TranslationKey = keyof typeof translations;

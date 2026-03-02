

export enum CEFRLevel {
  Beginner = 'Beginner',
  PreA1 = 'Pre-A1',
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
  TOEFL_IELTS = 'TOEFL/IELTS'
}

export interface Flashcard {
  word: string;
  definition: string;
  visualPrompt: string;
  type: 'vocabulary' | 'concept';
}

export interface Game {
  name: string;
  type: string;
  interactionType: string;
  instructions: string;
  materials: string[];
  isCompleted?: boolean;
}

export interface Slide {
  title: string;
  content: string;
  visual: string;
  layoutDesign: string;
}

export interface ReadingTask {
  text: string;
  text_cn: string;
  isCompleted: boolean;
}

export interface WebResource {
  title: string;
  title_cn: string;
  url: string;
  description: string;
  description_cn: string;
}

export interface ReadingPlanDay {
  day: number;
  focus: string;
  focus_cn: string;
  activity: string;
  activity_cn: string;
  tasks?: ReadingTask[];
  resources?: WebResource[];
  trivia?: { en: string; cn: string };
}

export interface ReadingCompanionContent {
  days: ReadingPlanDay[];
  webResources: WebResource[];
}

export interface LessonStage {
  stage: string;
  stageAim: string;
  timing: string;
  interaction: string;
  teacherActivity: string;
  studentActivity: string;
}

export interface StructuredLessonPlan {
  classInformation: {
    level: string;
    topic: string;
    students: string;
    date: string;
  };
  lessonDetails: {
    type: string;
    aim: string;
    objectives: string[];
    materials: string[];
    targetVocab: { word: string; definition: string }[];
    grammarSentences: string[];
    anticipatedProblems: { problem: string; solution: string }[];
  };
  stages: LessonStage[];
}

export interface WorksheetItem {
  question: string;
  answer: string;
  options?: string[]; // For multiple choice
  visualPrompt?: string;
  imageUrl?: string;
  wordCount?: number; // Word count requirement for writing tasks
}

export interface WorksheetSection {
  title: string;
  description?: string;
  passageTitle?: string;
  passage?: string;
  layout?: 'standard' | 'matching' | 'grid' | 'multiple-choice' | 'essay' | 'error-correction'; // Layout hints
  items: WorksheetItem[];
}

export interface Worksheet {
  title: string;
  type: string;
  instructions: string;
  sections?: WorksheetSection[];
  items?: WorksheetItem[];
}

export interface PhonicsContent {
  keyPoints: string[];
  decodableTexts: string[];
  decodableTextPrompts: string[];
}

export interface GeneratedContent {
  lessonPlanMarkdown: string;
  structuredLessonPlan: StructuredLessonPlan;
  slides: Slide[];
  flashcards: Flashcard[];
  games: Game[];
  readingCompanion: ReadingCompanionContent;
  notebookLMPrompt: string;
  summary: {
    objectives: string;
    targetVocab: string[];
    grammarPoints: string[];
  };
  worksheets?: Worksheet[];
  grammarInfographicUrl?: string;
  blackboardImageUrl?: string;
  phonics?: PhonicsContent;
  flashcardImages?: Record<number, string>;
  decodableTextImages?: Record<number, string>;
}

export interface SavedLesson {
  id: string;
  timestamp: number;
  lastModified: number;
  topic: string;
  level: string;
  description?: string;
  content: GeneratedContent;
}

export interface AppState {
  isLoading: boolean;
  generatedContent: GeneratedContent | null;
  error: string | null;
}

// --- Curriculum Types ---

export interface CurriculumLesson {
  lessonNumber: number;
  title: string;
  topic: string;
  description: string;
  objectives: string[];
  suggestedVocabulary: string[];
  grammarFocus: string;
  suggestedActivities: string[];
  textbookReference: string;
}

export interface ESLCurriculum {
  textbookTitle: string;
  overview: string;
  totalLessons: number;
  targetLevel: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumParams {
  lessonCount: number;
  level: CEFRLevel;
  duration: string;
  studentCount: string;
  slideCount: number;
  customInstructions: string;
}

export interface SavedCurriculum {
  id: string;
  timestamp: number;
  lastModified: number;
  textbookTitle: string;
  targetLevel: string;
  totalLessons: number;
  description?: string;
  curriculum: ESLCurriculum;
  params: CurriculumParams;
}
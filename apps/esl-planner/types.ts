
import { CEFRLevel } from '@shared/types';
export { CEFRLevel };
import type { GroundingStatus, QualityGate } from '@shared/types/quality';
import type { ScoreReport } from '@shared/types/scoring';

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
  linkedStage?: string;
  /** True for filler activities extracted from stages */
  isFiller?: boolean;
  /** Index of the stage this activity belongs to */
  stageIndex?: number;
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
  isCompleted?: boolean;
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
  teachingTips?: string[];
  backgroundKnowledge?: string[];
  fillerActivity?: string;
  suggestedGameName?: string;
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
  layout?: 'standard' | 'matching' | 'grid' | 'multiple-choice' | 'essay' | 'error-correction' | 'tracing'; // Layout hints
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
  /** @deprecated Old format – present in stored lessons created before v2 */
  decodableText?: string;
}

export interface SentenceCitation {
  section: string;
  sentence: string;
  sourceIds: string[];
  sourceTitles: string[];
  sourceUrls?: string[];
}

// --- Assignment Sheet (课后作业单) ---

export interface AssignmentItem {
  title: string;
  description: string;
  isFixed?: boolean;
}

export interface FeedbackRating {
  dimension: string;
  dimension_en: string;
  score: number; // 0-5, 0 = unrated
}

export interface ClassroomFeedback {
  ratings: FeedbackRating[];
  overallComment: string;
}

export interface AssignmentSheet {
  studentName: string;
  lessonSummary: string;
  keyPoints: string[];
  assignments: AssignmentItem[];
  feedback: ClassroomFeedback;
  showComment: boolean;
}

/**
 * Context preserved from Phase 1 for use in Phase 2 supporting content generation.
 * Stored in _generationContext so Phase 2 has access to original generation parameters.
 */
export interface GenerationContext {
  level: CEFRLevel;
  topic: string;
  lessonTitle: string;
  ageGroup?: string;
  duration: string;
  studentCount: string;
  slideCount: number;
  factSheet?: string;
  validUrls?: string[];
  textbookLevelKey?: string;
  assessmentPackPrompt?: string;
  sourceMode: 'direct' | 'notebook';
}

export interface GeneratedContent {
  lessonPlanMarkdown: string;
  structuredLessonPlan: StructuredLessonPlan;
  ageGroup?: string;
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
  gameImageUrls?: Record<number, string>;
  textbookLevelKey?: string;
  assessmentPackId?: string;
  knowledgeNotebookId?: string;
  groundingStatus?: GroundingStatus;
  qualityGate?: QualityGate;
  scoreReport?: ScoreReport;
  groundingSources?: Array<{
    id?: string;
    title?: string;
    url?: string;
    status?: string;
    type?: string;
  }>;
  groundingCoverage?: Array<{
    section: string;
    evidenceType: 'strict_fact_sheet' | 'assisted' | 'synthesized';
    note: string;
  }>;
  sentenceCitations?: SentenceCitation[];
  assignmentSheet?: AssignmentSheet;
  /** Tracks which generation phase this content is in. Defaults to 'complete' for old records. */
  generationPhase?: 'plan_only' | 'complete';
  /** Preserved context from Phase 1 for Phase 2 generation */
  _generationContext?: GenerationContext;
  /** Original user-provided prompt text from the input stage */
  inputPrompt?: string;
}

export interface SavedLesson {
  id: string;
  timestamp: number;
  lastModified: number;
  topic: string;
  level: string;
  description?: string;
  content: GeneratedContent;
  /** Links kit to its source curriculum */
  curriculumId?: string;
  /** Unit number from CurriculumLesson */
  unitNumber?: number;
  /** Index in curriculum.lessons[] */
  lessonIndex?: number;
}

export interface AppState {
  isLoading: boolean;
  generatedContent: GeneratedContent | null;
  error: string | null;
}

// --- Curriculum Types ---

export interface CurriculumLesson {
  lessonNumber: number;
  unitNumber?: number;
  lessonInUnit?: number;
  lessonType?: string;
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
  seriesName?: string;
  overview: string;
  totalLessons: number;
  targetLevel: string;
  lessons: CurriculumLesson[];
  sentenceCitations?: SentenceCitation[];
  assignmentSheet?: AssignmentSheet;
}

export interface CurriculumParams {
  lessonCount: number;
  level: CEFRLevel;
  duration: string;
  studentCount: string;
  ageGroup?: string;
  slideCount: number;
  customInstructions: string;
  textbookLevelKey?: string;
  sourceMode?: 'notebook' | 'direct';
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

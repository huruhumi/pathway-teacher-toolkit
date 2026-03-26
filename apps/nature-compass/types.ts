import { UploadedFile } from '@shared/types';
export type { UploadedFile };

// --- Handbook Section Types ---

export type HandbookSectionType =
  | 'Cover'
  | 'Table of Contents'
  | 'Safety'
  | 'Prop Checklist'
  | 'Phase Transition'
  | 'Background Knowledge'
  | 'Activity/Worksheet'
  | 'Reflection'
  | 'Certificate'
  | 'Back Cover';

export interface HandbookPageConfig {
  section: HandbookSectionType;
  count: number;
  enabled: boolean;
}

export interface HandbookPhasePageConfigItem {
  phaseIndex: number;
  backgroundKnowledge: number;
  activityWorksheet: number;
  reading: number;
  phaseTransition: number;
}

export interface HandbookPhasePagePlan {
  /** Total handbook pages user explicitly wants (including fixed system pages). */
  totalPages: number;
  /** Adjustable system page counts (fixed pages are implied separately). */
  systemPages: {
    tableOfContents: number;
    safety: number;
    propChecklist: number;
    reflection: number;
  };
  /** Explicit per-phase page allocation, no averaging/default equal split. */
  phasePages: HandbookPhasePageConfigItem[];
}

export interface SectionMeta {
  type: HandbookSectionType;
  label: string;
  labelEn: string;
  icon: string;
  min: number;
  max: number;
  default: number;
  required?: boolean;
}

export interface LessonInput {
  mode: 'school' | 'family';
  familyEslEnabled?: boolean;
  theme: string;
  topicIntroduction: string;
  activityFocus: string[];
  weather: 'Sunny' | 'Rainy';
  season: string;
  studentAge: string;
  studentCount: number;
  duration: number;
  cefrLevel: string;
  handbookMode: 'auto' | 'preset' | 'custom' | 'structured';
  handbookPreset: 'light' | 'standard' | 'full' | 'deep';
  handbookPageConfig: HandbookPageConfig[];
  autoPageTarget?: number;
  handbookPhasePagePlan?: HandbookPhasePagePlan;
  uploadedFiles: UploadedFile[];
  /** Grounded fact sheet for lesson generation (optional). */
  factSheet?: string;
  /** Quality indicator from fact sheet evaluation. */
  factSheetQuality?: 'good' | 'low' | 'insufficient';
  /** Source references used to build the fact sheet. */
  factSheetSources?: FactSheetSource[];
  /** Freshness/risk metadata for the fact sheet grounding process. */
  factSheetMeta?: FactSheetFreshnessMeta;
  /** User-defined page-by-page handbook outline (structured mode) */
  customStructure?: string;
  /** Researched knowledge for structured mode */
  structuredKnowledge?: StructuredKnowledge[];
  /** Selected handbook illustration style ID (e.g. 'realistic', 'kawaii', 'watercolor') */
  handbookStyleId?: string;
}

/** Snapshot of LessonInput fields needed to reconstruct handbookRules in Phase 2 */
export interface InputSnapshot {
  mode: 'school' | 'family';
  familyEslEnabled?: boolean;
  weather: 'Sunny' | 'Rainy';
  studentAge: string;
  cefrLevel: string;
  duration: number;
  handbookMode: 'auto' | 'preset' | 'custom' | 'structured';
  handbookPreset: 'light' | 'standard' | 'full' | 'deep';
  handbookPageConfig: HandbookPageConfig[];
  autoPageTarget?: number;
  handbookPhasePagePlan?: HandbookPhasePagePlan;
  factSheet?: string;
  factSheetQuality?: 'good' | 'low' | 'insufficient';
  factSheetSources?: FactSheetSource[];
  factSheetMeta?: FactSheetFreshnessMeta;
  handbookStyleId?: string;
  customStructure?: string;
  structuredKnowledge?: StructuredKnowledge[];
}

export interface FactSheetSource {
  title: string;
  url: string;
  publishedAt: string | null;
}

export type ThemeFreshnessTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type FreshnessWindow = '1y' | '3y' | '5y';
export type FreshnessRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FactSheetFreshnessMeta {
  themeTier: ThemeFreshnessTier;
  targetWindow: '1y';
  effectiveWindow: FreshnessWindow;
  riskLevel: FreshnessRiskLevel;
  /** 0..1 ratio of sources that meet current effective window. */
  coverage: number;
  /** Optional audit notes about grounding policy/runtime decisions. */
  degradeNotes?: string[];
}

export interface FactSheetResult {
  content: string;
  quality: 'good' | 'low' | 'insufficient';
  sources: FactSheetSource[];
  freshnessMeta: FactSheetFreshnessMeta;
}

export interface StructuredKnowledge {
  topic: string;
  content: string;
  sources?: string[];
  sourceDetails?: FactSheetSource[];
  freshnessMeta?: FactSheetFreshnessMeta;
}

export interface VocabularyItem {
  word: string;
  definition: string;
}

export interface RoadmapItem {
  timeRange: string;
  phase: string;
  activity: string;
  activityType: string;
  location: string;
  description: string;
  learningObjective: string;
  steps: string[];
  backgroundInfo: string[];
  teachingTips: string[];
  /** Student-facing activity instructions: what to do, how to do it, materials, time */
  activityInstructions?: string;
}

export interface SupplyList {
  permanent: string[];
  consumables: string[];
}

export interface VisualReferenceItem {
  label: string;
  description: string;
  type: string;
}

export interface HandbookPage {
  pageNumber: number;
  title: string;
  section: 'Introduction' | 'Cover' | 'Table of Contents' | 'Safety' | 'Prop Checklist' | 'Phase Transition' | 'Background Knowledge' | 'Reading' | 'Instructions' | 'Activity/Worksheet' | 'Reflection' | 'Certificate' | 'Back Cover';
  layoutDescription: string;
  visualPrompt: string;
  contentPrompt: string;
  /** Teacher-facing content: teaching scripts, guided questions, differentiation tips, time controls */
  teacherContentPrompt?: string;
  /** Index into roadmap array — binds this page to a specific phase. Undefined for system pages (Cover, ToC, etc.) */
  phaseIndex?: number;
}

export interface LessonPlanResponse {
  missionBriefing: {
    title: string;
    narrative: string;
  };
  basicInfo: {
    theme: string;
    activityType: string;
    targetAudience: string;
    location: string;
    learningGoals: string[];
  };
  vocabulary: {
    keywords: VocabularyItem[];
    phrases: string[];
  };
  roadmap: RoadmapItem[];
  supplies: SupplyList;
  safetyProtocol: string[];
  visualReferences: VisualReferenceItem[];
  handbookStylePrompt: string;
  handbookStructurePlan?: string;
  handbook: HandbookPage[];
  notebookLMPrompt: string;
  imagePrompts: string[];
  translatedPlan?: any;
  /** RAG knowledge base / fact sheet used to ground this lesson */
  factSheet?: string;
  /** Source references used for fact sheet grounding. */
  factSheetSources?: FactSheetSource[];
  /** Freshness/risk metadata for the grounded fact sheet. */
  factSheetMeta?: FactSheetFreshnessMeta;
  /** Structured knowledge entries (topic + content + sources) for cache matching */
  structuredKnowledge?: StructuredKnowledge[];
  /** Two-stage generation phase marker */
  generationPhase?: 'roadmap_only' | 'complete';
  /** Snapshot of original LessonInput for Phase 2 / Commit reconstruction */
  _inputSnapshot?: InputSnapshot;
}

export interface SavedLessonPlan {
  id: string;
  timestamp: number;
  name: string;
  description?: string;
  plan: LessonPlanResponse;
  coverImage?: string; // Optional badge image for projects
  language?: 'en' | 'zh';
  mode?: 'school' | 'family';
  generationPhase?: 'roadmap_only' | 'complete';
}

// --- Curriculum Planning Types (from STEAM Designer) ---

export interface CurriculumLesson {
  title: string;
  description: string;
  steam_focus: string;
  esl_focus: string;
  location: string;
  outdoor_activity: string;
  indoor_alternative: string;
  english_vocabulary: string[];
}

export interface Curriculum {
  theme: string;
  overview: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumParams {
  mode?: 'school' | 'family';
  familyEslEnabled?: boolean;
  city: string;
  ageGroup: string;
  englishLevel: string;
  lessonCount: number;
  duration: string;
  preferredLocation: string;
  customTheme: string;
  customDescription?: string;
  weather?: 'Sunny' | 'Rainy';
}

export interface SavedCurriculum {
  id: string;
  timestamp: number;
  name: string;
  description?: string;
  curriculum: Curriculum;
  params: CurriculumParams;
  language: 'en' | 'zh';
}

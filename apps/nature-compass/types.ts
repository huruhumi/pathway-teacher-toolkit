import { UploadedFile } from '@shared/types';
export type { UploadedFile };

// --- Handbook Section Types ---

export type HandbookSectionType =
  | 'Cover'
  | 'Table of Contents'
  | 'Safety'
  | 'Prop Checklist'
  | 'Background Knowledge'
  | 'Activity/Worksheet'
  | 'Reading'
  | 'Reflection'
  | 'Certificate'
  | 'Back Cover';

export interface HandbookPageConfig {
  section: HandbookSectionType;
  count: number;
  enabled: boolean;
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
  handbookMode: 'auto' | 'preset' | 'custom';
  handbookPreset: 'light' | 'standard' | 'full' | 'deep';
  handbookPageConfig: HandbookPageConfig[];
  autoPageTarget?: number;
  uploadedFiles: UploadedFile[];
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
  section: 'Introduction' | 'Cover' | 'Table of Contents' | 'Safety' | 'Prop Checklist' | 'Background Knowledge' | 'Reading' | 'Instructions' | 'Activity/Worksheet' | 'Reflection' | 'Certificate' | 'Back Cover';
  layoutDescription: string;
  visualPrompt: string;
  contentPrompt: string;
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
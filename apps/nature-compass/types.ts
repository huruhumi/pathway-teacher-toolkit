
export interface UploadedFile {
  name: string;
  type: string;
  data: string; // Base64 string without prefix
}

export interface LessonInput {
  theme: string;
  topicIntroduction: string; // New field for context/narrative
  activityFocus: string[];
  weather: 'Sunny' | 'Rainy';
  season: string;
  studentAge: string;
  studentCount: number;
  duration: number; // in minutes
  cefrLevel: string;
  handbookPages: number;
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
  activityType: string; // e.g. "Science", "Art", "Game"
  location: string; // New field: e.g. "Classroom Rug", "School Garden"
  description: string;
  learningObjective: string;
  steps: string[]; // Detailed breakdown
  backgroundInfo: string[]; // Background knowledge
  teachingTips: string[]; // Specific teaching methodology tips
}

export interface SupplyList {
  permanent: string[];
  consumables: string[];
}

export interface VisualReferenceItem {
  label: string;
  description: string;
  type: string; // e.g. "Diagram", "Photo", "Illustration"
}

export interface HandbookPage {
  pageNumber: number;
  title: string;
  section: 'Introduction' | 'Safety' | 'Background Knowledge' | 'Reading' | 'Instructions' | 'Activity/Worksheet' | 'Certificate';
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
    learningGoals: string[];
  };
  vocabulary: {
    keywords: VocabularyItem[];
    phrases: string[];
  };
  roadmap: RoadmapItem[];
  supplies: SupplyList;
  safetyProtocol: string[]; // Changed to array for better formatting
  visualReferences: VisualReferenceItem[];
  handbookStylePrompt: string; // Global style guide for handbook generation
  handbook: HandbookPage[]; // New structured handbook
  notebookLMPrompt: string; // Kept for backward compatibility/summary
  imagePrompts: string[];
  translatedPlan?: any; // Bundled Chinese translation of the plan
}

export interface SavedLessonPlan {
  id: string;
  timestamp: number;
  name: string;
  plan: LessonPlanResponse;
  coverImage?: string; // Optional badge image for projects
  language?: 'en' | 'zh';
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
  curriculum: Curriculum;
  params: CurriculumParams;
  language: 'en' | 'zh';
}
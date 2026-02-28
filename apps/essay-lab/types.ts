
export enum Grade {
  APLUS = 'A+',
  A = 'A',
  AMINUS = 'A-',
  BPLUS = 'B+',
  B = 'B',
  BMINUS = 'B-',
  CPLUS = 'C+',
  C = 'C',
  CMINUS = 'C-',
  F = 'F'
}

export enum StudentGrade {
  G1 = '一年级 (Grade 1)',
  G2 = '二年级 (Grade 2)',
  G3 = '三年级 (Grade 3)',
  G4 = '四年级 (Grade 4)',
  G5 = '五年级 (Grade 5)',
  G6 = '六年级 (Grade 6)',
  G7 = '七年级 (Grade 7)',
  G8 = '八年级 (Grade 8)',
  G9 = '九年级 (Grade 9)',
  G10 = '高一 (Grade 10)',
  G11 = '高二 (Grade 11)',
  G12 = '高三 (Grade 12)'
}

export enum CEFRLevel {
  A1 = 'A1 (Beginner)',
  A2 = 'A2 (Elementary)',
  B1 = 'B1 (Intermediate)',
  B2 = 'B2 (Upper Intermediate)',
  C1 = 'C1 (Advanced)',
  C2 = 'C2 (Proficiency)'
}

export interface GradeItem {
  dimension: string;
  grade: Grade;
  comment: string;
}

export interface GrammarError {
  original: string;
  refined: string;
  explanation: string;
  type?: string; // e.g., "Tense", "Chinglish"
}

export interface LanguageLevel {
  original: string; // Level 1 (Basic)
  level2: string;   // Level 2 (Improved)
  level3: string;   // Level 3 (Advanced)
}

export interface IdiomSuggestion {
  expression: string;
  originalContext: string;
  meaning: string;
  usage: string;
}

export interface VocabularyUpgrade {
  basicWord: string;
  suggestion: string;
  exampleSentence: string;
}

export interface WordBankItem {
  word: string;
  meaning: string;
  example: string;
}

export interface TopicExtension {
  expression: string;
  meaning: string;
  usage: string;
}

export interface SentenceVariety {
  simple: number; // percentage 0-100
  compound: number;
  complex: number;
  advice: string;
}

export interface CollocationError {
  original: string;
  suggestion: string;
  explanation: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface CorrectionReport {
  originalText: string;
  topicText?: string;
  goldenVersion: string; // New: Full native rewrite
  grades: GradeItem[];
  overallGrade: Grade;
  approximateCEFR: string;
  approximateCEQ: string;
  mechanicsAnalysis: string;
  grammarErrors: GrammarError[];
  collocationErrors: CollocationError[]; // New: Collocation check
  sentenceVariety: SentenceVariety; // New: Sentence stats
  languageEnhancement: LanguageLevel[];
  idiomSuggestions: IdiomSuggestion[];
  vocabularyUpgrades: VocabularyUpgrade[];
  wordBank: WordBankItem[];
  topicExtensions: TopicExtension[];
  errorQuiz: QuizItem[]; // New: Personalized quiz
  teacherNote: {
    zh: string;
    en: string;
  };
}

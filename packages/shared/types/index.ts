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

export interface UploadedFile {
    name: string;
    type: string;
    data: string; // Base64 string without prefix
}

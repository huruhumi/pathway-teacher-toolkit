// ── Core Education Types ──
// Shared between edu-hub and student-portal

export interface EduClass {
    id: string;
    teacher_id: string;
    name: string;
    description?: string;
    max_students: number;
    created_at: string;
}

export interface EduClassWithCount extends EduClass {
    student_count: number;
}

export interface Student {
    id: string;
    teacher_id: string;
    name: string;
    english_name?: string;
    auth_user_id?: string;
    invite_code?: string;
    avatar_url?: string;
    contact_info?: string;
    notes?: string;
    // Extended profile fields
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    level?: string;
    enrolled_at?: string;
    status?: 'active' | 'paused' | 'graduated' | 'withdrawn';
    parent_name?: string;
    parent_wechat?: string;
    parent_phone?: string;
    health_notes?: string;
    learning_notes?: string;
    proficiency?: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
    interests?: string[];
    created_at: string;
}

export interface ClassStudent {
    class_id: string;
    student_id: string;
}

export interface ClassSession {
    id: string;
    teacher_id: string;
    class_id: string;
    date: string;         // YYYY-MM-DD
    start_time?: string;  // HH:mm
    end_time?: string;
    topic?: string;
    lesson_kit_id?: string;
    source_app?: string;
    notes?: string;
    created_at: string;
}

export interface Attendance {
    session_id: string;
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'leave';
}

export interface Assignment {
    id: string;
    teacher_id: string;
    class_id: string;
    title: string;
    description?: string;
    content_type: 'worksheet' | 'companion' | 'custom' | 'assignment_sheet' | 'essay';
    content_data?: any;
    source_app?: string;
    source_lesson_id?: string;
    due_date?: string;
    created_at: string;
}

export interface Submission {
    id: string;
    assignment_id: string;
    student_id: string;
    status: 'pending' | 'submitted' | 'completed' | 'returned' | 'incomplete';
    content?: any;
    submitted_at?: string;
    completed_at?: string;
    teacher_notes?: string;
    score?: number;
    points_earned?: number;
}

export interface BookLoan {
    id: string;
    teacher_id: string;
    student_id: string;
    book_title: string;
    isbn?: string;
    borrowed_at: string;
    due_date?: string;
    returned_at?: string;
    notes?: string;
}

export interface ReadingLog {
    id: string;
    student_id: string;
    teacher_id: string;
    book_title: string;
    duration_minutes: number;
    pages_read: number;
    notes?: string;
    status: 'pending' | 'reviewed';
    created_at: string;
}

// Joined types for UI display
export interface StudentWithClasses extends Student {
    classes: EduClass[];
}

export interface AssignmentWithSubmissions extends Assignment {
    submissions: Submission[];
    class_name?: string;
}

export interface StudentSubmissionView extends Submission {
    assignment_title: string;
    assignment_due_date?: string;
}

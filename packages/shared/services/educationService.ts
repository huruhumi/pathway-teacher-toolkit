/**
 * Education Service — Supabase CRUD for education management
 * Shared between edu-hub (teacher) and student-portal (student)
 */
import { supabase, isSupabaseEnabled } from './supabaseClient';
import type {
    EduClass, Student, ClassStudent, ClassSession,
    Attendance, Assignment, Submission, BookLoan,
} from '../types/education';

// ── Helper ──
function ensureSupabase() {
    if (!isSupabaseEnabled() || !supabase) throw new Error('Supabase not configured');
    return supabase;
}

// ====== CLASSES ======

export async function fetchClasses(teacherId: string): Promise<EduClass[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('classes').select('*').eq('teacher_id', teacherId).order('created_at');
    if (error) { console.error('[edu] fetchClasses:', error.message); return []; }
    return data ?? [];
}

export async function upsertClass(cls: Partial<EduClass> & { teacher_id: string }): Promise<EduClass | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('classes').upsert(cls, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertClass:', error.message); return null; }
    return data;
}

export async function deleteClass(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('classes').delete().eq('id', id);
    if (error) console.error('[edu] deleteClass:', error.message);
}

// ====== STUDENTS ======

export async function fetchStudents(teacherId: string): Promise<Student[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('students').select('*').eq('teacher_id', teacherId).order('created_at');
    if (error) { console.error('[edu] fetchStudents:', error.message); return []; }
    return data ?? [];
}

export async function upsertStudent(student: Partial<Student> & { teacher_id: string }): Promise<Student | null> {
    const sb = ensureSupabase();
    const payload = { ...student };
    // Auto-generate a random 6-character invite code for new students
    if (!payload.id && !payload.invite_code) {
        payload.invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    // Try with invite_code first; if column doesn't exist yet, retry without it
    let { data, error } = await sb.from('students').upsert(payload, { onConflict: 'id' }).select().single();
    if (error && error.message?.includes('invite_code')) {
        console.warn('[edu] invite_code column not found, retrying without it');
        const { invite_code, ...payloadWithout } = payload;
        ({ data, error } = await sb.from('students').upsert(payloadWithout, { onConflict: 'id' }).select().single());
    }
    if (error) { console.error('[edu] upsertStudent:', error.message); return null; }
    return data;
}

export async function fetchStudentProfile(authUserId: string): Promise<Student | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('students').select('*').eq('auth_user_id', authUserId).single();
    if (error) { console.error('[edu] fetchStudentProfile:', error.message); return null; }
    return data;
}

export async function deleteStudent(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('students').delete().eq('id', id);
    if (error) console.error('[edu] deleteStudent:', error.message);
}

// ====== CLASS ↔ STUDENTS ======

export async function fetchClassStudents(classId: string): Promise<ClassStudent[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('class_students').select('*').eq('class_id', classId);
    if (error) { console.error('[edu] fetchClassStudents:', error.message); return []; }
    return data ?? [];
}

export async function setClassStudents(classId: string, studentIds: string[]): Promise<void> {
    const sb = ensureSupabase();
    // Remove old, insert new
    await sb.from('class_students').delete().eq('class_id', classId);
    if (studentIds.length > 0) {
        const rows = studentIds.map(sid => ({ class_id: classId, student_id: sid }));
        const { error } = await sb.from('class_students').insert(rows);
        if (error) console.error('[edu] setClassStudents:', error.message);
    }
}

// ====== CLASS SESSIONS ======

export async function fetchSessions(teacherId: string, dateFrom?: string, dateTo?: string): Promise<ClassSession[]> {
    const sb = ensureSupabase();
    let q = sb.from('class_sessions').select('*').eq('teacher_id', teacherId);
    if (dateFrom) q = q.gte('date', dateFrom);
    if (dateTo) q = q.lte('date', dateTo);
    const { data, error } = await q.order('date').order('start_time');
    if (error) { console.error('[edu] fetchSessions:', error.message); return []; }
    return data ?? [];
}

export async function upsertSession(session: Partial<ClassSession> & { teacher_id: string }): Promise<ClassSession | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('class_sessions').upsert(session, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertSession:', error.message); return null; }
    return data;
}

export async function deleteSession(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('class_sessions').delete().eq('id', id);
    if (error) console.error('[edu] deleteSession:', error.message);
}

// ====== ATTENDANCE ======

export async function fetchAttendance(sessionId: string): Promise<Attendance[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('attendance').select('*').eq('session_id', sessionId);
    if (error) { console.error('[edu] fetchAttendance:', error.message); return []; }
    return data ?? [];
}

export async function upsertAttendance(records: Attendance[]): Promise<void> {
    if (records.length === 0) return;
    const sb = ensureSupabase();
    const { error } = await sb.from('attendance').upsert(records, { onConflict: 'session_id,student_id' });
    if (error) console.error('[edu] upsertAttendance:', error.message);
}

// ====== ASSIGNMENTS ======

export async function fetchAssignments(teacherId: string): Promise<Assignment[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('assignments').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchAssignments:', error.message); return []; }
    return data ?? [];
}

export async function fetchStudentAssignments(studentId: string): Promise<(Assignment & { submission?: Submission })[]> {
    const sb = ensureSupabase();
    // Get submissions for this student, then get the assignments
    const { data: subs, error: subErr } = await sb.from('submissions').select('*, assignment:assignments(*)').eq('student_id', studentId);
    if (subErr) { console.error('[edu] fetchStudentAssignments:', subErr.message); return []; }
    return (subs ?? []).map((s: any) => ({
        ...s.assignment,
        submission: { id: s.id, assignment_id: s.assignment_id, student_id: s.student_id, status: s.status, content: s.content, submitted_at: s.submitted_at, completed_at: s.completed_at, teacher_notes: s.teacher_notes, score: s.score },
    }));
}

export async function upsertAssignment(assignment: Partial<Assignment> & { teacher_id: string }): Promise<Assignment | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('assignments').upsert(assignment, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertAssignment:', error.message); return null; }
    return data;
}

export async function deleteAssignment(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('assignments').delete().eq('id', id);
    if (error) console.error('[edu] deleteAssignment:', error.message);
}

// ====== SUBMISSIONS ======

export async function fetchSubmissions(assignmentId: string): Promise<Submission[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('submissions').select('*').eq('assignment_id', assignmentId);
    if (error) { console.error('[edu] fetchSubmissions:', error.message); return []; }
    return data ?? [];
}

export async function upsertSubmission(sub: Partial<Submission>): Promise<Submission | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('submissions').upsert(sub, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertSubmission:', error.message); return null; }
    return data;
}

export async function createSubmissionsForClass(assignmentId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    const sb = ensureSupabase();
    const rows = studentIds.map(sid => ({
        assignment_id: assignmentId,
        student_id: sid,
        status: 'pending',
    }));
    const { error } = await sb.from('submissions').insert(rows);
    if (error) console.error('[edu] createSubmissionsForClass:', error.message);
}

// ====== BOOK LOANS ======

export async function fetchBookLoans(teacherId: string): Promise<BookLoan[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('book_loans').select('*').eq('teacher_id', teacherId).order('borrowed_at', { ascending: false });
    if (error) { console.error('[edu] fetchBookLoans:', error.message); return []; }
    return data ?? [];
}

export async function upsertBookLoan(loan: Partial<BookLoan> & { teacher_id: string }): Promise<BookLoan | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('book_loans').upsert(loan, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertBookLoan:', error.message); return null; }
    return data;
}

export async function returnBook(loanId: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('book_loans').update({ returned_at: new Date().toISOString().split('T')[0] }).eq('id', loanId);
    if (error) console.error('[edu] returnBook:', error.message);
}

export async function deleteBookLoan(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('book_loans').delete().eq('id', id);
    if (error) console.error('[edu] deleteBookLoan:', error.message);
}

// ====== READING LOGS ======

export async function fetchReadingLogsByTeacher(teacherId: string): Promise<any[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('reading_logs').select('*, student:students(*)').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchReadingLogsByTeacher:', error.message); return []; }
    return data ?? [];
}

export async function fetchReadingLogsByStudent(studentId: string): Promise<any[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('reading_logs').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchReadingLogsByStudent:', error.message); return []; }
    return data ?? [];
}

export async function upsertReadingLog(log: any): Promise<any | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('reading_logs').upsert(log, { onConflict: 'id' }).select().single();
    if (error) { console.error('[edu] upsertReadingLog:', error.message); return null; }
    return data;
}

export async function deleteReadingLog(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('reading_logs').delete().eq('id', id);
    if (error) console.error('[edu] deleteReadingLog:', error.message);
}

// ====== STUDENT SCHEDULE ======
export type ClassSessionWithClass = ClassSession & { class: { name: string } | null };

export async function fetchStudentSessions(studentId: string): Promise<ClassSessionWithClass[]> {
    const sb = ensureSupabase();
    const { data: cs } = await sb.from('class_students').select('class_id').eq('student_id', studentId);
    if (!cs?.length) return [];
    const classIds = cs.map((c: any) => c.class_id);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb.from('class_sessions')
        .select('*, class:classes(name)')
        .in('class_id', classIds)
        .gte('date', today)
        .order('date')
        .order('start_time');
    if (error) { console.error('[edu] fetchStudentSessions:', error.message); return []; }
    return (data ?? []) as ClassSessionWithClass[];
}

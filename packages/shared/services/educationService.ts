/**
 * Education Service — Supabase CRUD for education management
 * Shared between edu-hub (teacher) and student-portal (student)
 */
import { supabase, isSupabaseEnabled } from './supabaseClient';
import type {
    EduClass, EduClassWithCount, Student, ClassStudent, ClassSession,
    Attendance, Assignment, Submission, BookLoan, ReadingLog,
    StudentSubmissionView,
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
    const { id, ...rest } = cls as any;
    const { data, error } = id
        ? await sb.from('classes').update(rest).eq('id', id).select().single()
        : await sb.from('classes').insert(rest).select().single();
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
    if (!payload.id && !payload.invite_code) {
        payload.invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    const { id, ...rest } = payload as any;
    let { data, error } = id
        ? await sb.from('students').update(rest).eq('id', id).select().single()
        : await sb.from('students').insert(rest).select().single();
    if (error && error.message?.includes('invite_code')) {
        console.warn('[edu] invite_code column not found, retrying without it');
        const { invite_code, ...restWithout } = rest;
        ({ data, error } = id
            ? await sb.from('students').update(restWithout).eq('id', id).select().single()
            : await sb.from('students').insert(restWithout).select().single());
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
    const { id, ...rest } = session as any;
    const { data, error } = id
        ? await sb.from('class_sessions').update(rest).eq('id', id).select().single()
        : await sb.from('class_sessions').insert(rest).select().single();
    if (error) { console.error('[edu] upsertSession:', error.message); return null; }
    return data;
}

export async function upsertSessions(sessions: Array<Partial<ClassSession> & { teacher_id: string }>): Promise<ClassSession[] | null> {
    const sb = ensureSupabase();
    // Bulk insert does not easily support upsert with mixed ids.
    // For our use case (bulk adding future schedules), we only do mass inserts.
    const { data, error } = await sb.from('class_sessions').insert(sessions).select();
    if (error) { console.error('[edu] upsertSessions:', error.message); return null; }
    return data ?? [];
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

export async function fetchAssignmentById(assignmentId: string): Promise<Assignment | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('assignments').select('*').eq('id', assignmentId).single();
    if (error) { console.error('[edu] fetchAssignmentById:', error.message); return null; }
    return data;
}

export async function fetchSubmissionById(submissionId: string): Promise<Submission | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('submissions').select('*').eq('id', submissionId).single();
    if (error) { console.error('[edu] fetchSubmissionById:', error.message); return null; }
    return data;
}

export async function fetchStudentAssignmentsViaRPC(studentId: string): Promise<(Assignment & { submission?: Submission })[]> {
    const sb = ensureSupabase();
    // Call our new RPC to bypass RLS and fetch all assignments linked via submissions
    const { data: assignments, error: rpcErr } = await sb.rpc('get_student_assignments', { p_student_id: studentId });
    if (rpcErr) { console.error('[edu] fetchStudentAssignmentsViaRPC (assignments):', rpcErr.message); return []; }
    if (!assignments || assignments.length === 0) return [];

    // Fetch the actual submissions to attach to them
    const assignmentIds = assignments.map((a: any) => a.id);
    const { data: subs, error: subErr } = await sb.from('submissions')
        .select('*')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds);

    if (subErr) { console.error('[edu] fetchStudentAssignmentsViaRPC (subs):', subErr.message); return []; }

    return assignments.map((a: any) => {
        const match = (subs ?? []).find(s => s.assignment_id === a.id);
        return {
            ...a,
            submission: match
        };
    });
}

export async function upsertAssignment(assignment: Partial<Assignment> & { teacher_id: string }): Promise<Assignment | null> {
    const sb = ensureSupabase();
    const { id, ...rest } = assignment as any;
    const { data, error } = id
        ? await sb.from('assignments').update(rest).eq('id', id).select().single()
        : await sb.from('assignments').insert(rest).select().single();
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

export async function fetchTeacherSubmissions(teacherId: string): Promise<Submission[]> {
    const sb = ensureSupabase();
    // Use an inner join to get submissions for assignments owned by the teacher
    const { data, error } = await sb.from('submissions')
        .select('*, assignments!inner(teacher_id)')
        .eq('assignments.teacher_id', teacherId);
    if (error) { console.error('[edu] fetchTeacherSubmissions:', error.message); return []; }
    return data ?? [];
}

export async function upsertSubmission(sub: Partial<Submission>): Promise<Submission | null> {
    const sb = ensureSupabase();
    const { id, ...rest } = sub as any;
    const { data, error } = id
        ? await sb.from('submissions').update(rest).eq('id', id).select().single()
        : await sb.from('submissions').insert(rest).select().single();
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
    const { error } = await sb.from('submissions').upsert(rows, { onConflict: 'assignment_id,student_id', ignoreDuplicates: true });
    if (error) console.error('[edu] createSubmissionsForClass:', error.message);
}

export async function awardPoints(submissionId: string, pointsToAdd: number): Promise<boolean> {
    const sb = ensureSupabase();
    const { error } = await sb.rpc('edu_award_points', { sub_id: submissionId, points_to_add: pointsToAdd });
    if (error) { console.error('[edu] awardPoints:', error.message); return false; }
    return true;
}

export async function markExpiredIncomplete(assignmentId: string): Promise<boolean> {
    const sb = ensureSupabase();
    const { error } = await sb.from('submissions')
        .update({ status: 'incomplete' })
        .eq('assignment_id', assignmentId)
        .eq('status', 'pending');
    if (error) { console.error('[edu] markExpiredIncomplete:', error.message); return false; }
    return true;
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
    const { id, ...rest } = loan as any;
    const { data, error } = id
        ? await sb.from('book_loans').update(rest).eq('id', id).select().single()
        : await sb.from('book_loans').insert(rest).select().single();
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
    const { id, ...rest } = log;
    const { data, error } = id
        ? await sb.from('reading_logs').update(rest).eq('id', id).select().single()
        : await sb.from('reading_logs').insert(rest).select().single();
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

// ====== ENRICHED QUERIES ======

export async function fetchClassesWithCount(teacherId: string): Promise<EduClassWithCount[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('classes').select('*, class_students(count)').eq('teacher_id', teacherId).order('created_at');
    if (error) { console.error('[edu] fetchClassesWithCount:', error.message); return []; }
    return (data ?? []).map((c: any) => ({
        ...c,
        student_count: c.class_students?.[0]?.count ?? 0,
        class_students: undefined,
    }));
}

export async function fetchClassStudentsWithDetails(classId: string): Promise<Student[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('class_students').select('student:students(*)').eq('class_id', classId);
    if (error) { console.error('[edu] fetchClassStudentsWithDetails:', error.message); return []; }
    return (data ?? []).map((row: any) => row.student).filter(Boolean);
}

export async function fetchStudentSubmissions(studentId: string): Promise<StudentSubmissionView[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('submissions').select('*, assignment:assignments(title, due_date)').eq('student_id', studentId).order('submitted_at', { ascending: false });
    if (error) { console.error('[edu] fetchStudentSubmissions:', error.message); return []; }
    return (data ?? []).map((s: any) => ({
        ...s,
        assignment_title: s.assignment?.title ?? '',
        assignment_due_date: s.assignment?.due_date,
        assignment: undefined,
    }));
}

export async function fetchStudentBookLoans(studentId: string): Promise<BookLoan[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('book_loans').select('*').eq('student_id', studentId).order('borrowed_at', { ascending: false });
    if (error) { console.error('[edu] fetchStudentBookLoans:', error.message); return []; }
    return data ?? [];
}

export async function fetchStudentReadingLogs(studentId: string): Promise<ReadingLog[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('reading_logs').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchStudentReadingLogs:', error.message); return []; }
    return data ?? [];
}

// ====== MAKEUP REQUESTS (Phase 5) ======

export interface MakeupRequest {
    id: string;
    student_id: string;
    teacher_id: string;
    original_session_id: string;
    status: 'pending' | 'resolved';
    resolved_session_id?: string | null;
    created_at: string;
}

export async function fetchMakeupRequests(teacherId: string): Promise<MakeupRequest[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('makeup_requests').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchMakeupRequests:', error.message); return []; }
    return data ?? [];
}

export async function createMakeupRequest(req: { student_id: string; teacher_id: string; original_session_id: string }): Promise<MakeupRequest | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('makeup_requests').insert(req).select().single();
    if (error) { console.error('[edu] createMakeupRequest:', error.message); return null; }
    return data;
}

export async function resolveMakeupRequest(id: string, resolvedSessionId?: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('makeup_requests').update({ status: 'resolved', resolved_session_id: resolvedSessionId || null }).eq('id', id);
    if (error) console.error('[edu] resolveMakeupRequest:', error.message);
}

// ====== TOKEN ECONOMY (Phase 6) ======

export interface TokenEvent {
    id: string;
    student_id: string;
    source_type: 'attendance' | 'submission' | 'bonus' | 'redemption';
    source_id: string;
    delta: number;
    created_at: string;
}

export interface Reward {
    id: string;
    teacher_id: string;
    name: string;
    description?: string;
    cost_tokens: number;
    max_stock?: number | null;
    max_per_student_per_month?: number | null;
    image_url?: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Redemption {
    id: string;
    student_id: string;
    reward_id: string;
    teacher_id: string;
    tokens_spent: number;
    created_at: string;
}

/** Get total token balance for a student (Floor = 0) */
export async function getTokenBalance(studentId: string): Promise<number> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('token_events').select('delta').eq('student_id', studentId);
    if (error) { console.error('[edu] getTokenBalance:', error.message); return 0; }
    const raw = (data ?? []).reduce((sum: number, r: any) => sum + (r.delta || 0), 0);
    return Math.max(0, raw); // Floor = 0, never negative
}

/** Idempotent: insert a token event, ON CONFLICT does nothing */
export async function upsertTokenEvent(evt: { student_id: string; source_type: string; source_id: string; delta: number }): Promise<TokenEvent | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('token_events')
        .upsert(evt, { onConflict: 'student_id,source_type,source_id', ignoreDuplicates: true })
        .select().single();
    if (error && !error.message?.includes('duplicate')) { console.error('[edu] upsertTokenEvent:', error.message); return null; }
    return data;
}

/** Fetch token event history for a student (for the ledger view) */
export async function fetchTokenHistory(studentId: string): Promise<TokenEvent[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('token_events').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchTokenHistory:', error.message); return []; }
    return data ?? [];
}

// ── Rewards CRUD ──

export async function fetchRewards(teacherId: string): Promise<Reward[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('rewards').select('*').eq('teacher_id', teacherId).order('created_at');
    if (error) { console.error('[edu] fetchRewards:', error.message); return []; }
    return data ?? [];
}

export async function fetchActiveRewards(): Promise<Reward[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('rewards').select('*').eq('is_active', true).order('cost_tokens');
    if (error) { console.error('[edu] fetchActiveRewards:', error.message); return []; }
    return data ?? [];
}

export async function upsertReward(reward: Partial<Reward> & { teacher_id: string }): Promise<Reward | null> {
    const sb = ensureSupabase();
    const { id, ...rest } = reward as any;
    const { data, error } = id
        ? await sb.from('rewards').update(rest).eq('id', id).select().single()
        : await sb.from('rewards').insert(rest).select().single();
    if (error) { console.error('[edu] upsertReward:', error.message); return null; }
    return data;
}

export async function deleteReward(id: string): Promise<void> {
    const sb = ensureSupabase();
    const { error } = await sb.from('rewards').delete().eq('id', id);
    if (error) console.error('[edu] deleteReward:', error.message);
}

// ── Redemptions ──

export async function fetchStudentRedemptions(studentId: string): Promise<Redemption[]> {
    const sb = ensureSupabase();
    const { data, error } = await sb.from('redemptions').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) { console.error('[edu] fetchStudentRedemptions:', error.message); return []; }
    return data ?? [];
}

/** Create a redemption: checks balance, monthly limit, then deducts tokens */
export async function redeemReward(studentId: string, reward: Reward, teacherId: string): Promise<{ success: boolean; message: string }> {
    // 1. Check balance
    const balance = await getTokenBalance(studentId);
    if (balance < reward.cost_tokens) return { success: false, message: '积分不足' };

    // 2. Check monthly limit
    if (reward.max_per_student_per_month) {
        const sb = ensureSupabase();
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: monthRedemptions } = await sb.from('redemptions')
            .select('id')
            .eq('student_id', studentId)
            .eq('reward_id', reward.id)
            .gte('created_at', startOfMonth.toISOString());
        if ((monthRedemptions?.length ?? 0) >= reward.max_per_student_per_month) {
            return { success: false, message: '本月兑换次数已达上限' };
        }
    }

    // 3. Create redemption record and deduct tokens
    const sb = ensureSupabase();
    const { error: redErr } = await sb.from('redemptions').insert({
        student_id: studentId, reward_id: reward.id, teacher_id: teacherId, tokens_spent: reward.cost_tokens,
    });
    if (redErr) return { success: false, message: redErr.message };

    // 4. Create negative token event for the redemption
    await upsertTokenEvent({
        student_id: studentId,
        source_type: 'redemption',
        source_id: `redemption_${reward.id}_${Date.now()}`,
        delta: -reward.cost_tokens,
    });

    return { success: true, message: '兑换成功！' };
}

// ====== STUDENT DIAGNOSTICS (Phase 7) ======

export interface StudentDiagnostics {
    studentId: string;
    isReady: boolean;          // true if data maturity thresholds met
    submissionCount: number;
    attendanceCount: number;
    dimensions: {
        label: string;
        value: number;         // 0-100 scale
        fullMark: number;
    }[];
    summary: {
        attendanceRate: number;     // 0-100
        completionRate: number;     // 0-100
        averageScore: number;       // 0-5 scale
        punctualityRate: number;    // 0-100 (submitted before due date)
        tokenBalance: number;
    };
}

/** Aggregate all learning data for a student into radar chart dimensions */
export async function getStudentDiagnostics(studentId: string, teacherId: string): Promise<StudentDiagnostics> {
    const sb = ensureSupabase();

    // 1. Fetch attendance records for this student
    const { data: attData } = await sb.from('attendance')
        .select('status, session_id')
        .eq('student_id', studentId);
    const attendance = attData ?? [];

    // 2. Fetch submissions for this student
    const { data: subData } = await sb.from('submissions')
        .select('status, score, submitted_at, assignment:assignments(due_date)')
        .eq('student_id', studentId);
    const submissions = subData ?? [];

    // 3. Get token balance
    const tokenBalance = await getTokenBalance(studentId);

    // Data maturity check
    const submissionCount = submissions.length;
    const attendanceCount = attendance.length;
    const isReady = submissionCount >= 10 && attendanceCount >= 15;

    // Calculate dimensions
    const totalAtt = attendance.length || 1;
    const presentCount = attendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = Math.round((presentCount / totalAtt) * 100);

    const totalSub = submissions.length || 1;
    const completedSub = submissions.filter((s: any) => s.status === 'completed' || s.status === 'submitted').length;
    const completionRate = Math.round((completedSub / totalSub) * 100);

    const scoredSubs = submissions.filter((s: any) => s.score != null && s.score > 0);
    const avgScore = scoredSubs.length > 0
        ? scoredSubs.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scoredSubs.length
        : 0;
    const avgScoreNormalized = Math.round((avgScore / 5) * 100);

    // Punctuality (submitted before or on due date)
    const subsWithDue = submissions.filter((s: any) => s.submitted_at && s.assignment?.due_date);
    const onTimeSubs = subsWithDue.filter((s: any) => s.submitted_at <= s.assignment.due_date + 'T23:59:59');
    const punctualityRate = subsWithDue.length > 0 ? Math.round((onTimeSubs.length / subsWithDue.length) * 100) : 100;

    // Engagement = token balance normalized (cap at 500 for 100%)
    const engagementScore = Math.min(100, Math.round((tokenBalance / 500) * 100));

    return {
        studentId,
        isReady,
        submissionCount,
        attendanceCount,
        dimensions: [
            { label: '出勤率', value: attendanceRate, fullMark: 100 },
            { label: '完成率', value: completionRate, fullMark: 100 },
            { label: '成绩', value: avgScoreNormalized, fullMark: 100 },
            { label: '守时', value: punctualityRate, fullMark: 100 },
            { label: '参与度', value: engagementScore, fullMark: 100 },
        ],
        summary: {
            attendanceRate,
            completionRate,
            averageScore: Math.round(avgScore * 10) / 10,
            punctualityRate,
            tokenBalance,
        },
    };
}

// ====== STUDENT SELF-SERVICE AUTH ======

/**
 * Look up a student by invite code to verify identity before activation.
 * Returns the student's display name so we can show a welcome message.
 */
export async function lookupStudentByInviteCode(
    inviteCode: string,
): Promise<{ id: string; name: string; is_activated: boolean } | null> {
    const sb = ensureSupabase();
    const { data, error } = await sb
        .from('students')
        .select('id, name, auth_user_id, username')
        .eq('invite_code', inviteCode.toUpperCase().trim())
        .single();
    if (error || !data) return null;
    return {
        id: data.id,
        name: data.name,
        is_activated: !!data.auth_user_id,
    };
}

/**
 * First-time account activation.
 * Creates a Supabase Auth user, then links it to the student record.
 * username is required; email is optional (can be added later).
 */
export async function activateStudentAccount(opts: {
    inviteCode: string;
    username: string;
    password: string;
    email?: string;
}): Promise<{ success: boolean; error?: string }> {
    const sb = ensureSupabase();

    // 1. Verify invite code and check not already activated
    const student = await lookupStudentByInviteCode(opts.inviteCode);
    if (!student) return { success: false, error: 'invite_code_invalid' };
    if (student.is_activated) return { success: false, error: 'already_activated' };

    // 2. Check username uniqueness
    const { data: existing } = await sb
        .from('students')
        .select('id')
        .eq('username', opts.username.toLowerCase().trim())
        .single();
    if (existing) return { success: false, error: 'username_taken' };

    // 3. Build internal email: username@pathway.internal (or use real email if provided)
    const authEmail = opts.email?.trim() ||
        `${opts.username.toLowerCase().trim()}@pathway.internal`;

    // 4. Create Supabase Auth user
    const { data: authData, error: signUpErr } = await sb.auth.signUp({
        email: authEmail,
        password: opts.password,
    });
    if (signUpErr || !authData.user) {
        return { success: false, error: signUpErr?.message || 'signup_failed' };
    }

    // 5. Link auth_user_id back to students table
    const { error: updateErr } = await sb
        .from('students')
        .update({
            auth_user_id: authData.user.id,
            username: opts.username.toLowerCase().trim(),
            ...(opts.email ? { email: opts.email.trim().toLowerCase() } : {}),
        })
        .eq('id', student.id);

    if (updateErr) {
        console.error('[edu] activateStudentAccount update:', updateErr.message);
        return { success: false, error: 'link_failed' };
    }

    return { success: true };
}

/**
 * Login with username or email + password.
 * Auto-detects if input is an email (contains '@') or username.
 */
export async function loginStudent(opts: {
    usernameOrEmail: string;
    password: string;
}): Promise<{ success: boolean; error?: string }> {
    const sb = ensureSupabase();
    const input = opts.usernameOrEmail.trim().toLowerCase();
    const isEmail = input.includes('@') && !input.endsWith('@pathway.internal');

    let authEmail: string;

    if (isEmail) {
        // Direct email login
        authEmail = input;
    } else {
        // Username → resolve to internal email
        const { data: student } = await sb
            .from('students')
            .select('username')
            .eq('username', input)
            .single();
        if (!student) return { success: false, error: 'user_not_found' };
        authEmail = `${input}@pathway.internal`;
    }

    const { error } = await sb.auth.signInWithPassword({
        email: authEmail,
        password: opts.password,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

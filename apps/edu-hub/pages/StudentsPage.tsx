import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import StudentRadarCard from '../components/StudentRadarCard';
import { useToast } from '@shared/stores/useToast';
import * as edu from '@pathway/education';
import type { Student, EduClass, StudentSubmissionView, BookLoan, ReadingLog } from '@pathway/education';
import {
    Plus, Search, Edit3, Trash2, X, Loader2, Users, RotateCcw,
    User, ClipboardList, Library, BookOpen,
    Link as LinkIcon, Copy, BarChart3,
} from 'lucide-react';
import { TeacherSubmissionViewer } from '../components/TeacherSubmissionViewer';

const AVATAR_COLORS = ['bg-amber-500', 'bg-teal-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-orange-500'];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    active: { label: '在读', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    paused: { label: '暂停', cls: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
    graduated: { label: '毕业', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    withdrawn: { label: '退出', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/* ── Student 360 Detail Panel ─────────────────────────── */
type DetailTab = 'info' | 'assignments' | 'books' | 'reading' | 'diagnostics';

const Student360Panel: React.FC<{ student: Student; classes: EduClass[]; studentClassIds: string[]; lang: string }> = ({ student, classes, studentClassIds, lang }) => {
    const [tab, setTab] = useState<DetailTab>('info');
    const [submissions, setSubmissions] = useState<StudentSubmissionView[]>([]);
    const [loans, setLoans] = useState<BookLoan[]>([]);
    const [logs, setLogs] = useState<ReadingLog[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (tab === 'assignments' && submissions.length === 0) {
            setLoadingData(true);
            edu.fetchStudentSubmissions(student.id).then(d => { setSubmissions(d); setLoadingData(false); });
        } else if (tab === 'books' && loans.length === 0) {
            setLoadingData(true);
            edu.fetchStudentBookLoans(student.id).then(d => { setLoans(d); setLoadingData(false); });
        } else if (tab === 'reading' && logs.length === 0) {
            setLoadingData(true);
            edu.fetchStudentReadingLogs(student.id).then(d => { setLogs(d); setLoadingData(false); });
        }
    }, [tab, student.id]);

    const tabs = [
        { key: 'info' as DetailTab, label: lang === 'zh' ? '基本信息' : 'Info', icon: <User size={13} /> },
        { key: 'assignments' as DetailTab, label: lang === 'zh' ? '作业' : 'Assignments', icon: <ClipboardList size={13} />, count: submissions.length },
        { key: 'books' as DetailTab, label: lang === 'zh' ? '借书' : 'Books', icon: <Library size={13} />, count: loans.length },
        { key: 'reading' as DetailTab, label: lang === 'zh' ? '阅读日志' : 'Reading', icon: <BookOpen size={13} />, count: logs.length },
        { key: 'diagnostics' as DetailTab, label: lang === 'zh' ? '学情诊断' : 'Diagnostics', icon: <BarChart3 size={13} /> },
    ];

    const copyFormLink = () => {
        const url = `${window.location.origin}/edu-hub/parent-form?code=${student.invite_code}`;
        navigator.clipboard.writeText(url);
        toast.success(lang === 'zh' ? '链接已复制' : 'Link copied');
    };

    const studentClasses = classes.filter(c => studentClassIds.includes(c.id));

    const [viewingAssignment, setViewingAssignment] = useState<{ a: edu.Assignment, sub: edu.Submission } | null>(null);

    const handleSubmissionClick = async (s: StudentSubmissionView) => {
        const a = await edu.fetchAssignmentById(s.assignment_id);
        const sub = await edu.fetchSubmissionById(s.id);
        if (a && sub) {
            setViewingAssignment({ a, sub });
        } else {
            toast.error('Failed to load full assignment details.');
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50" onClick={e => e.stopPropagation()}>
            {/* Tab bar */}
            <div className="flex gap-0.5 mb-3 overflow-x-auto" onClick={e => e.stopPropagation()}>
                {tabs.map(t => (
                    <button key={t.key} onClick={(e) => { e.stopPropagation(); setTab(t.key); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${tab === t.key ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600'
                            }`}>
                        {t.icon} {t.label}{t.count !== undefined && t.count > 0 ? ` (${t.count})` : ''}
                    </button>
                ))}
            </div>

            {loadingData && <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-amber-500" /></div>}

            {/* Info Tab */}
            {tab === 'info' && (
                <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        {student.date_of_birth && <InfoRow label={lang === 'zh' ? '生日' : 'Birthday'} value={student.date_of_birth} />}
                        {student.gender && <InfoRow label={lang === 'zh' ? '性别' : 'Gender'} value={student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '其他'} />}
                        {student.level && <InfoRow label={lang === 'zh' ? '年级' : 'Level'} value={student.level} />}
                        {student.proficiency && <InfoRow label={lang === 'zh' ? '英语水平' : 'Proficiency'} value={student.proficiency} />}
                        {student.enrolled_at && <InfoRow label={lang === 'zh' ? '入学日期' : 'Enrolled'} value={student.enrolled_at} />}
                        {student.parent_name && <InfoRow label={lang === 'zh' ? '家长' : 'Parent'} value={student.parent_name} />}
                        {student.parent_wechat && <InfoRow label="WeChat" value={student.parent_wechat} />}
                        {student.parent_phone && <InfoRow label={lang === 'zh' ? '手机' : 'Phone'} value={student.parent_phone} />}
                    </div>
                    {student.health_notes && <InfoRow label={lang === 'zh' ? '健康信息' : 'Health'} value={student.health_notes} full />}
                    {student.learning_notes && <InfoRow label={lang === 'zh' ? '学习偏好' : 'Learning'} value={student.learning_notes} full />}
                    {student.interests && student.interests.length > 0 && (
                        <div>
                            <span className="text-xs text-slate-400">{lang === 'zh' ? '兴趣' : 'Interests'}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {student.interests.map((tag, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded border border-violet-200">{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {studentClasses.length > 0 && (
                        <div>
                            <span className="text-xs text-slate-400">{lang === 'zh' ? '所属班级' : 'Classes'}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {studentClasses.map(c => (
                                    <span key={c.id} className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded border border-sky-200">{c.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {student.invite_code && (
                        <button onClick={copyFormLink} className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold mt-2">
                            <LinkIcon size={12} /> {lang === 'zh' ? '复制家长信息收集链接' : 'Copy parent form link'}
                        </button>
                    )}
                </div>
            )}

            {/* Assignments Tab */}
            {tab === 'assignments' && !loadingData && (
                <div className="space-y-1.5">
                    {submissions.length === 0 ? <div className="text-xs text-slate-400 py-2">{lang === 'zh' ? '暂无作业' : 'No assignments'}</div> : (
                        submissions.map(s => (
                            <div key={s.id} onClick={() => handleSubmissionClick(s)} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200 border border-transparent transition-colors text-xs cursor-pointer group">
                                <StatusDot status={s.status} />
                                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-amber-600 transition-colors">{s.assignment_title}</span>
                                {s.score != null && <span className="font-bold text-amber-600">{s.score}</span>}
                                {s.assignment_due_date && <span className="text-slate-400">{s.assignment_due_date}</span>}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Books Tab */}
            {tab === 'books' && !loadingData && (
                <div className="space-y-1.5">
                    {loans.length === 0 ? <div className="text-xs text-slate-400 py-2">{lang === 'zh' ? '暂无借阅' : 'No loans'}</div> : (
                        loans.map(l => (
                            <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-xs">
                                <Library size={12} className={l.returned_at ? 'text-emerald-500' : 'text-amber-500'} />
                                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200 truncate">{l.book_title}</span>
                                <span className="text-slate-400">{l.borrowed_at}</span>
                                {l.returned_at ? (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">{lang === 'zh' ? '已还' : 'Returned'}</span>
                                ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">{lang === 'zh' ? '借阅中' : 'Active'}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Reading Logs Tab */}
            {tab === 'reading' && !loadingData && (
                <div className="space-y-1.5">
                    {logs.length === 0 ? <div className="text-xs text-slate-400 py-2">{lang === 'zh' ? '暂无日志' : 'No logs'}</div> : (
                        logs.map(l => (
                            <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-xs">
                                <BookOpen size={12} className={l.status === 'reviewed' ? 'text-emerald-500' : 'text-slate-400'} />
                                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200 truncate">{l.book_title}</span>
                                <span className="text-slate-400">{l.duration_minutes}min</span>
                                <span className="text-slate-400">{l.pages_read}p</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.status === 'reviewed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {l.status === 'reviewed' ? (lang === 'zh' ? '已审' : '✓') : (lang === 'zh' ? '待审' : '⏳')}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {tab === 'diagnostics' && (
                <StudentRadarCard studentId={student.id} studentName={student.name} teacherId={student.teacher_id} />
            )}

            {/* Viewer Modal */}
            {viewingAssignment && (
                <TeacherSubmissionViewer
                    assignment={viewingAssignment.a}
                    submission={viewingAssignment.sub}
                    onClose={() => setViewingAssignment(null)}
                    onSubmissionUpdated={async (updatedSub) => {
                        // Refresh the submissions list summary immediately
                        setSubmissions(prev => prev.map(s => s.id === updatedSub.id ? { ...s, score: updatedSub.score, status: updatedSub.status, teacher_notes: updatedSub.teacher_notes } : s));
                        setViewingAssignment(prev => prev ? { ...prev, sub: updatedSub } : null);
                    }}
                />
            )}
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: string; full?: boolean }> = ({ label, value, full }) => (
    <div className={full ? 'col-span-2' : ''}>
        <span className="text-xs text-slate-400">{label}</span>
        <div className="text-slate-700 dark:text-slate-200">{value}</div>
    </div>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = {
        pending: 'bg-slate-300', submitted: 'bg-blue-400', completed: 'bg-emerald-400', returned: 'bg-amber-400',
    };
    return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-slate-300'}`} />;
};

/* ── Student List (inline sub-view) ─────────────────────────── */
const StudentListView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';
    const toast = useToast();

    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<EduClass[]>([]);
    const [studentClassMap, setStudentClassMap] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', english_name: '', contact_info: '', notes: '', classIds: [] as string[] });

    const [resetModal, setResetModal] = useState<{ id: string, name: string } | null>(null);
    const [newPassword, setNewPassword] = useState('888888');
    const [resetting, setResetting] = useState(false);

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const [stuData, clsData] = await Promise.all([
            edu.fetchStudents(teacherId),
            edu.fetchClasses(teacherId),
        ]);
        setStudents(stuData);
        setClasses(clsData);
        const map: Record<string, string[]> = {};
        for (const cls of clsData) {
            const members = await edu.fetchClassStudents(cls.id);
            for (const m of members) {
                if (!map[m.student_id]) map[m.student_id] = [];
                map[m.student_id].push(cls.id);
            }
        }
        setStudentClassMap(map);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        if (!teacherId) { toast.error('Please sign in first'); return; }
        setSaving(true);
        try {
            const payload: any = { teacher_id: teacherId, name: form.name.trim(), english_name: form.english_name.trim(), contact_info: form.contact_info.trim(), notes: form.notes.trim() };
            if (editingId) payload.id = editingId;
            const res = await edu.upsertStudent(payload);
            if (!res) throw new Error('Failed to save');
            // Sync class memberships
            const sid = res.id;
            const cur = studentClassMap[sid] || [];
            for (const cid of form.classIds.filter(c => !cur.includes(c))) {
                const m = await edu.fetchClassStudents(cid);
                await edu.setClassStudents(cid, [...m.map(x => x.student_id), sid]);
            }
            for (const cid of cur.filter(c => !form.classIds.includes(c))) {
                const m = await edu.fetchClassStudents(cid);
                await edu.setClassStudents(cid, m.map(x => x.student_id).filter(x => x !== sid));
            }
            toast.success(editingId ? 'Updated' : 'Added');
            await load();
            resetForm();
        } catch (err: any) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const resetForm = () => { setForm({ name: '', english_name: '', contact_info: '', notes: '', classIds: [] }); setEditingId(null); setShowForm(false); };

    const handleEdit = (stu: Student) => {
        setForm({ name: stu.name, english_name: stu.english_name || '', contact_info: stu.contact_info || '', notes: stu.notes || '', classIds: studentClassMap[stu.id] || [] });
        setEditingId(stu.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => { await edu.deleteStudent(id); await load(); };

    const handleRegenerateCode = async (id: string) => {
        if (!teacherId || !confirm(lang === 'zh' ? '确定重新生成邀请码？' : 'Regenerate?')) return;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await edu.upsertStudent({ id, teacher_id: teacherId, invite_code: code } as any);
        await load();
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!resetModal || !newPassword.trim() || !teacherId) return;
        setResetting(true);
        const { success, error } = await edu.resetStudentPassword(teacherId, resetModal.id, newPassword.trim());
        setResetting(false);
        if (!success) {
            toast.error(error || 'Reset failed');
        } else {
            toast.success(lang === 'zh' ? `已重置密码为: ${newPassword.trim()}` : `Password reset to: ${newPassword.trim()}`);
            setResetModal(null);
        }
    };

    const handleCopyInvite = (stu: Student) => {
        const url = `${window.location.origin}/student-portal`;
        const text = lang === 'zh'
            ? `你好，这是你的专属学生端登录/激活链接：${url}\n你的邀请码为：${stu.invite_code}`
            : `Hi, here is your portal link: ${url}\nYour invite code is: ${stu.invite_code}`;
        navigator.clipboard.writeText(text);
        toast.success(lang === 'zh' ? '完整文案已复制' : 'Full invite copied');
    };

    const toggleClass = (cid: string) => setForm(f => ({ ...f, classIds: f.classIds.includes(cid) ? f.classIds.filter(x => x !== cid) : [...f.classIds, cid] }));

    const filtered = students.filter(s => s.name.includes(search) || (s.english_name || '').toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-500" size={24} /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative flex-1 sm:flex-initial">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={lang === 'zh' ? '搜索学生姓名/表里...' : 'Search name/phone...'}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700/50 border border-transparent focus:border-violet-500 rounded-lg outline-none"
                        title="Search students"
                    /></div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md whitespace-nowrap">
                    <Plus size={16} /> {t('stu.addStudent')}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? t('common.edit') : t('stu.addStudent')}</h3>
                        <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600" title={t('common.cancel')}><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.name')}</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="张三"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                        <div><label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.englishName')}</label>
                            <input value={form.english_name} onChange={e => setForm({ ...form, english_name: e.target.value })} placeholder="Emma"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                        <div><label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.contact')}</label>
                            <input value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} placeholder="WeChat / Phone"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                        <div><label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.notes')}</label>
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                    </div>

                    {classes.length > 0 && (
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">{lang === 'zh' ? '所属班级' : 'Assign to Class'}</label>
                            <div className="flex flex-wrap gap-2">
                                {classes.map(cls => (
                                    <button key={cls.id} type="button" onClick={() => toggleClass(cls.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.classIds.includes(cls.id) ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-amber-300'
                                            }`}>{cls.name}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm">
                            {saving && <Loader2 size={14} className="animate-spin" />} {t('common.save')}
                        </button>
                    </div>
                </form>
            )}

            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Users size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{search ? `No results for "${search}"` : t('stu.noStudents')}</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((stu, i) => {
                        const isExpanded = expandedId === stu.id;
                        const stuClasses = studentClassMap[stu.id] || [];
                        const statusInfo = STATUS_BADGE[stu.status || 'active'];
                        return (
                            <div key={stu.id} onClick={() => setExpandedId(isExpanded ? null : stu.id)} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all cursor-pointer ${isExpanded ? 'border-amber-300 dark:border-amber-500/50 shadow-lg col-span-1 sm:col-span-2 lg:col-span-3' : 'border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-amber-200 dark:hover:border-amber-500/30'
                                }`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                                        {(stu.english_name?.[0] || stu.name[0]).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{stu.name}</div>
                                        {stu.english_name && <div className="text-xs text-slate-400 truncate">{stu.english_name}</div>}
                                    </div>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusInfo?.cls || ''}`}>
                                        {lang === 'zh' ? statusInfo?.label : (stu.status || 'active')}
                                    </span>
                                    <div className="flex gap-0.5 flex-shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(stu); }} title="Edit" className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50"><Edit3 size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(stu.id); }} title="Delete" className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {/* Class badges */}
                                {stuClasses.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {stuClasses.map(cid => {
                                            const cls = classes.find(c => c.id === cid);
                                            return cls ? <span key={cid} className="text-[10px] font-medium px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded border border-sky-200 dark:border-sky-500/20">{cls.name}</span> : null;
                                        })}
                                    </div>
                                )}

                                {/* Invite code / linked status */}
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                    {stu.auth_user_id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                                ✓ {lang === 'zh' ? '已激活' : 'Active'}
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); setResetModal({ id: stu.id, name: stu.name }); }}
                                                className="text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                {lang === 'zh' ? '重置密码' : 'Reset Password'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 flex-1">
                                            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex-shrink-0">
                                                ⌛ {lang === 'zh' ? '待激活' : 'Pending'}
                                            </span>
                                            <div className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-600 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleCopyInvite(stu); }}
                                                title={lang === 'zh' ? '点击复制完整邀请文案' : 'Copy full invite text'}>
                                                <Copy size={12} /> <span className="truncate max-w-[80px] sm:max-w-none">{stu.invite_code || '------'}</span>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleRegenerateCode(stu.id); }}
                                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-sky-500 flex-shrink-0"
                                                title={lang === 'zh' ? '重新生成邀请码' : 'Regenerate'}>
                                                <RotateCcw size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {stu.contact_info && <div className="text-xs text-slate-400 mt-2 truncate">📱 {stu.contact_info}</div>}

                                {/* Expanded 360 Panel */}
                                {isExpanded && (
                                    <Student360Panel student={stu} classes={classes} studentClassIds={stuClasses} lang={lang} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setResetModal(null)}>
                    <form onSubmit={handleResetPassword} className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white">
                                {lang === 'zh' ? `重置密码 - ${resetModal.name}` : `Reset Password - ${resetModal.name}`}
                            </h3>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {lang === 'zh' ? '设置新密码' : 'New Password'}
                            </label>
                            <input
                                autoFocus
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                            <p className="text-xs text-amber-600 mt-2">
                                {lang === 'zh' ? '重置后请确保将新密码告知学生。' : 'Make sure to share the new password with the student.'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                            <button type="button" onClick={() => setResetModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">
                                {t('common.cancel')}
                            </button>
                            <button type="submit" disabled={resetting || !newPassword.trim()} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                                {resetting && <Loader2 size={14} className="animate-spin" />}
                                {lang === 'zh' ? '确认重置' : 'Confirm'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

/* ── Main Students Page ─────────────────────────── */
const StudentsPage: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('stu.title')}</h2>
            <StudentListView />
        </div>
    );
};

export default StudentsPage;

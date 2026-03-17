import { commonTranslations } from '@pathway/i18n';

export const translations = {
    ...commonTranslations,
    // Nav
    'nav.dashboard': { en: 'Dashboard', zh: '仪表盘' },
    'nav.classes': { en: 'Classes', zh: '班级管理' },
    'nav.students': { en: 'Students', zh: '学生管理' },
    'nav.calendar': { en: 'Calendar', zh: '课时日历' },
    'nav.assignments': { en: 'Assignments', zh: '作业管理' },
    'nav.books': { en: 'Books', zh: '借书记录' },
    'nav.reading': { en: 'Reading', zh: '阅读打卡' },

    // Hero
    'hero.title': { en: 'Education Management Hub', zh: '教务管理中心' },
    'hero.desc': { en: 'Manage classes, students, assignments, attendance, and book lending in one place.', zh: '在一个平台管理班级、学生、作业、出勤和借书记录。' },

    // Dashboard
    'dash.students': { en: 'Total Students', zh: '学生总数' },
    'dash.classes': { en: 'Active Classes', zh: '活跃班级' },
    'dash.sessions': { en: 'Total Sessions', zh: '课时总数' },
    'dash.assignments': { en: 'Assignments', zh: '作业' },
    'dash.books': { en: 'Books Out', zh: '在借图书' },
    'dash.recentActivity': { en: 'Recent Activity', zh: '近期动态' },
    'dash.noActivity': { en: 'No recent activity', zh: '暂无近期动态' },
    'dash.getStarted': { en: 'Add your first class or student to get started!', zh: '添加第一个班级或学生开始使用吧！' },

    // Classes
    'cls.title': { en: 'Class Management', zh: '班级管理' },
    'cls.addClass': { en: 'Add Class', zh: '添加班级' },
    'cls.className': { en: 'Class Name', zh: '班级名称' },
    'cls.description': { en: 'Description', zh: '描述' },
    'cls.maxStudents': { en: 'Max Students', zh: '最大人数' },
    'cls.students': { en: 'students', zh: '名学生' },
    'cls.edit': { en: 'Edit', zh: '编辑' },
    'cls.delete': { en: 'Delete', zh: '删除' },
    'cls.noClasses': { en: 'No classes yet. Create your first class!', zh: '还没有班级，创建您的第一个班级吧！' },
    'cls.save': { en: 'Save', zh: '保存' },
    'cls.cancel': { en: 'Cancel', zh: '取消' },

    // Students
    'stu.title': { en: 'Student Management', zh: '学生管理' },
    'stu.addStudent': { en: 'Add Student', zh: '添加学生' },
    'stu.name': { en: 'Name (Chinese)', zh: '姓名（中文）' },
    'stu.englishName': { en: 'English Name', zh: '英文名' },
    'stu.contact': { en: 'Contact Info', zh: '联系方式' },
    'stu.notes': { en: 'Notes', zh: '备注' },
    'stu.assignClass': { en: 'Assign to Class', zh: '分配班级' },
    'stu.createLogin': { en: 'Create Login', zh: '创建登录' },
    'stu.noStudents': { en: 'No students yet. Add your first student!', zh: '还没有学生，添加第一位学生吧！' },
    'stu.all': { en: 'All', zh: '全部' },
    'stu.search': { en: 'Search students...', zh: '搜索学生...' },

    // Calendar
    'cal.title': { en: 'Class Schedule', zh: '课时日历' },
    'cal.addSession': { en: 'Add Session', zh: '添加课时' },
    'cal.week': { en: 'Week', zh: '周' },
    'cal.month': { en: 'Month', zh: '月' },
    'cal.today': { en: 'Today', zh: '今天' },
    'cal.attendance': { en: 'Attendance', zh: '出勤' },
    'cal.present': { en: 'Present', zh: '出勤' },
    'cal.absent': { en: 'Absent', zh: '缺勤' },
    'cal.late': { en: 'Late', zh: '迟到' },

    // Assignments
    'asg.title': { en: 'Assignment Management', zh: '作业管理' },
    'asg.assign': { en: 'Assign', zh: '布置作业' },
    'asg.assignTitle': { en: 'Title', zh: '标题' },
    'asg.type': { en: 'Type', zh: '类型' },
    'asg.description': { en: 'Description', zh: '描述' },
    'asg.noAssignments': { en: 'No assignments yet', zh: '暂无作业' },
    'asg.noSubmissions': { en: 'No submissions yet (assign students to this class first)', zh: '暂无提交（请先将学生分配到此班级）' },
    'asg.pending': { en: 'Pending', zh: '待完成' },
    'asg.submitted': { en: 'Submitted', zh: '已提交' },
    'asg.completed': { en: 'Completed', zh: '已完成' },
    'asg.returned': { en: 'Returned', zh: '已退回' },
    'asg.markComplete': { en: 'Mark Complete', zh: '标记完成' },
    'asg.dueDate': { en: 'Due Date', zh: '截止日期' },

    // Books
    'bk.title': { en: 'Book Lending', zh: '借书记录' },
    'bk.lendBook': { en: 'Lend Book', zh: '借出图书' },
    'bk.bookTitle': { en: 'Book Title', zh: '书名' },
    'bk.student': { en: 'Student', zh: '学生' },
    'bk.borrowedAt': { en: 'Borrowed', zh: '借出日期' },
    'bk.dueDate': { en: 'Due', zh: '应还日期' },
    'bk.returnBook': { en: 'Return', zh: '归还' },
    'bk.overdue': { en: 'Overdue', zh: '逾期' },
    'bk.active': { en: 'Active', zh: '在借' },
    'bk.returned': { en: 'Returned', zh: '已还' },
    'bk.all': { en: 'All', zh: '全部' },
    'bk.noLoans': { en: 'No book loans yet', zh: '暂无借书记录' },
    'bk.search': { en: 'Search books or students...', zh: '搜索书名或学生...' },
    'bk.notes': { en: 'Notes', zh: '备注' },

    // Common
    'common.save': { en: 'Save', zh: '保存' },
    'common.cancel': { en: 'Cancel', zh: '取消' },
    'common.delete': { en: 'Delete', zh: '删除' },
    'common.edit': { en: 'Edit', zh: '编辑' },
    'common.close': { en: 'Close', zh: '关闭' },
    'common.confirm': { en: 'Confirm', zh: '确认' },
    'common.loading': { en: 'Loading...', zh: '加载中...' },

    // Footer
    'footer': { en: `© ${new Date().getFullYear()} Edu Hub. Pathway Academy.`, zh: `© ${new Date().getFullYear()} 教务管理. Pathway Academy.` },
} as const;

export type TranslationKey = keyof typeof translations;

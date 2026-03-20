import { commonTranslations } from '@pathway/i18n';

export const translations = {
    ...commonTranslations,
    // Nav
    'nav.assignments': { en: 'My Assignments', zh: '我的作业' },
    'nav.schedule': { en: 'My Schedule', zh: '我的课表' },
    'nav.reading': { en: 'Reading', zh: '阅读打卡' },

    // Welcome
    'welcome.title': { en: 'Welcome back', zh: '欢迎回来' },

    // Assignments
    'asg.all': { en: 'All', zh: '全部' },
    'asg.pending': { en: 'Pending', zh: '待完成' },
    'asg.completed': { en: 'Completed', zh: '已完成' },
    'asg.start': { en: 'Start', zh: '开始' },
    'asg.view': { en: 'View', zh: '查看' },
    'asg.submit': { en: 'Mark Done', zh: '标记完成' },
    'asg.print': { en: 'Print', zh: '打印' },
    'asg.dueDate': { en: 'Due', zh: '截止' },
    'asg.from': { en: 'From', zh: '来源' },
    'asg.noAssignments': { en: 'No assignments yet!', zh: '暂无作业！' },
    'asg.allDone': { en: 'All assignments completed! 🎉', zh: '所有作业都完成啦！🎉' },
    'asg.worksheet': { en: 'Worksheet', zh: '练习册' },
    'asg.companion': { en: 'Companion', zh: '配套资料' },
    'asg.custom': { en: 'Assignment', zh: '作业' },
    'asg.submitted': { en: 'Submitted', zh: '已提交' },
    'asg.returned': { en: 'Returned', zh: '已退回' },

    // Schedule
    'sch.title': { en: 'My Class Schedule', zh: '我的课表' },
    'sch.noClasses': { en: 'No classes scheduled', zh: '暂无安排的课程' },
    'sch.today': { en: 'Today', zh: '今天' },
    'sch.upcoming': { en: 'Upcoming', zh: '即将到来' },

    // Common
    'common.loading': { en: 'Loading...', zh: '加载中...' },
    'common.error': { en: 'Something went wrong', zh: '出了点问题' },
    'common.retry': { en: 'Retry', zh: '重试' },
    'common.back': { en: 'Back', zh: '返回' },
    'common.logout': { en: 'Logout', zh: '退出登录' },
    'common.login': { en: 'Login', zh: '登录' },
    'common.email': { en: 'Email', zh: '邮箱' },
    'common.password': { en: 'Password', zh: '密码' },
    'common.loginBtn': { en: 'Sign In', zh: '登录' },
    'common.loginError': { en: 'Invalid email or password', zh: '邮箱或密码错误' },

    // Footer
    'footer': { en: `© ${new Date().getFullYear()} Student Portal. Pathway Academy.`, zh: `© ${new Date().getFullYear()} 学生端. Pathway Academy.` },

    // Interactive Renderer
    'render.previous': { en: 'Previous', zh: '上一页' },
    'render.next': { en: 'Next', zh: '下一页' },
    'render.turnIn': { en: 'Turn In', zh: '提交' },
    'render.submitted': { en: 'Submitted', zh: '已提交' },
    'render.completed': { en: 'COMPLETED', zh: '已完成' },
    'render.prevDay': { en: 'Prev Day', zh: '上一天' },
    'render.nextDay': { en: 'Next Day', zh: '下一天' },
    'render.taskChecklist': { en: 'Task Checklist', zh: '任务清单' },
    'render.cancel': { en: 'Cancel', zh: '取消' },
    'render.markDone': { en: 'Mark as Done', zh: '标记完成' },
    'render.submitting': { en: 'Submitting...', zh: '提交中...' },
    'render.answerPlaceholder': { en: 'Type your answer here...', zh: '在此输入你的答案...' },
    'render.offlineMsg': { en: 'This assignment type cannot be completed interactively. Please complete it offline and mark as done.', zh: '此作业类型无法在线互动完成，请线下完成后标记为已完成。' },
    'render.sectionOf': { en: 'of', zh: '/' },
    'render.day': { en: 'Day', zh: '第' },
    'render.dayUnit': { en: '', zh: '天' },
    'render.teacherFeedback': { en: 'Teacher Feedback', zh: '老师评语' },
    'render.score': { en: 'Score', zh: '评分' },
    'render.noFeedback': { en: 'No feedback yet', zh: '暂无评语' },
    'render.saved': { en: 'Saved ✓', zh: '已保存 ✓' },
    'render.saving': { en: 'Saving...', zh: '保存中...' },
    'render.autoSave': { en: 'Auto-saved', zh: '自动保存' },
} as const;

export type TranslationKey = keyof typeof translations;

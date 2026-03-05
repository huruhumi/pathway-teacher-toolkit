export const translations = {
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
} as const;

export type TranslationKey = keyof typeof translations;

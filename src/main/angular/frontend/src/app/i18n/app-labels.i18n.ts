/**
 * Brycen Hub PMS — App Labels i18n Dictionary
 * Covers ALL pages: Sidebar, VP/Member/Admin Dashboard,
 *   Branch Projects, Staff List, Announcements,
 *   Tax Brackets, Public Holidays
 * Used by: ALL dashboards and inline components
 *
 * Usage:
 *   import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';
 *   getLabel('ja', 'Dashboard')  // → 'ダッシュボード'
 */

export type AppLang = 'en' | 'ja' | 'my' | 'km' | 'vi' | 'ko';

export type AppLabelKey =
  // ── SIDEBAR SECTIONS ──
  | 'MAIN' | 'APPROVALS' | 'SETTINGS' | 'STAFF' | 'PAYROLL' | 'INFO'
  // ── SIDEBAR NAV ──
  | 'Dashboard' | 'Branch Projects' | 'Members' | 'Announcements' | 'All Projects'
  | 'Leave' | 'OT' | 'Salary'
  | 'Profile' | 'Change Password' | 'Public Holidays' | 'Tax Brackets' | 'Sign out' | 'Settings'
  | 'Staff List' | 'Add Staff' | 'Departments' | 'Leave Requests (nav)'
  | 'Salary Structures' | 'Upload Attendance' | 'Monthly Payroll' | 'Payroll History'
  | 'Leave Request' | 'OT Request' | 'New Project' | 'MY PROJECTS'
  // ── VP STAT CARDS ──
  | 'Active Projects' | 'Total Staff' | 'Pending Approvals' | 'OT Hours (Month)'
  | 'this month' | 'Active' | 'Action required' | 'hrs this month'
  // ── MEMBER STAT CARDS ──
  | 'TOTAL PROJECTS' | 'ACTIVE' | 'OVERDUE TASKS' | 'TEAM MEMBERS'
  | 'In progress' | 'Needs attention' | 'Across projects'
  // ── ADMIN STAT CARDS ──
  | 'TOTAL STAFF' | 'PENDING OT' | 'TOTAL HRS' | 'LEAVE REQUESTS TODAY' | 'PAYROLL MONTH'
  | 'Branch members' | 'This month' | 'Pending' | 'Out today' | 'DRAFT'
  // ── ADMIN QUICK ACTIONS ──
  | 'Quick Actions' | 'Today on Leave' | 'Everyone is in today'
  | 'Fingerprint Excel' | 'New member' | 'Add Holiday' | 'Next month'
  // ── MEMBER CHART ──
  | 'Projects Overview' | 'Last 6 months' | 'Task Status'
  | 'To Do' | 'In Progress' | 'In Review' | 'Done' | 'tasks'
  | 'Portfolio' | 'active projects'
  // ── VP/ADMIN CARDS ──
  | 'OT Requests' | 'Overtime approval queue' | 'pending'
  | 'No pending OT requests' | 'View all'
  | 'Staff' | 'Work Date' | 'Details' | 'Action'
  | 'Leave Requests' | 'Leave approval queue' | 'No pending leave requests'
  | 'Type' | 'Dates' | 'Days' | 'Reason' | 'Status'
  | 'Pending' | 'Approve' | 'Reject'
  | 'ANNUAL' | 'SICK' | 'UNPAID'
  | 'Salary Approvals' | 'Monthly payroll approval' | 'No pending salary approvals'
  | 'Pay Period' | 'Gross' | 'Tax' | 'Net'
  // ── PROJECTS TABLE ──
  | 'Branch Projects (card)' | 'projects' | 'total projects'
  | 'PROJECT' | 'STATUS' | 'PROGRESS' | 'OWNER' | 'DUE DATE' | 'HEALTH'
  | 'TOTAL' | 'ON TRACK' | 'AT RISK' | 'DELAYED'
  | 'TEAM' | 'TASKS' | 'DUE' | 'All'
  | 'On Track' | 'At Risk' | 'Delayed' | 'ACTIVE (status)'
  // ── STAFF LIST PAGE ──
  | 'Back to Dashboard' | 'Back' | 'Click a row to view profile'
  | 'Search name or email' | 'All Departments' | 'All Roles' | 'All Status'
  | 'NAME' | 'ROLE' | 'DEPARTMENT' | 'EMAIL' | 'PHONE'
  | 'Active (staff)' | 'Inactive' | 'members'
  // ── ANNOUNCEMENTS PAGE ──
  | 'Announcements' | 'total' | '+ New'
  | 'FROM' | 'TO' | 'Search'
  | 'ALL' | 'ACTIVE (ann)' | 'EXPIRED' | 'PINNED'
  | 'NORMAL' | 'IMPORTANT' | 'Branch' | 'Global'
  | 'Pinned' | 'Expires' | 'ago'
  // ── TAX BRACKETS PAGE ──
  | 'TOTAL BRACKETS' | 'HIGHEST RATE' | 'TAX-FREE UP TO' | 'CURRENCY'
  | 'Top marginal bracket' | 'Exempt ceiling' | 'Progressive tiers'
  | 'Tax Brackets (title)' | '+ Add Bracket'
  | 'TAX-FREE' | 'HIGHEST'
  | 'Tax Calculator' | 'Preview progressive tax'
  | 'MONTHLY SALARY' | 'Calculate'
  // ── HOLIDAYS PAGE ──
  | 'TOTAL HOLIDAYS' | 'THIS MONTH' | 'UPCOMING 30 DAYS' | 'WEEKEND OVERLAP'
  | 'Next month window' | 'Falls on Sat/Sun'
  | 'Public Holidays (title)' | 'Calendar' | 'List' | '+ Add Holiday'
  | 'Holiday' | 'Weekend' | 'Today'
  | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'
  // ── RIGHT SIDEBAR ──
  | 'MANAGEMENT' | 'GROUP CHATS'
  | 'Branch Chat' | 'All branch members'
  | 'My Tasks' | 'Team Members'
  | 'Online' | 'Offline' | 'Branch Staff'
  | 'Search name role branch'
  | 'Office Address' | 'No offices found'
  | 'Bracket Range' | 'Taxable Amount' | 'Effective Rate' | 'Breakdown' | 'Rate';

// ═══════════════════════════════════════════════════════════════
// ENGLISH
// ═══════════════════════════════════════════════════════════════
const en: Record<AppLabelKey, string> = {
  // Sidebar sections
  MAIN: 'MAIN', APPROVALS: 'APPROVALS', SETTINGS: 'SETTINGS', STAFF: 'STAFF', PAYROLL: 'PAYROLL', INFO: 'INFO',
  // Sidebar nav
  Dashboard: 'Dashboard', 'Branch Projects': 'Branch Projects',
  Members: 'Members', Announcements: 'Announcements', 'All Projects': 'All Projects',
  Leave: '🗓 Leave', OT: '⏰ OT', Salary: '💵 Salary',
  Profile: 'Profile', 'Change Password': 'Change Password',
  'Public Holidays': 'Public Holidays', 'Tax Brackets': 'Tax Brackets',
  'Sign out': 'Sign out', Settings: 'Settings',
  'Staff List': 'Staff List', 'Add Staff': 'Add Staff',
  Departments: 'Departments', 'Leave Requests (nav)': 'Leave Requests',
  'Salary Structures': 'Salary Structures', 'Upload Attendance': 'Upload Attendance',
  'Monthly Payroll': 'Monthly Payroll', 'Payroll History': 'Payroll History',
  'Leave Request': 'Leave Request', 'OT Request': 'OT Request',
  'New Project': 'New Project', 'MY PROJECTS': 'MY PROJECTS',
  // VP stat cards
  'Active Projects': 'Active Projects', 'Total Staff': 'Total Staff',
  'Pending Approvals': 'Pending Approvals', 'OT Hours (Month)': 'OT Hours (Month)',
  'this month': '↑ 2 this month', Active: '● Active',
  'Action required': '⚠ Action required', 'hrs this month': 'hrs this month',
  // Member stat cards
  'TOTAL PROJECTS': 'TOTAL PROJECTS', ACTIVE: 'ACTIVE',
  'OVERDUE TASKS': 'OVERDUE TASKS', 'TEAM MEMBERS': 'TEAM MEMBERS',
  'In progress': 'In progress', 'Needs attention': 'Needs attention',
  'Across projects': 'Across projects',
  // Admin stat cards
  'TOTAL STAFF': 'TOTAL STAFF', 'PENDING OT': 'PENDING OT / TOTAL HRS',
  'TOTAL HRS': 'TOTAL HRS', 'LEAVE REQUESTS TODAY': 'LEAVE REQUESTS / TODAY',
  'PAYROLL MONTH': 'PAYROLL',
  'Branch members': 'Branch members', 'This month': 'This month',
  Pending: 'Pending', 'Out today': 'Out today', DRAFT: 'DRAFT',
  // Admin quick actions
  'Quick Actions': '⚡ Quick Actions', 'Today on Leave': '🗓 Today on Leave',
  'Everyone is in today': 'Everyone is in today',
  'Fingerprint Excel': 'Fingerprint Excel', 'New member': 'New member',
  'Add Holiday': 'Add Holiday', 'Next month': 'Next month',
  // Member chart
  'Projects Overview': 'Projects Overview', 'Last 6 months': 'Last 6 months',
  'Task Status': 'Task Status',
  'To Do': 'To Do', 'In Progress': 'In Progress', 'In Review': 'In Review',
  Done: 'Done', tasks: 'tasks',
  Portfolio: 'Portfolio', 'active projects': 'active projects',
  // VP/Admin cards
  'OT Requests': 'OT Requests', 'Overtime approval queue': 'Overtime approval queue',
  pending: 'pending', 'No pending OT requests': 'No pending OT requests',
  'View all': 'View all →',
  Staff: 'STAFF', 'Work Date': 'WORK DATE', Details: 'DETAILS', Action: 'ACTION',
  'Leave Requests': 'Leave Requests', 'Leave approval queue': 'Leave approval queue',
  'No pending leave requests': 'No pending leave requests',
  Type: 'TYPE', Dates: 'DATES', Days: 'DAYS', Reason: 'REASON', Status: 'STATUS',
  Approve: '✓ Approve', Reject: '✕ Reject',
  ANNUAL: 'ANNUAL', SICK: 'SICK', UNPAID: 'UNPAID',
  'Salary Approvals': 'Salary Approvals',
  'Monthly payroll approval': 'Monthly payroll approval',
  'No pending salary approvals': 'No pending salary approvals',
  'Pay Period': 'Pay Period', Gross: 'Gross', Tax: 'Tax', Net: 'Net',
  // Projects table
  'Branch Projects (card)': 'Branch Projects', projects: 'projects',
  'total projects': 'total projects',
  PROJECT: 'PROJECT', STATUS: 'STATUS', PROGRESS: 'PROGRESS',
  OWNER: 'OWNER', 'DUE DATE': 'DUE DATE', HEALTH: 'HEALTH',
  TOTAL: 'TOTAL', 'ON TRACK': 'ON TRACK', 'AT RISK': 'AT RISK', DELAYED: 'DELAYED',
  TEAM: 'TEAM', TASKS: 'TASKS', DUE: 'DUE', All: 'All',
  'On Track': 'On Track', 'At Risk': 'At Risk', Delayed: 'Delayed',
  'ACTIVE (status)': 'ACTIVE',
  // Staff list
  'Back to Dashboard': '← Back to Dashboard', Back: '← Back',
  'Click a row to view profile': 'Click a row to view profile',
  'Search name or email': 'Search name or email...',
  'All Departments': 'All Departments', 'All Roles': 'All Roles', 'All Status': 'All Status',
  NAME: 'NAME', ROLE: 'ROLE', DEPARTMENT: 'DEPARTMENT', EMAIL: 'EMAIL', PHONE: 'PHONE',
  'Active (staff)': 'Active', Inactive: 'Inactive', members: 'members',
  // Announcements
  'total': 'total', '+ New': '+ New',
  FROM: 'FROM', TO: 'TO', Search: 'Search',
  ALL: 'ALL', 'ACTIVE (ann)': 'ACTIVE', EXPIRED: 'EXPIRED', PINNED: 'PINNED',
  NORMAL: 'NORMAL', IMPORTANT: 'IMPORTANT', Branch: 'Branch', Global: 'Global',
  Pinned: 'Pinned', Expires: 'Expires', ago: 'ago',
  // Tax brackets
  'TOTAL BRACKETS': 'TOTAL BRACKETS', 'HIGHEST RATE': 'HIGHEST RATE',
  'TAX-FREE UP TO': 'TAX-FREE UP TO', CURRENCY: 'CURRENCY',
  'Top marginal bracket': 'Top marginal bracket',
  'Exempt ceiling': 'USD · Exempt ceiling', 'Progressive tiers': 'Progressive tiers',
  'Tax Brackets (title)': '💰 Tax Brackets', '+ Add Bracket': '+ Add Bracket',
  'TAX-FREE': 'Tax-free', HIGHEST: 'Highest',
  'Tax Calculator': '🧮 Tax Calculator',
  'Preview progressive tax': 'Preview progressive tax for any salary',
  'MONTHLY SALARY': 'MONTHLY SALARY', Calculate: 'Calculate',
  // Holidays
  'TOTAL HOLIDAYS': 'TOTAL HOLIDAYS', 'THIS MONTH': 'THIS MONTH',
  'UPCOMING 30 DAYS': 'UPCOMING 30 DAYS', 'WEEKEND OVERLAP': 'WEEKEND OVERLAP',
  'Next month window': 'Next month window', 'Falls on Sat/Sun': 'Falls on Sat/Sun',
  'Public Holidays (title)': '🗓️ Public Holidays',
  Calendar: '📅 Calendar', List: '📋 List', '+ Add Holiday': '+ Add Holiday',
  Holiday: 'Holiday', Weekend: 'Weekend', Today: 'Today',
  SUN: 'Sun', MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat',
  // Right sidebar
  MANAGEMENT: 'MANAGEMENT', 'GROUP CHATS': '💬 GROUP CHATS',
  'Branch Chat': 'Branch Chat', 'All branch members': 'All branch members',
  'My Tasks': 'My Tasks', 'Team Members': 'Team Members',
  Online: 'Online', Offline: 'Offline',
  'Branch Staff': 'Branch Staff', 'Search name role branch': 'Search name, role, branch...',
  'Office Address': 'Office Addresses', 'No offices found': 'No offices found',
  'Bracket Range': 'Bracket Range', 'Taxable Amount': 'Taxable Amount',
  'Effective Rate': 'Effective Rate', Breakdown: 'Breakdown', Rate: 'Rate',
};

// ═══════════════════════════════════════════════════════════════
// JAPANESE
// ═══════════════════════════════════════════════════════════════
const ja: Record<AppLabelKey, string> = {
  MAIN: 'メイン', APPROVALS: '承認', SETTINGS: '設定', STAFF: 'スタッフ', PAYROLL: '給与', INFO: '情報',
  Dashboard: 'ダッシュボード', 'Branch Projects': 'プロジェクト',
  Members: 'メンバー', Announcements: 'お知らせ', 'All Projects': '全プロジェクト',
  Leave: '🗓 休暇', OT: '⏰ 残業', Salary: '💵 給与',
  Profile: 'プロフィール', 'Change Password': 'パスワード変更',
  'Public Holidays': '祝日', 'Tax Brackets': '税率',
  'Sign out': 'サインアウト', Settings: '設定',
  'Staff List': 'スタッフ一覧', 'Add Staff': 'スタッフ追加',
  Departments: '部署', 'Leave Requests (nav)': '休暇申請',
  'Salary Structures': '給与体系', 'Upload Attendance': '出勤記録',
  'Monthly Payroll': '月次給与', 'Payroll History': '給与履歴',
  'Leave Request': '休暇申請', 'OT Request': '残業申請',
  'New Project': '新規プロジェクト', 'MY PROJECTS': 'マイプロジェクト',
  'Active Projects': 'アクティブプロジェクト', 'Total Staff': '総スタッフ数',
  'Pending Approvals': '承認待ち', 'OT Hours (Month)': '残業時間（月）',
  'this month': '↑ 今月 2件', Active: '● アクティブ',
  'Action required': '⚠ 要対応', 'hrs this month': '時間/今月',
  'TOTAL PROJECTS': '総プロジェクト', ACTIVE: 'アクティブ',
  'OVERDUE TASKS': '期限超過', 'TEAM MEMBERS': 'チームメンバー',
  'In progress': '進行中', 'Needs attention': '要注意', 'Across projects': '全プロジェクト',
  'TOTAL STAFF': '総スタッフ', 'PENDING OT': '残業申請/総時間',
  'TOTAL HRS': '総時間', 'LEAVE REQUESTS TODAY': '休暇申請/本日',
  'PAYROLL MONTH': '給与',
  'Branch members': 'ブランチメンバー', 'This month': '今月',
  Pending: '承認待ち', 'Out today': '本日外出', DRAFT: 'ドラフト',
  'Quick Actions': '⚡ クイックアクション', 'Today on Leave': '🗓 本日の休暇',
  'Everyone is in today': '全員出勤',
  'Fingerprint Excel': '指紋エクセル', 'New member': '新メンバー',
  'Add Holiday': '祝日追加', 'Next month': '来月',
  'Projects Overview': 'プロジェクト概要', 'Last 6 months': '過去6ヶ月',
  'Task Status': 'タスクステータス',
  'To Do': '未着手', 'In Progress': '進行中', 'In Review': 'レビュー中',
  Done: '完了', tasks: 'タスク',
  Portfolio: 'ポートフォリオ', 'active projects': '件',
  'OT Requests': '残業申請', 'Overtime approval queue': '残業承認キュー',
  pending: '件待ち', 'No pending OT requests': '残業申請はありません',
  'View all': '全て見る →',
  Staff: 'スタッフ', 'Work Date': '勤務日', Details: '詳細', Action: 'アクション',
  'Leave Requests': '休暇申請', 'Leave approval queue': '休暇承認キュー',
  'No pending leave requests': '休暇申請はありません',
  Type: '種類', Dates: '日付', Days: '日数', Reason: '理由', Status: 'ステータス',
  Approve: '✓ 承認', Reject: '✕ 却下',
  ANNUAL: '有給', SICK: '病気', UNPAID: '無給',
  'Salary Approvals': '給与承認', 'Monthly payroll approval': '月次給与承認',
  'No pending salary approvals': '給与承認はありません',
  'Pay Period': '給与期間', Gross: '総支給額', Tax: '税額', Net: '手取り',
  'Branch Projects (card)': 'ブランチプロジェクト', projects: '件',
  'total projects': '件のプロジェクト',
  PROJECT: 'プロジェクト', STATUS: 'ステータス', PROGRESS: '進捗',
  OWNER: '担当者', 'DUE DATE': '期限', HEALTH: '健全性',
  TOTAL: '合計', 'ON TRACK': '順調', 'AT RISK': '要注意', DELAYED: '遅延',
  TEAM: 'チーム', TASKS: 'タスク', DUE: '期限', All: 'すべて',
  'On Track': '順調', 'At Risk': '要注意', Delayed: '遅延', 'ACTIVE (status)': 'アクティブ',
  'Back to Dashboard': '← ダッシュボードへ', Back: '← 戻る',
  'Click a row to view profile': '行をクリックしてプロフィールを表示',
  'Search name or email': '名前またはメールで検索...',
  'All Departments': '全部署', 'All Roles': '全役職', 'All Status': '全ステータス',
  NAME: '名前', ROLE: '役職', DEPARTMENT: '部署', EMAIL: 'メール', PHONE: '電話',
  'Active (staff)': 'アクティブ', Inactive: '非アクティブ', members: 'メンバー',
  total: '件', '+ New': '+ 新規',
  FROM: '開始日', TO: '終了日', Search: '検索',
  ALL: 'すべて', 'ACTIVE (ann)': 'アクティブ', EXPIRED: '期限切れ', PINNED: '固定',
  NORMAL: '通常', IMPORTANT: '重要', Branch: 'ブランチ', Global: 'グローバル',
  Pinned: '固定', Expires: '期限', ago: '前',
  'TOTAL BRACKETS': '税率数', 'HIGHEST RATE': '最高税率',
  'TAX-FREE UP TO': '非課税上限', CURRENCY: '通貨',
  'Top marginal bracket': '最高限界税率',
  'Exempt ceiling': 'USD · 非課税上限', 'Progressive tiers': '累進税率',
  'Tax Brackets (title)': '💰 税率', '+ Add Bracket': '+ 税率追加',
  'TAX-FREE': '非課税', HIGHEST: '最高',
  'Tax Calculator': '🧮 税金計算機',
  'Preview progressive tax': '任意の給与の累進税をプレビュー',
  'MONTHLY SALARY': '月給（円）', Calculate: '計算',
  'TOTAL HOLIDAYS': '祝日合計', 'THIS MONTH': '今月',
  'UPCOMING 30 DAYS': '今後30日', 'WEEKEND OVERLAP': '週末重複',
  'Next month window': '来月のウィンドウ', 'Falls on Sat/Sun': '土日に当たる',
  'Public Holidays (title)': '🗓️ 祝日',
  Calendar: '📅 カレンダー', List: '📋 リスト', '+ Add Holiday': '+ 祝日追加',
  Holiday: '祝日', Weekend: '週末', Today: '今日',
  SUN: '日', MON: '月', TUE: '火', WED: '水', THU: '木', FRI: '金', SAT: '土',
  MANAGEMENT: 'マネジメント', 'GROUP CHATS': '💬 グループチャット',
  'Branch Chat': 'ブランチチャット', 'All branch members': '全ブランチメンバー',
  'My Tasks': 'マイタスク', 'Team Members': 'チームメンバー',
  Online: 'オンライン', Offline: 'オフライン',
  'Branch Staff': 'ブランチスタッフ', 'Search name role branch': '名前・役職・部署で検索...', 'Office Address': 'オフィス住所', 'No offices found': 'オフィスが見つかりません',
  'Bracket Range': '税率範囲', 'Taxable Amount': '課税額', 'Effective Rate': '実効税率', Breakdown: '内訳', Rate: '税率',
};

// ═══════════════════════════════════════════════════════════════
// MYANMAR
// ═══════════════════════════════════════════════════════════════
const my: Record<AppLabelKey, string> = {
  MAIN: 'မိုင်', APPROVALS: 'အတည်ပြုချက်', SETTINGS: 'ဆက်တင်', STAFF: 'ဝန်ထမ်း', PAYROLL: 'လစာ', INFO: 'သတင်းအချက်',
  Dashboard: 'ဒက်ဘုတ်', 'Branch Projects': 'ပရောဂျက်များ',
  Members: 'အဖွဲ့သားများ', Announcements: 'ကြေငြာချက်', 'All Projects': 'ပရောဂျက်အားလုံး',
  Leave: '🗓 ခွင့်', OT: '⏰ နောက်ကျ', Salary: '💵 လစာ',
  Profile: 'ပရိုဖိုင်', 'Change Password': 'စကားဝှက်ပြောင်း',
  'Public Holidays': 'အားလပ်ရက်', 'Tax Brackets': 'အခွန်',
  'Sign out': 'ထွက်မည်', Settings: 'ဆက်တင်',
  'Staff List': 'ဝန်ထမ်းစာရင်း', 'Add Staff': 'ဝန်ထမ်းထည့်',
  Departments: 'ဌာနများ', 'Leave Requests (nav)': 'ခွင့်တောင်းခံမှု',
  'Salary Structures': 'လစာဖွဲ့စည်းပုံ', 'Upload Attendance': 'တက်ရောက်မှုတင်',
  'Monthly Payroll': 'လစဉ်လစာ', 'Payroll History': 'လစာမှတ်တမ်း',
  'Leave Request': 'ခွင့်တောင်းမည်', 'OT Request': 'OT တောင်းမည်',
  'New Project': 'ပရောဂျက်အသစ်', 'MY PROJECTS': 'ငါ့ပရောဂျက်',
  'Active Projects': 'တက်ကြွပရောဂျက်', 'Total Staff': 'ဝန်ထမ်းစုစုပေါင်း',
  'Pending Approvals': 'အတည်ပြုရန်ကျန်', 'OT Hours (Month)': 'OT နာရီ (လ)',
  'this month': '↑ ဒီလ ၂ ခု', Active: '● တက်ကြွ',
  'Action required': '⚠ လုပ်ဆောင်ရန်', 'hrs this month': 'နာရီ/ဒီလ',
  'TOTAL PROJECTS': 'ပရောဂျက်စုစုပေါင်း', ACTIVE: 'တက်ကြွ',
  'OVERDUE TASKS': 'နောက်ကျတာဝန်', 'TEAM MEMBERS': 'အဖွဲ့သားများ',
  'In progress': 'လုပ်ဆောင်နေ', 'Needs attention': 'သတိပြုရန်',
  'Across projects': 'ပရောဂျက်များတွင်',
  'TOTAL STAFF': 'ဝန်ထမ်းစုစုပေါင်း', 'PENDING OT': 'OT ကျန် / နာရီ',
  'TOTAL HRS': 'နာရီစုစုပေါင်း', 'LEAVE REQUESTS TODAY': 'ခွင့် / ဒီနေ့',
  'PAYROLL MONTH': 'လစာ',
  'Branch members': 'ဌာနခွဲဝန်ထမ်း', 'This month': 'ဒီလ',
  Pending: 'စောင့်ဆိုင်းဆဲ', 'Out today': 'ဒီနေ့ မရှိ', DRAFT: 'မူကြမ်း',
  'Quick Actions': '⚡ လျင်မြန်သောလုပ်ဆောင်မှု', 'Today on Leave': '🗓 ဒီနေ့ ခွင့်',
  'Everyone is in today': 'ဝန်ထမ်းအားလုံး ရောက်နေသည်',
  'Fingerprint Excel': 'လက်ဗောင်း Excel', 'New member': 'ဝန်ထမ်းအသစ်',
  'Add Holiday': 'အားလပ်ရက်ထည့်', 'Next month': 'လာမည့်လ',
  'Projects Overview': 'ပရောဂျက်အကျဉ်း', 'Last 6 months': 'လ ၆ ကြာ',
  'Task Status': 'တာဝန်အခြေအနေ',
  'To Do': 'လုပ်ရန်', 'In Progress': 'လုပ်ဆောင်နေ', 'In Review': 'စစ်ဆေးနေ',
  Done: 'ပြီးပြီ', tasks: 'တာဝန်',
  Portfolio: 'ပရောဂျက်စာရင်း', 'active projects': 'ပရောဂျက်',
  'OT Requests': 'OT တောင်းခံမှု', 'Overtime approval queue': 'OT အတည်ပြုစာရင်း',
  pending: 'ကျန်', 'No pending OT requests': 'OT တောင်းခံမှု မရှိပါ',
  'View all': 'အားလုံးကြည့် →',
  Staff: 'ဝန်ထမ်း', 'Work Date': 'အလုပ်ရက်', Details: 'အသေးစိတ်', Action: 'လုပ်ဆောင်ချက်',
  'Leave Requests': 'ခွင့်တောင်းခံမှု', 'Leave approval queue': 'ခွင့်အတည်ပြုစာရင်း',
  'No pending leave requests': 'ခွင့်တောင်းခံမှု မရှိပါ',
  Type: 'အမျိုးအစား', Dates: 'ရက်စွဲ', Days: 'ရက်', Reason: 'အကြောင်းပြချက်',
  Status: 'အခြေအနေ', Approve: '✓ အတည်ပြု', Reject: '✕ ငြင်းပယ်',
  ANNUAL: 'နှစ်ပတ်လည်', SICK: 'နာမကျန်း', UNPAID: 'လစာမဲ့',
  'Salary Approvals': 'လစာအတည်ပြုမှု', 'Monthly payroll approval': 'လစဉ်လစာအတည်ပြု',
  'No pending salary approvals': 'လစာအတည်ပြုမှု မရှိပါ',
  'Pay Period': 'လစာကာလ', Gross: 'စုစုပေါင်း', Tax: 'အခွန်', Net: 'ကျန်',
  'Branch Projects (card)': 'ဌာနခွဲပရောဂျက်', projects: 'ခု',
  'total projects': 'ပရောဂျက်စုစုပေါင်း',
  PROJECT: 'ပရောဂျက်', STATUS: 'အခြေအနေ', PROGRESS: 'တိုးတက်မှု',
  OWNER: 'တာဝန်ခံ', 'DUE DATE': 'သတ်မှတ်ရက်', HEALTH: 'ကျန်းမာရေး',
  TOTAL: 'စုစုပေါင်း', 'ON TRACK': 'ပုံမှန်', 'AT RISK': 'အန္တရာယ်ရှိ', DELAYED: 'နောက်ကျ',
  TEAM: 'အဖွဲ့', TASKS: 'တာဝန်', DUE: 'ရက်', All: 'အားလုံး',
  'On Track': 'ပုံမှန်', 'At Risk': 'အန္တရာယ်ရှိ', Delayed: 'နောက်ကျ',
  'ACTIVE (status)': 'တက်ကြွ',
  'Back to Dashboard': '← ဒက်ဘုတ်သို့', Back: '← နောက်',
  'Click a row to view profile': 'ကြည့်ရန် row ကို နှိပ်ပါ',
  'Search name or email': 'အမည် သို့မဟုတ် email ရှာပါ...',
  'All Departments': 'ဌာနအားလုံး', 'All Roles': 'ရာထူးအားလုံး', 'All Status': 'အားလုံး',
  NAME: 'အမည်', ROLE: 'ရာထူး', DEPARTMENT: 'ဌာန', EMAIL: 'အီးမေးလ်', PHONE: 'ဖုန်း',
  'Active (staff)': 'တက်ကြွ', Inactive: 'တက်ကြွမဟုတ်', members: 'ဦး',
  total: 'ခု', '+ New': '+ အသစ်',
  FROM: 'စပြီး', TO: 'အထိ', Search: 'ရှာ',
  ALL: 'အားလုံး', 'ACTIVE (ann)': 'တက်ကြွ', EXPIRED: 'သက်တမ်းကုန်', PINNED: 'ပင်ထိုး',
  NORMAL: 'ပုံမှန်', IMPORTANT: 'အရေးကြီး', Branch: 'ဌာနခွဲ', Global: 'ကမ္ဘာလုံး',
  Pinned: 'ပင်ထိုးထား', Expires: 'သက်တမ်း', ago: 'ကြာ',
  'TOTAL BRACKETS': 'အခွန်ကွာကွက်', 'HIGHEST RATE': 'အမြင့်ဆုံးနှုန်း',
  'TAX-FREE UP TO': 'အခွန်မဲ့ထိ', CURRENCY: 'ငွေကြေး',
  'Top marginal bracket': 'အမြင့်ဆုံးကွာကွက်',
  'Exempt ceiling': 'USD · အခွန်မဲ့အမြင့်ဆုံး', 'Progressive tiers': 'တဆင့်ချင်းနှုန်း',
  'Tax Brackets (title)': '💰 အခွန်ကွာကွက်', '+ Add Bracket': '+ ကွာကွက်ထည့်',
  'TAX-FREE': 'အခွန်မဲ့', HIGHEST: 'အမြင့်ဆုံး',
  'Tax Calculator': '🧮 အခွန်တွက်',
  'Preview progressive tax': 'မည်သည့်လစာအတွက်မဆို အခွန်ကြိုတင်ကြည့်',
  'MONTHLY SALARY': 'လစဉ်လစာ', Calculate: 'တွက်',
  'TOTAL HOLIDAYS': 'အားလပ်ရက်စုစုပေါင်း', 'THIS MONTH': 'ဒီလ',
  'UPCOMING 30 DAYS': 'နောက် ၃၀ ရက်', 'WEEKEND OVERLAP': 'စနေ/တနင်္ဂနွေ ကျရောက်',
  'Next month window': 'လာမည့်လ', 'Falls on Sat/Sun': 'စနေ/တနင်္ဂနွေ ကျသည်',
  'Public Holidays (title)': '🗓️ အားလပ်ရက်',
  Calendar: '📅 ပြက္ခဒိန်', List: '📋 စာရင်း', '+ Add Holiday': '+ ထည့်',
  Holiday: 'အားလပ်ရက်', Weekend: 'စနေ/တနင်္ဂနွေ', Today: 'ဒီနေ့',
  SUN: 'တနင်္ဂနွေ', MON: 'တနင်္လာ', TUE: 'အင်္ဂါ', WED: 'ဗုဒ္ဓဟူး',
  THU: 'ကြာသပတေး', FRI: 'သောကြာ', SAT: 'စနေ',
  MANAGEMENT: 'စီမံခန့်ခွဲမှု', 'GROUP CHATS': '💬 အဖွဲ့ချတ်',
  'Branch Chat': 'ဌာနခွဲချတ်', 'All branch members': 'အဖွဲ့သားများ',
  'My Tasks': 'ငါ့တာဝန်', 'Team Members': 'အဖွဲ့သားများ',
  Online: 'အွန်လိုင်း', Offline: 'အော့ဖ်လိုင်း',
  'Branch Staff': 'ဌာနခွဲဝန်ထမ်း', 'Search name role branch': 'အမည်၊ ရာထူး ရှာပါ...', 'Office Address': 'ရုံးလိပ်စာ', 'No offices found': 'ရုံးမတွေ့ပါ',
  'Bracket Range': 'အခွန်အတိုင်းအတာ', 'Taxable Amount': 'အခွန်ကောက်ငွေ', 'Effective Rate': 'တကယ့်နှုန်း', Breakdown: 'အသေးစိတ်', Rate: 'နှုန်း',
};

// ═══════════════════════════════════════════════════════════════
// KHMER
// ═══════════════════════════════════════════════════════════════
const km: Record<AppLabelKey, string> = {
  MAIN: 'មេ', APPROVALS: 'ការអនុម័ត', SETTINGS: 'ការកំណត់', STAFF: 'បុគ្គលិក', PAYROLL: 'ប្រាក់ខែ', INFO: 'ព័ត៌មាន',
  Dashboard: 'ផ្ទាំងគ្រប់គ្រង', 'Branch Projects': 'គម្រោង',
  Members: 'សមាជិក', Announcements: 'សេចក្តីប្រកាស', 'All Projects': 'គម្រោងទាំងអស់',
  Leave: '🗓 សំណើឈប់', OT: '⏰ ម៉ោងបន្ថែម', Salary: '💵 ប្រាក់ខែ',
  Profile: 'គណនី', 'Change Password': 'ផ្លាស់ប្ដូរពាក្យសម្ងាត់',
  'Public Holidays': 'ថ្ងៃឈប់សម្រាក', 'Tax Brackets': 'អត្រាពន្ធ',
  'Sign out': 'ចាកចេញ', Settings: 'ការកំណត់',
  'Staff List': 'បញ្ជីបុគ្គលិក', 'Add Staff': 'បន្ថែមបុគ្គលិក',
  Departments: 'នាយកដ្ឋាន', 'Leave Requests (nav)': 'សំណើច្បាប់',
  'Salary Structures': 'រចនាសម្ព័ន្ធប្រាក់ខែ', 'Upload Attendance': 'បញ្ចូលវត្តមាន',
  'Monthly Payroll': 'ប្រាក់ខែប្រចាំខែ', 'Payroll History': 'ប្រវត្តិប្រាក់ខែ',
  'Leave Request': 'សំណើច្បាប់', 'OT Request': 'សំណើ OT',
  'New Project': 'គម្រោងថ្មី', 'MY PROJECTS': 'គម្រោងខ្ញុំ',
  'Active Projects': 'គម្រោងសកម្ម', 'Total Staff': 'បុគ្គលិកសរុប',
  'Pending Approvals': 'រង់ចាំការអនុម័ត', 'OT Hours (Month)': 'ម៉ោង OT (ខែ)',
  'this month': '↑ ២ ខែនេះ', Active: '● សកម្ម',
  'Action required': '⚠ ត្រូវការសកម្មភាព', 'hrs this month': 'ម៉ោង/ខែនេះ',
  'TOTAL PROJECTS': 'គម្រោងសរុប', ACTIVE: 'សកម្ម',
  'OVERDUE TASKS': 'ភារកិច្ចហួសកំណត់', 'TEAM MEMBERS': 'សមាជិកក្រុម',
  'In progress': 'កំពុងដំណើរការ', 'Needs attention': 'ត្រូវការការយកចិត្តទុកដាក់',
  'Across projects': 'នៅទូទាំងគម្រោង',
  'TOTAL STAFF': 'បុគ្គលិកសរុប', 'PENDING OT': 'OT រង់ចាំ',
  'TOTAL HRS': 'ម៉ោងសរុប', 'LEAVE REQUESTS TODAY': 'ច្បាប់/ថ្ងៃនេះ',
  'PAYROLL MONTH': 'ប្រាក់ខែ',
  'Branch members': 'សមាជិកសាខា', 'This month': 'ខែនេះ',
  Pending: 'រង់ចាំ', 'Out today': 'អវត្ដមានថ្ងៃនេះ', DRAFT: 'សេចក្តីព្រាង',
  'Quick Actions': '⚡ សកម្មភាពរហ័ស', 'Today on Leave': '🗓 ច្បាប់ថ្ងៃនេះ',
  'Everyone is in today': 'គ្រប់គ្នាមកធ្វើការ',
  'Fingerprint Excel': 'Excel ស្នាមមេដៃ', 'New member': 'សមាជិកថ្មី',
  'Add Holiday': 'បន្ថែមថ្ងៃឈប់', 'Next month': 'ខែក្រោយ',
  'Projects Overview': 'ទិដ្ឋភាពគម្រោង', 'Last 6 months': '6 ខែចុងក្រោយ',
  'Task Status': 'ស្ថានភាពភារកិច្ច',
  'To Do': 'ត្រូវធ្វើ', 'In Progress': 'កំពុងធ្វើ', 'In Review': 'កំពុងពិនិត្យ',
  Done: 'រួចរាល់', tasks: 'ភារកិច្ច',
  Portfolio: 'ផតហ្វូលីយ៉ូ', 'active projects': 'គម្រោង',
  'OT Requests': 'សំណើ OT', 'Overtime approval queue': 'វេនអនុម័ត OT',
  pending: 'រង់ចាំ', 'No pending OT requests': 'គ្មានសំណើ OT',
  'View all': 'មើលទាំងអស់ →',
  Staff: 'បុគ្គលិក', 'Work Date': 'ថ្ងៃធ្វើការ', Details: 'ព័ត៌មានលម្អិត',
  Action: 'សកម្មភាព',
  'Leave Requests': 'សំណើច្បាប់', 'Leave approval queue': 'វេនអនុម័តច្បាប់',
  'No pending leave requests': 'គ្មានសំណើច្បាប់',
  Type: 'ប្រភេទ', Dates: 'កាលបរិច្ឆេទ', Days: 'ថ្ងៃ', Reason: 'មូលហេតុ',
  Status: 'ស្ថានភាព', Approve: '✓ អនុម័ត', Reject: '✕ បដិសេធ',
  ANNUAL: 'ច្បាប់ប្រចាំឆ្នាំ', SICK: 'ឈឺ', UNPAID: 'គ្មានប្រាក់',
  'Salary Approvals': 'អនុម័តប្រាក់ខែ', 'Monthly payroll approval': 'អនុម័តប្រចាំខែ',
  'No pending salary approvals': 'គ្មានការអនុម័ត',
  'Pay Period': 'រយៈពេល', Gross: 'សរុប', Tax: 'ពន្ធ', Net: 'សុទ្ធ',
  'Branch Projects (card)': 'គម្រោងសាខា', projects: 'គម្រោង',
  'total projects': 'គម្រោងសរុប',
  PROJECT: 'គម្រោង', STATUS: 'ស្ថានភាព', PROGRESS: 'វឌ្ឍនភាព',
  OWNER: 'ម្ចាស់', 'DUE DATE': 'កាលកំណត់', HEALTH: 'សុខភាព',
  TOTAL: 'សរុប', 'ON TRACK': 'ធម្មតា', 'AT RISK': 'ហានិភ័យ', DELAYED: 'យឺត',
  TEAM: 'ក្រុម', TASKS: 'ភារកិច្ច', DUE: 'ថ្ងៃ', All: 'ទាំងអស់',
  'On Track': 'ដំណើរការធម្មតា', 'At Risk': 'មានហានិភ័យ', Delayed: 'យឺត',
  'ACTIVE (status)': 'សកម្ម',
  'Back to Dashboard': '← ត្រឡប់', Back: '← ត្រឡប់',
  'Click a row to view profile': 'ចុចដើម្បីមើលប្រវត្តិរូប',
  'Search name or email': 'ស្វែងរកឈ្មោះ ឬអ៊ីម៉ែល...',
  'All Departments': 'នាយកដ្ឋានទាំងអស់', 'All Roles': 'តួនាទីទាំងអស់',
  'All Status': 'ស្ថានភាពទាំងអស់',
  NAME: 'ឈ្មោះ', ROLE: 'តួនាទី', DEPARTMENT: 'នាយកដ្ឋាន',
  EMAIL: 'អ៊ីម៉ែល', PHONE: 'ទូរស័ព្ទ',
  'Active (staff)': 'សកម្ម', Inactive: 'អសកម្ម', members: 'នាក់',
  total: 'ចំនួន', '+ New': '+ ថ្មី',
  FROM: 'ចាប់ពី', TO: 'ដល់', Search: 'ស្វែងរក',
  ALL: 'ទាំងអស់', 'ACTIVE (ann)': 'សកម្ម', EXPIRED: 'ផុតកំណត់', PINNED: 'ដាក់ខ្ទាស់',
  NORMAL: 'ធម្មតា', IMPORTANT: 'សំខាន់', Branch: 'សាខា', Global: 'ពិភពលោក',
  Pinned: 'ដាក់ខ្ទាស់', Expires: 'ផុតកំណត់', ago: 'មុន',
  'TOTAL BRACKETS': 'ចំនួនអត្រាពន្ធ', 'HIGHEST RATE': 'អត្រាខ្ពស់បំផុត',
  'TAX-FREE UP TO': 'គ្មានពន្ធរហូតដល់', CURRENCY: 'រូបិយប័ណ្ណ',
  'Top marginal bracket': 'អត្រាខ្ពស់បំផុត',
  'Exempt ceiling': 'USD · អត្រាពន្ធ', 'Progressive tiers': 'ពន្ធបន្តបន្ទាប់',
  'Tax Brackets (title)': '💰 អត្រាពន្ធ', '+ Add Bracket': '+ បន្ថែម',
  'TAX-FREE': 'គ្មានពន្ធ', HIGHEST: 'ខ្ពស់បំផុត',
  'Tax Calculator': '🧮 គណនាពន្ធ',
  'Preview progressive tax': 'មើលពន្ធជាមុន',
  'MONTHLY SALARY': 'ប្រាក់ខែ', Calculate: 'គណនា',
  'TOTAL HOLIDAYS': 'ថ្ងៃឈប់សម្រាកសរុប', 'THIS MONTH': 'ខែនេះ',
  'UPCOMING 30 DAYS': '30 ថ្ងៃខាងមុខ', 'WEEKEND OVERLAP': 'ជួបចុងសប្ដាហ៍',
  'Next month window': 'ខែក្រោយ', 'Falls on Sat/Sun': 'ជួបសៅរ៍/អាទិត្យ',
  'Public Holidays (title)': '🗓️ ថ្ងៃឈប់សម្រាក',
  Calendar: '📅 ប្រតិទិន', List: '📋 បញ្ជី', '+ Add Holiday': '+ បន្ថែម',
  Holiday: 'ថ្ងៃឈប់', Weekend: 'ចុងសប្ដាហ៍', Today: 'ថ្ងៃនេះ',
  SUN: 'អា', MON: 'ច', TUE: 'អ', WED: 'ព', THU: 'ព្រ', FRI: 'សុ', SAT: 'ស',
  MANAGEMENT: 'ការគ្រប់គ្រង', 'GROUP CHATS': '💬 ក្រុមជជែក',
  'Branch Chat': 'ជជែកសាខា', 'All branch members': 'សមាជិកសាខាទាំងអស់',
  'My Tasks': 'ភារកិច្ចខ្ញុំ', 'Team Members': 'សមាជិកក្រុម',
  Online: 'អនឡាញ', Offline: 'គ្មានអ៊ីនធឺណិត',
  'Branch Staff': 'បុគ្គលិកសាខា', 'Search name role branch': 'ស្វែងរកឈ្មោះ...', 'Office Address': 'អាសយដ្ឋានការិយាល័យ', 'No offices found': 'រកមិនឃើញ',
  'Bracket Range': 'ជួរអត្រាពន្ធ', 'Taxable Amount': 'ចំនួនជាប់ពន្ធ', 'Effective Rate': 'អត្រាជាក់ស្តែង', Breakdown: 'ព័ត៌មានលម្អិត', Rate: 'អត្រា',
};

// ═══════════════════════════════════════════════════════════════
// VIETNAMESE
// ═══════════════════════════════════════════════════════════════
const vi: Record<AppLabelKey, string> = {
  MAIN: 'CHÍNH', APPROVALS: 'PHÊ DUYỆT', SETTINGS: 'CÀI ĐẶT',
  STAFF: 'NHÂN VIÊN', PAYROLL: 'LƯƠNG', INFO: 'THÔNG TIN',
  Dashboard: 'Tổng quan', 'Branch Projects': 'Dự án',
  Members: 'Thành viên', Announcements: 'Thông báo', 'All Projects': 'Tất cả dự án',
  Leave: '🗓 Nghỉ phép', OT: '⏰ Tăng ca', Salary: '💵 Lương',
  Profile: 'Hồ sơ', 'Change Password': 'Đổi mật khẩu',
  'Public Holidays': 'Ngày nghỉ lễ', 'Tax Brackets': 'Thuế',
  'Sign out': 'Đăng xuất', Settings: 'Cài đặt',
  'Staff List': 'Danh sách NV', 'Add Staff': 'Thêm NV',
  Departments: 'Phòng ban', 'Leave Requests (nav)': 'Yêu cầu nghỉ',
  'Salary Structures': 'Cơ cấu lương', 'Upload Attendance': 'Tải chấm công',
  'Monthly Payroll': 'Lương tháng', 'Payroll History': 'Lịch sử lương',
  'Leave Request': 'Xin nghỉ phép', 'OT Request': 'Xin tăng ca',
  'New Project': 'Dự án mới', 'MY PROJECTS': 'DỰ ÁN CỦA TÔI',
  'Active Projects': 'Dự án hoạt động', 'Total Staff': 'Tổng nhân viên',
  'Pending Approvals': 'Chờ phê duyệt', 'OT Hours (Month)': 'Giờ OT (Tháng)',
  'this month': '↑ 2 tháng này', Active: '● Hoạt động',
  'Action required': '⚠ Cần xử lý', 'hrs this month': 'giờ/tháng này',
  'TOTAL PROJECTS': 'TỔNG DỰ ÁN', ACTIVE: 'HOẠT ĐỘNG',
  'OVERDUE TASKS': 'NHIỆM VỤ TRỄ', 'TEAM MEMBERS': 'THÀNH VIÊN',
  'In progress': 'Đang thực hiện', 'Needs attention': 'Cần chú ý',
  'Across projects': 'Trong các dự án',
  'TOTAL STAFF': 'TỔNG NV', 'PENDING OT': 'OT CHỜ / TỔNG GIỜ',
  'TOTAL HRS': 'TỔNG GIỜ', 'LEAVE REQUESTS TODAY': 'NGHỈ PHÉP / HÔM NAY',
  'PAYROLL MONTH': 'LƯƠNG',
  'Branch members': 'Thành viên chi nhánh', 'This month': 'Tháng này',
  Pending: 'Đang chờ', 'Out today': 'Vắng hôm nay', DRAFT: 'Bản nháp',
  'Quick Actions': '⚡ Thao tác nhanh', 'Today on Leave': '🗓 Nghỉ hôm nay',
  'Everyone is in today': 'Tất cả đã đi làm',
  'Fingerprint Excel': 'Excel điểm danh', 'New member': 'Thành viên mới',
  'Add Holiday': 'Thêm ngày nghỉ', 'Next month': 'Tháng sau',
  'Projects Overview': 'Tổng quan dự án', 'Last 6 months': '6 tháng qua',
  'Task Status': 'Trạng thái nhiệm vụ',
  'To Do': 'Cần làm', 'In Progress': 'Đang làm', 'In Review': 'Đang xem xét',
  Done: 'Hoàn thành', tasks: 'nhiệm vụ',
  Portfolio: 'Danh mục', 'active projects': 'dự án',
  'OT Requests': 'Yêu cầu OT', 'Overtime approval queue': 'Hàng chờ OT',
  pending: 'chờ', 'No pending OT requests': 'Không có yêu cầu OT',
  'View all': 'Xem tất cả →',
  Staff: 'NHÂN VIÊN', 'Work Date': 'NGÀY LÀM', Details: 'CHI TIẾT',
  Action: 'HÀNH ĐỘNG',
  'Leave Requests': 'Yêu cầu nghỉ phép', 'Leave approval queue': 'Hàng chờ nghỉ',
  'No pending leave requests': 'Không có yêu cầu nghỉ',
  Type: 'LOẠI', Dates: 'NGÀY', Days: 'SỐ NGÀY', Reason: 'LÝ DO',
  Status: 'TRẠNG THÁI', Approve: '✓ Duyệt', Reject: '✕ Từ chối',
  ANNUAL: 'Phép năm', SICK: 'Ốm', UNPAID: 'Không lương',
  'Salary Approvals': 'Duyệt lương', 'Monthly payroll approval': 'Duyệt lương tháng',
  'No pending salary approvals': 'Không có duyệt lương',
  'Pay Period': 'Kỳ lương', Gross: 'Tổng', Tax: 'Thuế', Net: 'Thực nhận',
  'Branch Projects (card)': 'Dự án chi nhánh', projects: 'dự án',
  'total projects': 'tổng dự án',
  PROJECT: 'DỰ ÁN', STATUS: 'TRẠNG THÁI', PROGRESS: 'TIẾN ĐỘ',
  OWNER: 'PHỤ TRÁCH', 'DUE DATE': 'HẠN', HEALTH: 'SỨC KHỎE',
  TOTAL: 'TỔNG', 'ON TRACK': 'ĐÚNG TIẾN ĐỘ', 'AT RISK': 'RỦI RO', DELAYED: 'TRỄ',
  TEAM: 'NHÓM', TASKS: 'NHIỆM VỤ', DUE: 'HẠN', All: 'Tất cả',
  'On Track': 'Đúng tiến độ', 'At Risk': 'Có rủi ro', Delayed: 'Trễ',
  'ACTIVE (status)': 'HOẠT ĐỘNG',
  'Back to Dashboard': '← Tổng quan', Back: '← Quay lại',
  'Click a row to view profile': 'Nhấn hàng để xem hồ sơ',
  'Search name or email': 'Tìm tên hoặc email...',
  'All Departments': 'Tất cả phòng ban', 'All Roles': 'Tất cả vai trò',
  'All Status': 'Tất cả trạng thái',
  NAME: 'TÊN', ROLE: 'VAI TRÒ', DEPARTMENT: 'PHÒNG BAN',
  EMAIL: 'EMAIL', PHONE: 'ĐIỆN THOẠI',
  'Active (staff)': 'Hoạt động', Inactive: 'Không hoạt động', members: 'thành viên',
  total: 'tổng', '+ New': '+ Mới',
  FROM: 'TỪ', TO: 'ĐẾN', Search: 'Tìm kiếm',
  ALL: 'TẤT CẢ', 'ACTIVE (ann)': 'HOẠT ĐỘNG', EXPIRED: 'HẾT HẠN', PINNED: 'GHIM',
  NORMAL: 'THƯỜNG', IMPORTANT: 'QUAN TRỌNG', Branch: 'Chi nhánh', Global: 'Toàn cầu',
  Pinned: 'Đã ghim', Expires: 'Hết hạn', ago: 'trước',
  'TOTAL BRACKETS': 'TỔNG MỨC THUẾ', 'HIGHEST RATE': 'MỨC CAO NHẤT',
  'TAX-FREE UP TO': 'MIỄN THUẾ ĐẾN', CURRENCY: 'TIỀN TỆ',
  'Top marginal bracket': 'Mức thuế cao nhất',
  'Exempt ceiling': 'USD · Miễn thuế', 'Progressive tiers': 'Thuế lũy tiến',
  'Tax Brackets (title)': '💰 Thuế', '+ Add Bracket': '+ Thêm mức thuế',
  'TAX-FREE': 'Miễn thuế', HIGHEST: 'Cao nhất',
  'Tax Calculator': '🧮 Tính thuế',
  'Preview progressive tax': 'Xem trước thuế cho bất kỳ mức lương',
  'MONTHLY SALARY': 'LƯƠNG THÁNG', Calculate: 'Tính',
  'TOTAL HOLIDAYS': 'TỔNG NGÀY NGHỈ', 'THIS MONTH': 'THÁNG NÀY',
  'UPCOMING 30 DAYS': '30 NGÀY TỚI', 'WEEKEND OVERLAP': 'TRÙNG CUỐI TUẦN',
  'Next month window': 'Tháng tới', 'Falls on Sat/Sun': 'Rơi vào T7/CN',
  'Public Holidays (title)': '🗓️ Ngày nghỉ lễ',
  Calendar: '📅 Lịch', List: '📋 Danh sách', '+ Add Holiday': '+ Thêm',
  Holiday: 'Nghỉ lễ', Weekend: 'Cuối tuần', Today: 'Hôm nay',
  SUN: 'CN', MON: 'T2', TUE: 'T3', WED: 'T4', THU: 'T5', FRI: 'T6', SAT: 'T7',
  MANAGEMENT: 'QUẢN LÝ', 'GROUP CHATS': '💬 NHÓM CHAT',
  'Branch Chat': 'Chat Chi nhánh', 'All branch members': 'Tất cả thành viên',
  'My Tasks': 'Nhiệm vụ của tôi', 'Team Members': 'Thành viên nhóm',
  Online: 'Trực tuyến', Offline: 'Ngoại tuyến',
  'Branch Staff': 'NV Chi nhánh', 'Search name role branch': 'Tìm tên, vai trò...', 'Office Address': 'Địa chỉ văn phòng', 'No offices found': 'Không tìm thấy',
  'Bracket Range': 'Khung thuế', 'Taxable Amount': 'Thu nhập chịu thuế', 'Effective Rate': 'Thuế suất hiệu quả', Breakdown: 'Chi tiết', Rate: 'Thuế suất',
};

// ═══════════════════════════════════════════════════════════════
// KOREAN
// ═══════════════════════════════════════════════════════════════
const ko: Record<AppLabelKey, string> = {
  MAIN: '메인', APPROVALS: '승인', SETTINGS: '설정', STAFF: '직원', PAYROLL: '급여', INFO: '정보',
  Dashboard: '대시보드', 'Branch Projects': '프로젝트',
  Members: '멤버', Announcements: '공지사항', 'All Projects': '전체 프로젝트',
  Leave: '🗓 휴가', OT: '⏰ 초과근무', Salary: '💵 급여',
  Profile: '프로필', 'Change Password': '비밀번호 변경',
  'Public Holidays': '공휴일', 'Tax Brackets': '세금',
  'Sign out': '로그아웃', Settings: '설정',
  'Staff List': '직원 목록', 'Add Staff': '직원 추가',
  Departments: '부서', 'Leave Requests (nav)': '휴가 신청',
  'Salary Structures': '급여 구조', 'Upload Attendance': '출결 업로드',
  'Monthly Payroll': '월급', 'Payroll History': '급여 내역',
  'Leave Request': '휴가 신청', 'OT Request': '초과근무 신청',
  'New Project': '새 프로젝트', 'MY PROJECTS': '내 프로젝트',
  'Active Projects': '진행 중인 프로젝트', 'Total Staff': '총 직원',
  'Pending Approvals': '승인 대기', 'OT Hours (Month)': '초과근무 시간 (월)',
  'this month': '↑ 이번 달 2건', Active: '● 활성',
  'Action required': '⚠ 조치 필요', 'hrs this month': '시간/이번 달',
  'TOTAL PROJECTS': '총 프로젝트', ACTIVE: '활성',
  'OVERDUE TASKS': '기한 초과', 'TEAM MEMBERS': '팀 멤버',
  'In progress': '진행 중', 'Needs attention': '주의 필요',
  'Across projects': '전체 프로젝트',
  'TOTAL STAFF': '총 직원', 'PENDING OT': '초과근무 대기',
  'TOTAL HRS': '총 시간', 'LEAVE REQUESTS TODAY': '휴가 / 오늘',
  'PAYROLL MONTH': '급여',
  'Branch members': '지점 멤버', 'This month': '이번 달',
  Pending: '대기 중', 'Out today': '오늘 부재', DRAFT: '초안',
  'Quick Actions': '⚡ 빠른 작업', 'Today on Leave': '🗓 오늘 휴가',
  'Everyone is in today': '모두 출근',
  'Fingerprint Excel': '출결 엑셀', 'New member': '새 멤버',
  'Add Holiday': '공휴일 추가', 'Next month': '다음 달',
  'Projects Overview': '프로젝트 개요', 'Last 6 months': '최근 6개월',
  'Task Status': '태스크 현황',
  'To Do': '할 일', 'In Progress': '진행 중', 'In Review': '검토 중',
  Done: '완료', tasks: '태스크',
  Portfolio: '포트폴리오', 'active projects': '개',
  'OT Requests': '초과근무 신청', 'Overtime approval queue': '초과근무 승인 대기',
  pending: '대기 중', 'No pending OT requests': '초과근무 신청 없음',
  'View all': '전체 보기 →',
  Staff: '직원', 'Work Date': '근무일', Details: '세부사항', Action: '조치',
  'Leave Requests': '휴가 신청', 'Leave approval queue': '휴가 승인 대기',
  'No pending leave requests': '휴가 신청 없음',
  Type: '유형', Dates: '날짜', Days: '일수', Reason: '사유',
  Status: '상태', Approve: '✓ 승인', Reject: '✕ 거부',
  ANNUAL: '연차', SICK: '병가', UNPAID: '무급',
  'Salary Approvals': '급여 승인', 'Monthly payroll approval': '월급 승인',
  'No pending salary approvals': '급여 승인 없음',
  'Pay Period': '급여 기간', Gross: '총액', Tax: '세금', Net: '실수령액',
  'Branch Projects (card)': '지점 프로젝트', projects: '개',
  'total projects': '총 프로젝트',
  PROJECT: '프로젝트', STATUS: '상태', PROGRESS: '진행률',
  OWNER: '담당자', 'DUE DATE': '마감일', HEALTH: '건강도',
  TOTAL: '합계', 'ON TRACK': '정상', 'AT RISK': '위험', DELAYED: '지연',
  TEAM: '팀', TASKS: '태스크', DUE: '마감', All: '전체',
  'On Track': '정상', 'At Risk': '위험', Delayed: '지연',
  'ACTIVE (status)': '활성',
  'Back to Dashboard': '← 대시보드', Back: '← 뒤로',
  'Click a row to view profile': '행을 클릭하여 프로필 보기',
  'Search name or email': '이름 또는 이메일 검색...',
  'All Departments': '전체 부서', 'All Roles': '전체 역할',
  'All Status': '전체 상태',
  NAME: '이름', ROLE: '역할', DEPARTMENT: '부서',
  EMAIL: '이메일', PHONE: '전화',
  'Active (staff)': '활성', Inactive: '비활성', members: '명',
  total: '개', '+ New': '+ 새로',
  FROM: '시작', TO: '종료', Search: '검색',
  ALL: '전체', 'ACTIVE (ann)': '활성', EXPIRED: '만료', PINNED: '고정',
  NORMAL: '일반', IMPORTANT: '중요', Branch: '지점', Global: '전체',
  Pinned: '고정됨', Expires: '만료', ago: '전',
  'TOTAL BRACKETS': '세율 수', 'HIGHEST RATE': '최고 세율',
  'TAX-FREE UP TO': '면세 한도', CURRENCY: '통화',
  'Top marginal bracket': '최고 한계 세율',
  'Exempt ceiling': 'USD · 면세 한도', 'Progressive tiers': '누진세율',
  'Tax Brackets (title)': '💰 세율', '+ Add Bracket': '+ 세율 추가',
  'TAX-FREE': '면세', HIGHEST: '최고',
  'Tax Calculator': '🧮 세금 계산기',
  'Preview progressive tax': '임의 급여에 대한 누진세 미리보기',
  'MONTHLY SALARY': '월급', Calculate: '계산',
  'TOTAL HOLIDAYS': '총 공휴일', 'THIS MONTH': '이번 달',
  'UPCOMING 30 DAYS': '향후 30일', 'WEEKEND OVERLAP': '주말 겹침',
  'Next month window': '다음 달', 'Falls on Sat/Sun': '토/일 해당',
  'Public Holidays (title)': '🗓️ 공휴일',
  Calendar: '📅 달력', List: '📋 목록', '+ Add Holiday': '+ 추가',
  Holiday: '공휴일', Weekend: '주말', Today: '오늘',
  SUN: '일', MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토',
  MANAGEMENT: '관리진', 'GROUP CHATS': '💬 그룹 채팅',
  'Branch Chat': '지점 채팅', 'All branch members': '전체 지점 멤버',
  'My Tasks': '내 태스크', 'Team Members': '팀 멤버',
  Online: '온라인', Offline: '오프라인',
  'Branch Staff': '지점 직원', 'Search name role branch': '이름, 역할 검색...', 'Office Address': '사무소 주소', 'No offices found': '사무소 없음',
  'Bracket Range': '세율 구간', 'Taxable Amount': '과세 금액', 'Effective Rate': '실효 세율', Breakdown: '상세 내역', Rate: '세율',
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
export const APP_LABELS: Record<AppLang, Record<AppLabelKey, string>> = {
  en, ja, my, km, vi, ko,
};

/**
 * Get label for a given language and key.
 * Falls back to English if not found.
 *
 * @example
 * getLabel('ja', 'Dashboard')        // → 'ダッシュボード'
 * getLabel('my', 'TOTAL HOLIDAYS')   // → 'အားလပ်ရက်စုစုပေါင်း'
 * getLabel('km', 'SUN')              // → 'អា'
 */
export function getLabel(lang: string | undefined | null, key: AppLabelKey): string {
  const safeLang = (lang && lang in APP_LABELS) ? (lang as AppLang) : 'en';
  return APP_LABELS[safeLang]?.[key] ?? APP_LABELS.en[key] ?? key;
}
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AnnouncementBarComponent } from '../../shared/announcement-bar.component';
import { BellNotificationComponent } from '../../shared/bell-notification.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;
const VP_BASE = `${BASE}/vp/dashboard`;

export type ApprovalTab = 'LEAVE' | 'OT' | 'SALARY' | 'EXPENSE';

export interface PendingApproval {
  id: number;
  type: ApprovalTab;
  staffName: string;
  staffInitial: string;
  avatarColor: string;
  subtitle: string;
  reason: string;
  dueText: string;
  priority: 'urgent' | 'soon' | 'normal';
}

export interface BranchProject {
  id: number;
  name: string;
  status: 'On Track' | 'At Risk' | 'Delayed';
  progress: number;
  ownerName: string;
  ownerInitial: string;
  ownerColor: string;
  dueDate: string;
  health: number;
}

export interface BranchMemberItem {
  id: number;
  name: string;
  role: string;
  initial: string;
  color: string;
  taskCount: number;
  online: boolean;
}

@Component({
  selector: 'app-vp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AnnouncementBarComponent,
    BellNotificationComponent
  ],
  templateUrl: './vp-dashboard.html',
  styleUrl: './vp-dashboard.scss'
})
export class VpDashboardComponent implements OnInit, OnDestroy {

  currentUser: any = null;
  branchName = 'Cambodia';
  isDark = true;

  langs = [
    { code: 'en', display: 'EN', name: 'English', flag: '🇺🇸' },
    { code: 'ja', display: 'JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'my', display: 'MM', name: 'Myanmar', flag: '🇲🇲' },
    { code: 'km', display: 'KH', name: 'Khmer', flag: '🇰🇭' },
    { code: 'vi', display: 'VN', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'ko', display: 'KR', name: 'Korean', flag: '🇰🇷' },
  ];
  currentLangObj = this.langs[0];
  showLangMenu = false;
  settingsOpen = false;
  searchQuery = '';
  myTasksMaxH = 300;

  activeApprovalTab: ApprovalTab = 'LEAVE';
  readonly approvalTabs: { key: ApprovalTab; label: string }[] = [
    { key: 'LEAVE',   label: 'Leave'   },
    { key: 'OT',      label: 'OT'      },
    { key: 'SALARY',  label: 'Salary'  },
    { key: 'EXPENSE', label: 'Expense' }
  ];

  loading = {
    stats: true,
    approvals: true,
    projects: true,
    members: true,
  };

  stats = {
    activeProjects: 0,
    totalStaff: 0,
    pendingApprovals: 0,
    monthlyOTHours: 0,
    monthlySpend: 0,
    onLeaveToday: 0,
  };

  approvalCounts: Record<ApprovalTab, number> = {
    LEAVE: 0, OT: 0, SALARY: 0, EXPENSE: 0
  };

  leaveApprovals:   PendingApproval[] = [];
  otApprovals:      PendingApproval[] = [];
  salaryApprovals:  PendingApproval[] = [];
  expenseApprovals: PendingApproval[] = [];

  branchProjects: BranchProject[] = [];
  teamMembers: BranchMemberItem[] = [];

  chartData = [
    { month: 'Nov', done: 0, inProgress: 0, todo: 0 },
    { month: 'Dec', done: 0, inProgress: 0, todo: 0 },
    { month: 'Jan', done: 0, inProgress: 0, todo: 0 },
    { month: 'Feb', done: 0, inProgress: 0, todo: 0 },
    { month: 'Mar', done: 0, inProgress: 0, todo: 0 },
    { month: 'Apr', done: 0, inProgress: 0, todo: 0 },
  ];

  donutData = [
    { label: 'To Do',       count: 0, color: '#6366f1' },
    { label: 'In Progress', count: 0, color: '#3b82f6' },
    { label: 'In Review',   count: 0, color: '#f59e0b' },
    { label: 'Done',        count: 0, color: '#22c55e' },
  ];

  overdueTasks: any[] = [];
  activities: any[] = [];
  deadlines: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('brycen-theme');
    this.setTheme(saved !== 'light');
    this.currentUser = this.auth.getUser();
    const savedLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];

    this.loadAll();
    this.updateMyTasksHeight();
  }

  ngOnDestroy(): void {}

  private get headers() {
    return this.auth.getHeaders();
  }

  // ──────────────────────────────────────────────
  // DATA LOADING — all use /api/vp/dashboard/*
  // ──────────────────────────────────────────────
  loadAll(): void {
    this.loadStats();
    this.loadLeaveRequests();
    this.loadOtRequests();
    this.loadExpenseApprovals('SALARY');
    this.loadExpenseApprovals('EXPENSE');
    this.loadBranchProjects();
    this.loadBranchMembers();
  }

  loadStats(): void {
    this.loading.stats = true;
    this.http.get<any>(`${VP_BASE}/stats`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[VP stats]', err); return of(null); }))
      .subscribe(s => {
        if (s) {
          this.stats.activeProjects   = Number(s.activeProjects ?? 0);
          this.stats.totalStaff       = Number(s.totalStaff ?? 0);
          this.stats.pendingApprovals = Number(s.totalPending ?? 0);
          this.stats.monthlyOTHours   = Number(s.monthlyOTHours ?? 0);
          this.stats.monthlySpend     = Number(s.monthlySpend ?? 0);
          this.stats.onLeaveToday     = Number(s.onLeaveToday ?? 0);

          this.approvalCounts.LEAVE   = Number(s.pendingLeave ?? 0);
          this.approvalCounts.OT      = Number(s.pendingOT ?? 0);
          this.approvalCounts.SALARY  = Number(s.pendingSalary ?? 0);
          this.approvalCounts.EXPENSE = Number(s.pendingExpense ?? 0);
        }
        this.loading.stats = false;
        this.cdr.detectChanges();
      });
  }

  loadLeaveRequests(): void {
    this.http.get<any[]>(`${VP_BASE}/leave-requests?status=PENDING`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[VP leave]', err); return of([]); }))
      .subscribe(list => {
        this.leaveApprovals = (list || []).map(lv => this.normalizeLeave(lv));
        this.approvalCounts.LEAVE = this.leaveApprovals.length;
        this.recomputeTotalPending();
        this.loading.approvals = false;
        this.cdr.detectChanges();
      });
  }

  loadOtRequests(): void {
    this.http.get<any[]>(`${VP_BASE}/ot-requests?status=PENDING`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[VP ot]', err); return of([]); }))
      .subscribe(list => {
        this.otApprovals = (list || []).map(ot => this.normalizeOt(ot));
        this.approvalCounts.OT = this.otApprovals.length;
        this.recomputeTotalPending();
        this.cdr.detectChanges();
      });
  }

  loadExpenseApprovals(type: 'SALARY' | 'EXPENSE'): void {
    this.http.get<any[]>(`${VP_BASE}/branch-expenses?status=PENDING&type=${type}`, { headers: this.headers })
      .pipe(catchError(err => { console.error(`[VP ${type}]`, err); return of([]); }))
      .subscribe(list => {
        const rows = (list || []).map(e => this.normalizeExpense(e, type));
        if (type === 'SALARY') {
          this.salaryApprovals = rows;
          this.approvalCounts.SALARY = rows.length;
        } else {
          this.expenseApprovals = rows;
          this.approvalCounts.EXPENSE = rows.length;
        }
        this.recomputeTotalPending();
        this.cdr.detectChanges();
      });
  }

  loadBranchProjects(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-projects`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[VP projects]', err); return of([]); }))
      .subscribe(list => {
        this.branchProjects = (list || []).map(p => this.normalizeProject(p));
        this.loading.projects = false;
        this.cdr.detectChanges();
      });
  }

  loadBranchMembers(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-members`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[VP members]', err); return of([]); }))
      .subscribe(list => {
        this.teamMembers = (list || []).map(m => this.normalizeMember(m));
        this.loading.members = false;
        this.cdr.detectChanges();
      });
  }

  // ──────────────────────────────────────────────
  // NORMALIZERS
  // ──────────────────────────────────────────────
  private normalizeLeave(lv: any): PendingApproval {
    const startDate = lv.startDate ? new Date(lv.startDate) : null;
    const endDate   = lv.endDate   ? new Date(lv.endDate)   : null;
    const daysFromNow = startDate
      ? Math.ceil((startDate.getTime() - Date.now()) / 86400000)
      : 99;

    return {
      id: lv.id,
      type: 'LEAVE',
      staffName: lv.userName || 'Unknown',
      staffInitial: lv.userInitial || '?',
      avatarColor: lv.userColor || '#64748b',
      subtitle: `${this.formatLeaveType(lv.leaveType)} · ${lv.totalDays} day${lv.totalDays > 1 ? 's' : ''}`,
      reason: lv.reason || 'No reason provided',
      dueText: this.formatDateRange(startDate, endDate),
      priority: daysFromNow <= 1 ? 'urgent' : daysFromNow <= 7 ? 'soon' : 'normal'
    };
  }

  private normalizeOt(ot: any): PendingApproval {
    const workDate = ot.workDate ? new Date(ot.workDate) : null;
    const daysFromNow = workDate
      ? Math.ceil((workDate.getTime() - Date.now()) / 86400000)
      : 99;

    return {
      id: ot.id,
      type: 'OT',
      staffName: ot.userName || 'Unknown',
      staffInitial: ot.userInitial || '?',
      avatarColor: ot.userColor || '#64748b',
      subtitle: `OT · ${ot.otHours} hrs ${ot.dayType ? '(' + ot.dayType + ')' : ''}`,
      reason: ot.reason || ot.projectName || 'No reason',
      dueText: workDate ? this.formatDate(workDate) : '—',
      priority: Math.abs(daysFromNow) <= 1 ? 'urgent' : Math.abs(daysFromNow) <= 7 ? 'soon' : 'normal'
    };
  }

  private normalizeExpense(e: any, type: 'SALARY' | 'EXPENSE'): PendingApproval {
    const date = e.date ? new Date(e.date) : null;
    const isOverdue = date && date.getTime() < Date.now();

    const label = type === 'SALARY' ? 'Salary' : 'Expense';
    const title = type === 'SALARY'
      ? (e.description?.slice(0, 40) || 'Monthly Payroll')
      : (e.description?.slice(0, 40) || 'Expense');

    return {
      id: e.id,
      type,
      staffName: title,
      staffInitial: type === 'SALARY' ? '$' : 'E',
      avatarColor: type === 'SALARY' ? '#22c55e' : '#f59e0b',
      subtitle: `${label} · ${e.currency || 'USD'} ${Number(e.amount || 0).toLocaleString()}`,
      reason: e.createdByName ? `Submitted by ${e.createdByName}` : '—',
      dueText: date ? this.formatDate(date) : '—',
      priority: isOverdue ? 'urgent' : 'soon'
    };
  }

  private normalizeProject(p: any): BranchProject {
    const progress = Number(p.progress ?? 0);
    const endDate  = p.endDate ? new Date(p.endDate) : null;
    const daysLeft = endDate
      ? Math.ceil((endDate.getTime() - Date.now()) / 86400000)
      : 999;

    let status: 'On Track' | 'At Risk' | 'Delayed' = 'On Track';
    if (daysLeft < 0) status = 'Delayed';
    else if (daysLeft < 14 && progress < 70) status = 'At Risk';
    else if (progress < 30 && daysLeft < 30) status = 'At Risk';

    return {
      id: p.id,
      name: p.title || 'Untitled',
      status,
      progress,
      ownerName: p.pmName || 'Unassigned',
      ownerInitial: p.pmInitial || '?',
      ownerColor: p.pmColor || '#64748b',
      dueDate: endDate ? this.formatDate(endDate) : '—',
      health: this.calcHealth(status, progress, daysLeft)
    };
  }

  private normalizeMember(m: any): BranchMemberItem {
    return {
      id: m.id,
      name: m.name || 'Unknown',
      role: this.shortRole(m.role || ''),
      initial: m.initial || '?',
      color: m.color || '#64748b',
      taskCount: m.taskCount || 0,
      online: m.online === true
    };
  }

  // ──────────────────────────────────────────────
  // APPROVE / REJECT
  // ──────────────────────────────────────────────
  approveApproval(a: PendingApproval): void {
    const url = this.approveUrl(a);
    if (!url) return;

    this.http.patch(url, {}, { headers: this.headers })
      .pipe(catchError(err => { console.error('[approve]', err); alert('Failed to approve. Try again.'); return of(null); }))
      .subscribe(res => {
        if (res !== null) {
          this.removeApprovalLocally(a);
          this.loadStats();
        }
      });
  }

  rejectApproval(a: PendingApproval): void {
    const url = this.rejectUrl(a);
    if (!url) return;

    this.http.patch(url, { reason: 'Rejected by VP' }, { headers: this.headers })
      .pipe(catchError(err => { console.error('[reject]', err); alert('Failed to reject. Try again.'); return of(null); }))
      .subscribe(res => {
        if (res !== null) {
          this.removeApprovalLocally(a);
          this.loadStats();
        }
      });
  }

  private approveUrl(a: PendingApproval): string | null {
    switch (a.type) {
      case 'LEAVE':   return `${VP_BASE}/leave-requests/${a.id}/approve`;
      case 'OT':      return `${VP_BASE}/ot-requests/${a.id}/approve`;
      case 'SALARY':
      case 'EXPENSE': return `${VP_BASE}/branch-expenses/${a.id}/approve`;
      default: return null;
    }
  }

  private rejectUrl(a: PendingApproval): string | null {
    switch (a.type) {
      case 'LEAVE':   return `${VP_BASE}/leave-requests/${a.id}/reject`;
      case 'OT':      return `${VP_BASE}/ot-requests/${a.id}/reject`;
      case 'SALARY':
      case 'EXPENSE': return `${VP_BASE}/branch-expenses/${a.id}/reject`;
      default: return null;
    }
  }

  private removeApprovalLocally(a: PendingApproval): void {
    const list = this.getList(a.type);
    const idx = list.findIndex(x => x.id === a.id);
    if (idx > -1) list.splice(idx, 1);
    this.approvalCounts[a.type] = list.length;
    this.recomputeTotalPending();
    this.cdr.detectChanges();
  }

  private getList(type: ApprovalTab): PendingApproval[] {
    switch (type) {
      case 'LEAVE':   return this.leaveApprovals;
      case 'OT':      return this.otApprovals;
      case 'SALARY':  return this.salaryApprovals;
      case 'EXPENSE': return this.expenseApprovals;
    }
  }

  private recomputeTotalPending(): void {
    this.stats.pendingApprovals =
      this.approvalCounts.LEAVE +
      this.approvalCounts.OT +
      this.approvalCounts.SALARY +
      this.approvalCounts.EXPENSE;
  }

  // ──────────────────────────────────────────────
  // GETTERS
  // ──────────────────────────────────────────────
  get filteredPendingApprovals(): PendingApproval[] {
    return this.getList(this.activeApprovalTab);
  }

  get totalPendingCount(): number {
    return this.stats.pendingApprovals;
  }

  get donutTotal(): number {
    return this.donutData.reduce((s, d) => s + d.count, 0);
  }

  // ──────────────────────────────────────────────
  // THEME / LANG / TABS
  // ──────────────────────────────────────────────
  setTheme(dark: boolean): void {
    this.isDark = dark;
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('brycen-theme', dark ? 'dark' : 'light');
  }

  toggleTheme(): void { this.setTheme(!this.isDark); }
  selectLang(lang: any): void { this.currentLangObj = lang; this.showLangMenu = false; }
  setApprovalTab(tab: ApprovalTab): void { this.activeApprovalTab = tab; }

  // ──────────────────────────────────────────────
  // CHART / DONUT HELPERS
  // ──────────────────────────────────────────────
  getBarMaxVal(): number {
    return Math.max(1, ...this.chartData.map(d => d.done + d.inProgress + d.todo));
  }

  getBarHeight(val: number, max: number): number {
    return max === 0 ? 0 : (val / max) * 100;
  }

  getDonutDashArray(count: number): string {
    const total = this.donutTotal;
    if (total === 0) return '0 100';
    const pct = (count / total) * 100;
    return `${pct} ${100 - pct}`;
  }

  getDonutOffset(index: number): number {
    let offset = 25;
    const total = this.donutTotal;
    for (let i = 0; i < index; i++) {
      offset -= total === 0 ? 0 : (this.donutData[i].count / total) * 100;
    }
    return ((offset % 100) + 100) % 100;
  }

  // ──────────────────────────────────────────────
  // STATUS / STYLE HELPERS
  // ──────────────────────────────────────────────
  getStatusColor(status: string): string {
    return status === 'On Track' ? '#22c55e'
         : status === 'At Risk'  ? '#f59e0b'
         : '#ef4444';
  }

  getProgressGradient(status: string): string {
    return status === 'On Track' ? 'linear-gradient(90deg,#3b82f6,#6366f1)'
         : status === 'At Risk'  ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
         : 'linear-gradient(90deg,#ef4444,#f87171)';
  }

  getHealthDots(health: number): number[] { return [0, 1, 2, 3, 4]; }

  getHealthDotColor(i: number, health: number): string {
    if (i >= health) return '#1e2d4a';
    return health >= 4 ? '#22c55e' : health >= 2 ? '#f59e0b' : '#ef4444';
  }

  getRoleBadgeStyle(role: string): { [k: string]: string } {
    const map: Record<string, string> = {
      'PM': '#22c55e', 'Leader': '#06b6d4', 'Dev': '#6366f1',
      'UI/UX': '#ec4899', 'QA': '#f97316', 'Admin': '#ec4899',
      'VP': '#0ea5e9', 'CD': '#a855f7'
    };
    const c = map[role] || '#64748b';
    return { background: `${c}22`, color: c };
  }

  // ──────────────────────────────────────────────
  // UTILITIES
  // ──────────────────────────────────────────────
  private formatLeaveType(type: string): string {
    const map: Record<string, string> = {
      ANNUAL: '🏖 Annual leave',
      SICK:   '🤒 Sick leave',
      UNPAID: '💼 Unpaid leave'
    };
    return map[type] || type || 'Leave';
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatDateRange(start: Date | null, end: Date | null): string {
    if (!start && !end) return '—';
    if (!end || start?.getTime() === end?.getTime()) return this.formatDate(start!);
    return `${this.formatDate(start!)} — ${this.formatDate(end!)}`;
  }

  private shortRole(fullRole: string): string {
    const map: Record<string, string> = {
      'Project Manager':  'PM',
      'Leader':           'Leader',
      'Developer':        'Dev',
      'UI/UX Designer':   'UI/UX',
      'QA Engineer':      'QA',
      'Admin':            'Admin',
      'Vice President':   'VP',
      'Country Director': 'CD'
    };
    return map[fullRole] || fullRole?.slice(0, 8) || '—';
  }

  private calcHealth(status: string, progress: number, daysLeft: number): number {
    if (status === 'Delayed') return 1;
    if (status === 'At Risk') return 2;
    if (progress >= 80) return 5;
    if (progress >= 50) return 4;
    return 3;
  }

  private updateMyTasksHeight(): void {
    setTimeout(() => {
      this.myTasksMaxH = Math.floor(window.innerHeight * 0.42);
      this.cdr.detectChanges();
    }, 0);
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AnnouncementBarComponent } from '../../shared/announcement-bar.component';
import { ProjectInlineComponent } from '../../projects/project-inline';
import { BellNotificationComponent } from '../../shared/bell-notification.component';
import { ApprovalInboxInline } from '../../shared/approval-inbox-inline';
import { ChatPopupComponent, ChatMember } from '../../shared/chat-popup/chat-popup.component';
import { PayslipModalComponent } from '../../shared/payslip-modal.component';
import { StaffListInline } from '../../admin/staff-list-inline';
import { StaffProfileInline } from '../../admin/staff-profile-inline';
import { StaffPanelComponent } from '../../shared/staff-panel/staff-panel.component';
import { AuthService } from '../../services/auth.service';
import { RefreshService } from '../../services/refresh.service';
import { NavigationStateService } from '../../services/navigation-state.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;
const VP_BASE = `${BASE}/vp/dashboard`;

export type ApprovalTab = 'LEAVE' | 'OT' | 'SALARY';

export interface PendingApproval {
  id: number; type: ApprovalTab;
  staffName: string; staffInitial: string; avatarColor: string;
  subtitle: string; reason: string; dueText: string;
  priority: 'urgent' | 'soon' | 'normal';
}

export interface BranchProject {
  id: number; name: string;
  status: 'On Track' | 'At Risk' | 'Delayed';
  progress: number; ownerName: string; ownerInitial: string;
  ownerColor: string; dueDate: string; health: number;
}

export interface BranchMemberItem {
  id: number; name: string; role: string; rawRole: string;
  initial: string; color: string; taskCount: number; online: boolean;
  management: boolean;  // true = BOSS/CD/VP (cross-branch)
}

export interface DepartmentItem {
  id: number;
  name: string;
}

@Component({
  selector: 'app-vp-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    AnnouncementBarComponent, BellNotificationComponent, ProjectInlineComponent,
    ApprovalInboxInline, ChatPopupComponent, PayslipModalComponent,
    StaffListInline, StaffProfileInline, StaffPanelComponent,
  ],
  templateUrl: './vp-dashboard.html',
  styleUrl: './vp-dashboard.scss'
})
export class VpDashboardComponent implements OnInit, OnDestroy {

  private _refreshSub?: Subscription;
  currentUser: any = null;
  isDark = true;
  activeView = 'dashboard';

  activeChatMember: ChatMember | null = null;
  selectedStaffId = 0;

  // ── Project Inline ────────────────────────────────────────────
  showProjectDetail = false;
  selectedProjectId: number | null = null;

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
  branchUnreadCount = 0;

  // ── Approval tabs ────────────────────────────────────────────
  activeApprovalTab: ApprovalTab = 'LEAVE';
  readonly approvalTabs: { key: ApprovalTab; label: string }[] = [
    { key: 'LEAVE', label: 'Leave' },
    { key: 'OT', label: 'OT' },
    { key: 'SALARY', label: 'Salary' },
  ];

  loading = { stats: true, approvals: true, projects: true, members: true };
  stats = {
    activeProjects: 0, totalStaff: 0, pendingApprovals: 0,
    monthlyOTHours: 0, monthlySpend: 0, onLeaveToday: 0,
  };
  approvalCounts: Record<ApprovalTab, number> = { LEAVE: 0, OT: 0, SALARY: 0 };

  leaveApprovals: PendingApproval[] = [];
  otApprovals: PendingApproval[] = [];
  salaryApprovals: PendingApproval[] = [];
  branchProjects: BranchProject[] = [];
  teamMembers: BranchMemberItem[] = [];
  projectUnreadCounts: Record<number, number> = {};  // projectId → unread count
  memberUnreadCounts: Record<number, number> = {};   // userId → unread count
  private _unreadPollTimer: any = null;
  allAnnouncements: any[] = [];

  // ── Salary approvals — period list ─────────────────────────────
  salaryPeriods: any[]        = [];   // dashboard card (PENDING only)
  salaryHistoryPeriods: any[] = [];   // sidebar view (ALL periods)
  salaryActing: { [period: string]: boolean } = {};
  loadingSalary = false;

  // ── Salary Detail ─────────────────────────────────────────────
  selectedSalaryPeriod: any = null;
  salaryDetailRows: any[] = [];
  loadingSalaryDetail = false;
  hoveredRow: number | string | null = null;

  // ✅ After — all periods combined summary
  get salaryApproval(): any {
    if (this.salaryPeriods.length === 0) return null;
    if (this.salaryPeriods.length === 1) return this.salaryPeriods[0];
    const totalGross = this.salaryPeriods.reduce((s, p) => s + (p.totalGross || 0), 0);
    const totalTax   = this.salaryPeriods.reduce((s, p) => s + (p.totalTax   || 0), 0);
    const totalNet   = this.salaryPeriods.reduce((s, p) => s + (p.totalNet   || 0), 0);
    return {
      staffCount: this.salaryPeriods[0].staffCount,
      payPeriod: `${this.salaryPeriods.length} periods`,
      currency: this.salaryPeriods[0].currency,
      totalGross, totalTax, totalNet,
    };
  }

  // ── Payslip modal ────────────────────────────────────────────
  payslipOpen = false;
  payslipRecordId: number | null = null;

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

  // ── History views ────────────────────────────────────────────
  historyFilter = 'ALL';
  loadingHistory = false;
  historyLeave: any[] = [];
  historyOt: any[] = [];

  // ── Pay period ───────────────────────────────────────────────
  periodFrom = '';
  periodTo = '';
  periodLabel = '';
  customFrom = '';
  customTo = '';
  useCustom = false;

  // ── Search filters ───────────────────────────────────────────
  searchName = '';
  searchFrom = '';
  searchTo = '';
  searchDeptId: number | null = null;
  departments: DepartmentItem[] = [];

  // ══════════════════════════════════════════════════════════════
  // ACTIVE CHECK HELPERS
  // ══════════════════════════════════════════════════════════════

  isActiveLeave(r: any): boolean {
    if (!r.endDate) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(r.endDate) >= today;
  }

  isActiveOt(r: any): boolean {
    if (!r.workDate) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(r.workDate) >= today;
  }

  // ══════════════════════════════════════════════════════════════
  // SORT RANK HELPERS
  // ══════════════════════════════════════════════════════════════

  private leaveRank(r: any): number {
    if (r.status === 'PENDING') return 0;
    if (r.status === 'APPROVED' && this.isActiveLeave(r)) return 1;
    return 2;
  }

  private otRank(r: any): number {
    if (r.status === 'PENDING') return 0;
    if (r.status === 'APPROVED' && this.isActiveOt(r)) return 1;
    return 2;
  }

  get sortedLeave(): any[] {
    return [...this.historyLeave].sort((a, b) => this.leaveRank(a) - this.leaveRank(b));
  }

  get sortedOt(): any[] {
    return [...this.historyOt].sort((a, b) => this.otRank(a) - this.otRank(b));
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private refreshService: RefreshService,
    private navState: NavigationStateService,
    private ngZone: NgZone,
  ) { }

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════

  ngOnInit(): void {
    const theme = localStorage.getItem('brycen-theme');
    this.setTheme(theme !== 'light');
    this.currentUser = this.auth.getUser();
    this.currentLangObj = this.langs.find(l => l.code === (this.currentUser?.preferredLanguage || 'en')) || this.langs[0];
    this.loadAll();
    this.updateMyTasksHeight();

    // ✅ Restore navigation state (e.g. back from Board/Design/API/Activity page)
    const navSaved = this.navState.restoreProjectState();
    if (navSaved.showProject && navSaved.projectId && navSaved.dashboard === 'vp') {
      setTimeout(() => {
        this.openProject(navSaved.projectId!);
        this.navState.clearProjectState();
      }, 300);
    }

    this._refreshSub = this.refreshService.refresh$.subscribe(() => {
      this.loadStats();
      this.loadLeaveRequests();
      this.loadOtRequests();
        this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this._refreshSub?.unsubscribe();
    this.stopUnreadPolling();
  }

  private get headers() { return this.auth.getHeaders(); }

  // ══════════════════════════════════════════════════════════════
  // VIEW ROUTING
  // ══════════════════════════════════════════════════════════════

  setView(view: string): void {
    this.activeView = view;

    if (view === 'announcements') { this.loadAnnouncements(); }
    if (view === 'members') { /* staff-list-inline loads itself */ }

    // ✅ FIX: salary-approvals view ဝင်တဲ့အချိန်မှသာ load လုပ်
    //         loadingSalary ကို explicit reset လုပ်ပြီး ဟောင်းတဲ့ data clear
    if (view === 'salary-approvals') {
      this.loadingSalary = true;
      // ✅ salaryPeriods မ clear မလုပ်ဘဲ — reload ပြီးမှ replace ဖြစ်မည်
      this.loadSalaryApprovals();
    }

    if (view === 'salary-detail') {
      // selectedSalaryPeriod ကို openSalaryDetail() မှာ သတ်မှတ်ပြီးပြီ
      this.loadSalaryDetail();
    }

    if (view === 'view-leave') {
      this.historyFilter = 'ALL';
      this.useCustom = false;
      this.resetSearch();
      const p = this.getCurrentPayPeriod();
      this.periodFrom = this.fmtDate(p.from);
      this.periodTo   = this.fmtDate(p.to);
      this.periodLabel = p.label;
      this.loadDepartments();
      this.loadHistoryLeave();
    }

    if (view === 'view-ot') {
      this.historyFilter = 'ALL';
      this.useCustom = false;
      this.resetSearch();
      const p = this.getCurrentPayPeriod();
      this.periodFrom = this.fmtDate(p.from);
      this.periodTo   = this.fmtDate(p.to);
      this.periodLabel = p.label;
      this.loadDepartments();
      this.loadHistoryOt();
    }

    this.cdr.detectChanges();
  }

  resetSearch(): void {
    this.searchName = '';
    this.searchFrom = '';
    this.searchTo   = '';
    this.searchDeptId = null;
  }

  applySearch(): void {
    if (this.activeView === 'view-leave') this.loadHistoryLeave();
    if (this.activeView === 'view-ot')    this.loadHistoryOt();
    this.cdr.detectChanges();
  }

  clearSearch(): void {
    this.resetSearch();
    if (this.activeView === 'view-leave') this.loadHistoryLeave();
    if (this.activeView === 'view-ot')    this.loadHistoryOt();
    this.cdr.detectChanges();
  }

  // ══════════════════════════════════════════════════════════════
  // PAY PERIOD UTILS
  // ══════════════════════════════════════════════════════════════

  getCurrentPayPeriod(): { from: Date; to: Date; label: string } {
    const today = new Date();
    const d = today.getDate();
    let fromY: number, fromM: number, toY: number, toM: number;

    if (d >= 25) {
      fromY = today.getFullYear(); fromM = today.getMonth();
      toY   = today.getFullYear(); toM   = today.getMonth() + 1;
    } else {
      fromY = today.getFullYear(); fromM = today.getMonth() - 1;
      toY   = today.getFullYear(); toM   = today.getMonth();
    }

    if (fromM < 0)  { fromM = 11; fromY--; }
    if (toM   > 11) { toM   = 0;  toY++;   }

    const from  = new Date(fromY, fromM, 25);
    const to    = new Date(toY,   toM,   24);
    const label = to.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  shiftPayPeriod(delta: number): void {
    const from = new Date(this.periodFrom);
    const to   = new Date(this.periodTo);
    from.setMonth(from.getMonth() + delta);
    to.setMonth(to.getMonth()     + delta);
    this.periodFrom  = this.fmtDate(from);
    this.periodTo    = this.fmtDate(to);
    this.periodLabel = to.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.reloadHistory();
  }

  reloadHistory(): void {
    if (this.activeView === 'view-leave')   this.loadHistoryLeave();
    if (this.activeView === 'view-ot')      this.loadHistoryOt();
  }

  fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ══════════════════════════════════════════════════════════════
  // DEPARTMENTS
  // ══════════════════════════════════════════════════════════════

  loadDepartments(): void {
    if (this.departments.length > 0) return;
    this.http.get<DepartmentItem[]>(`${VP_BASE}/departments`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.departments = list || []; this.cdr.detectChanges(); });
  }

  // ══════════════════════════════════════════════════════════════
  // QUERY BUILDERS
  // ══════════════════════════════════════════════════════════════

  private buildLeaveQuery(): string {
    const p: string[] = [];
    if (this.historyFilter !== 'ALL') p.push(`status=${this.historyFilter}`);
    if (this.searchName.trim()) p.push(`name=${encodeURIComponent(this.searchName.trim())}`);
    if (this.searchDeptId) p.push(`departmentId=${this.searchDeptId}`);
    return p.length ? '?' + p.join('&') : '';
  }

  private buildOtQuery(): string {
    const p: string[] = [];
    if (this.historyFilter !== 'ALL') p.push(`status=${this.historyFilter}`);
    if (this.searchName.trim()) p.push(`name=${encodeURIComponent(this.searchName.trim())}`);
    if (this.searchDeptId) p.push(`departmentId=${this.searchDeptId}`);
    return p.length ? '?' + p.join('&') : '';
  }

  // ══════════════════════════════════════════════════════════════
  // HISTORY LOADERS
  // ══════════════════════════════════════════════════════════════

  loadHistoryLeave(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${VP_BASE}/leave-requests${this.buildLeaveQuery()}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.historyLeave    = list || [];
        this.loadingHistory  = false;
        this.cdr.detectChanges();
      });
  }

  loadHistoryOt(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${VP_BASE}/ot-requests${this.buildOtQuery()}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.historyOt      = list || [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
      });
  }// ── History item actions ─────────────────────────────────────
  approveLeaveItem(r: any): void {
    this.http.patch(`${VP_BASE}/leave-requests/${r.id}/approve`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(res => { if (res !== null) { this.loadHistoryLeave(); this.loadStats(); } });
  }
  rejectLeaveItem(r: any): void {
    this.http.patch(`${VP_BASE}/leave-requests/${r.id}/reject`, { reason: 'Rejected by VP' }, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(res => { if (res !== null) { this.loadHistoryLeave(); this.loadStats(); } });
  }
  approveOtItem(r: any): void {
    this.http.patch(`${VP_BASE}/ot-requests/${r.id}/approve`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(res => { if (res !== null) { this.loadHistoryOt(); this.loadStats(); } });
  }
  rejectOtItem(r: any): void {
    this.http.patch(`${VP_BASE}/ot-requests/${r.id}/reject`, { reason: 'Rejected by VP' }, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(res => { if (res !== null) { this.loadHistoryOt(); this.loadStats(); } });
  }
  openPayrollApprovals(): void  { this.activeView = 'payroll-approvals'; this.cdr.detectChanges(); }
  closePayrollApprovals(): void { this.activeView = 'dashboard';          this.cdr.detectChanges(); }

  // ══════════════════════════════════════════════════════════════
  // ✅ SALARY APPROVALS — period list
  // ══════════════════════════════════════════════════════════════

  // ✅ Dashboard card — PENDING_APPROVAL only, no spinner
  //    GET /api/vp/dashboard/salary-approvals
  // Dashboard card — PENDING_APPROVAL only → salaryPeriods
  loadSalaryDashboard(): void {
    this.http.get<any[]>(`${VP_BASE}/salary-approvals`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.salaryPeriods         = data || [];
        this.approvalCounts.SALARY = this.salaryPeriods.length;
        this.recomputeTotalPending();
        this.cdr.detectChanges();
      });
  }

  // Sidebar view — ALL periods → salaryHistoryPeriods (badge မပြောင်း)
  loadSalaryApprovals(): void {
    this.loadingSalary = true;
    this.http.get<any[]>(`${VP_BASE}/salary-history`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.salaryHistoryPeriods = data || [];
        this.loadingSalary        = false;
        this.cdr.detectChanges();
      });
  }

  approveSalaryPeriod(p: any): void {
    this.salaryActing[p.payPeriod] = true;
    const payload = { branchId: p.branchId, payPeriod: p.payPeriod };
    this.http.post(`${BASE}/payroll/batch/approve`, payload, { headers: this.headers })
      .pipe(catchError(() => {
        alert('Failed to approve.');
        this.salaryActing[p.payPeriod] = false;
        this.cdr.detectChanges();
        return of(null);
      }))
      .subscribe(r => {
        this.salaryActing[p.payPeriod] = false;
        this.cdr.detectChanges();
        if (r !== null) {
          this.loadSalaryDashboard();    // dashboard card — PENDING only
          this.loadSalaryApprovals();    // sidebar view — ALL history
          this.loadStats();
        }
      });
  }

  rejectSalaryPeriod(p: any): void {
    const reason = prompt('Reject reason (optional):') ?? 'Rejected by VP';
    this.salaryActing[p.payPeriod] = true;
    const payload = { branchId: p.branchId, payPeriod: p.payPeriod, note: reason };
    this.http.post(`${BASE}/payroll/batch/reject`, payload, { headers: this.headers })
      .pipe(catchError(() => {
        alert('Failed to reject.');
        this.salaryActing[p.payPeriod] = false;
        this.cdr.detectChanges();
        return of(null);
      }))
      .subscribe(r => {
        this.salaryActing[p.payPeriod] = false;
        this.cdr.detectChanges();
        if (r !== null) {
          this.loadSalaryDashboard();
          this.loadSalaryApprovals();
          this.loadStats();
        }
      });
  }

  // ✅ Open salary detail for a period
  openSalaryDetail(p: any): void {
    this.selectedSalaryPeriod = p;
    this.setView('salary-detail');
  }

  // ✅ Load staff breakdown for selected period
  loadSalaryDetail(): void {
    if (!this.selectedSalaryPeriod) return;
    this.loadingSalaryDetail = true;
    this.salaryDetailRows = [];
    const period = this.selectedSalaryPeriod.payPeriod;
    this.http.get<any[]>(`${VP_BASE}/salary-detail?payPeriod=${period}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.salaryDetailRows = data || [];
        this.loadingSalaryDetail = false;
        this.cdr.detectChanges();
      });
  }

  approveSalaryBatch(): void { if (this.salaryPeriods.length > 0) this.approveSalaryPeriod(this.salaryPeriods[0]); }
  rejectSalaryBatch():  void { if (this.salaryPeriods.length > 0) this.rejectSalaryPeriod(this.salaryPeriods[0]);  }
  get salaryActingAny(): boolean { return Object.values(this.salaryActing).some(v => v); }

  // ══════════════════════════════════════════════════════════════
  // PAYSLIP MODAL
  // ══════════════════════════════════════════════════════════════

  openPayslip(recordId: number): void {
    this.payslipRecordId = recordId; this.payslipOpen = true; this.cdr.detectChanges();
  }
  closePayslip(): void {
    this.payslipOpen = false; this.payslipRecordId = null; this.cdr.detectChanges();
  }

  // ══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════════════════════════════

  loadAll(): void {
    this.loadStats();
    this.loadLeaveRequests();
    this.loadOtRequests();
    this.loadSalaryDashboard();   // ✅ dashboard card အတွက် — loadingSalary မသုံး
    this.loadBranchProjects();
    this.loadBranchMembers();
  }

  loadStats(): void {
    this.loading.stats = true;
    this.http.get<any>(`${VP_BASE}/stats`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.stats.activeProjects   = Number(s.activeProjects ?? 0);
          this.stats.totalStaff       = Number(s.totalStaff     ?? 0);
          this.stats.pendingApprovals = Number(s.totalPending   ?? 0);
          this.stats.monthlyOTHours   = Number(s.monthlyOTHours ?? 0);
          this.stats.monthlySpend     = Number(s.monthlySpend   ?? 0);
          this.stats.onLeaveToday     = Number(s.onLeaveToday   ?? 0);
          this.approvalCounts.LEAVE   = Number(s.pendingLeave   ?? 0);
          this.approvalCounts.OT      = Number(s.pendingOT      ?? 0);
          this.approvalCounts.SALARY  = Number(s.pendingSalary  ?? 0);
          this.recomputeTotalPending();
        }
        this.loading.stats = false; this.cdr.detectChanges();
      });
  }

  loadLeaveRequests(): void {
    this.http.get<any[]>(`${VP_BASE}/leave-requests?status=PENDING`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.leaveApprovals        = (list || []).map(lv => this.normalizeLeave(lv));
        this.approvalCounts.LEAVE  = this.leaveApprovals.length;
        this.recomputeTotalPending();
        this.loading.approvals = false;
        this.cdr.detectChanges();
      });
  }

  loadOtRequests(): void {
    this.http.get<any[]>(`${VP_BASE}/ot-requests?status=PENDING`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.otApprovals      = (list || []).map(ot => this.normalizeOt(ot));
        this.approvalCounts.OT = this.otApprovals.length;
        this.recomputeTotalPending();
        this.cdr.detectChanges();
      });
  }
  loadBranchProjects(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-projects`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.branchProjects    = (list || []).map(p => this.normalizeProject(p));
        this.loading.projects  = false;
        this.cdr.detectChanges();
        this.loadProjectUnreadCounts();
        this.startUnreadPolling();
      });
  }

  // ✅ Poll unread counts every 5 seconds (outside Angular zone — no extra CD cycles)
  startUnreadPolling(): void {
    this.stopUnreadPolling();
    this.ngZone.runOutsideAngular(() => {
      this._unreadPollTimer = setInterval(() => {
        this.ngZone.run(() => this.loadProjectUnreadCounts());
      }, 10000);
    });
  }

  stopUnreadPolling(): void {
    if (this._unreadPollTimer) {
      clearInterval(this._unreadPollTimer);
      this._unreadPollTimer = null;
    }
  }

  // ✅ Fetch unread count per project for group chat badges
  loadProjectUnreadCounts(): void {
    this.loadMemberUnreadCounts();
    // ✅ Branch Chat unread
    const branchId = this.currentUser?.branchId;
    if (branchId) {
      this.http.get<any>(
        `${BASE}/chat/unread?type=BRANCH&channelId=${branchId}`,
        { headers: this.headers }
      ).pipe(catchError(() => of({ unreadCount: 0 }))).subscribe(res => {
        this.branchUnreadCount = res?.unreadCount || 0;
        this.cdr.detectChanges();
      });
    }
    // ✅ Batch — project တစ်ခုချင်းစီ call မလုပ်ဘဲ တစ်ကြိမ်တည်း
    if (this.branchProjects.length === 0) return;
    const ids = this.branchProjects.map(p => p.id).join(',');
    this.http.get<any[]>(
      `${BASE}/chat/unread-batch?type=PROJECT&channelIds=${ids}`,
      { headers: this.headers }
    ).pipe(catchError(() => of([]))).subscribe(res => {
      (res || []).forEach((r: any) => {
        this.projectUnreadCounts[r.channelId] = r.unreadCount || 0;
      });
      this.cdr.detectChanges();
    });
  }

  // ✅ Fetch unread DM count per member
  // DIRECT channel_id = VP ကိုယ်တိုင်ရဲ့ userId (receiver)
  // sender filter — messages where sender_id = m.id AND channel_id = myId
  loadMemberUnreadCounts(): void {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    // Fetch all unread for my DIRECT channel (channelId = myId)
    // then group by sender_id
    this.http.get<any[]>(
      `${BASE}/chat/direct-unread-by-sender?userId=${myId}`,
      { headers: this.headers }
    ).pipe(catchError(() => of([]))).subscribe(res => {
      // res = [{ senderId, unreadCount }]
      this.memberUnreadCounts = {};
      (res || []).forEach((r: any) => {
        this.memberUnreadCounts[r.senderId] = r.unreadCount;
      });
      this.cdr.detectChanges();
    });
  }

  loadBranchMembers(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-members`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        const mapped = (list || []).map(m => this.normalizeMember(m));
        this.teamMembers = mapped.sort((a, b) => this.getMemberRoleOrder(a.rawRole) - this.getMemberRoleOrder(b.rawRole));
        this.loadMemberUnreadCounts();
        this.loading.members  = false;
        this.cdr.detectChanges();
      });
  }

  loadAnnouncements(): void {
    this.http.get<any[]>(`${BASE}/dashboard/pm/announcements/all`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.allAnnouncements = list || []; this.cdr.detectChanges(); });
  }

  // ══════════════════════════════════════════════════════════════
  // NORMALIZERS
  // ══════════════════════════════════════════════════════════════

  private normalizeLeave(lv: any): PendingApproval {
    const s = lv.startDate ? new Date(lv.startDate) : null;
    const e = lv.endDate   ? new Date(lv.endDate)   : null;
    const d = s ? Math.ceil((s.getTime() - Date.now()) / 86400000) : 99;
    return {
      id: lv.id, type: 'LEAVE', staffName: lv.userName || 'Unknown',
      staffInitial: lv.userInitial || '?', avatarColor: lv.userColor || '#64748b',
      subtitle: `${this.formatLeaveType(lv.leaveType)} · ${lv.totalDays} day${lv.totalDays > 1 ? 's' : ''}`,
      reason: lv.reason || 'No reason', dueText: this.formatDateRange(s, e),
      priority: d <= 1 ? 'urgent' : d <= 7 ? 'soon' : 'normal',
    };
  }

  private normalizeOt(ot: any): PendingApproval {
    const w = ot.workDate ? new Date(ot.workDate) : null;
    const d = w ? Math.ceil((w.getTime() - Date.now()) / 86400000) : 99;
    return {
      id: ot.id, type: 'OT', staffName: ot.userName || 'Unknown',
      staffInitial: ot.userInitial || '?', avatarColor: ot.userColor || '#64748b',
      subtitle: `OT · ${ot.otHours} hrs ${ot.dayType ? '(' + ot.dayType + ')' : ''}`,
      reason: ot.reason || ot.projectName || 'No reason',
      dueText: w ? this.formatDate(w) : '—',
      priority: Math.abs(d) <= 1 ? 'urgent' : Math.abs(d) <= 7 ? 'soon' : 'normal',
    };
  }

  private normalizeProject(p: any): BranchProject {
    const prog = Number(p.progress ?? 0);
    const ed   = p.endDate ? new Date(p.endDate) : null;
    const dl   = ed ? Math.ceil((ed.getTime() - Date.now()) / 86400000) : 999;
    let st: 'On Track' | 'At Risk' | 'Delayed' = 'On Track';
    if      (dl < 0)                    st = 'Delayed';
    else if (dl < 14 && prog < 70)      st = 'At Risk';
    else if (prog < 30 && dl < 30)      st = 'At Risk';
    return {
      id: p.id, name: p.title || 'Untitled', status: st, progress: prog,
      ownerName:    p.pmName    || 'Unassigned',
      ownerInitial: p.pmInitial || '?',
      ownerColor:   p.pmColor   || '#64748b',
      dueDate: ed ? this.formatDate(ed) : '—',
      health:  this.calcHealth(st, prog, dl),
    };
  }

  private normalizeMember(m: any): BranchMemberItem {
    return {
      id: m.id, name: m.name || 'Unknown',
      role: m.role || 'Staff',
      rawRole: m.rawRole || '',
      initial: m.initial || '?', color: m.color || '#64748b',
      taskCount: m.taskCount || 0, online: m.online === true,
      management: m.management === true,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // APPROVE / REJECT (inbox cards — Leave / OT / Expense)
  // ══════════════════════════════════════════════════════════════

  approveApproval(a: PendingApproval): void {
    const url = this.approveUrl(a); if (!url) return;
    this.http.patch(url, {}, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed.'); return of(null); }))
      .subscribe(r => { if (r !== null) { this.removeApprovalLocally(a); this.loadStats(); } });
  }

  rejectApproval(a: PendingApproval): void {
    const url = this.rejectUrl(a); if (!url) return;
    this.http.patch(url, { reason: 'Rejected by VP' }, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed.'); return of(null); }))
      .subscribe(r => { if (r !== null) { this.removeApprovalLocally(a); this.loadStats(); } });
  }

  private approveUrl(a: PendingApproval): string | null {
    switch (a.type) {
      case 'LEAVE':   return `${VP_BASE}/leave-requests/${a.id}/approve`;
      case 'OT':      return `${VP_BASE}/ot-requests/${a.id}/approve`;
      default:        return null;
    }
  }

  private rejectUrl(a: PendingApproval): string | null {
    switch (a.type) {
      case 'LEAVE':   return `${VP_BASE}/leave-requests/${a.id}/reject`;
      case 'OT':      return `${VP_BASE}/ot-requests/${a.id}/reject`;
      default:        return null;
    }
  }

  private removeApprovalLocally(a: PendingApproval): void {
    const list = this.getList(a.type);
    const idx  = list.findIndex(x => x.id === a.id);
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
      default:        return [];
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GETTERS
  // ══════════════════════════════════════════════════════════════

  get filteredPendingApprovals(): PendingApproval[] {
    if (this.activeApprovalTab === 'SALARY') return [];
    return this.getList(this.activeApprovalTab);
  }

  private recomputeTotalPending(): void {
    this.stats.pendingApprovals =
      this.approvalCounts.LEAVE  + this.approvalCounts.OT +
      this.approvalCounts.SALARY;
  }

  get totalPendingCount(): number { return this.stats.pendingApprovals; }
  get donutTotal(): number { return this.donutData.reduce((s, d) => s + d.count, 0); }

  // ══════════════════════════════════════════════════════════════
  // THEME / LANG / TABS
  // ══════════════════════════════════════════════════════════════

  setTheme(dark: boolean): void {
    this.isDark = dark;
    document.body.classList.toggle('dark',  dark);
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('brycen-theme', dark ? 'dark' : 'light');
  }
  toggleTheme(): void { this.setTheme(!this.isDark); }
  selectLang(lang: any): void { this.currentLangObj = lang; this.showLangMenu = false; }
  setApprovalTab(tab: ApprovalTab): void {
    this.activeApprovalTab = tab;
    if (tab === 'SALARY') this.loadSalaryApprovals();
  }

  // ══════════════════════════════════════════════════════════════
  // CHART HELPERS
  // ══════════════════════════════════════════════════════════════

  getBarMaxVal(): number { return Math.max(1, ...this.chartData.map(d => d.done + d.inProgress + d.todo)); }
  getBarHeight(val: number, max: number): number { return max === 0 ? 0 : (val / max) * 100; }
  getDonutDashArray(count: number): string {
    const t = this.donutTotal; if (t === 0) return '0 100';
    const p = (count / t) * 100; return `${p} ${100 - p}`;
  }
  getDonutOffset(index: number): number {
    let offset = 25; const t = this.donutTotal;
    for (let i = 0; i < index; i++) offset -= t === 0 ? 0 : (this.donutData[i].count / t) * 100;
    return ((offset % 100) + 100) % 100;
  }

  // ══════════════════════════════════════════════════════════════
  // STYLE HELPERS
  // ══════════════════════════════════════════════════════════════

  getStatusColor(s: string): string {
    return s === 'On Track' ? '#22c55e' : s === 'At Risk' ? '#f59e0b' : '#ef4444';
  }
  getProgressGradient(s: string): string {
    return s === 'On Track'  ? 'linear-gradient(90deg,#3b82f6,#6366f1)'
         : s === 'At Risk'   ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
         :                     'linear-gradient(90deg,#ef4444,#f87171)';
  }
  getHealthDots(h: number): number[]  { return [0, 1, 2, 3, 4]; }
  getHealthDotColor(i: number, h: number): string {
    if (i >= h) return '#1e2d4a';
    return h >= 4 ? '#22c55e' : h >= 2 ? '#f59e0b' : '#ef4444';
  }
  getRoleBadgeStyle(role: string): { [k: string]: string } {
    const map: Record<string, string> = {
      'PM': '#22c55e', 'Leader': '#06b6d4', 'Dev': '#6366f1',
      'UI/UX': '#ec4899', 'QA': '#f97316', 'Admin': '#ec4899', 'VP': '#0ea5e9', 'CD': '#a855f7',
    };
    const c = map[role] || '#64748b';
    return { background: `${c}22`, color: c };
  }

  // ══════════════════════════════════════════════════════════════
  // FORMAT HELPERS
  // ══════════════════════════════════════════════════════════════

  formatMoney(currency: string, amount: number): string {
    const sym: Record<string, string> = { USD: '$', JPY: '¥', KHR: '៛', MMK: 'K', VND: '₫', KRW: '₩' };
    const s = sym[currency] || (currency + ' ');
    return s + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPeriodLabel(code: string): string {
    if (!code || code.length < 7) return code || '';
    const [y, m] = code.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  isGroupChat = false;

  // ✅ Split teamMembers — use backend management flag
  getManagementMembers(): BranchMemberItem[] {
    return this.teamMembers.filter(m => m.management === true);
  }

  getTeamMembers(): BranchMemberItem[] {
    return this.teamMembers.filter(m => m.management !== true);
  }

  // ✅ Management roles float to top
  private getMemberRoleOrder(role: string): number {
    const order: Record<string, number> = {
      'BOSS': 1, 'COUNTRY_DIRECTOR': 2, 'VICE_PRESIDENT': 3,
      'ADMIN': 4, 'PROJECT_MANAGER': 5, 'LEADER': 6,
      'UI_UX': 7, 'DEVELOPER': 8, 'QA': 9,
    };
    return order[role?.toUpperCase()] ?? 99;
  }

  openMemberPopup(m: BranchMemberItem): void {
    this.isGroupChat = false;
    this.activeChatMember = { id: m.id, name: m.name, role: m.role, color: m.color, initial: m.initial, online: m.online };
    // Mark DM as read + clear badge (channelId = myId as receiver)
    const myId = this.currentUser?.id || this.currentUser?.userId;
    this.http.put(`${BASE}/chat/read-channel?type=DIRECT&channelId=${myId}`, {},
      { headers: this.headers }).pipe(catchError(() => of(null))).subscribe(() => {
      this.memberUnreadCounts[m.id] = 0;
      this.cdr.detectChanges();
    });
    this.cdr.detectChanges();
  }

  openBranchChat(): void {
    const branchId = this.currentUser?.branchId;
    this.isGroupChat = true;
    this.activeChatMember = {
      id: branchId,
      name: 'Branch Chat',
      projectId: branchId,
      projectName: 'Branch Chat',
      color: '#3b82f6',
    };
    // Clear badge
    this.http.put(
      `${BASE}/chat/read-channel?type=BRANCH&channelId=${branchId}`, {},
      { headers: this.headers }
    ).pipe(catchError(() => of(null))).subscribe(() => {
      this.branchUnreadCount = 0;
      this.cdr.detectChanges();
    });
    this.cdr.detectChanges();
  }


  // ✅ Open group chat for a branch project
  openProjectGroupChat(p: BranchProject): void {
    this.isGroupChat = true;
    this.activeChatMember = {
      id: p.id,
      name: p.name,
      projectId: p.id,
      projectName: p.name,
      color: '#16a34a',
    };
    // Mark as read + clear badge
    this.http.put(`${BASE}/chat/read-channel?type=PROJECT&channelId=${p.id}`, {},
      { headers: this.headers }).pipe(catchError(() => of(null))).subscribe(() => {
      this.projectUnreadCounts[p.id] = 0;
      this.cdr.detectChanges();
    });
    this.cdr.detectChanges();
  }

  closeMemberPopup(): void { this.activeChatMember = null; this.isGroupChat = false; this.cdr.detectChanges(); }

  private formatLeaveType(t: string): string {
    return ({ ANNUAL: '🏖 Annual leave', SICK: '🤒 Sick leave', UNPAID: '💼 Unpaid leave' } as any)[t] || t || 'Leave';
  }
  private formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  private formatDateRange(s: Date | null, e: Date | null): string {
    if (!s && !e) return '—';
    if (!e || s?.getTime() === e?.getTime()) return this.formatDate(s!);
    return `${this.formatDate(s!)} — ${this.formatDate(e!)}`;
  }
  private shortRole(r: string): string {
    return ({
      'Project Manager': 'PM',    'Leader': 'Leader',  'Developer': 'Dev',
      'UI/UX Designer':  'UI/UX', 'QA Engineer': 'QA', 'Admin': 'Admin',
      'Vice President':  'VP',    'Country Director': 'CD',
    } as any)[r] || r?.slice(0, 8) || '—';
  }
  private calcHealth(s: string, p: number, d: number): number {
    if (s === 'Delayed')  return 1;
    if (s === 'At Risk')  return 2;
    if (p >= 80)          return 5;
    if (p >= 50)          return 4;
    return 3;
  }
  private updateMyTasksHeight(): void {
    setTimeout(() => { this.myTasksMaxH = Math.floor(window.innerHeight * 0.42); this.cdr.detectChanges(); }, 0);
  }

  // ✅ VP, COUNTRY_DIRECTOR, BOSS → hidePanel=true (project inline right panel hide)
  // Member roles → hidePanel=false (project inline right panel ပြ)
  get shouldHideProjectPanel(): boolean {
    const role = this.currentUser?.role || '';
    return ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS', 'ADMIN'].includes(role);
  }

  openProject(id: number): void {
    this.selectedProjectId = id;
    this.showProjectDetail = true;
    // ✅ Save state — design page back can restore
    this.navState.saveProjectState(id, 'vp');
    this.cdr.detectChanges();
  }

  closeProject(): void {
    this.showProjectDetail = false;
    this.selectedProjectId = null;
    this.navState.clearProjectState();
    this.cdr.detectChanges();
  }

  onViewProfile(staff: any): void {
    this.selectedStaffId = staff.id;
    this.activeView = 'member-profile';
  }

  signOut(): void { this.auth.logout(); this.router.navigate(['/login']); }
  
}
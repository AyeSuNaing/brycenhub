import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';
import { RefreshService } from '../../services/refresh.service';
import { NavigationStateService } from '../../services/navigation-state.service';
import { environment } from '../../../environments/environment';
import { BranchProjectsInline } from '../../shared/branch-projects-inline';
import { AnnouncementInline } from '../../shared/announcement-inline';
import { HolidaysInline } from '../../admin/holidays-inline';
import { TaxBracketsInline } from '../../admin/tax-brackets-inline';
import { ChangePasswordInline } from '../../shared/change-password/change-password-inline';
import { LeaveApprovalInline } from '../../shared/leave-approval/leave-approval-inline';
import { OtApprovalInline }    from '../../shared/ot-approval/ot-approval-inline';
import { SalaryApprovalInline } from '../../shared/salary-approval/salary-approval-inline';
import { ClientListInline } from '../../shared/client-list/client-list-inline';

// ✅ i18n
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

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
  // ── P/L fields ──────────────────────────────────
  budget:       number | null;
  staffCost:    number;
  profitLoss:   number | null;
  profitPct:    number | null;
  isProfit:     boolean;
  staffCount:   number;
}

export interface BranchMemberItem {
  id: number; name: string; role: string; rawRole: string;
  initial: string; color: string; taskCount: number; online: boolean;
  management: boolean;
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
    StaffListInline, StaffProfileInline, BranchProjectsInline, AnnouncementInline,
    HolidaysInline,
    TaxBracketsInline,
    ChangePasswordInline,
    LeaveApprovalInline,
    OtApprovalInline,
    SalaryApprovalInline,
    ClientListInline,
  ],
  templateUrl: './vp-dashboard.html',
  styleUrl: './vp-dashboard.scss'
})
export class VpDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  private _refreshSub?: Subscription;
  currentUser: any = null;
  isDark = true;
  activeView = 'dashboard';

  activeChatMember: ChatMember | null = null;
  selectedStaffId = 0;

  showProjectDetail = false;
  selectedProjectId: number | null = null;

  // ── Right sidebar toggle ──────────────────────────────────────
  rightSidebarOpen = true;

  langs = [
    { code: 'en', display: 'EN', name: 'English',    flag: '🇺🇸' },
    { code: 'ja', display: 'JP', name: 'Japanese',   flag: '🇯🇵' },
    { code: 'my', display: 'MM', name: 'Myanmar',    flag: '🇲🇲' },
    { code: 'km', display: 'KH', name: 'Khmer',      flag: '🇰🇭' },
    { code: 'vi', display: 'VN', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'ko', display: 'KR', name: 'Korean',     flag: '🇰🇷' },
  ];
  currentLangObj = this.langs[0];
  showLangMenu = false;
  settingsOpen = false;
  searchQuery = '';
  myTasksMaxH = 300;
  branchUnreadCount = 0;

  activeApprovalTab: ApprovalTab = 'LEAVE';
  readonly approvalTabs: { key: ApprovalTab; label: string }[] = [
    { key: 'LEAVE',  label: 'Leave'  },
    { key: 'OT',     label: 'OT'     },
    { key: 'SALARY', label: 'Salary' },
  ];

  loading = { stats: true, approvals: true, projects: true, members: true };
  stats = {
    activeProjects: 0, totalStaff: 0, pendingApprovals: 0,
    monthlyOTHours: 0, monthlySpend: 0, onLeaveToday: 0,
  };
  approvalCounts: Record<ApprovalTab, number> = { LEAVE: 0, OT: 0, SALARY: 0 };

  leaveApprovals:  PendingApproval[] = [];
  otApprovals:     PendingApproval[] = [];
  salaryApprovals: PendingApproval[] = [];
  branchProjects:  BranchProject[]   = [];
  teamMembers:     BranchMemberItem[] = [];
  projectUnreadCounts: Record<number, number> = {};
  memberUnreadCounts:  Record<number, number> = {};
  private _unreadPollTimer: any = null;
  allAnnouncements: any[] = [];

  salaryPeriods:        any[] = [];
  salaryHistoryPeriods: any[] = [];
  salaryActing: { [period: string]: boolean } = {};
  loadingSalary = false;

  // ── Profit / Loss ─────────────────────────────────────────────
  loadingPL = false;

  selectedSalaryPeriod: any = null;
  salaryDetailRows:     any[] = [];
  loadingSalaryDetail = false;
  hoveredRow: number | string | null = null;

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
  activities:   any[] = [];
  deadlines:    any[] = [];

  historyFilter  = 'ALL';
  loadingHistory = false;
  historyLeave:  any[] = [];
  historyOt:     any[] = [];

  periodFrom  = '';
  periodTo    = '';
  periodLabel = '';
  customFrom  = '';
  customTo    = '';
  useCustom   = false;

  searchName  = '';
  searchFrom  = '';
  searchTo    = '';
  searchDeptId: number | null = null;
  departments: DepartmentItem[] = [];
  branchName = '';
  branches: any[] = [];

  otActing:    Record<number, boolean> = {};
  leaveActing: Record<number, boolean> = {};
  toastMsg    = '';
  toastType: 'success' | 'error' = 'success';
  private _toastTimer: any;

  showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toastMsg  = msg;
    this.toastType = type;
    this.cdr.detectChanges();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastMsg = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  lbl(key: AppLabelKey): string {
    return getLabel(this.currentLangObj.code, key);
  }

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

  get sortedLeave(): any[] { return [...this.historyLeave].sort((a, b) => this.leaveRank(a) - this.leaveRank(b)); }
  get sortedOt():    any[] { return [...this.historyOt].sort((a, b)    => this.otRank(a)    - this.otRank(b));    }

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private refreshService: RefreshService,
    private navState: NavigationStateService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    const theme = localStorage.getItem('brycen-theme');
    this.setTheme(theme !== 'light');
    this.currentUser = this.auth.getUser();
    const savedLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];
    setTimeout(() => this.loadAll(), 0);

    const savedView = localStorage.getItem('brycen-active-view');
    if (savedView) { this.activeView = savedView; localStorage.removeItem('brycen-active-view'); }
    const savedStaffId = localStorage.getItem('brycen-selected-staff');
    if (savedStaffId) {
      this.selectedStaffId = Number(savedStaffId);
      localStorage.removeItem('brycen-selected-staff');
    }
    this.updateMyTasksHeight();

    const savedNav = this.navState.restoreProjectState();
    if (savedNav.showProject && savedNav.projectId) {
      this.selectedProjectId = savedNav.projectId;
      this.showProjectDetail = true;
      this.navState.clearProjectState();
      this.cdr.detectChanges();
    }

    this._refreshSub = this.refreshService.refresh$.subscribe(() => {
      this.loadStats();
      this.loadLeaveRequests();
      this.loadOtRequests();
      this.loadSalaryDashboard();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void { this.cdr.detectChanges(); }

  ngOnDestroy(): void {
    this._refreshSub?.unsubscribe();
    this.stopUnreadPolling();
  }

  private get headers() { return this.auth.getHeaders(); }

  setView(view: string): void {
    this.activeView = view;
    if (view === 'announcements')    { this.loadAnnouncements(); }
    if (view === 'branches')         { this.loadBranches(); }
    if (view === 'salary-approvals') { this.loadingSalary = true; this.loadSalaryApprovals(); }
    if (view === 'salary-detail')    { this.loadSalaryDetail(); }
    if (view === 'view-leave') {
      this.historyFilter = 'ALL'; this.useCustom = false; this.resetSearch();
      const p = this.getCurrentPayPeriod();
      this.periodFrom = this.fmtDate(p.from); this.periodTo = this.fmtDate(p.to); this.periodLabel = p.label;
      this.loadDepartments(); this.loadHistoryLeave();
    }
    if (view === 'view-ot') {
      this.historyFilter = 'ALL'; this.useCustom = false; this.resetSearch();
      const p = this.getCurrentPayPeriod();
      this.periodFrom = this.fmtDate(p.from); this.periodTo = this.fmtDate(p.to); this.periodLabel = p.label;
      this.loadDepartments(); this.loadHistoryOt();
    }
    this.cdr.detectChanges();
  }

  resetSearch(): void { this.searchName = ''; this.searchFrom = ''; this.searchTo = ''; this.searchDeptId = null; }
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
    const from = new Date(this.periodFrom); const to = new Date(this.periodTo);
    from.setMonth(from.getMonth() + delta); to.setMonth(to.getMonth() + delta);
    this.periodFrom  = this.fmtDate(from); this.periodTo = this.fmtDate(to);
    this.periodLabel = to.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.reloadHistory();
  }

  reloadHistory(): void {
    if (this.activeView === 'view-leave') this.loadHistoryLeave();
    if (this.activeView === 'view-ot')    this.loadHistoryOt();
  }

  fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  loadDepartments(): void {
    if (this.departments.length > 0) return;
    this.http.get<DepartmentItem[]>(`${VP_BASE}/departments`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.departments = list || []; this.cdr.detectChanges(); });
  }

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

  loadHistoryLeave(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${VP_BASE}/leave-requests${this.buildLeaveQuery()}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.historyLeave = list || []; this.loadingHistory = false; this.cdr.detectChanges(); });
  }

  loadHistoryOt(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${VP_BASE}/ot-requests${this.buildOtQuery()}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.historyOt = list || []; this.loadingHistory = false; this.cdr.detectChanges(); });
  }

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

  openPayrollApprovals():  void { this.activeView = 'payroll-approvals'; this.cdr.detectChanges(); }
  closePayrollApprovals(): void { this.activeView = 'dashboard';          this.cdr.detectChanges(); }

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

  loadSalaryApprovals(): void {
    this.loadingSalary = true;
    this.http.get<any[]>(`${VP_BASE}/salary-history`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(data => { this.salaryHistoryPeriods = data || []; this.loadingSalary = false; this.cdr.detectChanges(); });
  }

  approveSalaryPeriod(p: any): void {
    this.salaryActing[p.payPeriod] = true;
    this.http.post(`${BASE}/payroll/batch/approve`, { branchId: p.branchId, payPeriod: p.payPeriod }, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed to approve.'); this.salaryActing[p.payPeriod] = false; this.cdr.detectChanges(); return of(null); }))
      .subscribe(r => {
        this.salaryActing[p.payPeriod] = false; this.cdr.detectChanges();
        if (r !== null) { this.loadSalaryDashboard(); this.loadSalaryApprovals(); this.loadStats(); }
      });
  }

  rejectSalaryPeriod(p: any): void {
    const reason = prompt('Reject reason (optional):') ?? 'Rejected by VP';
    this.salaryActing[p.payPeriod] = true;
    this.http.post(`${BASE}/payroll/batch/reject`, { branchId: p.branchId, payPeriod: p.payPeriod, note: reason }, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed to reject.'); this.salaryActing[p.payPeriod] = false; this.cdr.detectChanges(); return of(null); }))
      .subscribe(r => {
        this.salaryActing[p.payPeriod] = false; this.cdr.detectChanges();
        if (r !== null) { this.loadSalaryDashboard(); this.loadSalaryApprovals(); this.loadStats(); }
      });
  }

  openSalaryDetail(p: any): void { this.selectedSalaryPeriod = p; this.setView('salary-detail'); }

  loadSalaryDetail(): void {
    if (!this.selectedSalaryPeriod) return;
    this.loadingSalaryDetail = true; this.salaryDetailRows = [];
    this.http.get<any[]>(`${VP_BASE}/salary-detail?payPeriod=${this.selectedSalaryPeriod.payPeriod}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(data => { this.salaryDetailRows = data || []; this.loadingSalaryDetail = false; this.cdr.detectChanges(); });
  }

  approveSalaryBatch(): void { if (this.salaryPeriods.length > 0) this.approveSalaryPeriod(this.salaryPeriods[0]); }
  rejectSalaryBatch():  void { if (this.salaryPeriods.length > 0) this.rejectSalaryPeriod(this.salaryPeriods[0]);  }
  get salaryActingAny(): boolean { return Object.values(this.salaryActing).some(v => v); }

  openPayslip(recordId: number): void { this.payslipRecordId = recordId; this.payslipOpen = true; this.cdr.detectChanges(); }
  closePayslip(): void { this.payslipOpen = false; this.payslipRecordId = null; this.cdr.detectChanges(); }

  loadAll(): void {
    this.loadBranchName();
    this.loadStats();
    this.loadLeaveRequests();
    this.loadOtRequests();
    this.loadSalaryDashboard();
    this.loadBranchMembers();
    this.loadBranches();
    this.loadBranchProjectsThenPL();
  }

  loadBranchProjectsThenPL(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-projects`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.branchProjects   = (list || []).map(p => this.normalizeProject(p));
        this.loading.projects = false;
        this.cdr.detectChanges();
        this.loadProfitLoss();
        this.loadProjectUnreadCounts();
        this.startUnreadPolling();
      });
  }

  loadBranchProjects(): void { this.loadBranchProjectsThenPL(); }

  loadProfitLoss(): void {
    this.loadingPL = true;
    this.http.get<any>(`${BASE}/projects/profit-loss`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(resp => {
        this.loadingPL = false;
        if (!resp?.projects) { this.cdr.detectChanges(); return; }
        (resp.projects as any[]).forEach(pl => {
          const bp = this.branchProjects.find(p => p.id === pl.projectId);
          if (bp) {
            bp.budget     = pl.budget     != null ? Number(pl.budget)     : null;
            bp.staffCost  = Number(pl.staffCost   ?? 0);
            bp.profitLoss = pl.profitLoss != null ? Number(pl.profitLoss) : null;
            bp.profitPct  = pl.profitPercent != null ? Number(pl.profitPercent) : null;
            bp.isProfit   = !!(pl.profit ?? pl.isProfit);
            bp.staffCount = Number(pl.staffCount  ?? bp.staffCount);
          }
        });
        this.cdr.detectChanges();
      });
  }

  loadBranchName(): void {
    const branchId = this.currentUser?.branchId;
    if (!branchId) return;
    this.http.get<any>(`${BASE}/branches/${branchId}`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(b => {
        if (b?.name) { this.branchName = b.name; this.cdr.markForCheck(); this.cdr.detectChanges(); }
      });
  }

  loadBranches(): void {
    this.http.get<any[]>(`${BASE}/branches`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.branches = list || []; this.cdr.detectChanges(); });
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
        this.leaveApprovals       = (list || []).map(lv => this.normalizeLeave(lv));
        this.approvalCounts.LEAVE = this.leaveApprovals.length;
        this.recomputeTotalPending(); this.loading.approvals = false; this.cdr.detectChanges();
      });
  }

  loadOtRequests(): void {
    this.http.get<any[]>(`${VP_BASE}/ot-requests?status=PENDING`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.otApprovals       = (list || []).map(ot => this.normalizeOt(ot));
        this.approvalCounts.OT = this.otApprovals.length;
        this.recomputeTotalPending(); this.cdr.detectChanges();
      });
  }

  startUnreadPolling(): void {
    this.stopUnreadPolling();
    this.ngZone.runOutsideAngular(() => {
      this._unreadPollTimer = setInterval(() => { this.ngZone.run(() => this.loadProjectUnreadCounts()); }, 10000);
    });
  }

  stopUnreadPolling(): void {
    if (this._unreadPollTimer) { clearInterval(this._unreadPollTimer); this._unreadPollTimer = null; }
  }

  loadProjectUnreadCounts(): void {
    this.loadMemberUnreadCounts();
    const branchId = this.currentUser?.branchId;
    if (branchId) {
      this.http.get<any>(`${BASE}/chat/unread?type=BRANCH&channelId=${branchId}`, { headers: this.headers })
        .pipe(catchError(() => of({ unreadCount: 0 }))).subscribe(res => {
          this.branchUnreadCount = res?.unreadCount || 0; this.cdr.detectChanges();
        });
    }
    if (this.branchProjects.length === 0) return;
    const ids = this.branchProjects.map(p => p.id).join(',');
    this.http.get<any[]>(`${BASE}/chat/unread-batch?type=PROJECT&channelIds=${ids}`, { headers: this.headers })
      .pipe(catchError(() => of([]))).subscribe(res => {
        (res || []).forEach((r: any) => { this.projectUnreadCounts[r.channelId] = r.unreadCount || 0; });
        this.cdr.detectChanges();
      });
  }

  loadMemberUnreadCounts(): void {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    this.http.get<any[]>(`${BASE}/chat/direct-unread-by-sender?userId=${myId}`, { headers: this.headers })
      .pipe(catchError(() => of([]))).subscribe(res => {
        this.memberUnreadCounts = {};
        (res || []).forEach((r: any) => { this.memberUnreadCounts[r.senderId] = r.unreadCount; });
        this.cdr.detectChanges();
      });
  }

  loadBranchMembers(): void {
    this.http.get<any[]>(`${VP_BASE}/branch-members`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        const mapped = (list || []).map(m => this.normalizeMember(m));
        this.teamMembers = mapped.sort((a, b) => this.getMemberRoleOrder(a.rawRole) - this.getMemberRoleOrder(b.rawRole));
        this.loadMemberUnreadCounts(); this.loading.members = false; this.cdr.detectChanges();
      });
  }

  loadAnnouncements(): void {
    this.http.get<any[]>(`${BASE}/announcements`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.allAnnouncements = list || []; this.cdr.detectChanges(); });
  }

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
    if      (dl < 0)               st = 'Delayed';
    else if (dl < 14 && prog < 70) st = 'At Risk';
    else if (prog < 30 && dl < 30) st = 'At Risk';
    return {
      id: p.id, name: p.title || 'Untitled', status: st, progress: prog,
      ownerName: p.pmName || 'Unassigned', ownerInitial: p.pmInitial || '?',
      ownerColor: p.pmColor || '#64748b',
      dueDate: ed ? this.formatDate(ed) : '—',
      health: this.calcHealth(st, prog, dl),
      budget: null, staffCost: 0, profitLoss: null, profitPct: null, isProfit: false,
      staffCount: p.staffCount || 0,
    };
  }

  private normalizeMember(m: any): BranchMemberItem {
    return {
      id: m.id, name: m.name || 'Unknown', role: m.role || 'Staff', rawRole: m.rawRole || '',
      initial: m.initial || '?', color: m.color || '#64748b',
      taskCount: m.taskCount || 0, online: m.online === true, management: m.management === true,
    };
  }

  approveApproval(a: PendingApproval): void {
    const url = this.approveUrl(a); if (!url) return;
    this.http.patch(url, {}, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed.'); return of(null); }))
      .subscribe(r => {
        this.otActing[a.id] = false;
        if (r !== null) {
          this.removeApprovalLocally(a);
          this.loadStats();
          this.showToast(`✅ ${a.staffName}'s ${a.type} approved`);
        } else {
          this.showToast('❌ Action failed. Please try again.', 'error');
        }
        this.cdr.detectChanges();
      });
  }

  rejectApproval(a: PendingApproval): void {
    const url = this.rejectUrl(a); if (!url) return;
    this.http.patch(url, { reason: 'Rejected by VP' }, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed.'); return of(null); }))
      .subscribe(r => { if (r !== null) { this.removeApprovalLocally(a); this.loadStats(); } });
  }

  private approveUrl(a: PendingApproval): string | null {
    if (a.type === 'LEAVE') return `${VP_BASE}/leave-requests/${a.id}/approve`;
    if (a.type === 'OT')    return `${VP_BASE}/ot-requests/${a.id}/approve`;
    return null;
  }

  private rejectUrl(a: PendingApproval): string | null {
    if (a.type === 'LEAVE') return `${VP_BASE}/leave-requests/${a.id}/reject`;
    if (a.type === 'OT')    return `${VP_BASE}/ot-requests/${a.id}/reject`;
    return null;
  }

  private removeApprovalLocally(a: PendingApproval): void {
    const list = this.getList(a.type);
    const idx  = list.findIndex(x => x.id === a.id);
    if (idx > -1) list.splice(idx, 1);
    this.approvalCounts[a.type] = list.length;
    this.recomputeTotalPending(); this.cdr.detectChanges();
  }

  private getList(type: ApprovalTab): PendingApproval[] {
    if (type === 'LEAVE')  return this.leaveApprovals;
    if (type === 'OT')     return this.otApprovals;
    if (type === 'SALARY') return this.salaryApprovals;
    return [];
  }

  get filteredPendingApprovals(): PendingApproval[] {
    if (this.activeApprovalTab === 'SALARY') return [];
    return this.getList(this.activeApprovalTab);
  }

  private recomputeTotalPending(): void {
    this.stats.pendingApprovals = this.approvalCounts.LEAVE + this.approvalCounts.OT + this.approvalCounts.SALARY;
  }

  get totalPendingCount(): number { return this.stats.pendingApprovals; }
  get donutTotal(): number { return this.donutData.reduce((s, d) => s + d.count, 0); }

  setTheme(dark: boolean): void {
    this.isDark = dark;
    document.body.classList.toggle('dark',  dark);
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('brycen-theme', dark ? 'dark' : 'light');
  }
  toggleTheme(): void { this.setTheme(!this.isDark); }

  selectLang(lang: any): void {
    this.currentLangObj = lang;
    this.showLangMenu   = false;
    try {
      const stored = localStorage.getItem('user');
      if (stored) { const u = JSON.parse(stored); u.preferredLanguage = lang.code; localStorage.setItem('user', JSON.stringify(u)); }
    } catch(e) {}
    this.http.put(`${BASE}/auth/language`, { language: lang.code }, { headers: this.headers }).subscribe({
      next: () => { this.reloadPage(); },
      error: () => { this.reloadPage(); },
    });
  }

  private reloadPage(): void {
    localStorage.setItem('brycen-active-view', this.activeView);
    if (this.selectedStaffId) { localStorage.setItem('brycen-selected-staff', String(this.selectedStaffId)); }
    window.location.reload();
  }

  setApprovalTab(tab: ApprovalTab): void {
    this.activeApprovalTab = tab;
    if (tab === 'SALARY') this.loadSalaryApprovals();
  }

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

  getStatusColor(s: string): string {
    return s === 'On Track' ? '#22c55e' : s === 'At Risk' ? '#f59e0b' : '#ef4444';
  }
  getProgressGradient(s: string): string {
    return s === 'On Track' ? 'linear-gradient(90deg,#3b82f6,#6366f1)'
         : s === 'At Risk'  ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
         :                    'linear-gradient(90deg,#ef4444,#f87171)';
  }
  getHealthDots(h: number): number[] { return [0, 1, 2, 3, 4]; }
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

  formatMoney(currency: string, amount: number): string {
    const sym: Record<string, string> = { USD: '$', JPY: '¥', KHR: '៛', MMK: 'K', VND: '₫', KRW: '₩' };
    const s = sym[currency] || (currency + ' ');
    return s + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPL(pl: number | null, pct: number | null): string {
    if (pl === null) return '—';
    const sign   = pl >= 0 ? '+' : '';
    const amount = Math.abs(pl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const pctStr = pct !== null ? ` (${Math.abs(pct).toFixed(0)}%)` : '';
    return `${sign}$${amount}${pctStr}`;
  }

  formatPeriodLabel(code: string): string {
    if (!code || code.length < 7) return code || '';
    const [y, m] = code.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  isGroupChat = false;

  getManagementMembers(): BranchMemberItem[] { return this.teamMembers.filter(m => m.management === true); }
  getTeamMembers():       BranchMemberItem[] { return this.teamMembers.filter(m => m.management !== true); }

  get profitProjects():   BranchProject[] { return this.branchProjects.filter(p => p.isProfit && p.budget !== null); }
  get lossProjects():     BranchProject[] { return this.branchProjects.filter(p => !p.isProfit && p.budget !== null); }
  get noBudgetProjects(): BranchProject[] { return this.branchProjects.filter(p => p.budget === null); }

  private getMemberRoleOrder(role: string): number {
    const order: Record<string, number> = {
      'BOSS': 1, 'COUNTRY_DIRECTOR': 2, 'VICE_PRESIDENT': 3,
      'ADMIN': 4, 'PROJECT_MANAGER': 5, 'LEADER': 6, 'UI_UX': 7, 'DEVELOPER': 8, 'QA': 9,
    };
    return order[role?.toUpperCase()] ?? 99;
  }

  openMemberPopup(m: BranchMemberItem): void {
    this.isGroupChat = false;
    this.activeChatMember = { id: m.id, name: m.name, role: m.role, color: m.color, initial: m.initial, online: m.online };
    const myId = this.currentUser?.id || this.currentUser?.userId;
    this.http.put(`${BASE}/chat/read-channel?type=DIRECT&channelId=${myId}`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null))).subscribe(() => { this.memberUnreadCounts[m.id] = 0; this.cdr.detectChanges(); });
    this.cdr.detectChanges();
  }

  openBranchChat(): void {
    const branchId = this.currentUser?.branchId;
    this.isGroupChat = true;
    this.activeChatMember = { id: branchId, name: 'Branch Chat', projectId: branchId, projectName: 'Branch Chat', color: '#3b82f6' };
    this.http.put(`${BASE}/chat/read-channel?type=BRANCH&channelId=${branchId}`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null))).subscribe(() => { this.branchUnreadCount = 0; this.cdr.detectChanges(); });
    this.cdr.detectChanges();
  }

  openProjectGroupChat(p: BranchProject): void {
    this.isGroupChat = true;
    this.activeChatMember = { id: p.id, name: p.name, projectId: p.id, projectName: p.name, color: '#16a34a' };
    this.http.put(`${BASE}/chat/read-channel?type=PROJECT&channelId=${p.id}`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null))).subscribe(() => { this.projectUnreadCounts[p.id] = 0; this.cdr.detectChanges(); });
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
  private calcHealth(s: string, p: number, d: number): number {
    if (s === 'Delayed') return 1;
    if (s === 'At Risk')  return 2;
    if (p >= 80) return 5;
    if (p >= 50) return 4;
    return 3;
  }
  private updateMyTasksHeight(): void {
    setTimeout(() => { this.myTasksMaxH = Math.floor(window.innerHeight * 0.42); this.cdr.detectChanges(); }, 0);
  }

  get shouldHideProjectPanel(): boolean {
    const role = this.currentUser?.role || '';
    return ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS', 'ADMIN'].includes(role);
  }

  openProject(id: number): void {
    this.selectedProjectId = id; this.showProjectDetail = true;
    this.navState.saveProjectState(id, 'vp'); this.cdr.detectChanges();
  }

  closeProject(): void {
    this.showProjectDetail = false; this.selectedProjectId = null;
    this.navState.clearProjectState(); this.cdr.detectChanges();
  }

  onViewProfile(staff: any): void { this.selectedStaffId = staff.id; this.activeView = 'member-profile'; }

  openMyProfile(): void {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    this.selectedStaffId = myId;
    this.activeView      = 'member-profile';
    this.settingsOpen    = false;
    this.cdr.detectChanges();
  }

  signOut(): void { this.auth.logout(); this.router.navigate(['/login']); }
}
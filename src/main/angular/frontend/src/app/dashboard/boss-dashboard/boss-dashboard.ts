import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, Subscription, interval } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AnnouncementBarComponent } from '../../shared/announcement-bar.component';
import { BellNotificationComponent } from '../../shared/bell-notification.component';
import { ProjectInlineComponent } from '../../projects/project-inline';
import { ChatPopupComponent, ChatMember } from '../../shared/chat-popup/chat-popup.component';
import { StaffListInline } from '../../admin/staff-list-inline';
import { StaffProfileInline } from '../../admin/staff-profile-inline';
import { AuthService } from '../../services/auth.service';
import { RefreshService } from '../../services/refresh.service';
import { NavigationStateService } from '../../services/navigation-state.service';
import { environment } from '../../../environments/environment';
import { AnnouncementInline } from '../../shared/announcement-inline';
import { HolidaysInline } from '../../admin/holidays-inline';
import { TaxBracketsInline } from '../../admin/tax-brackets-inline';
import { ChangePasswordInline } from '../../shared/change-password/change-password-inline';
import { LeaveApprovalInline } from '../../shared/leave-approval/leave-approval-inline';
import { OtApprovalInline } from '../../shared/ot-approval/ot-approval-inline';
import { BranchProjectsInline } from '../../shared/branch-projects-inline';

import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;
const VP_BASE = `${BASE}/vp/dashboard`;

export interface BossStats {
  totalStaff: number;
  activeProjects: number;
  totalBranches: number;
  pendingApprovals: number;
}

export interface BranchOverview {
  id: number;
  name: string;
  countryName: string;
  countryFlag: string;
  staffCount: number;
  activeProjects: number;
  address?: string;
}

export interface CountryOverview {
  id: number;
  name: string;
  code: string;
  flag: string;
  branches: BranchOverview[];
  totalStaff: number;
  totalProjects: number;
}

@Component({
  selector: 'app-boss-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AnnouncementBarComponent,
    BellNotificationComponent,
    ProjectInlineComponent,
    ChatPopupComponent,
    StaffListInline,
    StaffProfileInline,
    AnnouncementInline,
    HolidaysInline,
    TaxBracketsInline,
    ChangePasswordInline,
    LeaveApprovalInline,
    OtApprovalInline,
    BranchProjectsInline,
  ],
  templateUrl: './boss-dashboard.html',
  styleUrl: './boss-dashboard.scss',
})
export class BossDashboard implements OnInit, OnDestroy {
  // ── Current user ──
  currentUser: any = null;
  userInitial = '';
  userAvatarColor = '#16a34a';
  isDark = true;

  // ── Language ──
  showLangMenu = false;
  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean' },
  ];
  currentLangObj = this.langs[0];

  readonly Math = Math;

  // ── Dashboard filters ──
  filterView: 'all' | 'onTrack' | 'atRisk' | 'delayed' = 'all';

  get filteredProjects(): any[] {
    if (this.filterView === 'onTrack') return this.recentProjects.filter(p => p.status === 'ACTIVE' && (p.progress || 0) > 0);
    if (this.filterView === 'atRisk') return this.recentProjects.filter(p => p.status === 'ON_HOLD');
    if (this.filterView === 'delayed') return this.getDelayedProjects();
    return this.recentProjects;
  }

  getHealthCount(type: 'onTrack' | 'atRisk' | 'delayed'): number {
    if (type === 'onTrack') return this.recentProjects.filter(p => p.status === 'ACTIVE' && (p.progress || 0) >= 0 && !this.isDelayed(p)).length;
    if (type === 'atRisk')  return this.recentProjects.filter(p => p.status === 'ON_HOLD').length;
    if (type === 'delayed') return this.getDelayedProjects().length;
    return 0;
  }

  isDelayed(p: any): boolean {
    if (!p.endDate) return false;
    const due = new Date(p.endDate);
    const now = new Date();
    return due < now && (p.progress || 0) < 100;
  }

  getDelayedProjects(): any[] {
    return this.recentProjects.filter(p => this.isDelayed(p) || p.status === 'CANCELLED');
  }

  getUpcomingDeadlines(): any[] {
    const now = new Date();
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    return this.recentProjects
      .filter(p => {
        if (!p.endDate) return false;
        const due = new Date(p.endDate);
        return due >= now && due <= in30;
      })
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 5);
  }

  getDaysUntil(endDate: string): number {
    if (!endDate) return 999;
    const diff = new Date(endDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  get userRole(): string { return this.currentUser?.role || ''; }
  get isBoss(): boolean { return this.userRole === 'BOSS'; }
  get isDR(): boolean { return this.userRole === 'COUNTRY_DIRECTOR'; }
  get isVP(): boolean { return this.userRole === 'VICE_PRESIDENT'; }
  // DR ဆိုရင် approval section ပြ (VP မပါ — VP က own dashboard သုံး)
  get showApprovals(): boolean { return this.isDR; }

  // ── Project inline ──
  showProjectDetail = false;
  selectedProjectId: number | null = null;

  // ── View state ──
  activeView = 'dashboard';

  settingsOpen = false;
  selectedStaffId: number | undefined = undefined;
  selectedBranchId: number | null = null;
  searchQuery = '';

  // ── Stats ──
  stats: BossStats = { totalStaff: 0, activeProjects: 0, totalBranches: 0, pendingApprovals: 0 };
  loadingStats = true;

  // ── Branch Detail ──
  branchDetailProjects: any[] = [];
  loadingBranchDetail = false;

  // ── Chart data (6 months) ──
  chartData: { month: string; done: number; inProgress: number; todo: number }[] = [
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

  loadChartData() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/chart-data`, h)
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        if (data && data.length > 0) this.chartData = data;
        this.cdr.detectChanges();
      });
    this.http.get<any>(`${BASE}/boss/dashboard/task-stats`, h)
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.donutData[0].count = s.todo       || 0;
          this.donutData[1].count = s.inProgress || 0;
          this.donutData[2].count = s.inReview   || 0;
          this.donutData[3].count = s.done       || 0;
        }
        this.cdr.detectChanges();
      });
  }

  getTimeElapsed(startDate: string, endDate: string): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end   = new Date(endDate).getTime();
    const now   = new Date().getTime();
    if (end <= start) return 100;
    const elapsed = ((now - start) / (end - start)) * 100;
    return Math.min(100, Math.max(0, Math.round(elapsed)));
  }

  getTimeElapsedColor(progress: number, timeElapsed: number): string {
    const gap = timeElapsed - progress;
    if (timeElapsed >= 100 && progress < 100) return '#ef4444'; // overdue
    if (gap > 30) return '#f59e0b';  // at risk
    return '#22c55e';                // on track
  }

  showAllProjects = false;

  get displayedProjects(): any[] {
    return this.showAllProjects ? this.filteredProjects : this.filteredProjects.slice(0, 10);
  }

  getMaxBranchProjects(): number {
    if (!this.branches || this.branches.length === 0) return 1;
    return Math.max(1, ...this.branches.map((b: any) => b.activeProjects || 0));
  }

  getBarMaxVal(): number {
    return Math.max(1, ...this.chartData.map(d => d.done + d.inProgress + d.todo));
  }
  getBarHeight(val: number, max: number): number {
    if (max === 0) return 4;
    return Math.max(4, Math.round((val / max) * 110));
  }
  getDonutTotal(): number {
    return this.donutData.reduce((s, d) => s + d.count, 0);
  }

  // ── Finance Overview ──
  financeExpenses: any[] = [];
  financeIncome: any[] = [];
  loadingFinance = false;

  // ── Payroll approval count (for sidebar badge) ──
  pendingPayrollCount = 0;
  countries: CountryOverview[] = [];
  branches: BranchOverview[] = [];
  loadingCountries = true;

  // ── Approval counts ──
  approvalCounts = { LEAVE: 0, OT: 0, SALARY: 0 };

  // ── Salary approval ──
  salaryHistoryPeriods: any[] = [];
  loadingSalary = false;
  selectedSalaryPeriod: any = null;
  salaryDetailRows: any[] = [];
  loadingSalaryDetail = false;

  // ── Recent projects ──
  recentProjects: any[] = [];
  loadingProjects = true;

  // ── Right sidebar ──
  managementMembers: any[] = [];
  branchChats: any[] = [];
  selectedChatMember: ChatMember | null = null;
  isGroupChat = false;
  projectUnreadCounts: Record<number, number> = {};
  memberUnreadCounts: Record<number, number> = {};

  // ── Subscriptions ──
  private subs = new Subscription();

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private refresh: RefreshService,
    private navState: NavigationStateService,
  ) {}

  ngOnInit() {
    this.currentUser = this.auth.getUser();
    if (!this.currentUser) { this.router.navigate(['/login']); return; }
    this.userInitial = (this.currentUser.name || 'B').charAt(0).toUpperCase();

    // Sync theme
    this.isDark = document.body.classList.contains('dark') ||
                  localStorage.getItem('brycen-theme') !== 'light';
    document.body.classList.toggle('dark',  this.isDark);
    document.body.classList.toggle('light', !this.isDark);

    // Init lang from user preference
    const userLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === userLang) || this.langs[0];

    // Restore nav state if back from kanban/design/api-docs etc.
    const saved = this.navState.restoreProjectState();

    this.loadStats();
    this.loadCountries();
    this.loadBranches();
    this.loadRecentProjects();
    this.loadManagementMembers();
    this.loadApprovalCounts();
    this.loadPendingPayrollCount();
    this.loadChartData();

    // Project inline restore — back from kanban/design/api-docs ရင် project ကို ပြန်ဖွင့်
    if (saved.showProject && saved.projectId &&
        (saved.dashboard === 'boss' || saved.dashboard === 'vp')) {
      setTimeout(() => {
        this.openProject(saved.projectId!);
        this.navState.clearProjectState();
      }, 300);
    }

    // RefreshService inject လုပ်ရုံနဲ့ constructor ထဲ heartbeat auto-start ဖြစ်သွားတယ်

    // Poll approval counts every 30s
    this.subs.add(
      interval(30000).subscribe(() => this.loadApprovalCounts())
    );

    // Poll unread counts every 10s
    this.subs.add(
      interval(10000).subscribe(() => this.loadUnreadCounts())
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage, key);
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW
  // ══════════════════════════════════════════════════════════════════
  selectLang(lang: any) {
    this.currentLangObj = lang;
    this.showLangMenu = false;
    if (this.currentUser) {
      const h = { headers: this.auth.getHeaders() };
      this.http.patch(`${BASE}/users/me/language`, { language: lang.code }, h)
        .pipe(catchError(() => of(null))).subscribe();
    }
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark', this.isDark);
    document.body.classList.toggle('light', !this.isDark);
    localStorage.setItem('brycen-theme', this.isDark ? 'dark' : 'light');
  }

  setView(v: string) {
    this.activeView = v;
    this.settingsOpen = false;
    if (v === 'countries') this.loadCountries();
    if (v === 'branches') this.loadBranches();
    if (v === 'finance') this.loadFinance();
  }

  _prevView = 'dashboard';

  openProject(id: number) {
    this._prevView = this.activeView;   // branch-detail or dashboard ကို remember
    this.selectedProjectId = id;
    this.showProjectDetail = true;
    this.navState.saveProjectState(id, 'boss');
    this.cdr.detectChanges();
  }

  closeProject() {
    this.showProjectDetail = false;
    this.selectedProjectId = null;
    this.navState.clearProjectState();
    // branch-detail ကနေ ဖွင့်ခဲ့ရင် branch-detail ပြန်သွား
    if (this._prevView === 'branch-detail') {
      this.activeView = 'branch-detail';
    }
    this.cdr.detectChanges();
  }

  loadFinance() {
    this.loadingFinance = true;
    const h = { headers: this.auth.getHeaders() };
    // Boss Dashboard — branch-expenses via vp/dashboard endpoint (Boss မှာ global view)
    // catchError → empty array (404 ဆိုရင် hide ဖြစ်မယ်)
    this.http.get<any>(`${BASE}/boss/dashboard/finance-summary`, h)
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (res) {
          this.financeExpenses = res.expenses || [];
          this.financeIncome   = res.income   || [];
        } else {
          this.financeExpenses = [];
          this.financeIncome   = [];
        }
        this.loadingFinance = false;
        this.cdr.detectChanges();
      });
  }

  loadPendingPayrollCount() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/payroll/pending-batches`, h)
      .pipe(catchError(() => of({ totalBatches: 0 })))
      .subscribe(res => {
        this.pendingPayrollCount = res?.totalBatches || 0;
        this.cdr.detectChanges();
      });
  }

  getTotalExpenses(): number {
    return this.financeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
  getTotalIncome(): number {
    return this.financeIncome.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
  getNetBalance(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }
  getExpenseByBranch(): {name: string; amount: number; currency: string}[] {
    const map = new Map<string, number>();
    this.financeExpenses.forEach(e => {
      const key = e.branchName || 'Unknown';
      map.set(key, (map.get(key) || 0) + (Number(e.amount) || 0));
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, currency: 'USD' }))
      .sort((a, b) => b.amount - a.amount);
  }

  selectedCountry: CountryOverview | null = null;

  selectCountry(c: CountryOverview) {
    this.selectedCountry = c;
    this.activeView = 'country-detail';
    this.settingsOpen = false;
    this.cdr.detectChanges();
  }

  selectBranch(b: any) {
    this.selectedBranchId = b.id;
    this._prevView = this.activeView; // country-detail သို့မဟုတ် dashboard ကို remember
    this.activeView = 'branch-detail';
    this.settingsOpen = false;
    this.loadBranchDetail(b.id);
  }

  loadBranchDetail(branchId: number) {
    this.loadingBranchDetail = true;
    this.branchDetailProjects = [];
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/projects/by-branch/${branchId}/details`, h)
      .pipe(catchError((err) => {
        console.error('Branch detail error:', err);
        return of([]);
      }))
      .subscribe(projects => {
        this.branchDetailProjects = (projects || []).filter((p: any) =>
          ['ACTIVE', 'PLANNING', 'ON_HOLD'].includes(p.status)
        );
        this.loadingBranchDetail = false;
        this.cdr.detectChanges();
      });
  }

  openBranchVpDashboard(b: any) {
    // Boss မှ branch VP dashboard ကို navigate
    this.router.navigate(['/dashboard/vp']);
  }

  getSelectedBranch() {
    return this.branches.find((b: any) => b.id === this.selectedBranchId);
  }

  // ══════════════════════════════════════════════════════════════════
  // DATA LOADERS
  // ══════════════════════════════════════════════════════════════════
  loadStats() {
    this.loadingStats = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/boss/dashboard/stats`, h)
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.stats.totalStaff    = s.totalStaff    || 0;
          this.stats.totalBranches = s.totalBranches || 0;
          this.stats.activeProjects = s.activeProjects || 0;
        }
        this.loadingStats = false;
        this.cdr.detectChanges();
      });
  }

  loadCountries() {
    this.loadingCountries = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/branches-with-stats`, h)
      .pipe(catchError(() => of([]))).subscribe(branches => {
        const countryMap = new Map<number, CountryOverview>();
        branches.forEach(b => {
          const cid = b.countryId || 0;
          // VP pattern — countryFlag/countryName ကို backend ကနေ တိုက်ရိုက်ယူ
          const flag = b.countryFlag || '🌐';
          const name = b.countryName || b.name;
          if (!countryMap.has(cid)) {
            countryMap.set(cid, {
              id: cid,
              name,
              code: b.countryCode || '',
              flag,
              branches: [],
              totalStaff: 0,
              totalProjects: 0,
            });
          }
          const c = countryMap.get(cid)!;
          c.branches.push({
            id: b.id,
            name: b.name,
            countryName: b.countryName || '',
            countryFlag: b.countryFlag || flag,
            staffCount: b.staffCount || 0,
            activeProjects: b.activeProjects || 0,
            address: b.address || '',
          });
          c.totalStaff    += (b.staffCount    || 0);
          c.totalProjects += (b.activeProjects || 0);
        });
        this.countries = Array.from(countryMap.values());
        this.branches = branches;
        this.loadingCountries = false;
        this.enrichProjectBranches();
        this.cdr.detectChanges();
      });
  }

  loadBranches() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/branches-with-stats`, h)
      .pipe(catchError(() => of([]))).subscribe(b => {
        this.branches = b;
        this.cdr.detectChanges();
      });
  }

  loadRecentProjects() {
    this.loadingProjects = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/projects`, h)
      .pipe(catchError(() => of([])))
      .subscribe(projects => {
        this.recentProjects = projects || [];
        this.loadingProjects = false;
        this.enrichProjectBranches();
        this.cdr.detectChanges();
      });
  }

  // Projects ကို branch name + flag နဲ့ enrich လုပ်မယ်
  enrichProjectBranches() {
    if (this.branches.length === 0) return;
    this.recentProjects.forEach((p: any) => {
      if (p.branchId) {
        const br = this.branches.find((b: any) => b.id === p.branchId);
        if (br) {
          p.branchName  = br.name;
          p.countryFlag = br.countryFlag || '🌐';
        }
      }
    });
    this.cdr.detectChanges();
  }

  loadManagementMembers() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/management-members`, h)
      .pipe(catchError(() => of([]))).subscribe(members => {
        this.managementMembers = members;
        this.cdr.detectChanges();
      });
  }

  loadApprovalCounts() {
    const h = { headers: this.auth.getHeaders() };
    // Leave + OT — DR only (BOSS မသုံး)
    if (this.showApprovals) {
      this.http.get<any[]>(`${BASE}/staff-requests/leave?status=PENDING`, h)
        .pipe(catchError(() => of([]))).subscribe(items => {
          this.approvalCounts.LEAVE = items.length;
          this.cdr.detectChanges();
        });
      this.http.get<any[]>(`${BASE}/staff-requests/ot?status=PENDING`, h)
        .pipe(catchError(() => of([]))).subscribe(items => {
          this.approvalCounts.OT = items.length;
          this.cdr.detectChanges();
        });
    }
  }

  loadSalaryPeriods() {
    this.loadingSalary = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/payroll/pending-batches`, h)
      .pipe(catchError(() => of([]))).subscribe(items => {
        this.salaryHistoryPeriods = items;
        this.loadingSalary = false;
        this.cdr.detectChanges();
      });
  }

  openSalaryDetail(period: any) {
    this.selectedSalaryPeriod = period;
    this.loadingSalaryDetail = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/payroll/history?branchId=${period.branchId}&payPeriod=${period.payPeriod}`, h)
      .pipe(catchError(() => of([]))).subscribe(rows => {
        this.salaryDetailRows = rows;
        this.loadingSalaryDetail = false;
        this.cdr.detectChanges();
      });
  }

  closeSalaryDetail() {
    this.selectedSalaryPeriod = null;
    this.salaryDetailRows = [];
  }

  approveSalaryBatch(period: any) {
    const h = { headers: this.auth.getHeaders() };
    this.http.post(`${BASE}/payroll/batch/approve`, {
      branchId: period.branchId,
      payPeriod: period.payPeriod,
    }, h).pipe(catchError(() => of(null))).subscribe(() => {
      this.closeSalaryDetail();
      this.loadSalaryPeriods();
      this.loadApprovalCounts();
    });
  }

  rejectSalaryBatch(period: any, reason: string) {
    if (!reason?.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.post(`${BASE}/payroll/batch/reject`, {
      branchId: period.branchId,
      payPeriod: period.payPeriod,
      rejectReason: reason,
    }, h).pipe(catchError(() => of(null))).subscribe(() => {
      this.closeSalaryDetail();
      this.loadSalaryPeriods();
      this.loadApprovalCounts();
    });
  }

  loadUnreadCounts() {
    const myId = this.currentUser?.userId || this.currentUser?.id;
    if (!myId) return;
    const h = { headers: this.auth.getHeaders() };
    const projectIds = this.branchChats.map(c => c.id);
    if (projectIds.length > 0) {
      this.http.post<any>(`${BASE}/chat/unread-batch`, { userId: myId, projectIds }, h)
        .pipe(catchError(() => of(null))).subscribe(data => {
          if (data?.projectCounts) this.projectUnreadCounts = data.projectCounts;
          if (data?.memberCounts) this.memberUnreadCounts = data.memberCounts;
          this.cdr.detectChanges();
        });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PROFILE / AUTH
  // ══════════════════════════════════════════════════════════════════
  openMyProfile() {
    const myId = this.currentUser?.userId || this.currentUser?.id;
    if (myId) {
      this.selectedStaffId = myId;
      this.setView('member-profile');
    }
  }

  onViewProfile(id: number) {
    this.selectedStaffId = id;
    this.setView('member-profile');
  }

  signOut() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ══════════════════════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════════════════════
  openDirectChat(member: any) {
    this.selectedChatMember = {
      id: member.userId || member.id,
      name: member.name,
      role: member.roleName || member.role,
      color: member.avatarColor || '#6366f1',
      initial: (member.name || '?').charAt(0).toUpperCase(),
      online: member.online,
    };
    this.isGroupChat = false;
  }

  openProjectGroupChat(p: any) {
    this.selectedChatMember = {
      id: p.id,
      name: p.title || 'Group Chat',
      projectId: p.id,
      projectName: p.title,
      color: this.getProgressColor(p.progress || 0),
      initial: (p.title || '?').charAt(0).toUpperCase(),
    };
    this.isGroupChat = true;
  }

  closeChatPopup() {
    this.selectedChatMember = null;
    this.isGroupChat = false;
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════
  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-500/15 text-green-400',
      PLANNING: 'bg-blue-500/15 text-blue-400',
      ON_HOLD: 'bg-yellow-500/15 text-yellow-400',
      COMPLETED: 'bg-gray-500/15 text-gray-400',
      CANCELLED: 'bg-red-500/15 text-red-400',
    };
    return map[status] || 'bg-gray-700 text-gray-400';
  }

  getProgressColor(pct: number): string {
    if (pct >= 80) return '#22c55e';
    if (pct >= 50) return '#3b82f6';
    if (pct >= 20) return '#f59e0b';
    return '#ef4444';
  }

  formatMoney(currency: string, amt: number): string {
    return `${currency || 'USD'} ${(amt || 0).toLocaleString()}`;
  }

  getMemberInitial(m: any): string {
    return (m.name || '?').charAt(0).toUpperCase();
  }

  getMemberColor(i: number): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    return colors[i % colors.length];
  }

  getRoleBadgeStyle(role: string, roleColor?: string): string {
    // Use roleColor from API if available (new boss endpoint returns it)
    if (roleColor) {
      return `background:${roleColor}22;color:${roleColor}`;
    }
    const map: Record<string, string> = {
      BOSS: 'background:rgba(234,179,8,0.15);color:#eab308',
      COUNTRY_DIRECTOR: 'background:rgba(168,85,247,0.15);color:#a855f7',
      VICE_PRESIDENT: 'background:rgba(99,102,241,0.15);color:#818cf8',
      ADMIN: 'background:rgba(236,72,153,0.15);color:#ec4899',
      PROJECT_MANAGER: 'background:rgba(34,197,94,0.15);color:#22c55e',
      LEADER: 'background:rgba(6,182,212,0.15);color:#06b6d4',
      DEVELOPER: 'background:rgba(99,102,241,0.15);color:#6366f1',
      UI_UX: 'background:rgba(139,92,246,0.15);color:#8b5cf6',
      QA: 'background:rgba(249,115,22,0.15);color:#f97316',
    };
    return map[role] || 'background:rgba(100,116,139,0.15);color:#94a3b8';
  }

  trackById(_: number, item: any) { return item.id; }
}
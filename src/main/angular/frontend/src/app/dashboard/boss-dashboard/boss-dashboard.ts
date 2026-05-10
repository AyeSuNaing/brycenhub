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
import { SalaryApprovalInline } from '../../shared/salary-approval/salary-approval-inline';

import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;
const VP_BASE = `${BASE}/vp/dashboard`;

export interface BossStats {
  totalStaff: number; activeProjects: number; totalBranches: number; pendingApprovals: number;
}
export interface BranchOverview {
  id: number; name: string; countryName: string; countryFlag: string;
  staffCount: number; activeProjects: number; address?: string;
}
export interface CountryOverview {
  id: number; name: string; code: string; flag: string;
  branches: BranchOverview[]; totalStaff: number; totalProjects: number;
}

@Component({
  selector: 'app-boss-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    AnnouncementBarComponent, BellNotificationComponent, ProjectInlineComponent,
    ChatPopupComponent, StaffListInline, StaffProfileInline,
    AnnouncementInline, HolidaysInline, TaxBracketsInline, ChangePasswordInline,
    LeaveApprovalInline, OtApprovalInline, BranchProjectsInline, SalaryApprovalInline,
  ],
  templateUrl: './boss-dashboard.html',
  styleUrl: './boss-dashboard.scss',
})
export class BossDashboard implements OnInit, OnDestroy {
  currentUser: any = null;
  userInitial = '';
  isDark = true;

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

  filterView: 'all' | 'onTrack' | 'atRisk' | 'delayed' = 'all';
  get filteredProjects(): any[] {
    if (this.filterView === 'onTrack') return this.recentProjects.filter(p => p.status === 'ACTIVE' && (p.progress || 0) > 0);
    if (this.filterView === 'atRisk') return this.recentProjects.filter(p => p.status === 'ON_HOLD');
    if (this.filterView === 'delayed') return this.getDelayedProjects();
    return this.recentProjects;
  }
  getHealthCount(type: 'onTrack' | 'atRisk' | 'delayed'): number {
    if (type === 'onTrack') return this.recentProjects.filter(p => p.status === 'ACTIVE' && !this.isDelayed(p)).length;
    if (type === 'atRisk')  return this.recentProjects.filter(p => p.status === 'ON_HOLD').length;
    if (type === 'delayed') return this.getDelayedProjects().length;
    return 0;
  }
  isDelayed(p: any): boolean {
    if (!p.endDate) return false;
    return new Date(p.endDate) < new Date() && (p.progress || 0) < 100;
  }
  getDelayedProjects(): any[] {
    return this.recentProjects.filter(p => this.isDelayed(p) || p.status === 'CANCELLED');
  }
  getUpcomingDeadlines(): any[] {
    const now = new Date(); const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    return this.recentProjects.filter(p => {
      if (!p.endDate) return false;
      const due = new Date(p.endDate);
      return due >= now && due <= in30;
    }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()).slice(0, 5);
  }
  getDaysUntil(endDate: string): number {
    if (!endDate) return 999;
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000*60*60*24));
  }

  get userRole(): string { return this.currentUser?.role || ''; }
  get isBoss(): boolean { return this.userRole === 'BOSS'; }
  get isDR(): boolean { return this.userRole === 'COUNTRY_DIRECTOR'; }
  get isVP(): boolean { return this.userRole === 'VICE_PRESIDENT'; }
  get showApprovals(): boolean { return this.isDR; }

  showProjectDetail = false;
  selectedProjectId: number | null = null;

  activeView = 'dashboard';
  settingsOpen = false;
  selectedStaffId: number | undefined = undefined;
  selectedBranchId: number | null = null;
  searchQuery = '';

  // ── Branch detail sub-view ─────────────────────────────────────
  branchDetailView: 'overview' | 'leave' | 'ot' | 'salary' = 'overview';
  setBranchDetailView(v: 'overview' | 'leave' | 'ot' | 'salary') {
    this.branchDetailView = v;
    this.cdr.detectChanges();
  }
  // ───────────────────────────────────────────────────────────────

  stats: BossStats = { totalStaff: 0, activeProjects: 0, totalBranches: 0, pendingApprovals: 0 };
  loadingStats = true;

  branchDetailProjects: any[] = [];
  loadingBranchDetail = false;

  branchDetailStats = { activeProjects: 0, totalStaff: 0, pendingApprovals: 0, otHours: 0 };
  branchDetailOtApprovals:    any[] = [];
  branchDetailLeaveApprovals: any[] = [];
  branchDetailSalaryPeriods:  any[] = [];
  loadingBranchData = false;

  chartData: { month: string; done: number; inProgress: number; todo: number }[] = [
    { month: 'Nov', done: 0, inProgress: 0, todo: 0 }, { month: 'Dec', done: 0, inProgress: 0, todo: 0 },
    { month: 'Jan', done: 0, inProgress: 0, todo: 0 }, { month: 'Feb', done: 0, inProgress: 0, todo: 0 },
    { month: 'Mar', done: 0, inProgress: 0, todo: 0 }, { month: 'Apr', done: 0, inProgress: 0, todo: 0 },
  ];
  donutData = [
    { label: 'To Do', count: 0, color: '#6366f1' }, { label: 'In Progress', count: 0, color: '#3b82f6' },
    { label: 'In Review', count: 0, color: '#f59e0b' }, { label: 'Done', count: 0, color: '#22c55e' },
  ];

  loadChartData() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/boss/dashboard/chart-data`, h).pipe(catchError(() => of([])))
      .subscribe(data => { if (data && data.length > 0) this.chartData = data; this.cdr.detectChanges(); });
    this.http.get<any>(`${BASE}/boss/dashboard/task-stats`, h).pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) { this.donutData[0].count = s.todo||0; this.donutData[1].count = s.inProgress||0; this.donutData[2].count = s.inReview||0; this.donutData[3].count = s.done||0; }
        this.cdr.detectChanges();
      });
  }

  getTimeElapsed(startDate: string, endDate: string): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime(), end = new Date(endDate).getTime(), now = new Date().getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  }
  getTimeElapsedColor(progress: number, timeElapsed: number): string {
    if (timeElapsed >= 100 && progress < 100) return '#ef4444';
    if (timeElapsed - progress > 30) return '#f59e0b';
    return '#22c55e';
  }

  showAllProjects = false;
  get displayedProjects(): any[] { return this.showAllProjects ? this.filteredProjects : this.filteredProjects.slice(0, 10); }
  getMaxBranchProjects(): number { return this.branches.length === 0 ? 1 : Math.max(1, ...this.branches.map((b: any) => b.activeProjects || 0)); }
  getBarMaxVal(): number { return Math.max(1, ...this.chartData.map(d => d.done + d.inProgress + d.todo)); }
  getBarHeight(val: number, max: number): number { return max === 0 ? 4 : Math.max(4, Math.round((val / max) * 110)); }
  getDonutTotal(): number { return this.donutData.reduce((s, d) => s + d.count, 0); }

  financeExpenses: any[] = []; financeIncome: any[] = []; loadingFinance = false;
  pendingPayrollCount = 0;
  countries: CountryOverview[] = []; branches: BranchOverview[] = []; loadingCountries = true;
  approvalCounts = { LEAVE: 0, OT: 0, SALARY: 0 };
  recentProjects: any[] = []; loadingProjects = true;
  managementMembers: any[] = []; branchChats: any[] = [];
  selectedChatMember: ChatMember | null = null; isGroupChat = false;
  projectUnreadCounts: Record<number, number> = {}; memberUnreadCounts: Record<number, number> = {};
  private subs = new Subscription();

  constructor(
    private auth: AuthService, private http: HttpClient, private router: Router,
    private route: ActivatedRoute, private cdr: ChangeDetectorRef, private zone: NgZone,
    private refresh: RefreshService, private navState: NavigationStateService,
  ) {}

  ngOnInit() {
    this.currentUser = this.auth.getUser();
    if (!this.currentUser) { this.router.navigate(['/login']); return; }
    this.userInitial = (this.currentUser.name || 'B').charAt(0).toUpperCase();
    this.isDark = document.body.classList.contains('dark') || localStorage.getItem('brycen-theme') !== 'light';
    document.body.classList.toggle('dark', this.isDark); document.body.classList.toggle('light', !this.isDark);
    const userLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === userLang) || this.langs[0];
    const savedView = localStorage.getItem('brycen-active-view');
    if (savedView) { this.activeView = savedView; localStorage.removeItem('brycen-active-view'); }
    const saved = this.navState.restoreProjectState();
    if (saved.showProject && saved.projectId && (saved.dashboard === 'boss' || saved.dashboard === 'vp')) {
      this.selectedProjectId = saved.projectId; this.showProjectDetail = true;
      this.navState.clearProjectState(); this.cdr.detectChanges();
    }
    this.loadStats(); this.loadCountries(); this.loadBranches(); this.loadRecentProjects();
    this.loadManagementMembers(); this.loadApprovalCounts(); this.loadPendingPayrollCount(); this.loadChartData();
    this.subs.add(interval(30000).subscribe(() => this.loadApprovalCounts()));
    this.subs.add(interval(10000).subscribe(() => this.loadUnreadCounts()));
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  lbl(key: AppLabelKey): string { return getLabel(this.currentUser?.preferredLanguage, key); }

  selectLang(lang: any) {
    this.currentLangObj = lang; this.showLangMenu = false;
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); u.preferredLanguage = lang.code; localStorage.setItem('user', JSON.stringify(u)); } catch(e) {}
    this.http.put(`${BASE}/auth/language`, { language: lang.code }, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe(() => { localStorage.setItem('brycen-active-view', this.activeView); window.location.reload(); });
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark', this.isDark); document.body.classList.toggle('light', !this.isDark);
    localStorage.setItem('brycen-theme', this.isDark ? 'dark' : 'light');
  }

  setView(v: string) {
    this.activeView = v; this.settingsOpen = false;
    if (v === 'countries') this.loadCountries();
    if (v === 'branches') this.loadBranches();
    if (v === 'finance') this.loadFinance();
  }

  _prevView = 'dashboard';

  openProject(id: number) {
    this._prevView = this.activeView; this.selectedProjectId = id; this.showProjectDetail = true;
    this.navState.saveProjectState(id, 'boss'); this.cdr.detectChanges();
  }

  closeProject() {
    this.showProjectDetail = false; this.selectedProjectId = null; this.navState.clearProjectState();
    if (this._prevView === 'branch-detail') this.activeView = 'branch-detail';
    this.cdr.detectChanges();
  }

  loadFinance() {
    this.loadingFinance = true;
    this.http.get<any>(`${BASE}/boss/dashboard/finance-summary`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe((res: any) => {
        this.financeExpenses = res?.expenses || []; this.financeIncome = res?.income || [];
        this.loadingFinance = false; this.cdr.detectChanges();
      });
  }

  loadPendingPayrollCount() {
    this.http.get<any>(`${BASE}/payroll/pending-batches`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of({ totalBatches: 0 }))).subscribe(res => { this.pendingPayrollCount = res?.totalBatches || 0; this.cdr.detectChanges(); });
  }

  getTotalExpenses(): number { return this.financeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0); }
  getTotalIncome(): number { return this.financeIncome.reduce((s, e) => s + (Number(e.amount) || 0), 0); }
  getNetBalance(): number { return this.getTotalIncome() - this.getTotalExpenses(); }

  selectedCountry: CountryOverview | null = null;

  selectCountry(c: CountryOverview) { this.selectedCountry = c; this.activeView = 'country-detail'; this.settingsOpen = false; this.cdr.detectChanges(); }

  selectBranch(b: any) {
    this.selectedBranchId = b.id;
    this._prevView = this.activeView;
    this.activeView = 'branch-detail';
    this.settingsOpen = false;
    this.branchDetailView = 'overview';   // ← branch ပြောင်းတိုင်း overview ကို reset
    this.branchDetailProjects = []; this.branchDetailOtApprovals = [];
    this.branchDetailLeaveApprovals = []; this.branchDetailSalaryPeriods = [];
    this.branchDetailStats = { activeProjects: 0, totalStaff: 0, pendingApprovals: 0, otHours: 0 };
    this.cdr.detectChanges();
    this.loadBranchDetail(b.id);
    this.loadBranchDetailVpData(b.id);
  }

  loadBranchDetail(branchId: number) {
    this.loadingBranchDetail = true; this.cdr.detectChanges();
    this.http.get<any[]>(`${BASE}/projects/by-branch/${branchId}/details`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([]))).subscribe(projects => {
        this.branchDetailProjects = (projects || []).filter((p: any) => ['ACTIVE', 'PLANNING', 'ON_HOLD'].includes(p.status));
        this.loadingBranchDetail = false; this.cdr.detectChanges();
      });
  }

  loadBranchDetailVpData(branchId: number) {
    this.loadingBranchData = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${VP_BASE}/stats?branchId=${branchId}`, h).pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.branchDetailStats.activeProjects   = s.activeProjects   || 0;
          this.branchDetailStats.totalStaff       = s.totalStaff       || 0;
          this.branchDetailStats.pendingApprovals = s.pendingApprovals || 0;
          this.branchDetailStats.otHours          = s.monthlyOTHours   || 0;
        }
        this.cdr.detectChanges();
      });
    this.http.get<any[]>(`${VP_BASE}/ot-requests?status=PENDING&branchId=${branchId}`, h).pipe(catchError(() => of([])))
      .subscribe(list => { this.branchDetailOtApprovals = (list || []).slice(0, 5); this.loadingBranchData = false; this.cdr.detectChanges(); });
    this.http.get<any[]>(`${VP_BASE}/leave-requests?status=PENDING&branchId=${branchId}`, h).pipe(catchError(() => of([])))
      .subscribe(list => { this.branchDetailLeaveApprovals = (list || []).slice(0, 5); this.cdr.detectChanges(); });
    this.http.get<any[]>(`${VP_BASE}/salary-approvals?branchId=${branchId}`, h).pipe(catchError(() => of([])))
      .subscribe(list => { this.branchDetailSalaryPeriods = list || []; this.cdr.detectChanges(); });
  }

  approveBranchOt(r: any) {
    if (!this.showApprovals) return;
    this.http.patch(`${VP_BASE}/ot-requests/${r.id}/approve`, {}, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe(res => { if (res !== null && this.selectedBranchId) { this.loadBranchDetailVpData(this.selectedBranchId); this.loadApprovalCounts(); } });
  }
  rejectBranchOt(r: any) {
    if (!this.showApprovals) return;
    this.http.patch(`${VP_BASE}/ot-requests/${r.id}/reject`, { reason: 'Rejected by Director' }, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe(res => { if (res !== null && this.selectedBranchId) { this.loadBranchDetailVpData(this.selectedBranchId); this.loadApprovalCounts(); } });
  }
  approveBranchLeave(r: any) {
    if (!this.showApprovals) return;
    this.http.patch(`${VP_BASE}/leave-requests/${r.id}/approve`, {}, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe(res => { if (res !== null && this.selectedBranchId) { this.loadBranchDetailVpData(this.selectedBranchId); this.loadApprovalCounts(); } });
  }
  rejectBranchLeave(r: any) {
    if (!this.showApprovals) return;
    this.http.patch(`${VP_BASE}/leave-requests/${r.id}/reject`, { reason: 'Rejected by Director' }, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null))).subscribe(res => { if (res !== null && this.selectedBranchId) { this.loadBranchDetailVpData(this.selectedBranchId); this.loadApprovalCounts(); } });
  }

  getSelectedBranch() { return this.branches.find((b: any) => b.id === this.selectedBranchId); }

  loadStats() {
    this.loadingStats = true;
    this.http.get<any>(`${BASE}/boss/dashboard/stats`, { headers: this.auth.getHeaders() }).pipe(catchError(() => of(null)))
      .subscribe(s => { if (s) { this.stats.totalStaff = s.totalStaff||0; this.stats.totalBranches = s.totalBranches||0; this.stats.activeProjects = s.activeProjects||0; } this.loadingStats = false; this.cdr.detectChanges(); });
  }

  loadCountries() {
    this.loadingCountries = true;
    this.http.get<any[]>(`${BASE}/boss/dashboard/branches-with-stats`, { headers: this.auth.getHeaders() }).pipe(catchError(() => of([]))).subscribe(branches => {
      const countryMap = new Map<number, CountryOverview>();
      branches.forEach(b => {
        const cid = b.countryId||0, flag = b.countryFlag||'🌐', name = b.countryName||b.name;
        if (!countryMap.has(cid)) countryMap.set(cid, { id: cid, name, code: b.countryCode||'', flag, branches: [], totalStaff: 0, totalProjects: 0 });
        const c = countryMap.get(cid)!;
        c.branches.push({ id: b.id, name: b.name, countryName: b.countryName||'', countryFlag: b.countryFlag||flag, staffCount: b.staffCount||0, activeProjects: b.activeProjects||0, address: b.address||'' });
        c.totalStaff += (b.staffCount||0); c.totalProjects += (b.activeProjects||0);
      });
      this.countries = Array.from(countryMap.values()); this.branches = branches; this.loadingCountries = false;
      this.enrichProjectBranches(); this.cdr.detectChanges();
    });
  }

  loadBranches() {
    this.http.get<any[]>(`${BASE}/boss/dashboard/branches-with-stats`, { headers: this.auth.getHeaders() }).pipe(catchError(() => of([]))).subscribe(b => { this.branches = b; this.cdr.detectChanges(); });
  }

  loadRecentProjects() {
    this.loadingProjects = true;
    this.http.get<any[]>(`${BASE}/boss/dashboard/projects`, { headers: this.auth.getHeaders() }).pipe(catchError(() => of([])))
      .subscribe(projects => { this.recentProjects = projects||[]; this.loadingProjects = false; this.enrichProjectBranches(); this.cdr.detectChanges(); });
  }

  enrichProjectBranches() {
    if (this.branches.length === 0) return;
    this.recentProjects.forEach((p: any) => { if (p.branchId) { const br = this.branches.find((b: any) => b.id === p.branchId); if (br) { p.branchName = br.name; p.countryFlag = br.countryFlag||'🌐'; } } });
    this.cdr.detectChanges();
  }

  loadManagementMembers() {
    this.http.get<any[]>(`${BASE}/boss/dashboard/management-members`, { headers: this.auth.getHeaders() }).pipe(catchError(() => of([]))).subscribe(members => { this.managementMembers = members; this.cdr.detectChanges(); });
  }

  loadApprovalCounts() {
    const h = { headers: this.auth.getHeaders() };
    if (this.showApprovals) {
      this.http.get<any[]>(`${VP_BASE}/leave-requests?status=PENDING`, h).pipe(catchError(() => of([]))).subscribe(items => { this.approvalCounts.LEAVE = (items||[]).length; this.cdr.detectChanges(); });
      this.http.get<any[]>(`${VP_BASE}/ot-requests?status=PENDING`, h).pipe(catchError(() => of([]))).subscribe(items => { this.approvalCounts.OT = (items||[]).length; this.cdr.detectChanges(); });
    }
  }

  loadUnreadCounts() {
    const myId = this.currentUser?.userId || this.currentUser?.id;
    if (!myId) return;
    const projectIds = this.branchChats.map(c => c.id);
    if (projectIds.length > 0) {
      this.http.post<any>(`${BASE}/chat/unread-batch`, { userId: myId, projectIds }, { headers: this.auth.getHeaders() }).pipe(catchError(() => of(null)))
        .subscribe(data => { if (data?.projectCounts) this.projectUnreadCounts = data.projectCounts; if (data?.memberCounts) this.memberUnreadCounts = data.memberCounts; this.cdr.detectChanges(); });
    }
  }

  openMyProfile() { const myId = this.currentUser?.userId||this.currentUser?.id; if (myId) { this.selectedStaffId = myId; this.setView('member-profile'); } }
  onViewProfile(staff: any) { this.selectedStaffId = staff?.id ?? staff; this.setView('member-profile'); this.cdr.detectChanges(); }
  signOut() { this.auth.logout(); this.router.navigate(['/login']); }

  openDirectChat(member: any) {
    this.selectedChatMember = { id: member.userId||member.id, name: member.name, role: member.roleName||member.role, color: member.avatarColor||'#6366f1', initial: (member.name||'?').charAt(0).toUpperCase(), online: member.online };
    this.isGroupChat = false;
  }
  openProjectGroupChat(p: any) {
    this.selectedChatMember = { id: p.id, name: p.title||'Group Chat', projectId: p.id, projectName: p.title, color: this.getProgressColor(p.progress||0), initial: (p.title||'?').charAt(0).toUpperCase() };
    this.isGroupChat = true;
  }
  closeChatPopup() { this.selectedChatMember = null; this.isGroupChat = false; }

  getProgressColor(pct: number): string { return pct>=80?'#22c55e':pct>=50?'#3b82f6':pct>=20?'#f59e0b':'#ef4444'; }
  getStatusClass(status: string): string { return ({ ACTIVE:'bg-green-500/15 text-green-400', PLANNING:'bg-blue-500/15 text-blue-400', ON_HOLD:'bg-yellow-500/15 text-yellow-400', COMPLETED:'bg-gray-500/15 text-gray-400', CANCELLED:'bg-red-500/15 text-red-400' } as any)[status] || 'bg-gray-700 text-gray-400'; }
  formatMoney(currency: string, amt: number): string { return `${currency||'USD'} ${(amt||0).toLocaleString()}`; }
  formatPeriodLabel(period: string): string {
    if (!period) return ''; const parts = period.split('-');
    if (parts.length===2) { const months=['January','February','March','April','May','June','July','August','September','October','November','December']; return `${months[parseInt(parts[1],10)-1]||parts[1]} ${parts[0]}`; }
    return period;
  }
  getMemberInitial(m: any): string { return (m.name||'?').charAt(0).toUpperCase(); }
  getMemberColor(i: number): string { return ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6'][i%6]; }
  getRoleBadgeStyle(role: string, roleColor?: string): string {
    if (roleColor) return `background:${roleColor}22;color:${roleColor}`;
    return ({ BOSS:'background:rgba(234,179,8,0.15);color:#eab308', COUNTRY_DIRECTOR:'background:rgba(168,85,247,0.15);color:#a855f7', VICE_PRESIDENT:'background:rgba(99,102,241,0.15);color:#818cf8', ADMIN:'background:rgba(236,72,153,0.15);color:#ec4899', PROJECT_MANAGER:'background:rgba(34,197,94,0.15);color:#22c55e', LEADER:'background:rgba(6,182,212,0.15);color:#06b6d4', DEVELOPER:'background:rgba(99,102,241,0.15);color:#6366f1', UI_UX:'background:rgba(139,92,246,0.15);color:#8b5cf6', QA:'background:rgba(249,115,22,0.15);color:#f97316' } as any)[role] || 'background:rgba(100,116,139,0.15);color:#94a3b8';
  }
  openBranchVpDashboard(b: any) { this.router.navigate(['/dashboard/vp']); }
  trackById(_: number, item: any) { return item.id; }
}
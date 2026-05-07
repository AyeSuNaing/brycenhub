import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { PayslipModalComponent } from '../shared/payslip-modal.component';
import { environment } from '../../environments/environment';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-staff-profile-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, PayslipModalComponent],
  templateUrl: './staff-profile-inline.html',
  host: { style: 'display:contents' }
})
export class StaffProfileInline implements OnInit {

  @Input()  staffId!: number;
  @Output() back = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();

  staff:    any   = null;
  profile:  any   = null;
  skills:   any[] = [];
  isLoading      = true;
  isToggling     = false;
  copiedField    = '';

  activeTab: 'profile' | 'work' | 'salary' = 'profile';

  accBasic    = true;
  accLogin    = true;
  accCv       = true;
  accSkills   = true;
  accProjects = true;
  accSocial   = true;
  accDanger   = false;

  currentProjects: any[] = [];
  currentTasks:    any[] = [];

  salaryStructure: any   = null;
  salaryHistory:   any[] = [];
  latestPayslip:   any   = null;
  loadingSalary          = false;

  payslipOpen      = false;
  payslipRecordId: number | null = null;

  attendanceOpen    = false;
  attendanceLogs:   any[] = [];
  attendancePeriod  = '';
  loadingAttendance = false;

  editingLog: any = null;
  editForm = { timeIn: '', timeOut: '', isDayoff: false, note: '' };
  savingEdit = false;

  projectTasksOpen    = false;
  projectTasksLoading = false;
  selectedProject:    any   = null;
  projectColumns:     any[] = [];
  projectAllTasks:    any[] = [];
  expandedTaskId:     number | null = null;

  showResetModal   = false;
  resetPassword    = '';
  resetSaving      = false;
  resetDone        = false;
  resetCopiedField = '';

  // ✅ HTML alias properties (staff-profile-inline.html ထဲ old names သုံးနေတာနဲ့ ကိုက်အောင်)
  get showResetDialog(): boolean { return this.showResetModal; }
  set showResetDialog(v: boolean) { this.showResetModal = v; }
  get isResetting(): boolean { return this.resetSaving; }
  get resetError(): string { return ''; }
  get resetCopied(): boolean { return this.resetCopiedField === 'pwd'; }
  get resetCopiedBoth(): boolean { return this.resetCopiedField === 'both'; }

  closeResetDialog(): void { this.closeResetModal(); }
  generateResetPassword(): void { this.regenerateResetPwd(); }
  confirmReset(): void { this.saveResetPassword(); }
  copyResetPassword(): void { this.copyResetField(this.resetPassword, 'pwd'); }
  openResetDialog(): void { this.openResetModal(); }

  // ── Attendance helpers (HTML ထဲ old method names) ──
  getAttendanceWorkedDays(): number {
    return this.attendanceLogs.filter(l => l.timeIn && !l.isDayoff).length;
  }
  getAttendanceAbsentDays(): number {
    return this.attendanceLogs.filter(l => !l.timeIn && !l.isDayoff).length;
  }
  getAttendanceDayOffDays(): number {
    return this.attendanceLogs.filter(l => l.isDayoff).length;
  }
  getAvgTimeIn(): string {
    const logs = this.attendanceLogs.filter(l => l.timeIn && !l.isDayoff);
    if (logs.length === 0) return '—';
    const totalMins = logs.reduce((sum, l) => {
      const [h, m] = l.timeIn.split(':').map(Number);
      return sum + h * 60 + m;
    }, 0);
    const avg = Math.round(totalMins / logs.length);
    return `${String(Math.floor(avg / 60)).padStart(2,'0')}:${String(avg % 60).padStart(2,'0')}`;
  }
  isLateArrival(timeIn: string): boolean {
    if (!timeIn) return false;
    const [h, m] = timeIn.split(':').map(Number);
    return h > 9 || (h === 9 && m > 0);
  }
  calcHours(timeIn: string, timeOut: string): string {
    return this.formatWorkTime(this.calcWorkMinutes({ timeIn, timeOut }));
  }

  readonly DEFAULT_COLUMNS = [
    { name: 'Backlog',     statusKey: 'BACKLOG',     color: '#64748b' },
    { name: 'To Do',       statusKey: 'TODO',        color: '#6366f1' },
    { name: 'In Progress', statusKey: 'IN_PROGRESS', color: '#3b82f6' },
    { name: 'In Review',   statusKey: 'IN_REVIEW',   color: '#f59e0b' },
    { name: 'Done',        statusKey: 'DONE',        color: '#22c55e' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  ngOnInit() { this.loadProfile(); }

  setTab(tab: 'profile' | 'work' | 'salary'): void {
    this.activeTab = tab;
    if (tab === 'salary' && !this.salaryStructure && !this.loadingSalary) {
      this.loadSalaryData();
    }
  }

  canViewCurrentWork(): boolean {
  const loginRole = (this.auth.getUser()?.role || '').toUpperCase();
  return !['ADMIN'].includes(loginRole);
}

  canViewDangerZone(): boolean {
    return (this.auth.getUser()?.role || '') === 'ADMIN';
  }

  // ✅ FIX: Member မိမိ profile မှာ salary tab မြင်ရ
  canViewSalary(): boolean {
    const user = this.auth.getUser();
    const role = user?.role || '';
    if (['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS', 'ADMIN'].includes(role)) return true;
    const myId = user?.id || user?.userId;
    return !!myId && Number(myId) === Number(this.staffId);
  }

  // ✅ Own profile စစ်ဆေးသည်
  isOwnProfile(): boolean {
    const user = this.auth.getUser();
    const myId = user?.id || user?.userId;
    return !!myId && Number(myId) === Number(this.staffId);
  }

  toggleAcc(key: string) {
    if (key === 'basic')    this.accBasic    = !this.accBasic;
    if (key === 'login')    this.accLogin    = !this.accLogin;
    if (key === 'cv')       this.accCv       = !this.accCv;
    if (key === 'skills')   this.accSkills   = !this.accSkills;
    if (key === 'projects') this.accProjects = !this.accProjects;
    if (key === 'social')   this.accSocial   = !this.accSocial;
    if (key === 'danger')   this.accDanger   = !this.accDanger;
  }

  loadProfile() {
    this.isLoading = true;
    const lang = this.auth.getUser()?.preferredLanguage || 'en';
    this.http.get<any>(`${BASE}/users/${this.staffId}/full-profile?lang=${lang}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this.staff = {
            id: data.id, name: data.name, email: data.email, phone: data.phone,
            isActive: data.isActive, preferredLanguage: data.preferredLanguage,
            profileImage: data.profileImage, lastSeen: data.lastSeen,
            roleId: data.roleId, roleName: data.roleName,
            roleDisplayName: data.roleDisplayName, roleColor: data.roleColor,
            departmentId: data.departmentId, departmentName: data.departmentName,
          };
          if (data.cvAnalyzed !== null || data.cvFileUrl || data.educationEn) {
            let projects: any[] = [];
            if (data.projectsJson) { try { projects = JSON.parse(data.projectsJson); } catch (_) {} }
            let socialLinks: any = null;
            if (data.socialLinksJson) { try { socialLinks = JSON.parse(data.socialLinksJson); } catch (_) {} }
            this.profile = {
              cvAnalyzed: data.cvAnalyzed, cvFileUrl: data.cvFileUrl,
              experienceYears: data.experienceYears, educationEn: data.educationEn,
              experienceDetailEn: data.experienceDetailEn,
              cvOriginalLanguage: data.cvOriginalLanguage, projects, socialLinks,
            };
          } else { this.profile = null; }
          this.skills    = data.skills || [];
          this.isLoading = false;
          this.cdr.detectChanges();
          if (this.canViewCurrentWork()) { this.loadCurrentWork(); }
        },
        error: () => { this.isLoading = false; this.cdr.detectChanges(); }
      });
  }

  loadCurrentWork(): void {
    this.http.get<any>(`${BASE}/users/${this.staffId}/current-work`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this.currentProjects = data.projects || [];
          this.currentTasks    = data.tasks    || [];
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  // ✅ FIX: Own profile → /payroll/my-history endpoint သုံး
  loadSalaryData(): void {
    this.loadingSalary = true;
    const h = { headers: this.auth.getHeaders() };

    // Salary structure
    this.http.get<any[]>(`${BASE}/salary-structures/history/${this.staffId}`, h)
      .subscribe({
        next: d => {
          const list = d || [];
          this.salaryStructure = list.length > 0 ? {
            currency: list[0].currency || 'USD', baseSalary: list[0].baseSalary,
            otRatePerHour: list[0].otRatePerHour || 0,
            workingDaysPerMonth: list[0].workingDaysPerMonth || 26,
            effectiveDate: list[0].effectiveDate, note: list[0].note,
          } : null;
          this.cdr.detectChanges();
        },
        error: () => { this.salaryStructure = null; this.cdr.detectChanges(); }
      });

    // ✅ Own profile → /payroll/my-history (own records only)
    if (this.isOwnProfile()) {
      this.http.get<any[]>(`${BASE}/payroll/my-history`, h)
        .subscribe({
          next: rows => {
            this.salaryHistory = rows || [];
            this.latestPayslip = this.salaryHistory[0] || null;
            this.loadingSalary = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.salaryHistory = [];
            this.latestPayslip = null;
            this.loadingSalary = false;
            this.cdr.detectChanges();
          }
        });
      return;
    }

    // Admin/VP/CD/Boss → full payroll history
    const branchId = this.auth.getUser()?.branchId || 3;
    this.http.get<any>(`${BASE}/payroll/history?branchId=${branchId}`, h)
      .subscribe({
        next: firstResp => {
          const periods: string[] = firstResp?.availablePeriods || [];
          if (periods.length === 0) {
            this.salaryHistory = []; this.latestPayslip = null;
            this.loadingSalary = false; this.cdr.detectChanges(); return;
          }
          const allRows: any[] = [];
          let remaining = periods.length;
          periods.forEach(period => {
            this.http.get<any>(
              `${BASE}/payroll/history?branchId=${branchId}&payPeriod=${period}`, h
            ).subscribe({
              next: resp => {
                const rows = (resp?.rows || []).filter(
                  (r: any) => Number(r.userId) === Number(this.staffId)
                );
                allRows.push(...rows); remaining--;
                if (remaining === 0) {
                  allRows.sort((a, b) => b.payPeriod.localeCompare(a.payPeriod));
                  this.salaryHistory = allRows; this.latestPayslip = allRows[0] || null;
                  this.loadingSalary = false; this.cdr.detectChanges();
                }
              },
              error: () => {
                remaining--;
                if (remaining === 0) {
                  allRows.sort((a, b) => b.payPeriod.localeCompare(a.payPeriod));
                  this.salaryHistory = allRows; this.latestPayslip = allRows[0] || null;
                  this.loadingSalary = false; this.cdr.detectChanges();
                }
              }
            });
          });
        },
        error: () => { this.loadingSalary = false; this.cdr.detectChanges(); }
      });
  }

  toggleActivation() {
    if (!this.staff) return;
    this.isToggling = true;
    const url = this.staff.isActive
      ? `${BASE}/users/${this.staffId}/deactivate`
      : `${BASE}/users/${this.staffId}/activate`;
    this.http.put(url, {}, { headers: this.auth.getHeaders() }).subscribe({
      next: () => { this.staff.isActive = !this.staff.isActive; this.isToggling = false; this.cdr.detectChanges(); },
      error: () => { this.isToggling = false; }
    });
  }

  copyField(text: string, field: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2000);
    });
  }

  copyBoth() {
    if (!this.staff) return;
    const text = 'Email: ' + this.staff.email + '\nLogin URL: http://localhost:4200/login';
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = 'both';
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2000);
    });
  }

  openResetModal(): void {
    this.showResetModal = true; this.resetPassword = this.generatePwd();
    this.resetSaving = false; this.resetDone = false; this.resetCopiedField = '';
    this.cdr.detectChanges();
  }
  closeResetModal(): void { this.showResetModal = false; this.cdr.detectChanges(); }

  generatePwd(): string {
    const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghjkmnpqrstuvwxyz',
          d = '23456789', s = '@#$!';
    const all = u + l + d + s;
    let p = u[Math.floor(Math.random()*u.length)] + l[Math.floor(Math.random()*l.length)]
           + d[Math.floor(Math.random()*d.length)] + s[Math.floor(Math.random()*s.length)];
    for (let i = 4; i < 10; i++) p += all[Math.floor(Math.random()*all.length)];
    return p.split('').sort(() => Math.random()-0.5).join('');
  }

  regenerateResetPwd(): void { this.resetPassword = this.generatePwd(); this.resetCopiedField = ''; this.cdr.detectChanges(); }

  copyResetField(text: string, field: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.resetCopiedField = field; this.cdr.detectChanges();
      setTimeout(() => { this.resetCopiedField = ''; this.cdr.detectChanges(); }, 2000);
    });
  }

  copyResetBoth(): void {
    this.copyResetField('Email: ' + this.staff.email + '\nPassword: ' + this.resetPassword, 'both');
  }

  saveResetPassword(): void {
    if (!this.staff?.id || this.resetSaving) return;
    this.resetSaving = true;
    this.http.put(`${BASE}/users/${this.staff.id}/change-password`,
      { newPassword: this.resetPassword }, { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => { this.resetSaving = false; this.resetDone = true; this.cdr.detectChanges(); },
        error: () => { this.resetSaving = false; this.cdr.detectChanges(); }
      });
  }

  openPayslip(id: number): void { this.payslipRecordId = id; this.payslipOpen = true; this.cdr.detectChanges(); }
  closePayslip(): void { this.payslipOpen = false; this.payslipRecordId = null; this.cdr.detectChanges(); }

  openAttendance(row: any): void {
    this.attendancePeriod = row.payPeriod; this.attendanceLogs = [];
    this.attendanceOpen = true; this.loadingAttendance = true; this.cdr.detectChanges();
    const from = row.periodStart || (() => {
      const [y, m] = row.payPeriod.split('-');
      const pm = m === '01' ? 12 : Number(m) - 1;
      const py = m === '01' ? Number(y) - 1 : Number(y);
      return `${py}-${String(pm).padStart(2,'0')}-25`;
    })();
    const to = row.periodEnd || row.payPeriod + '-24';
    this.http.get<any[]>(`${BASE}/users/${this.staffId}/attendance?from=${from}&to=${to}`,
      { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.attendanceLogs = d || []; this.loadingAttendance = false; this.cdr.detectChanges(); },
      error: () => { this.loadingAttendance = false; this.cdr.detectChanges(); }
    });
  }

  closeAttendance(): void { this.attendanceOpen = false; this.attendanceLogs = []; this.editingLog = null; this.cdr.detectChanges(); }

  canEditAttendance(): boolean {
    const role = this.auth.getUser()?.role || '';
    const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
    if (Number(myId) === Number(this.staffId)) return true;
    return ['ADMIN', 'BOSS', 'COUNTRY_DIRECTOR'].includes(role);
  }

  openEditLog(log: any): void {
    this.editingLog = log;
    this.editForm = {
      timeIn:   log.timeIn  ? log.timeIn.substring(0, 5)  : '',
      timeOut:  log.timeOut ? log.timeOut.substring(0, 5) : '',
      isDayoff: log.isDayoff || false, note: log.note || '',
    };
    this.cdr.detectChanges();
  }

  closeEditLog(): void { this.editingLog = null; this.cdr.detectChanges(); }

  saveEditLog(): void {
    if (!this.editingLog || this.savingEdit) return;
    this.savingEdit = true;
    this.http.patch(`${BASE}/users/${this.staffId}/attendance/${this.editingLog.workDate}`,
      this.editForm, { headers: this.auth.getHeaders() }).subscribe({
      next: () => {
        Object.assign(this.editingLog, {
          timeIn: this.editForm.timeIn || null, timeOut: this.editForm.timeOut || null,
          isDayoff: this.editForm.isDayoff, note: this.editForm.note,
        });
        this.savingEdit = false; this.editingLog = null; this.cdr.detectChanges();
      },
      error: () => { this.savingEdit = false; this.cdr.detectChanges(); }
    });
  }

  getAttendanceSummary(): { present: number; dayoff: number; missing: number } {
    return {
      present: this.attendanceLogs.filter(l => l.timeIn && !l.isDayoff).length,
      dayoff:  this.attendanceLogs.filter(l => l.isDayoff).length,
      missing: this.attendanceLogs.filter(l => !l.timeIn && !l.isDayoff).length,
    };
  }

  calcWorkMinutes(log: any): number {
    if (!log.timeIn || !log.timeOut) return 0;
    const [h1, m1] = log.timeIn.split(':').map(Number);
    const [h2, m2] = log.timeOut.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  }

  formatWorkTime(mins: number): string {
    if (mins <= 0) return '—';
    return `${Math.floor(mins / 60)}h${mins % 60 ? ' ' + (mins % 60) + 'm' : ''}`;
  }

  getDayName(dateStr: string): string {
    if (!dateStr) return '';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr).getDay()];
  }

  openProjectTasks(project: any): void {
    this.selectedProject = project; this.projectTasksOpen = true;
    this.projectTasksLoading = true; this.projectColumns = []; this.projectAllTasks = [];
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/project-board-columns/by-project/${project.id}`, h).subscribe({
      next: cols => {
        this.projectColumns = (cols && cols.length > 0)
          ? cols.sort((a, b) => (a.position || 0) - (b.position || 0))
          : this.DEFAULT_COLUMNS;
        this.cdr.detectChanges();
      },
      error: () => { this.projectColumns = this.DEFAULT_COLUMNS; }
    });
    this.http.get<any[]>(`${BASE}/tasks/by-project/${project.id}`, h).subscribe({
      next: tasks => { this.projectAllTasks = tasks || []; this.projectTasksLoading = false; this.cdr.detectChanges(); },
      error: () => { this.projectTasksLoading = false; }
    });
  }

  closeProjectTasks(): void { this.projectTasksOpen = false; this.selectedProject = null; this.projectAllTasks = []; this.cdr.detectChanges(); }

  getColumnTasks(statusKey: string): any[] {
    return this.projectAllTasks.filter(t =>
      (t.status || '').toUpperCase() === statusKey.toUpperCase() &&
      Number(t.assigneeId) === Number(this.staffId)
    );
  }

  isMyTask(task: any): boolean { return Number(task.assigneeId) === Number(this.staffId); }
  myProjectTasks(): any[] { return this.projectAllTasks.filter(t => Number(t.assigneeId) === Number(this.staffId)); }

  getProjectName(projectId: number): string {
    const p = this.currentProjects.find(p => Number(p.id) === Number(projectId));
    return p?.title || p?.name || '';
  }

  toggleTask(id: number): void { this.expandedTaskId = this.expandedTaskId === id ? null : id; this.cdr.detectChanges(); }

  getAvatarColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2','#d97706'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }

  getSkillColor(level: string): string {
    switch (level) {
      case 'SENIOR':   return '#a78bfa';
      case 'MID':      return '#60a5fa';
      case 'BEGINNER': return '#34d399';
      default:         return '#94a3b8';
    }
  }
  getSkillBg(level: string): string {
    switch (level) {
      case 'SENIOR':   return 'rgba(167,139,250,0.1)';
      case 'MID':      return 'rgba(96,165,250,0.1)';
      case 'BEGINNER': return 'rgba(52,211,153,0.1)';
      default:         return 'rgba(148,163,184,0.1)';
    }
  }

  getLangLabel(code: string): string {
    const map: Record<string, string> = {
      en: '🇺🇸 English', ja: '🇯🇵 Japanese', my: '🇲🇲 Myanmar',
      km: '🇰🇭 Khmer',   vi: '🇻🇳 Vietnamese', ko: '🇰🇷 Korean'
    };
    return map[code] || code;
  }

  splitEntries(text: string): string[] {
    if (!text) return [];
    return text.split(';').map(s => s.trim()).filter(s => s.length > 0);
  }

  getSkillGroups(): { level: string; label: string; skills: any[] }[] {
    return [
      { level: 'SENIOR',   label: this.lbl('Senior'),         skills: this.skills.filter(s => s.skillLevel === 'SENIOR')   },
      { level: 'MID',      label: this.lbl('Mid Level'),      skills: this.skills.filter(s => s.skillLevel === 'MID')      },
      { level: 'BEGINNER', label: this.lbl('Beginner'),       skills: this.skills.filter(s => s.skillLevel === 'BEGINNER') },
      { level: '',         label: this.lbl('Other (skills)'), skills: this.skills.filter(s => !s.skillLevel)               },
    ];
  }

  getSkillCount(level: string): number { return this.skills.filter(s => s.skillLevel === level).length; }
  getInputTypeCount(type: string): number { return this.skills.filter(s => s.inputType === type).length; }

  splitTech(tech: string): string[] {
    if (!tech) return [];
    return tech.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  hasSocialLinks(p: any): boolean {
    if (!p?.socialLinks) return false;
    const s = p.socialLinks;
    return !!(s.linkedin || s.github || s.twitter || s.facebook || s.website || s.other);
  }

  toUrl(link: string): string {
    if (!link) return '#';
    return link.startsWith('http') ? link : 'https://' + link;
  }

  formatMoney(amount: number): string {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(amount);
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
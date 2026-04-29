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
  @Output() back     = new EventEmitter<void>();
  @Output() edit     = new EventEmitter<any>();

  staff:         any = null;
  profile:       any = null;
  skills:        any[] = [];
  isLoading      = true;
  isToggling     = false;
  copiedField    = '';

  // ── Tab state ──────────────────────────────
  activeTab: 'profile' | 'work' | 'salary' = 'profile';

  // accordion state
  accBasic    = true;
  accLogin    = true;
  accCv       = true;
  accSkills   = true;
  accProjects = true;
  accSocial   = true;
  accDanger   = false;

  // ── Work tab ───────────────────────────────
  currentProjects: any[] = [];
  currentTasks:    any[] = [];

  // ── Salary tab ─────────────────────────────
  salaryStructure: any   = null;
  salaryHistory:   any[] = [];
  latestPayslip:   any   = null;
  loadingSalary          = false;

  // ── Payslip modal ──────────────────────────
  payslipOpen     = false;
  payslipRecordId: number | null = null;

  // ── Attendance modal ───────────────────────
  attendanceOpen   = false;
  attendanceLogs:  any[] = [];
  attendancePeriod = '';
  loadingAttendance = false;

  // ── Attendance edit ────────────────────────
  editingLog: any = null;
  editForm = { timeIn: '', timeOut: '', isDayoff: false, note: '' };
  savingEdit = false;

  // ── Project Tasks Modal ────────────────────
  projectTasksOpen    = false;
  projectTasksLoading = false;
  selectedProject:    any = null;
  projectColumns:     any[] = [];
  projectAllTasks:    any[] = [];
  expandedTaskId:     number | null = null;

  readonly DEFAULT_COLUMNS = [
    { name: 'Backlog',     statusKey: 'BACKLOG',     color: '#64748b' },
    { name: 'To Do',       statusKey: 'TODO',        color: '#6366f1' },
    { name: 'In Progress', statusKey: 'IN_PROGRESS', color: '#3b82f6' },
    { name: 'In Review',   statusKey: 'IN_REVIEW',   color: '#f59e0b' },
    { name: 'Done',        statusKey: 'DONE',        color: '#22c55e' },
  ];

  constructor(
    private http:  HttpClient,
    private auth:  AuthService,
    private cdr:   ChangeDetectorRef,
  ) {}

  // ══════════════════════════════════════════
  // i18n
  // ══════════════════════════════════════════
  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  ngOnInit() {
    this.loadProfile();
  }

  // ══════════════════════════════════════════
  // TAB HELPERS
  // ══════════════════════════════════════════

  setTab(tab: 'profile' | 'work' | 'salary'): void {
    this.activeTab = tab;
    if (tab === 'salary' && !this.salaryStructure && !this.loadingSalary) {
      this.loadSalaryData();
    }
  }

  canViewCurrentWork(): boolean {
    const staffRole = (this.staff?.roleName || this.staff?.role || '').toUpperCase();
    const hideRoles = ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS', 'ADMIN'];
    return !hideRoles.includes(staffRole);
  }

  canViewDangerZone(): boolean {
    const role = this.auth.getUser()?.role || '';
    return role === 'ADMIN';
  }

  canViewSalary(): boolean {
    const role = this.auth.getUser()?.role || '';
    return ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS', 'ADMIN'].includes(role);
  }

  // ══════════════════════════════════════════
  // DATA LOADERS
  // ══════════════════════════════════════════

  loadProfile() {
    this.isLoading = true;
    const lang = this.auth.getUser()?.preferredLanguage || 'en';
    this.http.get<any>(`${BASE}/users/${this.staffId}/full-profile?lang=${lang}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this.staff = {
            id:                data.id,
            name:              data.name,
            email:             data.email,
            phone:             data.phone,
            isActive:          data.isActive,
            preferredLanguage: data.preferredLanguage,
            profileImage:      data.profileImage,
            lastSeen:          data.lastSeen,
            roleId:            data.roleId,
            roleName:          data.roleName,
            roleDisplayName:   data.roleDisplayName,
            roleColor:         data.roleColor,
            departmentId:      data.departmentId,
            departmentName:    data.departmentName,
          };

          if (data.cvAnalyzed !== null || data.cvFileUrl || data.educationEn) {
            let projects: any[] = [];
            if (data.projectsJson) {
              try { projects = JSON.parse(data.projectsJson); } catch (_) {}
            }
            let socialLinks: any = null;
            if (data.socialLinksJson) {
              try { socialLinks = JSON.parse(data.socialLinksJson); } catch (_) {}
            }
            this.profile = {
              cvAnalyzed:         data.cvAnalyzed,
              cvFileUrl:          data.cvFileUrl,
              experienceYears:    data.experienceYears,
              educationEn:        data.educationEn,
              experienceDetailEn: data.experienceDetailEn,
              cvOriginalLanguage: data.cvOriginalLanguage,
              projects:           projects,
              socialLinks:        socialLinks,
            };
          } else {
            this.profile = null;
          }

          this.skills    = data.skills || [];
          this.isLoading = false;
          this.cdr.detectChanges();

          if (this.canViewCurrentWork()) {
            this.loadCurrentWork();
          }
        },
        error: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
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

  loadSalaryData(): void {
    this.loadingSalary = true;
    const h = { headers: this.auth.getHeaders() };

    this.http.get<any[]>(`${BASE}/salary-structures/history/${this.staffId}`, h)
      .subscribe({
        next: d => {
          const list = d || [];
          this.salaryStructure = list.length > 0 ? {
            currency:            'USD',
            baseSalary:          list[0].baseSalary,
            otRatePerHour:       list[0].otRatePerHour || 0,
            workingDaysPerMonth: list[0].workingDaysPerMonth || 26,
            effectiveDate:       list[0].effectiveDate,
            note:                list[0].note,
          } : null;
          this.cdr.detectChanges();
        },
        error: () => { this.salaryStructure = null; this.cdr.detectChanges(); }
      });

    const branchId = this.auth.getUser()?.branchId || 3;
    this.http.get<any>(`${BASE}/payroll/history?branchId=${branchId}`, h)
      .subscribe({
        next: firstResp => {
          const periods: string[] = firstResp?.availablePeriods || [];
          if (periods.length === 0) {
            this.salaryHistory = [];
            this.latestPayslip = null;
            this.loadingSalary = false;
            this.cdr.detectChanges();
            return;
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
                allRows.push(...rows);
                remaining--;
                if (remaining === 0) {
                  allRows.sort((a, b) => b.payPeriod.localeCompare(a.payPeriod));
                  this.salaryHistory = allRows;
                  this.latestPayslip = allRows[0] || null;
                  this.loadingSalary = false;
                  this.cdr.detectChanges();
                }
              },
              error: () => {
                remaining--;
                if (remaining === 0) {
                  allRows.sort((a, b) => b.payPeriod.localeCompare(a.payPeriod));
                  this.salaryHistory = allRows;
                  this.latestPayslip = allRows[0] || null;
                  this.loadingSalary = false;
                  this.cdr.detectChanges();
                }
              }
            });
          });
        },
        error: () => { this.loadingSalary = false; this.cdr.detectChanges(); }
      });
  }

  // ══════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════

  toggleActivation() {
    if (!this.staff) return;
    this.isToggling = true;
    const url = this.staff.isActive
      ? `${BASE}/users/${this.staffId}/deactivate`
      : `${BASE}/users/${this.staffId}/activate`;

    this.http.put(url, {}, { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => {
          this.staff.isActive = !this.staff.isActive;
          this.isToggling = false;
          this.cdr.detectChanges();
        },
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

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════

  getAvatarColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2','#d97706'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

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

  getSkillCount(level: string): number {
    return this.skills.filter(s => s.skillLevel === level).length;
  }

  getInputTypeCount(type: string): number {
    return this.skills.filter(s => s.inputType === type).length;
  }

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

  toggleAcc(key: string) {
    if (key === 'basic')    this.accBasic    = !this.accBasic;
    if (key === 'login')    this.accLogin    = !this.accLogin;
    if (key === 'cv')       this.accCv       = !this.accCv;
    if (key === 'skills')   this.accSkills   = !this.accSkills;
    if (key === 'projects') this.accProjects = !this.accProjects;
    if (key === 'social')   this.accSocial   = !this.accSocial;
    if (key === 'danger')   this.accDanger   = !this.accDanger;
  }

  openPayslip(id: number): void {
    this.payslipRecordId = id;
    this.payslipOpen     = true;
    this.cdr.detectChanges();
  }

  closePayslip(): void {
    this.payslipOpen     = false;
    this.payslipRecordId = null;
    this.cdr.detectChanges();
  }

  openAttendance(row: any): void {
    this.attendancePeriod  = row.payPeriod;
    this.attendanceLogs    = [];
    this.attendanceOpen    = true;
    this.loadingAttendance = true;
    this.cdr.detectChanges();

    const from = row.periodStart || (row.payPeriod + '-25').replace(/(\d{4}-\d{2})-(\d{2})/, (_, ym) => {
      const [y, m] = ym.split('-');
      const pm = m === '01' ? 12 : Number(m) - 1;
      const py = m === '01' ? Number(y) - 1 : Number(y);
      return `${py}-${String(pm).padStart(2,'0')}-25`;
    });
    const to = row.periodEnd || row.payPeriod + '-24';

    this.http.get<any[]>(
      `${BASE}/users/${this.staffId}/attendance?from=${from}&to=${to}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: d => {
        this.attendanceLogs    = d || [];
        this.loadingAttendance = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingAttendance = false; this.cdr.detectChanges(); }
    });
  }

  closeAttendance(): void {
    this.attendanceOpen = false;
    this.attendanceLogs = [];
    this.editingLog = null;
    this.cdr.detectChanges();
  }

  canEditAttendance(): boolean {
    const role = this.auth.getUser()?.role || '';
    const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
    if (Number(myId) === Number(this.staffId)) return true;
    return ['ADMIN', 'BOSS', 'COUNTRY_DIRECTOR'].includes(role);
  }

  openEditLog(log: any): void {
    this.editingLog = log;
    this.editForm = {
      timeIn:   log.timeIn   ? log.timeIn.substring(0, 5)   : '',
      timeOut:  log.timeOut  ? log.timeOut.substring(0, 5)  : '',
      isDayoff: log.isDayoff || false,
      note:     log.note     || '',
    };
    this.cdr.detectChanges();
  }

  closeEditLog(): void {
    this.editingLog = null;
    this.cdr.detectChanges();
  }

  saveEditLog(): void {
    if (!this.editingLog) return;
    this.savingEdit = true;
    const body: any = {
      timeIn:   this.editForm.timeIn   || null,
      timeOut:  this.editForm.timeOut  || null,
      isDayoff: this.editForm.isDayoff,
      note:     this.editForm.note,
    };
    this.http.patch(
      `${BASE}/users/${this.staffId}/attendance/${this.editingLog.workDate}`,
      body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => {
        const idx = this.attendanceLogs.findIndex(
          a => a.workDate === this.editingLog.workDate
        );
        if (idx > -1) {
          this.attendanceLogs[idx] = {
            ...this.attendanceLogs[idx],
            timeIn:   body.timeIn   ? body.timeIn + ':00'   : null,
            timeOut:  body.timeOut  ? body.timeOut + ':00'  : null,
            isDayoff: body.isDayoff,
            note:     body.note,
            source:   'MANUAL',
          };
        }
        this.savingEdit  = false;
        this.editingLog  = null;
        this.cdr.detectChanges();
      },
      error: () => { this.savingEdit = false; this.cdr.detectChanges(); }
    });
  }

  getAttendanceWorkedDays(): number {
    return this.attendanceLogs.filter(a => !a.isDayoff && a.timeIn).length;
  }

  getAttendanceAbsentDays(): number {
    return this.attendanceLogs.filter(a => !a.isDayoff && !a.timeIn).length;
  }

  getAttendanceDayOffDays(): number {
    return this.attendanceLogs.filter(a => a.isDayoff).length;
  }

  getAvgTimeIn(): string {
    const logs = this.attendanceLogs.filter(a => !a.isDayoff && a.timeIn);
    if (logs.length === 0) return '—';
    const total = logs.reduce((sum, a) => {
      const [h, m] = a.timeIn.split(':').map(Number);
      return sum + h * 60 + m;
    }, 0);
    const avg = Math.round(total / logs.length);
    return `${String(Math.floor(avg / 60)).padStart(2,'0')}:${String(avg % 60).padStart(2,'0')}`;
  }

  isLateArrival(timeIn: string): boolean {
    if (!timeIn) return false;
    const [h, m] = timeIn.split(':').map(Number);
    return h > 9 || (h === 9 && m > 0);
  }

  calcHours(timeIn: string, timeOut: string): string {
    if (!timeIn || !timeOut) return '—';
    const [hi, mi] = timeIn.split(':').map(Number);
    const [ho, mo] = timeOut.split(':').map(Number);
    const mins = (ho * 60 + mo) - (hi * 60 + mi);
    if (mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m > 0 ? m + 'm' : ''}`;
  }

  getDayName(dateStr: string): string {
    if (!dateStr) return '';
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return days[new Date(dateStr).getDay()];
  }

  openProjectTasks(project: any): void {
    this.selectedProject     = project;
    this.projectTasksOpen    = true;
    this.projectTasksLoading = true;
    this.projectColumns      = [];
    this.projectAllTasks     = [];
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };

    this.http.get<any[]>(`${BASE}/project-board-columns/by-project/${project.id}`, h)
      .subscribe({
        next: cols => {
          this.projectColumns = (cols && cols.length > 0)
            ? cols.sort((a, b) => (a.position || 0) - (b.position || 0))
            : this.DEFAULT_COLUMNS;
          this.cdr.detectChanges();
        },
        error: () => { this.projectColumns = this.DEFAULT_COLUMNS; }
      });

    this.http.get<any[]>(`${BASE}/tasks/by-project/${project.id}`, h)
      .subscribe({
        next: tasks => {
          this.projectAllTasks     = tasks || [];
          this.projectTasksLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.projectTasksLoading = false; }
      });
  }

  closeProjectTasks(): void {
    this.projectTasksOpen = false;
    this.selectedProject  = null;
    this.projectAllTasks  = [];
    this.cdr.detectChanges();
  }

  getColumnTasks(statusKey: string): any[] {
    return this.projectAllTasks.filter(t =>
      (t.status || '').toUpperCase() === statusKey.toUpperCase() &&
      Number(t.assigneeId) === Number(this.staffId)
    );
  }

  isMyTask(task: any): boolean {
    return Number(task.assigneeId) === Number(this.staffId);
  }

  myProjectTasks(): any[] {
    return this.projectAllTasks.filter(t =>
      Number(t.assigneeId) === Number(this.staffId)
    );
  }

  getProjectName(projectId: number): string {
    const p = this.currentProjects.find(p => Number(p.id) === Number(projectId));
    return p?.title || p?.name || '';
  }

  toggleTask(id: number): void {
    this.expandedTaskId = this.expandedTaskId === id ? null : id;
    this.cdr.detectChanges();
  }
}
import {
  Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { DashboardDataService } from '../services/dashboard-data.service';
import { AnnouncementBarComponent } from '../shared/announcement-bar.component';
import { BellNotificationComponent } from '../shared/bell-notification.component';
import { API } from '../constants/api-endpoints';
import { environment } from '../../environments/environment';
import { StaffListInline } from '../admin/staff-list-inline';
import { AddStaffInline } from '../admin/add-staff-inline';
import { StaffProfileInline } from '../admin/staff-profile-inline';
import { HolidaysInline } from '../admin/holidays-inline';
import { TaxBracketsInline } from '../admin/tax-brackets-inline';
import { SalaryStructuresInline } from '../admin/salary-structures-inline';
import { AttendanceUploadInline } from '../admin/attendance-upload-inline';
import { StaffPanelComponent } from '../shared/staff-panel/staff-panel.component';
import { PayrollWizardInline } from '../admin/payroll-wizard-inline';
import { PayrollHistoryInline } from '../admin/payroll-history-inline';
import { AnnouncementInline } from '../shared/announcement-inline';
import { ChangePasswordInline } from '../shared/change-password/change-password-inline';



const BASE = environment.apiBaseUrl;
const ADMIN_BASE = `${environment.apiBaseUrl}/admin/dashboard`;

const LOGO_SVG = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTY1MzM0Ii8+PHRleHQgeD0iNiIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM4NmVmYWMiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PC9zdmc+`;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    AnnouncementBarComponent, BellNotificationComponent,
    StaffListInline,
    AddStaffInline,
    StaffProfileInline,
    HolidaysInline,
    TaxBracketsInline,
    SalaryStructuresInline,
    AttendanceUploadInline,
    StaffPanelComponent,
    PayrollWizardInline, 
    PayrollHistoryInline, 
    AnnouncementInline,
    ChangePasswordInline,
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit, OnDestroy {

  // ── Shell state ──
  logoSrc = LOGO_SVG;
  isDark = true;
  showLangMenu = false;
  settingsOpen = false;
  searchQuery = '';
  currentUser: any = null;

  // ── Inline view state ──
  activeView = 'dashboard';
  selectedStaffId = 0;

  // ── Holiday modal state ──
  selectedHoliday: any = null;

  // ── Right panel visibility (persistent layout) ──
  /**
   * Views that want FULL-WIDTH main content (hide right staff panel).
   * Keep empty [] to show right panel on ALL pages including Salary.
   */
  fullWidthViews: string[] = [];  // empty = always show right panel

  get showRightPanel(): boolean {
    return !this.fullWidthViews.includes(this.activeView);
  }

  // ── Stats ──────────────────────────────────
  stats = {
    totalStaff: 0,
    pendingOT: 0,
    totalOTHours: 0,
    leaveRequests: 0,
    todayLeave: 0,
    active: 0,
    inactive: 0,
  };

  currentMonth = new Date().toLocaleString('en', { month: 'long' });
  payrollStatus = 'DRAFT';

  // ── Data ───────────────────────────────────
  announcements: any[] = [];
  notifications: any[] = [];
  staffList: any[] = [];
  otRequests: any[] = [];
  leaveRequests: any[] = [];
  todayLeaveList: any[] = [];
  holidays: any[] = [];

  loading = {
    stats: true, staff: true, ot: true,
    leave: true, holiday: true,
  };

  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean' },
  ];
  currentLangObj = this.langs[0];

  navSections: { label: string; items: any[] }[] = [
    {
      label: 'MAIN', items: [
        { key: 'dashboard', icon: '📊', label: 'Dashboard' },
        { key: 'announce', icon: '📢', label: 'Announcements' },
      ]
    },
    {
      label: 'STAFF', items: [
        { key: 'staff-list', icon: '👥', label: 'Staff List' },
        { key: 'add-staff', icon: '➕', label: 'Add Staff' },
        { key: 'department', icon: '🏢', label: 'Departments' },
        { key: 'leave', icon: '🏖️', label: 'Leave Requests', badge: 0, badgeColor: '#818cf8' },
      ]
    },
    {
      label: 'PAYROLL', items: [
        { key: 'salary', icon: '💵', label: 'Salary Structures' },
        { key: 'attendance', icon: '📅', label: 'Upload Attendance' },
        { key: 'payroll', icon: '💰', label: 'Monthly Payroll' },
        { key: 'payroll-history',icon: '📊', label: 'Payroll History' }, 
      ]
    },
    {
      label: 'SETTINGS', items: [
        { key: 'holidays', icon: '🗓️', label: 'Public Holidays' },
        { key: 'tax', icon: '🌏', label: 'Tax Brackets' },
      ]
    },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private dataService: DashboardDataService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    const saved = localStorage.getItem('brycen-theme');
    this.setTheme(saved !== 'light');
    this.currentUser = this.auth.getUser();
    const savedLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];
    const savedView = localStorage.getItem('brycen-active-view');

    if (savedView) {
      this.activeView = savedView;
      localStorage.removeItem('brycen-active-view');
    }

    this.loadAll();
  }

  ngOnDestroy() { }

  // ── Load all ──
  loadAll() {
    this.loadStats();
    this.loadStaff();
    this.loadOTRequests();
    this.loadLeaveRequests();
    this.loadTodayLeave();
    this.loadHolidays();
    this.loadAnnouncements();
    this.loadNotifications();
  }

  loadStats() {
    this.loading.stats = true;
    this.http.get<any>(`${ADMIN_BASE}/stats`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: s => {
          this.stats.totalStaff = s.totalStaff;
          this.stats.pendingOT = s.pendingOT;
          this.stats.totalOTHours = s.totalOTHours;
          this.stats.leaveRequests = s.leaveRequests;
          this.stats.todayLeave = s.todayLeave;
          this.payrollStatus = s.payrollStatus;
          this.loading.stats = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.stats = false; }
      });
  }

  loadStaff() {
    this.loading.staff = true;
    this.http.get<any[]>(`${BASE}/users/staff-list`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: users => {
          this.staffList = users;
          this.stats.active = users.filter(u => u.isActive).length;
          this.stats.inactive = users.filter(u => !u.isActive).length;
          this.loading.staff = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.staff = false; }
      });
  }

  loadOTRequests() {
    this.loading.ot = true;
    this.http.get<any[]>(`${ADMIN_BASE}/ot-requests?status=PENDING`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.otRequests = list;
          this.loading.ot = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.ot = false; }
      });
  }

  loadLeaveRequests() {
    this.loading.leave = true;
    this.http.get<any[]>(`${ADMIN_BASE}/leave-requests?status=PENDING`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.leaveRequests = list;
          this.updateLeaveBadge(list.length);
          this.loading.leave = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.leave = false; }
      });
  }

  loadTodayLeave() {
    this.http.get<any[]>(`${ADMIN_BASE}/today-leave`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.todayLeaveList = list.filter(l => l.isToday);
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  loadHolidays() {
    this.loading.holiday = true;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.http.get<any[]>(`${ADMIN_BASE}/holidays?year=${year}&month=${month}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.holidays = list;
          this.loading.holiday = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.holiday = false; }
      });
  }

  loadAnnouncements() {
    this.dataService.getAnnouncements().subscribe({
      next: d => { this.announcements = d; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  loadNotifications() {
    this.dataService.getNotifications().subscribe({
      next: d => { this.notifications = d; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  // ── Nav ──
  setView(key: string, route?: string) {
    this.activeView = key;
    if (route) this.router.navigate([route]);
  }
  closeToDashboard() { this.activeView = 'dashboard'; }

  // ── Staff callbacks ────────────────────────
  onStaffCreated() {
    this.activeView = 'staff-list';
    this.loadStats();
    this.loadStaff();
  }

  onViewProfile(staff: any) {
    this.selectedStaffId = staff.id;
    this.activeView = 'staff-profile';
  }

  // ── Staff activate / deactivate ──
  toggleActivation(staff: any) {
    const url = staff.isActive
      ? `${BASE}/users/${staff.id}/deactivate`
      : `${BASE}/users/${staff.id}/activate`;
    this.http.put(url, {}, { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => {
          staff.isActive = !staff.isActive;
          this.loadStats();
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  // ── OT / Leave actions ─────────────────────
  approveOT(id: number) {
    this.http.patch(`${ADMIN_BASE}/ot-requests/${id}/approve`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => { this.loadStats(); this.loadOTRequests(); } });
  }
  rejectOT(id: number) {
    this.http.patch(`${ADMIN_BASE}/ot-requests/${id}/reject`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => { this.loadStats(); this.loadOTRequests(); } });
  }
  approveLeave(id: number) {
    this.http.patch(`${ADMIN_BASE}/leave-requests/${id}/approve`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => { this.loadStats(); this.loadLeaveRequests(); this.loadTodayLeave(); } });
  }
  rejectLeave(id: number) {
    this.http.patch(`${ADMIN_BASE}/leave-requests/${id}/reject`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => { this.loadStats(); this.loadLeaveRequests(); } });
  }

  // ── Badge update ───────────────────────────
  updateLeaveBadge(count: number) {
    const section = this.navSections.find(s => s.label === 'STAFF');
    if (section) {
      const item = section.items.find(i => i.key === 'leave');
      if (item) item.badge = count;
    }
  }

  // ── Theme / Lang ───────────────────────────
  setTheme(dark: boolean) {
    this.isDark = dark;
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('brycen-theme', dark ? 'dark' : 'light');
  }
  toggleTheme() { this.setTheme(!this.isDark); }

  setLang(lang: any) {
  this.currentLangObj = lang;
  this.showLangMenu = false;
  this.http.put(API.AUTH.LANGUAGE, { language: lang.code },
    { headers: this.auth.getHeaders() }).subscribe({
      next: () => {
        const user = this.auth.getUser();
        if (user) {
          user.preferredLanguage = lang.code;
          localStorage.setItem('user', JSON.stringify(user));
        }
        localStorage.setItem('brycen-active-view', this.activeView);
        window.location.reload();
      }
    });
}


  // ── Helpers ────────────────────────────────
  getUnreadCount(): number {
    return this.notifications.filter((n: any) => !n.isRead).length;
  }
  getAvatarColor(name: string): string {
    const c = ['#16a34a', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#0891b2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
  getLeaveTypeStyle(type: string): string {
    const m: Record<string, string> = {
      ANNUAL: 'background:#22c55e22;color:#22c55e',
      SICK: 'background:#f59e0b22;color:#f59e0b',
      UNPAID: 'background:#ef444422;color:#ef4444',
    };
    return m[type] || 'background:#1e293b;color:#94a3b8';
  }

  // ══════════════════════════════════════════════
  // CALENDAR HELPERS — Dashboard Holidays card
  // ══════════════════════════════════════════════

  /** Grid of 42 cells (6 weeks × 7 days) covering current month + padding */
  get calendarGrid(): { date: Date; inMonth: boolean }[] {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const firstDay = new Date(y, m, 1);
    const startOffset = firstDay.getDay(); // 0 = Sun
    const gridStart = new Date(y, m, 1 - startOffset);

    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === m });
    }
    return cells;
  }

  isWeekend(d: Date): boolean {
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  isSunday(d: Date): boolean { return d.getDay() === 0; }
  isSaturday(d: Date): boolean { return d.getDay() === 6; }

  isToday(d: Date): boolean {
    const t = new Date();
    return d.getFullYear() === t.getFullYear()
        && d.getMonth() === t.getMonth()
        && d.getDate() === t.getDate();
  }

  /** Returns holiday object for given date (or null) */
  getHolidayForDate(d: Date): any | null {
    if (!this.holidays || this.holidays.length === 0) return null;
    const ymd = this.toYMD(d);
    return this.holidays.find(h => this.toYMD(new Date(h.holidayDate)) === ymd) || null;
  }

  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  openHolidayModal(holiday: any): void {
    this.selectedHoliday = holiday;
  }

  closeHolidayModal(): void {
    this.selectedHoliday = null;
  }

  signOut() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.lang-wrap')) this.showLangMenu = false;
    if (!t.closest('.settings-wrap')) this.settingsOpen = false;
  }
}
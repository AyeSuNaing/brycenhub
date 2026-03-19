import {
  Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { AnnouncementBarComponent } from '../shared/announcement-bar.component';
import { BellNotificationComponent } from '../shared/bell-notification.component';
import { API } from '../constants/api-endpoints';

const BASE = 'http://localhost:8080/api';

const LOGO_SVG = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTY1MzM0Ii8+PHRleHQgeD0iNiIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM4NmVmYWMiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PC9zdmc+`;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    AnnouncementBarComponent, BellNotificationComponent
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl:    './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit, OnDestroy {

  logoSrc      = LOGO_SVG;
  isDark       = true;
  showLangMenu = false;
  settingsOpen = false;
  searchQuery  = '';
  activeNav    = 'dashboard';

  currentUser: any = null;

  // ── Stats ──────────────────────────────────
  stats = {
    totalStaff:    0,
    pendingOT:     0,
    totalOTHours:  0,
    leaveRequests: 0,
    todayLeave:    0,
    active:        0,
    inactive:      0,
  };

  currentMonth = new Date().toLocaleString('en', { month: 'long' });
  payrollStatus = 'DRAFT';

  // ── Data ───────────────────────────────────
  announcements: any[] = [];
  notifications: any[] = [];
  staffList:     any[] = [];
  otRequests:    any[] = [];
  leaveRequests: any[] = [];
  todayLeaveList:any[] = [];
  holidays:      any[] = [];
  nextHoliday:   any   = null;

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
        { key: 'dashboard',  icon: '📊', label: 'Dashboard' },
        { key: 'chat',       icon: '💬', label: 'Chat',          route: '/chat' },
        { key: 'announce',   icon: '📢', label: 'Announcements' },
      ]
    },
    {
      label: 'STAFF', items: [
        { key: 'staff-list', icon: '👥', label: 'Staff List' },
        { key: 'add-staff',  icon: '➕', label: 'Add Staff' },
        { key: 'leave',      icon: '🏖️', label: 'Leave Requests', badge: 0, badgeColor: '#818cf8' },
      ]
    },
    {
      label: 'PAYROLL', items: [
        { key: 'payroll',    icon: '💰', label: 'Monthly Payroll' },
      ]
    },
    {
      label: 'SETTINGS', items: [
        { key: 'holidays',   icon: '🗓️', label: 'Public Holidays' },
        { key: 'tax',        icon: '🌏', label: 'Tax Brackets' },
      ]
    },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('brycen-theme');
    this.setTheme(saved !== 'light');
    this.currentUser = this.auth.getUser();
    const savedLang = this.currentUser?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];
    this.loadAll();
  }

  ngOnDestroy() {}

  loadAll() {
    this.loadStaff();
    this.loadOTRequests();
    this.loadLeaveRequests();
    this.loadAnnouncements();
    this.loadNotifications();
    this.loadHolidays();
  }

  loadStaff() {
    this.loading.staff = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/by-branch/${this.currentUser?.branchId}`, h)
      .subscribe({
        next: users => {
          this.staffList = users;
          this.stats.totalStaff = users.length;
          this.stats.active     = users.filter(u => u.isActive).length;
          this.stats.inactive   = users.filter(u => !u.isActive).length;
          this.loading.staff    = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.staff = false; }
      });
  }

  loadOTRequests() {
    this.loading.ot = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/ot-requests?status=PENDING`, h)
      .subscribe({
        next: list => {
          this.otRequests     = list;
          this.stats.pendingOT = list.length;
          this.stats.totalOTHours = list.reduce((s, r) => s + (r.otHours || 0), 0);
          this.loading.ot     = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.ot = false; }
      });
  }

  loadLeaveRequests() {
    this.loading.leave = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/leave-requests?status=PENDING`, h)
      .subscribe({
        next: list => {
          this.leaveRequests      = list;
          this.stats.leaveRequests = list.length;
          const today = new Date().toISOString().split('T')[0];
          this.todayLeaveList     = list.filter(l =>
            l.startDate <= today && l.endDate >= today
          );
          this.stats.todayLeave   = this.todayLeaveList.length;
          this.updateLeaveBadge(list.length);
          this.loading.leave      = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.leave = false; }
      });
  }

  loadAnnouncements() {
    this.http.get<any[]>(`${BASE}/dashboard/pm/announcements`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: d => { this.announcements = d; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  loadNotifications() {
    this.http.get<any[]>(`${BASE}/notifications/my`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: d => { this.notifications = d; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  loadHolidays() {
    this.loading.holiday = true;
    const now  = new Date();
    const year = now.getFullYear();
    const mon  = now.getMonth() + 1;
    const h    = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/public-holidays?year=${year}&month=${mon}`, h)
      .subscribe({
        next: list => {
          this.holidays        = list;
          this.loading.holiday = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading.holiday = false; }
      });
  }

  updateLeaveBadge(count: number) {
    const section = this.navSections.find(s => s.label === 'STAFF');
    if (section) {
      const item = section.items.find(i => i.key === 'leave');
      if (item) (item as any).badge = count;
    }
  }

  // ── Actions ────────────────────────────────
  approveOT(id: number) {
    this.http.patch(`${BASE}/ot-requests/${id}/approve`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => this.loadOTRequests() });
  }
  rejectOT(id: number) {
    this.http.patch(`${BASE}/ot-requests/${id}/reject`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => this.loadOTRequests() });
  }
  approveLeave(id: number) {
    this.http.patch(`${BASE}/leave-requests/${id}/approve`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => this.loadLeaveRequests() });
  }
  rejectLeave(id: number) {
    this.http.patch(`${BASE}/leave-requests/${id}/reject`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({ next: () => this.loadLeaveRequests() });
  }

  // ── Nav ────────────────────────────────────
  setNav(key: string, route?: string) {
    this.activeNav = key;
    if (route) this.router.navigate([route]);
  }

  // ── Theme / Lang ───────────────────────────
  setTheme(dark: boolean) {
    this.isDark = dark;
    document.body.classList.toggle('dark',  dark);
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('brycen-theme', dark ? 'dark' : 'light');
  }
  toggleTheme() { this.setTheme(!this.isDark); }

  setLang(lang: any) {
    this.currentLangObj = lang;
    this.showLangMenu   = false;
    this.http.put(API.AUTH.LANGUAGE, { language: lang.code },
      { headers: this.auth.getHeaders() }).subscribe();
  }

  // ── Helpers ────────────────────────────────
  getUnreadCount(): number {
    return this.notifications.filter((n: any) => !n.isRead).length;
  }
  getAvatarColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
  getRoleBadgeStyle(role: string): string {
    const m: Record<string, string> = {
      BOSS:             'background:#78350f;color:#fbbf24',
      COUNTRY_DIRECTOR: 'background:#3b0764;color:#c084fc',
      ADMIN:            'background:#4a044e;color:#f0abfc',
      PROJECT_MANAGER:  'background:#14532d;color:#86efac',
      LEADER:           'background:#164e63;color:#67e8f9',
      DEVELOPER:        'background:#1e1b4b;color:#a5b4fc',
      UI_UX:            'background:#14532d;color:#86efac',
      QA:               'background:#431407;color:#fdba74',
    };
    return m[role] || 'background:#1e293b;color:#94a3b8';
  }
  getLeaveTypeStyle(type: string): string {
    const m: Record<string, string> = {
      ANNUAL: 'background:#22c55e22;color:#22c55e',
      SICK:   'background:#f59e0b22;color:#f59e0b',
      UNPAID: 'background:#ef444422;color:#ef4444',
    };
    return m[type] || 'background:#1e293b;color:#94a3b8';
  }

  signOut() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.lang-wrap'))     this.showLangMenu  = false;
    if (!t.closest('.settings-wrap')) this.settingsOpen  = false;
  }
}

import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { AuthService }             from '../../services/auth.service';
import { DashboardDataService }    from '../../services/dashboard-data.service';
import { AnnouncementBarComponent }  from '../../shared/announcement-bar.component';
import { BellNotificationComponent } from '../../shared/bell-notification.component';
import { AnnouncementInline }        from '../../shared/announcement-inline';
import { ChangePasswordInline }      from '../../shared/change-password/change-password-inline';
import { StaffListInline }           from '../../admin/staff-list-inline';
import { StaffProfileInline }        from '../../admin/staff-profile-inline';
import { HolidaysInline }            from '../../admin/holidays-inline';
import { TaxBracketsInline }         from '../../admin/tax-brackets-inline';
import { SalaryStructuresInline }    from '../../admin/salary-structures-inline';

import { BranchManagementInline }    from '../../super-admin/branch-management-inline';
import { BranchAdminInline }         from '../../super-admin/branch-admin-inline';
import { ChatPopupComponent, ChatMember } from '../../shared/chat-popup/chat-popup.component';

import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;
const SA_BASE = `${BASE}/super-admin`;

const LOGO_SVG = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTY1MzM0Ii8+PHRleHQgeD0iNiIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM4NmVmYWMiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PC9zdmc+`;

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    AnnouncementBarComponent, BellNotificationComponent,
    AnnouncementInline, ChangePasswordInline,
    StaffListInline, StaffProfileInline,
    HolidaysInline, TaxBracketsInline, SalaryStructuresInline,
    BranchManagementInline, BranchAdminInline,
    ChatPopupComponent,
  ],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.scss',
})
export class SuperAdminDashboard implements OnInit, OnDestroy {

  // ── State ──────────────────────────────────────────────────────
  logoSrc       = LOGO_SVG;
  isDark        = true;
  showLangMenu  = false;
  settingsOpen  = false;
  searchQuery   = '';
  activeView    = 'dashboard';
  currentUser: any = null;

  showRightPanel = true;

  // Staff profile navigation
  selectedStaffId  = 0;
  profileBackTo    = 'staff-list';

  // ── Chat (Management Group) ──────────────────────────────────────
  activeChatMember: ChatMember | null = null;
  isGroupChat = false;
  mgmtUnreadCount = 0;
  private _unreadTimer: any;

  // ── Management Staff (right panel) ────────────────────────────
  mgmtStaff:     any[] = [];
  mgmtSearch     = '';
  loadingMgmt    = false;
  directTarget:  ChatMember | null = null;

  readonly MGMT_ROLES = ['BOSS','COUNTRY_DIRECTOR','VICE_PRESIDENT'];
  readonly MGMT_ROLES_ALL = ['BOSS','COUNTRY_DIRECTOR','VICE_PRESIDENT','ADMIN'];

  // Admin team (1-to-1 chat)
  adminTeam: any[] = [];
  loadingAdminTeam = false;
  adminSearch = '';
  memberUnreadCounts: Record<number, number> = {};
  branchChatUnread = 0;
  private _unreadPollTimer: any;

  loadMgmtStaff() {
    this.loadingMgmt = true;
    this.http.get<any[]>(`${BASE}/users/all-staff`, { headers: this.auth.getHeaders() }).subscribe({
      next: list => {
        const all = list || [];
        // Management: BOSS + CD + VP only
        this.mgmtStaff = all.filter(u => this.MGMT_ROLES.includes(u.roleName || u.role || ''));
        // Admin team: ADMIN role only (branch admins)
        this.adminTeam  = all.filter(u => (u.roleName || u.role || '') === 'ADMIN');
        this.loadingMgmt = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingMgmt = false; },
    });
  }

  get filteredAdminTeam(): any[] {
    if (!this.adminSearch.trim()) return this.adminTeam;
    const q = this.adminSearch.toLowerCase();
    return this.adminTeam.filter(s =>
      (s.name||'').toLowerCase().includes(q) ||
      (s.branchName||'').toLowerCase().includes(q)
    );
  }

  loadUnreadCounts() {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    this.http.get<any[]>(`${BASE}/chat/direct-unread-by-sender?userId=${myId}`, { headers: this.auth.getHeaders() })
      .subscribe({ next: list => { (list||[]).forEach(r => { if (r.senderId) this.memberUnreadCounts[r.senderId] = r.unreadCount || 0; }); this.cdr.detectChanges(); }, error: () => {} });
  }

  openAdminDirectChat(s: any) {
    this.isGroupChat = false;
    this.activeChatMember = {
      id: s.id, name: s.name,
      role: s.roleDisplayName || s.roleName,
      color: s.roleColor || '#f59e0b',
      initial: this.getInitial(s.name),
    };
    const myId = this.currentUser?.id || this.currentUser?.userId;
    this.http.put(`${BASE}/chat/read-channel?type=DIRECT&channelId=${myId}`, {}, { headers: this.auth.getHeaders() })
      .subscribe({ error: () => {} });
    this.memberUnreadCounts[s.id] = 0;
    this.cdr.detectChanges();
  }

  get filteredMgmt(): any[] {
    if (!this.mgmtSearch.trim()) return this.mgmtStaff;
    const q = this.mgmtSearch.toLowerCase();
    return this.mgmtStaff.filter(s =>
      (s.name||'').toLowerCase().includes(q) ||
      (s.branchName||'').toLowerCase().includes(q)
    );
  }

  openDirectChat(s: any) {
    this.isGroupChat = false;
    this.activeChatMember = {
      id: s.id, name: s.name,
      role: s.roleDisplayName || s.roleName,
      color: s.roleColor || '#7c3aed',
      initial: this.getInitial(s.name),
    };
    this.cdr.detectChanges();
  }

  openMgmtGroupChat() {
    // GLOBAL channel — Management group chat
    this.isGroupChat = true;
    this.activeChatMember = {
      id: 0,
      name: '⚡ Management Chat',
      projectId: 0,
      projectName: 'GLOBAL',
      color: '#7c3aed',
    };
    // Mark as read
    this.http.put(
      `${BASE}/chat/read-channel?type=GLOBAL`, {},
      { headers: this.auth.getHeaders() }
    ).subscribe({ error: () => {} });
    this.mgmtUnreadCount = 0;
    this.cdr.detectChanges();
  }

  closeChatPopup() {
    this.activeChatMember = null;
    this.isGroupChat = false;
    this.cdr.detectChanges();
  }

  loadMgmtUnread() {
    this.http.get<any>(`${BASE}/chat/unread`, { headers: this.auth.getHeaders() })
      .subscribe({ next: r => { this.mgmtUnreadCount = r?.count || 0; this.cdr.detectChanges(); }, error: () => {} });
  }

  // ── Stats ──────────────────────────────────────────────────────
  stats = {
    totalBranches:      0,
    totalBranchAdmins:  0,
    totalStaff:         0,
    totalAnnouncements: 0,
  };
  loadingStats = true;

  // ── Company Overview ───────────────────────────────────────────
  companyOverview: any[] = [];
  loadingOverview = false;

  // ── Misc ───────────────────────────────────────────────────────
  announcements:  any[] = [];
  notifications:  any[] = [];

  // ── Languages ─────────────────────────────────────────────────
  languages = [
    { code: 'en', flag: '🇺🇸', display: 'EN', name: 'English'  },
    { code: 'ja', flag: '🇯🇵', display: 'JP', name: '日本語'   },
    { code: 'my', flag: '🇲🇲', display: 'MY', name: 'မြန်မာ'  },
    { code: 'km', flag: '🇰🇭', display: 'KH', name: 'ខ្មែរ'    },
    { code: 'vi', flag: '🇻🇳', display: 'VN', name: 'Tiếng Việt'},
    { code: 'ko', flag: '🇰🇷', display: 'KR', name: '한국어'   },
  ];
  currentLangObj = this.languages[0];

  // ── Sidebar Navigation ─────────────────────────────────────────
  navSections = [
    {
      label: 'MAIN',
      items: [
        { key: 'dashboard',        icon: '📊', label: 'Dashboard'        },
        { key: 'company-overview', icon: '🌏', label: 'Company Overview' },
      ],
    },
    {
      label: 'MANAGEMENT',
      items: [
        { key: 'branches',      icon: '🏢', label: 'Branch Management' },
        { key: 'branch-admins', icon: '👤', label: 'Branch Admins'     },
        { key: 'staff-list',    icon: '👥', label: 'Staff (View)'      },
      ],
    },
    {
      label: 'HR DATA',
      items: [
        { key: 'holidays',  icon: '🌴', label: 'Holidays'       },
        { key: 'tax',       icon: '💰', label: 'Tax Brackets'   },
        { key: 'salary',    icon: '💵', label: 'Salary History' },
      ],
    },
    {
      label: 'COMMUNICATIONS',
      items: [
        { key: 'announce', icon: '📢', label: 'Announcements' },
      ],
    },
  ];

  private _pollTimer: any;

  constructor(
    private http:        HttpClient,
    private auth:        AuthService,
    private dataService: DashboardDataService,
    private router:      Router,
    private cdr:         ChangeDetectorRef,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit() {
    // Theme
    const saved = localStorage.getItem('brycen-theme');
    this.isDark  = saved !== 'light';
    document.body.classList.toggle('dark',  this.isDark);
    document.body.classList.toggle('light', !this.isDark);

    // Restore view after lang reload
    const savedView = localStorage.getItem('brycen-active-view');
    if (savedView) { this.activeView = savedView; localStorage.removeItem('brycen-active-view'); }

    // Current user
    this.currentUser = this.auth.getUser();
    const lang = this.languages.find(l => l.code === this.currentUser?.preferredLanguage);
    if (lang) this.currentLangObj = lang;

    // Load data
    this.loadStats();
    this.loadAnnouncements();
    this.loadNotifications();
    this.loadMgmtStaff();
    this._unreadPollTimer = setInterval(() => this.loadUnreadCounts(), 10_000);

    // Poll notifications every 30s
    this._pollTimer = setInterval(() => this.loadNotifications(), 30_000);
    // Poll management unread
    this.loadMgmtUnread();
    this._unreadTimer = setInterval(() => this.loadMgmtUnread(), 15_000);
  }

  ngOnDestroy() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._unreadTimer) clearInterval(this._unreadTimer);
    if (this._unreadPollTimer) clearInterval(this._unreadPollTimer);
  }

  @HostListener('document:click')
  onDocClick() {
    this.showLangMenu  = false;
    this.settingsOpen  = false;
  }

  // ── Data Loaders ───────────────────────────────────────────────
  loadStats() {
    this.loadingStats = true;
    this.http.get<any>(`${SA_BASE}/stats`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => {
        this.stats.totalBranches      = d?.totalBranches      || 0;
        this.stats.totalBranchAdmins  = d?.totalBranchAdmins  || 0;
        this.stats.totalStaff         = d?.totalStaff         || 0;
        this.stats.totalAnnouncements = d?.totalAnnouncements || 0;
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingStats = false; this.cdr.detectChanges(); },
    });
  }

  loadCompanyOverview() {
    if (this.companyOverview.length > 0) return; // cached
    this.loadingOverview = true;
    this.http.get<any[]>(`${SA_BASE}/company-overview`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => {
        this.companyOverview = d || [];
        this.loadingOverview = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingOverview = false; this.cdr.detectChanges(); },
    });
  }

  loadAnnouncements() {
    this.dataService.getAnnouncements().subscribe({
      next: d => { this.announcements = d; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadNotifications() {
    this.dataService.getNotifications().subscribe({
      next: d => { this.notifications = d; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  // ── Navigation ─────────────────────────────────────────────────
  setView(key: string) {
    this.activeView = key;
    if (key === 'company-overview') this.loadCompanyOverview();
    this.cdr.detectChanges();
  }

  closeToDashboard() { this.activeView = 'dashboard'; }

  onViewStaffProfile(staff: any) {
    this.selectedStaffId = staff.id ?? staff.userId ?? staff;
    this.profileBackTo   = 'staff-list';
    this.activeView      = 'staff-profile';
    this.cdr.detectChanges();
  }

  openMyProfile() {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    this.selectedStaffId = myId;
    this.profileBackTo   = 'dashboard';
    this.activeView      = 'staff-profile';
    this.settingsOpen    = false;
    this.cdr.detectChanges();
  }

  onStaffProfileBack() {
    this.activeView = this.profileBackTo || 'staff-list';
    this.cdr.detectChanges();
  }

  // ── Theme / Lang ───────────────────────────────────────────────
  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark',  this.isDark);
    document.body.classList.toggle('light', !this.isDark);
    localStorage.setItem('brycen-theme', this.isDark ? 'dark' : 'light');
  }

  setLang(lang: any) {
    this.currentLangObj = lang;
    this.showLangMenu   = false;
    this.http.put(`${BASE}/auth/language`, { language: lang.code }, { headers: this.auth.getHeaders() }).subscribe({
      next: () => {
        const user = this.auth.getUser();
        if (user) { user.preferredLanguage = lang.code; localStorage.setItem('user', JSON.stringify(user)); }
        localStorage.setItem('brycen-active-view', this.activeView);
        window.location.reload();
      },
    });
  }

  signOut() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ── Helpers ────────────────────────────────────────────────────
  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
  getAvatarColor(name: string): string {
    const c = ['#7c3aed','#0284c7','#16a34a','#db2777','#ea580c','#0891b2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getUnreadCount(): number { return this.notifications.filter((n: any) => !n.isRead).length; }

  // Company overview country flag helper
  countryFlag(code: string): string {
    const map: any = { JP:'🇯🇵', MM:'🇲🇲', KH:'🇰🇭', VN:'🇻🇳', KR:'🇰🇷', US:'🇺🇸' };
    return map[code] || '🌐';
  }
}
import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardDataService } from '../services/dashboard-data.service';
import { AuthService } from '../services/auth.service';
import { AnnouncementBarComponent } from '../shared/announcement-bar.component';
import { BellNotificationComponent } from '../shared/bell-notification.component';
import { ViewChild } from '@angular/core';
import { ProjectInlineComponent } from '../projects/project-inline';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { ProjectNewInline } from '../projects/project-new-inline';
import { ChatPopupComponent, ChatMember } from '../shared/chat-popup/chat-popup.component';
import { AnnouncementInline } from '../shared/announcement-inline';
import { MyLeaveRequestComponent } from '../shared/my-leave-request/my-leave-request.component';
import { MyOtRequestComponent }    from '../shared/my-ot-request/my-ot-request.component';

import {
  Announcement, Notification, ActiveProject, PortfolioProject,
  TeamMember, MyTask, OverdueTask, Activity, Deadline
} from '../models/dashboard.models';

import { environment } from '../../environments/environment';
const BASE = environment.apiBaseUrl;

const LOGO_SVG = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTY1MzM0Ii8+PHRleHQgeD0iNiIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM4NmVmYWMiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PC9zdmc+`;

@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    FormsModule,
    AnnouncementBarComponent,
    BellNotificationComponent,
    ProjectInlineComponent,
    ProjectNewInline,
    ChatPopupComponent,
    AnnouncementInline,
    MyLeaveRequestComponent,
    MyOtRequestComponent,
  ],
  templateUrl: './member-dashboard.html',
  styleUrl: './member-dashboard.scss'
})
export class MemberDashboard implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild(ProjectInlineComponent) projectInline?: ProjectInlineComponent;

  selectedChatMember: ChatMember | null = null;
  isGroupChat = false;

  selectedProjectId: number | null = null;
  showProjectDetail = false;
  showNewProject = false;
  logoSrc = LOGO_SVG;
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
  currentUser: any = null;
  activeView = 'dashboard';

  // ── Chat Unread Badge ──
  memberUnreadCounts: Record<number, number> = {};
  projectUnreadCounts: Record<number, number> = {};
  branchUnreadCount = 0;
  private _unreadPollTimer: any = null;

  setView(v: string): void {
    this.activeView = v;
    if (v === 'dashboard') {
      this.showProjectDetail = false;
      this.showNewProject    = false;
    }
    this.cdr.detectChanges();
  }

  loading = {
    stats: true, projects: true, team: true, tasks: true,
    overdue: true, activity: true, deadline: true, announce: true, notif: true,
  };

  announcements: Announcement[] = [];
  notifications: Notification[] = [];
  activeProjects: ActiveProject[] = [];
  portfolio: PortfolioProject[] = [];
  portfolioProjects: PortfolioProject[] = [];
  teamMembers: TeamMember[] = [];
  myTasks: MyTask[] = [];
  overdueTasks: OverdueTask[] = [];
  activities: Activity[] = [];
  deadlines: Deadline[] = [];

  stats = { total: 0, active: 0, overdue: 0, members: 0 };

  chartData = [
    { month: "Nov", done: 22, inProgress: 18, todo: 12 },
    { month: "Dec", done: 35, inProgress: 22, todo: 15 },
    { month: "Jan", done: 18, inProgress: 28, todo: 10 },
    { month: "Feb", done: 30, inProgress: 20, todo: 22 },
    { month: "Mar", done: 42, inProgress: 18, todo: 16 },
    { month: "Apr", done: 38, inProgress: 24, todo: 14 },
  ];

  donutData = [
    { label: 'To Do', count: 72, color: '#6366f1' },
    { label: 'In Progress', count: 48, color: '#3b82f6' },
    { label: 'In Review', count: 24, color: '#f59e0b' },
    { label: 'Done', count: 36, color: '#22c55e' },
  ];

  constructor(
    private dataService: DashboardDataService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private ngZone: NgZone,
  ) { }

  ngOnInit() {
    const saved = localStorage.getItem('brycen-theme');
    this.setTheme(saved !== 'light');
    this.currentUser = this.authService.getUser();
    this.cdr.detectChanges();
    const savedLang = this.authService.getUser()?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];
    this.authService.loadCurrentUser().subscribe({
      next: () => { this.currentUser = this.authService.getUser(); this.cdr.detectChanges(); }
    });

    this.route.queryParams.subscribe(params => {
      if (params['projectId']) {
        const id = Number(params['projectId']);
        const checkAndOpen = () => {
          if (!this.loading.projects) {
            this.selectedProjectId = id;
            this.showProjectDetail = true;
            this.cdr.detectChanges();
          } else {
            setTimeout(checkAndOpen, 100);
          }
        };
        setTimeout(checkAndOpen, 200);
      } else {
        this.selectedProjectId = null;
        this.showProjectDetail = false;
        this.cdr.detectChanges();
      }
    });

    // ✅ lang reload ပြီးရင် view ပြန်ရောက်
    const savedView = localStorage.getItem('brycen-active-view');
    if (savedView) {
      this.activeView = savedView;
      localStorage.removeItem('brycen-active-view');
    }

    this.loadAll();
    this.startUnreadPolling();
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.myTasksMaxH = Math.floor(window.innerHeight * 0.45);
          this.cdr.detectChanges();
        });
      }, 0);
    });
  }

  ngOnDestroy() {
    this.stopUnreadPolling();
  }

  loadAll() {
    this.dataService.getStats().subscribe({
      next: data => { this.stats = data; this.loading.stats = false; this.cdr.detectChanges(); },
      error: () => { this.loading.stats = false; this.cdr.detectChanges(); }
    });
    this.dataService.getActiveProjects().subscribe({
      next: data => { this.activeProjects = data; this.loading.projects = false; this.cdr.detectChanges(); },
      error: () => { this.loading.projects = false; this.cdr.detectChanges(); }
    });
    this.dataService.getChartData().subscribe({
      next: data => { this.chartData = data; this.cdr.detectChanges(); },
      error: () => { }
    });
    this.dataService.getTaskStats().subscribe({
      next: data => {
        this.donutData = [
          { label: 'To Do', count: data.todo, color: '#6366f1' },
          { label: 'In Progress', count: data.inProgress, color: '#3b82f6' },
          { label: 'In Review', count: data.inReview, color: '#f59e0b' },
          { label: 'Done', count: data.done, color: '#22c55e' },
        ];
        this.cdr.detectChanges();
      },
      error: () => { }
    });
    this.dataService.getPortfolioProjects().subscribe({
      next: data => { this.portfolioProjects = data; this.portfolio = data; this.loading.projects = false; this.cdr.detectChanges(); },
      error: () => { this.loading.projects = false; this.cdr.detectChanges(); }
    });
    this.dataService.getTeamMembers().subscribe({
      next: data => { this.teamMembers = data; this.loading.team = false; this.cdr.detectChanges(); },
      error: () => { this.loading.team = false; this.cdr.detectChanges(); }
    });

    // ✅ My Tasks — backend က lang param နဲ့ translate ပြန်ပေးတယ်
    const lang = this.authService.getUser()?.preferredLanguage || 'en';
    this.dataService.getMyTasks(lang).subscribe({
      next: data => {
        this.myTasks = data;
        this.loading.tasks = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.tasks = false; this.cdr.detectChanges(); }
    });

    this.dataService.getOverdueTasks().subscribe({
      next: data => { this.overdueTasks = data; this.loading.overdue = false; this.cdr.detectChanges(); },
      error: () => { this.loading.overdue = false; this.cdr.detectChanges(); }
    });
    this.dataService.getActivities().subscribe({
      next: data => { this.activities = data; this.loading.activity = false; this.cdr.detectChanges(); },
      error: () => { this.loading.activity = false; this.cdr.detectChanges(); }
    });
    this.dataService.getDeadlines().subscribe({
      next: data => { this.deadlines = data; this.loading.deadline = false; this.cdr.detectChanges(); },
      error: () => { this.loading.deadline = false; this.cdr.detectChanges(); }
    });
    this.dataService.getAnnouncements().subscribe({
      next: data => { this.announcements = data; this.loading.announce = false; this.cdr.detectChanges(); },
      error: () => { this.loading.announce = false; this.cdr.detectChanges(); }
    });
    this.dataService.getNotifications().subscribe({
      next: data => { this.notifications = data; this.loading.notif = false; this.cdr.detectChanges(); },
      error: () => { this.loading.notif = false; this.cdr.detectChanges(); }
    });
  }

  @HostListener('window:resize')
  calcTasksHeight() {
    this.ngZone.run(() => {
      this.myTasksMaxH = Math.floor(window.innerHeight * 0.45);
      this.cdr.detectChanges();
    });
  }

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
    this.http.put(API.AUTH.LANGUAGE, { language: lang.code }, { headers: this.authService.getHeaders() })
      .subscribe({
        next: () => {
          const user = this.authService.getUser();
          if (user) {
            user.preferredLanguage = lang.code;
            localStorage.setItem('user', JSON.stringify(user));
          }
          localStorage.setItem('brycen-active-view', this.activeView);
          window.location.reload();
        }
      });
  }

  getTotalTasks(): number { return this.donutData.reduce((sum, d) => sum + d.count, 0); }
  signOut() { this.authService.logout(); window.location.href = '/login'; }
  getUnreadCount(): number { return this.notifications.filter(n => n.unread).length; }
  getProgressColor(pct: number): string { return pct >= 75 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b'; }

  getStatusClass(status: string): string {
    const m: Record<string, string> = { 'On Track': 'status-on-track', 'At Risk': 'status-at-risk', 'Delayed': 'status-delayed' };
    return m[status] || '';
  }

  getHealthDots(health: number): number[] { return Array.from({ length: 5 }, (_, i) => i); }

  getHealthDotColor(index: number, health: number): string {
    if (index < health) { return health >= 4 ? '#22c55e' : health >= 3 ? '#f59e0b' : '#ef4444'; }
    return this.isDark ? '#1e2d4a' : '#e2e8f0';
  }

  getBarMaxVal(): number { return Math.max(...this.chartData.map(d => d.done + d.inProgress + d.todo)); }

  openProject(id: number) {
    this.router.navigate(['/dashboard/member'], { queryParams: { projectId: id } });
  }

  closeProject() {
    this.router.navigate(['/dashboard/member']);
    this.activeView = 'dashboard';
  }

  openNewProject() { this.showNewProject = true; this.showProjectDetail = false; }
  closeNewProject() { this.showNewProject = false; }
  onProjectCreated(project: any) {
    this.showNewProject = false;
    this.openProject(project.id);
    this.loadAll();
    this.cdr.detectChanges();
  }

  canCreateProject(): boolean {
    const role = this.currentUser?.role || '';
    return ['PROJECT_MANAGER', 'VICE_PRESIDENT', 'BOSS', 'COUNTRY_DIRECTOR'].includes(role);
  }

  getBarHeight(val: number, max: number): number {
    if (max === 0) return 4;
    return Math.max(4, Math.round((val / max) * 110));
  }

  getRoleBadgeStyle(role: string): string {
    const m: Record<string, string> = {
      'BOSS': 'background:#78350f;color:#fbbf24',
      'COUNTRY_DIRECTOR': 'background:#3b0764;color:#c084fc',
      'PROJECT_MANAGER': 'background:#14532d;color:#86efac',
      'LEADER': 'background:#164e63;color:#67e8f9',
      'DEVELOPER': 'background:#1e1b4b;color:#a5b4fc',
      'UI_UX': 'background:#14532d;color:#86efac',
      'QA': 'background:#431407;color:#fdba74'
    };
    return m[role] || 'background:#1e293b;color:#94a3b8';
  }

  openMemberChat(m: any) {
    this.selectedChatMember = {
      id: m.userId || m.id,
      name: m.name,
      role: m.role,
      color: m.color,
      initial: m.initial,
      online: m.online,
    };
    this.isGroupChat = false;
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (myId) {
      this.http.put(
        `${BASE}/chat/read-channel?type=DIRECT&channelId=${myId}`, {},
        { headers: this.authService.getHeaders() }
      ).pipe(catchError(() => of(null))).subscribe(() => {
        const memberId = m.userId || m.id;
        this.memberUnreadCounts[memberId] = 0;
        this.cdr.detectChanges();
      });
    }
  }

  openBranchChat(): void {
    const branchId = this.currentUser?.branchId;
    this.selectedChatMember = {
      id: branchId,
      name: 'Branch Chat',
      projectId: branchId,
      projectName: 'Branch Chat',
      color: '#3b82f6',
    };
    this.isGroupChat = true;
    this.http.put(
      `${BASE}/chat/read-channel?type=BRANCH&channelId=${branchId}`, {},
      { headers: this.authService.getHeaders() }
    ).pipe(catchError(() => of(null))).subscribe(() => {
      this.branchUnreadCount = 0;
      this.cdr.detectChanges();
    });
    this.cdr.detectChanges();
  }

  openProjectChat(p: any) {
    this.selectedChatMember = {
      id: p.id,
      name: p.name || p.title || 'Group Chat',
      projectId: p.id,
      projectName: p.name || p.title || 'Group Chat',
      color: p.color || '#16a34a',
    };
    this.isGroupChat = true;
    this.http.put(
      `${BASE}/chat/read-channel?type=PROJECT&channelId=${p.id}`, {},
      { headers: this.authService.getHeaders() }
    ).pipe(catchError(() => of(null))).subscribe(() => {
      this.projectUnreadCounts[p.id] = 0;
      this.cdr.detectChanges();
    });
  }

  closeChatPopup() {
    this.selectedChatMember = null;
    this.isGroupChat = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.lang-wrap')) this.showLangMenu = false;
    if (!t.closest('.settings-wrap')) this.settingsOpen = false;
  }

  getVisibleTeamCount(): number {
    return this.teamMembers.filter(m =>
      m.role !== 'Country Director' &&
      m.role !== 'Vice President' &&
      m.role !== 'Admin'
    ).length;
  }

  startUnreadPolling(): void {
    this.stopUnreadPolling();
    this.ngZone.runOutsideAngular(() => {
      this._unreadPollTimer = setInterval(() => {
        this.ngZone.run(() => {
          this.loadMemberUnreadCounts();
          this.loadProjectUnreadCounts();
        });
      }, 10000);
    });
  }

  stopUnreadPolling(): void {
    if (this._unreadPollTimer) {
      clearInterval(this._unreadPollTimer);
      this._unreadPollTimer = null;
    }
  }

  loadMemberUnreadCounts(): void {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    this.http.get<any[]>(
      `${BASE}/chat/direct-unread-by-sender?userId=${myId}`,
      { headers: this.authService.getHeaders() }
    ).pipe(catchError(() => of([]))).subscribe(res => {
      this.memberUnreadCounts = {};
      (res || []).forEach((r: any) => {
        this.memberUnreadCounts[r.senderId] = r.unreadCount;
      });
      this.cdr.detectChanges();
    });
    const branchId = this.currentUser?.branchId;
    if (branchId) {
      this.http.get<any>(
        `${BASE}/chat/unread?type=BRANCH&channelId=${branchId}`,
        { headers: this.authService.getHeaders() }
      ).pipe(catchError(() => of({ unreadCount: 0 }))).subscribe(res => {
        this.branchUnreadCount = res?.unreadCount || 0;
        this.cdr.detectChanges();
      });
    }
  }

  loadProjectUnreadCounts(): void {
    this.activeProjects.forEach(p => {
      this.http.get<any>(
        `${BASE}/chat/unread?type=PROJECT&channelId=${p.id}`,
        { headers: this.authService.getHeaders() }
      ).pipe(catchError(() => of({ unreadCount: 0 }))).subscribe(res => {
        this.projectUnreadCounts[p.id] = res?.unreadCount || 0;
        this.cdr.detectChanges();
      });
    });
  }
}
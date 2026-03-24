import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardDataService } from '../services/dashboard-data.service';
import { AuthService } from '../services/auth.service';
import { AnnouncementBarComponent } from '../shared/announcement-bar.component';
import { BellNotificationComponent } from '../shared/bell-notification.component';
import { ViewChild } from '@angular/core';
import { ProjectInlineComponent } from '../projects/project-inline';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API } from '../constants/api-endpoints';
import { ProjectNewInline } from '../projects/project-new-inline';


import {
  Announcement, Notification, ActiveProject, PortfolioProject,
  TeamMember, MyTask, OverdueTask, Activity, Deadline
} from '../models/dashboard.models';

const LOGO_SVG = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTY1MzM0Ii8+PHRleHQgeD0iNiIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM4NmVmYWMiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PC9zdmc+`;

@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule,
    AnnouncementBarComponent, BellNotificationComponent, ProjectInlineComponent, ProjectNewInline],
  templateUrl: './member-dashboard.html',
  styleUrl: './member-dashboard.scss'
})


export class MemberDashboard implements OnInit, AfterViewInit, OnDestroy {



  @ViewChild(ProjectInlineComponent) projectInline?: ProjectInlineComponent; // ← ဒီမှာ


  // Properties
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

  currentLangObj = this.langs[0]; // default EN

  showLangMenu = false;
  settingsOpen = false;
  searchQuery = '';
  myTasksMaxH = 300;

  currentUser: any = null;

  loading = {
    stats: true,
    projects: true,
    team: true,
    tasks: true,
    overdue: true,
    activity: true,
    deadline: true,
    announce: true,
    notif: true,
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
    private http: HttpClient,
  ) { }

  ngOnInit() {
    const saved = localStorage.getItem('brycen-theme');
    this.setTheme(saved !== 'light');

    // localStorage ကနေ အရင်ယူ
    this.currentUser = this.authService.getUser();
    this.cdr.detectChanges();

    // ✅ saved language restore — အပေါ်ဆုံးမှာ ထားပါ
    const savedLang = this.authService.getUser()?.preferredLanguage || 'en';
    this.currentLangObj = this.langs.find(l => l.code === savedLang) || this.langs[0];

    // API ကနေ fresh ယူ
    this.authService.loadCurrentUser().subscribe({
      next: () => {
        this.currentUser = this.authService.getUser();
        this.cdr.detectChanges();
      }
    });

    // kanban back button ကနေ လာရင် auto open
    this.route.queryParams.subscribe(params => {
      if (params['projectId']) {
        const id = Number(params['projectId']);
        const checkAndOpen = () => {
          if (!this.loading.projects) {
            this.openProject(id);
            this.cdr.detectChanges();
          } else {
            setTimeout(checkAndOpen, 100);
          }
        };
        setTimeout(checkAndOpen, 200);
      }
    });

    this.loadAll();
  }

  ngAfterViewInit() { this.calcTasksHeight(); }
  ngOnDestroy() { }

  loadAll() {
    this.dataService.getStats().subscribe({
      next: data => {
        this.stats = data;
        this.loading.stats = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.stats = false; this.cdr.detectChanges(); }
    });

    this.dataService.getActiveProjects().subscribe({
      next: data => {
        this.activeProjects = data;
        this.loading.projects = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.projects = false; this.cdr.detectChanges(); }
    });

    this.dataService.getChartData().subscribe({
      next: data => {
        this.chartData = data;
        this.cdr.detectChanges();
      },
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
      next: data => {
        this.portfolioProjects = data;
        this.portfolio = data;
        this.loading.projects = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.projects = false; this.cdr.detectChanges(); }
    });

    this.dataService.getTeamMembers().subscribe({
      next: data => {
        this.teamMembers = data;
        this.loading.team = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.team = false; this.cdr.detectChanges(); }
    });

    this.dataService.getMyTasks().subscribe({
      next: data => {
        this.myTasks = data;
        this.loading.tasks = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.tasks = false; this.cdr.detectChanges(); }
    });

    this.dataService.getOverdueTasks().subscribe({
      next: data => {
        this.overdueTasks = data;
        this.loading.overdue = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.overdue = false; this.cdr.detectChanges(); }
    });

    this.dataService.getActivities().subscribe({
      next: data => {
        this.activities = data;
        this.loading.activity = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.activity = false; this.cdr.detectChanges(); }
    });

    this.dataService.getDeadlines().subscribe({
      next: data => {
        this.deadlines = data;
        this.loading.deadline = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.deadline = false; this.cdr.detectChanges(); }
    });

    this.dataService.getAnnouncements().subscribe({
      next: data => {
        this.announcements = data;
        this.loading.announce = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.announce = false; this.cdr.detectChanges(); }
    });

    this.dataService.getNotifications().subscribe({
      next: data => {
        this.notifications = data;
        this.loading.notif = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading.notif = false; this.cdr.detectChanges(); }
    });
  }

  @HostListener('window:resize')
  calcTasksHeight() {
    this.myTasksMaxH = Math.floor(window.innerHeight * 0.45);
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

    // API save
    this.http.put(
      API.AUTH.LANGUAGE,
      { language: lang.code },
      { headers: this.authService.getHeaders() }
    ).subscribe({
      next: () => {
        const user = this.authService.getUser();
        if (user) {
          user.preferredLanguage = lang.code;
          localStorage.setItem('user', JSON.stringify(user));
        }
        // project-inline ကို lang ပြောင်းဆိုပြ
        if (this.projectInline) {
          this.projectInline.switchLang(lang.code);
        }
      }
    });
  }


  getTotalTasks(): number {
    return this.donutData.reduce((sum, d) => sum + d.count, 0);
  }

  signOut() {
    this.authService.logout();
    window.location.href = '/login';
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => n.unread).length;
  }

  getProgressColor(pct: number): string {
    if (pct >= 75) return '#22c55e';
    if (pct >= 40) return '#3b82f6';
    return '#f59e0b';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      'On Track': 'status-on-track',
      'At Risk': 'status-at-risk',
      'Delayed': 'status-delayed'
    };
    return m[status] || '';
  }

  getHealthDots(health: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  getHealthDotColor(index: number, health: number): string {
    if (index < health) {
      if (health >= 4) return '#22c55e';
      if (health >= 3) return '#f59e0b';
      return '#ef4444';
    }
    return this.isDark ? '#1e2d4a' : '#e2e8f0';
  }

  getBarMaxVal(): number {
    return Math.max(...this.chartData.map(d => d.done + d.inProgress + d.todo));
  }

  // Methods
  openProject(id: number) {
    this.selectedProjectId = id;
    this.showProjectDetail = true;
  }
  closeProject() {
    this.selectedProjectId = null;
    this.showProjectDetail = false;
  }

  openNewProject() { this.showNewProject = true; this.showProjectDetail = false; }
  closeNewProject() { this.showNewProject = false; }
  onProjectCreated(project: any) {
    this.showNewProject = false;
    this.openProject(project.id);
    this.loadAll();
    this.cdr.detectChanges();
    // setTimeout(() => this.openProject(project.id), 500);
  }


  canCreateProject(): boolean {
    const role = this.currentUser?.role || '';
    return ['PROJECT_MANAGER', 'VICE_PRESIDENT', 'BOSS',
      'COUNTRY_DIRECTOR'].includes(role);
  }



  // ✅ သစ်
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

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.lang-wrap')) this.showLangMenu = false;
    if (!t.closest('.settings-wrap')) this.settingsOpen = false;
  }
}
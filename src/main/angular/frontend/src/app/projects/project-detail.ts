import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { AnnouncementBarComponent } from '../shared/announcement-bar.component';
import { BellNotificationComponent } from '../shared/bell-notification.component';
import { DashboardDataService } from '../services/dashboard-data.service';

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule,
    AnnouncementBarComponent, BellNotificationComponent],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {

  // ── DATA ────────────────────────────────────────────
  project: any = null;
  stats: any = null;
  members: any[] = [];
  tasks: any[] = [];
  sprints: any[] = [];
  activities: any[] = [];
  activeProjects: any[] = [];
  announcements: any[] = [];
  notifications: any[] = [];

  // Design board
  designBoard: any = null;
  designHistory: any[] = [];
  showFullDesign: boolean = false;

  // API Docs
  apiDoc: any = null;
  apiEndpoints: any[] = [];
  showFullApi: boolean = false;

  // DB Designs
  dbDesigns: any[] = [];
  showFullDb: boolean = false;

  // ── STATE ───────────────────────────────────────────
  isLoading = true;
  isTranslating = false;
  settingsOpen = false;
  isDark = true;

  // Right sidebar — My Tasks
  myTasksMaxH = 300;

  // ── TRANSLATION ─────────────────────────────────────
  selectedLang = 'en';
  translatedTitle = '';
  translatedDesc = '';

  languages = [
    { code: 'en', flag: '🇺🇸' },
    { code: 'ja', flag: '🇯🇵' },
    { code: 'ko', flag: '🇰🇷' },
    { code: 'my', flag: '🇲🇲' },
  ];

  // ── TASK COLUMNS (Board Preview) ─────────────────────
  boardColumns = [
    { label: 'Backlog', status: 'TODO', color: '#6366f1' },
    { label: 'In Progress', status: 'IN_PROGRESS', color: '#3b82f6' },
    { label: 'In Review', status: 'IN_REVIEW', color: '#f59e0b' },
    { label: 'Customer Confirm', status: 'PENDING_APPROVAL', color: '#a855f7' },
    { label: 'Done', status: 'DONE', color: '#22c55e' },
  ];

  // ── CONSTRUCTOR ─────────────────────────────────────
  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    public router: Router,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private dataService: DashboardDataService,
  ) { }

  // ── LIFECYCLE ────────────────────────────────────────
  ngOnInit() {
    // theme
    const saved = localStorage.getItem('brycen-theme');
    this.isDark = saved !== 'light';
    document.body.classList.toggle('dark', this.isDark);
    document.body.classList.toggle('light', !this.isDark);

    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadAll(+id);
    // Announcements + Notifications
    this.dataService.getAnnouncements().subscribe({
      next: a => { this.announcements = a; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.dataService.getNotifications().subscribe({
      next: n => { this.notifications = n; this.cdr.detectChanges(); },
      error: () => { }
    });

    // ← ဒါ အရေးကြီးဆုံး — params ပြောင်းတိုင်း data reload
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.resetData();        // ← ဟောင်း data clear
        this.loadAll(+id);
      }
    });
    // close dropdowns on outside click
    document.addEventListener('click', () => { this.settingsOpen = false; });
  }

  resetData() {
    this.project = null;
    this.stats = null;
    this.members = [];
    this.tasks = [];
    this.sprints = [];
    this.activities = [];
    this.designBoard = null;
    this.designHistory = [];
    this.apiDoc = null;
    this.apiEndpoints = [];
    this.dbDesigns = [];
    this.isLoading = true;
    this.cdr.detectChanges();
  }

  @HostListener('window:resize')
  calcTasksHeight() {
    this.myTasksMaxH = Math.floor(window.innerHeight * 0.45);
  }

  // ── DATA LOADING ─────────────────────────────────────
  loadAll(id: number) {
    this.isLoading = true;
    const h = { headers: this.auth.getHeaders() };

    // Project
    // this.http.get<any>(`${BASE}/projects/${id}`, h).subscribe({
    //   next: p => { this.project = p; this.isLoading = false; },
    //   error: () => { this.isLoading = false; }
    // });

    this.http.get<any>(`${BASE}/projects/${id}`, h).subscribe({
      next: p => {
        console.log('PROJECT DATA:', p);  // ← ထည့်
        this.project = p;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.log('PROJECT ERROR:', err);  // ← ထည့်
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    // Active Projects — sidebar အတွက်
    this.http.get<any[]>(`${BASE}/projects/my`, h).subscribe({
      next: p => {
        this.activeProjects = p;
        this.cdr.detectChanges();
      },
      error: () => { }
    });

    // Stats
    this.http.get<any>(`${BASE}/projects/${id}/stats`, h).subscribe({
      next: s => { this.stats = s; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Members
    this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).subscribe({
      next: m => { this.members = m; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Tasks
    this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).subscribe({
      next: t => { this.tasks = t; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Sprints
    this.http.get<any[]>(`${BASE}/sprints/by-project/${id}`, h).subscribe({
      next: s => { this.sprints = s; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Activity Logs
    this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).subscribe({
      next: a => { this.activities = a; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Design Board
    this.http.get<any>(`${BASE}/design-boards/by-project/${id}`, h).subscribe({
      next: d => {
        this.designBoard = d;
        // Version History
        if (d?.id) {
          this.http.get<any[]>(`${BASE}/design-boards/${d.id}/history`, h).subscribe({
            next: hist => { this.designHistory = hist; this.cdr.detectChanges(); },
            error: () => { }
          });
        }
      },
      error: () => { }
    });

    // API Docs
    this.http.get<any>(`${BASE}/api-docs/by-project/${id}`, h).subscribe({
      next: doc => {
        this.apiDoc = doc;
        if (doc?.id) {
          this.http.get<any[]>(`${BASE}/api-docs/${doc.id}/endpoints`, h).subscribe({
            next: ep => { this.apiEndpoints = ep; this.cdr.detectChanges(); },
            error: () => { }
          });
        }
      },
      error: () => { }
    });

    // DB Designs
    this.http.get<any[]>(`${BASE}/db-designs/by-project/${id}`, h).subscribe({
      next: db => { this.dbDesigns = db; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  // ── COMPUTED ─────────────────────────────────────────

  get statsCards() {
    return [
      { label: 'Total Tasks', value: this.stats?.totalTasks ?? this.tasks.length, icon: '📋', color: 'text-white' },
      { label: 'Completed', value: this.stats?.completed ?? 0, icon: '✅', color: 'text-green-400' },
      { label: 'In Progress', value: this.stats?.inProgress ?? 0, icon: '⚡', color: 'text-blue-400' },
      { label: 'Completion', value: (this.project?.progress ?? 0) + '%', icon: '📊', color: 'text-purple-400' },
      { label: 'Team Size', value: this.stats?.teamSize ?? this.members.length, icon: '👥', color: 'text-cyan-400' },
      { label: 'Overdue', value: this.stats?.overdue ?? 0, icon: '⚠️', color: 'text-red-400' },
    ];
  }

  get myTasks(): any[] {
    const userId = this.auth.getUser()?.userId;
    return this.tasks.filter(t => t.assigneeId === userId);
  }

  get apiEndpointGroups(): { group: string; endpoints: any[] }[] {
    const groups: Record<string, any[]> = {};
    for (const ep of this.apiEndpoints) {
      const g = ep.groupName || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(ep);
    }
    return Object.entries(groups).map(([group, endpoints]) => ({ group, endpoints }));
  }

  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  get boardOverallPct(): number {
    if (!this.tasks.length) return 0;
    const done = this.tasks.filter(t => t.status === 'DONE').length;
    return Math.round((done / this.tasks.length) * 100);
  }

  get boardCompletedText(): string {
    const done = this.tasks.filter(t => t.status === 'DONE').length;
    const prog = this.tasks.filter(t => t.status === 'IN_PROGRESS').length;
    return `${done} of ${this.tasks.length} tasks completed · ${prog} in progress`;
  }

  // ── HELPERS ──────────────────────────────────────────

  // ── NAVIGATION ──────────────────────────────
  navigateToProject(id: number) {
    this.router.navigate(['/projects', id]);
  }

  // ── STYLE HELPERS ────────────────────────────
  getProjectColor(id: number): string {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];
    return colors[id % colors.length];
  }

  getPmName(): string {
    if (!this.project?.pmId) return '—';
    const pm = this.members.find(m => m.userId === this.project.pmId);
    return pm?.userName || `PM #${this.project.pmId}`;
  }

  isOverdue(): boolean {
    if (!this.project?.endDate) return false;
    return new Date(this.project.endDate) < new Date() && this.project.status !== 'COMPLETED';
  }

  isTaskOverdue(task: any): boolean {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  }
  getBudgetFormatted(): string {
    const b = this.project?.budget;
    if (!b) return '—';
    return '$' + Number(b).toLocaleString();
  }

  getMemberInitial(m: any): string {
    return (m.userName || m.name || '?')[0].toUpperCase();
  }

  getMemberColor(idx: number): string {
    const colors = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
    return colors[idx % colors.length];
  }

  // ── STYLE HELPERS ────────────────────────────────────

  getStatusClass(s: string): string {
    const m: any = {
      PLANNING: 'bg-gray-700/50 text-gray-300',
      ACTIVE: 'bg-green-600/20 text-green-400',
      IN_PROGRESS: 'bg-green-600/20 text-green-400',
      ON_HOLD: 'bg-yellow-600/20 text-yellow-400',
      COMPLETED: 'bg-blue-600/20 text-blue-400',
      CANCELLED: 'bg-red-600/20 text-red-400',
    };
    return m[s] || 'bg-gray-700/50 text-gray-300';
  }

  getTaskStatusClass(s: string): string {
    const m: any = {
      TODO: 'bg-gray-700 text-gray-400',
      IN_PROGRESS: 'bg-blue-600/20 text-blue-400',
      IN_REVIEW: 'bg-yellow-600/20 text-yellow-400',
      DONE: 'bg-green-600/20 text-green-400',
      DELAYED: 'bg-red-600/20 text-red-400',
      PENDING_APPROVAL: 'bg-purple-600/20 text-purple-400',
    };
    return m[s] || 'bg-gray-700 text-gray-400';
  }

  getPriorityClass(p: string): string {
    const m: any = {
      LOW: 'bg-gray-700 text-gray-400',
      MEDIUM: 'bg-blue-600/20 text-blue-400',
      HIGH: 'bg-orange-600/20 text-orange-400',
      CRITICAL: 'bg-red-600/20 text-red-400',
    };
    return m[p] || 'bg-gray-700 text-gray-400';
  }

  getRoleBadgeClass(role: string): string {
    const m: any = {
      PROJECT_MANAGER: 'bg-green-600/20 text-green-400',
      LEADER: 'bg-cyan-600/20 text-cyan-400',
      DEVELOPER: 'bg-indigo-600/20 text-indigo-400',
      UI_UX: 'bg-pink-600/20 text-pink-400',
      QA: 'bg-orange-600/20 text-orange-400',
      CUSTOMER: 'bg-gray-700 text-gray-400',
    };
    return m[role] || 'bg-gray-700 text-gray-400';
  }

  getMethodClass(method: string): string {
    const m: any = {
      GET: 'bg-green-600/20 text-green-400 border border-green-600/30',
      POST: 'bg-blue-600/20 text-blue-400 border border-blue-600/30',
      PUT: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
      PATCH: 'bg-orange-600/20 text-orange-400 border border-orange-600/30',
      DELETE: 'bg-red-600/20 text-red-400 border border-red-600/30',
    };
    return m[method?.toUpperCase()] || 'bg-gray-700 text-gray-400';
  }

  getActionIcon(action: string): string {
    const m: any = {
      TASK_CREATED: '✨', TASK_MOVED: '↔️',
      TASK_ASSIGNED: '👤', COMMENT_ADDED: '💬',
      FILE_UPLOADED: '📎', MEMBER_ADDED: '➕',
      PROJECT_CREATED: '🚀', STATUS_CHANGED: '🔄',
    };
    return m[action] || '📝';
  }

  getActionText(action: string): string {
    const m: any = {
      TASK_CREATED: 'created a task', TASK_MOVED: 'moved a task',
      TASK_ASSIGNED: 'assigned a task', COMMENT_ADDED: 'added a comment',
      FILE_UPLOADED: 'uploaded a file', MEMBER_ADDED: 'added a member',
      PROJECT_CREATED: 'created the project', STATUS_CHANGED: 'changed status',
    };
    return m[action] || action;
  }

  // ── THEME ────────────────────────────────────────────
  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark', this.isDark);
    document.body.classList.toggle('light', !this.isDark);
    localStorage.setItem('brycen-theme', this.isDark ? 'dark' : 'light');
  }

  signOut() {
    this.auth.logout();
    window.location.href = '/login';
  }
}

import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-project-inline',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-inline.html',
  host: { style: 'display:contents' }
})
export class ProjectInlineComponent implements OnInit, OnChanges {

  @Input() projectId!: number;
  @Output() close = new EventEmitter<void>();

  // ── DATA ──────────────────────────────────────
  project: any = null;
  stats: any = null;
  members: any[] = [];
  tasks: any[] = [];
  activities: any[] = [];
  apiEndpoints: any[] = [];

  // ── STATE ─────────────────────────────────────
  isLoading = true;
  showDesign = false;
  showApi = false;
  showDb = false;

  showFullDesc = false;
  
  // ── BOARD COLUMNS ─────────────────────────────
  boardColumns = [
    { label: 'Backlog', status: 'TODO', color: '#6366f1' },
    { label: 'In Progress', status: 'IN_PROGRESS', color: '#3b82f6' },
    { label: 'In Review', status: 'IN_REVIEW', color: '#f59e0b' },
    { label: 'Customer Confirm', status: 'PENDING_APPROVAL', color: '#a855f7' },
    { label: 'Done', status: 'DONE', color: '#22c55e' },
  ];

  // ── MOCK DATA ─────────────────────────────────
  mockEndpoints = [
    { method: 'GET', url: '/api/v1/tasks', desc: 'List all tasks' },
    { method: 'POST', url: '/api/v1/tasks', desc: 'Create task' },
    { method: 'PUT', url: '/api/v1/tasks/:id', desc: 'Update task' },
    { method: 'DELETE', url: '/api/v1/tasks/:id', desc: 'Delete task' },
    { method: 'GET', url: '/api/v1/analytics', desc: 'Analytics' },
    { method: 'POST', url: '/api/v1/comments', desc: 'Add comment' },
  ];

  mockTables = [
    { name: 'users', cols: ['🔑 id', 'name', 'email', 'role'] },
    { name: 'tasks', cols: ['🔑 id', 'title', 'status', 'assignee_id'] },
    { name: 'projects', cols: ['🔑 id', 'name', 'deadline', 'status'] },
    { name: 'comments', cols: ['🔑 id', 'task_id', 'author_id', 'text'] },
    { name: 'sprints', cols: ['🔑 id', 'project_id', 'name', 'status'] },
  ];


  // Translation
  currentLang: string = 'en';
  translatedTitle: string = '';
  translatedDesc: string = '';
  isTranslating: boolean = false;
  pendingLang: string = '';

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }

  ngOnInit() {
    // saved language သိမ်းထားပြီး loadAll ပြီးမှ သုံးမယ်
    const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
    if (savedLang !== 'en') {
      this.pendingLang = savedLang;  // ← switchLang မခေါ်ဘဲ pendingLang မှာ သိမ်း
    }

    if (this.projectId) this.loadAll(this.projectId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.resetData();
      this.loadAll(this.projectId);
    }
  }

  // ── DATA LOADING ──────────────────────────────
  resetData() {
    this.project = null;
    this.stats = null;
    this.members = [];
    this.tasks = [];
    this.activities = [];
    this.apiEndpoints = [];
    this.isLoading = true;
    this.cdr.detectChanges();
  }

  switchLang(lang: string) {
    this.currentLang = lang;

    if (lang === 'en' || !this.project) {
      this.translatedTitle = '';
      this.translatedDesc = '';
      // tasks ကို original ပြန်ပြ
      this.tasks.forEach(t => {
        t.translatedTitle = '';
        t.translatedDesc = '';
      });
      this.isTranslating = false;
      this.cdr.detectChanges();
      return;
    }

    this.isTranslating = true;
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };

    // Project translate
    this.http.get<any>(
      `${BASE}/translations/project/${this.project.id}?lang=${lang}`, h
    ).subscribe({
      next: res => {
        this.translatedTitle = res.title || '';
        this.translatedDesc = res.description || '';
        this.isTranslating = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isTranslating = false;
        this.cdr.detectChanges();
      }
    });

    // Tasks translate
    if (this.tasks.length > 0) {
      this.translateTasks(lang);
    }
  }


  loadAll(id: number) {
    const h = { headers: this.auth.getHeaders() };

    this.http.get<any>(`${BASE}/projects/${id}`, h).subscribe({
      next: p => {
        this.project = p;
        this.isLoading = false;
        this.cdr.detectChanges();

        // saved language ရှိရင် translate
        if (this.pendingLang && this.pendingLang !== 'en') {
          this.switchLang(this.pendingLang);
          this.pendingLang = '';
        }
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });

    this.http.get<any>(`${BASE}/projects/${id}/stats`, h).subscribe({
      next: s => { this.stats = s; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).subscribe({
      next: m => { this.members = m; this.cdr.detectChanges(); },
      error: () => { }
    });

    // Tasks load
    this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).subscribe({
      next: t => {
        this.tasks = t;
        this.cdr.detectChanges();

        // saved lang ရှိရင် tasks တွေကို translate
        const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
        if (savedLang !== 'en' && savedLang !== 'km') {
          this.translateTasks(savedLang);
        }
      },
      error: () => { }
    });


    this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).subscribe({
      next: a => { this.activities = a; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.http.get<any>(`${BASE}/api-docs/by-project/${id}`, h).subscribe({
      next: doc => {
        if (doc?.id) {
          this.http.get<any[]>(`${BASE}/api-docs/${doc.id}/endpoints`, h).subscribe({
            next: ep => { this.apiEndpoints = ep; this.cdr.detectChanges(); },
            error: () => { }
          });
        }
      },
      error: () => { }
    });
  }

  async translateTasks(lang: string) {
    const h = { headers: this.auth.getHeaders() };

    for (const task of this.tasks) {
      try {
        const res: any = await this.http.get(
          `${BASE}/translations/task/${task.id}?lang=${lang}`, h
        ).toPromise();

        task.translatedTitle = res.title || '';
        task.translatedDesc = res.description || '';
      } catch {
        task.translatedTitle = '';
        task.translatedDesc = '';
      }
    }
    this.cdr.detectChanges();
  }
  // ── COMPUTED ──────────────────────────────────
  get statsCards() {
    return [
      { label: 'Total Tasks', value: this.stats?.totalTasks ?? this.tasks.length, icon: '📋', color: 'stat-white' },
      { label: 'Completed', value: this.stats?.completed ?? 0, icon: '✅', color: 'stat-green' },
      { label: 'In Progress', value: this.stats?.inProgress ?? 0, icon: '⚡', color: 'stat-blue' },
      { label: 'Completion', value: (this.project?.progress ?? 0) + '%', icon: '📊', color: 'stat-purple' },
      { label: 'Team Size', value: this.stats?.teamSize ?? this.members.length, icon: '👥', color: 'stat-cyan' },
      { label: 'Overdue', value: this.stats?.overdue ?? 0, icon: '⚠️', color: 'stat-red' },
    ];
  }

  get myTasks(): any[] {
    const userId = this.auth.getUser()?.userId;
    return this.tasks.filter(t => t.assigneeId === userId);
  }

  get boardPct(): number {
    if (!this.tasks.length) return 0;
    return Math.round(
      this.tasks.filter(t => t.status === 'DONE').length / this.tasks.length * 100
    );
  }

  get doneCount(): number {
    return this.tasks.filter(t => t.status === 'DONE').length;
  }

  get inProgressCount(): number {
    return this.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  }

  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  getPmName(): string {
    if (!this.project?.pmId) return '—';
    const pm = this.members.find(m => m.userId === this.project.pmId);
    return pm?.userName || `PM #${this.project.pmId}`;
  }

  isOverdue(): boolean {
    if (!this.project?.endDate) return false;
    return new Date(this.project.endDate) < new Date()
      && this.project.status !== 'COMPLETED';
  }

  isTaskOverdue(task: any): boolean {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  }

  getBudget(): string {
    const b = this.project?.budget;
    return b ? '$' + Number(b).toLocaleString() : '—';
  }

  getMemberInitial(m: any): string {
    return (m.userName || m.name || '?')[0].toUpperCase();
  }

  getMemberColor(i: number): string {
    const c = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    return c[i % c.length];
  }

  // ── STYLE HELPERS ─────────────────────────────
  getStatusClass(s: string): string {
    const m: any = {
      PLANNING: 'badge-gray', ACTIVE: 'badge-green',
      ON_HOLD: 'badge-yellow', COMPLETED: 'badge-blue',
      CANCELLED: 'badge-red',
    };
    return m[s] || 'badge-gray';
  }

  getTaskStatusClass(s: string): string {
    const m: any = {
      TODO: 'badge-gray', IN_PROGRESS: 'badge-blue',
      IN_REVIEW: 'badge-yellow', DONE: 'badge-green',
      DELAYED: 'badge-red', PENDING_APPROVAL: 'badge-purple',
    };
    return m[s] || 'badge-gray';
  }

  getPriorityClass(p: string): string {
    const m: any = {
      LOW: 'badge-gray', MEDIUM: 'badge-blue',
      HIGH: 'badge-orange', CRITICAL: 'badge-red',
    };
    return m[p] || 'badge-blue';
  }

  getPriorityTcClass(p: string): string {
    const m: any = {
      CRITICAL: 'tc-red', HIGH: 'tc-red',
      MEDIUM: 'tc-yellow', LOW: 'tc-blue',
    };
    return m[p] || 'tc-blue';
  }

  getMethodClass(method: string): string {
    const m: any = {
      GET: 'method-get', POST: 'method-post',
      PUT: 'method-put', PATCH: 'method-patch',
      DELETE: 'method-delete',
    };
    return m[method?.toUpperCase()] || 'method-get';
  }

  getActionIcon(action: string): string {
    const m: any = {
      TASK_CREATED: '✨', TASK_MOVED: '↔️', TASK_ASSIGNED: '👤',
      COMMENT_ADDED: '💬', FILE_UPLOADED: '📎', MEMBER_ADDED: '➕',
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
}

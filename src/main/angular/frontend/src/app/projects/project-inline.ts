import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChatPopupComponent, ChatMember } from '../shared/chat-popup/chat-popup.component'; // ✅ NEW

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-project-inline',
  standalone: true,
  imports: [CommonModule, RouterModule, ChatPopupComponent], // ✅ ChatPopupComponent ထည့်
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
  clients: any[] = [];

  // ── STATE ─────────────────────────────────────
  isLoading = true;
  showDesign = false;
  showApi = false;
  showDb = false;
  showFullDesc = false;

  // ── BOARD COLUMNS ─────────────────────────────
  boardColumns = [
    { label: 'Backlog',          status: 'TODO',             color: '#6366f1' },
    { label: 'In Progress',      status: 'IN_PROGRESS',      color: '#3b82f6' },
    { label: 'In Review',        status: 'IN_REVIEW',        color: '#f59e0b' },
    { label: 'Customer Confirm', status: 'PENDING_APPROVAL', color: '#a855f7' },
    { label: 'Done',             status: 'DONE',             color: '#22c55e' },
  ];

  mockEndpoints = [
    { method: 'GET',    url: '/api/v1/tasks',       desc: 'List all tasks' },
    { method: 'POST',   url: '/api/v1/tasks',       desc: 'Create task' },
    { method: 'PUT',    url: '/api/v1/tasks/:id',   desc: 'Update task' },
    { method: 'DELETE', url: '/api/v1/tasks/:id',   desc: 'Delete task' },
    { method: 'GET',    url: '/api/v1/analytics',   desc: 'Analytics' },
    { method: 'POST',   url: '/api/v1/comments',    desc: 'Add comment' },
  ];

  mockTables = [
    { name: 'users',    cols: ['🔑 id', 'name', 'email', 'role'] },
    { name: 'tasks',    cols: ['🔑 id', 'title', 'status', 'assignee_id'] },
    { name: 'projects', cols: ['🔑 id', 'name', 'deadline', 'status'] },
    { name: 'comments', cols: ['🔑 id', 'task_id', 'author_id', 'text'] },
    { name: 'sprints',  cols: ['🔑 id', 'project_id', 'name', 'status'] },
  ];

  // Translation
  currentLang: string = 'en';
  translatedTitle: string = '';
  translatedDesc: string = '';
  isTranslating: boolean = false;
  pendingLang: string = '';

  // ✅ Chat Popup
  selectedChatMember: ChatMember | null = null;
  isGroupChat = false;

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit() {
    const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
    if (savedLang !== 'en') {
      this.pendingLang = savedLang;
    }
    if (this.projectId) this.loadAll(this.projectId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.resetData();
      this.loadAll(this.projectId);
    }
  }

  resetData() {
    this.project = null; this.stats = null; this.members = [];
    this.tasks = []; this.activities = []; this.apiEndpoints = [];
    this.isLoading = true;
    this.cdr.detectChanges();
  }

  switchLang(lang: string) {
    this.currentLang = lang;
    if (lang === 'en' || !this.project) {
      this.translatedTitle = ''; this.translatedDesc = '';
      this.tasks.forEach(t => { t.translatedTitle = ''; t.translatedDesc = ''; });
      this.isTranslating = false;
      this.cdr.detectChanges();
      return;
    }
    this.isTranslating = true;
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/translations/project/${this.project.id}?lang=${lang}`, h)
      .subscribe({
        next: res => { this.translatedTitle = res.title || ''; this.translatedDesc = res.description || ''; this.isTranslating = false; this.cdr.detectChanges(); },
        error: () => { this.isTranslating = false; this.cdr.detectChanges(); }
      });
    if (this.tasks.length > 0) this.translateTasks(lang);
  }

  loadAll(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.isLoading = true;
    forkJoin({
      project:    this.http.get<any>(`${BASE}/projects/${id}`, h).pipe(catchError(() => of(null))),
      stats:      this.http.get<any>(`${BASE}/projects/${id}/stats`, h).pipe(catchError(() => of(null))),
      members:    this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).pipe(catchError(() => of([]))),
      tasks:      this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).pipe(catchError(() => of([]))),
      activities: this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).pipe(catchError(() => of([]))),
      clients:    this.http.get<any[]>(`${BASE}/clients`, h).pipe(catchError(() => of([]))),
    }).subscribe(res => {
      this.project = res.project; this.stats = res.stats;
      this.members = res.members; this.tasks = res.tasks;
      this.activities = res.activities; this.clients = res.clients;
      this.isLoading = false;
      this.cdr.detectChanges();
      if (this.pendingLang && this.pendingLang !== 'en') {
        this.switchLang(this.pendingLang); this.pendingLang = '';
      }
      const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
      if (savedLang !== 'en' && this.tasks.length > 0) this.translateTasks(savedLang);
    });
  }

  async translateTasks(lang: string) {
    const h = { headers: this.auth.getHeaders() };
    for (const task of this.tasks) {
      try {
        const res: any = await this.http.get(`${BASE}/translations/task/${task.id}?lang=${lang}`, h).toPromise();
        task.translatedTitle = res.title || ''; task.translatedDesc = res.description || '';
      } catch { task.translatedTitle = ''; task.translatedDesc = ''; }
    }
    this.cdr.detectChanges();
  }

  get statsCards() {
    return [
      { label: 'Total Tasks',  value: this.stats?.totalTasks ?? this.tasks.length, icon: '📋', color: 'stat-white' },
      { label: 'Completed',    value: this.stats?.completed ?? 0,                  icon: '✅', color: 'stat-green' },
      { label: 'In Progress',  value: this.stats?.inProgress ?? 0,                 icon: '⚡', color: 'stat-blue' },
      { label: 'Completion',   value: (this.project?.progress ?? 0) + '%',         icon: '📊', color: 'stat-purple' },
      { label: 'Team Size',    value: this.stats?.teamSize ?? this.members.length,  icon: '👥', color: 'stat-cyan' },
      { label: 'Overdue',      value: this.stats?.overdue ?? 0,                    icon: '⚠️', color: 'stat-red' },
    ];
  }

  get myTasks(): any[] {
    const userId = this.auth.getUser()?.userId;
    return this.tasks.filter(t => t.assigneeId === userId);
  }

  get boardPct(): number {
    if (!this.tasks.length) return 0;
    return Math.round(this.tasks.filter(t => t.status === 'DONE').length / this.tasks.length * 100);
  }

  get doneCount():       number { return this.tasks.filter(t => t.status === 'DONE').length; }
  get inProgressCount(): number { return this.tasks.filter(t => t.status === 'IN_PROGRESS').length; }

  getTasksByStatus(status: string): any[] { return this.tasks.filter(t => t.status === status); }

  getClientName(): string {
    if (!this.project?.clientId) return '—';
    const client = this.clients.find(c => Number(c.id) === Number(this.project.clientId));
    if (client) return client.companyName || client.name || '—';
    const member = this.members.find(m => Number(m.userId) === Number(this.project.clientId));
    return member?.userName || member?.name || `Client #${this.project.clientId}`;
  }

  getPmName(): string {
    if (!this.project?.pmId) return '—';
    if (this.project.pmName) return this.project.pmName;
    const pm = this.members.find(m => Number(m.userId) === Number(this.project.pmId));
    return pm?.userName || pm?.name || `PM #${this.project.pmId}`;
  }

  openDesign(): void { this.router.navigate(['/design', this.project?.id]); }

  getPmInitial(): string {
    const name = this.getPmName();
    return name.startsWith('PM #') ? 'P' : (name[0]?.toUpperCase() || 'P');
  }

  getStatusColor2(s: string): string {
    const m: any = { ACTIVE: '#22c55e', PLANNING: '#f59e0b', ON_HOLD: '#6366f1', COMPLETED: '#3b82f6', CANCELLED: '#ef4444' };
    return m[s] || '#64748b';
  }

  getStatusBg(s: string): string {
    const m: any = { ACTIVE: 'rgba(34,197,94,0.12)', PLANNING: 'rgba(245,158,11,0.12)', ON_HOLD: 'rgba(99,102,241,0.12)', COMPLETED: 'rgba(59,130,246,0.12)', CANCELLED: 'rgba(239,68,68,0.12)' };
    return m[s] || 'rgba(100,116,139,0.12)';
  }

  isOverdue(): boolean {
    if (!this.project?.endDate) return false;
    return new Date(this.project.endDate) < new Date() && this.project.status !== 'COMPLETED';
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

  getPriorityColor2(p: string): string {
    const m: any = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
    return m[p] || '#f59e0b';
  }

  getMemberColor(i: number): string {
    const c = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    return c[i % c.length];
  }

  getStatusClass(s: string): string {
    const m: any = { PLANNING: 'badge-gray', ACTIVE: 'badge-green', ON_HOLD: 'badge-yellow', COMPLETED: 'badge-blue', CANCELLED: 'badge-red' };
    return m[s] || 'badge-gray';
  }

  getTaskStatusClass(s: string): string {
    const m: any = { TODO: 'badge-gray', IN_PROGRESS: 'badge-blue', IN_REVIEW: 'badge-yellow', DONE: 'badge-green', DELAYED: 'badge-red', PENDING_APPROVAL: 'badge-purple' };
    return m[s] || 'badge-gray';
  }

  getPriorityClass(p: string): string {
    const m: any = { LOW: 'badge-gray', MEDIUM: 'badge-blue', HIGH: 'badge-orange', CRITICAL: 'badge-red' };
    return m[p] || 'badge-blue';
  }

  getPriorityTcClass(p: string): string {
    const m: any = { CRITICAL: 'tc-red', HIGH: 'tc-red', MEDIUM: 'tc-yellow', LOW: 'tc-blue' };
    return m[p] || 'tc-blue';
  }

  getMethodClass(method: string): string {
    const m: any = { GET: 'method-get', POST: 'method-post', PUT: 'method-put', PATCH: 'method-patch', DELETE: 'method-delete' };
    return m[method?.toUpperCase()] || 'method-get';
  }

  getActionIcon(action: string): string {
    const m: any = { TASK_CREATED: '✨', TASK_MOVED: '↔️', TASK_ASSIGNED: '👤', COMMENT_ADDED: '💬', FILE_UPLOADED: '📎', MEMBER_ADDED: '➕', PROJECT_CREATED: '🚀', STATUS_CHANGED: '🔄' };
    return m[action] || '📝';
  }

  getActionText(action: string): string {
    const m: any = { TASK_CREATED: 'created a task', TASK_MOVED: 'moved a task', TASK_ASSIGNED: 'assigned a task', COMMENT_ADDED: 'added a comment', FILE_UPLOADED: 'uploaded a file', MEMBER_ADDED: 'added a member', PROJECT_CREATED: 'created the project', STATUS_CHANGED: 'changed status' };
    return m[action] || action;
  }

  // ✅ Chat Popup Methods
  openMemberChat(m: any) {
    this.selectedChatMember = {
      id: m.userId || m.id,
      name: m.userName || m.name,
      role: m.roleInProject || m.role,
      color: this.getMemberColor(this.members.indexOf(m)),
      initial: this.getMemberInitial(m),
      online: m.online,
    };
    this.isGroupChat = false;
  }

  openGroupChat() {
    this.selectedChatMember = {
      id: this.projectId,
      name: this.project?.title || 'Group Chat',
      projectId: this.projectId,
      projectName: this.project?.title || 'Group Chat',
      color: '#16a34a',
    };
    this.isGroupChat = true;
  }

  closeChatPopup() {
    this.selectedChatMember = null;
    this.isGroupChat = false;
  }
}
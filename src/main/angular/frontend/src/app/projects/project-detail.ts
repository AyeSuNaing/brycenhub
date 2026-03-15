import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Sidebar } from '../shared/sidebar';

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Sidebar],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {

  // ── DATA ────────────────────────────────────────
  project: any    = null;
  stats: any      = null;
  members: any[]  = [];
  tasks: any[]    = [];
  sprints: any[]  = [];
  activities: any[] = [];

  // ── STATE ───────────────────────────────────────
  isLoading     = true;
  isTranslating = false;

  // ── TRANSLATION ─────────────────────────────────
  selectedLang    = 'en';
  translatedTitle = '';
  translatedDesc  = '';

  languages = [
    { code: 'en', flag: '🇺🇸' },
    { code: 'ja', flag: '🇯🇵' },
    { code: 'ko', flag: '🇰🇷' },
    { code: 'my', flag: '🇲🇲' },
  ];

  // ── TASK COLUMNS ────────────────────────────────
  taskColumns = [
    { label: 'To Do',       status: 'TODO' },
    { label: 'In Progress', status: 'IN_PROGRESS' },
    { label: 'Done',        status: 'DONE' },
  ];

  // ── COMPUTED GETTERS ────────────────────────────

  get statsCards() {
    return [
      { label: 'Total Tasks', value: this.stats?.totalTasks   ?? this.tasks.length,   color: 'text-white' },
      { label: 'Completed',   value: this.stats?.completed    ?? 0,                   color: 'text-green-400' },
      { label: 'In Progress', value: this.stats?.inProgress   ?? 0,                   color: 'text-blue-400' },
      { label: 'In Review',   value: this.stats?.inReview     ?? 0,                   color: 'text-yellow-400' },
      { label: 'Overdue',     value: this.stats?.overdue      ?? 0,                   color: 'text-red-400' },
      { label: 'Team Size',   value: this.stats?.teamSize     ?? this.members.length, color: 'text-purple-400' },
    ];
  }

  get myTasks(): any[] {
    const userId = this.auth.getUser()?.id;
    return this.tasks.filter(t => t.assigneeId === userId);
  }

  get taskBreakdown() {
    return [
      { label: 'Done',        count: this.tasks.filter(t => t.status === 'DONE').length,        barColor: 'bg-green-500' },
      { label: 'In Progress', count: this.tasks.filter(t => t.status === 'IN_PROGRESS').length, barColor: 'bg-blue-500' },
      { label: 'In Review',   count: this.tasks.filter(t => t.status === 'IN_REVIEW').length,   barColor: 'bg-yellow-500' },
      { label: 'To Do',       count: this.tasks.filter(t => t.status === 'TODO').length,        barColor: 'bg-gray-500' },
      { label: 'Delayed',     count: this.tasks.filter(t => t.status === 'DELAYED').length,     barColor: 'bg-red-500' },
    ];
  }

  // ── CONSTRUCTOR ─────────────────────────────────
  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    public  router: Router,
    private auth: AuthService,
  ) {}

  // ── LIFECYCLE ───────────────────────────────────
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadAll(+id);
  }

  // ── DATA LOADING ────────────────────────────────
  loadAll(id: number) {
    this.isLoading = true;
    const h = { headers: this.auth.getHeaders() };

    // Project info  →  GET /api/projects/{id}
    this.http.get<any>(`${BASE}/projects/${id}`, h).subscribe({
      next: (p) => { this.project = p; this.isLoading = false; },
      error: ()  => { this.isLoading = false; }
    });

    // Stats  →  GET /api/projects/{id}/stats
    this.http.get<any>(`${BASE}/projects/${id}/stats`, h).subscribe({
      next: (s) => { this.stats = s; },
      error: ()  => {}
    });

    // Members  →  GET /api/projects/{id}/members
    this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).subscribe({
      next: (m) => { this.members = m; },
      error: ()  => {}
    });

    // Tasks  →  GET /api/tasks/by-project/{id}
    this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).subscribe({
      next: (t) => { this.tasks = t; },
      error: ()  => {}
    });

    // Sprints  →  GET /api/sprints/by-project/{id}
    this.http.get<any[]>(`${BASE}/sprints/by-project/${id}`, h).subscribe({
      next: (s) => { this.sprints = s; },
      error: ()  => {}
    });

    // Activity Log  →  GET /api/activity-logs/by-project/{id}
    this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).subscribe({
      next: (a) => { this.activities = a; },
      error: ()  => {}
    });
  }

  // ── TRANSLATION ─────────────────────────────────
  switchLang(lang: string) {
    this.selectedLang = lang;

    // English → original ပြ
    if (lang === 'en' || !this.project) {
      this.translatedTitle = '';
      this.translatedDesc  = '';
      return;
    }

    // Myanmar → DeepL မပံ့ပိုး → English ပြ
    if (lang === 'my') {
      this.translatedTitle = '';
      this.translatedDesc  = '';
      return;
    }

    // DeepL translate  →  GET /api/translations/project/{id}?lang=ja
    this.isTranslating = true;
    const h = { headers: this.auth.getHeaders() };

    this.http.get<any>(`${BASE}/translations/project/${this.project.id}?lang=${lang}`, h).subscribe({
      next: (res) => {
        this.translatedTitle = res.title       || this.project.title;
        this.translatedDesc  = res.description || this.project.description;
        this.isTranslating   = false;
      },
      error: () => { this.isTranslating = false; }
    });
  }

  // ── HELPERS ─────────────────────────────────────

  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  getPmName(): string {
    if (!this.project?.pmId) return '—';
    const pm = this.members.find(m => m.userId === this.project.pmId);
    return pm?.userName || ('PM #' + this.project.pmId);
  }

  isOverdue(): boolean {
    if (!this.project?.endDate) return false;
    return new Date(this.project.endDate) < new Date()
        && this.project.status !== 'COMPLETED';
  }

  // ── STYLE HELPERS ────────────────────────────────

  getStatusClass(s: string): string {
    const m: any = {
      PLANNING:  'bg-gray-700 text-gray-300',
      ACTIVE:    'bg-green-600/20 text-green-400',
      ON_HOLD:   'bg-yellow-600/20 text-yellow-400',
      COMPLETED: 'bg-blue-600/20 text-blue-400',
      CANCELLED: 'bg-red-600/20 text-red-400',
    };
    return m[s] || 'bg-gray-700 text-gray-300';
  }

  getStatusSmallClass(s: string): string {
    const m: any = {
      TODO:             'bg-gray-700 text-gray-400',
      IN_PROGRESS:      'bg-blue-600/20 text-blue-400',
      IN_REVIEW:        'bg-yellow-600/20 text-yellow-400',
      DONE:             'bg-green-600/20 text-green-400',
      DELAYED:          'bg-red-600/20 text-red-400',
      PENDING_APPROVAL: 'bg-purple-600/20 text-purple-400',
    };
    return m[s] || 'bg-gray-700 text-gray-400';
  }

  getPriorityClass(p: string): string {
    const m: any = {
      LOW:      'bg-gray-700 text-gray-400',
      MEDIUM:   'bg-blue-600/20 text-blue-400',
      HIGH:     'bg-orange-600/20 text-orange-400',
      CRITICAL: 'bg-red-600/20 text-red-400',
    };
    return m[p] || 'bg-gray-700 text-gray-400';
  }

  getRoleBadge(role: string): string {
    const m: any = {
      PROJECT_MANAGER: 'bg-green-600/20 text-green-400',
      LEADER:          'bg-cyan-600/20 text-cyan-400',
      DEVELOPER:       'bg-indigo-600/20 text-indigo-400',
      UI_UX:           'bg-pink-600/20 text-pink-400',
      QA:              'bg-orange-600/20 text-orange-400',
      CUSTOMER:        'bg-gray-700 text-gray-400',
    };
    return m[role] || 'bg-gray-700 text-gray-400';
  }

  getProjectBg(id: number): string {
    const colors = [
      'bg-green-600/20',
      'bg-blue-600/20',
      'bg-purple-600/20',
      'bg-orange-600/20',
      'bg-pink-600/20',
    ];
    return colors[id % colors.length];
  }

  getActionIcon(action: string): string {
    const m: any = {
      TASK_CREATED:    '✨',
      TASK_MOVED:      '↔️',
      TASK_ASSIGNED:   '👤',
      COMMENT_ADDED:   '💬',
      FILE_UPLOADED:   '📎',
      MEMBER_ADDED:    '➕',
      PROJECT_CREATED: '🚀',
      STATUS_CHANGED:  '🔄',
    };
    return m[action] || '📝';
  }

  getActionText(action: string): string {
    const m: any = {
      TASK_CREATED:    'created a task',
      TASK_MOVED:      'moved a task',
      TASK_ASSIGNED:   'assigned a task',
      COMMENT_ADDED:   'added a comment',
      FILE_UPLOADED:   'uploaded a file',
      MEMBER_ADDED:    'added a member',
      PROJECT_CREATED: 'created the project',
      STATUS_CHANGED:  'changed status',
    };
    return m[action] || action;
  }
}

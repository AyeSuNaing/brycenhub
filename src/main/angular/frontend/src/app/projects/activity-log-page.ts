import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { NavigationStateService } from '../services/navigation-state.service';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-activity-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './activity-log-page.html',
  host: { '[class.dark]': 'isDark', '[class.light]': '!isDark' }
})
export class ActivityLogPageComponent implements OnInit {

  projectId: number = 0;
  project: any = null;
  members: any[] = [];
  tasks: any[] = [];
  activities: any[] = [];
  filteredActivities: any[] = [];

  isLoading = true;
  isDark = true;

  // Filter state
  searchQuery: string = '';
  filterAction: string = 'ALL';
  filterUser: string = 'ALL';
  filterDateRange: string = 'ALL';

  actionOptions = [
    { value: 'ALL',           label: 'All Actions',    icon: '📋' },
    { value: 'TASK_CREATED',  label: 'Created',        icon: '✨' },
    { value: 'TASK_MOVED',    label: 'Status Changed', icon: '↔️' },
    { value: 'TASK_ASSIGNED', label: 'Assigned',       icon: '👤' },
    { value: 'TASK_UPDATED',  label: 'Updated',        icon: '📝' },
    { value: 'TASK_DELETED',  label: 'Deleted',        icon: '🗑' },
    { value: 'COMMENTED',     label: 'Commented',      icon: '💬' },
    { value: 'MEMBER_ADDED',  label: 'Member Added',   icon: '➕' },
  ];

  dateRangeOptions = [
    { value: 'ALL',    label: 'All Time' },
    { value: 'TODAY',  label: 'Today' },
    { value: 'WEEK',   label: 'This Week' },
    { value: 'MONTH',  label: 'This Month' },
  ];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Detect theme from body class (set by parent/login) — don't force
    this.isDark = document.body.classList.contains('dark') ||
                  localStorage.getItem('brycen-theme') !== 'light';

    this.route.params.subscribe(p => {
      this.projectId = +(p['projectId'] || p['id']);
      if (this.projectId) this.loadAll();
    });
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark', this.isDark);
    document.body.classList.toggle('light', !this.isDark);
    localStorage.setItem('brycen-theme', this.isDark ? 'dark' : 'light');
  }

  loadAll() {
    this.isLoading = true;
    const h = { headers: this.auth.getHeaders() };

    forkJoin({
      project:    this.http.get<any>(`${BASE}/projects/${this.projectId}`, h).pipe(catchError(() => of(null))),
      members:    this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).pipe(catchError(() => of([]))),
      tasks:      this.http.get<any[]>(`${BASE}/tasks/by-project/${this.projectId}`, h).pipe(catchError(() => of([]))),
      activities: this.http.get<any[]>(`${BASE}/activity-logs/by-project/${this.projectId}`, h).pipe(catchError(() => of([]))),
    }).subscribe({
      next: (res: any) => {
        this.project = res.project;
        this.members = res.members || [];
        this.tasks = res.tasks || [];
        this.activities = this.enrichActivities(res.activities || [], this.members, this.tasks);
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  private enrichActivities(acts: any[], members: any[], tasks: any[]): any[] {
    if (!acts || !acts.length) return [];
    return acts.map(a => {
      const m = members.find(x => (x.userId || x.id) === a.userId);
      const userName = m?.userName || m?.name || 'User';

      let targetName = '';
      if (a.targetType === 'TASK' && a.targetId) {
        const task = tasks.find(t => t.id === a.targetId);
        targetName = task?.title || `Task #${a.targetId}`;
      }

      return {
        ...a,
        userName: userName,
        userInitial: (userName || 'U')[0].toUpperCase(),
        targetName: targetName,
      };
    });
  }

  applyFilters() {
    let filtered = [...this.activities];

    // Search filter
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(a =>
        (a.userName || '').toLowerCase().includes(q) ||
        (a.targetName || '').toLowerCase().includes(q) ||
        (a.newValue || '').toLowerCase().includes(q) ||
        (a.action || '').toLowerCase().includes(q)
      );
    }

    // Action filter
    if (this.filterAction !== 'ALL') {
      filtered = filtered.filter(a => a.action === this.filterAction);
    }

    // User filter
    if (this.filterUser !== 'ALL') {
      filtered = filtered.filter(a => String(a.userId) === this.filterUser);
    }

    // Date filter
    if (this.filterDateRange !== 'ALL') {
      const now = new Date();
      let cutoff: Date;
      if (this.filterDateRange === 'TODAY') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (this.filterDateRange === 'WEEK') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      filtered = filtered.filter(a => new Date(a.createdAt) >= cutoff);
    }

    this.filteredActivities = filtered;
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterAction = 'ALL';
    this.filterUser = 'ALL';
    this.filterDateRange = 'ALL';
    this.applyFilters();
  }

  goBack(): void { history.back(); }

  // ── Helpers ──
  getActionText(action: string): string {
    const m: any = {
      TASK_CREATED:     'created a task',
      TASK_MOVED:       'moved a task',
      TASK_ASSIGNED:    'assigned a task',
      TASK_UPDATED:     'updated a task',
      TASK_DELETED:     'deleted a task',
      COMMENT_ADDED:    'added a comment',
      COMMENTED:        'commented on a task',
      FILE_UPLOADED:    'uploaded a file',
      MEMBER_ADDED:     'added a member',
      MEMBER_REMOVED:   'removed a member',
      PROJECT_CREATED:  'created the project',
      PROJECT_UPDATED:  'updated the project',
      STATUS_CHANGED:   'changed status',
    };
    return m[action] || action.replace(/_/g, ' ').toLowerCase();
  }

  getActionIcon(action: string): string {
    const m: any = {
      TASK_CREATED: '✨', TASK_MOVED: '↔️', TASK_ASSIGNED: '👤',
      TASK_UPDATED: '📝', TASK_DELETED: '🗑',
      COMMENTED: '💬', COMMENT_ADDED: '💬',
      FILE_UPLOADED: '📎', MEMBER_ADDED: '➕', MEMBER_REMOVED: '➖',
      PROJECT_CREATED: '🚀', STATUS_CHANGED: '🔄'
    };
    return m[action] || '📝';
  }

  getActionColor(action: string): string {
    const m: any = {
      TASK_CREATED:     '#22c55e',
      TASK_MOVED:       '#3b82f6',
      TASK_ASSIGNED:    '#a855f7',
      TASK_UPDATED:     '#f59e0b',
      TASK_DELETED:     '#ef4444',
      COMMENTED:        '#06b6d4',
      COMMENT_ADDED:    '#06b6d4',
      MEMBER_ADDED:     '#22c55e',
      MEMBER_REMOVED:   '#ef4444',
    };
    return m[action] || '#64748b';
  }

  getUniqueUsers(): { userId: number, userName: string }[] {
    const seen = new Set<number>();
    const result: { userId: number, userName: string }[] = [];
    for (const a of this.activities) {
      if (!seen.has(a.userId)) {
        seen.add(a.userId);
        result.push({ userId: a.userId, userName: a.userName || `User #${a.userId}` });
      }
    }
    return result;
  }

  // Group activities by date
  get groupedActivities(): { date: string, items: any[] }[] {
    const groups: Record<string, any[]> = {};
    for (const a of this.filteredActivities) {
      const d = new Date(a.createdAt);
      const key = d.toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.keys(groups).map(date => ({
      date,
      items: groups[date]
    }));
  }

  formatDateHeader(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }
}
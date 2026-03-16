import {
  Component, OnInit, ChangeDetectorRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpHeaders } from '@angular/common/http';

import {
  CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem
} from '@angular/cdk/drag-drop';
import { AuthService } from '../services/auth.service';

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DragDropModule],
  templateUrl: './kanban.html',
  host: { '[class.dark]': 'isDark', '[class.light]': '!isDark' }
})
export class Kanban implements OnInit {

  // ── DATA ─────────────────────────────────────────
  projectId: number = 0;
  project: any = null;
  tasks: any[] = [];
  members: any[] = [];
  sprints: any[] = [];

  // Attachments
  pendingFiles: File[] = [];
  uploadingFiles: boolean = false;
  taskAttachments: any[] = [];

  // Task detail panel
  selectedTask: any = null;
  taskComments: any[] = [];
  newComment: string = '';
  showPanel: boolean = false;
  panelLoading: boolean = false;

  // Add task
  showAddTask: boolean = false;
  addingToCol: string = 'TODO';
  newTask = {
    title: '', description: '', priority: 'MEDIUM',
    assigneeId: null as number | null, dueDate: '', label: ''
  };



  // State
  isLoading = true;
  isDark = true;
  lastClick: { id: number; time: number } | null = null;

  // Properties ထည့်
  currentUser: any = null;
  currentRole: string = '';
  currentUserRoleInProject: string = '';

  // Properties
  langs = [
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', flag: '🇰🇷', name: 'Korean' },
  ];
  showLangMenu = false;
  currentLang = { code: 'en', flag: '🇺🇸', name: 'English' };

  // ── COLUMNS (dynamic — DB status based) ──────────
  columns = [
    { status: 'TODO', label: 'Backlog', color: '#6366f1', listId: 'col-0' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', listId: 'col-1' },
    { status: 'IN_REVIEW', label: 'In Review', color: '#f59e0b', listId: 'col-2' },
    { status: 'PENDING_APPROVAL', label: 'Customer Confirm', color: '#a855f7', listId: 'col-3' },
    { status: 'DONE', label: 'Done', color: '#22c55e', listId: 'col-4' },
  ];

  get connectedLists(): string[] {
    return this.columns.map(c => c.listId);
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

  // ── LIFECYCLE ─────────────────────────────────────
  ngOnInit() {
    const saved = localStorage.getItem('brycen-theme');
    this.isDark = saved !== 'light';
    document.body.classList.toggle('dark', this.isDark);
    document.body.classList.toggle('light', !this.isDark);

    const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
    this.currentLang = this.langs.find(l => l.code === savedLang) || this.langs[0];

    this.currentUser = this.auth.getUser();
    this.currentRole = this.currentUser?.role || '';
    this.projectId = Number(this.route.snapshot.params['projectId']) || 0;
    this.loadAll();

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('task-panel');
      if (panel && !panel.contains(e.target as Node) && this.showPanel) {
        // don't close on outside click — user must press ✕
      }
    });

    document.addEventListener('click', () => {
      this.showLangMenu = false;
      this.cdr.detectChanges();
    });

  }

  setLang(lang: any) {
    this.currentLang = lang;
    this.showLangMenu = false;
    this.http.put(
      `${BASE}/auth/language`,
      { language: lang.code },
      { headers: this.auth.getHeaders() }
    ).subscribe();
  }
  // ── DATA LOADING ──────────────────────────────────
  loadAll() {
    const h = { headers: this.auth.getHeaders() };

    this.http.get<any>(`${BASE}/projects/${this.projectId}`, h).subscribe({
      next: p => { this.project = p; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.http.get<any[]>(`${BASE}/tasks/by-project/${this.projectId}`, h).subscribe({
      next: t => { this.tasks = t; this.isLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });

    this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
      next: m => { this.members = m; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.http.get<any[]>(`${BASE}/sprints/by-project/${this.projectId}`, h).subscribe({
      next: s => { this.sprints = s; this.cdr.detectChanges(); },
      error: () => { }
    });

    this.http.get<any[]>(
      `${BASE}/projects/${this.projectId}/members`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: m => {
        this.members = m;
        // current user ရဲ့ project role ရှာ
        const currentUserId = this.auth.getUser()?.id;
        const me = m.find((mem: any) => mem.userId === currentUserId);
        this.currentUserRoleInProject = me?.roleInProject || '';
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  // ── COLUMNS ───────────────────────────────────────
  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  getColumnTasks(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  // ── CDK DRAG DROP ─────────────────────────────────
  drop(event: CdkDragDrop<any[]>, targetStatus: string) {
    const task = event.item.data;

    if (event.previousContainer === event.container) {
      // same column — reorder
      moveItemInArray(
        this.getColumnTasksRef(targetStatus),
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // different column — move task
      const prevStatus = task.status;
      task.status = targetStatus;

      // optimistic update
      this.cdr.detectChanges();

      // API call
      this.http.patch(
        `${BASE}/tasks/${task.id}/status`,
        { status: targetStatus },
        { headers: this.auth.getHeaders() }
      ).subscribe({
        error: () => {
          // revert on error
          task.status = prevStatus;
          this.cdr.detectChanges();
        }
      });
    }
  }

  getColumnTasksRef(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  // ── TASK CLICK / DOUBLE CLICK ─────────────────────

  onTaskClick(task: any, event: MouseEvent) {
    event.stopPropagation();
    const now = Date.now();
    if (
      this.lastClick !== null &&
      this.lastClick.id === task.id &&
      now - this.lastClick.time < 400
    ) {
      this.openTaskPanel(task);
      this.lastClick = null;
    } else {
      this.lastClick = { id: task.id, time: now };
    }
  }

  openTaskPanel(task: any) {
    this.selectedTask = task;
    this.showPanel = true;
    this.taskComments = [];
    this.taskAttachments = [];   // ← ထည့်
    this.panelLoading = true;
    this.newComment = '';
    this.pendingFiles = [];     // ← ထည့်
    this.cdr.detectChanges();


    this.http.get<any[]>(
      `${BASE}/comments/by-task/${task.id}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: async (comments) => {
        for (const c of comments) {
          // ① attachments load
          try {
            const atts = await this.http.get<any[]>(
              `${BASE}/attachments/by-comment/${c.id}`,
              { headers: this.auth.getHeaders() }
            ).toPromise();
            c.attachments = atts || [];
          } catch { c.attachments = []; }

          // ② userName load ← ဒါ ထည့်
          try {
            const user = await this.http.get<any>(
              `${BASE}/users/${c.userId}`,
              { headers: this.auth.getHeaders() }
            ).toPromise();
            c.userName = user?.name || `User #${c.userId}`;
          } catch {
            c.userName = `User #${c.userId}`;
          }
        }
        this.taskComments = comments;
        this.panelLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.panelLoading = false; this.cdr.detectChanges(); }
    });
  }


  closePanel() {
    this.showPanel = false;
    this.selectedTask = null;
    this.taskComments = [];
  }

  // ── COMMENTS ─────────────────────────────────────
  async addComment() {
    if (!this.newComment.trim()) return;
    if (!this.selectedTask) return;

    this.uploadingFiles = true;
    this.cdr.detectChanges();

    try {
      // ① Comment post
      const comment: any = await this.http.post<any>(
        `${BASE}/comments`,
        { taskId: this.selectedTask.id, content: this.newComment },
        { headers: this.auth.getHeaders() }
      ).toPromise();

      comment.attachments = [];
      comment.userName = this.auth.getUser()?.name || 'You';
      this.newComment = '';

      // ② Files upload
      for (const file of this.pendingFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('taskId', this.selectedTask.id.toString());
          formData.append('commentId', comment.id.toString());

          const token = this.auth.getToken();
          const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

          const att: any = await this.http.post<any>(
            `${BASE}/attachments/upload`,
            formData,
            { headers }
          ).toPromise();

          comment.attachments.push(att);
        } catch (fileErr) {
          console.error('File upload failed:', fileErr);
        }
      }

      this.taskComments.push(comment);
      this.pendingFiles = [];
      this.uploadingFiles = false;  // ← ဒါ finally မှာ မဟုတ်ဘဲ try ထဲမှာ
      this.cdr.detectChanges();

    } catch (err) {
      console.error('Comment failed:', err);
      this.uploadingFiles = false;
      this.cdr.detectChanges();
    }
  }
  // ── ADD TASK ─────────────────────────────────────
  openAddTask(status: string) {
    this.addingToCol = status;
    this.showAddTask = true;
    this.newTask = {
      title: '', description: '', priority: 'MEDIUM',
      assigneeId: null, dueDate: '', label: ''
    };
  }

  submitTask() {
    if (!this.newTask.title.trim()) return;
    const body: any = {
      title: this.newTask.title,
      description: this.newTask.description,
      priority: this.newTask.priority,
      label: this.newTask.label,
      projectId: this.projectId,
      status: this.addingToCol,
    };
    if (this.newTask.assigneeId) body.assigneeId = this.newTask.assigneeId;
    if (this.newTask.dueDate) body.dueDate = this.newTask.dueDate;

    this.http.post<any>(
      `${BASE}/tasks`, body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: t => {
        this.tasks.push(t);
        this.showAddTask = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── STATUS CHANGE (from panel) ────────────────────
  changeTaskStatus(newStatus: string) {
    if (!this.selectedTask) return;
    const prev = this.selectedTask.status;
    this.selectedTask.status = newStatus;
    this.cdr.detectChanges();

    this.http.patch(
      `${BASE}/tasks/${this.selectedTask.id}/status`,
      { status: newStatus },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      error: () => {
        this.selectedTask.status = prev;
        this.cdr.detectChanges();
      }
    });
  }

  // ── HELPERS ───────────────────────────────────────
  getPriorityColor(p: string): string {
    const m: any = {
      CRITICAL: '#ef4444', HIGH: '#f97316',
      MEDIUM: '#f59e0b', LOW: '#6b7280',
    };
    return m[p] || '#6b7280';
  }

  getPriorityBg(p: string): string {
    const m: any = {
      CRITICAL: 'rgba(239,68,68,0.15)', HIGH: 'rgba(249,115,22,0.15)',
      MEDIUM: 'rgba(245,158,11,0.15)', LOW: 'rgba(107,114,128,0.15)',
    };
    return m[p] || 'rgba(107,114,128,0.15)';
  }

  getStatusColor(s: string): string {
    const m: any = {
      TODO: '#6366f1', IN_PROGRESS: '#3b82f6',
      IN_REVIEW: '#f59e0b', PENDING_APPROVAL: '#a855f7',
      DONE: '#22c55e', DELAYED: '#ef4444',
    };
    return m[s] || '#6b7280';
  }

  getMemberName(userId: number): string {
    const m = this.members.find(m => m.userId === userId);
    return m?.userName || `#${userId}`;
  }

  getMemberInitial(userId: number): string {
    const name = this.getMemberName(userId);
    return name[0]?.toUpperCase() || '?';
  }

  getMemberColor(userId: number): string {
    const colors = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    return colors[userId % colors.length];
  }

  isOverdue(task: any): boolean {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  }

  getCommentInitial(c: any): string {
    return (c.userName || c.userId || 'U').toString()[0].toUpperCase();
  }

  getCommentColor(c: any): string {
    const colors = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
    const id = typeof c.userId === 'number' ? c.userId : 0;
    return colors[id % colors.length];
  }

  // File select (📎 button)
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const newFiles = Array.from(input.files);
    this.pendingFiles.push(...newFiles);
    input.value = ''; // reset input
  }

  removePendingFile(i: number) {
    this.pendingFiles.splice(i, 1);
  }

  getFileIcon(file: File | any): string {
    const type = file.type || file.fileType || '';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.includes('pdf')) return '📄';
    return '📎';
  }

  getFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Load task attachments
  loadTaskAttachments(taskId: number) {
    this.http.get<any[]>(
      `${BASE}/attachments/by-task/${taskId}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: a => { this.taskAttachments = a; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  openFile(url: string) {
    window.open(url, '_blank');
  }

  isImage(file: any): boolean {
    const type = file?.fileType || file?.type || '';
    return type.startsWith('image/');
  }

  getFileUrl(fileUrl: string): string {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;
    return `http://localhost:8080/${fileUrl}`;
  }

  createObjectURL(file: File): string {
    return URL.createObjectURL(file);
  }

  canAddTask(): boolean {
    const projectOk = ['PROJECT_MANAGER', 'LEADER']
      .includes(this.currentUserRoleInProject);
    return  projectOk;
  }

  goBack() {
    // member-dashboard ကို သွားပြီး project inline open လုပ်မယ်
    this.router.navigate(['/dashboard/member'], {
      queryParams: { projectId: this.projectId }
    });
  }

}

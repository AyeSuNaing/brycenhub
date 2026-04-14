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
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DragDropModule],
  templateUrl: './kanban.html',
  host: { '[class.dark]': 'isDark', '[class.light]': '!isDark' }
})
export class Kanban implements OnInit {

  projectId: number = 0;
  project: any = null;
  tasks: any[] = [];
  members: any[] = [];
  sprints: any[] = [];

  pendingFiles: File[] = [];
  uploadingFiles: boolean = false;
  taskAttachments: any[] = [];

  selectedTask: any = null;
  taskComments: any[] = [];
  newComment: string = '';
  showPanel: boolean = false;
  panelLoading: boolean = false;

  showAddTask: boolean = false;
  addingToCol: string = 'TODO';
  newTask = {
    title: '', description: '', priority: 'MEDIUM',
    assigneeId: null as number | null, dueDate: '', label: ''
  };

  // Edit / Delete task
  showTaskEdit      = false;
  showDeleteConfirm = false;
  taskEditForm: {
    title: string; description: string; priority: string;
    assigneeId: number | null; dueDate: string; label: string;
  } = { title: '', description: '', priority: 'MEDIUM', assigneeId: null, dueDate: '', label: '' };

  isLoading = true;
  isDark = true;
  lastClick: { id: number; time: number } | null = null;

  currentUser: any = null;
  currentRole: string = '';
  currentUserRoleInProject: string = '';
  isTranslating = false;

  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean' },
  ];
  showLangMenu = false;
  currentLang = { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' };

  columns = [
    { status: 'TODO',             label: 'Backlog',          color: '#6366f1', listId: 'col-0' },
    { status: 'IN_PROGRESS',      label: 'In Progress',      color: '#3b82f6', listId: 'col-1' },
    { status: 'IN_REVIEW',        label: 'In Review',        color: '#f59e0b', listId: 'col-2' },
    { status: 'PENDING_APPROVAL', label: 'Customer Confirm', color: '#a855f7', listId: 'col-3' },
    { status: 'DONE',             label: 'Done',             color: '#22c55e', listId: 'col-4' },
  ];

  get connectedLists(): string[] {
    return this.columns.map(c => c.listId);
  }

  // ✅ Column width — 5 ခုဆိုရင် full width equal divide, 5 ကျော်ရင် 260px + scroll
  get colWidth(): string {
    const n = this.columns.length;
    if (n <= 5) {
      const totalGap = (n - 1) * 12;
      return `calc((100% - ${totalGap}px) / ${n})`;
    }
    return '260px';
  }

  get colMinWidth(): string {
    return this.columns.length <= 5 ? '160px' : '260px';
  }
  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

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

    document.addEventListener('click', () => {
      this.showLangMenu = false;
      this.cdr.detectChanges();
    });
  }

  setLang(lang: any) {
    this.currentLang = lang;
    this.showLangMenu = false;
    this.http.put(`${BASE}/auth/language`, { language: lang.code }, { headers: this.auth.getHeaders() }).subscribe({
      next: () => {
        const user = this.auth.getUser();
        if (user) { user.preferredLanguage = lang.code; localStorage.setItem('user', JSON.stringify(user)); }
      }
    });
    if (lang.code === 'en') {
      this.tasks.forEach(t => { t.translatedTitle = ''; t.translatedDesc = ''; });
      this.cdr.detectChanges();
    } else {
      this.isTranslating = true;
      this.cdr.detectChanges();
      this.translateTasks(lang.code);
    }
  }

  loadAll() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/projects/${this.projectId}`, h).subscribe({
      next: p => { this.project = p; this.cdr.detectChanges(); }, error: () => {}
    });
    this.http.get<any[]>(`${BASE}/tasks/by-project/${this.projectId}`, h).subscribe({
      next: t => {
        this.tasks = t; this.isLoading = false; this.cdr.detectChanges();
        const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
        if (savedLang !== 'en') this.translateTasks(savedLang);
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
    this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
      next: m => {
        this.members = m;
        const currentUserId = this.auth.getUser()?.id;
        const me = m.find((mem: any) => mem.userId === currentUserId);
        this.currentUserRoleInProject = me?.roleInProject || '';
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.http.get<any[]>(`${BASE}/sprints/by-project/${this.projectId}`, h).subscribe({
      next: s => { this.sprints = s; this.cdr.detectChanges(); }, error: () => {}
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
    this.isTranslating = false;
    this.cdr.detectChanges();
  }

  getTasksByStatus(status: string): any[] { return this.tasks.filter(t => t.status === status); }
  getColumnTasks(status: string): any[] { return this.tasks.filter(t => t.status === status); }

  drop(event: CdkDragDrop<any[]>, targetStatus: string) {
    const task = event.item.data;

    if (event.previousContainer === event.container) {
      // same column reorder
      moveItemInArray(
        this.getColumnTasksRef(targetStatus),
        event.previousIndex,
        event.currentIndex
      );
      this.cdr.detectChanges();
    } else {
      // cross-column move — status ပြောင်းပြီး UI refresh
      const prevStatus = task.status;
      task.status = targetStatus;

      // transferArrayItem ကို မသုံးဘဲ status change ပဲ လုပ်
      // getTasksByStatus() က computed ဖြစ်တာကြောင့် auto update ဖြစ်မယ်
      this.cdr.detectChanges();

      this.http.patch(
        `${BASE}/tasks/${task.id}/status`,
        { status: targetStatus },
        { headers: this.auth.getHeaders() }
      ).subscribe({
        error: () => {
          task.status = prevStatus;
          this.cdr.detectChanges();
        }
      });
    }
  }

  getColumnTasksRef(status: string): any[] { return this.tasks.filter(t => t.status === status); }

  onTaskClick(task: any, event: MouseEvent) {
    event.stopPropagation();
    const now = Date.now();
    if (this.lastClick !== null && this.lastClick.id === task.id && now - this.lastClick.time < 400) {
      this.openTaskPanel(task); this.lastClick = null;
    } else {
      this.lastClick = { id: task.id, time: now };
    }
  }

  openTaskPanel(task: any) {
    this.selectedTask = task; this.showPanel = true;
    this.taskComments = []; this.taskAttachments = [];
    this.panelLoading = true; this.newComment = ''; this.pendingFiles = [];
    this.cdr.detectChanges();
    this.http.get<any[]>(`${BASE}/comments/by-task/${task.id}`, { headers: this.auth.getHeaders() }).subscribe({
      next: async (comments) => {
        for (const c of comments) {
          try {
            const atts = await this.http.get<any[]>(`${BASE}/attachments/by-comment/${c.id}`, { headers: this.auth.getHeaders() }).toPromise();
            c.attachments = atts || [];
          } catch { c.attachments = []; }
          try {
            const user = await this.http.get<any>(`${BASE}/users/${c.userId}`, { headers: this.auth.getHeaders() }).toPromise();
            c.userName = user?.name || `User #${c.userId}`;
          } catch { c.userName = `User #${c.userId}`; }
          const lang = this.currentLang.code;
          if (lang !== 'en') {
            try {
              const res: any = await this.http.get(`${BASE}/translations/comment/${c.id}?lang=${lang}`, { headers: this.auth.getHeaders() }).toPromise();
              c.translatedContent = res.content || '';
            } catch { c.translatedContent = ''; }
          }
        }
        this.taskComments = comments; this.panelLoading = false; this.cdr.detectChanges();
      },
      error: () => { this.panelLoading = false; this.cdr.detectChanges(); }
    });
    this.loadTaskAttachments(task.id);
  }

  closePanel() { this.showPanel = false; this.selectedTask = null; this.taskComments = []; }

  async addComment() {
    if (!this.newComment.trim() || !this.selectedTask) return;
    this.uploadingFiles = true; this.cdr.detectChanges();
    try {
      const comment: any = await this.http.post<any>(`${BASE}/comments`,
        { taskId: this.selectedTask.id, content: this.newComment }, { headers: this.auth.getHeaders() }).toPromise();
      comment.attachments = []; comment.userName = this.auth.getUser()?.name || 'You';
      this.newComment = '';
      for (const file of this.pendingFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('taskId', this.selectedTask.id.toString());
          formData.append('commentId', comment.id.toString());
          const headers = new HttpHeaders().set('Authorization', `Bearer ${this.auth.getToken()}`);
          const att: any = await this.http.post<any>(`${BASE}/attachments/upload`, formData, { headers }).toPromise();
          comment.attachments.push(att);
        } catch (e) { console.error(e); }
      }
      this.taskComments.push(comment); this.pendingFiles = []; this.uploadingFiles = false;
      this.cdr.detectChanges();
    } catch (err) { console.error(err); this.uploadingFiles = false; this.cdr.detectChanges(); }
  }

  openAddTask(status: string) {
    this.addingToCol = status; this.showAddTask = true;
    this.newTask = { title: '', description: '', priority: 'MEDIUM', assigneeId: null, dueDate: '', label: '' };
  }

  submitTask() {
    if (!this.newTask.title.trim()) return;
    const body: any = { title: this.newTask.title, description: this.newTask.description, priority: this.newTask.priority, label: this.newTask.label, projectId: this.projectId, status: this.addingToCol };
    if (this.newTask.assigneeId) body.assigneeId = this.newTask.assigneeId;
    if (this.newTask.dueDate) body.dueDate = this.newTask.dueDate;
    this.http.post<any>(`${BASE}/tasks`, body, { headers: this.auth.getHeaders() }).subscribe({
      next: t => { this.tasks.push(t); this.showAddTask = false; this.cdr.detectChanges(); }
    });
  }

  changeTaskStatus(newStatus: string) {
    if (!this.selectedTask) return;
    const prev = this.selectedTask.status;
    this.selectedTask.status = newStatus; this.cdr.detectChanges();
    this.http.patch(`${BASE}/tasks/${this.selectedTask.id}/status`, { status: newStatus }, { headers: this.auth.getHeaders() }).subscribe({
      error: () => { this.selectedTask.status = prev; this.cdr.detectChanges(); }
    });
  }

  getPriorityColor(p: string): string {
    const m: any = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#6b7280' };
    return m[p] || '#6b7280';
  }
  getPriorityBg(p: string): string {
    const m: any = { CRITICAL: 'rgba(239,68,68,0.15)', HIGH: 'rgba(249,115,22,0.15)', MEDIUM: 'rgba(245,158,11,0.15)', LOW: 'rgba(107,114,128,0.15)' };
    return m[p] || 'rgba(107,114,128,0.15)';
  }
  getStatusColor(s: string): string {
    const m: any = { TODO: '#6366f1', IN_PROGRESS: '#3b82f6', IN_REVIEW: '#f59e0b', PENDING_APPROVAL: '#a855f7', DONE: '#22c55e', DELAYED: '#ef4444' };
    return m[s] || '#6b7280';
  }
  getMemberName(userId: number): string { const m = this.members.find(m => m.userId === userId); return m?.userName || `#${userId}`; }
  getMemberInitial(userId: number): string { return this.getMemberName(userId)[0]?.toUpperCase() || '?'; }
  getMemberColor(userId: number): string { const c = ['#6366f1','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899']; return c[userId % c.length]; }
  isOverdue(task: any): boolean { if (!task?.dueDate) return false; return new Date(task.dueDate) < new Date() && task.status !== 'DONE'; }
  getCommentInitial(c: any): string { return (c.userName || c.userId || 'U').toString()[0].toUpperCase(); }
  getCommentColor(c: any): string { const colors = ['#6366f1','#3b82f6','#22c55e','#f59e0b','#a855f7']; const id = typeof c.userId === 'number' ? c.userId : 0; return colors[id % colors.length]; }
  onFileSelect(event: Event) { const input = event.target as HTMLInputElement; if (!input.files) return; this.pendingFiles.push(...Array.from(input.files)); input.value = ''; }
  removePendingFile(i: number) { this.pendingFiles.splice(i, 1); }
  getFileIcon(file: File | any): string { const type = file.type || file.fileType || ''; if (type.startsWith('image/')) return '🖼️'; if (type.startsWith('video/')) return '🎬'; if (type.includes('pdf')) return '📄'; return '📎'; }
  getFileSize(bytes: number): string { if (bytes < 1024) return bytes + ' B'; if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'; return (bytes/(1024*1024)).toFixed(1) + ' MB'; }
  loadTaskAttachments(taskId: number) { this.http.get<any[]>(`${BASE}/attachments/by-task/${taskId}`, { headers: this.auth.getHeaders() }).subscribe({ next: a => { this.taskAttachments = a; this.cdr.detectChanges(); }, error: () => {} }); }
  openFile(url: string) { window.open(url, '_blank'); }
  isImage(file: any): boolean { const type = file?.fileType || file?.type || ''; return type.startsWith('image/'); }
  getFileUrl(fileUrl: string): string { if (!fileUrl) return ''; if (fileUrl.startsWith('http')) return fileUrl; return `http://localhost:8080/${fileUrl}`; }
  createObjectURL(file: File): string { return URL.createObjectURL(file); }
  canAddTask(): boolean {
    const projectOk = ['PROJECT_MANAGER','LEADER'].includes(this.currentUserRoleInProject);
    const isPm = Number(this.project?.pmId) === Number(this.auth.getUser()?.userId);
    return projectOk || isPm;
  }
  goBack() { this.router.navigate(['/dashboard/member'], { queryParams: { projectId: this.projectId } }); }

  // ── TASK EDIT / DELETE ────────────────────────────
  openEditTask() {
    if (!this.selectedTask) return;
    this.taskEditForm = {
      title:       this.selectedTask.title       || '',
      description: this.selectedTask.description || '',
      priority:    this.selectedTask.priority    || 'MEDIUM',
      assigneeId:  this.selectedTask.assigneeId  || null,
      dueDate:     this.selectedTask.dueDate      ? this.selectedTask.dueDate.substring(0,10) : '',
      label:       this.selectedTask.label       || '',
    };
    this.showTaskEdit = true;
    this.cdr.detectChanges();
  }

  saveTaskEdit() {
    if (!this.selectedTask || !this.taskEditForm.title.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    const body: any = {
      title:       this.taskEditForm.title.trim(),
      description: this.taskEditForm.description,
      priority:    this.taskEditForm.priority,
      label:       this.taskEditForm.label,
    };
    if (this.taskEditForm.assigneeId) body.assigneeId = this.taskEditForm.assigneeId;
    if (this.taskEditForm.dueDate)    body.dueDate    = this.taskEditForm.dueDate;

    this.http.put<any>(`${BASE}/tasks/${this.selectedTask.id}`, body, h).subscribe({
      next: updated => {
        // Update local task
        const idx = this.tasks.findIndex(t => t.id === this.selectedTask.id);
        if (idx >= 0) {
          this.tasks[idx] = { ...this.tasks[idx], ...updated };
          this.selectedTask = this.tasks[idx];
        }
        this.showTaskEdit = false;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  confirmDeleteTask() {
    this.showDeleteConfirm = true;
    this.showTaskEdit = false;
    this.cdr.detectChanges();
  }

  deleteTask() {
    if (!this.selectedTask) return;
    const h = { headers: this.auth.getHeaders() };
    // Soft delete — status = CANCELLED (ပြန်ရနိုင်)
    this.http.patch(`${BASE}/tasks/${this.selectedTask.id}/status`,
      { status: 'CANCELLED' }, h
    ).subscribe({
      next: () => {
        // local array ကနေ ဖျက် (CANCELLED tasks ကို board မှာ မပြ)
        this.tasks = this.tasks.filter(t => t.id !== this.selectedTask.id);
        this.showDeleteConfirm = false;
        this.showPanel = false;
        this.selectedTask = null;
        this.cdr.detectChanges();
      },
      error: () => { this.showDeleteConfirm = false; this.cdr.detectChanges(); }
    });
  }

}
import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChatPopupComponent, ChatMember } from '../shared/chat-popup/chat-popup.component';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-project-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChatPopupComponent],
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
  activeTab = 'overview';

  // ── EDIT / DELETE STATE ───────────────────────
  showEdit          = false;
  isSaving          = false;
  editError         = '';
  showDangerZone    = false;
  deleteConfirmName = '';
  isDeleting        = false;

  editForm = {
    title: '', description: '', status: '',
    startDate: '', endDate: '', budget: null as number | null, priority: '',
  };

  statuses = [
    { value: 'PLANNING',  label: 'Planning',  color: '#64748b' },
    { value: 'ACTIVE',    label: 'Active',    color: '#22c55e' },
    { value: 'ON_HOLD',   label: 'On Hold',   color: '#f59e0b' },
    { value: 'COMPLETED', label: 'Completed', color: '#3b82f6' },
  ];

  priorities = [
    { value: 'LOW',      label: 'Low',      color: '#22c55e' },
    { value: 'MEDIUM',   label: 'Medium',   color: '#f59e0b' },
    { value: 'HIGH',     label: 'High',     color: '#f97316' },
    { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  ];

  // ── TECH STACK ────────────────────────────────
  techStacks:       any[]    = [];
  techStackLoading: boolean  = false;
  showTechEdit                = false;
  newTechName                 = '';
  newTechCategory             = 'frontend';

  // ── MEMBER EDIT ───────────────────────────────
  showMemberEdit              = false;
  showRemovedMembers          = false;
  removedMembers:   any[]    = [];
  staffList:        any[]    = [];
  filteredStaff:    any[]    = [];
  staffListLoading            = false;
  memberSearchQuery           = '';

  // ── RULES ─────────────────────────────────────
  projectRules:     any[]    = [];
  rulesLoading:     boolean  = false;
  showRuleEdit                = false;
  editingRuleId:    number | undefined;
  ruleEditForm: { title: string; content: string; category: string }
    = { title: '', content: '', category: 'GENERAL' };
  newRuleTitle                = '';
  newRuleContent              = '';
  newRuleCategory             = 'CODING_STANDARDS';

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
  currentLang:     string  = 'en';
  translatedTitle: string  = '';
  translatedDesc:  string  = '';
  isTranslating:   boolean = false;
  pendingLang:     string  = '';

  // Chat Popup
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
    if (savedLang !== 'en') this.pendingLang = savedLang;
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
    this.showEdit = false; this.showDangerZone = false;
    this.activeTab = 'overview';
    this.editingRuleId = undefined;
    this.cdr.detectChanges();
  }

  // ══ TRANSLATION ═══════════════════════════════

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
    this.http.get<any>(`${BASE}/translations/project/${this.project.id}?lang=${lang}`, h).subscribe({
      next: res => { this.translatedTitle = res.title || ''; this.translatedDesc = res.description || ''; this.isTranslating = false; this.cdr.detectChanges(); },
      error: () => { this.isTranslating = false; this.cdr.detectChanges(); }
    });
    if (this.tasks.length > 0) this.translateTasks(lang);
  }

  // ══ DATA LOADING ══════════════════════════════

  loadAll(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.isLoading = true;
    forkJoin({
      project:    this.http.get<any>(`${BASE}/projects/${id}`, h).pipe(catchError(() => of(null))),
      members:    this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).pipe(catchError(() => of([]))),
      tasks:      this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).pipe(catchError(() => of([]))),
      activities: this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).pipe(catchError(() => of([]))),
      clients:    this.http.get<any[]>(`${BASE}/clients`, h).pipe(catchError(() => of([]))),
    }).subscribe(res => {
      this.project = res.project;
      this.tasks   = res.tasks;
      // stats ကို tasks/members ကနေ တွက်ယူ
      const tasks = res.tasks || [];
      this.stats = {
        totalTasks:  tasks.length,
        completed:   tasks.filter((t: any) => t.status === 'DONE').length,
        inProgress:  tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
        overdue:     tasks.filter((t: any) => this.isTaskOverdue(t)).length,
        teamSize:    (res.members || []).length,
      };
      this.activities = res.activities; this.clients = res.clients;

      // PM ကို members list မှာ ထည့်မထားရင် top မှာ ထည့်
      const mList: any[] = res.members || [];
      const pmId: any    = res.project?.pmId;
      if (pmId && !mList.some((m: any) => m.userId === pmId)) {
        const pmName: string = res.project?.pmName || 'PM';
        const pmEntry: any = {
          userId: pmId, userName: pmName, name: pmName,
          roleInProject: 'PROJECT_MANAGER',
          initial: pmName.charAt(0).toUpperCase(),
          color: '#16a34a', online: false, status: 'ACTIVE', tasks: 0,
        };
        mList.unshift(pmEntry);
      }
      this.members = mList;

      // VP, Director, HR default members load

      // VP, Director, HR (Admin) တွေ default ထည့်
      this.injectDefaultMembers();

      this.isLoading = false;
      this.cdr.detectChanges();
      this.loadTechStackAndRules(id);
      this.loadRemovedMembers(id);
      this.autoAddHighRoleMembers(id);
      if (this.pendingLang && this.pendingLang !== 'en') { this.switchLang(this.pendingLang); this.pendingLang = ''; }
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

  // ══ TECH STACK + RULES LOAD ════════════════════

  loadTechStackAndRules(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.techStackLoading = true;
    this.http.get<any[]>(`${BASE}/project-tech-stacks/by-project/${id}`, h).subscribe({
      next: data => { this.techStacks = data || []; this.techStackLoading = false; this.cdr.detectChanges(); },
      error: ()   => { this.techStackLoading = false; this.cdr.detectChanges(); }
    });
    this.rulesLoading = true;
    this.http.get<any[]>(`${BASE}/projects/${id}/rules`, h).subscribe({
      next: data => { this.projectRules = data || []; this.rulesLoading = false; this.cdr.detectChanges(); },
      error: ()   => { this.projectRules = []; this.rulesLoading = false; this.cdr.detectChanges(); }
    });
  }

  get groupedTechStacks(): { category: string, items: any[] }[] {
    const groups: any = {};
    (this.techStacks || []).forEach(t => {
      const cat = t.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return Object.keys(groups).map(cat => ({ category: cat, items: groups[cat] }));
  }

  getCategoryColor(cat: string): string {
    const m: any = { frontend: '#3b82f6', backend: '#16a34a', database: '#f59e0b', mobile: '#a855f7', payment: '#06b6d4', realtime: '#f97316', devops: '#64748b', other: '#475569' };
    return m[cat] || '#475569';
  }

  getCategoryIcon(cat: string): string {
    const m: any = { frontend: '🖥', backend: '⚙️', database: '🗄', mobile: '📱', payment: '💳', realtime: '⚡', devops: '🐳', other: '🔧' };
    return m[cat] || '🔧';
  }

  getRuleCategoryColor(cat: string): string {
    const m: any = { CODING_STANDARDS: '#6366f1', PROCESS_RULES: '#f59e0b', GENERAL: '#64748b' };
    return m[cat] || '#64748b';
  }

  getRuleCategoryIcon(cat: string): string {
    const m: any = { CODING_STANDARDS: '📦', PROCESS_RULES: '⚙️', GENERAL: '📌' };
    return m[cat] || '📌';
  }

  // ══ PROJECT EDIT ══════════════════════════════

  initEditForm() {
    if (!this.project) return;
    this.editForm = {
      title:       this.project.title       || '',
      description: this.project.description || '',
      status:      this.project.status      || 'ACTIVE',
      startDate:   this.project.startDate   || '',
      endDate:     this.project.endDate     || '',
      budget:      this.project.budget      || null,
      priority:    this.project.priority    || 'MEDIUM',
    };
    this.editError = ''; this.showDangerZone = false; this.deleteConfirmName = '';
    setTimeout(() => {
      const ta = document.querySelector('[\\#descTA]') as HTMLTextAreaElement;
      if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    }, 50);
  }

  saveEdit() {
    if (!this.editForm.title.trim()) { this.editError = 'Title is required'; return; }
    this.isSaving = true; this.editError = '';
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/projects/${this.projectId}`, {
      title:       this.editForm.title.trim(),
      description: this.editForm.description,
      status:      this.editForm.status,
      startDate:   this.editForm.startDate || null,
      endDate:     this.editForm.endDate   || null,
      budget:      this.editForm.budget    || null,
      priority:    this.editForm.priority,
    }, h).subscribe({
      next: (updated) => {
        this.project  = { ...this.project, ...updated };
        this.isSaving = false; this.showEdit = false;
        this.cdr.detectChanges();
      },
      error: () => { this.editError = 'Failed to save.'; this.isSaving = false; this.cdr.detectChanges(); }
    });
  }

  get deleteConfirmMatches(): boolean {
    return this.deleteConfirmName.trim() === (this.project?.title || '').trim();
  }

  cancelProject() {
    if (!this.deleteConfirmMatches || this.isDeleting) return;
    this.isDeleting = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/projects/${this.projectId}`, { status: 'CANCELLED' }, h).subscribe({
      next: () => {
        this.isDeleting = false;
        this.project = { ...this.project, status: 'CANCELLED' };
        this.showEdit = false; this.showDangerZone = false;
        this.activeTab = 'overview'; this.deleteConfirmName = '';
        this.cdr.detectChanges();
      },
      error: () => { this.isDeleting = false; this.cdr.detectChanges(); }
    });
  }

  // ══ PERMISSIONS ═══════════════════════════════

  getRole(): string { return this.auth.getUser()?.role || this.auth.getUser()?.roleName || ''; }

  canEdit(): boolean {
    const r = this.getRole();
    if (['BOSS','VICE_PRESIDENT','COUNTRY_DIRECTOR'].includes(r)) return true;
    if (r === 'PROJECT_MANAGER') {
      const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
      return this.project?.pmId === myId;
    }
    return false;
  }

  canDelete(): boolean {
    const r = this.getRole();
    if (r === 'BOSS') return false;
    if (['VICE_PRESIDENT','COUNTRY_DIRECTOR'].includes(r)) return true;
    if (r === 'PROJECT_MANAGER') {
      const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
      return this.project?.pmId === myId;
    }
    return false;
  }

  // ══ COMPUTED ══════════════════════════════════

  get statsCards() {
    return [
      { label: 'Total Tasks', value: this.stats?.totalTasks ?? this.tasks.length, icon: '📋', color: 'stat-white' },
      { label: 'Completed',   value: this.stats?.completed ?? 0,                  icon: '✅', color: 'stat-green' },
      { label: 'In Progress', value: this.stats?.inProgress ?? 0,                 icon: '⚡', color: 'stat-blue' },
      { label: 'Completion',  value: (this.project?.progress ?? 0) + '%',         icon: '📊', color: 'stat-purple' },
      { label: 'Team Size',   value: this.stats?.teamSize ?? this.members.length,  icon: '👥', color: 'stat-cyan' },
      { label: 'Overdue',     value: this.stats?.overdue ?? 0,                    icon: '⚠️', color: 'stat-red' },
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
  getPmInitial(): string { const name = this.getPmName(); return name.startsWith('PM #') ? 'P' : (name[0]?.toUpperCase() || 'P'); }
  formatBudget(b: any): string { return b ? '$' + Number(b).toLocaleString() : '—'; }

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

  getBudget(): string { const b = this.project?.budget; return b ? '$' + Number(b).toLocaleString() : '—'; }
  getMemberInitial(m: any): string { return (m.userName || m.name || '?')[0].toUpperCase(); }

  getPriorityColor2(p: string): string {
    const m: any = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
    return m[p] || '#f59e0b';
  }

  getMemberColor(i: number): string {
    const c = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    return c[i % c.length];
  }

  getRoleColor(role: string): string {
    const m: any = { PROJECT_MANAGER: '#16a34a', LEADER: '#0891b2', DEVELOPER: '#4f46e5', UI_UX: '#7c3aed', QA: '#ea580c', CUSTOMER: '#64748b' };
    return m[role] || '#475569';
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

  // Chat Popup
  openMemberChat(m: any) {
    this.selectedChatMember = { id: m.userId || m.id, name: m.userName || m.name, role: m.roleInProject || m.role, color: this.getMemberColor(this.members.indexOf(m)), initial: this.getMemberInitial(m), online: m.online };
    this.isGroupChat = false;
  }
  openGroupChat() {
    this.selectedChatMember = { id: this.projectId, name: this.project?.title || 'Group Chat', projectId: this.projectId, projectName: this.project?.title || 'Group Chat', color: '#16a34a' };
    this.isGroupChat = true;
  }
  closeChatPopup() { this.selectedChatMember = null; this.isGroupChat = false; }

  // ══ TECH STACK EDIT ═══════════════════════════

  addTechStack() {
    const name = this.newTechName.trim();
    if (!name) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/project-tech-stacks`, {
      projectId: this.projectId, name, category: this.newTechCategory, position: this.techStacks.length,
    }, h).subscribe({
      next: ts => { this.techStacks.push(ts); this.newTechName = ''; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  deleteTechStack(id: number) {
    if (!id) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/project-tech-stacks/${id}`, h).subscribe({
      next: () => { this.techStacks = this.techStacks.filter(t => t.id !== id); this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  // ══ MEMBER EDIT ════════════════════════════════

  loadStaffList() {
    if (this.staffList.length > 0) { this.filterStaff(); return; }
    this.staffListLoading = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/staff-list`, h).subscribe({
      next: users => {
        const exclude = ['BOSS','COUNTRY_DIRECTOR','CUSTOMER','ADMIN'];
        const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
        this.staffList = users.filter(u => {
          const r = u.roleName || u.role || '';
          return !exclude.includes(r) && u.isActive !== false && u.id !== myId;
        });
        this.staffListLoading = false;
        this.filterStaff();
        this.cdr.detectChanges();
      },
      error: () => { this.staffListLoading = false; this.cdr.detectChanges(); }
    });
  }

  filterStaff() {
    const q = this.memberSearchQuery.trim().toLowerCase();
    this.filteredStaff = q
      ? this.staffList.filter(s => {
          const role = s.roleDto?.name || s.roleName || s.role || '';
          return (s.name || '').toLowerCase().includes(q) || role.toLowerCase().includes(q);
        })
      : this.staffList;
    this.cdr.detectChanges();
  }

  isAlreadyMember(userId: number): boolean {
    return this.members.some(m => m.userId === userId);
  }

  addMember(staff: any) {
    if (this.isAlreadyMember(staff.id)) return;
    const h = { headers: this.auth.getHeaders() };
    const rawRole = staff.roleDto?.name || staff.roleName || staff.role || 'DEVELOPER';
    const role = this.mapRoleInProject(rawRole);
    this.http.post<any>(`${BASE}/projects/${this.projectId}/members`, { userId: staff.id, roleInProject: role }, h).subscribe({
      next: () => {
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
          next: m => { this.members = m; this.cdr.detectChanges(); }, error: () => {}
        });
      },
      error: () => {}
    });
  }

  removeMember(userId: number) {
    if (!userId) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/projects/${this.projectId}/members/${userId}`, h).subscribe({
      next: () => {
        const idx = this.members.findIndex(m => m.userId === userId);
        if (idx >= 0) {
          const m = { ...this.members[idx], status: 'REMOVED' };
          this.members.splice(idx, 1);
          this.removedMembers.push(m);
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  mapRoleInProject(role: string): string {
    const known: any = { PROJECT_MANAGER: 'PROJECT_MANAGER', LEADER: 'LEADER', UI_UX: 'UI_UX', DEVELOPER: 'DEVELOPER', QA: 'QA', CUSTOMER: 'CUSTOMER' };
    return known[role] || role || 'DEVELOPER';
  }

  loadRemovedMembers(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/projects/${id}/members/removed`, h).subscribe({
      next: data => { this.removedMembers = data || []; this.cdr.detectChanges(); },
      error: () => { this.removedMembers = []; }
    });
  }

  restoreMember(userId: number, roleInProject: string) {
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/projects/${this.projectId}/members`,
      { userId, roleInProject: roleInProject || 'DEVELOPER' }, h
    ).subscribe({
      next: () => {
        // 1. Local — removed list ကနေ ဖယ် + active list ထဲ ထည့်
        const idx = this.removedMembers.findIndex(m => m.userId === userId);
        if (idx >= 0) {
          const restored = { ...this.removedMembers[idx], status: 'ACTIVE' };
          this.removedMembers.splice(idx, 1);
          if (!this.members.some(m => m.userId === userId)) {
            this.members.push(restored);
          }
        }
        this.cdr.detectChanges();

        // 2. Backend ကနေ removed list reload (ACTIVE ဖြစ်သွားတာတွေ မပါတော့ဘူး)
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members/removed`, h).subscribe({
          next: data => { this.removedMembers = data || []; this.cdr.detectChanges(); },
          error: () => {}
        });

        // 3. Active members ကိုလည်း reload
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
          next: data => { this.members = data || []; this.cdr.detectChanges(); },
          error: () => {}
        });
      },
      error: () => {}
    });
  }

  // ══ RULE EDIT ══════════════════════════════════

  startEditRule(rule: any) {
    this.editingRuleId = Number(rule.id);
    this.ruleEditForm = {
      title:    rule.title    || '',
      content:  rule.content  || '',
      category: rule.category || 'GENERAL',
    };
    this.cdr.detectChanges();
  }

  cancelEditRule() {
    this.editingRuleId = undefined;
    this.cdr.detectChanges();
  }

  saveRule(ruleId: number) {
    if (!this.ruleEditForm.title.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/project-rules/${ruleId}`, {
      title:    this.ruleEditForm.title.trim(),
      content:  this.ruleEditForm.content,
      category: this.ruleEditForm.category,
    }, h).subscribe({
      next: updated => {
        const idx = this.projectRules.findIndex(r => r.id === ruleId);
        if (idx >= 0) this.projectRules[idx] = updated;
        this.editingRuleId = undefined;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  addRule() {
    if (!this.newRuleTitle.trim() || !this.newRuleContent.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/projects/${this.projectId}/rules/manual`, {
      title:     this.newRuleTitle.trim(),
      content:   this.newRuleContent.trim(),
      category:  this.newRuleCategory,
      createdBy: this.auth.getUser()?.userId || this.auth.getUser()?.id,
    }, h).subscribe({
      next: rule => {
        this.projectRules.push(rule);
        this.newRuleTitle = ''; this.newRuleContent = '';
        this.newRuleCategory = 'CODING_STANDARDS';
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  deleteRule(ruleId: number) {
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/project-rules/${ruleId}`, h).subscribe({
      next: () => {
        this.projectRules = this.projectRules.filter(r => r.id !== ruleId);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ══ DEFAULT MEMBERS (VP / Director / HR) ══════════════════════

  injectDefaultMembers() {
    const h = { headers: this.auth.getHeaders() };
    const branchId = this.auth.getUser()?.branchId;
    if (!branchId) return;

    // branch ထဲက VP, Director, Admin ဆွဲမယ်
    this.http.get<any[]>(`${BASE}/users/by-branch/${branchId}`, h).subscribe({
      next: users => {
        const defaultRoles = ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'ADMIN'];
        const roleColors: any = {
          VICE_PRESIDENT:   '#dc2626',
          COUNTRY_DIRECTOR: '#f97316',
          ADMIN:            '#f59e0b',
        };

        for (const u of users) {
          const role = u.roleDto?.name || u.roleName || u.role || '';
          if (!defaultRoles.includes(role)) continue;
          // already member ဖြစ်နေရင် ထပ်မထည့်
          if (this.members.some(m => m.userId === u.id)) continue;

          this.members.push({
            userId:        u.id,
            userName:      u.name,
            name:          u.name,
            roleInProject: role,
            initial:       u.name?.charAt(0).toUpperCase() || '?',
            color:         roleColors[role] || '#64748b',
            online:        false,
            status:        'ACTIVE',
            tasks:         0,
            isDefault:     true,   // default member flag
          });
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }


  // ══ DEFAULT MEMBERS (VP, Director, HR) ════════════════════════
  // ══ AUTO ADD VP / DIRECTOR / ADMIN ════════════════

  autoAddHighRoleMembers(projectId: number) {
    const h = { headers: this.auth.getHeaders() };
    // Backend endpoint — VP/Director/Admin တွေ auto add
    this.http.post<any>(
      `${BASE}/projects/${projectId}/members/auto-add-management`, {}, h
    ).subscribe({
      next: () => {
        // Reload members list
        this.http.get<any[]>(`${BASE}/projects/${projectId}/members`, h).subscribe({
          next: m => {
            const mList: any[] = m || [];
            const pmId: any = this.project?.pmId;
            if (pmId && !mList.some((x: any) => x.userId === pmId)) {
              const pmName: string = this.project?.pmName || 'PM';
              const pmEntry: any = {
                userId: pmId, userName: pmName, name: pmName,
                roleInProject: 'PROJECT_MANAGER',
                initial: pmName.charAt(0).toUpperCase(),
                color: '#16a34a', online: false, status: 'ACTIVE', tasks: 0,
              };
              mList.unshift(pmEntry);
            }
            this.members = mList;
            this.cdr.detectChanges();
          },
          error: () => {}
        });
      },
      error: () => {} // 403 or error — silently ignore
    });
  }


  // ══ MEMBER SORT BY ROLE ════════════════════════════

  getRoleOrder(roleInProject: string): number {
    const order: Record<string, number> = {
      'COUNTRY_DIRECTOR': 1,
      'VICE_PRESIDENT':   2,
      'ADMIN':            3,
      'PROJECT_MANAGER':  4,
      'LEADER':           5,
      'UI_UX':            6,
      'DEVELOPER':        7,
      'QA':               8,
      'CUSTOMER':         9,
    };
    return order[roleInProject] ?? 99;
  }

  sortMembers(members: any[]): any[] {
    return [...members].sort((a, b) => {
      const ra = this.getRoleOrder(a.roleInProject || a.role || '');
      const rb = this.getRoleOrder(b.roleInProject || b.role || '');
      return ra - rb;
    });
  }

}
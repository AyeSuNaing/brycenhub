import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

const BASE = 'http://localhost:8080/api';

@Component({
  selector: 'app-project-new-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-new-inline.html',
  host: { style: 'display:contents' }
})
export class ProjectNewInline implements OnInit {

  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<any>();

  currentStep = 1;

  form = {
    title: '',
    description: '',
    branchId: null as number | null,
    pmId: null as number | null,
    clientId: null as number | null,
    startDate: '',
    endDate: '',
    budget: null as number | null,
    priority: 'MEDIUM',
    originalLanguage: 'en',
  };

  currentUser: any = null;

  priorities = [
    { value: 'LOW',      label: 'Low',      color: '#22c55e' },
    { value: 'MEDIUM',   label: 'Medium',   color: '#f59e0b' },
    { value: 'HIGH',     label: 'High',     color: '#f97316' },
    { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  ];

  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English'    },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese'   },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar'    },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer'      },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean'     },
  ];

  clients: any[] = [];

  techStack: { name: string, category: string }[] = [];
  newTech          = '';
  newTechCategory  = 'frontend';
  isDetecting      = false;
  isSuggesting     = false;
  suggestedMembers: any[] = [];
  selectedMembers:  any[] = [];
  branchMembers:    any[] = [];
  memberSearch     = '';
  showMemberSearch = false;

  boardColumns: {
    name: string, statusKey: string, color: string, isDone: boolean, isDefault: boolean
  }[] = [
    { name: 'Backlog',          statusKey: 'TODO',             color: '#6366f1', isDone: false, isDefault: true },
    { name: 'In Progress',      statusKey: 'IN_PROGRESS',      color: '#3b82f6', isDone: false, isDefault: true },
    { name: 'In Review',        statusKey: 'IN_REVIEW',        color: '#f59e0b', isDone: false, isDefault: true },
    { name: 'Customer Confirm', statusKey: 'PENDING_APPROVAL', color: '#a855f7', isDone: false, isDefault: true },
    { name: 'Done',             statusKey: 'DONE',             color: '#22c55e', isDone: true,  isDefault: true },
  ];

  dragIndex: number | null = null;
  newColName  = '';
  newColColor = '#6366f1';

  pdfFile:      File | null = null;
  isAnalyzing:  boolean     = false;
  previewRules: any[]       = [];
  manualTitle:    string = '';
  manualContent:  string = '';
  manualCategory: string = 'CODING_STANDARDS';
  allPendingRules: any[] = [];

  isSubmitting = false;
  errors: any  = {};

  // ── NEW: Edit / Delete state ───────────────────────────────────────
  showEdit           = false;
  isSaving           = false;
  editError          = '';
  showDangerZone     = false;
  deleteConfirmName  = '';
  isDeleting         = false;
  editingProjectId:  number | null = null;   // set after project created

  editForm = {
    title:       '',
    description: '',
    status:      '',
    startDate:   '',
    endDate:     '',
    budget:      null as number | null,
    priority:    '',
  };

  statuses = [
    { value: 'PLANNING',  label: 'Planning',  color: '#64748b' },
    { value: 'ACTIVE',    label: 'Active',    color: '#22c55e' },
    { value: 'ON_HOLD',   label: 'On Hold',   color: '#f59e0b' },
    { value: 'COMPLETED', label: 'Completed', color: '#3b82f6' },
  ];
  // ──────────────────────────────────────────────────────────────────

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.currentUser   = this.auth.getUser();
    this.form.pmId     = this.currentUser?.userId   ?? null;
    this.form.branchId = this.currentUser?.branchId ?? null;
    this.loadClients();
    this.loadBranchMembers();
  }

  // ══════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ══════════════════════════════════════════════════════════════════

  loadClients() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/clients`, h).subscribe({
      next: c => { this.clients = c; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  loadBranchMembers() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/staff-list`, h).subscribe({
      next: users => {
        const exclude = ['CUSTOMER', 'BOSS', 'COUNTRY_DIRECTOR', 'ADMIN'];
        this.branchMembers = users.filter(u => {
          const r = u.roleName || u.role || '';
          const currentId = this.currentUser?.id || this.currentUser?.userId;
          return !exclude.includes(r) && u.isActive !== false && u.id !== currentId;
        });
        console.log('[ProjectNew] branchMembers loaded:', this.branchMembers.length, this.branchMembers);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[ProjectNew] loadBranchMembers error:', err);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 1
  // ══════════════════════════════════════════════════════════════════

  validateStep1(): boolean {
    this.errors = {};
    if (!this.form.title.trim()) { this.errors.title = 'Title is required'; return false; }
    if (!this.form.description.trim()) { this.errors.description = 'Description is required'; return false; }
    if (!this.form.startDate) { this.errors.startDate = 'Start date is required'; return false; }
    if (!this.form.endDate) { this.errors.endDate = 'End date is required'; return false; }
    if (!this.form.budget || this.form.budget <= 0) { this.errors.budget = 'Budget is required'; return false; }
    return true;
  }

  goToStep1() {
    this.currentStep = 1;
    setTimeout(() => {
      const ta = document.querySelector(".new-proj-wrapper textarea") as HTMLTextAreaElement;
      if (ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
    }, 50);
  }

  goToStep2() {
    if (!this.validateStep1()) return;
    this.currentStep = 2;
    if (this.techStack.length === 0) this.detectTechStack();
    setTimeout(() => {
      const ta = document.querySelector('.new-proj-wrapper textarea') as HTMLTextAreaElement;
      if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    }, 50);
  }

  autoResize(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 2 — AI TECH DETECT + TEAM SUGGEST
  // ══════════════════════════════════════════════════════════════════

  detectTechStack() {
    if (!this.form.title.trim()) return;
    this.isDetecting = true;
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/ai/detect-tech-stack`, {
      title: this.form.title, description: this.form.description,
    }, h).subscribe({
      next: res => {
        this.techStack   = res.techStack || [];
        this.isDetecting = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isDetecting = false; this.cdr.detectChanges(); }
    });
  }

  addTech() {
    const t = this.newTech.trim();
    if (t && !this.techStack.find(x => x.name === t))
      this.techStack.push({ name: t, category: this.newTechCategory });
    this.newTech = '';
  }

  removeTech(i: number) { this.techStack.splice(i, 1); }

  suggestTeam() {
    if (this.isDetecting || this.isSuggesting) return;

    if (this.techStack.length === 0) {
      if (!this.form.title.trim()) return;
      this.isDetecting = true;
      this.cdr.detectChanges();
      const h = { headers: this.auth.getHeaders() };
      this.http.post<any>(`${BASE}/ai/detect-tech-stack`, {
        title: this.form.title, description: this.form.description,
      }, h).subscribe({
        next: res => {
          this.techStack   = res.techStack || [];
          this.isDetecting = false;
          this.cdr.detectChanges();
          if (this.techStack.length > 0) this.runSuggestTeam();
        },
        error: () => { this.isDetecting = false; this.cdr.detectChanges(); }
      });
      return;
    }

    this.runSuggestTeam();
  }

  private runSuggestTeam() {
    this.isSuggesting    = true;
    this.suggestedMembers = [];
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/ai/suggest-team`, {
      techStack: this.techStack.map(t => t.name),
      branchId: this.form.branchId,
    }, h).subscribe({
      next: res => {
        const currentId = this.currentUser?.id || this.currentUser?.userId;
        this.suggestedMembers = (res.suggested || []).filter((m: any) => m.userId !== currentId);
        this.isSuggesting = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isSuggesting = false; this.cdr.detectChanges(); }
    });
  }

  addMember(member: any) {
    if (this.selectedMembers.find(m => m.userId === member.userId)) return;
    this.selectedMembers.push({
      userId: member.userId, name: member.name, role: member.role,
      profileImage: member.profileImage, roleInProject: this.mapRoleInProject(member.role),
    });
    this.cdr.detectChanges();
  }

  removeMember(userId: number) {
    this.selectedMembers = this.selectedMembers.filter(m => m.userId !== userId);
    this.cdr.detectChanges();
  }

  isMemberSelected(userId: number): boolean {
    return this.selectedMembers.some(m => m.userId === userId);
  }

  get filteredBranchMembers(): any[] {
    const q = this.memberSearch.trim().toLowerCase();
    if (!q) return this.branchMembers;
    return this.branchMembers.filter(m => {
      const name = (m.name || '').toLowerCase();
      const role = (m.role || m.roleName || m.roleDto?.name || '').toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }

  mapRoleInProject(role: string): string {
    const map: any = {
      PROJECT_MANAGER: 'PROJECT_MANAGER', LEADER: 'LEADER',
      UI_UX: 'UI_UX', DEVELOPER: 'DEVELOPER', QA: 'QA',
    };
    return map[role] || 'DEVELOPER';
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 3 — BOARD COLUMNS
  // ══════════════════════════════════════════════════════════════════

  onDragStart(i: number) { this.dragIndex = i; }

  onDragOver(event: DragEvent, i: number) {
    event.preventDefault();
    if (this.dragIndex === null || this.dragIndex === i) return;
    const cols = [...this.boardColumns];
    const dragged = cols.splice(this.dragIndex, 1)[0];
    cols.splice(i, 0, dragged);
    this.boardColumns = cols;
    this.dragIndex    = i;
    this.cdr.detectChanges();
  }

  onDragEnd() { this.dragIndex = null; this.cdr.detectChanges(); }

  addColumn() {
    const name = this.newColName.trim();
    if (!name) return;
    const statusKey = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');
    const doneIdx   = this.boardColumns.findIndex(c => c.isDone);
    const insertAt  = doneIdx >= 0 ? doneIdx : this.boardColumns.length;
    this.boardColumns.splice(insertAt, 0, {
      name, statusKey, color: this.newColColor, isDone: false, isDefault: false,
    });
    this.newColName  = '';
    this.newColColor = '#6366f1';
    this.cdr.detectChanges();
  }

  removeColumn(i: number) {
    if (this.boardColumns[i]?.isDefault) return;
    this.boardColumns.splice(i, 1);
    this.cdr.detectChanges();
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 5 — PROJECT RULES
  // ══════════════════════════════════════════════════════════════════

  onPdfSelect(event: any) {
    const file = event.target.files?.[0];
    if (file) this.pdfFile = file;
  }

  onPdfDrop(event: DragEvent) {
    event.preventDefault();
    const file    = event.dataTransfer?.files?.[0];
    const allowed = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt'];
    const name    = file?.name?.toLowerCase() || '';
    if (file && allowed.some(ext => name.endsWith(ext))) this.pdfFile = file;
  }

  clearPdf() {
    this.pdfFile         = null;
    this.previewRules    = [];
    this.allPendingRules = this.allPendingRules.filter(r => r.source !== 'AI_GENERATED');
  }

  async analyzeFile() {
    if (!this.pdfFile) return;
    this.isAnalyzing = true;
    this.cdr.detectChanges();
    const formData = new FormData();
    formData.append('file', this.pdfFile);
    try {
      const res = await this.http.post<any[]>(
        `${BASE}/projects/0/rules/analyze-file`, formData
      ).toPromise();
      this.previewRules = (res || []).map(r => ({ ...r, source: 'AI_GENERATED' }));
      this.syncPendingRules();
    } catch (err) {
      console.error('[Rules] analyzeFile error:', err);
    } finally {
      this.isAnalyzing = false;
      this.cdr.detectChanges();
    }
  }

  removePreviewRule(i: number) {
    this.previewRules.splice(i, 1);
    this.syncPendingRules();
  }

  addEmptyPreviewRule() {
    this.previewRules.push({
      title: '', content: '', category: 'GENERAL', source: 'AI_GENERATED',
      sourceFileUrl: this.previewRules[0]?.sourceFileUrl || '',
    });
  }

  addManualRule() {
    if (!this.manualTitle.trim() || !this.manualContent.trim()) return;
    this.allPendingRules.push({
      title: this.manualTitle.trim(), content: this.manualContent.trim(),
      category: this.manualCategory, source: 'MANUAL',
    });
    this.manualTitle    = '';
    this.manualContent  = '';
    this.manualCategory = 'CODING_STANDARDS';
    this.cdr.detectChanges();
  }

  removePendingRule(i: number) {
    const rule = this.allPendingRules[i];
    if (rule.source === 'AI_GENERATED') {
      const pi = this.previewRules.findIndex(r => r.title === rule.title);
      if (pi >= 0) this.previewRules.splice(pi, 1);
    }
    this.allPendingRules.splice(i, 1);
    this.cdr.detectChanges();
  }

  syncPendingRules() {
    const manual         = this.allPendingRules.filter(r => r.source === 'MANUAL');
    this.allPendingRules = [...this.previewRules, ...manual];
    this.cdr.detectChanges();
  }

  getRuleCategoryColor(cat: string): string {
    switch (cat) {
      case 'CODING_STANDARDS': return '#6366f1';
      case 'PROCESS_RULES':    return '#f59e0b';
      default:                 return '#64748b';
    }
  }

  getRuleCategoryIcon(cat: string): string {
    switch (cat) {
      case 'CODING_STANDARDS': return '📦';
      case 'PROCESS_RULES':    return '⚙️';
      default:                 return '📌';
    }
  }

  private async saveRules(projectId: number) {
    if (this.allPendingRules.length === 0) return;
    const h = { headers: this.auth.getHeaders() };
    try {
      await this.http.post(
        `${BASE}/projects/${projectId}/rules/confirm`,
        { createdBy: this.currentUser?.userId, rules: this.allPendingRules }, h
      ).toPromise();
    } catch (err) {
      console.error('[Rules] saveRules error:', err);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SUBMIT
  // ══════════════════════════════════════════════════════════════════

  async submit() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    try {
      const project = await this.http.post<any>(`${BASE}/projects`, {
        title: this.form.title, description: this.form.description,
        branchId: this.form.branchId, pmId: this.form.pmId,
        clientId: this.form.clientId    || null,
        startDate: this.form.startDate  || null,
        endDate: this.form.endDate      || null,
        budget: this.form.budget        || null,
        priority: this.form.priority,
        originalLanguage: this.form.originalLanguage,
        status: 'ACTIVE',
      }, h).toPromise();

      for (let i = 0; i < this.techStack.length; i++) {
        await this.http.post<any>(`${BASE}/project-tech-stacks`, {
          projectId: project.id, name: this.techStack[i].name,
          category: this.techStack[i].category, position: i,
        }, h).toPromise().catch(() => { });
      }

      for (let i = 0; i < this.boardColumns.length; i++) {
        await this.http.post<any>(`${BASE}/project-board-columns`, {
          projectId: project.id, name: this.boardColumns[i].name,
          statusKey: this.boardColumns[i].statusKey, color: this.boardColumns[i].color,
          position: i, isDone: this.boardColumns[i].isDone,
        }, h).toPromise().catch(() => { });
      }

      await this.http.post<any>(
        `${BASE}/projects/${project.id}/members`,
        { userId: this.form.pmId, roleInProject: 'PROJECT_MANAGER' }, h
      ).toPromise().catch(() => { });

      for (const m of this.selectedMembers) {
        await this.http.post<any>(
          `${BASE}/projects/${project.id}/members`,
          { userId: m.userId, roleInProject: m.roleInProject }, h
        ).toPromise().catch(() => { });
      }

      if (this.form.clientId) {
        try {
          const clientUsers: any[] = await this.http.get<any[]>(
            `${BASE}/clients/${this.form.clientId}/users`, h
          ).toPromise() ?? [];
          for (const cu of clientUsers) {
            await this.http.post<any>(
              `${BASE}/projects/${project.id}/members`,
              { userId: cu.id, roleInProject: 'CUSTOMER' }, h
            ).toPromise().catch(() => { });
          }
        } catch { }
      }

      await this.saveRules(project.id);

      // edit/delete အတွက် projectId သိမ်း
      this.editingProjectId = project.id;
      this.isSubmitting = false;
      this.cdr.detectChanges();
      this.created.emit(project);

    } catch (err) {
      console.error('[ProjectNewInline] submit error:', err);
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // EDIT — PUT /api/projects/{id}
  // ══════════════════════════════════════════════════════════════════

  openEdit(projectId: number, project: any) {
    this.editingProjectId = projectId;
    this.editForm = {
      title:       project.title       || '',
      description: project.description || '',
      status:      project.status      || 'ACTIVE',
      startDate:   project.startDate   || '',
      endDate:     project.endDate     || '',
      budget:      project.budget      || null,
      priority:    project.priority    || 'MEDIUM',
    };
    this.editError     = '';
    this.showEdit      = true;
    this.showDangerZone = false;
    this.cdr.detectChanges();
  }

  closeEdit() {
    this.showEdit  = false;
    this.editError = '';
    this.showDangerZone   = false;
    this.deleteConfirmName = '';
    this.cdr.detectChanges();
  }

  saveEdit() {
    if (!this.editForm.title.trim()) { this.editError = 'Title is required'; return; }
    if (!this.editingProjectId) return;
    this.isSaving  = true;
    this.editError = '';
    const h = { headers: this.auth.getHeaders() };
    const payload = {
      title:       this.editForm.title.trim(),
      description: this.editForm.description,
      status:      this.editForm.status,
      startDate:   this.editForm.startDate || null,
      endDate:     this.editForm.endDate   || null,
      budget:      this.editForm.budget    || null,
      priority:    this.editForm.priority,
    };
    this.http.put<any>(`${BASE}/projects/${this.editingProjectId}`, payload, h).subscribe({
      next: () => {
        this.isSaving  = false;
        this.showEdit  = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.editError = 'Failed to save. Please try again.';
        this.isSaving  = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // DELETE (Soft) — PUT status=CANCELLED
  // ══════════════════════════════════════════════════════════════════

  get deleteConfirmMatches(): boolean {
    return this.deleteConfirmName.trim() === this.editForm.title.trim();
  }

  cancelProject() {
    if (!this.deleteConfirmMatches || this.isDeleting || !this.editingProjectId) return;
    this.isDeleting = true;
    const h = { headers: this.auth.getHeaders() };
    // Soft delete — status CANCELLED ပြောင်းတာပဲ
    this.http.put<any>(`${BASE}/projects/${this.editingProjectId}`, { status: 'CANCELLED' }, h).subscribe({
      next: () => {
        this.isDeleting        = false;
        this.showEdit          = false;
        this.showDangerZone    = false;
        this.deleteConfirmName = '';
        this.cdr.detectChanges();
        this.close.emit(); // dashboard ပြန်သွား
      },
      error: () => {
        this.isDeleting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  getPriorityColor(p: string): string {
    return this.priorities.find(x => x.value === p)?.color || '#6b7280';
  }

  getStatusColor(s: string): string {
    return this.statuses.find(x => x.value === s)?.color || '#64748b';
  }

  getClientName(id: number | null): string {
    if (!id) return '—';
    return this.clients.find(c => c.id === id)?.companyName || '—';
  }

  formatBudget(b: number | null): string {
    if (!b) return '—';
    return '$' + b.toLocaleString();
  }

  getMemberInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#6b7280';
  }

  getRoleColor(role: string): string {
    const map: any = {
      PROJECT_MANAGER: '#16a34a', LEADER: '#0891b2',
      DEVELOPER: '#4f46e5', UI_UX: '#7c3aed', QA: '#ea580c',
    };
    return map[role] || '#475569';
  }

  getFormProgress(): number {
    let score = 0;
    if (this.form.title.trim())          score += 25;
    if (this.form.description.trim())    score += 10;
    if (this.form.startDate)             score += 8;
    if (this.form.endDate)               score += 8;
    if (this.form.budget)                score += 4;
    if (this.techStack.length > 0)       score += 15;
    if (this.selectedMembers.length > 0) score += 15;
    if (this.allPendingRules.length > 0) score += 15;
    return Math.min(score, 100);
  }

  get groupedTechStack(): { category: string, items: { name: string, category: string, index: number }[] }[] {
    const groups: any = {};
    this.techStack.forEach((t, i) => {
      const cat = t.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...t, index: i });
    });
    return Object.keys(groups).map(cat => ({ category: cat, items: groups[cat] }));
  }

  getCategoryColor(cat: string): string {
    const map: any = {
      frontend: '#3b82f6', backend: '#16a34a', database: '#f59e0b',
      mobile: '#a855f7', payment: '#06b6d4', realtime: '#f97316',
      devops: '#64748b', other: '#475569',
    };
    return map[cat] || '#475569';
  }

  getCategoryIcon(cat: string): string {
    const map: any = {
      frontend: '🖥', backend: '⚙️', database: '🗄', mobile: '📱',
      payment: '💳', realtime: '⚡', devops: '🐳', other: '🔧',
    };
    return map[cat] || '🔧';
  }

  getLangName(code: string): string {
    return this.langs.find(l => l.code === code)?.name || code;
  }

  getLangFlag(code: string): string {
    return this.langs.find(l => l.code === code)?.flag || '';
  }
}
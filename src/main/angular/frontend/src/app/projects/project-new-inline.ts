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

  @Output() close    = new EventEmitter<void>();
  @Output() created  = new EventEmitter<any>();

  // ── STEP ──────────────────────────────────────────────────────────
  currentStep = 1;  // 1=Basic | 2=Team | 3=Columns | 4=Preview

  // ── FORM ──────────────────────────────────────────────────────────
  form = {
    title:            '',
    description:      '',
    branchId:         null as number | null,
    pmId:             null as number | null,
    clientId:         null as number | null,
    startDate:        '',
    endDate:          '',
    budget:           null as number | null,
    priority:         'MEDIUM',
    originalLanguage: 'en',
  };

  // ── CURRENT USER ──────────────────────────────────────────────────
  currentUser: any = null;

  // ── STEP 1 DATA ───────────────────────────────────────────────────
  priorities = [
    { value: 'LOW',      label: 'Low',      color: '#22c55e' },
    { value: 'MEDIUM',   label: 'Medium',   color: '#f59e0b' },
    { value: 'HIGH',     label: 'High',     color: '#f97316' },
    { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  ];

  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean' },
  ];

  clients: any[] = [];  // CUSTOMER role users

  // ── STEP 2 DATA ───────────────────────────────────────────────────
  techStack: {name: string, category: string}[] = []; // AI detected + PM edited
  newTech              = '';       // manual add input
  newTechCategory       = 'frontend'; // manual add category
  isDetecting          = false;    // AI detect loading
  isSuggesting         = false;    // AI suggest loading
  suggestedMembers: any[] = [];    // AI suggested list
  selectedMembers: any[] = [];     // PM selected members
  branchMembers: any[]   = [];     // all branch members (for manual add)
  memberSearch           = '';     // search input
  showMemberSearch       = false;  // toggle manual search

  // ── STEP 3 DATA ───────────────────────────────────────────────────
  boardColumns: {name: string, statusKey: string, color: string, isDone: boolean, isDefault: boolean}[] = [
    { name: 'Backlog',          statusKey: 'TODO',             color: '#6366f1', isDone: false, isDefault: true  },
    { name: 'In Progress',      statusKey: 'IN_PROGRESS',      color: '#3b82f6', isDone: false, isDefault: true  },
    { name: 'In Review',        statusKey: 'IN_REVIEW',        color: '#f59e0b', isDone: false, isDefault: true  },
    { name: 'Customer Confirm', statusKey: 'PENDING_APPROVAL', color: '#a855f7', isDone: false, isDefault: true  },
    { name: 'Done',             statusKey: 'DONE',             color: '#22c55e', isDone: true,  isDefault: true  },
  ];

  // ── Drag & Drop state ─────────────────────────────────────────
  dragIndex: number | null = null;

  // ── New column ────────────────────────────────────────────────
  newColName  = '';
  newColColor = '#6366f1';

  // ── STATE ─────────────────────────────────────────────────────────
  isSubmitting = false;
  errors: any  = {};

  // ─────────────────────────────────────────────────────────────────
  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef
  ) {}

  // ─────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.currentUser      = this.auth.getUser();
    this.form.pmId        = this.currentUser?.userId   ?? null;
    this.form.branchId    = this.currentUser?.branchId ?? null;

    this.loadClients();
    this.loadBranchMembers();
  }

  // ══════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ══════════════════════════════════════════════════════════════════

  loadClients() {
    const h = { headers: this.auth.getHeaders() };
    // clients table → GET /api/clients (branch auto-filter by backend)
    this.http.get<any[]>(`${BASE}/clients`, h)
      .subscribe({
        next: clients => {
          this.clients = clients;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  loadBranchMembers() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/by-branch/${this.form.branchId}`, h)
      .subscribe({
        next: users => {
          // CUSTOMER / BOSS / DIRECTOR / ADMIN ဖြုတ်
          const excludeRoles = ['CUSTOMER', 'BOSS', 'COUNTRY_DIRECTOR', 'ADMIN'];
          this.branchMembers = users.filter(u => {
            const role = u.role || u.roleName || '';
            return !excludeRoles.includes(role) && u.isActive !== false;
          });
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 1 — BASIC INFO
  // ══════════════════════════════════════════════════════════════════

  validateStep1(): boolean {
    this.errors = {};
    if (!this.form.title.trim()) {
      this.errors.title = 'Title is required';
      return false;
    }
    return true;
  }

  goToStep2() {
    if (!this.validateStep1()) return;
    this.currentStep = 2;
    // Step 2 ရောက်မှ auto detect
    if (this.techStack.length === 0) {
      this.detectTechStack();
    }
  }

  autoResize(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 2 — AI TECH DETECT + TEAM SUGGEST
  // ══════════════════════════════════════════════════════════════════

  // ── Tech Stack Detect ─────────────────────────────────────────────
  detectTechStack() {
    if (!this.form.title.trim()) return;
    this.isDetecting = true;
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/ai/detect-tech-stack`, {
      title:       this.form.title,
      description: this.form.description,
    }, h).subscribe({
      next: res => {
        this.techStack   = res.techStack || [];
        this.isDetecting = false;
        // Auto suggest after detect
        if (this.techStack.length > 0) {
          this.suggestTeam();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isDetecting = false;
        this.cdr.detectChanges();
      }
    });
  }

  addTech() {
    const t = this.newTech.trim();
    if (t && !this.techStack.find(x => x.name === t)) {
      this.techStack.push({ name: t, category: this.newTechCategory });
    }
    this.newTech = '';
  }

  removeTech(i: number) {
    this.techStack.splice(i, 1);
  }

  // ── Team Suggest ──────────────────────────────────────────────────
  suggestTeam() {
    if (this.techStack.length === 0) return;
    this.isSuggesting = true;
    this.suggestedMembers = [];
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/ai/suggest-team`, {
      techStack: this.techStack.map(t => t.name),
      branchId:  this.form.branchId,
    }, h).subscribe({
      next: res => {
        this.suggestedMembers = res.suggested || [];
        this.isSuggesting     = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSuggesting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Member Select ─────────────────────────────────────────────────
  addMember(member: any) {
    const exists = this.selectedMembers.find(m => m.userId === member.userId);
    if (exists) return;
    this.selectedMembers.push({
      userId:        member.userId,
      name:          member.name,
      role:          member.role,
      profileImage:  member.profileImage,
      roleInProject: this.mapRoleInProject(member.role),
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

  // Manual search members
  get filteredBranchMembers(): any[] {
    if (!this.memberSearch.trim()) return this.branchMembers;
    const q = this.memberSearch.toLowerCase();
    return this.branchMembers.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      (m.role || m.roleName || '').toLowerCase().includes(q)
    );
  }

  mapRoleInProject(role: string): string {
    const map: any = {
      'PROJECT_MANAGER': 'PROJECT_MANAGER',
      'LEADER':          'LEADER',
      'UI_UX':           'UI_UX',
      'DEVELOPER':       'DEVELOPER',
      'QA':              'QA',
    };
    return map[role] || 'DEVELOPER';
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 4 — SUBMIT
  // ══════════════════════════════════════════════════════════════════

  async submit() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };

    try {
      // ① Project create
      const project = await this.http.post<any>(`${BASE}/projects`, {
        title:            this.form.title,
        description:      this.form.description,
        branchId:         this.form.branchId,
        pmId:             this.form.pmId,
        clientId:         this.form.clientId || null,
        startDate:        this.form.startDate || null,
        endDate:          this.form.endDate   || null,
        budget:           this.form.budget    || null,
        priority:         this.form.priority,
        originalLanguage: this.form.originalLanguage,
        status:           'ACTIVE',
      }, h).toPromise();

      // ② Tech stack save
      for (let i = 0; i < this.techStack.length; i++) {
        const tech = this.techStack[i];
        await this.http.post<any>(`${BASE}/project-tech-stacks`, {
          projectId: project.id,
          name:      tech.name,
          category:  tech.category,
          position:  i,
        }, h).toPromise().catch(() => {});
      }

      // ③ Board columns save
      for (let i = 0; i < this.boardColumns.length; i++) {
        const col = this.boardColumns[i];
        await this.http.post<any>(`${BASE}/project-board-columns`, {
          projectId: project.id,
          name:      col.name,
          statusKey: col.statusKey,
          color:     col.color,
          position:  i,
          isDone:    col.isDone,
        }, h).toPromise().catch(() => {});
      }

      // ④ Team members add
      for (const m of this.selectedMembers) {
        await this.http.post<any>(
          `${BASE}/projects/${project.id}/members`,
          { userId: m.userId, roleInProject: m.roleInProject }, h
        ).toPromise().catch(() => {});
      }

      // ⑤ Client add (CUSTOMER role)
      if (this.form.clientId) {
        await this.http.post<any>(
          `${BASE}/projects/${project.id}/members`,
          { userId: this.form.clientId, roleInProject: 'CUSTOMER' }, h
        ).toPromise().catch(() => {});
      }

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
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════
  // STEP 3 — BOARD COLUMNS
  // ══════════════════════════════════════════════════════════════

  onDragStart(i: number) {
    this.dragIndex = i;
  }

  onDragOver(event: DragEvent, i: number) {
    event.preventDefault();
    if (this.dragIndex === null || this.dragIndex === i) return;

    // Reorder
    const cols = [...this.boardColumns];
    const dragged = cols.splice(this.dragIndex, 1)[0];
    cols.splice(i, 0, dragged);
    this.boardColumns = cols;
    this.dragIndex = i;
    this.cdr.detectChanges();
  }

  onDragEnd() {
    this.dragIndex = null;
    this.cdr.detectChanges();
  }

  addColumn() {
    const name = this.newColName.trim();
    if (!name) return;

    // statusKey auto-generate from name
    const statusKey = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');

    // Done column ရှေ့မှာ ထည့်
    const doneIdx = this.boardColumns.findIndex(c => c.isDone);
    const insertAt = doneIdx >= 0 ? doneIdx : this.boardColumns.length;

    this.boardColumns.splice(insertAt, 0, {
      name:      name,
      statusKey: statusKey,
      color:     this.newColColor,
      isDone:    false,
      isDefault: false,
    });

    this.newColName  = '';
    this.newColColor = '#6366f1';
    this.cdr.detectChanges();
  }

  removeColumn(i: number) {
    if (this.boardColumns[i]?.isDefault) return; // default columns ဖြုတ်မရ
    this.boardColumns.splice(i, 1);
    this.cdr.detectChanges();
  }

  getPriorityColor(p: string): string {
    return this.priorities.find(x => x.value === p)?.color || '#6b7280';
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
      'PROJECT_MANAGER': '#16a34a',
      'LEADER':          '#0891b2',
      'DEVELOPER':       '#4f46e5',
      'UI_UX':           '#7c3aed',
      'QA':              '#ea580c',
    };
    return map[role] || '#475569';
  }

  getFormProgress(): number {
    let score = 0;
    if (this.form.title.trim())       score += 30;
    if (this.form.description.trim()) score += 15;
    if (this.form.startDate)          score += 10;
    if (this.form.endDate)            score += 10;
    if (this.form.budget)             score += 10;
    if (this.techStack.length > 0)    score += 15;
    if (this.selectedMembers.length > 0) score += 10;
    return Math.min(score, 100);
  }

  // Tech stack grouped by category
  get groupedTechStack(): {category: string, items: {name: string, category: string, index: number}[]}[] {
    const groups: any = {};
    this.techStack.forEach((t, i) => {
      const cat = t.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({...t, index: i});
    });
    return Object.keys(groups).map(cat => ({ category: cat, items: groups[cat] }));
  }

  getCategoryColor(cat: string): string {
    const map: any = {
      frontend: '#3b82f6',
      backend:  '#16a34a',
      database: '#f59e0b',
      mobile:   '#a855f7',
      payment:  '#06b6d4',
      realtime: '#f97316',
      devops:   '#64748b',
      other:    '#475569',
    };
    return map[cat] || '#475569';
  }

  getCategoryIcon(cat: string): string {
    const map: any = {
      frontend: '🖥',
      backend:  '⚙️',
      database: '🗄',
      mobile:   '📱',
      payment:  '💳',
      realtime: '⚡',
      devops:   '🐳',
      other:    '🔧',
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
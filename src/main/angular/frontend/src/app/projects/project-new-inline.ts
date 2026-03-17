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

  form = {
    title: '',
    description: '',
    branchId: null as number | null,
    pmId: null as number | null,
    startDate: '',
    endDate: '',
    budget: null as number | null,
    priority: 'MEDIUM',
    originalLanguage: 'en',
  };

  boardColumns = [
    { name: 'Backlog', statusKey: 'TODO', color: '#6366f1', isDone: false },
    { name: 'In Progress', statusKey: 'IN_PROGRESS', color: '#3b82f6', isDone: false },
    { name: 'In Review', statusKey: 'IN_REVIEW', color: '#f59e0b', isDone: false },
    { name: 'Customer Confirm', statusKey: 'PENDING_APPROVAL', color: '#a855f7', isDone: false },
    { name: 'Done', statusKey: 'DONE', color: '#22c55e', isDone: true },
  ];

  newColName = '';
  newColKey = '';
  newColColor = '#6366f1';
  dragIndex: number | null = null;

  branches: any[] = [];
  managers: any[] = [];

  isSubmitting = false;
  currentStep = 1;
  errors: any = {};

  langs = [
    { code: 'en', display: 'EN', flag: '🇺🇸', name: 'English' },
    { code: 'ja', display: 'JP', flag: '🇯🇵', name: 'Japanese' },
    { code: 'my', display: 'MM', flag: '🇲🇲', name: 'Myanmar' },
    { code: 'km', display: 'KH', flag: '🇰🇭', name: 'Khmer' },
    { code: 'vi', display: 'VN', flag: '🇻🇳', name: 'Vietnamese' },
    { code: 'ko', display: 'KR', flag: '🇰🇷', name: 'Korean' },
  ];

  priorities = [
    { value: 'LOW', label: 'Low', color: '#6b7280' },
    { value: 'MEDIUM', label: 'Medium', color: '#f59e0b' },
    { value: 'HIGH', label: 'High', color: '#f97316' },
    { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    const userLang = this.auth.getUser()?.preferredLanguage || 'en';
    const userBranchId = this.auth.getUser()?.branchId;
    this.form.originalLanguage = userLang;
    if (userBranchId) this.form.branchId = userBranchId;

    this.loadBranches();
  }

  loadBranches() {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/branches`, h).subscribe({
      next: b => {
        this.branches = b;
        this.cdr.detectChanges();
        if (this.form.branchId) {
          this.loadManagersByBranch(this.form.branchId);
        }
      },
      error: () => { }
    });
  }

  onBranchChange() {
    this.form.pmId = null;
    this.managers = [];
    if (this.form.branchId) {
      this.loadManagersByBranch(this.form.branchId);
    }
  }

  loadManagersByBranch(branchId: number) {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/by-branch/${branchId}`, h).subscribe({
      next: users => {
        this.managers = users.filter(u =>
          ['PROJECT_MANAGER', 'LEADER', 'BOSS', 'ADMIN'].includes(u.role)
        );
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  autoResize(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // ── DRAG & DROP ───────────────────────────────
  onDragStart(i: number) {
    this.dragIndex = i;
  }

  onDragOver(event: DragEvent, i: number) {
    event.preventDefault();
    if (this.dragIndex === null || this.dragIndex === i) return;
    if (this.boardColumns[i].isDone) return; // DONE ကို drag over မလုပ်နဲ့
    const dragged = this.boardColumns.splice(this.dragIndex, 1)[0];
    this.boardColumns.splice(i, 0, dragged);
    this.dragIndex = i;
    this.cdr.detectChanges();
  }

  onDragEnd() { this.dragIndex = null; }

  addColumn() {
    if (!this.newColName.trim() || !this.newColKey.trim()) return;
    const doneIdx = this.boardColumns.findIndex(c => c.isDone);
    const newCol = {
      name: this.newColName.trim(),
      statusKey: this.newColKey.toUpperCase().replace(/\s+/g, '_'),
      color: this.newColColor,
      isDone: false,
    };
    if (doneIdx >= 0) {
      this.boardColumns.splice(doneIdx, 0, newCol);
    } else {
      this.boardColumns.push(newCol);
    }
    this.newColName = '';
    this.newColKey = '';
    this.newColColor = '#6366f1';
  }

  removeColumn(i: number) {
    if (this.boardColumns[i].isDone) return;
    this.boardColumns.splice(i, 1);
  }

  validate(): boolean {
    this.errors = {};
    if (!this.form.title.trim())
      this.errors.title = 'Title is required';
    if (!this.form.branchId)
      this.errors.branchId = 'Branch is required';
    if (!this.form.startDate)
      this.errors.startDate = 'Start date is required';
    if (this.boardColumns.length < 2)
      this.errors.columns = 'At least 2 columns required';
    return Object.keys(this.errors).length === 0;
  }

  async submit() {
    if (!this.validate()) { this.currentStep = 1; return; }

    this.isSubmitting = true;
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };

    try {
      const project: any = await this.http.post<any>(`${BASE}/projects`, {
        title: this.form.title.trim(),
        description: this.form.description.trim() || null,
        branchId: this.form.branchId,
        pmId: this.form.pmId || null,
        startDate: this.form.startDate || null,
        endDate: this.form.endDate || null,
        budget: this.form.budget || null,
        priority: this.form.priority,
        originalLanguage: this.form.originalLanguage,
      }, h).toPromise();

      for (let i = 0; i < this.boardColumns.length; i++) {
        const col = this.boardColumns[i];
        await this.http.post<any>(`${BASE}/board-columns`, {
          projectId: project.id,
          name: col.name,
          statusKey: col.statusKey,
          color: col.color,
          position: i,
          isDone: col.isDone,
        }, h).toPromise();
      }

      if (this.form.pmId) {
        await this.http.post<any>(
          `${BASE}/projects/${project.id}/members`,
          { userId: this.form.pmId, roleInProject: 'PROJECT_MANAGER' }, h
        ).toPromise().catch(() => { });
      }

      this.isSubmitting = false;
      this.cdr.detectChanges();
      this.created.emit(project);
    } catch (err) {
      console.error(err);
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  getFormProgress(): number {
    let score = 0;
    if (this.form.title.trim()) score += 25;
    if (this.form.branchId) score += 20;
    if (this.form.startDate) score += 15;
    if (this.form.description.trim()) score += 15;
    if (this.form.pmId) score += 10;
    if (this.form.budget) score += 10;
    if (this.form.endDate) score += 5;
    return Math.min(score, 100);
  }


  getPriorityColor(p: string): string {
    return this.priorities.find(x => x.value === p)?.color || '#6b7280';
  }
  getBranchName(id: number | null): string {
    if (!id) return '—';
    return this.branches.find(b => b.id === id)?.name || '—';
  }
  getPmName(id: number | null): string {
    if (!id) return '—';
    return this.managers.find(m => m.id === id)?.name || '—';
  }
  formatBudget(b: number | null): string {
    if (!b) return '—';
    return '$' + b.toLocaleString();
  }
}

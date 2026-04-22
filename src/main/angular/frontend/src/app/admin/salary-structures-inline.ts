import { Component, OnInit, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

const API_BASE     = 'http://localhost:8080/api';
const SALARY_BASE  = `${API_BASE}/salary-structures`;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface StaffSalaryRow {
  userId: number;
  name: string;
  roleName?: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
  branchId?: number;
  branchName?: string;
  currentId?: number | null;
  currentSalary?: number | null;
  currentEffectiveDate?: string | null;
  currentNote?: string | null;
  historyCount?: number;
  currency?: string;
}

interface HistoryItem {
  id: number;
  baseSalary: number;
  effectiveDate: string;
  note?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
}

interface Stats {
  totalStaff: number;
  withSalary: number;
  withoutSalary: number;
  avgSalary: number;
  totalMonthly: number;
  currency: string;
}

@Component({
  selector: 'app-salary-structures-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-structures-inline.html',
  styleUrls: ['./salary-structures-inline.scss'],
})
export class SalaryStructuresInline implements OnInit {
  @Output() back = new EventEmitter<void>();

  // ── Math exposure for template ─────────────
  Math = Math;

  // ── Data ──────────────────────────────────
  staffRows: StaffSalaryRow[] = [];
  stats: Stats = {
    totalStaff: 0, withSalary: 0, withoutSalary: 0,
    avgSalary: 0, totalMonthly: 0, currency: 'USD',
  };
  loading = false;
  saving = false;

  // ── Auth ──────────────────────────────────
  currentUser: any = null;

  // ── Filters ───────────────────────────────
  searchQuery = '';
  selectedRoleFilter = 'ALL';
  statusFilter: 'ALL' | 'SET' | 'UNSET' = 'ALL';

  // ── Sort ──────────────────────────────────
  sortBy: 'salary_desc' | 'salary_asc' | 'dept_asc' | 'dept_desc' | 'name_asc' = 'salary_desc';

  sortOptions: { key: string; label: string }[] = [
    { key: 'salary_desc', label: '💰 Salary: High → Low' },
    { key: 'salary_asc',  label: '💰 Salary: Low → High' },
    { key: 'dept_asc',    label: '🏢 Department: A → Z' },
    { key: 'dept_desc',   label: '🏢 Department: Z → A' },
    { key: 'name_asc',    label: '📝 Name: A → Z' },
  ];
  showSortMenu = false;

  roleFilters = [
    { key: 'ALL',             label: 'All',    color: '#94a3b8' },
    { key: 'PROJECT_MANAGER', label: 'PM',     color: '#22c55e' },
    { key: 'LEADER',          label: 'Leader', color: '#06b6d4' },
    { key: 'DEVELOPER',       label: 'Dev',    color: '#6366f1' },
    { key: 'DATA_ENGINEER',   label: 'Data',   color: '#06b6d4' },
    { key: 'ADMIN',           label: 'Admin',  color: '#ec4899' },
    { key: 'VP',              label: 'VP',     color: '#ef4444' },
  ];

  // ── Salary form modal (Add / Update) ─────
  showForm = false;
  formTarget: StaffSalaryRow | null = null;
  form: {
    baseSalary: number | null;
    effectiveDate: string;
    note: string;
  } = {
    baseSalary: null,
    effectiveDate: this.todayISO(),
    note: '',
  };
  formError = '';

  // ── History modal ─────────────────────────
  showHistory = false;
  historyTarget: StaffSalaryRow | null = null;
  historyItems: HistoryItem[] = [];
  loadingHistory = false;

  // ── Delete confirm ────────────────────────
  deleteTarget: HistoryItem | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadAll();
  }

  private get headers() { return this.auth.getHeaders(); }

  private todayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ─────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────
  loadAll(): void {
    this.loadStaff();
    this.loadStats();
  }

  loadStaff(): void {
    this.loading = true;
    this.http.get<StaffSalaryRow[]>(`${SALARY_BASE}/staff-list`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[staff]', err); return of([]); }))
      .subscribe(list => {
        this.staffRows = (list || []).map(r => ({
          ...r,
          currentSalary: r.currentSalary == null ? null : Number(r.currentSalary),
        }));
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  loadStats(): void {
    this.http.get<Stats>(`${SALARY_BASE}/stats`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[stats]', err); return of(null); }))
      .subscribe(s => {
        if (s) {
          this.stats = {
            ...s,
            avgSalary: Number(s.avgSalary) || 0,
            totalMonthly: Number(s.totalMonthly) || 0,
          };
          this.cdr.detectChanges();
        }
      });
  }

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────
  get userRoleName(): string {
    return this.currentUser?.role || this.currentUser?.roleName || '';
  }

  get isGlobalAdmin(): boolean {
    const r = this.userRoleName;
    return r === 'BOSS' || r === 'COUNTRY_DIRECTOR';
  }

  get canEdit(): boolean {
    const r = this.userRoleName;
    return r === 'BOSS' || r === 'COUNTRY_DIRECTOR' || r === 'ADMIN';
  }

  // ─────────────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────────────
  setRoleFilter(key: string): void { this.selectedRoleFilter = key; }
  setStatusFilter(s: 'ALL' | 'SET' | 'UNSET'): void { this.statusFilter = s; }

  toggleSortMenu(): void { this.showSortMenu = !this.showSortMenu; }

  setSort(key: string): void {
    this.sortBy = key as typeof this.sortBy;
    this.showSortMenu = false;
  }

  get currentSortLabel(): string {
    const opt = this.sortOptions.find(o => o.key === this.sortBy);
    return opt?.label || 'Sort';
  }

  get filteredRows(): StaffSalaryRow[] {
    let list = [...this.staffRows];

    // Role
    if (this.selectedRoleFilter !== 'ALL') {
      list = list.filter(s => s.roleName === this.selectedRoleFilter);
    }

    // Status
    if (this.statusFilter === 'SET') {
      list = list.filter(s => s.currentSalary != null);
    } else if (this.statusFilter === 'UNSET') {
      list = list.filter(s => s.currentSalary == null);
    }

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.departmentName?.toLowerCase().includes(q) ||
        s.roleDisplayName?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => this.compareRows(a, b));

    return list;
  }

  private compareRows(a: StaffSalaryRow, b: StaffSalaryRow): number {
    const nameA = a.name || '';
    const nameB = b.name || '';

    switch (this.sortBy) {
      case 'salary_desc': {
        const sa = a.currentSalary ?? null;
        const sb = b.currentSalary ?? null;
        if (sa == null && sb == null) return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        if (sa == null) return 1;   // unset → last
        if (sb == null) return -1;
        const diff = Number(sb) - Number(sa);
        return diff !== 0 ? diff : nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      case 'salary_asc': {
        const sa = a.currentSalary ?? null;
        const sb = b.currentSalary ?? null;
        if (sa == null && sb == null) return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        if (sa == null) return 1;   // unset → last
        if (sb == null) return -1;
        const diff = Number(sa) - Number(sb);
        return diff !== 0 ? diff : nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      case 'dept_asc': {
        const da = a.departmentName || 'zzz_none';   // nulls at bottom
        const db = b.departmentName || 'zzz_none';
        const cmp = da.localeCompare(db, undefined, { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      case 'dept_desc': {
        const da = a.departmentName || '';
        const db = b.departmentName || '';
        if (!da && !db) return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        if (!da) return 1;
        if (!db) return -1;
        const cmp = db.localeCompare(da, undefined, { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      case 'name_asc':
      default:
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    }
  }

  get roleCount(): { [k: string]: number } {
    const counts: { [k: string]: number } = { ALL: this.staffRows.length };
    for (const s of this.staffRows) {
      const key = s.roleName || '';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  // ─────────────────────────────────────────────
  // FORM — Add / Update salary
  // ─────────────────────────────────────────────
  openForm(target: StaffSalaryRow): void {
    this.formTarget = target;
    this.form = {
      baseSalary: target.currentSalary ?? null,
      effectiveDate: this.todayISO(),
      note: target.currentSalary == null ? 'Initial' : '',
    };
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.formTarget = null;
    this.formError = '';
  }

  saveForm(): void {
    this.formError = '';

    if (!this.formTarget) return;
    const salary = Number(this.form.baseSalary);
    if (!this.form.baseSalary || isNaN(salary) || salary < 0) {
      this.formError = 'Enter a valid salary amount';
      return;
    }
    if (!this.form.effectiveDate) {
      this.formError = 'Effective date is required';
      return;
    }

    this.saving = true;
    const payload = {
      userId: this.formTarget.userId,
      baseSalary: salary,
      effectiveDate: this.form.effectiveDate,
      note: this.form.note?.trim() || null,
    };

    this.http.post(SALARY_BASE, payload, { headers: this.headers })
      .pipe(catchError(err => {
        console.error('[save]', err);
        this.formError = err?.error?.message || 'Failed to save';
        this.saving = false;
        return of(null);
      }))
      .subscribe(res => {
        this.saving = false;
        if (res) {
          this.closeForm();
          this.loadAll();
        }
      });
  }

  // ─────────────────────────────────────────────
  // HISTORY MODAL
  // ─────────────────────────────────────────────
  openHistory(target: StaffSalaryRow): void {
    this.historyTarget = target;
    this.showHistory = true;
    this.historyItems = [];
    this.loadingHistory = true;

    this.http.get<HistoryItem[]>(`${SALARY_BASE}/history/${target.userId}`,
                                  { headers: this.headers })
      .pipe(catchError(err => { console.error('[hist]', err); return of([]); }))
      .subscribe(list => {
        this.historyItems = (list || []).map(h => ({
          ...h,
          baseSalary: Number(h.baseSalary),
        }));
        this.loadingHistory = false;
        this.cdr.detectChanges();
      });
  }

  closeHistory(): void {
    this.showHistory = false;
    this.historyTarget = null;
    this.historyItems = [];
  }

  // ─────────────────────────────────────────────
  // DELETE history item (correction only)
  // ─────────────────────────────────────────────
  confirmDeleteHistory(item: HistoryItem): void { this.deleteTarget = item; }
  cancelDelete(): void { this.deleteTarget = null; }

  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    const id = this.deleteTarget.id;
    this.http.delete(`${SALARY_BASE}/${id}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[del]', err); return of(null); }))
      .subscribe(() => {
        this.deleteTarget = null;
        // Reload history + staff list
        if (this.historyTarget) {
          this.openHistory(this.historyTarget);
        }
        this.loadAll();
      });
  }

  // ─────────────────────────────────────────────
  // FORMAT HELPERS
  // ─────────────────────────────────────────────
  formatMoney(n: number | null | undefined): string {
    if (n == null) return '—';
    const num = Number(n);
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatRelative(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days < 0) return 'upcoming';
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  currencyPrefix(cur: string | undefined): string {
    if (!cur || cur === 'USD') return '$';
    return '';
  }

  getAvatarColor(id: number): string {
    const colors = ['#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];
    return colors[id % colors.length];
  }

  getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  toTitleCase(s: string): string {
    if (!s) return '';
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Compare a salary change vs previous history */
  changeVsNext(index: number): { diff: number; percent: number } | null {
    if (index >= this.historyItems.length - 1) return null;
    const current = this.historyItems[index];
    const previous = this.historyItems[index + 1];
    const diff = current.baseSalary - previous.baseSalary;
    const percent = previous.baseSalary > 0
      ? (diff / previous.baseSalary) * 100
      : 0;
    return { diff, percent };
  }

  onBack(): void {
    this.back.emit();
  }
}
import { Component, OnInit, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const API_BASE    = 'http://localhost:8080/api';
const SALARY_BASE = `${API_BASE}/salary-structures`;

interface StaffSalaryRow {
  userId: number; name: string;
  roleName?: string; roleDisplayName?: string; roleColor?: string;
  departmentName?: string; branchId?: number; branchName?: string;
  currentId?: number | null; currentSalary?: number | null;
  currentEffectiveDate?: string | null; currentNote?: string | null;
  historyCount?: number; currency?: string;
}

interface HistoryItem {
  id: number; baseSalary: number; effectiveDate: string;
  note?: string; createdBy?: number; createdByName?: string; createdAt?: string;
}

interface Stats {
  totalStaff: number; withSalary: number; withoutSalary: number;
  avgSalary: number; totalMonthly: number; currency: string;
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

  Math = Math;

  staffRows: StaffSalaryRow[] = [];
  stats: Stats = { totalStaff: 0, withSalary: 0, withoutSalary: 0, avgSalary: 0, totalMonthly: 0, currency: 'USD' };
  loading = false;
  saving  = false;
  currentUser: any = null;

  searchQuery        = '';
  selectedRoleFilter = 'ALL';
  statusFilter: 'ALL' | 'SET' | 'UNSET' = 'ALL';
  sortBy: 'salary_desc' | 'salary_asc' | 'dept_asc' | 'dept_desc' | 'name_asc' = 'salary_desc';

  get sortOptions() {
    return [
      { key: 'salary_desc', label: `💰 ${this.lbl('Salary Structures')}: High → Low` },
      { key: 'salary_asc',  label: `💰 ${this.lbl('Salary Structures')}: Low → High` },
      { key: 'dept_asc',    label: `🏢 ${this.lbl('DEPARTMENT')}: A → Z` },
      { key: 'dept_desc',   label: `🏢 ${this.lbl('DEPARTMENT')}: Z → A` },
      { key: 'name_asc',    label: `📝 ${this.lbl('NAME')}: A → Z` },
    ];
  }

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

  showForm    = false;
  formTarget: StaffSalaryRow | null = null;
  form = { baseSalary: null as number | null, effectiveDate: this.todayISO(), note: '' };
  formError   = '';

  showHistory    = false;
  historyTarget: StaffSalaryRow | null = null;
  historyItems:  HistoryItem[] = [];
  loadingHistory = false;

  deleteTarget: HistoryItem | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ── i18n ──────────────────────────────────
  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage || this.auth.getUser()?.preferredLanguage, key);
  }

  ngOnInit(): void { this.currentUser = this.auth.getUser(); this.loadAll(); }

  private get headers() { return this.auth.getHeaders(); }

  private todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  loadAll(): void { this.loadStaff(); this.loadStats(); }

  loadStaff(): void {
    this.loading = true;
    this.http.get<StaffSalaryRow[]>(`${SALARY_BASE}/staff-list`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[staff]', err); return of([]); }))
      .subscribe(list => {
        this.staffRows = (list || []).map(r => ({ ...r, currentSalary: r.currentSalary == null ? null : Number(r.currentSalary) }));
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  loadStats(): void {
    this.http.get<Stats>(`${SALARY_BASE}/stats`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[stats]', err); return of(null); }))
      .subscribe(s => {
        if (s) { this.stats = { ...s, avgSalary: Number(s.avgSalary)||0, totalMonthly: Number(s.totalMonthly)||0 }; this.cdr.detectChanges(); }
      });
  }

  get userRoleName(): string { return this.currentUser?.role || this.currentUser?.roleName || ''; }
  get isGlobalAdmin(): boolean { const r = this.userRoleName; return r==='BOSS'||r==='COUNTRY_DIRECTOR'; }
  get canEdit(): boolean { const r = this.userRoleName; return r==='BOSS'||r==='COUNTRY_DIRECTOR'||r==='ADMIN'; }

  setRoleFilter(key: string): void { this.selectedRoleFilter = key; }
  setStatusFilter(s: 'ALL'|'SET'|'UNSET'): void { this.statusFilter = s; }
  toggleSortMenu(): void { this.showSortMenu = !this.showSortMenu; }
  setSort(key: string): void { this.sortBy = key as typeof this.sortBy; this.showSortMenu = false; }

  get currentSortLabel(): string {
    return this.sortOptions.find(o => o.key === this.sortBy)?.label || this.lbl('Sort by');
  }

  get filteredRows(): StaffSalaryRow[] {
    let list = [...this.staffRows];
    if (this.selectedRoleFilter !== 'ALL') list = list.filter(s => s.roleName === this.selectedRoleFilter);
    if (this.statusFilter === 'SET')   list = list.filter(s => s.currentSalary != null);
    if (this.statusFilter === 'UNSET') list = list.filter(s => s.currentSalary == null);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.departmentName?.toLowerCase().includes(q) || s.roleDisplayName?.toLowerCase().includes(q));
    }
    list.sort((a, b) => this.compareRows(a, b));
    return list;
  }

  private compareRows(a: StaffSalaryRow, b: StaffSalaryRow): number {
    const nameA = a.name||'', nameB = b.name||'';
    switch (this.sortBy) {
      case 'salary_desc': { const sa=a.currentSalary??null,sb=b.currentSalary??null; if(sa==null&&sb==null)return nameA.localeCompare(nameB); if(sa==null)return 1; if(sb==null)return-1; const d=Number(sb)-Number(sa); return d!==0?d:nameA.localeCompare(nameB); }
      case 'salary_asc':  { const sa=a.currentSalary??null,sb=b.currentSalary??null; if(sa==null&&sb==null)return nameA.localeCompare(nameB); if(sa==null)return 1; if(sb==null)return-1; const d=Number(sa)-Number(sb); return d!==0?d:nameA.localeCompare(nameB); }
      case 'dept_asc':    { const da=a.departmentName||'zzz',db=b.departmentName||'zzz'; const c=da.localeCompare(db); return c!==0?c:nameA.localeCompare(nameB); }
      case 'dept_desc':   { const da=a.departmentName||'',db=b.departmentName||''; if(!da&&!db)return nameA.localeCompare(nameB); if(!da)return 1; if(!db)return-1; const c=db.localeCompare(da); return c!==0?c:nameA.localeCompare(nameB); }
      default: return nameA.localeCompare(nameB);
    }
  }

  get roleCount(): { [k: string]: number } {
    const c: { [k: string]: number } = { ALL: this.staffRows.length };
    for (const s of this.staffRows) { const k=s.roleName||''; c[k]=(c[k]||0)+1; }
    return c;
  }

  openForm(target: StaffSalaryRow): void {
    this.formTarget = target;
    this.form = { baseSalary: target.currentSalary??null, effectiveDate: this.todayISO(), note: target.currentSalary==null?'Initial':'' };
    this.formError = '';
    this.showForm  = true;
  }

  closeForm(): void { this.showForm=false; this.formTarget=null; this.formError=''; }

  saveForm(): void {
    this.formError = '';
    if (!this.formTarget) return;
    const salary = Number(this.form.baseSalary);
    if (!this.form.baseSalary||isNaN(salary)||salary<0) { this.formError='Enter a valid salary amount'; return; }
    if (!this.form.effectiveDate) { this.formError='Effective date is required'; return; }
    this.saving = true;
    this.http.post(SALARY_BASE, { userId: this.formTarget.userId, baseSalary: salary, effectiveDate: this.form.effectiveDate, note: this.form.note?.trim()||null }, { headers: this.headers })
      .pipe(catchError(err => { this.formError=err?.error?.message||'Failed to save'; this.saving=false; return of(null); }))
      .subscribe(res => { this.saving=false; if(res){this.closeForm();this.loadAll();} });
  }

  openHistory(target: StaffSalaryRow): void {
    this.historyTarget=target; this.showHistory=true; this.historyItems=[]; this.loadingHistory=true;
    this.http.get<HistoryItem[]>(`${SALARY_BASE}/history/${target.userId}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[hist]',err); return of([]); }))
      .subscribe(list => { this.historyItems=(list||[]).map(h=>({...h,baseSalary:Number(h.baseSalary)})); this.loadingHistory=false; this.cdr.detectChanges(); });
  }

  closeHistory(): void { this.showHistory=false; this.historyTarget=null; this.historyItems=[]; }

  confirmDeleteHistory(item: HistoryItem): void { this.deleteTarget=item; }
  cancelDelete(): void { this.deleteTarget=null; }

  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    this.http.delete(`${SALARY_BASE}/${this.deleteTarget.id}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[del]',err); return of(null); }))
      .subscribe(() => { this.deleteTarget=null; if(this.historyTarget)this.openHistory(this.historyTarget); this.loadAll(); });
  }

  changeVsNext(i: number): { diff: number; percent: number } | null {
    if (i >= this.historyItems.length-1) return null;
    const curr = this.historyItems[i].baseSalary;
    const prev = this.historyItems[i+1].baseSalary;
    if (!prev) return null;
    const diff = curr - prev;
    return { diff, percent: (diff/prev)*100 };
  }

  getAvatarColor(id: number): string {
    const c=['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2'];
    return c[id%c.length];
  }
  getInitial(name: string): string { return name?name.charAt(0).toUpperCase():'?'; }
  toTitleCase(s: string): string { return s?s.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' '):''; }
  currencyPrefix(c?: string|null): string { return c==='USD'?'$':c==='JPY'?'¥':c==='KHR'?'₭':c||''; }

  formatMoney(n: number|null|undefined): string {
    if (n==null||isNaN(Number(n))) return '0';
    return Number(n).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDate(d: string|null|undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en', { year:'numeric', month:'short', day:'numeric' });
  }

  formatRelative(d: string|null|undefined): string {
    if (!d) return '';
    const ms  = Date.now() - new Date(d).getTime();
    const days = Math.floor(ms/86400000);
    if (days===0) return 'today';
    if (days===1) return '1 day ago';
    if (days<30)  return `${days} days ago`;
    const months = Math.floor(days/30);
    if (months<12) return months===1?'1 month ago':`${months} months ago`;
    const years = Math.floor(months/12);
    return years===1?'1 year ago':`${years} years ago`;
  }
}
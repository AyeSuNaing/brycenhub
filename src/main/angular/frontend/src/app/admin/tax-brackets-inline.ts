import { Component, OnInit, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

const API_BASE     = 'http://localhost:8080/api';
const TAX_BASE     = `${API_BASE}/tax-brackets`;
const BRANCHES_BASE = `${API_BASE}/branches`;
const COUNTRIES_BASE = `${API_BASE}/countries`;
const USERS_BASE   = `${API_BASE}/users`;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TaxBracket {
  id?: number;
  countryId?: number;
  minSalary: number;
  maxSalary: number | null;
  taxRate: number;
  createdAt?: string;
}

interface CountryInfo {
  id: number;
  code: string;
  name: string;
  currency?: string;
  flagEmoji?: string;
}

interface CalcBreakdown {
  from: number;
  to: number | null;
  rate: number;
  taxableAmount: number;
  taxForBracket: number;
}

interface CalcResponse {
  salary: number;
  totalTax: number;
  effectiveRate: number;
  netSalary: number;
  breakdown: CalcBreakdown[];
}

interface StaffItem {
  id: number;
  name: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
}

@Component({
  selector: 'app-tax-brackets-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tax-brackets-inline.html',
  styleUrls: ['./tax-brackets-inline.scss'],
})
export class TaxBracketsInline implements OnInit {
  @Output() back = new EventEmitter<void>();

  // ── State ─────────────────────────────────
  currentUser: any = null;
  country: CountryInfo | null = null;
  viewingCountry: CountryInfo | null = null;
  allCountries: CountryInfo[] = [];
  showCountryMenu = false;

  brackets: TaxBracket[] = [];
  loading = false;
  saving = false;

  // Form
  showForm = false;
  editMode = false;
  form: Partial<TaxBracket> = { minSalary: 0, maxSalary: null, taxRate: 0 };
  formError = '';

  // Delete
  deleteTarget: TaxBracket | null = null;

  // Calculator
  calcSalary: number = 4000;
  calcResult: CalcResponse | null = null;
  calculating = false;

  // Staff panel
  staffList: StaffItem[] = [];
  staffSearchQuery = '';
  selectedRoleFilter = 'ALL';
  loadingStaff = false;

  roleFilters = [
    { key: 'ALL',             label: 'All',    color: '#94a3b8' },
    { key: 'PROJECT_MANAGER', label: 'PM',     color: '#22c55e' },
    { key: 'LEADER',          label: 'Leader', color: '#06b6d4' },
    { key: 'DEVELOPER',       label: 'Dev',    color: '#6366f1' },
    { key: 'DATA_ENGINEER',   label: 'Data',   color: '#06b6d4' },
    { key: 'ADMIN',           label: 'Admin',  color: '#ec4899' },
    { key: 'VP',              label: 'VP',     color: '#ef4444' },
  ];

  // Country preset presets (USD-based for simplicity)
  // Source: Official brackets (see user-provided Cambodia image)
  presets: { [code: string]: { minSalary: number; maxSalary: number | null; taxRate: number }[] } = {
    // 🇰🇭 Cambodia — USD (Riel ÷ 4100 ≈ rounded to nearest $25)
    KH: [
      { minSalary:    0, maxSalary:   325, taxRate:  0 },
      { minSalary:  325, maxSalary:   500, taxRate:  5 },
      { minSalary:  500, maxSalary:  2125, taxRate: 10 },
      { minSalary: 2125, maxSalary:  3125, taxRate: 15 },
      { minSalary: 3125, maxSalary:  null, taxRate: 20 },
    ],
    // 🇲🇲 Myanmar — MMK
    MM: [
      { minSalary:        0, maxSalary:  2000000, taxRate:  0 },
      { minSalary:  2000000, maxSalary:  5000000, taxRate:  5 },
      { minSalary:  5000000, maxSalary: 10000000, taxRate: 10 },
      { minSalary: 10000000, maxSalary: 20000000, taxRate: 15 },
      { minSalary: 20000000, maxSalary: 30000000, taxRate: 20 },
      { minSalary: 30000000, maxSalary: 50000000, taxRate: 25 },
      { minSalary: 50000000, maxSalary:     null, taxRate: 25 },
    ],
    // 🇯🇵 Japan — JPY (simplified annual → monthly approx ÷12)
    JP: [
      { minSalary:       0, maxSalary:   162500, taxRate:  5 },
      { minSalary:  162500, maxSalary:   275000, taxRate: 10 },
      { minSalary:  275000, maxSalary:   575000, taxRate: 20 },
      { minSalary:  575000, maxSalary:   750000, taxRate: 23 },
      { minSalary:  750000, maxSalary:  1500000, taxRate: 33 },
      { minSalary: 1500000, maxSalary:  3333333, taxRate: 40 },
      { minSalary: 3333333, maxSalary:     null, taxRate: 45 },
    ],
    // 🇻🇳 Vietnam — VND
    VN: [
      { minSalary:         0, maxSalary:    5000000, taxRate:  5 },
      { minSalary:   5000000, maxSalary:   10000000, taxRate: 10 },
      { minSalary:  10000000, maxSalary:   18000000, taxRate: 15 },
      { minSalary:  18000000, maxSalary:   32000000, taxRate: 20 },
      { minSalary:  32000000, maxSalary:   52000000, taxRate: 25 },
      { minSalary:  52000000, maxSalary:   80000000, taxRate: 30 },
      { minSalary:  80000000, maxSalary:       null, taxRate: 35 },
    ],
    // 🇰🇷 Korea — KRW (annual → monthly approx)
    KR: [
      { minSalary:        0, maxSalary:  1166667, taxRate:  6 },
      { minSalary:  1166667, maxSalary:  4000000, taxRate: 15 },
      { minSalary:  4000000, maxSalary:  7333333, taxRate: 24 },
      { minSalary:  7333333, maxSalary: 12500000, taxRate: 35 },
      { minSalary: 12500000, maxSalary: 25000000, taxRate: 38 },
      { minSalary: 25000000, maxSalary: 41666667, taxRate: 40 },
      { minSalary: 41666667, maxSalary:     null, taxRate: 42 },
    ],
    // 🇺🇸 USA — USD (federal annual → monthly approx single filer 2026)
    US: [
      { minSalary:     0, maxSalary:   970, taxRate: 10 },
      { minSalary:   970, maxSalary:  3946, taxRate: 12 },
      { minSalary:  3946, maxSalary:  8410, taxRate: 22 },
      { minSalary:  8410, maxSalary: 16083, taxRate: 24 },
      { minSalary: 16083, maxSalary: 20417, taxRate: 32 },
      { minSalary: 20417, maxSalary: 51042, taxRate: 35 },
      { minSalary: 51042, maxSalary:  null, taxRate: 37 },
    ],
  };

  // Flag fallback
  flagFallback: { [code: string]: string } = {
    JP: '🇯🇵', MM: '🇲🇲', KH: '🇰🇭', VN: '🇻🇳', KR: '🇰🇷', US: '🇺🇸',
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadAllCountries();
    this.resolveCountryThenLoad();
    this.loadStaff();
  }

  private get headers() {
    return this.auth.getHeaders();
  }

  // ─────────────────────────────────────────────
  // COUNTRIES
  // ─────────────────────────────────────────────
  private loadAllCountries(): void {
    this.http.get<CountryInfo[]>(COUNTRIES_BASE, { headers: this.headers })
      .pipe(catchError(err => { console.error('[countries]', err); return of([]); }))
      .subscribe(list => {
        this.allCountries = list || [];
        this.cdr.detectChanges();
      });
  }

  private resolveCountryThenLoad(): void {
    const branchId = this.currentUser?.branchId;
    if (!branchId) {
      this.loadBrackets();
      return;
    }

    this.http.get<any>(`${BRANCHES_BASE}/${branchId}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[branch]', err); return of(null); }))
      .subscribe(branch => {
        if (!branch?.countryId) {
          this.loadBrackets();
          return;
        }

        this.http.get<CountryInfo>(`${COUNTRIES_BASE}/${branch.countryId}`, { headers: this.headers })
          .pipe(catchError(err => { console.error('[country]', err); return of(null); }))
          .subscribe(country => {
            this.country = country;
            this.viewingCountry = country;
            this.loadBrackets();
          });
      });
  }

  toggleCountryMenu(): void { this.showCountryMenu = !this.showCountryMenu; }

  selectCountry(c: CountryInfo): void {
    this.viewingCountry = c;
    this.showCountryMenu = false;
    this.calcResult = null;
    this.loadBrackets();
  }

  get isViewingOwnCountry(): boolean {
    if (!this.country || !this.viewingCountry) return true;
    return this.country.id === this.viewingCountry.id;
  }

  get userRoleName(): string {
    if (!this.currentUser) return '';
    return this.currentUser.role || this.currentUser.roleName || '';
  }

  get isGlobalAdmin(): boolean {
    const r = this.userRoleName;
    return r === 'BOSS' || r === 'COUNTRY_DIRECTOR';
  }

  get canEdit(): boolean {
    if (!this.viewingCountry) return false;
    if (this.isGlobalAdmin) return true;
    return this.isViewingOwnCountry;
  }

  get countryFlag(): string {
    const c = this.viewingCountry;
    if (!c) return '🌍';
    return c.flagEmoji || this.flagFallback[c.code] || '🌍';
  }

  get countryName(): string {
    return this.viewingCountry?.name || 'Global';
  }

  get currency(): string {
    return this.viewingCountry?.currency || 'USD';
  }

  getFlagFor(c: CountryInfo): string {
    return c.flagEmoji || this.flagFallback[c.code] || '🌍';
  }

  get hasPresetForCountry(): boolean {
    return !!this.viewingCountry?.code && !!this.presets[this.viewingCountry.code];
  }

  get seedButtonLabel(): string {
    if (!this.viewingCountry) return 'No preset';
    return `${this.countryFlag} Seed ${this.countryName}`;
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  /** Expose Math to template */
  Math = Math;

  get statsTotal(): number {
    return this.brackets.length;
  }

  get statsHighestRate(): number {
    if (!this.brackets.length) return 0;
    return Math.max(...this.brackets.map(b => +b.taxRate));
  }

  get statsTaxFreeLimit(): number {
    const firstNonZero = this.brackets.find(b => +b.taxRate > 0);
    if (firstNonZero) return +firstNonZero.minSalary;
    return 0;
  }

  // ─────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────
  loadBrackets(): void {
    this.loading = true;
    const countryId = this.viewingCountry?.id;
    const url = countryId
      ? `${TAX_BASE}/by-country/${countryId}`
      : TAX_BASE;

    this.http.get<TaxBracket[]>(url, { headers: this.headers })
      .pipe(catchError(err => { console.error('[tax]', err); return of([]); }))
      .subscribe(list => {
        this.brackets = (list || []).map(b => ({
          ...b,
          minSalary: +b.minSalary,
          maxSalary: b.maxSalary == null ? null : +b.maxSalary,
          taxRate: +b.taxRate,
        }));
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  // ─────────────────────────────────────────────
  // CREATE / EDIT
  // ─────────────────────────────────────────────
  openCreateForm(): void {
    // Prefill: start min from last bracket's max
    const last = this.brackets[this.brackets.length - 1];
    const startMin = last?.maxSalary ?? 0;
    this.form = { minSalary: startMin, maxSalary: null, taxRate: 0 };
    this.editMode = false;
    this.showForm = true;
    this.formError = '';
  }

  openEditForm(b: TaxBracket): void {
    this.form = { ...b };
    this.editMode = true;
    this.showForm = true;
    this.formError = '';
  }

  closeForm(): void {
    this.showForm = false;
    this.formError = '';
  }

  saveForm(): void {
    this.formError = '';

    const min = Number(this.form.minSalary ?? 0);
    const max = this.form.maxSalary == null || this.form.maxSalary === ('' as any)
      ? null : Number(this.form.maxSalary);
    const rate = Number(this.form.taxRate ?? 0);

    if (isNaN(min) || min < 0) { this.formError = 'Invalid min salary'; return; }
    if (max != null && (isNaN(max) || max <= min)) {
      this.formError = 'max_salary must be greater than min_salary (or leave empty for unlimited)';
      return;
    }
    if (isNaN(rate) || rate < 0 || rate > 100) {
      this.formError = 'Tax rate must be between 0 and 100';
      return;
    }

    const payload: any = {
      minSalary: min,
      maxSalary: max,
      taxRate: rate,
    };
    if (!this.editMode && this.viewingCountry?.id) {
      payload.countryId = this.viewingCountry.id;
    }

    this.saving = true;
    const request$ = this.editMode && this.form.id
      ? this.http.put<TaxBracket>(`${TAX_BASE}/${this.form.id}`, payload, { headers: this.headers })
      : this.http.post<TaxBracket>(TAX_BASE, payload, { headers: this.headers });

    request$.pipe(catchError(err => {
      console.error('[save]', err);
      this.formError = err?.error?.message || 'Failed to save';
      this.saving = false;
      return of(null);
    })).subscribe(res => {
      this.saving = false;
      if (res) {
        this.closeForm();
        this.loadBrackets();
      }
    });
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────
  confirmDelete(b: TaxBracket): void { this.deleteTarget = b; }
  cancelDelete(): void { this.deleteTarget = null; }

  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    const id = this.deleteTarget.id;
    this.http.delete(`${TAX_BASE}/${id}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[del]', err); return of(null); }))
      .subscribe(() => {
        this.deleteTarget = null;
        this.loadBrackets();
      });
  }

  // ─────────────────────────────────────────────
  // SEED (bulk replace)
  // ─────────────────────────────────────────────
  seedCountryPreset(): void {
    if (!this.viewingCountry || !this.hasPresetForCountry) {
      alert('No preset available');
      return;
    }
    const preset = this.presets[this.viewingCountry.code];

    if (!confirm(
      `Seed ${preset.length} tax brackets for ${this.countryName}?\n\n` +
      `⚠️ This will REPLACE all existing brackets for this country.`
    )) return;

    this.saving = true;
    const payload = {
      countryId: this.viewingCountry.id,
      brackets: preset,
    };

    this.http.post<any>(`${TAX_BASE}/bulk`, payload, { headers: this.headers })
      .pipe(catchError(err => {
        console.error('[bulk]', err);
        alert('Seed failed: ' + (err?.error?.message || 'Unknown error'));
        this.saving = false;
        return of(null);
      }))
      .subscribe(res => {
        this.saving = false;
        if (res) {
          alert(res.message || `Seeded ${res.created} brackets`);
          this.loadBrackets();
        }
      });
  }

  // ─────────────────────────────────────────────
  // CALCULATOR
  // ─────────────────────────────────────────────
  runCalculator(): void {
    if (!this.viewingCountry) return;
    const salary = Number(this.calcSalary);
    if (isNaN(salary) || salary < 0) {
      alert('Enter a valid salary');
      return;
    }

    this.calculating = true;
    const payload = { countryId: this.viewingCountry.id, salary };

    this.http.post<CalcResponse>(`${TAX_BASE}/calculate`, payload, { headers: this.headers })
      .pipe(catchError(err => {
        console.error('[calc]', err);
        alert('Calculation failed: ' + (err?.error?.message || 'Configure brackets first'));
        this.calculating = false;
        return of(null);
      }))
      .subscribe(res => {
        this.calculating = false;
        this.calcResult = res;
        this.cdr.detectChanges();
      });
  }

  clearCalc(): void { this.calcResult = null; }

  // ─────────────────────────────────────────────
  // FORMAT HELPERS
  // ─────────────────────────────────────────────
  formatMoney(n: number | null | undefined): string {
    if (n == null) return '—';
    const num = Number(n);
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  tierLabel(index: number, total: number, taxRate: number): string {
    if (taxRate === 0) return 'Tax-free';
    if (index === total - 1) return 'Highest';
    return `Tier ${index + 1}`;
  }

  tierColorFor(taxRate: number): string {
    if (taxRate === 0)   return '#22c55e';
    if (taxRate <= 10)   return '#84cc16';
    if (taxRate <= 20)   return '#eab308';
    if (taxRate <= 30)   return '#f97316';
    return '#ef4444';
  }

  // ─────────────────────────────────────────────
  // STAFF PANEL (same pattern as holidays)
  // ─────────────────────────────────────────────
  loadStaff(): void {
    this.loadingStaff = true;
    this.http.get<any[]>(`${USERS_BASE}/staff-list`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[staff]', err); return of([]); }))
      .subscribe(list => {
        this.staffList = (list || []).map(s => ({
          id: s.id || s.userId,
          name: s.name,
          roleDisplayName: s.roleDisplayName || s.roleName,
          roleColor: s.roleColor,
          departmentName: s.departmentName,
        }));
        this.loadingStaff = false;
        this.cdr.detectChanges();
      });
  }

  setRoleFilter(key: string): void { this.selectedRoleFilter = key; }

  get filteredStaff(): StaffItem[] {
    let list = this.staffList;
    if (this.selectedRoleFilter !== 'ALL') {
      list = list.filter(s => (s.roleDisplayName || '').toUpperCase().replace(/\s/g, '_') === this.selectedRoleFilter
                          || (s as any).role === this.selectedRoleFilter);
    }
    if (this.staffSearchQuery.trim()) {
      const q = this.staffSearchQuery.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q));
    }
    return list;
  }

  get staffCountByRole(): { [k: string]: number } {
    const counts: { [k: string]: number } = { ALL: this.staffList.length };
    for (const s of this.staffList) {
      const key = (s.roleDisplayName || '').toUpperCase().replace(/\s/g, '_');
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
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

  onBack(): void {
    this.back.emit();
  }
}

import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;
const PAYROLL_BASE = `${BASE}/payroll`;

// ═══════════════════════════════════════════════════════════
// Types — mirror of PayrollDto (Java)
// ═══════════════════════════════════════════════════════════
interface PreviewRow {
  userId: number;
  userName: string;
  email: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  workingDays: number;
  actualDays: number;
  dailyRate: number;
  earnedSalary: number;
  otAmount: number;
  deductions: number;
  bonuses: number;
  grossSalary: number;
  taxAmount: number;
  netSalary: number;
  currency: string;
  warning: 'NONE' | 'MISSING_SALARY' | 'NO_ATTENDANCE' | 'NO_WORKING_DAYS' | 'ALREADY_SAVED';
  warningMessage?: string;
  existsInDb: boolean;
  currentStatus?: string;
  // UI-only
  selected?: boolean;
}

interface PreviewResponse {
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  branchId: number;
  branchName: string;
  currency: string;
  totalStaff: number;
  calculableStaff: number;
  warningStaff: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  rows: PreviewRow[];
}

interface SaveResponse {
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  skippedReasons: string[];
  savedAt: string;
}

@Component({
  selector: 'app-payroll-wizard-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payroll-wizard-inline.html',
  styleUrls: ['./payroll-wizard-inline.scss'],
  host: { style: 'display:contents' }
})
export class PayrollWizardInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  // ── Wizard state ────────────────────────────
  step: 1 | 2 | 3 = 1;
  // 1 = Period select + Calculate
  // 2 = Preview + Save
  // 3 = Done

  // ── Inputs ──────────────────────────────────
  branchId: number = 0;
  branchName = '';
  payPeriod = '';           // "YYYY-MM"
  periodOptions: { value: string; label: string }[] = [];

  // ── Loading ─────────────────────────────────
  isCalculating = false;
  isSaving = false;
  errorMsg = '';

  // ── Response ────────────────────────────────
  preview: PreviewResponse | null = null;
  saveResult: SaveResponse | null = null;

  // ── Filters ─────────────────────────────────
  searchQuery = '';
  filterStatus: 'ALL' | 'CALCULABLE' | 'WARNING' = 'ALL';

  // ── Current user ────────────────────────────
  currentUser: any = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.currentUser = this.auth.getUser();
    this.branchId    = this.currentUser?.branchId ?? 0;
    this.branchName  = this.currentUser?.branchName ?? '';
    this.buildPeriodOptions();
    // Default = last month (since pay cycle is 25th~24th, current period often not ready yet)
    this.payPeriod = this.periodOptions[0]?.value ?? '';
  }

  // ═══════════════════════════════════════════════════════════
  // Period dropdown — last 6 months
  // ═══════════════════════════════════════════════════════════
  private buildPeriodOptions() {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const value = `${y}-${m.toString().padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      // Sub-label = pay period span
      const startDate = new Date(y, m - 2, 25);
      const endDate   = new Date(y, m - 1, 24);
      const fmt = (x: Date) => x.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      opts.push({ value, label: `${label} (${fmt(startDate)} – ${fmt(endDate)})` });
    }
    this.periodOptions = opts;
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 1 → STEP 2: Calculate preview
  // ═══════════════════════════════════════════════════════════
  calculate() {
    if (!this.branchId || !this.payPeriod) {
      this.errorMsg = 'Branch and pay period are required.';
      return;
    }
    this.isCalculating = true;
    this.errorMsg = '';
    this.preview = null;
    this.cdr.detectChanges();

    this.http.post<PreviewResponse>(
      `${PAYROLL_BASE}/preview`,
      { branchId: this.branchId, payPeriod: this.payPeriod },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: data => {
        // Sort: WARNINGS FIRST (admin attention), then by userId
        data.rows.sort((a, b) => {
          if (a.warning === 'NONE' && b.warning !== 'NONE') return 1;
          if (a.warning !== 'NONE' && b.warning === 'NONE') return -1;
          return a.userId - b.userId;
        });
        // Pre-select calculable rows
        data.rows.forEach(r => { r.selected = r.warning === 'NONE'; });
        this.preview = data;
        this.isCalculating = false;
        this.step = 2;
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorMsg = err.error?.message || 'Failed to calculate payroll.';
        this.isCalculating = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Filters & selection
  // ═══════════════════════════════════════════════════════════
  get visibleRows(): PreviewRow[] {
    if (!this.preview) return [];
    const q = this.searchQuery.trim().toLowerCase();
    return this.preview.rows.filter(r => {
      // Status filter
      if (this.filterStatus === 'CALCULABLE' && r.warning !== 'NONE') return false;
      if (this.filterStatus === 'WARNING'    && r.warning === 'NONE') return false;
      // Search filter
      if (!q) return true;
      return (r.userName || '').toLowerCase().includes(q)
          || (r.email    || '').toLowerCase().includes(q)
          || (r.departmentName || '').toLowerCase().includes(q)
          || (r.roleDisplayName || '').toLowerCase().includes(q);
    });
  }

  get selectedCount(): number {
    if (!this.preview) return 0;
    return this.preview.rows.filter(r => r.selected && r.warning === 'NONE').length;
  }

  get allVisibleSelected(): boolean {
    const rows = this.visibleRows.filter(r => r.warning === 'NONE');
    return rows.length > 0 && rows.every(r => r.selected);
  }

  toggleAllVisible() {
    const targetVal = !this.allVisibleSelected;
    this.visibleRows
      .filter(r => r.warning === 'NONE')
      .forEach(r => r.selected = targetVal);
    this.cdr.detectChanges();
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2 → STEP 3: Save
  // ═══════════════════════════════════════════════════════════
  save() {
    if (!this.preview) return;
    const selectedIds = this.preview.rows
      .filter(r => r.selected && r.warning === 'NONE')
      .map(r => r.userId);
    if (selectedIds.length === 0) {
      this.errorMsg = 'Select at least one row to save.';
      return;
    }

    this.isSaving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.post<SaveResponse>(
      `${PAYROLL_BASE}/save`,
      {
        branchId: this.branchId,
        payPeriod: this.payPeriod,
        userIds: selectedIds,
        initialStatus: 'DRAFT',
      },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: data => {
        this.saveResult = data;
        this.isSaving = false;
        this.step = 3;
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorMsg = err.error?.message || 'Failed to save payroll.';
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Navigation helpers
  // ═══════════════════════════════════════════════════════════
  backToStep1() {
    this.step = 1;
    this.preview = null;
    this.saveResult = null;
    this.errorMsg = '';
    this.searchQuery = '';
    this.filterStatus = 'ALL';
  }

  calculateAnother() {
    this.backToStep1();
  }

  closeToDashboard() {
    this.back.emit();
  }

  // ═══════════════════════════════════════════════════════════
  // UI helpers
  // ═══════════════════════════════════════════════════════════
  currencyPrefix(code?: string): string {
    if (!code) return '$';
    const map: Record<string, string> = {
      USD: '$', JPY: '¥', KHR: '៛', MMK: 'K',
      VND: '₫', KRW: '₩',
    };
    return map[code] || code + ' ';
  }

  formatMoney(v: number | null | undefined): string {
    if (v == null || isNaN(Number(v))) return '0.00';
    return Number(v).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  warningBadgeClass(w: string): string {
    switch (w) {
      case 'NONE':            return 'badge-ok';
      case 'ALREADY_SAVED':   return 'badge-info';
      case 'NO_ATTENDANCE':   return 'badge-warn';
      case 'MISSING_SALARY':  return 'badge-err';
      case 'NO_WORKING_DAYS': return 'badge-err';
      default:                return 'badge-muted';
    }
  }

  warningLabel(w: string): string {
    switch (w) {
      case 'NONE':            return 'Ready';
      case 'ALREADY_SAVED':   return 'Already saved';
      case 'NO_ATTENDANCE':   return 'No attendance';
      case 'MISSING_SALARY':  return 'No salary set';
      case 'NO_WORKING_DAYS': return 'Zero working days';
      default:                return w;
    }
  }

  getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
                    '#10b981', '#06b6d4', '#3b82f6', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}

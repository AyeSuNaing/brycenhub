import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { PayslipModalComponent } from '../shared/payslip-modal.component';
import { RefreshService } from '../services/refresh.service';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;
const PAYROLL_BASE = `${BASE}/payroll`;

interface HistoryRow {
  id: number; userId: number; userName: string;
  roleDisplayName?: string; roleColor?: string; departmentName?: string;
  payPeriod: string; periodStart: string; periodEnd: string;
  grossSalary: number; taxAmount: number; netSalary: number; currency: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'PAID';
  paidAt?: string; branchId: number; branchName: string;
}

interface HistoryResponse {
  availablePeriods: string[]; selectedPeriod: string; currency: string;
  totalRecords: number; draftCount: number; hrReviewedCount: number;
  confirmedCount: number; paidCount: number;
  totalGross: number; totalTax: number; totalNet: number;
  rows: HistoryRow[];
}

interface BatchStatus {
  branchId: number; payPeriod: string; dominantStatus: string;
  draftCount: number; pendingCount: number; confirmedCount: number; paidCount: number;
  lastRejectReason?: string; canSubmit: boolean; canApprove: boolean;
  canReject: boolean; canMarkPaid: boolean;
}

@Component({
  selector: 'app-payroll-history-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, PayslipModalComponent],
  templateUrl: './payroll-history-inline.html',
  styleUrls: ['./payroll-history-inline.scss'],
  host: { style: 'display:contents' }
})
export class PayrollHistoryInline implements OnInit {
  @Output() back = new EventEmitter<void>();

  data: HistoryResponse | null = null;
  batchStatus: BatchStatus | null = null;
  loading = false; errorMsg = '';
  selectedPeriod = ''; branchId = 0;
  searchQuery = '';
  statusFilter: 'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'PAID' = 'ALL';
  modalOpen = false; selectedRecordId: number | null = null;
  actionDialog: 'submit' | 'paid' | null = null;
  actionNote = ''; actionLoading = false;
  currentUser: any = null; currentRole = '';

  // ── i18n ──────────────────────────────────
  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage || this.auth.getUser()?.preferredLanguage, key);
  }

  constructor(
    private http: HttpClient, private auth: AuthService,
    private cdr: ChangeDetectorRef, private refreshService: RefreshService,
  ) {}

  ngOnInit() {
    this.currentUser = this.auth.getUser();
    this.currentRole = (this.currentUser?.role || '').toUpperCase();
    this.branchId = this.currentUser?.branchId || 0;
    this.load();
  }

  load(payPeriod?: string) {
    this.loading = true; this.errorMsg = ''; this.cdr.detectChanges();
    const params: string[] = [];
    if (this.branchId) params.push(`branchId=${this.branchId}`);
    if (payPeriod)     params.push(`payPeriod=${payPeriod}`);
    const qs = params.length ? '?' + params.join('&') : '';

    this.http.get<HistoryResponse>(`${PAYROLL_BASE}/history${qs}`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: d => { this.data = d; this.selectedPeriod = d.selectedPeriod || ''; this.loading = false; if (this.selectedPeriod) this.loadBatchStatus(); this.cdr.detectChanges(); },
        error: err => { this.errorMsg = err.error?.message || 'Failed to load history'; this.loading = false; this.cdr.detectChanges(); }
      });
  }

  loadBatchStatus() {
    if (!this.branchId || !this.selectedPeriod) return;
    this.http.get<BatchStatus>(`${PAYROLL_BASE}/batch-status?branchId=${this.branchId}&payPeriod=${this.selectedPeriod}`,
      { headers: this.auth.getHeaders() })
      .subscribe({ next: d => { this.batchStatus = d; this.cdr.detectChanges(); }, error: () => {} });
  }

  // ── original method signatures (no arg) ──
  onPeriodChange() { if (this.selectedPeriod) this.load(this.selectedPeriod); }

  openActionDialog(kind: 'submit' | 'paid') { this.actionDialog = kind; this.actionNote = ''; this.cdr.detectChanges(); }
  closeActionDialog() { this.actionDialog = null; this.actionNote = ''; this.cdr.detectChanges(); }

  doBatchAction() {
    if (!this.actionDialog || !this.batchStatus) return;
    const url = this.actionDialog === 'submit' ? `${PAYROLL_BASE}/batch/submit` : `${PAYROLL_BASE}/batch/mark-paid`;
    this.actionLoading = true; this.errorMsg = ''; this.cdr.detectChanges();

    this.http.post<any>(url, { branchId: this.branchId, payPeriod: this.selectedPeriod, note: this.actionNote?.trim() || null },
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: _ => {
          const wasPaid = this.actionDialog === 'paid';
          this.actionLoading = false; this.actionDialog = null; this.actionNote = '';
          this.load(this.selectedPeriod);
          if (wasPaid) this.refreshService.trigger();
          this.cdr.detectChanges();
        },
        error: err => { this.errorMsg = err.error?.message || 'Action failed'; this.actionLoading = false; this.cdr.detectChanges(); }
      });
  }

  get isAdmin(): boolean { return this.currentRole === 'ADMIN'; }

  get visibleRows(): HistoryRow[] {
    if (!this.data) return [];
    const q = this.searchQuery.trim().toLowerCase();
    return this.data.rows.filter(r => {
      if (this.statusFilter !== 'ALL' && r.status !== this.statusFilter) return false;
      if (!q) return true;
      return (r.userName||'').toLowerCase().includes(q) ||
             (r.roleDisplayName||'').toLowerCase().includes(q) ||
             (r.departmentName||'').toLowerCase().includes(q);
    });
  }

  openPayslip(row: HistoryRow) { this.selectedRecordId = row.id; this.modalOpen = true; this.cdr.detectChanges(); }
  onModalClose() { this.modalOpen = false; this.selectedRecordId = null; this.cdr.detectChanges(); }
  onActionSuccess(ev: { newStatus: string; id: number }) { this.load(this.selectedPeriod); }

  isDoneStage(stage: string): boolean {
    const order = ['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'PAID'];
    const current = this.batchStatus?.dominantStatus || 'DRAFT';
    return order.indexOf(current) > order.indexOf(stage);
  }

  currencyPrefix(code?: string): string {
    const m: Record<string,string> = { USD:'$', JPY:'¥', KHR:'៛', MMK:'K', VND:'₫', KRW:'₩' };
    return code ? (m[code] || code+' ') : '$';
  }
  formatMoney(v: number | null | undefined): string {
    if (v == null || isNaN(Number(v))) return '0.00';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  formatPeriodLabel(code: string): string {
    if (!code || code.length < 7) return code;
    const [y, m] = code.split('-');
    return new Date(Number(y), Number(m)-1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  statusColor(s: string): string {
    const m: Record<string,string> = { DRAFT:'#64748b', PENDING_APPROVAL:'#3b82f6', CONFIRMED:'#f59e0b', PAID:'#10b981' };
    return m[s] || '#64748b';
  }
  statusIcon(s: string): string {
    const m: Record<string,string> = { DRAFT:'📝', PENDING_APPROVAL:'⏳', CONFIRMED:'✓', PAID:'💰' };
    return m[s] || '•';
  }
  statusLabel(s: string): string { return s === 'PENDING_APPROVAL' ? 'PENDING' : s; }
  getInitial(name: string): string { return (name||'?').charAt(0).toUpperCase(); }
  getAvatarColor(id: number): string {
    const c = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444'];
    return c[id % c.length];
  }
}
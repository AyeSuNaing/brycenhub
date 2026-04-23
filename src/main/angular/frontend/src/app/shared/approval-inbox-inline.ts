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

interface PendingBatch {
  branchId: number;
  branchName: string;
  countryName?: string;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  staffCount: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  currency: string;
  submittedAt?: string;
  submittedByName?: string;
  submitNote?: string;
}

interface PendingResponse {
  totalBatches: number;
  totalStaff: number;
  batches: PendingBatch[];
}

@Component({
  selector: 'app-approval-inbox-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approval-inbox-inline.html',
  styleUrls: ['./approval-inbox-inline.scss'],
  host: { style: 'display:contents' }
})
export class ApprovalInboxInline implements OnInit {

  @Output() back = new EventEmitter<void>();
  @Output() viewBatch = new EventEmitter<{ branchId: number; payPeriod: string }>();

  data: PendingResponse | null = null;
  loading = false;
  errorMsg = '';

  // Action dialog
  actionDialog: 'approve' | 'reject' | null = null;
  actionTarget: PendingBatch | null = null;
  actionNote = '';
  actionLoading = false;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.get<PendingResponse>(`${PAYROLL_BASE}/pending-batches`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this.data = data;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.errorMsg = err.error?.message || 'Failed to load pending batches';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════
  openDialog(kind: 'approve' | 'reject', batch: PendingBatch) {
    this.actionDialog = kind;
    this.actionTarget = batch;
    this.actionNote = '';
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  closeDialog() {
    this.actionDialog = null;
    this.actionTarget = null;
    this.actionNote = '';
    this.cdr.detectChanges();
  }

  doAction() {
    if (!this.actionDialog || !this.actionTarget) return;

    // Reject requires reason
    if (this.actionDialog === 'reject' && !this.actionNote.trim()) {
      this.errorMsg = 'Reject reason is required';
      this.cdr.detectChanges();
      return;
    }

    const url = this.actionDialog === 'approve'
      ? `${PAYROLL_BASE}/batch/approve`
      : `${PAYROLL_BASE}/batch/reject`;

    this.actionLoading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.post<any>(url, {
      branchId: this.actionTarget.branchId,
      payPeriod: this.actionTarget.payPeriod,
      note: this.actionNote.trim() || null,
    }, { headers: this.auth.getHeaders() })
      .subscribe({
        next: _ => {
          this.actionLoading = false;
          this.closeDialog();
          this.load();
        },
        error: err => {
          this.errorMsg = err.error?.message || 'Action failed';
          this.actionLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // View batch detail
  onViewDetail(batch: PendingBatch) {
    this.viewBatch.emit({ branchId: batch.branchId, payPeriod: batch.payPeriod });
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  currencyPrefix(code?: string): string {
    if (!code) return '$';
    const map: Record<string, string> = {
      USD: '$', JPY: '¥', KHR: '៛', MMK: 'K', VND: '₫', KRW: '₩',
    };
    return map[code] || code + ' ';
  }

  formatMoney(v: number | null | undefined): string {
    if (v == null || isNaN(Number(v))) return '0.00';
    return Number(v).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPeriod(code: string): string {
    if (!code || code.length < 7) return code;
    const [y, m] = code.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  formatSubmitted(s?: string): string {
    if (!s) return '—';
    const d = new Date(s);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1)  return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7)   return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

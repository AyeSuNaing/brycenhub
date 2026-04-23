import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;
const PAYROLL_BASE = `${BASE}/payroll`;

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════
export interface PayslipData {
  id: number;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  userId: number;
  userName: string;
  userEmail: string;
  userPhone?: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
  branchId: number;
  branchName: string;
  countryName?: string;
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
  status: 'DRAFT' | 'HR_REVIEWED' | 'CONFIRMED' | 'PAID';
  note?: string;
  calculatedAt?: string;
  calculatedByName?: string;
  confirmedAt?: string;
  confirmedByName?: string;
  paidAt?: string;
}

@Component({
  selector: 'app-payslip-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payslip-modal.component.html',
  styleUrls: ['./payslip-modal.component.scss'],
})
export class PayslipModalComponent implements OnChanges {

  /** Record ID from salary_history */
  @Input() recordId: number | null = null;

  /** Open/close state — parent controls */
  @Input() isOpen = false;

  /** Emitted when user closes modal */
  @Output() close = new EventEmitter<void>();

  /** Emitted when an action (review/confirm/pay) succeeds — parent can refresh list */
  @Output() actionSuccess = new EventEmitter<{ newStatus: string; id: number }>();

  // State
  payslip: PayslipData | null = null;
  loading = false;
  actionLoading = false;
  errorMsg = '';
  actionNote = '';
  showActionForm: 'review' | 'confirm' | 'pay' | null = null;

  currentUser: any = null;
  currentRoleName = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.currentUser = this.auth.getUser();
    this.currentRoleName = (this.currentUser?.role || '').toUpperCase();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['recordId'] || changes['isOpen']) && this.isOpen && this.recordId) {
      this.load();
    }
    if (!this.isOpen) {
      // Reset state on close
      this.payslip = null;
      this.errorMsg = '';
      this.showActionForm = null;
      this.actionNote = '';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Load payslip
  // ═══════════════════════════════════════════════════════════
  load() {
    if (!this.recordId) return;
    this.loading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.get<PayslipData>(`${PAYROLL_BASE}/payslip/${this.recordId}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this.payslip = data;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.errorMsg = err.error?.message || 'Failed to load payslip';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Permissions — what actions can current user take?
  // ═══════════════════════════════════════════════════════════
  canMarkReviewed(): boolean {
    return this.payslip?.status === 'DRAFT'
        && this.currentRoleName === 'ADMIN';
  }

  canConfirm(): boolean {
    return this.payslip?.status === 'HR_REVIEWED'
        && ['VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS'].includes(this.currentRoleName);
  }

  canMarkPaid(): boolean {
    return this.payslip?.status === 'CONFIRMED'
        && this.currentRoleName === 'ADMIN';
  }

  // ═══════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════
  doAction(kind: 'review' | 'confirm' | 'pay') {
    if (!this.recordId) return;

    const urlMap = {
      review:  `${PAYROLL_BASE}/${this.recordId}/mark-reviewed`,
      confirm: `${PAYROLL_BASE}/${this.recordId}/confirm`,
      pay:     `${PAYROLL_BASE}/${this.recordId}/mark-paid`,
    };

    this.actionLoading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.patch<any>(
      urlMap[kind],
      { note: this.actionNote?.trim() || null },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: res => {
        // Refresh payslip to show new status + audit info
        this.actionLoading = false;
        this.showActionForm = null;
        this.actionNote = '';
        this.actionSuccess.emit({ newStatus: res.newStatus, id: this.recordId! });
        this.load(); // reload with fresh data
      },
      error: err => {
        this.errorMsg = err.error?.message || 'Action failed';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Print — browser native print
  // ═══════════════════════════════════════════════════════════
  print() {
    // Uses @media print CSS to hide chrome
    window.print();
  }

  // ═══════════════════════════════════════════════════════════
  // UI helpers
  // ═══════════════════════════════════════════════════════════
  onBackdropClick(event: MouseEvent) {
    // Close only when clicking the backdrop itself, not the modal content
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

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

  formatDate(s: string | undefined): string {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleString('en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatDateOnly(s: string | undefined): string {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleString('en-US',
      { year: 'numeric', month: 'short', day: 'numeric' });
  }

  statusColor(status?: string): string {
    switch (status) {
      case 'DRAFT':        return '#64748b';
      case 'HR_REVIEWED':  return '#3b82f6';
      case 'CONFIRMED':    return '#f59e0b';
      case 'PAID':         return '#10b981';
      default:             return '#64748b';
    }
  }

  statusIcon(status?: string): string {
    switch (status) {
      case 'DRAFT':        return '📝';
      case 'HR_REVIEWED':  return '👁';
      case 'CONFIRMED':    return '✓';
      case 'PAID':         return '💰';
      default:             return '•';
    }
  }

  getInitial(name?: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  getAvatarColor(id: number): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
                    '#10b981', '#06b6d4', '#3b82f6', '#ef4444'];
    return colors[id % colors.length];
  }
}

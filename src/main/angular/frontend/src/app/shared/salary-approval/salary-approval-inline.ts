import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';
import { RefreshService } from '../../services/refresh.service';

const BASE    = environment.apiBaseUrl;
const VP_BASE = `${BASE}/vp/dashboard`;

@Component({
  selector: 'app-salary-approval-inline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './salary-approval-inline.html',
  styleUrls: ['./salary-approval-inline.scss'],
  host: { style: 'display:contents' }
})
export class SalaryApprovalInline implements OnInit {

  @Input() branchId?: number;   // ← Boss Dashboard မှ specific branch ကို pass လုပ်ရန်
  @Output() back     = new EventEmitter<void>();
  @Output() approved = new EventEmitter<void>();
  @Output() rejected = new EventEmitter<void>();

  periods: any[] = [];
  loading = false;
  acting: Record<string, boolean> = {};

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
    private refreshService: RefreshService,
  ) {}

  ngOnInit() { this.load(); }

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  load() {
    this.loading = true;
    this.cdr.detectChanges();
    // branchId ပါရင် ?branchId=X append လုပ်မည်
    const url = this.branchId
      ? `${VP_BASE}/salary-approvals?branchId=${this.branchId}`
      : `${VP_BASE}/salary-approvals`;
    this.http.get<any[]>(url, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.periods = data || [];
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  doApprove(p: any) {
    this.acting[p.payPeriod] = true;
    this.cdr.detectChanges();
    this.http.post(`${BASE}/payroll/batch/approve`,
      { branchId: p.branchId, payPeriod: p.payPeriod },
      { headers: this.auth.getHeaders() }
    ).pipe(catchError(() => {
      this.acting[p.payPeriod] = false;
      this.cdr.detectChanges();
      return of(null);
    })).subscribe(r => {
      this.acting[p.payPeriod] = false;
      if (r !== null) { this.load(); this.approved.emit(); this.refreshService.trigger(); }
      this.cdr.detectChanges();
    });
  }

  doReject(p: any) {
    const reason = prompt('Reject reason:') ?? '';
    if (!reason.trim()) return;
    this.acting[p.payPeriod] = true;
    this.cdr.detectChanges();
    this.http.post(`${BASE}/payroll/batch/reject`,
      { branchId: p.branchId, payPeriod: p.payPeriod, note: reason },
      { headers: this.auth.getHeaders() }
    ).pipe(catchError(() => {
      this.acting[p.payPeriod] = false;
      this.cdr.detectChanges();
      return of(null);
    })).subscribe(r => {
      this.acting[p.payPeriod] = false;
      if (r !== null) { this.load(); this.rejected.emit(); this.refreshService.trigger(); }
      this.cdr.detectChanges();
    });
  }

  // ── Style helpers ──────────────────────────────────────────
  getBorderColor(s: string): string {
    if (s === 'PENDING_APPROVAL') return 'rgba(245,158,11,0.7)';
    if (s === 'DRAFT')            return 'rgba(139,92,246,0.6)';
    if (s === 'CONFIRMED')        return 'rgba(96,165,250,0.6)';
    return 'rgba(148,163,184,0.2)';
  }

  getBgColor(s: string): string {
    if (s === 'PENDING_APPROVAL') return 'rgba(245,158,11,0.07)';
    if (s === 'DRAFT')            return 'rgba(139,92,246,0.06)';
    if (s === 'CONFIRMED')        return 'rgba(96,165,250,0.05)';
    return 'transparent';
  }

  getBadgeBg(s: string): string {
    if (s === 'PENDING_APPROVAL') return 'rgba(245,158,11,0.2)';
    if (s === 'DRAFT')            return 'rgba(139,92,246,0.2)';
    if (s === 'CONFIRMED')        return 'rgba(96,165,250,0.2)';
    return 'rgba(100,116,139,0.15)';
  }

  getBadgeColor(s: string): string {
    if (s === 'PENDING_APPROVAL') return '#fbbf24';
    if (s === 'DRAFT')            return '#a78bfa';
    if (s === 'CONFIRMED')        return '#93c5fd';
    return '#94a3b8';
  }

  getStatBg(s: string): string {
    if (s === 'DRAFT')            return 'rgba(139,92,246,0.1)';
    if (s === 'PENDING_APPROVAL') return 'rgba(245,158,11,0.08)';
    return 'rgba(148,163,184,0.06)';
  }

  getStatusLabel(s: string): string {
    if (s === 'PENDING_APPROVAL') return 'PENDING';
    return s;
  }

  fmt(currency: string, amt: number): string {
    const prefix: Record<string, string> = {
      USD: '$', JPY: '¥', KHR: '៛', MMK: 'K', VND: '₫', KRW: '₩'
    };
    const p = prefix[currency] || (currency + ' ');
    return `${p}${(amt || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })}`;
  }

  formatPeriodLabel(period: string): string {
    if (!period) return '';
    const parts = period.split('-');
    if (parts.length === 2) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const m = parseInt(parts[1], 10) - 1;
      return `${months[m] || parts[1]} ${parts[0]}`;
    }
    return period;
  }

  // ✅ Approver date format
  formatConfirmedAt(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d   = new Date(dateStr);
      const now  = new Date();
      const diffH = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
      const diffD = Math.floor(diffH / 24);
      if (diffH < 1)  return 'Just now';
      if (diffH < 24) return `${diffH}h ago`;
      if (diffD < 7)  return `${diffD}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  }
}
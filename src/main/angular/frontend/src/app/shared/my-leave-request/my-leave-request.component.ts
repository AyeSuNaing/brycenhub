import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-my-leave-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-leave-request.component.html',
  // styleUrl: './my-leave-request.component.scss',
})
export class MyLeaveRequestComponent implements OnInit {

  @Output() back = new EventEmitter<void>();

  // ── Tabs ───────────────────────────────────────────────
  activeTab: 'history' | 'new' = 'history';

  // ── History ────────────────────────────────────────────
  myRequests: any[] = [];
  loadingHistory = false;

  // ── New Request Form ───────────────────────────────────
  form = {
    leaveType: 'ANNUAL',
    startDate: '',
    endDate:   '',
    reason:    '',
  };
  submitting = false;
  error      = '';
  success    = '';

  readonly leaveTypes = [
    { value: 'ANNUAL', label: '🏖 Annual Leave' },
    { value: 'SICK',   label: '🤒 Sick Leave'   },
    { value: 'UNPAID', label: '💼 Unpaid Leave'  },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  // ── Load History ───────────────────────────────────────
  loadHistory(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${BASE}/staff/leave-requests/my`, 
      { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.myRequests = list || [];
        this.loadingHistory = false;
        // ✅ data ရှိရင် history tab ပြ၊ မရှိရင် new tab ပြ
        if (this.myRequests.length === 0) {
          this.activeTab = 'new';  // ← ထည့်
        }
        this.cdr.detectChanges();
      });
  }

  // ── Submit ─────────────────────────────────────────────
  submit(): void {
    this.error   = '';
    this.success = '';

    if (!this.form.startDate || !this.form.endDate) {
      this.error = 'Please select start and end dates.';
      return;
    }
    if (new Date(this.form.endDate) < new Date(this.form.startDate)) {
      this.error = 'End date must be after start date.';
      return;
    }

    this.submitting = true;
    this.http.post(`${BASE}/staff/leave-requests`, this.form, { headers: this.auth.getHeaders() })
      .pipe(catchError(err => {
        this.error = err?.error?.message || 'Failed to submit. Please try again.';
        this.submitting = false;
        this.cdr.detectChanges();
        return of(null);
      }))
      .subscribe(res => {
        if (res) {
          this.success = '✅ Leave request submitted successfully!';
          this.form = { leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' };
          this.submitting = false;
          this.loadHistory();
          setTimeout(() => { this.activeTab = 'history'; this.cdr.detectChanges(); }, 1200);
        }
      });
  }

  // ── Helpers ────────────────────────────────────────────
  getStatusColor(s: string): string {
    return s === 'APPROVED' ? '#22c55e' : s === 'REJECTED' ? '#ef4444' : '#f59e0b';
  }
  getStatusBg(s: string): string {
    return s === 'APPROVED' ? 'rgba(34,197,94,0.15)' : s === 'REJECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
  }
  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  calcDays(): number {
    if (!this.form.startDate || !this.form.endDate) return 0;
    const diff = new Date(this.form.endDate).getTime() - new Date(this.form.startDate).getTime();
    return Math.max(0, Math.ceil(diff / 86400000) + 1);
  }
}

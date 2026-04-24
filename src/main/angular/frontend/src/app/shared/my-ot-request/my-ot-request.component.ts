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
  selector: 'app-my-ot-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-ot-request.component.html',
})
export class MyOtRequestComponent implements OnInit {

  @Output() back = new EventEmitter<void>();

  activeTab: 'history' | 'new' = 'history';

  // ── Projects ───────────────────────────────────────────
  projects: any[] = [];

  // ── History ────────────────────────────────────────────
  myRequests:   any[] = [];
  loadingHistory = false;

  // ── Edit state ─────────────────────────────────────────
  editingId: number | null = null;

  // ── New Request Form ───────────────────────────────────
  form = {
    workDate:  '',
    otHours:   '',
    dayType:   'WEEKDAY',
    projectId: '',
    reason:    '',
  };
  submitting = false;
  error      = '';
  success    = '';

  readonly dayTypes = [
    { value: 'WEEKDAY', label: '📅 Weekday' },
    { value: 'WEEKEND', label: '🏖 Weekend' },
    { value: 'HOLIDAY', label: '🎉 Holiday' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadHistory();
    this.loadProjects();
  }

  // ── Load my active projects ────────────────────────────
  loadProjects(): void {
    this.http.get<any[]>(`${BASE}/dashboard/pm/active-projects`,
      { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.projects = list || [];
        this.cdr.detectChanges();
      });
  }

  // ── Load History ───────────────────────────────────────
  loadHistory(): void {
    this.loadingHistory = true;
    this.http.get<any[]>(`${BASE}/staff/ot-requests/my`,
      { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.myRequests    = list || [];
        this.loadingHistory = false;
        if (this.myRequests.length === 0) this.activeTab = 'new';
        this.cdr.detectChanges();
      });
  }

  // ── Edit existing request ──────────────────────────────
  editRequest(r: any): void {
    this.editingId = r.id;
    this.form = {
      workDate:  r.workDate   || '',
      otHours:   String(r.otHours || ''),
      dayType:   r.dayType    || 'WEEKDAY',
      projectId: String(r.projectId || ''),
      reason:    r.reason     || '',
    };
    this.error   = '';
    this.success = '';
    this.activeTab = 'new';
    this.cdr.detectChanges();
  }

  // ── Cancel edit ────────────────────────────────────────
  cancelEdit(): void {
    this.editingId = null;
    this.form = { workDate: '', otHours: '', dayType: 'WEEKDAY', projectId: '', reason: '' };
    this.error   = '';
    this.success = '';
    this.activeTab = 'history';
    this.cdr.detectChanges();
  }

  // ── Submit (new or edit) ───────────────────────────────
  submit(): void {
    this.error   = '';
    this.success = '';

    if (!this.form.workDate) { this.error = 'Please select work date.'; return; }
    if (!this.form.otHours || Number(this.form.otHours) <= 0) {
      this.error = 'Please enter valid OT hours.'; return;
    }
    if (Number(this.form.otHours) > 12) {
      this.error = 'OT hours cannot exceed 12.'; return;
    }
    if (!this.form.projectId) {
      this.error = 'Please select a project.'; return;
    }

    this.submitting = true;
    const payload = {
      workDate:  this.form.workDate,
      otHours:   Number(this.form.otHours),
      dayType:   this.form.dayType,
      projectId: Number(this.form.projectId),
      reason:    this.form.reason,
    };

    const url = this.editingId
      ? `${BASE}/staff/ot-requests/${this.editingId}`
      : `${BASE}/staff/ot-requests`;

    const req = this.editingId
      ? this.http.put(url, payload,  { headers: this.auth.getHeaders() })
      : this.http.post(url, payload, { headers: this.auth.getHeaders() });

    req.pipe(catchError(err => {
      this.error = err?.error?.message || 'Failed to submit. Please try again.';
      this.submitting = false;
      this.cdr.detectChanges();
      return of(null);
    })).subscribe(res => {
      if (res) {
        this.success    = this.editingId ? '✅ OT request updated!' : '✅ OT request submitted!';
        this.editingId  = null;
        this.form       = { workDate: '', otHours: '', dayType: 'WEEKDAY', projectId: '', reason: '' };
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
    return s === 'APPROVED' ? 'rgba(34,197,94,0.15)'
         : s === 'REJECTED' ? 'rgba(239,68,68,0.15)'
         : 'rgba(245,158,11,0.15)';
  }
  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
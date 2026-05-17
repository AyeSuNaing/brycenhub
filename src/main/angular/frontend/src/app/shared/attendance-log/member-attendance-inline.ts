import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

interface LogRow {
  workDate: string;
  timeIn:   string | null;
  timeOut:  string | null;
  isDayoff: boolean;
  source:   string;
  note:     string | null;
}

interface EditState {
  workDate: string;
  timeIn:   string;
  timeOut:  string;
  isDayoff: boolean;
  note:     string;
  saving:   boolean;
  error:    string;
}

@Component({
  selector: 'app-member-attendance-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './member-attendance-inline.html',
  styleUrl:    './member-attendance-inline.scss',
  host: { style: 'display:contents' },
})
export class MemberAttendanceInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  periods: { value: string; label: string }[] = [];
  selectedPeriod = '';
  logs:     LogRow[] = [];
  loading   = false;
  currentUser: any = null;

  // ── Salary calculated check ──
  // canEdit = true  → salary_history ထဲမှာ ဒီ period record မရှိသေး
  // canEdit = false → salary calculate ပြီးပြီ (record ရှိပြီ) → lock
  salaryCalculated = false;
  checkingPayroll  = false;

  editState: EditState | null = null;

  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage, key);
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.buildPeriods();
    this.loadLogs();
  }

  buildPeriods(): void {
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      this.periods.push({
        value: `${y}-${m}`,
        label: d.toLocaleString('en', { month: 'long', year: 'numeric' }),
      });
    }
    this.selectedPeriod = this.periods[0].value;
  }

  loadLogs(): void {
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;
    const [y, m] = this.selectedPeriod.split('-').map(Number);
    const prevM  = m === 1 ? 12 : m - 1;
    const prevY  = m === 1 ? y - 1 : y;
    const from   = `${prevY}-${String(prevM).padStart(2,'0')}-25`;
    const to     = `${y}-${String(m).padStart(2,'0')}-24`;
    this.loading          = true;
    this.logs             = [];
    this.editState        = null;
    this.salaryCalculated = false;
    this.cdr.detectChanges();

    this.http.get<LogRow[]>(
      `${BASE}/users/${myId}/attendance?from=${from}&to=${to}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: d => {
        this.logs    = d || [];
        this.loading = false;
        this.cdr.detectChanges();
        this.checkSalaryCalculated();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── salary_history မှာ ဒီ period record ရှိ/မရှိ စစ်မယ် ──
  // record ရှိပြီ = salary calculate ပြီးပြီ → edit မရ
  checkSalaryCalculated(): void {
    this.checkingPayroll  = true;
    this.salaryCalculated = false;
    this.cdr.detectChanges();

    this.http.get<any[]>(
      `${BASE}/payroll/my-history`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: rows => {
        // ဒီ period record ရှိပြီဆိုရင် salary calculate ပြီးပြီ
        const hasRecord = (rows || []).some(r => r.payPeriod === this.selectedPeriod);
        this.salaryCalculated = hasRecord;
        this.checkingPayroll  = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // API error ဖြစ်ရင် safe side အနေနဲ့ edit ခွင့်ပေး
        this.salaryCalculated = false;
        this.checkingPayroll  = false;
        this.cdr.detectChanges();
      }
    });
  }

  // salary calculate မလုပ်ရသေး → edit ရ
  get canEdit(): boolean {
    return !this.salaryCalculated;
  }

  startEdit(log: LogRow): void {
    if (!this.canEdit) return;
    this.editState = {
      workDate: log.workDate,
      timeIn:   log.timeIn  ? log.timeIn.substring(0, 5)  : '',
      timeOut:  log.timeOut ? log.timeOut.substring(0, 5) : '',
      isDayoff: log.isDayoff,
      note:     log.note || '',
      saving:   false,
      error:    '',
    };
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editState = null;
    this.cdr.detectChanges();
  }

  isEditing(workDate: string): boolean {
    return this.editState?.workDate === workDate;
  }

  saveEdit(log: LogRow): void {
    if (!this.editState || this.editState.saving) return;
    const myId = this.currentUser?.id || this.currentUser?.userId;
    if (!myId) return;

    this.editState.error  = '';
    this.editState.saving = true;
    this.cdr.detectChanges();

    const body = {
      timeIn:   this.editState.isDayoff ? null : (this.editState.timeIn  || null),
      timeOut:  this.editState.isDayoff ? null : (this.editState.timeOut || null),
      isDayoff: this.editState.isDayoff,
      note:     this.editState.note || null,
    };

    this.http.patch(
      `${BASE}/users/${myId}/attendance/${this.editState.workDate}`,
      body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => {
        const fmt = (t: string | null) =>
          t ? (t.length === 5 ? t + ':00' : t) : null;
        log.timeIn   = fmt(body.timeIn);
        log.timeOut  = fmt(body.timeOut);
        log.isDayoff = body.isDayoff;
        log.note     = body.note;
        log.source   = 'MANUAL';
        this.editState = null;
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.editState!.error  = e?.error?.message || 'Failed to save.';
        this.editState!.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Stats ──
  get presentCount(): number { return this.logs.filter(l => l.timeIn && !l.isDayoff).length; }
  get absentCount():  number { return this.logs.filter(l => !l.timeIn && !l.isDayoff).length; }
  get dayoffCount():  number { return this.logs.filter(l => l.isDayoff).length; }

  get avgTimeIn(): string {
    const present = this.logs.filter(l => l.timeIn && !l.isDayoff);
    if (!present.length) return '—';
    const total = present.reduce((s, l) => {
      const [h, m] = l.timeIn!.split(':').map(Number);
      return s + h * 60 + m;
    }, 0);
    const avg = Math.round(total / present.length);
    return `${String(Math.floor(avg / 60)).padStart(2,'0')}:${String(avg % 60).padStart(2,'0')}`;
  }

  getDayName(d: string): string {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d).getDay()];
  }

  isLate(timeIn: string): boolean {
    const [h, m] = timeIn.split(':').map(Number);
    return h > 8 || (h === 8 && m > 0);
  }

  getTimeInColor(log: LogRow): string {
    if (!log.timeIn || log.isDayoff) return 'inherit';
    return this.isLate(log.timeIn) ? '#f59e0b' : '#22c55e';
  }

  getStatus(log: LogRow): string {
    if (log.isDayoff) return 'Day Off';
    if (!log.timeIn)  return 'Absent';
    return 'Present';
  }

  getStatusColor(log: LogRow): string {
    if (log.isDayoff) return '#ef4444';
    if (!log.timeIn)  return '#f59e0b';
    return '#22c55e';
  }

  getStatusBg(log: LogRow): string {
    if (log.isDayoff) return 'rgba(239,68,68,0.12)';
    if (!log.timeIn)  return 'rgba(245,158,11,0.12)';
    return 'rgba(34,197,94,0.12)';
  }

  calcHours(log: LogRow): string {
    if (!log.timeIn || !log.timeOut) return '—';
    const [hi, mi] = log.timeIn.split(':').map(Number);
    const [ho, mo] = log.timeOut.split(':').map(Number);
    const mins = (ho * 60 + mo) - (hi * 60 + mi);
    if (mins <= 0) return '—';
    return `${Math.floor(mins / 60)}h${mins % 60 ? ' ' + (mins % 60) + 'm' : ''}`;
  }
}
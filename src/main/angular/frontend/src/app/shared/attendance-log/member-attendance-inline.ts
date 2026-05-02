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
  logs:    LogRow[] = [];
  loading  = false;
  currentUser: any = null;

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
    this.loading = true;
    this.logs    = [];
    this.cdr.detectChanges();
    this.http.get<LogRow[]>(
      `${BASE}/users/${myId}/attendance?from=${from}&to=${to}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: d => { this.logs = d || []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

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
    if (!timeIn) return false;
    const [h, m] = timeIn.split(':').map(Number);
    return h > 9 || (h === 9 && m > 0);
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
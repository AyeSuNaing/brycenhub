import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-ot-approval-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ot-approval-inline.html',
  host: { style: 'display:contents' }
})
export class OtApprovalInline implements OnInit {

  @Input() role: 'vp' | 'admin' = 'admin';
  @Output() back = new EventEmitter<void>();

  requests:    any[] = [];
  isLoading    = true;
  statusFilter = 'ALL';

  useCustom  = false;
  customFrom = '';
  customTo   = '';

  periodFrom  = '';
  periodTo    = '';
  periodLabel = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  private get baseUrl(): string {
    return this.role === 'vp'
      ? `${BASE}/vp/dashboard/ot-requests`
      : `${BASE}/admin/dashboard/ot-requests`;
  }

  private get headers() { return this.auth.getHeaders(); }

  ngOnInit(): void {
    const p = this.getCurrentPayPeriod();
    this.periodFrom  = this.fmtDate(p.from);
    this.periodTo    = this.fmtDate(p.to);
    this.periodLabel = p.label;
    this.loadAll();
  }

  getCurrentPayPeriod(): { from: Date; to: Date; label: string } {
    const today = new Date();
    const d = today.getDate();
    let fromY = today.getFullYear(), fromM = today.getMonth();
    let toY   = today.getFullYear(), toM   = today.getMonth();
    if (d >= 25) { toM += 1; } else { fromM -= 1; }
    if (fromM < 0)  { fromM = 11; fromY--; }
    if (toM   > 11) { toM   = 0;  toY++;   }
    const from  = new Date(fromY, fromM, 25);
    const to    = new Date(toY,   toM,   24);
    return { from, to, label: to.toLocaleString('en-US', { month: 'long', year: 'numeric' }) };
  }

  fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  shiftPeriod(delta: number): void {
    const from = new Date(this.periodFrom);
    const to   = new Date(this.periodTo);
    from.setMonth(from.getMonth() + delta);
    to.setMonth(to.getMonth() + delta);
    this.periodFrom  = this.fmtDate(from);
    this.periodTo    = this.fmtDate(to);
    this.periodLabel = to.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.useCustom  = true;
    this.customFrom = this.periodFrom;
    this.customTo   = this.periodTo;
    this.loadWithRange(this.periodFrom, this.periodTo);
  }

  applyCustom(): void {
    if (!this.customFrom || !this.customTo) return;
    this.useCustom = true;
    this.load();
  }

  clearCustom(): void {
    this.useCustom = false;
    this.customFrom = '';
    this.customTo   = '';
    this.load();
  }

  private get activeFrom(): string { return this.useCustom ? this.customFrom : this.periodFrom; }
  private get activeTo():   string { return this.useCustom ? this.customTo   : this.periodTo;   }

  private buildQuery(from?: string, to?: string): string {
    const p: string[] = [];
    p.push(`status=${this.statusFilter}`);
    if (from) p.push(`from=${from}`);
    if (to)   p.push(`to=${to}`);
    return '?' + p.join('&');
  }

  load(): void {
    if (this.useCustom) {
      this.loadWithRange(this.customFrom, this.customTo);
    } else {
      this.loadAll();
    }
  }

  loadAll(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.baseUrl}${this.buildQuery()}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.requests  = list || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  loadWithRange(from: string, to: string): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.baseUrl}${this.buildQuery(from, to)}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.requests  = list || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  onFilterChange(s: string): void { this.statusFilter = s; this.load(); }

  get filtered(): any[] { return this.requests; }
  get pendingCount(): number { return this.requests.filter(r => r.status === 'PENDING').length; }

  approve(id: number): void {
    this.http.patch(`${this.baseUrl}/${id}/approve`, {}, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(r => { if (r !== null) this.load(); });
  }

  reject(id: number): void {
    this.http.patch(`${this.baseUrl}/${id}/reject`,
      { reason: 'Rejected' }, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(r => { if (r !== null) this.load(); });
  }

  getColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
  getDayTypeColor(d: string): string {
    return d==='SUNDAY'?'#f87171':d==='SATURDAY'?'#a78bfa':'#94a3b8';
  }
  isActiveOt(r: any): boolean {
    if (!r.workDate) return true;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(r.workDate) >= today;
  }
}
import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProjectInlineComponent } from '../projects/project-inline';
import { environment } from '../../environments/environment';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

export interface BranchProjectItem {
  id:            number;
  name:          string;
  status:        'On Track' | 'At Risk' | 'Delayed';
  projectStatus: string;
  progress:      number;
  ownerName:     string;
  ownerInitial:  string;
  ownerColor:    string;
  dueDate:       string;
  health:        number;
  staffCount:    number;
  totalTasks:    number;
  doneTasks:     number;
  // ── P&L fields ─────────────────────────────────
  budget:        number | null;
  staffCost:     number;
  profitLoss:    number | null;
  profitPct:     number | null;
  isProfit:      boolean;
}

@Component({
  selector: 'app-branch-projects-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, ProjectInlineComponent],
  templateUrl: './branch-projects-inline.html',
  host: { style: 'display:contents' }
})
export class BranchProjectsInline implements OnInit {

  @Input() branchId?: number;
  @Input() hidePanel = true;
  @Output() back = new EventEmitter<void>();

  projects:    BranchProjectItem[] = [];
  isLoading    = true;
  loadingPL    = false;
  statusFilter = 'ALL';
  hoveredRow:  any = null;

  showProjectDetail  = false;
  selectedProjectId: number | null = null;

  readonly STATUS_FILTERS = [
    { key: 'ALL',       label: 'All'      },
    { key: 'On Track',  label: 'On Track' },
    { key: 'At Risk',   label: 'At Risk'  },
    { key: 'Delayed',   label: 'Delayed'  },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.isLoading = true;
    const user = this.auth.getUser();
    const bid  = this.branchId || user?.branchId;
    const url  = bid ? `${BASE}/projects/by-branch/${bid}/details` : `${BASE}/projects`;

    this.http.get<any[]>(url, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.projects  = (list || []).map(p => this.normalize(p));
        this.isLoading = false;
        this.cdr.detectChanges();
        // projects ပြီးမှ P/L load
        this.loadProfitLoss();
      });
  }

  // ── P&L ──────────────────────────────────────────────────────────
  loadProfitLoss(): void {
    this.loadingPL = true;
    this.http.get<any>(`${BASE}/projects/profit-loss`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null)))
      .subscribe(resp => {
        this.loadingPL = false;
        if (!resp?.projects) { this.cdr.detectChanges(); return; }
        (resp.projects as any[]).forEach(pl => {
          const p = this.projects.find(x => x.id === pl.projectId);
          if (p) {
            p.budget     = pl.budget     != null ? Number(pl.budget)       : null;
            p.staffCost  = Number(pl.staffCost   ?? 0);
            p.profitLoss = pl.profitLoss != null ? Number(pl.profitLoss)   : null;
            p.profitPct  = pl.profitPercent != null ? Number(pl.profitPercent) : null;
            // ✅ Java boolean getter → JSON "profit" (not "isProfit")
            p.isProfit   = !!(pl.profit ?? pl.isProfit);
          }
        });
        this.cdr.detectChanges();
      });
  }

  // P&L badge text — "+$18,266 (37%)"
  formatPL(pl: number | null, pct: number | null): string {
    if (pl === null) return '—';
    const sign   = pl >= 0 ? '+' : '';
    const amount = Math.abs(pl).toLocaleString('en-US', {
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });
    const pctStr = pct !== null ? ` (${Math.abs(pct).toFixed(0)}%)` : '';
    return `${sign}$${amount}${pctStr}`;
  }

  // P&L summary getters
  get profitProjects():   BranchProjectItem[] {
    return this.projects.filter(p => p.isProfit && p.budget !== null);
  }
  get lossProjects():     BranchProjectItem[] {
    return this.projects.filter(p => !p.isProfit && p.budget !== null);
  }
  get noBudgetProjects(): BranchProjectItem[] {
    return this.projects.filter(p => p.budget === null);
  }

  private normalize(p: any): BranchProjectItem {
    const prog = Number(p.progress ?? 0);
    const ed   = p.endDate ? new Date(p.endDate) : null;
    const dl   = ed ? Math.ceil((ed.getTime() - Date.now()) / 86400000) : 999;
    let st: 'On Track' | 'At Risk' | 'Delayed' = 'On Track';
    if      (dl < 0)               st = 'Delayed';
    else if (dl < 14 && prog < 70) st = 'At Risk';
    else if (prog < 30 && dl < 30) st = 'At Risk';
    return {
      id: p.id, name: p.title || 'Untitled', status: st,
      projectStatus: p.status || 'ACTIVE',
      progress: prog,
      ownerName:    p.pmName    || 'Unassigned',
      ownerInitial: p.pmInitial || '?',
      ownerColor:   p.pmColor   || '#64748b',
      dueDate: ed ? ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
      health: dl < 0 ? 1 : dl < 14 && prog < 70 ? 2 : prog >= 80 ? 5 : prog >= 50 ? 4 : 3,
      staffCount: p.staffCount || 0,
      totalTasks: p.totalTasks || 0,
      doneTasks:  p.doneTasks  || 0,
      // P/L defaults (merged by loadProfitLoss)
      budget: null, staffCost: 0, profitLoss: null, profitPct: null, isProfit: false,
    };
  }

  get filtered(): BranchProjectItem[] {
    if (this.statusFilter === 'ALL') return this.projects;
    return this.projects.filter(p => p.status === this.statusFilter);
  }

  get countByStatus(): Record<string, number> {
    return {
      ALL:        this.projects.length,
      'On Track': this.projects.filter(p => p.status === 'On Track').length,
      'At Risk':  this.projects.filter(p => p.status === 'At Risk').length,
      'Delayed':  this.projects.filter(p => p.status === 'Delayed').length,
    };
  }

  openProject(id: number): void {
    this.selectedProjectId = id;
    this.showProjectDetail = true;
    this.cdr.detectChanges();
  }

  closeProject(): void {
    this.showProjectDetail = false;
    this.selectedProjectId = null;
    this.cdr.detectChanges();
  }

  getTrackColor(s: string): string {
    return s === 'On Track' ? '#22c55e' : s === 'At Risk' ? '#f59e0b' : '#ef4444';
  }

  getHealthDotColor(i: number, h: number): string {
    if (i >= h) return '#1e2d4a';
    return h >= 4 ? '#22c55e' : h >= 2 ? '#f59e0b' : '#ef4444';
  }
}
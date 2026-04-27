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

const BASE = environment.apiBaseUrl;

export interface BranchProjectItem {
  id:           number;
  name:         string;
  status:       'On Track' | 'At Risk' | 'Delayed';
  projectStatus: string;   // ACTIVE / PLANNING / ON_HOLD / COMPLETED
  progress:     number;
  ownerName:    string;
  ownerInitial: string;
  ownerColor:   string;
  dueDate:      string;
  health:       number;
  staffCount:   number;
  totalTasks:   number;
  doneTasks:    number;
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

  projects:   BranchProjectItem[] = [];
  isLoading   = true;
  statusFilter = 'ALL';
  hoveredRow:  any = null;

  showProjectDetail   = false;
  selectedProjectId:  number | null = null;

  readonly STATUS_FILTERS = [
    { key: 'ALL',       label: 'All' },
    { key: 'On Track',  label: 'On Track' },
    { key: 'At Risk',   label: 'At Risk' },
    { key: 'Delayed',   label: 'Delayed' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.isLoading = true;
    const user = this.auth.getUser();
    const bid  = this.branchId || user?.branchId;

    const url = bid
      ? `${BASE}/projects/by-branch/${bid}/details`
      : `${BASE}/projects`;

    this.http.get<any[]>(url, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.projects  = (list || []).map(p => this.normalize(p));
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  private normalize(p: any): BranchProjectItem {
    const prog = Number(p.progress ?? 0);
    const ed   = p.endDate ? new Date(p.endDate) : null;
    const dl   = ed ? Math.ceil((ed.getTime() - Date.now()) / 86400000) : 999;

    let trackStatus: 'On Track' | 'At Risk' | 'Delayed' = 'On Track';
    if      (dl < 0)               trackStatus = 'Delayed';
    else if (dl < 14 && prog < 70) trackStatus = 'At Risk';
    else if (prog < 30 && dl < 30) trackStatus = 'At Risk';

    const projectStatus = p.status || 'PLANNING';

    return {
      id:            p.id,
      name:          p.title || 'Untitled',
      status:        trackStatus,
      projectStatus,
      progress:      prog,
      ownerName:     p.pmName    || p.ownerName    || 'Unassigned',
      ownerInitial:  p.pmInitial || p.ownerInitial || '?',
      ownerColor:    p.pmColor   || p.ownerColor   || '#64748b',
      dueDate:       ed ? this.fmtDate(ed) : '—',
      health:        this.calcHealth(trackStatus, prog, dl),
      staffCount:    p.staffCount   || 0,
      totalTasks:    p.totalTasks   || 0,
      doneTasks:     p.doneTasks    || 0,
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
    this.selectedProjectId  = id;
    this.showProjectDetail  = true;
    this.cdr.detectChanges();
  }

  closeProject(): void {
    this.showProjectDetail  = false;
    this.selectedProjectId  = null;
    this.cdr.detectChanges();
  }

  getTrackColor(s: string): string {
    return s === 'On Track' ? '#22c55e' : s === 'At Risk' ? '#f59e0b' : '#ef4444';
  }

  getProgressGradient(s: string): string {
    return s === 'On Track'
      ? 'linear-gradient(90deg,#3b82f6,#6366f1)'
      : s === 'At Risk'
      ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
      : 'linear-gradient(90deg,#ef4444,#f87171)';
  }

  getStatusBadgeStyle(projectStatus: string): Record<string, string> {
    const map: Record<string, [string, string]> = {
      ACTIVE:    ['rgba(34,197,94,0.12)',  '#22c55e'],
      PLANNING:  ['rgba(99,102,241,0.12)', '#818cf8'],
      ON_HOLD:   ['rgba(245,158,11,0.12)', '#f59e0b'],
      COMPLETED: ['rgba(96,165,250,0.12)', '#60a5fa'],
      CANCELLED: ['rgba(239,68,68,0.12)',  '#ef4444'],
    };
    const [bg, color] = map[projectStatus] || ['rgba(148,163,184,0.1)', '#94a3b8'];
    return { background: bg, color };
  }

  getHealthDots(): number[] { return [0, 1, 2, 3, 4]; }

  getHealthDotColor(i: number, h: number): string {
    if (i >= h) return '#1e2d4a';
    return h >= 4 ? '#22c55e' : h >= 2 ? '#f59e0b' : '#ef4444';
  }

  getRowBg(p: BranchProjectItem): string {
    if (p.projectStatus === 'COMPLETED') return 'rgba(96,165,250,0.03)';
    if (p.projectStatus === 'CANCELLED') return 'rgba(239,68,68,0.03)';
    if (p.status === 'Delayed')  return 'rgba(239,68,68,0.04)';
    if (p.status === 'At Risk')  return 'rgba(245,158,11,0.03)';
    return 'transparent';
  }

  getRowBorderLeft(p: BranchProjectItem): string {
    if (p.status === 'Delayed')  return '3px solid rgba(239,68,68,0.5)';
    if (p.status === 'At Risk')  return '3px solid rgba(245,158,11,0.5)';
    if (p.status === 'On Track') return '3px solid rgba(34,197,94,0.4)';
    return '3px solid transparent';
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private calcHealth(s: string, p: number, d: number): number {
    if (s === 'Delayed') return 1;
    if (s === 'At Risk') return 2;
    if (p >= 80)         return 5;
    if (p >= 50)         return 4;
    return 3;
  }
}
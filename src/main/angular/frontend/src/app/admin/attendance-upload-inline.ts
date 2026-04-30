import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

interface ParsedRow {
  rowNumber: number;
  email: string;
  name?: string;
  workDate: string;
  timeIn?: string;
  timeOut?: string;
  userId?: number;
  matchedName?: string;
  matchedRole?: string;
  matchedBranch?: string;
  status: 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'INVALID';
  message?: string;
  selected?: boolean;
}

interface PreviewResponse {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: ParsedRow[];
}

interface StaffGroup {
  key: string;
  email: string;
  matchedName?: string;
  matchedRole?: string;
  matchedBranch?: string;
  userId?: number;
  totalDays: number;
  matchedDays: number;
  hasIssues: boolean;
  status: 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'INVALID' | 'MIXED';
  rows: ParsedRow[];
  expanded: boolean;
  allSelected: boolean;
}

@Component({
  selector: 'app-attendance-upload-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-upload-inline.html',
  styleUrls: ['./attendance-upload-inline.scss'],
  host: { style: 'display:contents' }
})
export class AttendanceUploadInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  step: 1 | 2 = 1;

  selectedFile: File | null = null;
  isDragging = false;
  isParsing = false;
  parseError = '';

  preview: PreviewResponse | null = null;
  groups: StaffGroup[] = [];

  searchQuery = '';
  filterStatus: 'ALL' | 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'INVALID' = 'ALL';

  isSaving = false;
  saveResult: { savedCount: number; updatedCount: number; skippedCount: number; message: string } | null = null;
  saveError = '';

  readonly MAX_SIZE_MB = 5;
  readonly MAX_SIZE_BYTES = this.MAX_SIZE_MB * 1024 * 1024;

  currentUser: any = null;

  // ── i18n ──────────────────────────────────
  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage || this.auth.getUser()?.preferredLanguage, key);
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging = false; }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  setFile(file: File) {
    this.parseError = '';
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.parseError = 'Only .xlsx or .xls files are supported.';
      this.cdr.detectChanges();
      return;
    }
    if (file.size > this.MAX_SIZE_BYTES) {
      this.parseError = `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max ${this.MAX_SIZE_MB} MB.`;
      this.cdr.detectChanges();
      return;
    }
    this.selectedFile = file;
    this.cdr.detectChanges();
    this.uploadAndPreview();
  }

  removeFile() {
    this.selectedFile = null;
    this.preview = null;
    this.groups = [];
    this.parseError = '';
    this.searchQuery = '';
    this.filterStatus = 'ALL';
    this.cdr.detectChanges();
  }

  uploadAndPreview() {
    if (!this.selectedFile) return;
    this.isParsing = true;
    this.parseError = '';
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<PreviewResponse>(`${BASE}/attendance/upload-preview`, formData).subscribe({
      next: data => {
        data.rows.forEach(r => { r.selected = r.status === 'MATCHED'; });
        this.preview = data;
        this.groups = this.buildGroups(data.rows);
        this.isParsing = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.parseError = err.error?.message || this.lbl('Failed to parse');
        this.selectedFile = null;
        this.isParsing = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildGroups(rows: ParsedRow[]): StaffGroup[] {
    const map = new Map<string, StaffGroup>();
    for (const r of rows) {
      const key = r.userId ? `u:${r.userId}` : `e:${r.email || 'unknown'}`;
      let g = map.get(key);
      if (!g) {
        g = { key, email: r.email, matchedName: r.matchedName, matchedRole: r.matchedRole,
              matchedBranch: r.matchedBranch, userId: r.userId, totalDays: 0, matchedDays: 0,
              hasIssues: false, status: 'MATCHED', rows: [], expanded: false, allSelected: false };
        map.set(key, g);
      }
      g.rows.push(r);
      g.totalDays++;
      if (r.status === 'MATCHED') g.matchedDays++;
      else g.hasIssues = true;
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.rows.sort((a, b) => (a.workDate || '').localeCompare(b.workDate || ''));
      const statuses = new Set(g.rows.map(r => r.status));
      g.status = statuses.size === 1 ? g.rows[0].status : 'MIXED';
      const matched = g.rows.filter(r => r.status === 'MATCHED');
      g.allSelected = matched.length > 0 && matched.every(r => r.selected);
    }

    groups.sort((a, b) => {
      const aIssue = a.status === 'MATCHED' ? 1 : 0;
      const bIssue = b.status === 'MATCHED' ? 1 : 0;
      if (aIssue !== bIssue) return aIssue - bIssue;
      return (a.matchedName || a.email).localeCompare(b.matchedName || b.email);
    });
    return groups;
  }

  get filteredGroups(): StaffGroup[] {
    let result = this.groups;
    if (this.filterStatus !== 'ALL') {
      result = result.filter(g => {
        if (this.filterStatus === 'MATCHED') return g.status === 'MATCHED' || g.status === 'MIXED';
        return g.rows.some(r => r.status === this.filterStatus);
      });
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(g =>
        (g.matchedName || '').toLowerCase().includes(q) ||
        (g.email || '').toLowerCase().includes(q) ||
        (g.matchedRole || '').toLowerCase().includes(q) ||
        (g.matchedBranch || '').toLowerCase().includes(q)
      );
    }
    return result;
  }

  get totalSelectedCount(): number {
    return this.preview ? this.preview.rows.filter(r => r.selected).length : 0;
  }

  setFilter(s: typeof this.filterStatus) { this.filterStatus = s; }
  toggleExpand(g: StaffGroup) { g.expanded = !g.expanded; }
  expandAll() { this.filteredGroups.forEach(g => g.expanded = true); }
  collapseAll() { this.filteredGroups.forEach(g => g.expanded = false); }

  toggleGroupSelection(g: StaffGroup, ev?: Event) {
    if (ev) ev.stopPropagation();
    const matched = g.rows.filter(r => r.status === 'MATCHED');
    if (matched.length === 0) return;
    const newState = !g.allSelected;
    matched.forEach(r => r.selected = newState);
    g.allSelected = newState;
  }

  toggleRow(r: ParsedRow, g: StaffGroup, ev?: Event) {
    if (ev) ev.stopPropagation();
    if (r.status !== 'MATCHED') return;
    r.selected = !r.selected;
    const matched = g.rows.filter(x => x.status === 'MATCHED');
    g.allSelected = matched.length > 0 && matched.every(x => x.selected);
  }

  selectAllMatched() {
    if (!this.preview) return;
    this.preview.rows.forEach(r => { if (r.status === 'MATCHED') r.selected = true; });
    this.groups.forEach(g => {
      const matched = g.rows.filter(r => r.status === 'MATCHED');
      g.allSelected = matched.length > 0;
    });
  }

  deselectAll() {
    if (!this.preview) return;
    this.preview.rows.forEach(r => r.selected = false);
    this.groups.forEach(g => g.allSelected = false);
  }

  clearAll() {
    this.selectedFile = null; this.preview = null; this.groups = [];
    this.parseError = ''; this.saveResult = null;
    this.searchQuery = ''; this.filterStatus = 'ALL';
    this.cdr.detectChanges();
  }

  confirmSave() {
    if (!this.preview) return;
    const rowsToSave = this.preview.rows
      .filter(r => r.status === 'MATCHED' && r.selected && r.userId)
      .map(r => ({ userId: r.userId, workDate: r.workDate, timeIn: r.timeIn || null, timeOut: r.timeOut || null, isDayoff: false, note: null }));

    if (rowsToSave.length === 0) { this.saveError = 'No rows selected to save.'; this.cdr.detectChanges(); return; }

    this.isSaving = true; this.saveError = ''; this.cdr.detectChanges();

    this.http.post<any>(`${BASE}/attendance/confirm-save`, { rows: rowsToSave }, { headers: this.auth.getHeaders() })
      .subscribe({
        next: resp => { this.saveResult = resp; this.isSaving = false; this.step = 2; this.cdr.detectChanges(); },
        error: err => { this.saveError = err.error?.message || 'Failed to save attendance records.'; this.isSaving = false; this.cdr.detectChanges(); }
      });
  }

  uploadAnother() {
    this.step = 1; this.selectedFile = null; this.preview = null;
    this.groups = []; this.saveResult = null; this.saveError = '';
    this.searchQuery = ''; this.filterStatus = 'ALL';
    this.cdr.detectChanges();
  }

  statusBg(s: string): string {
    const m: Record<string,string> = { MATCHED:'rgba(34,197,94,0.12)', UNMATCHED:'rgba(239,68,68,0.12)', DUPLICATE:'rgba(245,158,11,0.12)', INVALID:'rgba(148,163,184,0.12)' };
    return m[s] || 'transparent';
  }
  statusColor(s: string): string {
    const m: Record<string,string> = { MATCHED:'#22c55e', UNMATCHED:'#ef4444', DUPLICATE:'#f59e0b', INVALID:'#94a3b8' };
    return m[s] || 'inherit';
  }
  groupStatusDot(s: string): string {
    const m: Record<string,string> = { MATCHED:'#22c55e', UNMATCHED:'#ef4444', DUPLICATE:'#f59e0b', INVALID:'#94a3b8', MIXED:'#f59e0b' };
    return m[s] || '#94a3b8';
  }
}
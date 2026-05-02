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

// ── View Attendance types ──
interface AttendanceLogRow {
  workDate: string;
  timeIn:   string | null;
  timeOut:  string | null;
  isDayoff: boolean;
  source:   string;
  note:     string | null;
}

interface ViewStaff {
  userId:     number;
  name:       string;
  email:      string;
  role?:      string;
  logs:       AttendanceLogRow[];
  expanded:   boolean;
  present:    number;
  absent:     number;
  dayoff:     number;
}

// ── Edit state ──
interface EditState {
  staffId:  number;
  workDate: string;
  timeIn:   string;
  timeOut:  string;
  isDayoff: boolean;
  note:     string;
  saving:   boolean;
}

// ── Add state ──
interface AddState {
  staffId:  number;
  workDate: string;
  timeIn:   string;
  timeOut:  string;
  isDayoff: boolean;
  note:     string;
  saving:   boolean;
  error:    string;
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

  // ── Main tab ──────────────────────────────
  mainTab: 'upload' | 'view' = 'upload';

  // ── Upload tab state ──────────────────────
  step: 1 | 2 = 1;
  selectedFile: File | null = null;
  isDragging = false;
  isParsing = false;
  parseError = '';
  preview: PreviewResponse | null = null;
  groups: StaffGroup[] = [];
  searchQuery = '';
  filterStatus: 'ALL' | 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'INVALID' = 'ALL';  isSaving = false;
  saveResult: { savedCount: number; updatedCount: number; skippedCount: number; message: string } | null = null;
  saveError = '';
  readonly MAX_SIZE_MB = 5;
  readonly MAX_SIZE_BYTES = this.MAX_SIZE_MB * 1024 * 1024;

  // ── View Attendance tab state ─────────────
  viewPeriod   = '';
  viewPeriods: { value: string; label: string }[] = [];
  viewStaff:   ViewStaff[] = [];
  viewLoading  = false;
  viewError    = '';
  viewSearch   = '';
  viewExpanded = false;

  // ── Attendance edit ──
  editState: EditState | null = null;
  addState:  AddState  | null = null;
  currentAddStaff: ViewStaff | null = null;

  currentUser: any = null;

  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage || this.auth.getUser()?.preferredLanguage, key);
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.buildPeriods();
  }

  // ════════════════════════════════════════
  // MAIN TAB SWITCH
  // ════════════════════════════════════════
  setMainTab(tab: 'upload' | 'view'): void {
    this.mainTab = tab;
    if (tab === 'view' && this.viewStaff.length === 0) {
      this.loadViewAttendance();
    }
    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════
  // VIEW ATTENDANCE
  // ════════════════════════════════════════
  buildPeriods(): void {
    const now = new Date();
    this.viewPeriods = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
      this.viewPeriods.push({ value: val, label });
    }
    this.viewPeriod = this.viewPeriods[0].value;
  }

  onViewPeriodChange(): void {
    this.loadViewAttendance();
  }

  loadViewAttendance(): void {
    if (!this.viewPeriod) return;
    this.viewLoading = true;
    this.viewError   = '';
    this.viewStaff   = [];
    this.cdr.detectChanges();

    // Parse period → from/to dates
    const [y, m] = this.viewPeriod.split('-').map(Number);
    const prevM  = m === 1 ? 12 : m - 1;
    const prevY  = m === 1 ? y - 1 : y;
    const from   = `${prevY}-${String(prevM).padStart(2,'0')}-25`;
    const to     = `${y}-${String(m).padStart(2,'0')}-24`;

    // Load staff list for branch
    const branchId = this.currentUser?.branchId || 3;
    this.http.get<any[]>(`${BASE}/users/staff-list`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: staff => {
          const nonClient = staff.filter(s => s.roleId !== 10);
          let remaining = nonClient.length;
          if (remaining === 0) { this.viewLoading = false; this.cdr.detectChanges(); return; }

          const result: ViewStaff[] = [];

          nonClient.forEach(s => {
            this.http.get<AttendanceLogRow[]>(
              `${BASE}/users/${s.id || s.userId}/attendance?from=${from}&to=${to}`,
              { headers: this.auth.getHeaders() }
            ).subscribe({
              next: logs => {
                const l = logs || [];
                result.push({
                  userId:   s.id || s.userId,
                  name:     s.name,
                  email:    s.email,
                  role:     s.roleDisplayName || s.roleName || s.role,
                  logs:     l,
                  expanded: false,
                  present:  l.filter(r => r.timeIn && !r.isDayoff).length,
                  absent:   l.filter(r => !r.timeIn && !r.isDayoff).length,
                  dayoff:   l.filter(r => r.isDayoff).length,
                });
                remaining--;
                if (remaining === 0) {
                  result.sort((a, b) => a.name.localeCompare(b.name));
                  this.viewStaff  = result;
                  this.viewLoading = false;
                  this.cdr.detectChanges();
                }
              },
              error: () => {
                result.push({
                  userId: s.id || s.userId, name: s.name, email: s.email,
                  role: s.roleDisplayName, logs: [], expanded: false,
                  present: 0, absent: 0, dayoff: 0,
                });
                remaining--;
                if (remaining === 0) {
                  result.sort((a, b) => a.name.localeCompare(b.name));
                  this.viewStaff  = result;
                  this.viewLoading = false;
                  this.cdr.detectChanges();
                }
              }
            });
          });
        },
        error: () => {
          this.viewError   = 'Failed to load staff list';
          this.viewLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  get filteredViewStaff(): ViewStaff[] {
    if (!this.viewSearch.trim()) return this.viewStaff;
    const q = this.viewSearch.toLowerCase();
    return this.viewStaff.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q)
    );
  }

  toggleViewStaff(s: ViewStaff): void {
    s.expanded = !s.expanded;
    this.cdr.detectChanges();
  }

  expandAll(): void { this.viewStaff.forEach(s => s.expanded = true); this.cdr.detectChanges(); }
  collapseAll(): void { this.viewStaff.forEach(s => s.expanded = false); this.cdr.detectChanges(); }

  getLogStatus(log: AttendanceLogRow): string {
    if (log.isDayoff) return 'Day Off';
    if (!log.timeIn)  return 'Absent';
    return 'Present';
  }

  getLogStatusColor(log: AttendanceLogRow): string {
    if (log.isDayoff) return '#ef4444';
    if (!log.timeIn)  return '#f59e0b';
    return '#22c55e';
  }

  calcHoursView(timeIn: string | null, timeOut: string | null): string {
    if (!timeIn || !timeOut) return '—';
    const [hi, mi] = timeIn.split(':').map(Number);
    const [ho, mo] = timeOut.split(':').map(Number);
    const mins = (ho * 60 + mo) - (hi * 60 + mi);
    if (mins <= 0) return '—';
    return `${Math.floor(mins/60)}h${mins%60 ? ' '+(mins%60)+'m' : ''}`;
  }

  getDayName(dateStr: string): string {
    if (!dateStr) return '';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr).getDay()];
  }

  // ── Edit attendance ──
  openEdit(s: ViewStaff, log: AttendanceLogRow): void {
    this.editState = {
      staffId:  s.userId,
      workDate: log.workDate,
      timeIn:   log.timeIn  ? log.timeIn.substring(0, 5)  : '',
      timeOut:  log.timeOut ? log.timeOut.substring(0, 5) : '',
      isDayoff: log.isDayoff || false,
      note:     log.note    || '',
      saving:   false,
    };
    this.cdr.detectChanges();
  }

  closeEdit(): void { this.editState = null; this.cdr.detectChanges(); }

  isEditing(staffId: number, workDate: string): boolean {
    return this.editState?.staffId === staffId && this.editState?.workDate === workDate;
  }

  saveEdit(s: ViewStaff, log: AttendanceLogRow): void {
    if (!this.editState || this.editState.saving) return;
    this.editState.saving = true;
    this.cdr.detectChanges();

    const body = {
      timeIn:   this.editState.isDayoff ? null : (this.editState.timeIn  || null),
      timeOut:  this.editState.isDayoff ? null : (this.editState.timeOut || null),
      isDayoff: this.editState.isDayoff,
      note:     this.editState.note || null,
    };

    this.http.patch(
      `${BASE}/users/${this.editState.staffId}/attendance/${this.editState.workDate}`,
      body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => {
        // Update local log
        log.timeIn   = body.timeIn   ? body.timeIn  + ':00' : null;
        log.timeOut  = body.timeOut  ? body.timeOut + ':00' : null;
        log.isDayoff = body.isDayoff;
        log.note     = body.note;
        log.source   = 'MANUAL';
        // Recalculate stats
        s.present = s.logs.filter(r => r.timeIn && !r.isDayoff).length;
        s.absent  = s.logs.filter(r => !r.timeIn && !r.isDayoff).length;
        s.dayoff  = s.logs.filter(r => r.isDayoff).length;
        this.editState = null;
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.editState) this.editState.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Add new attendance row ──
  openAdd(s: ViewStaff): void {
    this.editState       = null;
    this.currentAddStaff = s;
    const today = new Date().toISOString().substring(0, 10);
    this.addState = {
      staffId:  s.userId,
      workDate: today,
      timeIn:   '08:00',
      timeOut:  '17:00',
      isDayoff: false,
      note:     '',
      saving:   false,
      error:    '',
    };
    // ✅ logs မရသေးရင် load လုပ်မယ်
    if (s.logs.length === 0) {
      const [y, m] = this.viewPeriod.split('-').map(Number);
      const prevM  = m === 1 ? 12 : m - 1;
      const prevY  = m === 1 ? y - 1 : y;
      const from   = `${prevY}-${String(prevM).padStart(2,'0')}-25`;
      const to     = `${y}-${String(m).padStart(2,'0')}-24`;
      this.http.get<AttendanceLogRow[]>(
        `${BASE}/users/${s.userId}/attendance?from=${from}&to=${to}`,
        { headers: this.auth.getHeaders() }
      ).subscribe({
        next: logs => {
          s.logs    = logs || [];
          s.present = s.logs.filter(r => r.timeIn && !r.isDayoff).length;
          s.absent  = s.logs.filter(r => !r.timeIn && !r.isDayoff).length;
          s.dayoff  = s.logs.filter(r => r.isDayoff).length;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
    this.cdr.detectChanges();
  }

  closeAdd(): void {
    this.addState        = null;
    this.currentAddStaff = null;
    this.cdr.detectChanges();
  }

  getStaffName(staffId: number): string {
    return this.viewStaff.find(s => s.userId === staffId)?.name || '';
  }

  isAddingFor(staffId: number): boolean {
    return this.addState?.staffId === staffId;
  }

  saveAdd(s: ViewStaff): void {
    if (!this.addState || this.addState.saving) return;
    const staff = s || this.currentAddStaff;
    if (!staff) return;
    if (!this.addState.workDate) {
      this.addState.error = 'Date is required'; this.cdr.detectChanges(); return;
    }
    const exists = staff.logs.some(l => l.workDate === this.addState!.workDate);
    if (exists) {
      this.addState.error = 'Record already exists for this date';
      this.cdr.detectChanges(); return;
    }
    this.addState.saving = true;
    this.addState.error  = '';
    this.cdr.detectChanges();

    const body = {
      timeIn:   this.addState.isDayoff ? null : (this.addState.timeIn  || null),
      timeOut:  this.addState.isDayoff ? null : (this.addState.timeOut || null),
      isDayoff: this.addState.isDayoff,
      note:     this.addState.note || null,
    };

    this.http.patch(
      `${BASE}/users/${this.addState.staffId}/attendance/${this.addState.workDate}`,
      body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => {
        const newLog: AttendanceLogRow = {
          workDate: this.addState!.workDate,
          timeIn:   body.timeIn  ? body.timeIn  + ':00' : null,
          timeOut:  body.timeOut ? body.timeOut + ':00' : null,
          isDayoff: body.isDayoff,
          source:   'MANUAL',
          note:     body.note,
        };
        staff.logs.push(newLog);
        staff.logs.sort((a, b) => a.workDate.localeCompare(b.workDate));
        staff.present = staff.logs.filter(r => r.timeIn && !r.isDayoff).length;
        staff.absent  = staff.logs.filter(r => !r.timeIn && !r.isDayoff).length;
        staff.dayoff  = staff.logs.filter(r => r.isDayoff).length;
        // Update global stats
        this.cdr.detectChanges();
        this.addState        = null;
        this.currentAddStaff = null;
        this.cdr.detectChanges();
      },
      error: err => {
        if (this.addState) {
          this.addState.saving = false;
          this.addState.error  = err.error?.message || 'Failed to save';
        }
        this.cdr.detectChanges();
      }
    });
  }

  getPeriodLabel(): string {
    const p = this.viewPeriods.find(x => x.value === this.viewPeriod);
    return p?.label || this.viewPeriod;
  }

  getTotalPresent(): number { return this.viewStaff.reduce((s, v) => s + v.present, 0); }
  getTotalAbsent():  number { return this.viewStaff.reduce((s, v) => s + v.absent, 0); }
  getTotalDayOff():  number { return this.viewStaff.reduce((s, v) => s + v.dayoff, 0); }

  // ════════════════════════════════════════
  // UPLOAD TAB (original logic preserved)
  // ════════════════════════════════════════
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging = false; }
  onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  setFile(file: File) {
    this.parseError = '';
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.parseError = 'Only .xlsx or .xls files are supported.';
      this.cdr.detectChanges(); return;
    }
    if (file.size > this.MAX_SIZE_BYTES) {
      this.parseError = `File too large. Max ${this.MAX_SIZE_MB} MB.`;
      this.cdr.detectChanges(); return;
    }
    this.selectedFile = file;
    this.cdr.detectChanges();
    this.uploadAndPreview();
  }

  removeFile() {
    this.selectedFile = null; this.preview = null; this.groups = [];
    this.parseError = ''; this.searchQuery = ''; this.filterStatus = 'ALL';
    this.cdr.detectChanges();
  }

  uploadAndPreview() {
    if (!this.selectedFile) return;
    this.isParsing = true; this.parseError = ''; this.cdr.detectChanges();
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    this.http.post<PreviewResponse>(`${BASE}/attendance/upload-preview`, formData).subscribe({
      next: data => {
        data.rows.forEach(r => { r.selected = r.status === 'MATCHED'; });
        this.preview = data;
        this.groups  = this.buildGroups(data.rows);
        this.isParsing = false; this.cdr.detectChanges();
      },
      error: err => {
        this.parseError   = err.error?.message || this.lbl('Failed to parse');
        this.selectedFile = null; this.isParsing = false; this.cdr.detectChanges();
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
      g.rows.push(r); g.totalDays++;
      if (r.status === 'MATCHED') g.matchedDays++;
      else g.hasIssues = true;
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.rows.sort((a, b) => (a.workDate || '').localeCompare(b.workDate || ''));
      const statuses = new Set(g.rows.map(r => r.status));
      g.status = (statuses.size === 1 ? [...statuses][0] : 'MIXED') as any;
      g.allSelected = g.rows.every(r => r.selected);
    }
    return groups.sort((a, b) => {
      const rank = (s: string) => s === 'MATCHED' ? 99 : s === 'MIXED' ? 1 : 0;
      return rank(a.status) - rank(b.status);
    });
  }

  get filteredGroups(): StaffGroup[] {
    return this.groups.filter(g => {
      const matchSearch = !this.searchQuery ||
        (g.matchedName || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (g.email || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      const fs = this.filterStatus;
      const matchStatus = fs === 'ALL' ||
        g.status === fs ||
        g.rows.some(r => r.status === fs);
      return matchSearch && matchStatus;
    });
  }

  get selectedCount(): number {
    return this.groups.reduce((n, g) => n + g.rows.filter(r => r.selected).length, 0);
  }

  // ✅ aliases for HTML
  get totalSelectedCount(): number { return this.selectedCount; }
  clearAll(): void { this.removeFile(); }
  uploadAnother(): void { this.resetUpload(); }

  // ✅ isLateArrival for view tab
  isLateArrival(timeIn: string): boolean {
    if (!timeIn) return false;
    const [h, m] = timeIn.split(':').map(Number);
    return h > 9 || (h === 9 && m > 0);
  }

  setFilter(f: typeof this.filterStatus) {
    this.filterStatus = this.filterStatus === f ? 'ALL' : f;
  }

  toggleExpand(g: StaffGroup) { g.expanded = !g.expanded; this.cdr.detectChanges(); }
  expandAll2()   { this.groups.forEach(g => g.expanded = true);  this.cdr.detectChanges(); }
  collapseAll2() { this.groups.forEach(g => g.expanded = false); this.cdr.detectChanges(); }

  selectAllMatched() {
    this.groups.forEach(g => g.rows.forEach(r => { if (r.status === 'MATCHED') r.selected = true; }));
    this.groups.forEach(g => g.allSelected = g.rows.every(r => r.selected));
    this.cdr.detectChanges();
  }
  deselectAll() {
    this.groups.forEach(g => { g.rows.forEach(r => r.selected = false); g.allSelected = false; });
    this.cdr.detectChanges();
  }

  toggleGroupSelection(g: StaffGroup, e: Event) {
    e.stopPropagation();
    const newVal = !g.allSelected;
    g.rows.forEach(r => { if (r.status === 'MATCHED') r.selected = newVal; });
    g.allSelected = newVal;
    this.cdr.detectChanges();
  }

  toggleRow(r: ParsedRow, g: StaffGroup, e: Event) {
    e.stopPropagation();
    r.selected = !r.selected;
    g.allSelected = g.rows.every(x => x.selected);
    this.cdr.detectChanges();
  }

  statusBg(s: string): string {
    const m: Record<string, string> = {
      MATCHED: 'rgba(34,197,94,0.12)', UNMATCHED: 'rgba(239,68,68,0.12)',
      DUPLICATE: 'rgba(245,158,11,0.12)', INVALID: 'rgba(239,68,68,0.12)', MIXED: 'rgba(245,158,11,0.12)'
    };
    return m[s] || 'transparent';
  }
  statusColor(s: string): string {
    const m: Record<string, string> = {
      MATCHED: '#22c55e', UNMATCHED: '#ef4444', DUPLICATE: '#f59e0b', INVALID: '#ef4444', MIXED: '#f59e0b'
    };
    return m[s] || '#94a3b8';
  }
  groupStatusDot(s: string): string { return this.statusColor(s); }

  confirmSave() {
    const selectedRows = this.groups.flatMap(g => g.rows.filter(r => r.selected));
    if (selectedRows.length === 0) return;
    this.isSaving = true; this.saveError = ''; this.cdr.detectChanges();
    const payload = selectedRows.map(r => ({
      userId: r.userId, workDate: r.workDate,
      timeIn: r.timeIn || null, timeOut: r.timeOut || null,
      isDayoff: false, note: null,
    }));
    this.http.post<any>(`${BASE}/attendance/confirm-save`,
      { rows: payload }, { headers: this.auth.getHeaders() }).subscribe({
      next: res => {
        this.saveResult = res; this.isSaving = false; this.step = 2;
        // ✅ Get actual pay period from uploaded rows
        const allRows = this.groups.flatMap(g => g.rows.filter(r => r.selected));
        this.createAttendanceAnnouncement(res.savedCount + res.updatedCount, allRows);
        this.cdr.detectChanges();
      },
      error: err => {
        this.saveError = err.error?.message || 'Save failed';
        this.isSaving  = false; this.cdr.detectChanges();
      }
    });
  }

  resetUpload() {
    this.step = 1; this.selectedFile = null; this.preview = null;
    this.groups = []; this.parseError = ''; this.saveResult = null;
    this.searchQuery = ''; this.filterStatus = 'ALL';
    this.cdr.detectChanges();
  }

  // ✅ Auto-create announcement after attendance upload
  createAttendanceAnnouncement(totalRows: number, rows: ParsedRow[] = []): void {
    // ✅ Detect pay period from actual uploaded dates
    let month = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
    let periodLabel = month;

    if (rows.length > 0) {
      // Get all work dates from uploaded rows
      const dates = rows
        .map(r => r.workDate)
        .filter(d => !!d)
        .sort();
      if (dates.length > 0) {
        const minDate = new Date(dates[0]);
        const maxDate = new Date(dates[dates.length - 1]);
        const minStr  = minDate.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
        const maxStr  = maxDate.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
        periodLabel   = `${minStr} – ${maxStr}`;

        // Pay period month = month of maxDate (last date ရဲ့ month)
        month = maxDate.toLocaleString('en', { month: 'long', year: 'numeric' });
      }
    }

    const calcTime = new Date();
    calcTime.setHours(12, 0, 0, 0);
    if (calcTime <= new Date()) calcTime.setDate(calcTime.getDate() + 1);
    const calcStr = calcTime.toLocaleString('en', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    const title   = `📅 Attendance Upload Complete — ${month}`;
    const content = `Fingerprint attendance data (${totalRows} records) for **${periodLabel}** has been uploaded successfully.\n\n` +
      `✅ Please review your attendance records and report any discrepancies.\n\n` +
      `💰 Salary calculation will be processed at ${calcStr}.\n\n` +
      `If you notice any errors in your attendance, contact HR before the calculation time.`;

    const user     = this.auth.getUser();
    const branchId = this.currentUser?.branchId || user?.branchId || 3;

    this.http.post(
      `${BASE}/announcements`,
      { title, content, priority: 'IMPORTANT', targetScope: 'BRANCH', targetId: branchId, expireDays: 1 },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next:  (res) => console.log('[Attendance Announcement] created OK', res),
      error: (err) => console.error('[Attendance Announcement] failed', err),
    });
  }
}
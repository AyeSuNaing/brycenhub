import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;
const HOLIDAYS_BASE  = `${BASE}/public-holidays`;
const BRANCHES_BASE  = `${BASE}/branches`;
const COUNTRIES_BASE = `${BASE}/countries`;
const USERS_BASE     = `${BASE}/users`;

export interface Holiday {
  id?: number;
  countryId?: number;
  holidayDate: string;
  name: string;
  createdBy?: number;
  createdAt?: string;
}

interface CountryInfo { id: number; code: string; name: string; flagEmoji?: string; currency?: string; }
interface StaffMember { id: number; name: string; email?: string; roleId?: number; roleName?: string; roleDisplayName?: string; roleColor?: string; departmentName?: string; isActive?: boolean; skills?: string[]; }
interface HolidayPreset { date: string; name: string; }

@Component({
  selector: 'app-holidays-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './holidays-inline.html',
  styleUrl: './holidays-inline.scss'
})
export class HolidaysInline implements OnInit {
  @Output() back = new EventEmitter<void>();

  currentUser: any = null;
  country: CountryInfo | null = null;
  viewingCountry: CountryInfo | null = null;
  allCountries: CountryInfo[] = [];
  showCountryMenu = false;

  currentYear: number = new Date().getFullYear();
  selectedMonth: number = 0;
  viewMode: 'list' | 'calendar' = 'calendar';
  calendarYear: number = new Date().getFullYear();
  calendarMonth: number = new Date().getMonth();

  holidays: Holiday[] = [];
  loading = true;
  saving = false;
  showForm = false;
  editMode = false;
  form: Holiday = this.emptyForm();
  formError = '';
  deleteTarget: Holiday | null = null;

  staffList: StaffMember[] = [];
  loadingStaff = true;
  staffSearchQuery = '';
  selectedRoleFilter = 'ALL';

  readonly roleFilters: { key: string; label: string; color: string }[] = [
    { key: 'ALL', label: 'All', color: '#94a3b8' },
    { key: 'PROJECT_MANAGER', label: 'PM', color: '#22c55e' },
    { key: 'LEADER', label: 'Leader', color: '#3b82f6' },
    { key: 'DEVELOPER', label: 'Dev', color: '#6366f1' },
    { key: 'Data_Engineer', label: 'Data', color: '#06b6d4' },
    { key: 'ADMIN', label: 'Admin', color: '#f59e0b' },
    { key: 'VICE_PRESIDENT', label: 'VP', color: '#dc2626' },
  ];

  private readonly presets: Record<string, HolidayPreset[]> = {
    KH: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' }, { date: 'YYYY-01-07', name: 'Victory Day' },
      { date: 'YYYY-03-08', name: 'International Women\'s Day' }, { date: 'YYYY-04-14', name: 'Khmer New Year (Day 1)' },
      { date: 'YYYY-04-15', name: 'Khmer New Year (Day 2)' }, { date: 'YYYY-04-16', name: 'Khmer New Year (Day 3)' },
      { date: 'YYYY-05-01', name: 'Labour Day' }, { date: 'YYYY-05-05', name: 'Royal Ploughing Ceremony' },
      { date: 'YYYY-05-14', name: 'King Norodom Sihamoni\'s Birthday' }, { date: 'YYYY-06-18', name: 'Queen Mother\'s Birthday' },
      { date: 'YYYY-09-10', name: 'Pchum Ben (Day 1)' }, { date: 'YYYY-09-11', name: 'Pchum Ben (Day 2)' },
      { date: 'YYYY-09-12', name: 'Pchum Ben (Day 3)' }, { date: 'YYYY-09-24', name: 'Constitution Day' },
      { date: 'YYYY-10-15', name: 'Commemoration of Late King Father' }, { date: 'YYYY-10-29', name: 'King\'s Coronation Day' },
      { date: 'YYYY-11-09', name: 'Independence Day' }, { date: 'YYYY-11-23', name: 'Water Festival (Day 1)' },
      { date: 'YYYY-11-24', name: 'Water Festival (Day 2)' }, { date: 'YYYY-11-25', name: 'Water Festival (Day 3)' },
      { date: 'YYYY-12-29', name: 'Peace Day' },
    ],
    MM: [
      { date: 'YYYY-01-01', name: 'New Year Holiday' }, { date: 'YYYY-01-04', name: 'Independence Day' },
      { date: 'YYYY-02-12', name: 'Union Day' }, { date: 'YYYY-03-02', name: 'Peasants\' Day' },
      { date: 'YYYY-03-27', name: 'Armed Forces Day' }, { date: 'YYYY-04-11', name: 'Maha Thingyan (Day 1)' },
      { date: 'YYYY-04-12', name: 'Maha Thingyan (Day 2)' }, { date: 'YYYY-04-13', name: 'Maha Thingyan (Day 3)' },
      { date: 'YYYY-04-14', name: 'Maha Thingyan (Day 4)' }, { date: 'YYYY-04-15', name: 'Maha Thingyan (Day 5)' },
      { date: 'YYYY-04-16', name: 'Maha Thingyan (Day 6)' }, { date: 'YYYY-04-17', name: 'Maha Thingyan (Day 7)' },
      { date: 'YYYY-04-18', name: 'Maha Thingyan (Day 8)' }, { date: 'YYYY-04-19', name: 'Maha Thingyan (Day 9)' },
      { date: 'YYYY-05-01', name: 'May Day' }, { date: 'YYYY-05-30', name: 'Full Moon Day of Kasong' },
      { date: 'YYYY-07-19', name: 'Martyr\'s Day' }, { date: 'YYYY-07-29', name: 'Full Moon Day of Waso' },
      { date: 'YYYY-10-25', name: 'Full Moon Day of Thadingyut (Day 1)' }, { date: 'YYYY-10-26', name: 'Full Moon Day of Thadingyut (Day 2)' },
      { date: 'YYYY-10-27', name: 'Full Moon Day of Thadingyut (Day 3)' }, { date: 'YYYY-11-23', name: 'Full Moon of Tazaungmone (Day 1)' },
      { date: 'YYYY-11-24', name: 'Full Moon of Tazaungmone (Day 2)' }, { date: 'YYYY-12-04', name: 'National Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
    JP: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day (元日)' }, { date: 'YYYY-01-12', name: 'Coming of Age Day (成人の日)' },
      { date: 'YYYY-02-11', name: 'National Foundation Day' }, { date: 'YYYY-02-23', name: 'Emperor\'s Birthday' },
      { date: 'YYYY-03-20', name: 'Vernal Equinox Day' }, { date: 'YYYY-04-29', name: 'Showa Day' },
      { date: 'YYYY-05-03', name: 'Constitution Day' }, { date: 'YYYY-05-04', name: 'Greenery Day' },
      { date: 'YYYY-05-05', name: 'Children\'s Day' }, { date: 'YYYY-07-20', name: 'Marine Day' },
      { date: 'YYYY-08-11', name: 'Mountain Day' }, { date: 'YYYY-09-21', name: 'Respect for the Aged Day' },
      { date: 'YYYY-09-23', name: 'Autumnal Equinox Day' }, { date: 'YYYY-10-12', name: 'Sports Day' },
      { date: 'YYYY-11-03', name: 'Culture Day' }, { date: 'YYYY-11-23', name: 'Labour Thanksgiving Day' },
    ],
    VN: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' }, { date: 'YYYY-02-16', name: 'Lunar New Year (Tết) — Day 1' },
      { date: 'YYYY-02-17', name: 'Lunar New Year — Day 2' }, { date: 'YYYY-02-18', name: 'Lunar New Year — Day 3' },
      { date: 'YYYY-02-19', name: 'Lunar New Year — Day 4' }, { date: 'YYYY-02-20', name: 'Lunar New Year — Day 5' },
      { date: 'YYYY-04-26', name: 'Hung Kings Festival' }, { date: 'YYYY-04-30', name: 'Reunification Day' },
      { date: 'YYYY-05-01', name: 'Labour Day' }, { date: 'YYYY-09-02', name: 'National Day' },
    ],
    KR: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' }, { date: 'YYYY-02-16', name: 'Seollal — Day 1' },
      { date: 'YYYY-02-17', name: 'Seollal — Day 2' }, { date: 'YYYY-02-18', name: 'Seollal — Day 3' },
      { date: 'YYYY-03-01', name: 'Independence Movement Day' }, { date: 'YYYY-05-05', name: 'Children\'s Day' },
      { date: 'YYYY-05-15', name: 'Buddha\'s Birthday' }, { date: 'YYYY-06-06', name: 'Memorial Day' },
      { date: 'YYYY-08-15', name: 'Liberation Day' }, { date: 'YYYY-09-24', name: 'Chuseok — Day 1' },
      { date: 'YYYY-09-25', name: 'Chuseok — Day 2' }, { date: 'YYYY-09-26', name: 'Chuseok — Day 3' },
      { date: 'YYYY-10-03', name: 'National Foundation Day' }, { date: 'YYYY-10-09', name: 'Hangeul Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
    US: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' }, { date: 'YYYY-01-19', name: 'Martin Luther King Jr. Day' },
      { date: 'YYYY-02-16', name: 'Presidents\' Day' }, { date: 'YYYY-05-25', name: 'Memorial Day' },
      { date: 'YYYY-06-19', name: 'Juneteenth' }, { date: 'YYYY-07-04', name: 'Independence Day' },
      { date: 'YYYY-09-07', name: 'Labor Day' }, { date: 'YYYY-10-12', name: 'Columbus Day' },
      { date: 'YYYY-11-11', name: 'Veterans Day' }, { date: 'YYYY-11-26', name: 'Thanksgiving Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
  };

  private readonly flagFallback: Record<string, string> = {
    KH: '🇰🇭', MM: '🇲🇲', JP: '🇯🇵', VN: '🇻🇳', KR: '🇰🇷', US: '🇺🇸',
  };

  constructor(private http: HttpClient, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadAllCountries();
    this.resolveCountryThenLoad();
    this.loadStaff();
  }

  private get headers() { return this.auth.getHeaders(); }

  lbl(key: AppLabelKey): string {
    return getLabel(this.currentUser?.preferredLanguage, key);
  }

  private loadAllCountries(): void {
    this.http.get<CountryInfo[]>(`${COUNTRIES_BASE}`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.allCountries = list || [];
        // BOSS/CD — branchId မရှိ → first country default select ပြီး holidays load
        if (this.isGlobalAdmin && !this.viewingCountry && list.length > 0) {
          this.viewingCountry = list[0];
          this.loadHolidays();
        }
        this.cdr.detectChanges();
      });
  }

  private resolveCountryThenLoad(): void {
    // BOSS/CD — loadAllCountries() မှာ handle ပြီး (branchId မရှိဘူး)
    if (this.isGlobalAdmin) return;

    const branchId = this.currentUser?.branchId;
    if (!branchId) { this.country = null; this.viewingCountry = null; this.loadHolidays(); return; }
    this.http.get<any>(`${BRANCHES_BASE}/${branchId}`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(branch => {
        if (!branch?.countryId) { this.country = null; this.viewingCountry = null; this.loadHolidays(); return; }
        this.http.get<CountryInfo>(`${COUNTRIES_BASE}/${branch.countryId}`, { headers: this.headers })
          .pipe(catchError(() => of(null)))
          .subscribe(country => { this.country = country; this.viewingCountry = country; this.loadHolidays(); });
      });
  }

  toggleCountryMenu(): void { this.showCountryMenu = !this.showCountryMenu; }
  selectCountry(c: CountryInfo): void { this.viewingCountry = c; this.showCountryMenu = false; this.loadHolidays(); }
  get isViewingOwnCountry(): boolean { if (!this.country || !this.viewingCountry) return true; return this.country.id === this.viewingCountry.id; }
  get countryFlag(): string { const c = this.viewingCountry; if (!c) return '🌍'; return c.flagEmoji || this.flagFallback[c.code] || '🌍'; }
  get countryName(): string { return this.viewingCountry?.name || 'Global'; }
  get seedButtonLabel(): string { if (!this.viewingCountry) return 'No country'; return `${this.countryFlag} Seed ${this.countryName} ${this.currentYear}`; }
  get hasPresetForCountry(): boolean { return !!this.viewingCountry?.code && !!this.presets[this.viewingCountry.code]; }
  getFlagFor(c: CountryInfo): string { return c.flagEmoji || this.flagFallback[c.code] || '🌍'; }
  get userRoleName(): string { return this.currentUser?.role || this.currentUser?.roleName || ''; }
  get isGlobalAdmin(): boolean { const r = this.userRoleName; return r === 'BOSS' || r === 'COUNTRY_DIRECTOR'; }
  get canEdit(): boolean { if (!this.viewingCountry) return false; return this.userRoleName === 'ADMIN'; }

  loadHolidays(): void {
    this.loading = true;
    const countryId = this.viewingCountry?.id;
    const url = countryId ? `${HOLIDAYS_BASE}/by-country/${countryId}?year=${this.currentYear}` : `${HOLIDAYS_BASE}?year=${this.currentYear}`;
    this.http.get<Holiday[]>(url, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.holidays = list || []; this.loading = false; this.cdr.detectChanges(); });
  }

  changeYear(delta: number): void { this.currentYear += delta; this.loadHolidays(); }

  loadStaff(): void {
    this.loadingStaff = true;
    this.http.get<StaffMember[]>(`${USERS_BASE}/staff-list`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.staffList = (list || []).filter(u => u.isActive !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.loadingStaff = false; this.cdr.detectChanges();
      });
  }

  get filteredStaff(): StaffMember[] {
    const query = this.staffSearchQuery.toLowerCase().trim();
    return this.staffList.filter(s => {
      if (this.selectedRoleFilter !== 'ALL' && s.roleName !== this.selectedRoleFilter) return false;
      if (query) { const n = (s.name || '').toLowerCase(); const e = (s.email || '').toLowerCase(); if (!n.includes(query) && !e.includes(query)) return false; }
      return true;
    });
  }

  get staffCountByRole(): Record<string, number> {
    const counts: Record<string, number> = { ALL: this.staffList.length };
    for (const s of this.staffList) { const key = s.roleName || 'UNKNOWN'; counts[key] = (counts[key] || 0) + 1; }
    return counts;
  }

  getInitial(name: string): string { return (name || '?').trim().charAt(0).toUpperCase(); }
  toTitleCase(name: string): string { if (!name) return ''; return name.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()); }
  getAvatarColor(id: number): string { const colors = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2']; return colors[Math.abs(id || 0) % colors.length]; }
  setRoleFilter(key: string): void { this.selectedRoleFilter = key; }

  private emptyForm(): Holiday { return { holidayDate: new Date().toISOString().split('T')[0], name: '' }; }
  openCreateForm(): void { this.form = this.emptyForm(); this.editMode = false; this.showForm = true; this.formError = ''; }
  openEditForm(h: Holiday): void { this.form = { ...h }; this.editMode = true; this.showForm = true; this.formError = ''; }
  closeForm(): void { this.showForm = false; this.formError = ''; }

  saveForm(): void {
    if (!this.form.holidayDate || !this.form.name?.trim()) { this.formError = 'Date and name are required'; return; }
    this.saving = true; this.formError = '';
    const payload: any = { holidayDate: this.form.holidayDate, name: this.form.name.trim() };
    if (!this.editMode && this.viewingCountry?.id) payload.countryId = this.viewingCountry.id;
    const req$ = this.editMode && this.form.id
      ? this.http.put<Holiday>(`${HOLIDAYS_BASE}/${this.form.id}`, payload, { headers: this.headers })
      : this.http.post<Holiday>(HOLIDAYS_BASE, payload, { headers: this.headers });
    req$.pipe(catchError(err => { this.formError = err?.error?.message || 'Failed to save'; this.saving = false; this.cdr.detectChanges(); return of(null); }))
      .subscribe(res => { this.saving = false; if (res) { this.showForm = false; this.loadHolidays(); } });
  }

  confirmDelete(h: Holiday): void { this.deleteTarget = h; }
  cancelDelete(): void { this.deleteTarget = null; }
  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    const id = this.deleteTarget.id;
    this.http.delete(`${HOLIDAYS_BASE}/${id}`, { headers: this.headers })
      .pipe(catchError(() => { alert('Failed to delete'); return of(null); }))
      .subscribe(res => { if (res !== null) { this.deleteTarget = null; this.loadHolidays(); } });
  }

  seedCountryPreset(): void {
    if (!this.viewingCountry || !this.hasPresetForCountry) { alert('No preset available'); return; }
    const preset = this.presets[this.viewingCountry.code];
    const holidays = preset.map(p => ({ date: p.date.replace('YYYY', String(this.currentYear)), name: p.name }));
    if (!confirm(`Seed ${holidays.length} ${this.countryName} holidays for ${this.currentYear}?\n\nExisting dates will be skipped.`)) return;
    this.saving = true;
    this.http.post<any>(`${HOLIDAYS_BASE}/bulk`, { countryId: this.viewingCountry.id, holidays }, { headers: this.headers })
      .pipe(catchError(err => { alert('Failed: ' + (err?.error?.message || 'Unknown')); this.saving = false; return of(null); }))
      .subscribe(res => { this.saving = false; if (res) { alert(res.message || `Created ${res.created}, skipped ${res.skipped}`); this.loadHolidays(); } });
  }

  get filteredHolidays(): Holiday[] {
    if (this.selectedMonth === 0) return this.holidays;
    return this.holidays.filter(h => new Date(h.holidayDate).getMonth() + 1 === this.selectedMonth);
  }

  get holidaysByMonth(): { month: string; monthNum: number; items: Holiday[] }[] {
    const grouped: { [k: number]: Holiday[] } = {};
    for (const h of this.filteredHolidays) { const m = new Date(h.holidayDate).getMonth() + 1; if (!grouped[m]) grouped[m] = []; grouped[m].push(h); }
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Object.keys(grouped).map(k => Number(k)).sort((a,b) => a-b).map(m => ({ month: names[m-1], monthNum: m, items: grouped[m].sort((a,b) => a.holidayDate.localeCompare(b.holidayDate)) }));
  }

  formatDate(iso: string): string { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  formatDay(iso: string): string { const d = new Date(iso); return d.toLocaleDateString('en-US', { weekday: 'short' }); }
  isWeekend(iso: string): boolean { const d = new Date(iso).getDay(); return d === 0 || d === 6; }
  onBack(): void { this.back.emit(); }

  get statsTotal(): number { return this.holidays.length; }
  get statsThisMonth(): number { const m = this.calendarMonth+1; const y = this.calendarYear; return this.holidays.filter(h => { const d = new Date(h.holidayDate); return d.getFullYear()===y && (d.getMonth()+1)===m; }).length; }
  get statsUpcoming(): number { const today = new Date(); today.setHours(0,0,0,0); const in30 = new Date(today); in30.setDate(today.getDate()+30); return this.holidays.filter(h => { const d = new Date(h.holidayDate); return d>=today && d<=in30; }).length; }
  get statsWeekendOverlap(): number { return this.holidays.filter(h => this.isWeekend(h.holidayDate)).length; }
  get calendarMonthShort(): string { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][this.calendarMonth]; }
  setViewMode(mode: 'list' | 'calendar'): void { this.viewMode = mode; }

  get holidayMap(): Map<string, Holiday> {
    const map = new Map<string, Holiday>();
    for (const h of this.holidays) map.set(h.holidayDate.split('T')[0], h);
    return map;
  }

  get calendarMonthName(): string { return ['January','February','March','April','May','June','July','August','September','October','November','December'][this.calendarMonth]; }

  get calendarGrid(): CalendarCell[][] {
    const weeks: CalendarCell[][] = [];
    const year = this.calendarYear; const month = this.calendarMonth;
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstDay.getDay());
    const today = this.toIsoDate(new Date());
    const hMap = this.holidayMap;
    for (let w = 0; w < 6; w++) {
      const week: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(gridStart); cellDate.setDate(gridStart.getDate() + (w*7) + d);
        const iso = this.toIsoDate(cellDate);
        week.push({ date: cellDate, iso, day: cellDate.getDate(), isCurrentMonth: cellDate.getMonth()===month, isWeekend: d===0||d===6, isToday: iso===today, holiday: hMap.get(iso)||null });
      }
      weeks.push(week);
    }
    return weeks;
  }

  changeCalendarMonth(delta: number): void {
    let m = this.calendarMonth + delta; let y = this.calendarYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    this.calendarMonth = m; this.calendarYear = y;
    if (y !== this.currentYear) { this.currentYear = y; this.loadHolidays(); }
  }

  goToToday(): void {
    const now = new Date(); this.calendarYear = now.getFullYear(); this.calendarMonth = now.getMonth();
    if (this.calendarYear !== this.currentYear) { this.currentYear = this.calendarYear; this.loadHolidays(); }
  }

  onCellClick(cell: CalendarCell): void {
    if (!cell.isCurrentMonth || !this.canEdit) return;
    if (cell.holiday) { this.openEditForm(cell.holiday); }
    else { this.form = { holidayDate: cell.iso, name: '' }; this.editMode = false; this.showForm = true; this.formError = ''; }
  }

  private toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
}

export interface CalendarCell {
  date: Date; iso: string; day: number;
  isCurrentMonth: boolean; isWeekend: boolean; isToday: boolean; holiday: Holiday | null;
}
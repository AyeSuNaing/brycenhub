import {
  Component, OnInit, ChangeDetectorRef, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';
import { environment } from '../../environments/environment';

const BASE           = environment.apiBaseUrl;
const HOLIDAYS_BASE  = `${BASE}/public-holidays`;
const COUNTRIES_BASE = `${BASE}/countries`;
const BRANCHES_BASE  = `${BASE}/branches`;

const COUNTRY_COLORS: Record<string, string> = {
  JP: '#3b82f6', MM: '#f59e0b', KH: '#ef4444',
  VN: '#22c55e', KR: '#8b5cf6', US: '#06b6d4',
  TH: '#ec4899', SG: '#f97316',
};

interface Holiday {
  id?: number; countryId?: number;
  holidayDate: string; name: string;
  createdBy?: number; createdAt?: string;
}
interface HolidayWithMeta extends Holiday {
  _countryCode?: string; _countryColor?: string; _countryFlag?: string;
}
interface CountryInfo {
  id: number; code: string; name: string; flagEmoji?: string; currency?: string;
}
interface HolidayPreset { date: string; name: string; }
interface CalendarCell {
  day: number; isCurrentMonth: boolean; dateStr: string;
  isToday: boolean; isWeekend: boolean; holidays: HolidayWithMeta[];
}
// Popup for day click
interface DayPopup {
  dateStr: string; holidays: HolidayWithMeta[];
  x: number; y: number;
}

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
  get headers(): HttpHeaders { return this.auth.getHeaders(); }
  lbl(key: AppLabelKey): string { return getLabel(this.currentUser?.preferredLanguage, key); }

  // ── Countries ──────────────────────────────────────────────────
  allCountries:      CountryInfo[] = [];
  selectedCountries: CountryInfo[] = [];
  myCountry:         CountryInfo | null = null;

  // ── Holidays ───────────────────────────────────────────────────
  holidays:    HolidayWithMeta[] = [];
  loadingSet = new Set<number>();
  get loading() { return this.loadingSet.size > 0; }

  // ── View ───────────────────────────────────────────────────────
  viewMode: 'calendar' | 'yearly' | 'list' = 'calendar';

  // Monthly
  calendarYear:  number = new Date().getFullYear();
  calendarMonth: number = new Date().getMonth();

  // Yearly
  yearlyYear: number = new Date().getFullYear();

  // List
  currentYear   = new Date().getFullYear();
  selectedMonth = 0;

  // ── Day popup ─────────────────────────────────────────────────
  popup: DayPopup | null = null;

  // ── Form ──────────────────────────────────────────────────────
  showForm = false; editMode = false; saving = false;
  formError = ''; deleteTarget: HolidayWithMeta | null = null;
  form: Holiday = this.emptyForm();

  // ── Presets ───────────────────────────────────────────────────
  private readonly presets: Record<string, HolidayPreset[]> = {
    KH: [
      { date:'YYYY-01-01', name:"New Year's Day" }, { date:'YYYY-01-07', name:'Victory Day' },
      { date:'YYYY-03-08', name:"International Women's Day" },
      { date:'YYYY-04-14', name:'Khmer New Year (Day 1)' }, { date:'YYYY-04-15', name:'Khmer New Year (Day 2)' },
      { date:'YYYY-04-16', name:'Khmer New Year (Day 3)' }, { date:'YYYY-05-01', name:'Labour Day' },
      { date:'YYYY-05-14', name:'Royal Ploughing Ceremony' }, { date:'YYYY-06-18', name:"King's Birthday" },
      { date:'YYYY-09-24', name:'Constitution Day' }, { date:'YYYY-10-15', name:"King Father's Commemoration" },
      { date:'YYYY-10-23', name:'Paris Peace Agreement Day' }, { date:'YYYY-10-29', name:"King's Coronation Day" },
      { date:'YYYY-11-09', name:'Independence Day' }, { date:'YYYY-11-20', name:'Water Festival' },
    ],
    MM: [
      { date:'YYYY-01-04', name:'Independence Day' }, { date:'YYYY-02-12', name:'Union Day' },
      { date:'YYYY-03-02', name:'Peasants Day' }, { date:'YYYY-04-13', name:'Thingyan Day 1' },
      { date:'YYYY-04-14', name:'Thingyan Day 2' }, { date:'YYYY-04-15', name:'Thingyan Day 3' },
      { date:'YYYY-04-16', name:'Myanmar New Year' }, { date:'YYYY-05-01', name:'Workers Day' },
      { date:'YYYY-07-19', name:'Martyrs Day' }, { date:'YYYY-12-25', name:'Christmas Day' },
    ],
    JP: [
      { date:'YYYY-01-01', name:"New Year's Day" }, { date:'YYYY-01-13', name:'Coming of Age Day' },
      { date:'YYYY-02-11', name:'National Foundation Day' }, { date:'YYYY-03-20', name:'Vernal Equinox Day' },
      { date:'YYYY-04-29', name:'Showa Day' }, { date:'YYYY-05-03', name:'Constitution Day' },
      { date:'YYYY-05-04', name:'Greenery Day' }, { date:'YYYY-05-05', name:"Children's Day" },
      { date:'YYYY-07-21', name:'Marine Day' }, { date:'YYYY-08-11', name:'Mountain Day' },
      { date:'YYYY-09-15', name:'Respect for the Aged Day' }, { date:'YYYY-10-13', name:'Sports Day' },
      { date:'YYYY-11-03', name:'Culture Day' }, { date:'YYYY-11-23', name:'Labour Thanksgiving Day' },
    ],
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.currentUser = this.auth.getUser();
    this.loadAllCountries();
  }

  // ── Role ──────────────────────────────────────────────────────
  get userRoleName(): string { return this.currentUser?.role || this.currentUser?.roleName || ''; }
  get isGlobalAdmin(): boolean {
    const r = this.userRoleName;
    return r === 'BOSS' || r === 'COUNTRY_DIRECTOR' || this.isSuperAdmin;
  }
  get isSuperAdmin(): boolean { return this.userRoleName === 'ADMIN' && !this.currentUser?.branchId; }
  get canEdit(): boolean     { return this.userRoleName === 'ADMIN' && !!this.currentUser?.branchId; }

  // ── Country helpers ───────────────────────────────────────────
  countryColor(code: string): string { return COUNTRY_COLORS[code?.toUpperCase()] || '#64748b'; }
  getFlagFor(c: CountryInfo): string  { return c?.flagEmoji || '🌐'; }
  isSelected(c: CountryInfo): boolean { return this.selectedCountries.some(s => s.id === c.id); }

  toggleCountry(c: CountryInfo) {
    const idx = this.selectedCountries.findIndex(s => s.id === c.id);
    if (idx >= 0) {
      this.selectedCountries.splice(idx, 1);
      this.holidays = this.holidays.filter(h => h.countryId !== c.id);
    } else {
      this.selectedCountries.push(c);
      this.loadHolidaysForCountry(c);
    }
    this.cdr.detectChanges();
  }

  loadAllCountries() {
    this.http.get<CountryInfo[]>(COUNTRIES_BASE, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.allCountries = list || [];
        if (this.isGlobalAdmin) {
          if (list.length > 0) { this.selectedCountries = [list[0]]; this.loadHolidaysForCountry(list[0]); }
        } else { this.resolveMyCountry(); }
        this.cdr.detectChanges();
      });
  }

  resolveMyCountry() {
    const branchId = this.currentUser?.branchId;
    if (!branchId) return;
    this.http.get<any>(`${BRANCHES_BASE}/${branchId}`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(branch => {
        if (!branch?.countryId) return;
        const c = this.allCountries.find(x => x.id === branch.countryId);
        if (c) { this.myCountry = c; this.selectedCountries = [c]; this.loadHolidaysForCountry(c); }
      });
  }

  loadHolidaysForCountry(c: CountryInfo, year?: number) {
    const y = year || this.yearlyYear;
    this.loadingSet.add(c.id);
    const url = `${HOLIDAYS_BASE}/by-country/${c.id}?year=${y}`;
    this.http.get<Holiday[]>(url, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.holidays = this.holidays.filter(h => h.countryId !== c.id);
        const withMeta: HolidayWithMeta[] = (list || []).map(h => ({
          ...h, _countryCode: c.code,
          _countryColor: this.countryColor(c.code),
          _countryFlag: this.getFlagFor(c),
        }));
        this.holidays = [...this.holidays, ...withMeta];
        this.loadingSet.delete(c.id);
        this.cdr.detectChanges();
      });
  }

  reloadAllSelected(year?: number) {
    this.holidays = [];
    for (const c of this.selectedCountries) this.loadHolidaysForCountry(c, year);
  }

  // ── Stats ─────────────────────────────────────────────────────
  get statsTotal(): number { return this.holidays.filter(h => new Date(h.holidayDate).getFullYear() === this.yearlyYear).length; }
  get statsThisMonth(): number {
    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      return d.getFullYear() === this.calendarYear && d.getMonth() === this.calendarMonth;
    }).length;
  }
  get statsUpcoming(): number {
    const today = new Date(); today.setHours(0,0,0,0);
    const in30  = new Date(today); in30.setDate(today.getDate() + 30);
    return this.holidays.filter(h => { const d = new Date(h.holidayDate); return d >= today && d <= in30; }).length;
  }
  get statsWeekendOverlap(): number {
    return this.holidays.filter(h => { const d = new Date(h.holidayDate); return d.getDay() === 0 || d.getDay() === 6; }).length;
  }

  // ── Monthly helpers ───────────────────────────────────────────
  get calendarMonthName(): string { return ['January','February','March','April','May','June','July','August','September','October','November','December'][this.calendarMonth]; }
  get calendarMonthShort(): string { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][this.calendarMonth]; }

  // Global holiday map (all selected countries, all dates)
  get globalHolidayMap(): Map<string, HolidayWithMeta[]> {
    const map = new Map<string, HolidayWithMeta[]>();
    for (const h of this.holidays) {
      const key = h.holidayDate.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return map;
  }

  buildGrid(year: number, month: number): CalendarCell[][] {
    const weeks: CalendarCell[][] = [];
    const firstDay  = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstDay.getDay());
    const todayStr  = this.toIsoDate(new Date());
    const hMap      = this.globalHolidayMap;
    for (let w = 0; w < 6; w++) {
      const week: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date    = new Date(gridStart); date.setDate(gridStart.getDate() + w * 7 + d);
        const dateStr = this.toIsoDate(date);
        week.push({
          day: date.getDate(), isCurrentMonth: date.getMonth() === month,
          dateStr, isToday: dateStr === todayStr,
          isWeekend: d === 0 || d === 6,
          holidays: hMap.get(dateStr) || [],
        });
      }
      weeks.push(week);
    }
    const last = weeks[5];
    if (last && last.every(c => !c.isCurrentMonth)) weeks.pop();
    return weeks;
  }

  get calendarGrid(): CalendarCell[][] { return this.buildGrid(this.calendarYear, this.calendarMonth); }

  prevMonth() {
    if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
    else this.calendarMonth--;
    this.reloadAllSelected(this.calendarYear);
  }
  nextMonth() {
    if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
    else this.calendarMonth++;
    this.reloadAllSelected(this.calendarYear);
  }
  goToday() { this.calendarYear = new Date().getFullYear(); this.calendarMonth = new Date().getMonth(); this.reloadAllSelected(this.calendarYear); }

  // ── Yearly ────────────────────────────────────────────────────
  readonly MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  readonly MONTH_ROWS = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]]; // 4 rows × 3 cols

  prevYear() { this.yearlyYear--; this.reloadAllSelected(this.yearlyYear); }
  nextYear() { this.yearlyYear++; this.reloadAllSelected(this.yearlyYear); }

  getMiniGrid(monthIdx: number): CalendarCell[][] {
    return this.buildGrid(this.yearlyYear, monthIdx);
  }

  holidaysInMonth(monthIdx: number): HolidayWithMeta[] {
    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      return d.getFullYear() === this.yearlyYear && d.getMonth() === monthIdx;
    }).sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  }

  clickMiniMonth(monthIdx: number) {
    this.calendarYear = this.yearlyYear; this.calendarMonth = monthIdx;
    this.viewMode = 'calendar'; this.cdr.detectChanges();
  }

  // ── Day Popup ─────────────────────────────────────────────────
  openPopup(cell: CalendarCell, event: MouseEvent) {
    if (!cell.isCurrentMonth || cell.holidays.length === 0) { this.popup = null; return; }
    this.popup = { dateStr: cell.dateStr, holidays: cell.holidays, x: event.clientX, y: event.clientY };
    event.stopPropagation();
    this.cdr.detectChanges();
  }
  closePopup() { this.popup = null; this.cdr.detectChanges(); }

  // ── List ──────────────────────────────────────────────────────
  get filteredHolidays(): HolidayWithMeta[] {
    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      if (d.getFullYear() !== this.currentYear) return false;
      if (this.selectedMonth && (d.getMonth() + 1) !== this.selectedMonth) return false;
      return true;
    }).sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  }
  changeYear(delta: number) { this.currentYear += delta; this.reloadAllSelected(this.currentYear); }

  // ── Form ──────────────────────────────────────────────────────
  emptyForm(): Holiday { return { holidayDate: '', name: '', countryId: this.myCountry?.id }; }
  openCreateForm() { this.form = this.emptyForm(); this.editMode = false; this.showForm = true; this.formError = ''; }
  openEditForm(h: HolidayWithMeta) { this.form = { id: h.id, holidayDate: h.holidayDate?.split('T')[0], name: h.name, countryId: h.countryId }; this.editMode = true; this.showForm = true; this.formError = ''; }
  cancelForm() { this.showForm = false; this.formError = ''; }

  saveHoliday() {
    if (!this.form.name?.trim()) { this.formError = 'Name required'; return; }
    if (!this.form.holidayDate)  { this.formError = 'Date required'; return; }
    if (!this.form.countryId)    { this.formError = 'Country required'; return; }
    this.saving = true;
    const body    = { name: this.form.name.trim(), holidayDate: this.form.holidayDate, countryId: this.form.countryId };
    const headers = this.headers;
    const req = this.editMode
      ? this.http.put(`${HOLIDAYS_BASE}/${this.form.id}`, body, { headers })
      : this.http.post(HOLIDAYS_BASE, body, { headers });
    req.pipe(catchError(() => of(null))).subscribe(res => {
      this.saving = false;
      if (res) { this.showForm = false; const c = this.selectedCountries.find(x => x.id === this.form.countryId); if (c) this.loadHolidaysForCountry(c, this.calendarYear); }
      else { this.formError = 'Failed to save'; }
      this.cdr.detectChanges();
    });
  }

  askDelete(h: HolidayWithMeta) { this.deleteTarget = h; }
  cancelDelete() { this.deleteTarget = null; }
  confirmDelete() {
    if (!this.deleteTarget?.id) return;
    const id = this.deleteTarget.id; this.deleteTarget = null;
    this.http.delete(`${HOLIDAYS_BASE}/${id}`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(() => { this.holidays = this.holidays.filter(h => h.id !== id); this.cdr.detectChanges(); });
  }

  // ── Presets ───────────────────────────────────────────────────
  hasPreset(code: string): boolean { return !!this.presets[code]; }
  seedPresets(c: CountryInfo) {
    const list = this.presets[c.code]; if (!list) return;
    const year = this.calendarYear;
    const reqs = list.map(p => {
      const body = { name: p.name, holidayDate: p.date.replace('YYYY', String(year)), countryId: c.id };
      return this.http.post(HOLIDAYS_BASE, body, { headers: this.headers }).pipe(catchError(() => of(null)));
    });
    forkJoin(reqs).subscribe(() => this.loadHolidaysForCountry(c, year));
  }

  // ── Helpers ───────────────────────────────────────────────────
  toIsoDate(d: Date): string {
    // Local date (not UTC) — timezone fix for Cambodia UTC+7
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  isWeekend(dateStr: string): boolean { const d = new Date(dateStr); return d.getDay() === 0 || d.getDay() === 6; }
  formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  formatDateFull(dateStr: string): string { return new Date(dateStr).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }); }
  getDayName(dateStr: string): string { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr).getDay()]; }
}
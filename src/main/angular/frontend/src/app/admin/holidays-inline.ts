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

interface CountryInfo {
  id: number;
  code: string;
  name: string;
  flagEmoji?: string;
  currency?: string;
}

interface StaffMember {
  id: number;
  name: string;
  email?: string;
  roleId?: number;
  roleName?: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
  isActive?: boolean;
  skills?: string[];
}

interface HolidayPreset {
  date: string;
  name: string;
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
  country: CountryInfo | null = null;          // Admin's OWN country (for edit permissions)
  viewingCountry: CountryInfo | null = null;   // Country being VIEWED (can differ)
  allCountries: CountryInfo[] = [];            // All 6 countries for dropdown
  showCountryMenu = false;

  currentYear: number = new Date().getFullYear();
  selectedMonth: number = 0;

  // View mode
  viewMode: 'list' | 'calendar' = 'calendar';

  // Calendar navigator (separate from year/month filter)
  calendarYear: number = new Date().getFullYear();
  calendarMonth: number = new Date().getMonth();  // 0-indexed (0=Jan)

  holidays: Holiday[] = [];
  loading = true;
  saving = false;

  // Form state
  showForm = false;
  editMode = false;
  form: Holiday = this.emptyForm();
  formError = '';

  // Delete
  deleteTarget: Holiday | null = null;

  // ─── Right Panel: Staff ──────────────────────
  staffList: StaffMember[] = [];
  loadingStaff = true;
  staffSearchQuery = '';
  selectedRoleFilter = 'ALL';

  readonly roleFilters: { key: string; label: string; color: string }[] = [
    { key: 'ALL',              label: 'All',    color: '#94a3b8' },
    { key: 'PROJECT_MANAGER',  label: 'PM',     color: '#22c55e' },
    { key: 'LEADER',           label: 'Leader', color: '#3b82f6' },
    { key: 'DEVELOPER',        label: 'Dev',    color: '#6366f1' },
    { key: 'Data_Engineer',    label: 'Data',   color: '#06b6d4' },
    { key: 'ADMIN',            label: 'Admin',  color: '#f59e0b' },
    { key: 'VICE_PRESIDENT',   label: 'VP',     color: '#dc2626' },
  ];

  // ─────────────────────────────────────────────
  // Country preset dictionary
  // ─────────────────────────────────────────────
  private readonly presets: Record<string, HolidayPreset[]> = {
    KH: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' },
      { date: 'YYYY-01-07', name: 'Victory Day' },
      { date: 'YYYY-03-08', name: 'International Women\'s Day' },
      { date: 'YYYY-04-14', name: 'Khmer New Year (Day 1)' },
      { date: 'YYYY-04-15', name: 'Khmer New Year (Day 2)' },
      { date: 'YYYY-04-16', name: 'Khmer New Year (Day 3)' },
      { date: 'YYYY-05-01', name: 'Labour Day' },
      { date: 'YYYY-05-05', name: 'Royal Ploughing Ceremony' },
      { date: 'YYYY-05-14', name: 'King Norodom Sihamoni\'s Birthday' },
      { date: 'YYYY-06-18', name: 'Queen Mother\'s Birthday' },
      { date: 'YYYY-09-10', name: 'Pchum Ben (Day 1)' },
      { date: 'YYYY-09-11', name: 'Pchum Ben (Day 2)' },
      { date: 'YYYY-09-12', name: 'Pchum Ben (Day 3)' },
      { date: 'YYYY-09-24', name: 'Constitution Day' },
      { date: 'YYYY-10-15', name: 'Commemoration of Late King Father' },
      { date: 'YYYY-10-29', name: 'King\'s Coronation Day' },
      { date: 'YYYY-11-09', name: 'Independence Day' },
      { date: 'YYYY-11-23', name: 'Water Festival (Day 1)' },
      { date: 'YYYY-11-24', name: 'Water Festival (Day 2)' },
      { date: 'YYYY-11-25', name: 'Water Festival (Day 3)' },
      { date: 'YYYY-12-29', name: 'Peace Day' },
    ],
    // ── Myanmar (MM) — 2026 Official Public Holidays ──
    MM: [
      // January
      { date: 'YYYY-01-01', name: 'New Year Holiday' },
      { date: 'YYYY-01-04', name: 'Independence Day' },

      // February
      { date: 'YYYY-02-12', name: 'Union Day' },

      // March
      { date: 'YYYY-03-02', name: 'Peasants\' Day' },
      { date: 'YYYY-03-27', name: 'Armed Forces Day' },

      // April — Maha Thingyan (Water Festival) 9 days
      { date: 'YYYY-04-11', name: 'Maha Thingyan (Day 1)' },
      { date: 'YYYY-04-12', name: 'Maha Thingyan (Day 2)' },
      { date: 'YYYY-04-13', name: 'Maha Thingyan (Day 3)' },
      { date: 'YYYY-04-14', name: 'Maha Thingyan (Day 4)' },
      { date: 'YYYY-04-15', name: 'Maha Thingyan (Day 5)' },
      { date: 'YYYY-04-16', name: 'Maha Thingyan (Day 6)' },
      { date: 'YYYY-04-17', name: 'Maha Thingyan (Day 7)' },
      { date: 'YYYY-04-18', name: 'Maha Thingyan (Day 8)' },
      { date: 'YYYY-04-19', name: 'Maha Thingyan (Day 9)' },

      // May
      { date: 'YYYY-05-01', name: 'May Day' },
      { date: 'YYYY-05-30', name: 'Full Moon Day of Kasong' },

      // July
      { date: 'YYYY-07-19', name: 'Martyr\'s Day' },
      { date: 'YYYY-07-29', name: 'Full Moon Day of Waso (Beginning of Buddhist Lent)' },

      // October — Thadingyut (End of Buddhist Lent) 3 days
      { date: 'YYYY-10-25', name: 'Full Moon Day of Thadingyut (Day 1)' },
      { date: 'YYYY-10-26', name: 'Full Moon Day of Thadingyut (Day 2)' },
      { date: 'YYYY-10-27', name: 'Full Moon Day of Thadingyut (Day 3)' },

      // November — Tazaungmone 2 days
      { date: 'YYYY-11-23', name: 'Full Moon of Tazaungmone (Day 1)' },
      { date: 'YYYY-11-24', name: 'Full Moon of Tazaungmone (Day 2)' },

      // December
      { date: 'YYYY-12-04', name: 'National Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
    JP: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day (元日)' },
      { date: 'YYYY-01-12', name: 'Coming of Age Day (成人の日)' },
      { date: 'YYYY-02-11', name: 'National Foundation Day' },
      { date: 'YYYY-02-23', name: 'Emperor\'s Birthday' },
      { date: 'YYYY-03-20', name: 'Vernal Equinox Day' },
      { date: 'YYYY-04-29', name: 'Showa Day' },
      { date: 'YYYY-05-03', name: 'Constitution Day' },
      { date: 'YYYY-05-04', name: 'Greenery Day' },
      { date: 'YYYY-05-05', name: 'Children\'s Day' },
      { date: 'YYYY-07-20', name: 'Marine Day' },
      { date: 'YYYY-08-11', name: 'Mountain Day' },
      { date: 'YYYY-09-21', name: 'Respect for the Aged Day' },
      { date: 'YYYY-09-23', name: 'Autumnal Equinox Day' },
      { date: 'YYYY-10-12', name: 'Sports Day' },
      { date: 'YYYY-11-03', name: 'Culture Day' },
      { date: 'YYYY-11-23', name: 'Labour Thanksgiving Day' },
    ],
    VN: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' },
      { date: 'YYYY-02-16', name: 'Lunar New Year (Tết) — Day 1' },
      { date: 'YYYY-02-17', name: 'Lunar New Year — Day 2' },
      { date: 'YYYY-02-18', name: 'Lunar New Year — Day 3' },
      { date: 'YYYY-02-19', name: 'Lunar New Year — Day 4' },
      { date: 'YYYY-02-20', name: 'Lunar New Year — Day 5' },
      { date: 'YYYY-04-26', name: 'Hung Kings Festival' },
      { date: 'YYYY-04-30', name: 'Reunification Day' },
      { date: 'YYYY-05-01', name: 'Labour Day' },
      { date: 'YYYY-09-02', name: 'National Day' },
    ],
    KR: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' },
      { date: 'YYYY-02-16', name: 'Seollal — Day 1' },
      { date: 'YYYY-02-17', name: 'Seollal — Day 2' },
      { date: 'YYYY-02-18', name: 'Seollal — Day 3' },
      { date: 'YYYY-03-01', name: 'Independence Movement Day' },
      { date: 'YYYY-05-05', name: 'Children\'s Day' },
      { date: 'YYYY-05-15', name: 'Buddha\'s Birthday' },
      { date: 'YYYY-06-06', name: 'Memorial Day' },
      { date: 'YYYY-08-15', name: 'Liberation Day' },
      { date: 'YYYY-09-24', name: 'Chuseok — Day 1' },
      { date: 'YYYY-09-25', name: 'Chuseok — Day 2' },
      { date: 'YYYY-09-26', name: 'Chuseok — Day 3' },
      { date: 'YYYY-10-03', name: 'National Foundation Day' },
      { date: 'YYYY-10-09', name: 'Hangeul Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
    US: [
      { date: 'YYYY-01-01', name: 'New Year\'s Day' },
      { date: 'YYYY-01-19', name: 'Martin Luther King Jr. Day' },
      { date: 'YYYY-02-16', name: 'Presidents\' Day' },
      { date: 'YYYY-05-25', name: 'Memorial Day' },
      { date: 'YYYY-06-19', name: 'Juneteenth' },
      { date: 'YYYY-07-04', name: 'Independence Day' },
      { date: 'YYYY-09-07', name: 'Labor Day' },
      { date: 'YYYY-10-12', name: 'Columbus Day' },
      { date: 'YYYY-11-11', name: 'Veterans Day' },
      { date: 'YYYY-11-26', name: 'Thanksgiving Day' },
      { date: 'YYYY-12-25', name: 'Christmas Day' },
    ],
  };

  private readonly flagFallback: Record<string, string> = {
    KH: '🇰🇭', MM: '🇲🇲', JP: '🇯🇵',
    VN: '🇻🇳', KR: '🇰🇷', US: '🇺🇸',
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadAllCountries();         // for country switcher dropdown
    this.resolveCountryThenLoad();
    this.loadStaff();
  }

  private get headers() {
    return this.auth.getHeaders();
  }

  // ─────────────────────────────────────────────
  // LOAD ALL COUNTRIES (for cross-branch viewing)
  // ─────────────────────────────────────────────
  private loadAllCountries(): void {
    this.http.get<CountryInfo[]>(`${COUNTRIES_BASE}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[countries]', err); return of([]); }))
      .subscribe(list => {
        this.allCountries = list || [];
        this.cdr.detectChanges();
      });
  }

  // ─────────────────────────────────────────────
  // COUNTRY RESOLUTION (admin's own branch)
  // ─────────────────────────────────────────────
  private resolveCountryThenLoad(): void {
    const branchId = this.currentUser?.branchId;
    if (!branchId) {
      this.country = null;
      this.viewingCountry = null;
      this.loadHolidays();
      return;
    }

    this.http.get<any>(`${BRANCHES_BASE}/${branchId}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[branch]', err); return of(null); }))
      .subscribe(branch => {
        if (!branch?.countryId) {
          this.country = null;
          this.viewingCountry = null;
          this.loadHolidays();
          return;
        }

        this.http.get<CountryInfo>(`${COUNTRIES_BASE}/${branch.countryId}`, { headers: this.headers })
          .pipe(catchError(err => { console.error('[country]', err); return of(null); }))
          .subscribe(country => {
            this.country = country;
            this.viewingCountry = country;   // default: viewing own country
            this.loadHolidays();
          });
      });
  }

  // ─────────────────────────────────────────────
  // COUNTRY SWITCHER (view different country)
  // ─────────────────────────────────────────────
  toggleCountryMenu(): void {
    this.showCountryMenu = !this.showCountryMenu;
  }

  selectCountry(c: CountryInfo): void {
    this.viewingCountry = c;
    this.showCountryMenu = false;
    this.loadHolidays();
  }

  get isViewingOwnCountry(): boolean {
    if (!this.country || !this.viewingCountry) return true;
    return this.country.id === this.viewingCountry.id;
  }

  // ─────────────────────────────────────────────
  // GETTERS — use viewingCountry for display
  // ─────────────────────────────────────────────
  get countryFlag(): string {
    const c = this.viewingCountry;
    if (!c) return '🌍';
    return c.flagEmoji || this.flagFallback[c.code] || '🌍';
  }

  get countryName(): string {
    return this.viewingCountry?.name || 'Global';
  }

  get seedButtonLabel(): string {
    if (!this.viewingCountry) return 'No country';
    return `${this.countryFlag} Seed ${this.countryName} ${this.currentYear}`;
  }

  get hasPresetForCountry(): boolean {
    return !!this.viewingCountry?.code && !!this.presets[this.viewingCountry.code];
  }

  /** Get flag for any country (used in dropdown) */
  getFlagFor(c: CountryInfo): string {
    return c.flagEmoji || this.flagFallback[c.code] || '🌍';
  }

  /** Role name from currentUser (resolved via roleId or role string) */
  get userRoleName(): string {
    if (!this.currentUser) return '';
    // Try role string first, fallback to roleName field
    return this.currentUser.role || this.currentUser.roleName || '';
  }

  /** Global admins (BOSS, COUNTRY_DIRECTOR) can edit any country */
  get isGlobalAdmin(): boolean {
    const role = this.userRoleName;
    return role === 'BOSS' || role === 'COUNTRY_DIRECTOR';
  }

  /** Can edit/delete — BOSS/CD everywhere, ADMIN/VP only own country */
  get canEdit(): boolean {
    if (!this.viewingCountry) return false;
    if (this.isGlobalAdmin) return true;           // BOSS / Country Director → edit any
    return this.isViewingOwnCountry;               // others → only own country
  }

  // ─────────────────────────────────────────────
  // LOAD HOLIDAYS — by viewing country
  // ─────────────────────────────────────────────
  loadHolidays(): void {
    this.loading = true;
    const countryId = this.viewingCountry?.id;
    const url = countryId
      ? `${HOLIDAYS_BASE}/by-country/${countryId}?year=${this.currentYear}`
      : `${HOLIDAYS_BASE}?year=${this.currentYear}`;

    this.http.get<Holiday[]>(url, { headers: this.headers })
      .pipe(catchError(err => { console.error('[holidays]', err); return of([]); }))
      .subscribe(list => {
        this.holidays = list || [];
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  changeYear(delta: number): void {
    this.currentYear += delta;
    this.loadHolidays();
  }

  // ─────────────────────────────────────────────
  // LOAD STAFF (right panel)
  // ─────────────────────────────────────────────
  loadStaff(): void {
    this.loadingStaff = true;
    this.http.get<StaffMember[]>(`${USERS_BASE}/staff-list`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[staff]', err); return of([]); }))
      .subscribe(list => {
        this.staffList = (list || [])
          .filter(u => u.isActive !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.loadingStaff = false;
        this.cdr.detectChanges();
      });
  }

  // ─────────────────────────────────────────────
  // STAFF FILTERING
  // ─────────────────────────────────────────────
  get filteredStaff(): StaffMember[] {
    const query = this.staffSearchQuery.toLowerCase().trim();
    return this.staffList.filter(s => {
      // Role filter
      if (this.selectedRoleFilter !== 'ALL' && s.roleName !== this.selectedRoleFilter) {
        return false;
      }
      // Search filter
      if (query) {
        const n = (s.name || '').toLowerCase();
        const e = (s.email || '').toLowerCase();
        if (!n.includes(query) && !e.includes(query)) return false;
      }
      return true;
    });
  }

  get staffCountByRole(): Record<string, number> {
    const counts: Record<string, number> = { ALL: this.staffList.length };
    for (const s of this.staffList) {
      const key = s.roleName || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  getInitial(name: string): string {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  }

  /** Convert "BOPHA NOUN" or "hein htet ko" to "Bopha Noun" / "Hein Htet Ko" */
  toTitleCase(name: string): string {
    if (!name) return '';
    return name.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
  }

  getAvatarColor(id: number): string {
    const colors = ['#16a34a', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#0891b2'];
    return colors[Math.abs(id || 0) % colors.length];
  }

  setRoleFilter(key: string): void {
    this.selectedRoleFilter = key;
  }

  // ─────────────────────────────────────────────
  // FORM
  // ─────────────────────────────────────────────
  private emptyForm(): Holiday {
    const today = new Date().toISOString().split('T')[0];
    return { holidayDate: today, name: '' };
  }

  openCreateForm(): void {
    this.form = this.emptyForm();
    this.editMode = false;
    this.showForm = true;
    this.formError = '';
  }

  openEditForm(h: Holiday): void {
    this.form = { ...h };
    this.editMode = true;
    this.showForm = true;
    this.formError = '';
  }

  closeForm(): void {
    this.showForm = false;
    this.formError = '';
  }

  saveForm(): void {
    if (!this.form.holidayDate || !this.form.name?.trim()) {
      this.formError = 'Date and name are required';
      return;
    }

    this.saving = true;
    this.formError = '';

    const payload: any = {
      holidayDate: this.form.holidayDate,
      name: this.form.name.trim()
    };

    // Include countryId only for NEW holidays (backend default uses admin's country if omitted)
    if (!this.editMode && this.viewingCountry?.id) {
      payload.countryId = this.viewingCountry.id;
    }

    const request$ = this.editMode && this.form.id
      ? this.http.put<Holiday>(`${HOLIDAYS_BASE}/${this.form.id}`, payload, { headers: this.headers })
      : this.http.post<Holiday>(HOLIDAYS_BASE, payload, { headers: this.headers });

    request$
      .pipe(catchError(err => {
        console.error('[save]', err);
        this.formError = err?.error?.message || 'Failed to save';
        this.saving = false;
        this.cdr.detectChanges();
        return of(null);
      }))
      .subscribe(res => {
        this.saving = false;
        if (res) {
          this.showForm = false;
          this.loadHolidays();
        }
      });
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────
  confirmDelete(h: Holiday): void {
    this.deleteTarget = h;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    const id = this.deleteTarget.id;

    this.http.delete(`${HOLIDAYS_BASE}/${id}`, { headers: this.headers })
      .pipe(catchError(err => { console.error('[delete]', err); alert('Failed to delete'); return of(null); }))
      .subscribe(res => {
        if (res !== null) {
          this.deleteTarget = null;
          this.loadHolidays();
        }
      });
  }

  // ─────────────────────────────────────────────
  // SEED
  // ─────────────────────────────────────────────
  seedCountryPreset(): void {
    if (!this.viewingCountry || !this.hasPresetForCountry) {
      alert('No preset available for this country');
      return;
    }

    const preset = this.presets[this.viewingCountry.code];
    const year = this.currentYear;

    const holidays = preset.map(p => ({
      date: p.date.replace('YYYY', String(year)),
      name: p.name
    }));

    if (!confirm(
      `Seed ${holidays.length} ${this.countryName} holidays for ${year}?\n\n` +
      `Existing dates will be skipped automatically.`
    )) return;

    this.saving = true;
    const payload = {
      countryId: this.viewingCountry.id,
      holidays
    };

    this.http.post<any>(`${HOLIDAYS_BASE}/bulk`, payload, { headers: this.headers })
      .pipe(catchError(err => {
        console.error('[bulk]', err);
        alert('Failed to seed: ' + (err?.error?.message || 'Unknown error'));
        this.saving = false;
        return of(null);
      }))
      .subscribe(res => {
        this.saving = false;
        if (res) {
          alert(res.message || `Created ${res.created}, skipped ${res.skipped}`);
          this.loadHolidays();
        }
      });
  }

  // ─────────────────────────────────────────────
  // DISPLAY HELPERS
  // ─────────────────────────────────────────────
  get filteredHolidays(): Holiday[] {
    if (this.selectedMonth === 0) return this.holidays;
    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      return d.getMonth() + 1 === this.selectedMonth;
    });
  }

  get holidaysByMonth(): { month: string; monthNum: number; items: Holiday[] }[] {
    const grouped: { [k: number]: Holiday[] } = {};
    for (const h of this.filteredHolidays) {
      const m = new Date(h.holidayDate).getMonth() + 1;
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(h);
    }

    const months = Object.keys(grouped)
      .map(k => Number(k))
      .sort((a, b) => a - b);

    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return months.map(m => ({
      month: names[m - 1],
      monthNum: m,
      items: grouped[m].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))
    }));
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDay(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  isWeekend(iso: string): boolean {
    const d = new Date(iso);
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  onBack(): void {
    this.back.emit();
  }

  // ─────────────────────────────────────────────
  // STATS (member-dashboard style overview cards)
  // ─────────────────────────────────────────────

  /** Total holidays for the viewing year */
  get statsTotal(): number {
    return this.holidays.length;
  }

  /** Holidays in current calendar month being viewed */
  get statsThisMonth(): number {
    const m = this.calendarMonth + 1;  // 1-indexed
    const y = this.calendarYear;
    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    }).length;
  }

  /** Upcoming holidays in next 30 days from today */
  get statsUpcoming(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);

    return this.holidays.filter(h => {
      const d = new Date(h.holidayDate);
      return d >= today && d <= in30;
    }).length;
  }

  /** Holidays falling on Sat/Sun (not work impacting) */
  get statsWeekendOverlap(): number {
    return this.holidays.filter(h => this.isWeekend(h.holidayDate)).length;
  }

  /** Short label for current calendar month */
  get calendarMonthShort(): string {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[this.calendarMonth];
  }

  // ─────────────────────────────────────────────
  // CALENDAR VIEW LOGIC
  // ─────────────────────────────────────────────

  setViewMode(mode: 'list' | 'calendar'): void {
    this.viewMode = mode;
  }

  /** Holidays indexed by ISO date (YYYY-MM-DD) for O(1) lookup */
  get holidayMap(): Map<string, Holiday> {
    const map = new Map<string, Holiday>();
    for (const h of this.holidays) {
      // Normalize to YYYY-MM-DD
      const dateKey = h.holidayDate.split('T')[0];
      map.set(dateKey, h);
    }
    return map;
  }

  /** Short month name for calendar header */
  get calendarMonthName(): string {
    const names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return names[this.calendarMonth];
  }

  /** 6-week × 7-day calendar grid for current month */
  get calendarGrid(): CalendarCell[][] {
    const weeks: CalendarCell[][] = [];
    const year = this.calendarYear;
    const month = this.calendarMonth;

    // First day of month, and weekday it falls on (0=Sun, 6=Sat)
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();

    // Start date = first Sunday on or before the 1st
    const gridStart = new Date(year, month, 1 - firstWeekday);

    const today = this.toIsoDate(new Date());
    const hMap = this.holidayMap;

    // Build 6 weeks × 7 days = 42 cells
    for (let w = 0; w < 6; w++) {
      const week: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + (w * 7) + d);

        const iso = this.toIsoDate(cellDate);
        const isCurrentMonth = cellDate.getMonth() === month;
        const isWeekend = d === 0 || d === 6;
        const isToday = iso === today;
        const holiday = hMap.get(iso) || null;

        week.push({
          date: cellDate,
          iso,
          day: cellDate.getDate(),
          isCurrentMonth,
          isWeekend,
          isToday,
          holiday
        });
      }
      weeks.push(week);
    }
    return weeks;
  }

  /** Navigation: prev/next month */
  changeCalendarMonth(delta: number): void {
    let m = this.calendarMonth + delta;
    let y = this.calendarYear;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    this.calendarMonth = m;
    this.calendarYear = y;

    // If year changed, reload holidays for new year
    if (y !== this.currentYear) {
      this.currentYear = y;
      this.loadHolidays();
    }
  }

  /** Jump to today */
  goToToday(): void {
    const now = new Date();
    this.calendarYear = now.getFullYear();
    this.calendarMonth = now.getMonth();
    if (this.calendarYear !== this.currentYear) {
      this.currentYear = this.calendarYear;
      this.loadHolidays();
    }
  }

  /** Click empty date cell → create form with date prefilled */
  onCellClick(cell: CalendarCell): void {
    if (!cell.isCurrentMonth) return;
    if (!this.canEdit) return;           // read-only when viewing other country
    if (cell.holiday) {
      this.openEditForm(cell.holiday);
    } else {
      this.form = { holidayDate: cell.iso, name: '' };
      this.editMode = false;
      this.showForm = true;
      this.formError = '';
    }
  }

  /** Format Date to YYYY-MM-DD (local time, not UTC) */
  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

// ─────────────────────────────────────────────
// Calendar cell interface (exported below class)
// ─────────────────────────────────────────────
export interface CalendarCell {
  date: Date;
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  holiday: Holiday | null;
}
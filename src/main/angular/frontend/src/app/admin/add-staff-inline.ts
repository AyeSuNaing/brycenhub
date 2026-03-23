import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';

const BASE = environment.apiBaseUrl;

// Role → color mapping (matches CLAUDE.md badge colors)
const ROLE_COLORS: Record<string, string> = {
  BOSS:              '#eab308',   // yellow
  COUNTRY_DIRECTOR:  '#a855f7',   // purple
  ADMIN:             '#ec4899',   // pink
  PROJECT_MANAGER:   '#16a34a',   // green
  LEADER:            '#06b6d4',   // cyan
  UI_UX:             '#3b82f6',   // blue
  DEVELOPER:         '#6366f1',   // indigo
  QA:                '#f97316',   // orange
};

@Component({
  selector: 'app-add-staff-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './add-staff-inline.html',
  host: { style: 'display:contents' }
})
export class AddStaffInline implements OnInit {

  @Output() close   = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  // Raw API lists
  departments: any[] = [];
  roles:       any[] = [];

  // Mapped to SelectOption for custom-select
  roleOptions: SelectOption[] = [];
  deptOptions: SelectOption[] = [];

  // ── Form ───────────────────────────────────
  form = {
    name:              '',
    email:             '',
    password:          '',
    roleId:            null as number | null,
    branchId:          null as number | null,
    departmentId:      null as number | null,
    preferredLanguage: 'en',
    phone:             '',
    profileImage:      '',
  };

  // ── Password ───────────────────────────────
  copied      = false;
  copiedField = '';   // 'email' | 'password' | 'both' | ''

  generatePassword() {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const symbols = '@#$!';
    const all     = upper + lower + digits + symbols;
    let pwd = '';
    pwd += upper  [Math.floor(Math.random() * upper.length)];
    pwd += lower  [Math.floor(Math.random() * lower.length)];
    pwd += digits [Math.floor(Math.random() * digits.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 10; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    this.form.password = pwd.split('').sort(() => Math.random() - 0.5).join('');
    this.copied = false;
    this.cdr.detectChanges();
  }

  copyPassword() {
    if (!this.form.password) return;
    navigator.clipboard.writeText(this.form.password).then(() => {
      this.copied = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 2000);
    });
  }

  // ── Credentials copy (Preview page) ──────────────────────────
  copyCredential(text: string, field: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2500);
    });
  }

  copyBoth() {
    const text = 'Email: ' + this.form.email + '\nPassword: ' + this.form.password;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = 'both';
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2500);
    });
  }

  // ── CV Upload state ────────────────────────
  cvFile:        File | null = null;
  cvAnalyzing    = false;
  cvPreview:     any  = null;
  showCvPreview  = false;

  // ── UI state ──────────────────────────────
  isSubmitting    = false;
  activeSection   = 'basic';   // basic | cv | skills | preview
  errorMsg        = '';
  successMsg      = '';
  showSuccessCard = false;     // success card after create
  copyEmailDone   = false;     // email copied
  copyPwdDone     = false;     // password copied
  canGoToList     = false;     // both copied → Go to Staff List active

  // ── Email duplicate check ──────────────
  emailChecking   = false;
  emailExists     = false;
  emailChecked    = false;   // blur ၁ ကြိမ်ပိတ်ဖူးရင် true

  // ── Accordion state (preview page) ────────
  accordionBasic  = true;
  accordionCv     = true;
  accordionSkills = true;

  // ── Skills ────────────────────────────────
  skillsInput: { name: string; level: string }[] = [];

  langs = [
    { code: 'en', label: '🇺🇸 English' },
    { code: 'ja', label: '🇯🇵 Japanese' },
    { code: 'my', label: '🇲🇲 Myanmar' },
    { code: 'km', label: '🇰🇭 Khmer' },
    { code: 'vi', label: '🇻🇳 Vietnamese' },
    { code: 'ko', label: '🇰🇷 Korean' },
  ];

  // ── Phone country codes ────────────────────────────────────────
  phoneCodes = [
    { flag: '🇰🇭', code: '+855', country: 'KH', digits: 9  },
    { flag: '🇲🇲', code: '+95',  country: 'MM', digits: 9  },
    { flag: '🇯🇵', code: '+81',  country: 'JP', digits: 10 },
    { flag: '🇻🇳', code: '+84',  country: 'VN', digits: 9  },
    { flag: '🇰🇷', code: '+82',  country: 'KR', digits: 10 },
    { flag: '🇺🇸', code: '+1',   country: 'US', digits: 10 },
  ];

  selectedPhoneCode = { flag: '🇰🇭', code: '+855', country: 'KH', digits: 9 };
  showPhoneDropdown = false;
  phoneDigits       = '';   // digits only (without country code)

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const user = this.auth.getUser();
    this.form.branchId = user?.branchId || null;
    this.generatePassword();
    this.loadDepartments();
    this.loadRoles();

    // Close phone dropdown on outside click
    document.addEventListener('click', () => {
      if (this.showPhoneDropdown) {
        this.showPhoneDropdown = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Data Loading ──────────────────────────

  loadDepartments() {
    this.http.get<any[]>(`${BASE}/departments/my-branch`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.departments = list;
          this.deptOptions = list.map(d => ({
            id:    d.id,
            label: d.name,
            // Departments use a neutral color
            color: '#64748b',
          }));
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  loadRoles() {
    this.http.get<any[]>(`${BASE}/user-roles`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          // Exclude CLIENT role
          this.roles = list.filter(r => r.name !== 'CLIENT');
          this.roleOptions = this.roles.map(r => ({
            id:         r.id,
            label:      r.displayName || r.name,
            color:      r.color || ROLE_COLORS[r.name] || '#64748b',
            badgeLabel: this.getRoleShort(r.name),
          }));
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  getRoleShort(name: string): string {
    const map: Record<string, string> = {
      BOSS:             'BOSS',
      COUNTRY_DIRECTOR: 'DIR',
      ADMIN:            'ADMIN',
      PROJECT_MANAGER:  'PM',
      LEADER:           'LEAD',
      UI_UX:            'UI/UX',
      DEVELOPER:        'DEV',
      QA:               'QA',
    };
    return map[name] || name.substring(0, 4).toUpperCase();
  }

  // ── CV Upload ─────────────────────────────
  onCvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.cvFile        = input.files[0];
      this.cvPreview     = null;
      this.showCvPreview = false;
    }
  }

  analyzeCv() {
    if (!this.cvFile) return;
    this.cvAnalyzing = true;
    this.errorMsg    = '';

    const formData = new FormData();
    formData.append('file', this.cvFile);

    this.http.post<any>(`${BASE}/cv/analyze`, formData)
      .subscribe({
        next: result => {
          this.cvPreview     = result;
          this.showCvPreview = true;
          this.cvAnalyzing   = false;
          if (result.skills?.length) {
            this.skillsInput = result.skills.map((s: any) => ({
              name:  s.skillNameEn || s.skillName,
              level: s.skillLevel  || '',
            }));
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.cvAnalyzing = false;
          this.errorMsg    = 'CV analysis failed. Please try again.';
          this.cdr.detectChanges();
        }
      });
  }

  confirmCvPreview() {
    this.showCvPreview = false;
    this.activeSection = 'skills';
  }

  // ── Preview helpers ─────────────────────────────────────────

  goToPreview() {
    this.accordionBasic  = true;
    this.accordionCv     = true;
    this.accordionSkills = true;
    this.activeSection   = 'preview';
  }

  toggleAccordion(key: string) {
    if (key === 'basic')  this.accordionBasic  = !this.accordionBasic;
    if (key === 'cv')     this.accordionCv     = !this.accordionCv;
    if (key === 'skills') this.accordionSkills = !this.accordionSkills;
  }

  getSelectedRole(): any {
    return this.roleOptions.find(r => r.id == this.form.roleId) || null;
  }

  getSelectedDept(): any {
    return this.deptOptions.find(d => d.id == this.form.departmentId) || null;
  }

  getLangLabel(code: string): string {
    const found = this.langs.find(l => l.code === code);
    return found ? found.label : code;
  }

  /** "A; B; C" → ["A", "B", "C"] — for education/experience display */
  splitEntries(text: string | null): string[] {
    if (!text) return [];
    return text.split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  /** "Swift, Firebase, MVVM" → ["Swift", "Firebase", "MVVM"] — tech stack tags */
  splitTech(tech: string | null): string[] {
    if (!tech) return [];
    return tech.split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  /** Check if any social link exists */
  hasSocialLinks(social: any): boolean {
    if (!social) return false;
    return !!(social.linkedin || social.github || social.twitter ||
              social.facebook || social.website || social.other);
  }

  /** Ensure URL has https:// prefix */
  toUrl(link: string): string {
    if (!link) return '#';
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    return 'https://' + link;
  }

  getSkillColor(level: string | null): string {
    switch (level) {
      case 'SENIOR':   return '#a78bfa';
      case 'MID':      return '#60a5fa';
      case 'BEGINNER': return '#34d399';
      default:         return '#94a3b8';
    }
  }

  getSkillBg(level: string | null): string {
    switch (level) {
      case 'SENIOR':   return 'rgba(167,139,250,0.1)';
      case 'MID':      return 'rgba(96,165,250,0.1)';
      case 'BEGINNER': return 'rgba(52,211,153,0.1)';
      default:         return 'rgba(148,163,184,0.1)';
    }
  }

  getSkillBorder(level: string | null): string {
    switch (level) {
      case 'SENIOR':   return 'rgba(167,139,250,0.3)';
      case 'MID':      return 'rgba(96,165,250,0.3)';
      case 'BEGINNER': return 'rgba(52,211,153,0.3)';
      default:         return 'rgba(148,163,184,0.2)';
    }
  }

  // ── Skills ───────────────────────────────
  addSkill() {
    this.skillsInput.push({ name: '', level: '' });
  }
  removeSkill(i: number) {
    this.skillsInput.splice(i, 1);
  }

  // ── Submit ────────────────────────────────
  // ── Phone helpers ────────────────────────────────────────────
  selectPhoneCode(c: any) {
    this.selectedPhoneCode = c;
    this.showPhoneDropdown = false;
    this.updatePhone();
  }

  updatePhone() {
    const digits = this.phoneDigits.replace(/\D/g, '');
    this.form.phone = digits ? this.selectedPhoneCode.code + ' ' + digits : '';
  }

  getPhoneError(): string | null {
    if (!this.phoneDigits) return null;  // optional
    const digits = this.phoneDigits.replace(/\D/g, '');
    if (digits.length < 6) return 'Phone number too short';
    return null;
  }

  isEmailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── Real-time email duplicate check ──────────────────────────
  checkEmailExists() {
    const email = this.form.email.trim();
    if (!email || !this.isEmailValid(email)) {
      this.emailExists  = false;
      this.emailChecked = false;
      return;
    }

    this.emailChecking = true;
    this.emailChecked  = false;
    this.emailExists   = false;

    this.http.get<{ exists: boolean }>(
      `${BASE}/users/check-email?email=${encodeURIComponent(email)}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: res => {
        this.emailExists   = res.exists;
        this.emailChecked  = true;
        this.emailChecking = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.emailChecking = false;
        this.emailChecked  = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Name mismatch check ───────────────────────────────────────
  getNameMismatchWarning(): string | null {
    if (!this.cvPreview?.name || !this.form.name) return null;
    const basicName = this.form.name.trim().toLowerCase();
    const cvName    = this.cvPreview.name.trim().toLowerCase();
    if (basicName !== cvName) {
      return 'CV name "' + this.cvPreview.name + '" differs from Basic Info name. Basic Info name will be used.';
    }
    return null;
  }

  // ── Validation warnings (non-blocking) ───────────────────────
  getWarnings(): string[] {
    const w: string[] = [];
    if (!this.cvPreview) w.push('No CV uploaded — staff can upload later');
    if (this.skillsInput.length === 0) w.push('No skills added — you can add later');
    const nameMismatch = this.getNameMismatchWarning();
    if (nameMismatch) w.push(nameMismatch);
    return w;
  }

  submit() {
    this.errorMsg = '';

    // ── Required field validation ──
    const errors: string[] = [];
    if (!this.form.name.trim())     errors.push('Full Name is required');
    if (!this.form.email.trim())     errors.push('Email is required');
    else if (!this.isEmailValid(this.form.email)) errors.push('Invalid email format');
    if (!this.form.password.trim()) errors.push('Password is required');
    if (!this.form.roleId)            errors.push('Role is required');

    // ── Phone format (optional but if entered must be valid) ──
    const phoneErr = this.getPhoneError();
    if (phoneErr) errors.push(phoneErr);

    if (errors.length > 0) {
      this.errorMsg = errors.join(' · ');
      return;
    }

    this.isSubmitting = true;

    const body = { ...this.form };
    // role String မပို့ဘဲ roleId ပဲ ပို့မယ်
    // Spring Boot UserDto မှာ role ဖြုတ်ပြီ → roleId @NotNull ပဲ လိုတယ်

    this.http.post<any>(`${BASE}/users`, body,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: user => {
          if (this.cvFile) {
            this.uploadCv(user.id);
          } else if (this.skillsInput.length > 0) {
            this.saveSkills(user.id);
          } else {
            this.onSuccess();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMsg     = err?.error?.message || 'Failed to create staff';
          this.cdr.detectChanges();
        }
      });
  }

  uploadCv(userId: number) {
    const formData = new FormData();
    formData.append('file',   this.cvFile!);
    formData.append('userId', String(userId));

    this.http.post(`${BASE}/cv/upload`, formData)
      .subscribe({
        next:  () => this.skillsInput.length > 0 ? this.saveSkills(userId) : this.onSuccess(),
        error: () => this.onSuccess()
      });
  }

  saveSkills(userId: number) {
    const skills = this.skillsInput.filter(s => s.name.trim());
    if (!skills.length) { this.onSuccess(); return; }

    this.http.post(`${BASE}/member-skills/bulk`, { userId, skills },
      { headers: this.auth.getHeaders() })
      .subscribe({
        next:  () => this.onSuccess(),
        error: () => this.onSuccess()
      });
  }

  onSuccess() {
    this.isSubmitting   = false;
    this.showSuccessCard = true;
    this.cdr.detectChanges();
  }

  copySuccessField(text: string, field: 'email' | 'pwd') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (field === 'email') this.copyEmailDone = true;
      if (field === 'pwd')   this.copyPwdDone   = true;
      // Both copied → enable Go to Staff List
      if (this.copyEmailDone && this.copyPwdDone) this.canGoToList = true;
      this.cdr.detectChanges();
    });
  }

  goToStaffList() {
    this.created.emit();
  }
}
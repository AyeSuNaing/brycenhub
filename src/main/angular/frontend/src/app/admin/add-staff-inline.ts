import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-add-staff-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-staff-inline.html',
  host: { style: 'display:contents' }
})
export class AddStaffInline implements OnInit {

  @Output() close   = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  departments: any[] = [];
  roles:       any[] = [];

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
  showPassword  = false;
  copied        = false;

  generatePassword() {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols= '@#$!';
    const all    = upper + lower + digits + symbols;
    let pwd = '';
    // ensure at least 1 of each type
    pwd += upper [Math.floor(Math.random() * upper.length)];
    pwd += lower [Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    // fill to 10 chars
    for (let i = 4; i < 10; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    // shuffle
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

  // ── CV Upload state ────────────────────────
  cvFile:          File | null = null;
  cvAnalyzing      = false;
  cvPreview:       any  = null;   // Claude analyze result
  showCvPreview    = false;

  // ── UI state ──────────────────────────────
  isSubmitting     = false;
  activeSection    = 'basic';    // basic | cv | skills
  errorMsg         = '';
  successMsg       = '';

  // ── Skills (editable after CV analyze) ────
  skillsInput: { name: string; level: string }[] = [];

  langs = [
    { code: 'en', label: '🇺🇸 English' },
    { code: 'ja', label: '🇯🇵 Japanese' },
    { code: 'my', label: '🇲🇲 Myanmar' },
    { code: 'km', label: '🇰🇭 Khmer' },
    { code: 'vi', label: '🇻🇳 Vietnamese' },
    { code: 'ko', label: '🇰🇷 Korean' },
  ];

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
  }

  loadDepartments() {
    this.http.get<any[]>(`${BASE}/departments/my-branch`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.departments = list; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  loadRoles() {
    this.http.get<any[]>(`${BASE}/user-roles`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          // CLIENT မပြချင်ဘူး — staff only
          this.roles = list.filter(r => r.name !== 'CLIENT');
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  // ── CV Upload ─────────────────────────────
  onCvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.cvFile = input.files[0];
      this.cvPreview   = null;
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
          this.cvPreview    = result;
          this.showCvPreview = true;
          this.cvAnalyzing  = false;
          // auto fill skills
          if (result.skills?.length) {
            this.skillsInput = result.skills.map((s: any) => ({
              name:  s.skillNameEn || s.skillName,
              level: s.skillLevel || '',
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

  // ── Skills ───────────────────────────────
  addSkill() {
    this.skillsInput.push({ name: '', level: '' });
  }
  removeSkill(i: number) {
    this.skillsInput.splice(i, 1);
  }

  // ── Submit ────────────────────────────────
  submit() {
    if (!this.form.name || !this.form.email || !this.form.password || !this.form.roleId) {
      this.errorMsg = 'Please fill all required fields';
      return;
    }
    this.isSubmitting = true;
    this.errorMsg     = '';

    const body = {
      ...this.form,
      role: 'DEVELOPER', // placeholder — role_id ကသုံးမယ်
    };

    this.http.post<any>(`${BASE}/users`, body,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: user => {
          // CV file ရှိရင် upload
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
    formData.append('file', this.cvFile!);
    formData.append('userId', String(userId));

    this.http.post(`${BASE}/cv/upload`, formData)
      .subscribe({
        next: () => {
          if (this.skillsInput.length > 0) {
            this.saveSkills(userId);
          } else {
            this.onSuccess();
          }
        },
        error: () => this.onSuccess() // CV upload fail ဖြစ်ရင် user create ပြီးပြီ
      });
  }

  saveSkills(userId: number) {
    const skills = this.skillsInput.filter(s => s.name.trim());
    if (!skills.length) { this.onSuccess(); return; }

    this.http.post(`${BASE}/member-skills/bulk`, { userId, skills },
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => this.onSuccess(),
        error: () => this.onSuccess()
      });
  }

  onSuccess() {
    this.isSubmitting = false;
    this.successMsg   = 'Staff created successfully!';
    this.cdr.detectChanges();
    setTimeout(() => this.created.emit(), 1200);
  }
}
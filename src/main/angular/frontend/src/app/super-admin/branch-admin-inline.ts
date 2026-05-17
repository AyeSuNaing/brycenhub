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
  selector: 'app-branch-admin-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-admin-inline.html',
  styleUrl: './branch-admin-inline.scss',
})
export class BranchAdminInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  // ── Data ──────────────────────────────────────────────────────
  admins:   any[] = [];
  branches: any[] = [];
  loading  = true;
  saving   = false;
  error    = '';
  success  = '';

  // ── Filter ────────────────────────────────────────────────────
  filterBranchId: number | null = null;
  filterStatus   = 'ALL';
  searchQuery    = '';

  // ── Modal ─────────────────────────────────────────────────────
  showModal  = false;
  isEditing  = false;
  showPass   = false;
  deleteConfirmId: number | null = null;
  deactivateId: number | null = null;

  form = {
    id:        null as number | null,
    name:      '',
    email:     '',
    password:  '',
    branchId:  null as number | null,
    phone:     '',
    preferredLanguage: 'en',
  };

  emailExists = false;
  checkingEmail = false;

  languages = [
    { code:'en', label:'English' }, { code:'ja', label:'日本語' },
    { code:'my', label:'မြန်မာ' }, { code:'km', label:'ខ្មែរ'  },
    { code:'vi', label:'Tiếng Việt' }, { code:'ko', label:'한국어' },
  ];

  // ADMIN role_id — from user_roles table
  readonly ADMIN_ROLE_ID = 4;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadBranches();
    this.loadAdmins();
  }

  // ── Loaders ────────────────────────────────────────────────────
  loadBranches() {
    this.http.get<any[]>(`${BASE}/branches`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.branches = d || []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadAdmins() {
    this.loading = true;
    // Get all users with ADMIN role
    this.http.get<any[]>(`${BASE}/users/staff-list`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => {
        // Filter: roleId=4 (ADMIN) AND branchId NOT NULL (branch admins only)
        this.admins = (d || []).filter(u => u.roleId === this.ADMIN_ROLE_ID && u.branchId != null);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  // ── Filtered ──────────────────────────────────────────────────
  get filtered(): any[] {
    return this.admins.filter(a => {
      if (this.filterBranchId && a.branchId !== this.filterBranchId) return false;
      if (this.filterStatus === 'ACTIVE'   && !a.isActive) return false;
      if (this.filterStatus === 'INACTIVE' &&  a.isActive) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        if (!(a.name||'').toLowerCase().includes(q) &&
            !(a.email||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  branchName(id: number): string {
    return this.branches.find(b => b.id === id)?.name || '—';
  }

  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
  getColor(name: string): string {
    const c = ['#7c3aed','#0284c7','#16a34a','#db2777','#ea580c'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }

  // ── Modal ─────────────────────────────────────────────────────
  openAdd() {
    this.form = { id: null, name: '', email: '', password: this.generatePass(), branchId: null, phone: '', preferredLanguage: 'en' };
    this.isEditing   = false;
    this.showModal   = true;
    this.emailExists = false;
    this.error       = '';
    this.success     = '';
    this.showPass    = true;
  }

  openEdit(a: any) {
    this.form = { id: a.id, name: a.name, email: a.email, password: '', branchId: a.branchId, phone: a.phone || '', preferredLanguage: a.preferredLanguage || 'en' };
    this.isEditing   = true;
    this.showModal   = true;
    this.emailExists = false;
    this.error       = '';
    this.showPass    = false;
  }

  closeModal() { this.showModal = false; this.error = ''; }

  generatePass(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  regeneratePass() { this.form.password = this.generatePass(); }

  checkEmail() {
    if (this.isEditing || !this.form.email.includes('@')) return;
    this.checkingEmail = true;
    this.http.get<any>(`${BASE}/users/check-email?email=${this.form.email}`, { headers: this.auth.getHeaders() }).subscribe({
      next: r => { this.emailExists = r?.exists || false; this.checkingEmail = false; this.cdr.detectChanges(); },
      error: () => { this.checkingEmail = false; },
    });
  }

  // ── Save ──────────────────────────────────────────────────────
  save() {
    if (!this.form.name.trim())  { this.error = 'Name is required'; return; }
    if (!this.form.email.trim()) { this.error = 'Email is required'; return; }
    if (!this.isEditing && !this.form.password) { this.error = 'Password is required'; return; }
    if (!this.form.branchId)     { this.error = 'Branch is required'; return; }
    if (this.emailExists)        { this.error = 'Email already exists'; return; }

    this.saving = true;
    this.error  = '';
    const headers = this.auth.getHeaders();

    if (this.isEditing) {
      const body: any = {
        name: this.form.name.trim(),
        phone: this.form.phone,
        branchId: this.form.branchId,
        preferredLanguage: this.form.preferredLanguage,
      };
      this.http.put(`${BASE}/users/${this.form.id}`, body, { headers }).subscribe({
        next: () => { this.saving = false; this.showModal = false; this.success = 'Admin updated.'; this.loadAdmins(); setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000); },
        error: (e) => { this.saving = false; this.error = e?.error?.message || 'Update failed.'; this.cdr.detectChanges(); },
      });
    } else {
      const body = {
        name: this.form.name.trim(),
        email: this.form.email.trim(),
        password: this.form.password,
        roleId: this.ADMIN_ROLE_ID,
        branchId: this.form.branchId,
        phone: this.form.phone,
        preferredLanguage: this.form.preferredLanguage,
      };
      this.http.post(`${BASE}/users`, body, { headers }).subscribe({
        next: () => { this.saving = false; this.showModal = false; this.success = 'Branch Admin created.'; this.loadAdmins(); setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000); },
        error: (e) => { this.saving = false; this.error = e?.error?.message || 'Create failed.'; this.cdr.detectChanges(); },
      });
    }
  }

  // ── Activate / Deactivate ─────────────────────────────────────
  toggleActive(a: any) {
    const url = a.isActive
      ? `${BASE}/users/${a.id}/deactivate`
      : `${BASE}/users/${a.id}/activate`;
    this.http.put(url, {}, { headers: this.auth.getHeaders() }).subscribe({
      next: () => { a.isActive = !a.isActive; this.cdr.detectChanges(); },
      error: (e) => { this.error = e?.error?.message || 'Failed.'; this.cdr.detectChanges(); },
    });
  }

  copyCredentials(a: any) {
    const txt = `Email: ${a.email}\nPassword: (reset required)`;
    navigator.clipboard.writeText(txt).catch(() => {});
  }
}
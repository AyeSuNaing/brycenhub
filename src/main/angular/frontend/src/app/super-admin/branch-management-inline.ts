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
  selector: 'app-branch-management-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-management-inline.html',
  styleUrl: './branch-management-inline.scss',
})
export class BranchManagementInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  // ── Data ──────────────────────────────────────────────────────
  branches:  any[] = [];
  countries: any[] = [];
  loading   = true;
  saving    = false;
  error     = '';
  success   = '';

  // ── Filter ────────────────────────────────────────────────────
  filterCountryId: number | null = null;
  searchQuery = '';

  // ── Modal ─────────────────────────────────────────────────────
  showModal  = false;
  isEditing  = false;
  deleteConfirmId: number | null = null;

  form = {
    id:        null as number | null,
    countryId: null as number | null,
    name:      '',
    address:   '',
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadCountries();
    this.loadBranches();
  }

  // ── Loaders ────────────────────────────────────────────────────
  loadCountries() {
    this.http.get<any[]>(`${BASE}/countries`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.countries = d || []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadBranches() {
    this.loading = true;
    this.http.get<any[]>(`${BASE}/branches`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.branches = d || []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  // ── Filtered ──────────────────────────────────────────────────
  get filtered(): any[] {
    return this.branches.filter(b => {
      if (this.filterCountryId && b.countryId !== this.filterCountryId) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        if (!(b.name||'').toLowerCase().includes(q) &&
            !(b.address||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  countryName(id: number): string {
    return this.countries.find(c => c.id === id)?.name || '—';
  }

  countryFlag(id: number): string {
    const code = this.countries.find(c => c.id === id)?.code || '';
    const map: any = { JP:'🇯🇵', MM:'🇲🇲', KH:'🇰🇭', VN:'🇻🇳', KR:'🇰🇷', US:'🇺🇸' };
    return map[code] || '🌐';
  }

  // ── Modal ─────────────────────────────────────────────────────
  openAdd() {
    this.form       = { id: null, countryId: null, name: '', address: '' };
    this.isEditing  = false;
    this.showModal  = true;
    this.error      = '';
    this.success    = '';
  }

  openEdit(b: any) {
    this.form      = { id: b.id, countryId: b.countryId, name: b.name, address: b.address || '' };
    this.isEditing = true;
    this.showModal = true;
    this.error     = '';
    this.success   = '';
  }

  closeModal() {
    this.showModal = false;
    this.error     = '';
  }

  // ── Save ──────────────────────────────────────────────────────
  save() {
    if (!this.form.name.trim()) { this.error = 'Branch name is required'; return; }
    if (!this.form.countryId)   { this.error = 'Country is required'; return; }

    this.saving = true;
    this.error  = '';

    const body    = { countryId: this.form.countryId, name: this.form.name.trim(), address: this.form.address.trim() };
    const headers = this.auth.getHeaders();

    const req = this.isEditing
      ? this.http.put(`${BASE}/branches/${this.form.id}`, body, { headers })
      : this.http.post(`${BASE}/branches`, body, { headers });

    req.subscribe({
      next: () => {
        this.saving   = false;
        this.showModal = false;
        this.success  = this.isEditing ? 'Branch updated.' : 'Branch created.';
        this.loadBranches();
        setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => {
        this.saving = false;
        this.error  = e?.error?.message || 'Failed to save.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────
  askDelete(id: number) { this.deleteConfirmId = id; }
  cancelDelete()        { this.deleteConfirmId = null; }

  confirmDelete() {
    if (!this.deleteConfirmId) return;
    const id = this.deleteConfirmId;
    this.deleteConfirmId = null;

    this.http.delete(`${BASE}/branches/${id}`, { headers: this.auth.getHeaders() }).subscribe({
      next: () => {
        this.success = 'Branch deleted.';
        this.loadBranches();
        setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => {
        this.error = e?.error?.message || 'Delete failed.';
        this.cdr.detectChanges();
      },
    });
  }
}
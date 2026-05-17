import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

// flagEmoji comes directly from Country.flagEmoji field (DB: flag_emoji column)

@Component({
  selector: 'app-branch-management-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-management-inline.html',
  styleUrl: './branch-management-inline.scss',
})
export class BranchManagementInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  activeTab: 'branches' | 'countries' = 'branches';

  // ══ BRANCH ═══════════════════════════════════════════════════
  branches:       any[] = [];
  countries:      any[] = [];
  loadingBranches = true;
  savingBranch    = false;
  branchError     = '';
  branchSuccess   = '';
  filterCountryId: number | null = null;
  branchSearch    = '';
  showBranchModal = false;
  editingBranch   = false;
  deleteBranchId: number | null = null;
  branchForm = { id: null as number|null, countryId: null as number|null, name: '', address: '' };

  // ══ COUNTRY ══════════════════════════════════════════════════
  savingCountry    = false;
  countryError     = '';
  countrySuccess   = '';
  countrySearch    = '';
  showCountryModal = false;
  editingCountry   = false;
  deleteCountryId: number | null = null;
  countryForm = { id: null as number|null, name: '', code: '', currency: '' };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit() { this.loadCountries(); this.loadBranches(); }

  setTab(tab: 'branches' | 'countries') { this.activeTab = tab; }

  // ── Loaders ──────────────────────────────────────────────────
  loadCountries() {
    this.http.get<any[]>(`${BASE}/countries`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.countries = d || []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadBranches() {
    this.loadingBranches = true;
    this.http.get<any[]>(`${BASE}/branches`, { headers: this.auth.getHeaders() }).subscribe({
      next: d => { this.branches = d || []; this.loadingBranches = false; this.cdr.detectChanges(); },
      error: () => { this.loadingBranches = false; this.cdr.detectChanges(); },
    });
  }

  // ── Branch helpers ────────────────────────────────────────────
  get filteredBranches(): any[] {
    return this.branches.filter(b => {
      if (this.filterCountryId && b.countryId !== this.filterCountryId) return false;
      if (this.branchSearch) {
        const q = this.branchSearch.toLowerCase();
        if (!(b.name||'').toLowerCase().includes(q) && !(b.address||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  countryName(id: number): string { return this.countries.find(c => c.id === id)?.name || '—'; }
  flagByCountryId(id: number): string {
    const c = this.countries.find(c => c.id === id);
    if (!c) return '🌐';
    // DB flag_emoji column ကို priority ပေး
    if (c.flagEmoji) return c.flagEmoji;
    const m: any = { JP:'🇯🇵', MM:'🇲🇲', KH:'🇰🇭', VN:'🇻🇳', KR:'🇰🇷', US:'🇺🇸' };
    return m[c.code?.toUpperCase()] || '🌐';
  }
  flagByCode(code: string): string {
    // Fallback map for cases where flagEmoji not in response
    const m: any = { JP:'🇯🇵', MM:'🇲🇲', KH:'🇰🇭', VN:'🇻🇳', KR:'🇰🇷', US:'🇺🇸' };
    return m[code?.toUpperCase()] || '🌐';
  }
  branchCountByCountry(cId: number): number { return this.branches.filter(b => b.countryId === cId).length; }

  // ── Branch CRUD ───────────────────────────────────────────────
  openAddBranch() {
    this.branchForm = { id: null, countryId: null, name: '', address: '' };
    this.editingBranch = false; this.showBranchModal = true; this.branchError = '';
  }
  openEditBranch(b: any) {
    this.branchForm = { id: b.id, countryId: b.countryId, name: b.name, address: b.address||'' };
    this.editingBranch = true; this.showBranchModal = true; this.branchError = '';
  }
  closeBranchModal() { this.showBranchModal = false; this.branchError = ''; }

  saveBranch() {
    if (!this.branchForm.name.trim()) { this.branchError = 'Branch name is required'; return; }
    if (!this.branchForm.countryId)   { this.branchError = 'Country is required'; return; }
    this.savingBranch = true; this.branchError = '';
    const body = { countryId: this.branchForm.countryId, name: this.branchForm.name.trim(), address: this.branchForm.address.trim() };
    const headers = this.auth.getHeaders();
    const req = this.editingBranch
      ? this.http.put(`${BASE}/branches/${this.branchForm.id}`, body, { headers })
      : this.http.post(`${BASE}/branches`, body, { headers });
    req.subscribe({
      next: () => {
        this.savingBranch = false; this.showBranchModal = false;
        this.branchSuccess = this.editingBranch ? 'Branch updated.' : 'Branch created.';
        this.loadBranches();
        setTimeout(() => { this.branchSuccess = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.savingBranch = false; this.branchError = e?.error?.message || 'Failed.'; this.cdr.detectChanges(); },
    });
  }

  askDeleteBranch(id: number) { this.deleteBranchId = id; }
  cancelDeleteBranch()        { this.deleteBranchId = null; }
  confirmDeleteBranch() {
    if (!this.deleteBranchId) return;
    const id = this.deleteBranchId; this.deleteBranchId = null;
    this.http.delete(`${BASE}/branches/${id}`, { headers: this.auth.getHeaders() }).subscribe({
      next: () => { this.branchSuccess = 'Branch deleted.'; this.loadBranches(); setTimeout(() => { this.branchSuccess = ''; this.cdr.detectChanges(); }, 3000); },
      error: (e) => { this.branchError = e?.error?.message || 'Delete failed.'; this.cdr.detectChanges(); },
    });
  }

  // ── Country helpers ───────────────────────────────────────────
  get filteredCountries(): any[] {
    if (!this.countrySearch) return this.countries;
    const q = this.countrySearch.toLowerCase();
    return this.countries.filter(c => (c.name||'').toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q));
  }

  // ── Country CRUD ──────────────────────────────────────────────
  openAddCountry() {
    this.countryForm = { id: null, name: '', code: '', currency: '' };
    this.editingCountry = false; this.showCountryModal = true; this.countryError = '';
  }
  openEditCountry(c: any) {
    this.countryForm = { id: c.id, name: c.name, code: c.code||'', currency: c.currency||'' };
    this.editingCountry = true; this.showCountryModal = true; this.countryError = '';
  }
  closeCountryModal() { this.showCountryModal = false; this.countryError = ''; }

  saveCountry() {
    if (!this.countryForm.name.trim()) { this.countryError = 'Country name is required'; return; }
    if (!this.countryForm.code.trim()) { this.countryError = 'Country code required (e.g. JP, KH)'; return; }
    this.savingCountry = true; this.countryError = '';
    const body = { name: this.countryForm.name.trim(), code: this.countryForm.code.trim().toUpperCase(), currency: this.countryForm.currency.trim() };
    const headers = this.auth.getHeaders();
    const req = this.editingCountry
      ? this.http.put(`${BASE}/countries/${this.countryForm.id}`, body, { headers })
      : this.http.post(`${BASE}/countries`, body, { headers });
    req.subscribe({
      next: () => {
        this.savingCountry = false; this.showCountryModal = false;
        this.countrySuccess = this.editingCountry ? 'Country updated.' : 'Country created.';
        this.loadCountries();
        setTimeout(() => { this.countrySuccess = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.savingCountry = false; this.countryError = e?.error?.message || 'Failed.'; this.cdr.detectChanges(); },
    });
  }

  askDeleteCountry(id: number) { this.deleteCountryId = id; }
  cancelDeleteCountry()        { this.deleteCountryId = null; }
  confirmDeleteCountry() {
    if (!this.deleteCountryId) return;
    const id = this.deleteCountryId; this.deleteCountryId = null;
    this.http.delete(`${BASE}/countries/${id}`, { headers: this.auth.getHeaders() }).subscribe({
      next: () => { this.countrySuccess = 'Country deleted.'; this.loadCountries(); setTimeout(() => { this.countrySuccess = ''; this.cdr.detectChanges(); }, 3000); },
      error: (e) => { this.countryError = e?.error?.message || 'Delete failed.'; this.cdr.detectChanges(); },
    });
  }
}
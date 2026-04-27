import {
  Component, OnInit, OnDestroy, Input, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

const CAN_CREATE_ROLES: string[]     = ['BOSS', 'COUNTRY_DIRECTOR', 'VICE_PRESIDENT', 'ADMIN'];
const CAN_RETRANSLATE_ROLES: string[] = []; // empty = ဘယ် role မှ မမြင်ရ

@Component({
  selector: 'app-announcement-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './announcement-inline.html',
  host: { style: 'display:contents' }
})
export class AnnouncementInline implements OnInit, OnDestroy {

  @Input() branchId?: number;

  announcements: any[] = [];
  isLoading    = true;
  filter       = 'ALL';

  // ── Date filter — default: 6 months ago → today ──────────
  today    = new Date().toISOString().split('T')[0];
  fromDate = this.getThreeMonthsAgo();
  toDate   = this.today;

  // ── Form state ───────────────────────────────────────────
  showForm     = false;
  editingId: number | null = null;
  saving       = false;
  translating  = false;
  formError    = '';
  private _translateTimer: any = null;

  // ── Retranslate-all state ────────────────────────────────
  retranslating     = false;
  retranslateDone   = false;
  retranslateResult = '';
  retranslateError  = '';

  form = {
    title:       '',
    content:     '',
    priority:    'NORMAL',
    targetScope: 'BRANCH',
    targetId:    null as number | null,
    expireDays:  null as number | null,
  };

  readonly PRIORITIES = [
    { key: 'NORMAL',    label: 'Normal',    color: '#94a3b8' },
    { key: 'IMPORTANT', label: 'Important', color: '#f97316' },
    { key: 'URGENT',    label: 'Urgent',    color: '#ef4444' },
  ];

  readonly SCOPES = [
    { key: 'BRANCH',  label: '🏢 Branch',  desc: 'Branch members only' },
    { key: 'COUNTRY', label: '🌏 Country', desc: 'VP + all branches'   },
    { key: 'GLOBAL',  label: '🌐 Global',  desc: 'Boss + all branches' },
  ];

  readonly EXPIRE_OPTIONS = [
    { value: null, label: 'Never'   },
    { value: 1,    label: '1 day'   },
    { value: 7,    label: '7 days'  },
    { value: 30,   label: '30 days' },
    { value: 90,   label: '90 days' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadAnnouncements(); }

  ngOnDestroy(): void {
    if (this._translateTimer) clearTimeout(this._translateTimer);
  }

  // ── Date helpers ─────────────────────────────────────────
  private getThreeMonthsAgo(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  }

  // ── Role checks ─────────────────────────────────────────
  get canCreate(): boolean {
    return CAN_CREATE_ROLES.includes(this.auth.getRole());
  }
  get canRetranslate(): boolean {
    return CAN_RETRANSLATE_ROLES.includes(this.auth.getRole());
  }

  // ── ကိုယ့် announcement မှပဲ edit/delete/pin ───────────
  isMyAnnouncement(a: any): boolean {
    const user = this.auth.getUser();
    const myId = user?.id || user?.userId;
    return Number(a.authorId) === Number(myId);
  }

  // ── Load with date filter ────────────────────────────────
  loadAnnouncements(): void {
    this.isLoading = true;
    const url = `${BASE}/announcements?from=${this.fromDate}&to=${this.toDate}`;
    this.http.get<any[]>(url, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.announcements = list || [];
        this.isLoading     = false;
        this.cdr.detectChanges();
      });
  }

  // ── Search button ────────────────────────────────────────
  search(): void {
    this.announcements = [];
    this.loadAnnouncements();
  }

  // ── Reset to default (6 months) ─────────────────────────
  resetFilter(): void {
    this.fromDate = this.getThreeMonthsAgo();
    this.toDate   = this.today;
    this.loadAnnouncements();
  }

  // ── Display ─────────────────────────────────────────────
  getTitle(a: any): string   { return a.translatedTitle   || a.title;   }
  getContent(a: any): string { return a.translatedContent || a.content; }

  // ── Save button label ───────────────────────────────────
  get saveLabel(): string {
    if (this.translating) return 'Translating to 6 languages... 🌐';
    if (this.saving)      return 'Saving...';
    return this.editingId ? '✓ Update' : '✓ Publish';
  }

  // ── Filter + Sort (active အပေါ်၊ expired အောက်) ──────────
  get filtered(): any[] {
    const now = new Date();
    let list: any[];
    switch (this.filter) {
      case 'ACTIVE':  list = this.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > now); break;
      case 'EXPIRED': list = this.announcements.filter(a =>  a.expiresAt && new Date(a.expiresAt) <= now); break;
      case 'PINNED':  list = this.announcements.filter(a =>  a.isPinned === 1); break;
      default:        list = [...this.announcements]; break;
    }
    return list.sort((a, b) => {
      const aExp = !!(a.expiresAt && new Date(a.expiresAt) <= now);
      const bExp = !!(b.expiresAt && new Date(b.expiresAt) <= now);
      if (aExp && !bExp) return 1;
      if (!aExp && bExp) return -1;
      return 0;
    });
  }

  get filterCounts(): Record<string, number> {
    const now = new Date();
    return {
      ALL:     this.announcements.length,
      ACTIVE:  this.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > now).length,
      EXPIRED: this.announcements.filter(a =>  a.expiresAt && new Date(a.expiresAt) <= now).length,
      PINNED:  this.announcements.filter(a =>  a.isPinned === 1).length,
    };
  }

  // ── Form ────────────────────────────────────────────────
  openForm(): void {
    this.editingId   = null;
    this.form        = { title: '', content: '', priority: 'NORMAL', targetScope: 'BRANCH', targetId: null, expireDays: null };
    this.formError   = '';
    this.saving      = false;
    this.translating = false;
    this.showForm    = true;
  }

  openEdit(a: any): void {
    this.editingId   = a.id;
    this.form        = { title: a.title || '', content: a.content || '', priority: a.priority || 'NORMAL', targetScope: a.targetScope || 'BRANCH', targetId: a.targetId ?? null, expireDays: null };
    this.formError   = '';
    this.saving      = false;
    this.translating = false;
    this.showForm    = true;
  }

  closeForm(): void {
    if (this.saving || this.translating) return;
    this.showForm  = false;
    this.editingId = null;
    this.formError = '';
    if (this._translateTimer) clearTimeout(this._translateTimer);
  }

  save(): void {
    if (!this.form.title.trim() || !this.form.content.trim()) {
      this.formError = 'Title and Content are required';
      return;
    }
    this.saving      = true;
    this.translating = false;
    this.formError   = '';

    this._translateTimer = setTimeout(() => {
      if (this.saving) {
        this.saving      = false;
        this.translating = true;
        this.cdr.detectChanges();
      }
    }, 800);

    const h    = { headers: this.auth.getHeaders() };
    const req$ = this.editingId
      ? this.http.put<any>(`${BASE}/announcements/${this.editingId}`, this.form, h)
      : this.http.post<any>(`${BASE}/announcements`, this.form, h);

    req$.subscribe({
      next: (saved) => {
        clearTimeout(this._translateTimer);
        this.saving      = false;
        this.translating = false;
        if (this.editingId) {
          const idx = this.announcements.findIndex(a => a.id === this.editingId);
          if (idx > -1) this.announcements[idx] = saved;
        } else {
          this.announcements.unshift(saved);
        }
        this.showForm  = false;
        this.editingId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        clearTimeout(this._translateTimer);
        this.saving      = false;
        this.translating = false;
        this.formError   = 'Failed to save. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  delete(a: any): void {
    if (!confirm(`Delete "${a.title}"?`)) return;
    this.http.delete(`${BASE}/announcements/${a.id}`, { headers: this.auth.getHeaders() })
      .subscribe({ next: () => {
        this.announcements = this.announcements.filter(x => x.id !== a.id);
        this.cdr.detectChanges();
      }});
  }

  togglePin(a: any): void {
    this.http.patch<any>(`${BASE}/announcements/${a.id}/pin`, {}, { headers: this.auth.getHeaders() })
      .subscribe({ next: (updated) => {
        const idx = this.announcements.findIndex(x => x.id === a.id);
        if (idx > -1) this.announcements[idx] = { ...this.announcements[idx], isPinned: updated.isPinned };
        this.cdr.detectChanges();
      }});
  }

  retranslateAll(): void {
    if (!confirm('Translate all existing announcements to 6 languages?\n\nThis may take 1-2 minutes.')) return;
    this.retranslating    = true;
    this.retranslateDone  = false;
    this.retranslateResult = '';
    this.retranslateError  = '';
    this.cdr.detectChanges();

    this.http.post<any>(
      `${BASE}/announcements/admin/retranslate-all`, {},
      { headers: this.auth.getHeaders() }
    ).pipe(catchError(err => of({ error: err?.error?.message || 'Failed' })))
     .subscribe(res => {
       this.retranslating = false;
       if (res.error) {
         this.retranslateError = '❌ ' + res.error;
       } else {
         this.retranslateResult = `✅ Done: ${res.success}/${res.total} translated`;
         this.retranslateDone   = true;
         this.loadAnnouncements();
       }
       this.cdr.detectChanges();
       setTimeout(() => {
         this.retranslateResult = '';
         this.retranslateError  = '';
         this.cdr.detectChanges();
       }, 5000);
     });
  }

  // ── Style helpers ───────────────────────────────────────
  getPriorityColor(p: string): string {
    return p === 'URGENT' ? '#ef4444' : p === 'IMPORTANT' ? '#f97316' : '#94a3b8';
  }
  getPriorityBg(p: string): string {
    return p === 'URGENT' ? 'rgba(239,68,68,0.12)' : p === 'IMPORTANT' ? 'rgba(249,115,22,0.12)' : 'rgba(148,163,184,0.1)';
  }
  getScopeColor(s: string): string {
    return s === 'GLOBAL' ? '#a855f7' : s === 'COUNTRY' ? '#3b82f6' : '#22c55e';
  }
  getScopeBg(s: string): string {
    return s === 'GLOBAL' ? 'rgba(168,85,247,0.12)' : s === 'COUNTRY' ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.1)';
  }
  isExpired(a: any): boolean { return !!a.expiresAt && new Date(a.expiresAt) <= new Date(); }
  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600)  + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
}
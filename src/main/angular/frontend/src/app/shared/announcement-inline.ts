import {
  Component, OnInit, Input, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-announcement-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './announcement-inline.html',
  host: { style: 'display:contents' }
})
export class AnnouncementInline implements OnInit {

  @Input() branchId?: number;

  @Input() set lang(val: string) {
    if (val && val !== this.currentLang) {
      this.currentLang     = val;
      this.translatedCache = {};
      if (this.announcements.length > 0 && val !== 'en') {
        this.translateBatch();
      }
      this.cdr.detectChanges();
    }
  }

  announcements: any[] = [];
  isLoading     = true;
  filter        = 'ALL';

  translatingId: number | null = null;
  translatedCache: Record<number, { title: string; content: string }> = {};
  currentLang = 'en';

  showForm  = false;
  editingId: number | null = null;
  saving    = false;
  formError = '';

  form = {
    title:            '',
    content:          '',
    priority:         'NORMAL',
    targetScope:      'BRANCH',
    targetId:         null as number | null,
    expireDays:       null as number | null,
    originalLanguage: 'en',
  };

  readonly PRIORITIES = [
    { key: 'NORMAL',    label: 'Normal',    color: '#94a3b8' },
    { key: 'IMPORTANT', label: 'Important', color: '#f97316' },
    { key: 'URGENT',    label: 'Urgent',    color: '#ef4444' },
  ];

  readonly SCOPES = [
    { key: 'BRANCH',  label: '🏢 Branch',  desc: 'Branch members only' },
    { key: 'COUNTRY', label: '🌏 Country', desc: 'VP + all branches' },
    { key: 'GLOBAL',  label: '🌐 Global',  desc: 'Boss + all branches' },
  ];

  readonly EXPIRE_OPTIONS = [
    { value: null, label: 'Never' },
    { value: 1,    label: '1 day' },
    { value: 7,    label: '7 days' },
    { value: 30,   label: '30 days' },
    { value: 90,   label: '90 days' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentLang = this.auth.getUser()?.preferredLanguage || 'en';
    this.loadAnnouncements();
  }

  loadAnnouncements(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${BASE}/announcements`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.announcements = list || [];
        this.isLoading = false;
        this.cdr.detectChanges();
        // Batch translate — 1 call for all
        if (this.currentLang !== 'en' && this.announcements.length > 0) {
          this.translateBatch();
        }
      });
  }

  // ── Batch translate — 1 API call ────────────────────────
  private translateBatch(): void {
    // Only translate announcements whose originalLanguage != currentLang
    const toTranslate = this.announcements.filter(a =>
      (a.originalLanguage || 'en') !== this.currentLang
    );
    if (toTranslate.length === 0) return;

    const ids = toTranslate.map(a => a.id);
    this.http.post<any[]>(
      `${BASE}/announcements/translate-batch`,
      { ids, lang: this.currentLang },
      { headers: this.auth.getHeaders() }
    ).pipe(catchError(() => of([])))
     .subscribe(res => {
       (res || []).forEach((r: any) => {
         if (r.id) this.translatedCache[r.id] = { title: r.title, content: r.content };
       });
       this.cdr.detectChanges();
     });
  }

  get filtered(): any[] {
    const now = new Date();
    switch (this.filter) {
      case 'ACTIVE':  return this.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > now);
      case 'EXPIRED': return this.announcements.filter(a => a.expiresAt && new Date(a.expiresAt) <= now);
      case 'PINNED':  return this.announcements.filter(a => a.isPinned === 1);
      default:        return this.announcements;
    }
  }

  canTranslate(): boolean { return this.currentLang !== 'en'; }

  translate(a: any): void {
    if (!this.canTranslate()) return;
    if (this.translatedCache[a.id]) {
      delete this.translatedCache[a.id];
      this.cdr.detectChanges();
      return;
    }
    this.translatingId = a.id;
    this.http.get<any>(
      `${BASE}/announcements/${a.id}/translate?lang=${this.currentLang}`,
      { headers: this.auth.getHeaders() }
    ).pipe(catchError(() => of(null)))
     .subscribe(res => {
       if (res) this.translatedCache[a.id] = { title: res.title, content: res.content };
       this.translatingId = null;
       this.cdr.detectChanges();
     });
  }

  getTitle(a: any): string      { return this.translatedCache[a.id]?.title   || a.title;   }
  getContent(a: any): string    { return this.translatedCache[a.id]?.content || a.content; }
  isTranslated(a: any): boolean { return !!this.translatedCache[a.id]; }

  canCreate(): boolean {
    const role = this.auth.getUser()?.role || '';
    return ['BOSS','COUNTRY_DIRECTOR','VICE_PRESIDENT','ADMIN','PROJECT_MANAGER'].includes(role);
  }

  canEdit(a: any): boolean {
    const user = this.auth.getUser();
    const role = user?.role || '';
    const myId = user?.id || user?.userId;
    if (['BOSS','COUNTRY_DIRECTOR'].includes(role)) return true;
    return Number(a.authorId) === Number(myId);
  }

  private getDefaultScope(): string {
    const role = this.auth.getUser()?.role || '';
    if (role === 'BOSS') return 'GLOBAL';
    if (role === 'COUNTRY_DIRECTOR') return 'COUNTRY';
    return 'BRANCH';
  }

  openCreate(): void {
    this.editingId = null;
    this.form = {
      title: '', content: '', priority: 'NORMAL',
      targetScope:      this.getDefaultScope(),
      targetId:         this.branchId || this.auth.getUser()?.branchId || null,
      expireDays:       null,
      originalLanguage: this.auth.getUser()?.preferredLanguage || 'en', // ✅
    };
    this.formError = '';
    this.showForm  = true;
    this.cdr.detectChanges();
  }

  openEdit(a: any): void {
    this.editingId = a.id;
    this.form = {
      title:            a.title            || '',
      content:          a.content          || '',
      priority:         a.priority         || 'NORMAL',
      targetScope:      a.targetScope      || 'BRANCH',
      targetId:         a.targetId         || null,
      expireDays:       null,
      originalLanguage: a.originalLanguage || 'en',
    };
    this.formError = '';
    this.showForm  = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm  = false;
    this.editingId = null;
    this.cdr.detectChanges();
  }

  save(): void {
    if (!this.form.title.trim())   { this.formError = 'Title is required';   return; }
    if (!this.form.content.trim()) { this.formError = 'Content is required'; return; }
    this.saving = true; this.formError = '';
    const h = { headers: this.auth.getHeaders() };
    const req$ = this.editingId
      ? this.http.put<any>(`${BASE}/announcements/${this.editingId}`, this.form, h)
      : this.http.post<any>(`${BASE}/announcements`, this.form, h);
    req$.subscribe({
      next: (saved) => {
        if (this.editingId) {
          const idx = this.announcements.findIndex(a => a.id === this.editingId);
          if (idx > -1) this.announcements[idx] = saved;
        } else {
          this.announcements.unshift(saved);
        }
        this.saving = false; this.showForm = false; this.editingId = null;
        this.cdr.detectChanges();
      },
      error: () => { this.formError = 'Failed to save'; this.saving = false; this.cdr.detectChanges(); }
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
        if (idx > -1) this.announcements[idx] = updated;
        this.cdr.detectChanges();
      }});
  }

  getPriorityColor(p: string): string { return p==='URGENT'?'#ef4444':p==='IMPORTANT'?'#f97316':'#94a3b8'; }
  getPriorityBg(p: string): string    { return p==='URGENT'?'rgba(239,68,68,0.12)':p==='IMPORTANT'?'rgba(249,115,22,0.12)':'rgba(148,163,184,0.1)'; }
  getScopeColor(s: string): string    { return s==='GLOBAL'?'#a855f7':s==='COUNTRY'?'#3b82f6':'#22c55e'; }
  getScopeBg(s: string): string       { return s==='GLOBAL'?'rgba(168,85,247,0.12)':s==='COUNTRY'?'rgba(59,130,246,0.12)':'rgba(34,197,94,0.1)'; }

  isExpired(a: any): boolean { return !!a.expiresAt && new Date(a.expiresAt) <= new Date(); }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff/60)   + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600)  + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }

  get filterCounts(): Record<string, number> {
    const now = new Date();
    return {
      ALL:     this.announcements.length,
      ACTIVE:  this.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > now).length,
      EXPIRED: this.announcements.filter(a => a.expiresAt && new Date(a.expiresAt) <= now).length,
      PINNED:  this.announcements.filter(a => a.isPinned === 1).length,
    };
  }
}
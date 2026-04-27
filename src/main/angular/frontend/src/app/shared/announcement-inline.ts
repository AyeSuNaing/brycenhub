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

  announcements: any[] = [];
  isLoading     = true;
  filter        = 'ALL'; // ALL | ACTIVE | EXPIRED | PINNED

  // Form
  showForm  = false;
  editingId: number | null = null;
  saving    = false;
  formError = '';

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
    this.loadAnnouncements();
  }

  // ══════════════════════════════════════════════════════════════
  // DATA
  // ══════════════════════════════════════════════════════════════

  loadAnnouncements(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${BASE}/announcements`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.announcements = list || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  get filtered(): any[] {
    const now = new Date();
    switch (this.filter) {
      case 'ACTIVE':
        return this.announcements.filter(a =>
          !a.expiresAt || new Date(a.expiresAt) > now);
      case 'EXPIRED':
        return this.announcements.filter(a =>
          a.expiresAt && new Date(a.expiresAt) <= now);
      case 'PINNED':
        return this.announcements.filter(a => a.isPinned === 1);
      default:
        return this.announcements;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ══════════════════════════════════════════════════════════════

  canCreate(): boolean {
    const role = this.auth.getUser()?.role || '';
    return ['BOSS','COUNTRY_DIRECTOR','VICE_PRESIDENT','ADMIN','PROJECT_MANAGER']
      .includes(role);
  }

  canEdit(a: any): boolean {
    const user = this.auth.getUser();
    const role = user?.role || '';
    const myId = user?.id || user?.userId;
    if (['BOSS','COUNTRY_DIRECTOR'].includes(role)) return true;
    return Number(a.authorId) === Number(myId);
  }

  // ══════════════════════════════════════════════════════════════
  // FORM
  // ══════════════════════════════════════════════════════════════

  openCreate(): void {
    this.editingId  = null;
    this.form       = {
      title: '', content: '', priority: 'NORMAL',
      targetScope: 'BRANCH',
      targetId: this.branchId || this.auth.getUser()?.branchId || null,
      expireDays: null,
    };
    this.formError  = '';
    this.showForm   = true;
    this.cdr.detectChanges();
  }

  openEdit(a: any): void {
    this.editingId = a.id;
    this.form = {
      title:       a.title       || '',
      content:     a.content     || '',
      priority:    a.priority    || 'NORMAL',
      targetScope: a.targetScope || 'BRANCH',
      targetId:    a.targetId    || null,
      expireDays:  null,
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
    this.saving    = true;
    this.formError = '';

    const h = { headers: this.auth.getHeaders() };

    // ── Fix: ternary instead of dynamic bracket ──────────────
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
        this.saving    = false;
        this.showForm  = false;
        this.editingId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.formError = 'Failed to save';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  delete(a: any): void {
    if (!confirm(`Delete "${a.title}"?`)) return;
    this.http.delete(`${BASE}/announcements/${a.id}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => {
          this.announcements = this.announcements.filter(x => x.id !== a.id);
          this.cdr.detectChanges();
        }
      });
  }

  togglePin(a: any): void {
    this.http.patch<any>(`${BASE}/announcements/${a.id}/pin`, {},
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: (updated) => {
          const idx = this.announcements.findIndex(x => x.id === a.id);
          if (idx > -1) this.announcements[idx] = updated;
          this.cdr.detectChanges();
        }
      });
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  getPriorityColor(p: string): string {
    return p === 'URGENT' ? '#ef4444' : p === 'IMPORTANT' ? '#f97316' : '#94a3b8';
  }

  getPriorityBg(p: string): string {
    return p === 'URGENT'    ? 'rgba(239,68,68,0.12)'
         : p === 'IMPORTANT' ? 'rgba(249,115,22,0.12)'
         : 'rgba(148,163,184,0.1)';
  }

  isExpired(a: any): boolean {
    return !!a.expiresAt && new Date(a.expiresAt) <= new Date();
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600)  + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
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
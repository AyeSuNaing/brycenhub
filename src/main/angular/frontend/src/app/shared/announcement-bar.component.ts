import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { AuthService }   from '../services/auth.service';
import { RefreshService } from '../services/refresh.service';
import { environment }   from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-announcement-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-bar.component.html',
  styleUrl: './announcement-bar.component.scss',
})
export class AnnouncementBarComponent implements OnInit, OnDestroy {

  // backward compat — parent pass ရင် accept မယ် (ဟောင်းတဲ့ code မပျက်ဘဲ)
  @Input() set announcements(val: any[]) {
    if (!this._selfLoaded && val?.length) {
      this._announcements = val;
    }
  }
  @Output() announcementsChange = new EventEmitter<any[]>();

  _announcements: any[] = [];
  _selfLoaded = false;

  get announcements(): any[] { return this._announcements; }

  barIdx    = 0;
  modalOpen = false;
  modalIdx  = 0;

  get current():   any { return this._announcements[this.barIdx];  }
  get modalAnn():  any { return this._announcements[this.modalIdx]; }

  // ── Display helpers — translatedTitle/Content first ─────
  getTitle(a: any): string   { return a?.translatedTitle   || a?.title   || ''; }
  getContent(a: any): string { return a?.translatedContent || a?.content || a?.text || ''; }

  private _sub?: Subscription;

  constructor(
    private http:    HttpClient,
    private auth:    AuthService,
    private refresh: RefreshService,
  ) {}

  ngOnInit(): void {
    this.load();
    this._sub = this.refresh.refresh$.subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  // ── Load from /api/announcements ────────────────────────
  // Backend က JWT user lang ပေါ် မူတည်ပြီး
  // translatedTitle + translatedContent ထည့်ပြီး return လုပ်ပြီ
  load(): void {
    this.http.get<any[]>(`${BASE}/announcements`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe({
        next: data => {
          this._selfLoaded    = true;
          // active only (not expired)
          const now = new Date();
          this._announcements = (data || []).filter(a =>
            !a.expiresAt || new Date(a.expiresAt) > now
          );
          if (this.barIdx >= this._announcements.length) {
            this.barIdx = Math.max(0, this._announcements.length - 1);
          }
        },
        error: () => { /* keep existing */ }
      });
  }

  next() { this.barIdx = (this.barIdx + 1) % this._announcements.length; }
  prev() { this.barIdx = (this.barIdx - 1 + this._announcements.length) % this._announcements.length; }

  openModal(idx: number)  { this.modalIdx = idx; this.modalOpen = true; }
  closeModal()            { this.modalOpen = false; }
  modalNext() { this.modalIdx = (this.modalIdx + 1) % this._announcements.length; }
  modalPrev() { this.modalIdx = (this.modalIdx - 1 + this._announcements.length) % this._announcements.length; }

  dismiss(id: number): void {
    const updated = this._announcements.filter(a => a.id !== id);
    if (this.barIdx >= updated.length) this.barIdx = Math.max(0, updated.length - 1);
    this._announcements = updated;
    this.announcementsChange.emit(updated);
  }

  // ── Priority → tag color ────────────────────────────────
  getTagColor(a: any): string {
    if (a?.priority === 'URGENT')    return '#ef4444';
    if (a?.priority === 'IMPORTANT') return '#f97316';
    // role-based fallback (ဟောင်းတဲ့ dashboard endpoint data)
    if (a?.tagColor) return a.tagColor;
    return '#22c55e';
  }

  getTag(a: any): string {
    if (a?.priority === 'URGENT')    return '🚨 URGENT';
    if (a?.priority === 'IMPORTANT') return '⚠️ IMPORTANT';
    if (a?.tag) return a.tag;
    return '📢 INFO';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600)  + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
}
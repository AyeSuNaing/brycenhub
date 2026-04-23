import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { Announcement } from '../models/dashboard.models';
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

  // ── Parent can still pass announcements (backward compat) ──
  @Input() set announcements(val: Announcement[]) {
    // Only use parent-passed data if we haven't loaded our own yet
    if (!this._selfLoaded && val?.length) {
      this._announcements = val;
    }
  }
  @Output() announcementsChange = new EventEmitter<Announcement[]>();

  _announcements: Announcement[] = [];
  _selfLoaded = false;

  get announcements(): Announcement[] { return this._announcements; }

  barIdx    = 0;
  modalOpen = false;
  modalIdx  = 0;

  get current():  Announcement { return this._announcements[this.barIdx]; }
  get modalAnn(): Announcement { return this._announcements[this.modalIdx]; }

  private _sub?: Subscription;

  constructor(
    private http:    HttpClient,
    private auth:    AuthService,
    private refresh: RefreshService,
  ) {}

  ngOnInit(): void {
    this.load();

    // 🔔 Subscribe to global refresh trigger
    this._sub = this.refresh.refresh$.subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  load(): void {
    this.http.get<any[]>(`${BASE}/dashboard/pm/announcements`,
        { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this._selfLoaded = true;
          this._announcements = data;
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
}

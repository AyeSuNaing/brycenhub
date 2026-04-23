import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { Notification }   from '../models/dashboard.models';
import { AuthService }    from '../services/auth.service';
import { RefreshService } from '../services/refresh.service';
import { environment }    from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-bell-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bell-notification.component.html',
  styleUrl: './bell-notification.component.scss',
})
export class BellNotificationComponent implements OnInit, OnDestroy {

  // ── Parent can still pass notifications (backward compat) ──
  @Input() set notifications(val: Notification[]) {
    if (!this._selfLoaded && val?.length) {
      this._notifications = val;
    }
  }

  _notifications: Notification[] = [];
  _selfLoaded = false;

  isOpen = false;
  tab: 'all' | 'activity' | 'mentions' = 'all';

  get unreadCount()    { return this._notifications.filter(n => n.unread).length; }
  get activityUnread() { return this._notifications.filter(n => n.unread && n.type === 'activity').length; }
  get mentionUnread()  { return this._notifications.filter(n => n.unread && n.type === 'mention').length; }

  get filtered(): Notification[] {
    if (this.tab === 'activity') return this._notifications.filter(n => n.type === 'activity');
    if (this.tab === 'mentions') return this._notifications.filter(n => n.type === 'mention');
    return this._notifications;
  }

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

    // Close on outside click
    document.addEventListener('click', () => { if (this.isOpen) this.isOpen = false; });
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  load(): void {
    this.http.get<any[]>(`${BASE}/notifications/my`,
        { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          this._selfLoaded = true;
          // Map backend fields → Notification model
          this._notifications = (data || []).map(n => ({
            id:      n.id,
            type:    n.referenceType === 'TASK' ? 'activity' : 'activity',
            name:    n.title   || '',
            text:    n.content || '',
            avatar:  (n.title || '?').charAt(0).toUpperCase(),
            color:   '#16a34a',
            project: n.referenceType || '',
            time:    this.timeAgo(n.createdAt),
            unread:  !n.isRead,
          }));
        },
        error: () => { /* keep existing */ }
      });
  }

  private timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  toggle(e: Event) { e.stopPropagation(); this.isOpen = !this.isOpen; }

  setTab(t: 'all' | 'activity' | 'mentions', e: Event) {
    e.stopPropagation();
    this.tab = t;
  }

  markAllRead(): void {
    this._notifications.forEach(n => n.unread = false);
    this.http.put(`${BASE}/notifications/read-all`, {},
        { headers: this.auth.getHeaders() })
      .subscribe();
  }
}

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notification } from '../models/dashboard.models';

@Component({
  selector: 'app-bell-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bell-notification.component.html',
  styleUrl: './bell-notification.component.scss',
})
export class BellNotificationComponent implements OnInit {
  @Input() notifications: Notification[] = [];

  isOpen = false;
  tab: 'all' | 'activity' | 'mentions' = 'all';

  get unreadCount() { return this.notifications.filter(n => n.unread).length; }
  get activityUnread() { return this.notifications.filter(n => n.unread && n.type === 'activity').length; }
  get mentionUnread() { return this.notifications.filter(n => n.unread && n.type === 'mention').length; }

  get filtered(): Notification[] {
    if (this.tab === 'activity') return this.notifications.filter(n => n.type === 'activity');
    if (this.tab === 'mentions') return this.notifications.filter(n => n.type === 'mention');
    return this.notifications;
  }

  ngOnInit() {
    // Close on outside click
    document.addEventListener('click', () => { if (this.isOpen) this.isOpen = false; });
  }

  toggle(e: Event) {
    e.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  setTab(t: 'all' | 'activity' | 'mentions', e: Event) {
    e.stopPropagation();
    this.tab = t;
  }

  markAllRead() {
    this.notifications.forEach(n => n.unread = false);
  }
}

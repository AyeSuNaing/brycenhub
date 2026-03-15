import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Announcement } from '../models/dashboard.models';

@Component({
  selector: 'app-announcement-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-bar.component.html',
  styleUrl: './announcement-bar.component.scss',
})
export class AnnouncementBarComponent implements OnInit {
  @Input() announcements: Announcement[] = [];
  @Output() announcementsChange = new EventEmitter<Announcement[]>();

  barIdx = 0;
  modalOpen = false;
  modalIdx = 0;

  get current(): Announcement { return this.announcements[this.barIdx]; }
  get modalAnn(): Announcement { return this.announcements[this.modalIdx]; }

  ngOnInit() {}

  next() { this.barIdx = (this.barIdx + 1) % this.announcements.length; }
  prev() { this.barIdx = (this.barIdx - 1 + this.announcements.length) % this.announcements.length; }

  openModal(idx: number) { this.modalIdx = idx; this.modalOpen = true; }
  closeModal() { this.modalOpen = false; }
  modalNext() { this.modalIdx = (this.modalIdx + 1) % this.announcements.length; }
  modalPrev() { this.modalIdx = (this.modalIdx - 1 + this.announcements.length) % this.announcements.length; }

  dismiss(id: number) {
    const updated = this.announcements.filter(a => a.id !== id);
    if (this.barIdx >= updated.length) this.barIdx = Math.max(0, updated.length - 1);
    this.announcementsChange.emit(updated);
  }
}

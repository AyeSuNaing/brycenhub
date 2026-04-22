import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ChatPopupComponent, ChatMember } from '../chat-popup/chat-popup.component';
import { environment } from '../../../environments/environment';

const USERS_BASE = `${environment.apiBaseUrl}/users`;

interface StaffItem {
  id: number;
  name: string;
  roleName?: string;
  roleDisplayName?: string;
  roleColor?: string;
  departmentName?: string;
  branchId?: number;
  branchName?: string;
}

@Component({
  selector: 'app-staff-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatPopupComponent],
  templateUrl: './staff-panel.component.html',
  styleUrls: ['./staff-panel.component.scss'],
})
export class StaffPanelComponent implements OnInit {
  /** Disable chat button entirely (default: true = enabled) */
  @Input() enableChat = true;

  /** Custom title (if empty → auto-generated per role) */
  @Input() title = '';

  // ── State ─────────────────────────────────
  currentUser: any = null;
  staffList: StaffItem[] = [];
  loading = false;

  // Filters
  searchQuery = '';
  selectedRoleFilter = 'ALL';
  selectedBranchFilter: number | 'ALL' = 'ALL';

  roleFilters = [
    { key: 'ALL',             label: 'All',    color: '#94a3b8' },
    { key: 'BOSS',            label: 'Boss',   color: '#ef4444' },
    { key: 'COUNTRY_DIRECTOR',label: 'CD',     color: '#f97316' },
    { key: 'VICE_PRESIDENT',  label: 'VP',     color: '#ef4444' },
    { key: 'ADMIN',           label: 'Admin',  color: '#ec4899' },
    { key: 'PROJECT_MANAGER', label: 'PM',     color: '#22c55e' },
    { key: 'LEADER',          label: 'Leader', color: '#06b6d4' },
    { key: 'DEVELOPER',       label: 'Dev',    color: '#6366f1' },
    { key: 'DATA_ENGINEER',   label: 'Data',   color: '#06b6d4' },
    { key: 'UI_UX',           label: 'UI/UX',  color: '#a855f7' },
    { key: 'QA',              label: 'QA',     color: '#14b8a6' },
  ];

  // Chat popup
  chatTarget: ChatMember | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadStaff();
  }

  private get headers() { return this.auth.getHeaders(); }

  // ─────────────────────────────────────────────
  // COMPUTED — Role-based UI hints
  // ─────────────────────────────────────────────
  get userRoleName(): string {
    return this.currentUser?.role || this.currentUser?.roleName || '';
  }

  get isGlobalRole(): boolean {
    const r = this.userRoleName;
    return r === 'BOSS' || r === 'COUNTRY_DIRECTOR';
  }

  get panelTitle(): string {
    if (this.title) return this.title;
    if (this.userRoleName === 'BOSS') return 'All Staff';
    if (this.userRoleName === 'COUNTRY_DIRECTOR') return 'Country Staff';
    return 'Branch Staff';
  }

  // ─────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────
  loadStaff(): void {
    this.loading = true;
    this.http.get<any[]>(`${USERS_BASE}/staff-panel`, { headers: this.headers })
      .pipe(catchError(err => {
        console.error('[staff-panel]', err);
        // Fallback to legacy endpoint
        return this.http.get<any[]>(`${USERS_BASE}/staff-list`, { headers: this.headers })
          .pipe(catchError(() => of([])));
      }))
      .subscribe(list => {
        this.staffList = (list || []).map(s => ({
          id: s.id || s.userId,
          name: s.name,
          roleName: s.roleName || s.role,
          roleDisplayName: s.roleDisplayName || s.roleName,
          roleColor: s.roleColor,
          departmentName: s.departmentName,
          branchId: s.branchId,
          branchName: s.branchName,
        }));
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  // ─────────────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────────────
  setRoleFilter(key: string): void { this.selectedRoleFilter = key; }
  setBranchFilter(bId: number | 'ALL'): void { this.selectedBranchFilter = bId; }

  /** Unique branches in loaded staff */
  get availableBranches(): { id: number; name: string; count: number }[] {
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const s of this.staffList) {
      if (s.branchId && s.branchName) {
        const existing = map.get(s.branchId);
        if (existing) existing.count++;
        else map.set(s.branchId, { id: s.branchId, name: s.branchName, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Show branch filter row only when 2+ branches visible (BOSS/multi-branch CD) */
  get showBranchFilter(): boolean {
    return this.availableBranches.length >= 2;
  }

  get filteredStaff(): StaffItem[] {
    let list = this.staffList;

    // Branch filter
    if (this.selectedBranchFilter !== 'ALL') {
      list = list.filter(s => s.branchId === this.selectedBranchFilter);
    }

    // Role filter
    if (this.selectedRoleFilter !== 'ALL') {
      list = list.filter(s => s.roleName === this.selectedRoleFilter);
    }

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.branchName?.toLowerCase().includes(q) ||
        s.departmentName?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  /** Role counts within current branch filter */
  get staffCountByRole(): { [k: string]: number } {
    const branchFiltered = this.selectedBranchFilter === 'ALL'
      ? this.staffList
      : this.staffList.filter(s => s.branchId === this.selectedBranchFilter);

    const counts: { [k: string]: number } = { ALL: branchFiltered.length };
    for (const s of branchFiltered) {
      const key = s.roleName || '';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  /** Hide role chips with 0 count */
  get visibleRoleFilters() {
    return this.roleFilters.filter(r => {
      if (r.key === 'ALL') return true;
      return (this.staffCountByRole[r.key] || 0) > 0;
    });
  }

  // ─────────────────────────────────────────────
  // CHAT
  // ─────────────────────────────────────────────
  openChatWith(s: StaffItem): void {
    if (!this.enableChat) return;
    if (s.id === this.currentUser?.id) return;

    this.chatTarget = {
      id: s.id,
      name: s.name,
      role: s.roleDisplayName,
      color: s.roleColor,
      initial: this.getInitial(s.name),
    };
  }

  closeChat(): void {
    this.chatTarget = null;
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  getAvatarColor(id: number): string {
    const colors = ['#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];
    return colors[id % colors.length];
  }

  getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  toTitleCase(s: string): string {
    if (!s) return '';
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}
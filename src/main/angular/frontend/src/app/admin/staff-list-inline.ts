import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { getLabel, AppLabelKey } from '../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-staff-list-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-list-inline.html',
  host: { style: 'display:contents' }
})
export class StaffListInline implements OnInit {

  @Input() showAddBtn = true;

  @Output() addStaff    = new EventEmitter<void>();
  @Output() editStaff   = new EventEmitter<any>();
  @Output() viewProfile = new EventEmitter<any>();
  @Output() back        = new EventEmitter<void>();

  staffList:   any[] = [];
  departments: any[] = [];
  roles:       any[] = [];
  isLoading    = true;

  searchQuery  = '';
  filterDept   = '';
  filterRole   = '';
  filterStatus = '';
  filterBranch = '';

  // ── Role helpers ──
  get userRole(): string {
    return this.auth.getUser()?.role || '';
  }
  get isBoss(): boolean {
    return this.userRole === 'BOSS';
  }

  get isCountryDirector(): boolean {
    return this.userRole === 'COUNTRY_DIRECTOR';
  }

  /**
   * isSuperAdmin: ADMIN role + branchId = null
   * Super Admin ကို BOSS နဲ့ branch filter တူအောင် ထားမည်
   */
  get isSuperAdmin(): boolean {
    const user = this.auth.getUser();
    return user?.role === 'ADMIN' && (user?.branchId == null || user?.branchId === undefined);
  }

  /**
   * isGlobalView: Branch filter ပြမည့် roles
   * BOSS | COUNTRY_DIRECTOR | Super Admin (ADMIN + branchId null)
   */
  get isGlobalView(): boolean {
    return this.isBoss || this.isCountryDirector || this.isSuperAdmin;
  }

  // ── Unique branches from staffList ─────────────────────────────
  get availableBranches(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    for (const s of this.staffList) {
      if (s.branchId && s.branchName) map.set(s.branchId, s.branchName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadStaff();
    this.loadDepartments();
    this.loadRoles();
  }

  // ── i18n helper ──
  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  // ── Load Staff ────────────────────────────────────────────────
  // BOSS / COUNTRY_DIRECTOR / Super Admin → all-staff (global)
  // Others → staff-list (own branch only)
  loadStaff() {
    this.isLoading = true;
    const endpoint = this.isGlobalView
      ? `${BASE}/users/all-staff`
      : `${BASE}/users/staff-list`;

    this.http.get<any[]>(endpoint, { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.staffList = list || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; }
      });
  }

  // ── Load Departments ──────────────────────────────────────────
  // Global view → skip (branch filter ပဲ သုံး)
  // Others → my-branch departments
  loadDepartments() {
    if (this.isGlobalView) {
      this.departments = [];
      return;
    }
    this.http.get<any[]>(`${BASE}/departments/my-branch`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.departments = list || []; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  loadRoles() {
    this.http.get<any[]>(`${BASE}/user-roles`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.roles = list || []; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  // ── Role sort order ────────────────────────────────────────────
  private roleOrder(roleName: string): number {
    switch ((roleName || '').toUpperCase()) {
      case 'BOSS':             return 1;
      case 'COUNTRY_DIRECTOR': return 2;
      case 'VICE_PRESIDENT':   return 3;
      case 'ADMIN':            return 4;
      case 'PROJECT_MANAGER':  return 5;
      case 'LEADER':           return 6;
      case 'UI_UX':            return 7;
      case 'DEVELOPER':        return 8;
      case 'QA':               return 9;
      default:                 return 99;
    }
  }

  // ── Filtered list ──────────────────────────────────────────────
  get filteredList(): any[] {
    return this.staffList
      .filter(s => {
        const matchSearch  = !this.searchQuery ||
          s.name?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          s.email?.toLowerCase().includes(this.searchQuery.toLowerCase());
        const matchDept    = !this.filterDept   || s.departmentId == this.filterDept;
        const matchRole    = !this.filterRole   || s.roleId == this.filterRole;
        const matchStatus  = !this.filterStatus ||
          (this.filterStatus === 'active'   &&  s.isActive) ||
          (this.filterStatus === 'inactive' && !s.isActive);
        // Branch filter — global view only
        const matchBranch  = !this.filterBranch || s.branchId == this.filterBranch;
        return matchSearch && matchDept && matchRole && matchStatus && matchBranch;
      })
      .sort((a, b) => {
        const ra = this.roleOrder(a.roleName || a.role || '');
        const rb = this.roleOrder(b.roleName || b.role || '');
        if (ra !== rb) return ra - rb;
        return (a.name || '').localeCompare(b.name || '');
      });
  }

  // ── Helpers ────────────────────────────────────────────────────
  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }

  getAvatarColor(name: string): string {
    const colors = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2','#b45309'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  getRoleColor(roleColor: string): string {
    return roleColor || '#64748b';
  }
}
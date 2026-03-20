import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-staff-list-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-list-inline.html',
  host: { style: 'display:contents' }
})
export class StaffListInline implements OnInit {

  @Output() addStaff = new EventEmitter<void>();
  @Output() editStaff = new EventEmitter<any>();
  @Output() back = new EventEmitter<void>();

  staffList:    any[] = [];
  departments:  any[] = [];
  roles:        any[] = [];

  isLoading = true;

  // ── Filter ──────────────────────────────────
  searchQuery    = '';
  filterDept     = '';
  filterRole     = '';
  filterStatus   = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadStaff();
    this.loadDepartments();
    this.loadRoles();
  }

  loadStaff() {
    this.isLoading = true;
    this.http.get<any[]>(`${BASE}/users/staff-list`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => {
          this.staffList = list;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; }
      });
  }

  loadDepartments() {
    this.http.get<any[]>(`${BASE}/departments/my-branch`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.departments = list; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  loadRoles() {
    this.http.get<any[]>(`${BASE}/user-roles`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.roles = list; this.cdr.detectChanges(); },
        error: () => {}
      });
  }

  // ── Filter logic ──────────────────────────
  get filteredList(): any[] {
    return this.staffList.filter(s => {
      const matchSearch = !this.searchQuery ||
        s.name?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchDept   = !this.filterDept   || s.departmentId == this.filterDept;
      const matchRole   = !this.filterRole   || s.roleId == this.filterRole;
      const matchStatus = !this.filterStatus ||
        (this.filterStatus === 'active'   &&  s.isActive) ||
        (this.filterStatus === 'inactive' && !s.isActive);
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }

  // ── Actions ───────────────────────────────
  toggleActivation(staff: any) {
    const url = staff.isActive
      ? `${BASE}/users/${staff.id}/deactivate`
      : `${BASE}/users/${staff.id}/activate`;
    this.http.put(url, {}, { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => {
          staff.isActive = !staff.isActive;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  // ── Helpers ───────────────────────────────
  getAvatarColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
}

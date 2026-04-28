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

  loadStaff() {
    this.isLoading = true;
    this.http.get<any[]>(`${BASE}/users/staff-list`, { headers: this.auth.getHeaders() })
      .subscribe({
        next: list => { this.staffList = list; this.isLoading = false; this.cdr.detectChanges(); },
        error: () => { this.isLoading = false; }
      });
  }

  loadDepartments() {
    this.http.get<any[]>(`${BASE}/departments/my-branch`, { headers: this.auth.getHeaders() })
      .subscribe({ next: list => { this.departments = list; this.cdr.detectChanges(); }, error: () => {} });
  }

  loadRoles() {
    this.http.get<any[]>(`${BASE}/user-roles`, { headers: this.auth.getHeaders() })
      .subscribe({ next: list => { this.roles = list; this.cdr.detectChanges(); }, error: () => {} });
  }

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

  getAvatarColor(name: string): string {
    const colors = ['#16a34a','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6'];
    let hash = 0;
    for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getInitial(name: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
}
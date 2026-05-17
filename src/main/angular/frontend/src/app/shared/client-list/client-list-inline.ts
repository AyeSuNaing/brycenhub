import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-client-list-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-list-inline.html',
  host: { style: 'display:contents' }
})
export class ClientListInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  clients: any[]                           = [];
  loading                                  = false;
  clientProjects: Record<number, any[]>    = {};
  loadingProjects: Record<number, boolean> = {};

  // ── New Client Form ──
  showForm   = false;
  saving     = false;
  errorMsg   = '';
  form = {
    companyName:     '',
    businessType:    '',
    industry:        '',
    companySize:     '',
    website:         '',
    country:         '',
    city:            '',
    address:         '',
    timezone:        'Asia/Phnom_Penh',
    contactName:     '',
    contactEmail:    '',
    contactPhone:    '',
    contactPosition: '',
    requirements:    '',
    notes:           '',
    status:          'ACTIVE',
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading = true;
    this.http.get<any[]>(`${BASE}/clients`, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.clients = list || [];
        this.loading = false;
        this.cdr.detectChanges();
        this.clients.forEach(c => this.loadClientProjects(c.id));
      });
  }

  loadClientProjects(clientId: number): void {
    this.loadingProjects[clientId] = true;
    this.http.get<any[]>(`${BASE}/clients/${clientId}/projects`,
      { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.clientProjects[clientId] = list || [];
        this.loadingProjects[clientId] = false;
        this.cdr.detectChanges();
      });
  }

  getProjects(clientId: number): any[] {
    return this.clientProjects[clientId] || [];
  }

  openForm(): void {
    this.showForm = true;
    this.errorMsg = '';
    this.form = {
      companyName: '', businessType: '', industry: '', companySize: '',
      website: '', country: '', city: '', address: '',
      timezone: 'Asia/Phnom_Penh', contactName: '', contactEmail: '',
      contactPhone: '', contactPosition: '', requirements: '', notes: '',
      status: 'ACTIVE',
    };
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  submitForm(): void {
    if (!this.form.companyName.trim()) {
      this.errorMsg = 'Company name is required';
      return;
    }
    this.saving  = true;
    this.errorMsg = '';
    this.http.post<any>(`${BASE}/clients`, this.form, { headers: this.auth.getHeaders() })
      .pipe(catchError(err => {
        this.errorMsg = err?.error?.message || 'Failed to create client';
        this.saving   = false;
        this.cdr.detectChanges();
        return of(null);
      }))
      .subscribe(res => {
        this.saving = false;
        if (res) {
          this.showForm = false;
          this.loadClients(); // reload list
        }
        this.cdr.detectChanges();
      });
  }

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || '?';
  }

  getStatusColor(status: string): string {
    const m: Record<string, string> = {
      ACTIVE: '#22c55e', PLANNING: '#f59e0b',
      ON_HOLD: '#6366f1', COMPLETED: '#3b82f6', CANCELLED: '#ef4444',
    };
    return m[status] || '#64748b';
  }

  getPriorityColor(priority: string): string {
    const m: Record<string, string> = {
      CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#64748b',
    };
    return m[priority] || '#64748b';
  }
}
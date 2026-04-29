import {
  Component, OnInit, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-department-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './department-inline.html',
  host: { style: 'display:contents' }
})
export class DepartmentInline implements OnInit {

  @Output() back = new EventEmitter<void>();

  departments: any[] = [];
  isLoading = true;
  saving    = false;
  errorMsg  = '';
  showForm  = false;
  editingId: number | null = null;
  form = { name: '', description: '' };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  ngOnInit(): void { this.load(); }

  private get headers() { return this.auth.getHeaders(); }

  load(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${BASE}/departments/my-branch`, { headers: this.headers })
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.departments = list || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { name: '', description: '' };
    this.errorMsg = '';
    this.showForm = true;
  }

  openEdit(d: any): void {
    this.editingId = d.id;
    this.form = { name: d.name, description: d.description || '' };
    this.errorMsg = '';
    this.showForm = true;
  }

  cancelForm(): void { this.showForm = false; this.errorMsg = ''; }

  save(): void {
    if (!this.form.name.trim()) { this.errorMsg = 'Name is required'; return; }
    this.saving = true; this.errorMsg = '';
    const user = this.auth.getUser();
    const body = { name: this.form.name.trim(), description: this.form.description.trim(), branchId: user?.branchId };
    const req = this.editingId
      ? this.http.put(`${BASE}/departments/${this.editingId}`, body, { headers: this.headers })
      : this.http.post(`${BASE}/departments`, body, { headers: this.headers });
    req.pipe(catchError(err => {
      this.errorMsg = err?.error?.message || 'Failed to save';
      this.saving = false; this.cdr.detectChanges(); return of(null);
    })).subscribe(res => {
      if (res !== null) { this.saving = false; this.showForm = false; this.load(); }
    });
  }

  delete(d: any): void {
    if (!confirm(this.lbl('Delete confirm'))) return;
    this.http.delete(`${BASE}/departments/${d.id}`, { headers: this.headers })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.load());
  }
}
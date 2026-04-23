import { Component, OnInit, Input, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-announcement-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './announcement-history.component.html',
  styleUrl: './announcement-history.component.scss',
})
export class AnnouncementHistoryComponent implements OnInit, OnChanges {

  @Input() isDark    = true;
  @Input() branchId?: number;  // Boss/Director ← specific branch pass လုပ်နိုင်
                                // VP/Admin      ← မပေးရင် JWT user ကနေ auto

  // ── State ──────────────────────────────────────────────────
  items:      any[] = [];
  loading     = false;
  totalItems  = 0;
  totalPages  = 0;
  currentPage = 0;
  hasNext     = false;
  readonly pageSize = 20;

  // ── Date filter — default: today ──────────────────────────
  today    = new Date().toISOString().split('T')[0];  // 'YYYY-MM-DD'
  fromDate = this.today;
  toDate   = this.today;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load(0);
  }

  // branchId change ရင် reload (Boss: branch tab switch)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branchId'] && !changes['branchId'].firstChange) {
      this.items = [];
      this.load(0);
    }
  }

  // ── Load page ──────────────────────────────────────────────
  load(page: number): void {
    this.loading = true;

    let url = `${BASE}/dashboard/pm/announcements/history` +
      `?from=${this.fromDate}&to=${this.toDate}` +
      `&page=${page}&size=${this.pageSize}`;

    // branchId override
    if (this.branchId) url += `&branchId=${this.branchId}`;

    this.http.get<any>(url, { headers: this.auth.getHeaders() })
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res) {
          this.items       = page === 0 ? res.items : [...this.items, ...res.items];
          this.totalItems  = res.totalItems;
          this.totalPages  = res.totalPages;
          this.currentPage = res.currentPage;
          this.hasNext     = res.hasNext;
        }
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  // ── Search ─────────────────────────────────────────────────
  applyFilter(): void {
    this.items = [];
    this.load(0);
  }

  // ── Load more ──────────────────────────────────────────────
  loadMore(): void {
    if (this.hasNext && !this.loading) {
      this.load(this.currentPage + 1);
    }
  }

  // ── Reset to today ─────────────────────────────────────────
  resetToToday(): void {
    this.fromDate = this.today;
    this.toDate   = this.today;
    this.applyFilter();
  }
}

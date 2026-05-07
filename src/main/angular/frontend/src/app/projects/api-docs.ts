import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { NavigationStateService } from '../services/navigation-state.service';
import { setupLabel, SetupI18nKey } from './i18n/setup.i18n';

interface ApiEndpoint {
  id: number;
  projectId: number;
  frameName: string;
  method: string;
  url: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
  pathParams?: string;
  queryParams?: string;
  statusCodes?: string;
  expanded?: boolean;
}

@Component({
  selector: 'app-api-docs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './api-docs.html',
  styleUrl: './api-docs.scss'
})
export class ApiDocsComponent implements OnInit {
  projectId!: number;
  projectName = 'Project';
  loading = true;
  endpoints: ApiEndpoint[] = [];
  filteredEndpoints: ApiEndpoint[] = [];
  frames: string[] = [];
  selectedFrame = 'all';
  searchTerm = '';

  currentLang: string = 'en';
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = Number(params['projectId']);
      this.currentLang = this.auth.getUser()?.preferredLanguage || 'en';
      this.loadProjectName();
      this.loadEndpoints();
    });
  }

    lbl(key: SetupI18nKey): string {
      return setupLabel(this.currentLang, key);
    }

  private loadProjectName(): void {
    this.http.get<any>(
      `${environment.apiBaseUrl}/projects/${this.projectId}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: p => { this.projectName = p.title || 'Project'; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private loadEndpoints(): void {
    this.loading = true;
    this.http.get<ApiEndpoint[]>(
      `${environment.apiBaseUrl}/project-design/${this.projectId}/apis`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: data => {
        this.endpoints = (data || []).map(e => ({ ...e, expanded: false }));
        this.filteredEndpoints = this.endpoints;
        this.frames = [...new Set(this.endpoints.map(e => e.frameName).filter(Boolean))];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  filterByFrame(frame: string): void {
    this.selectedFrame = frame;
    this.applyFilter();
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.applyFilter();
  }

  private applyFilter(): void {
    let filtered = this.selectedFrame === 'all'
      ? this.endpoints
      : this.endpoints.filter(e => e.frameName === this.selectedFrame);
    if (this.searchTerm) {
      const t = this.searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.url.toLowerCase().includes(t) ||
        e.method.toLowerCase().includes(t) ||
        (e.description || '').toLowerCase().includes(t)
      );
    }
    this.filteredEndpoints = filtered;
  }

  toggleExpand(ep: ApiEndpoint): void {
    ep.expanded = !ep.expanded;
  }

  get visibleFrames(): string[] {
    return this.selectedFrame === 'all' ? this.frames : [this.selectedFrame];
  }

  getEndpointsByFrame(frame: string): ApiEndpoint[] {
    return this.filteredEndpoints.filter(e => e.frameName === frame);
  }

  getMethodColor(method: string): string {
    const m = (method || '').toUpperCase();
    const colors: Record<string, string> = {
      GET: '#61affe', POST: '#49cc90', PUT: '#fca130',
      DELETE: '#f93e3e', PATCH: '#50e3c2'
    };
    return colors[m] || '#888';
  }

  parseJson(str: string | undefined | null): string {
    if (!str) return '';
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch { return str; }
  }

  getStatusList(codes: string | undefined | null): string[] {
    return ((codes || '200') as string).split(',').map(s => s.trim()).filter(Boolean);
  }

  getStatusColor(code: string): string {
    const n = parseInt(code);
    if (n >= 500) return '#f93e3e';
    if (n >= 400) return '#fca130';
    if (n >= 200) return '#49cc90';
    return '#888';
  }

  goBack(): void { history.back(); }
}
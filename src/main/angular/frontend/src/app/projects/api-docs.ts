import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface ApiEndpoint {
  id: number;
  projectId: number;
  frameName: string;
  method: string;
  url: string;
  description: string;
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
      this.loadProjectName();
      this.loadEndpoints();
    });
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
        this.endpoints = data || [];
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
    this.filteredEndpoints = frame === 'all'
      ? this.endpoints
      : this.endpoints.filter(e => e.frameName === frame);
  }

  get visibleFrames(): string[] {
    return this.selectedFrame === 'all' ? this.frames : [this.selectedFrame];
  }

  getEndpointsByFrame(frame: string): ApiEndpoint[] {
    return this.filteredEndpoints.filter(e => e.frameName === frame);
  }

  goBack(): void { history.back(); }
}
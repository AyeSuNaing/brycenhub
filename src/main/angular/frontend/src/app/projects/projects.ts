import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Sidebar } from '../shared/sidebar';
import { API } from '../constants/api-endpoints';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Sidebar],
  template: `
    <div class="flex min-h-screen bg-gray-950">
      <app-sidebar></app-sidebar>

      <main class="flex-1 p-8 overflow-auto">

        <!-- Header -->
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">
              {{ isAllView ? 'All Projects' : 'My Active Projects' }}
            </h1>
            <p class="text-gray-400 text-sm mt-1">
              {{ isAllView ? 'All projects across your branch' : 'Projects currently assigned to you' }}
            </p>
          </div>
          <button *ngIf="canCreateProject()" (click)="openCreateModal()"
            class="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <span class="text-lg leading-none">+</span> New Project
          </button>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div *ngFor="let stat of stats" class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p class="text-gray-400 text-xs font-medium uppercase tracking-wider">{{ stat.label }}</p>
            <p class="text-3xl font-bold text-white mt-2">{{ stat.value }}</p>
          </div>
        </div>

        <!-- Filter tabs (All view only) -->
        <div *ngIf="isAllView" class="flex gap-2 mb-6 flex-wrap">
          <button *ngFor="let tab of tabs" (click)="activeTab = tab.key"
            class="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            [class]="activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'">
            {{ tab.label }}
            <span *ngIf="tab.count > 0" class="ml-1.5 bg-white/10 px-1.5 py-0.5 rounded-full text-xs">{{ tab.count }}</span>
          </button>
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="flex justify-center py-20">
          <div class="animate-spin w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>

        <!-- Empty -->
        <div *ngIf="!isLoading && displayedProjects.length === 0"
          class="text-center py-20 bg-gray-900 border border-gray-800 rounded-2xl">
          <p class="text-5xl mb-4">📂</p>
          <p class="text-white font-semibold">No projects found</p>
          <p class="text-gray-400 text-sm mt-2">
            {{ isAllView ? 'No projects exist yet.' : 'No active projects assigned to you.' }}
          </p>
          <button *ngIf="canCreateProject()" (click)="openCreateModal()"
            class="mt-6 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
            Create First Project
          </button>
        </div>

        <!-- Projects Grid -->
        <div *ngIf="!isLoading && displayedProjects.length > 0"
          class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          <div *ngFor="let project of displayedProjects"
            class="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all group cursor-pointer"
            (click)="goToKanban(project.id)">

            <div class="flex items-start justify-between mb-4">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                [class]="getProjectColor(project.id)">📁</div>

              <!-- Edit/Delete — PM+ only, stop propagation -->
              <div *ngIf="canCreateProject()" class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button (click)="openEditModal(project); $event.stopPropagation()"
                  class="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button (click)="confirmDelete(project); $event.stopPropagation()"
                  class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>

            <h3 class="text-white font-semibold mb-1 truncate">{{ project.title }}</h3>
            <p class="text-gray-500 text-sm mb-4 min-h-10">{{ project.description || 'No description' }}</p>

            <!-- Progress -->
            <div class="mb-4">
              <div class="flex justify-between items-center mb-1.5">
                <span class="text-gray-500 text-xs">Progress</span>
                <span class="text-gray-400 text-xs font-medium">{{ project.progress || 0 }}%</span>
              </div>
              <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-500"
                  [style.width]="(project.progress || 0) + '%'"></div>
              </div>
            </div>

            <!-- Dates -->
            <div *ngIf="project.startDate || project.endDate"
              class="flex items-center gap-2 text-gray-500 text-xs mb-4">
              <span>📅</span>
              <span>{{ project.startDate | date:'MMM d' }} → {{ project.endDate | date:'MMM d, y' }}</span>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between pt-4 border-t border-gray-800">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium" [class]="getStatusClass(project.status)">
                {{ project.status }}
              </span>
              <span class="text-blue-400 text-xs font-medium flex items-center gap-1">
                Open Board
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Create/Edit Modal -->
    <div *ngIf="showModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div class="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 class="text-lg font-semibold text-white">{{ editingProject ? 'Edit Project' : 'Create New Project' }}</h3>
          <button (click)="closeModal()" class="text-gray-500 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Project Title *</label>
            <input [(ngModel)]="form.title" placeholder="e.g. ASN Website Redesign"
              class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
            <textarea [(ngModel)]="form.description" placeholder="Brief description..." rows="3"
              class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">Status</label>
              <select [(ngModel)]="form.status"
                class="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">Priority</label>
              <select [(ngModel)]="form.priority"
                class="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">Start Date</label>
              <input type="date" [(ngModel)]="form.startDate"
                class="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">End Date</label>
              <input type="date" [(ngModel)]="form.endDate"
                class="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"/>
            </div>
          </div>
          <div *ngIf="formError" class="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{{ formError }}</div>
        </div>
        <div class="flex gap-3 p-6 border-t border-gray-800">
          <button (click)="closeModal()" class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
          <button (click)="saveProject()" [disabled]="isSaving"
            class="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <svg *ngIf="isSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ isSaving ? 'Saving...' : (editingProject ? 'Save Changes' : 'Create Project') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div *ngIf="showDeleteConfirm" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div class="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-white font-semibold text-lg mb-2">Delete Project?</h3>
        <p class="text-gray-400 text-sm mb-6">"<span class="text-white">{{ deletingProject?.title }}</span>" ကို permanently delete လုပ်မည်။</p>
        <div class="flex gap-3">
          <button (click)="showDeleteConfirm = false" class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
          <button (click)="deleteProject()" class="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Delete</button>
        </div>
      </div>
    </div>
  `,
})
export class Projects implements OnInit {
  projects: any[] = [];
  isLoading = true;
  isSaving = false;
  showModal = false;
  showDeleteConfirm = false;
  editingProject: any = null;
  deletingProject: any = null;
  activeTab = 'ALL';
  formError = '';
  isAllView = false;

  form = { title: '', description: '', status: 'PLANNING', priority: 'MEDIUM', startDate: '', endDate: '' };

  tabs = [
    { key: 'ALL', label: 'All', count: 0 },
    { key: 'ACTIVE', label: 'Active', count: 0 },
    { key: 'PLANNING', label: 'Planning', count: 0 },
    { key: 'ON_HOLD', label: 'On Hold', count: 0 },
    { key: 'COMPLETED', label: 'Completed', count: 0 },
  ];

  stats = [
    { label: 'Total', value: '0' },
    { label: 'Active', value: '0' },
    { label: 'Planning', value: '0' },
    { label: 'Completed', value: '0' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.isAllView = params['filter'] !== 'active';
      this.loadProjects();
    });
  }

  loadProjects() {
    this.isLoading = true;
    this.http.get<any[]>('API.PROJECTS.BASE', { headers: this.auth.getHeaders() })
      .subscribe({
        next: (projects) => {
          this.projects = projects;
          this.isLoading = false;
          this.updateStats();
        },
        error: () => { this.isLoading = false; }
      });
  }

  get displayedProjects(): any[] {
    // Active view: only ACTIVE projects
    if (!this.isAllView) return this.projects.filter(p => p.status === 'ACTIVE');
    // All view: filter by tab
    if (this.activeTab === 'ALL') return this.projects;
    return this.projects.filter(p => p.status === this.activeTab);
  }

  updateStats() {
    const p = this.projects;
    this.stats[0].value = String(p.length);
    this.stats[1].value = String(p.filter(x => x.status === 'ACTIVE').length);
    this.stats[2].value = String(p.filter(x => x.status === 'PLANNING').length);
    this.stats[3].value = String(p.filter(x => x.status === 'COMPLETED').length);
    this.tabs[0].count = p.length;
    this.tabs[1].count = p.filter(x => x.status === 'ACTIVE').length;
    this.tabs[2].count = p.filter(x => x.status === 'PLANNING').length;
    this.tabs[3].count = p.filter(x => x.status === 'ON_HOLD').length;
    this.tabs[4].count = p.filter(x => x.status === 'COMPLETED').length;
  }

  canCreateProject(): boolean {
    return ['BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER'].includes(this.auth.getRole());
  }

  goToKanban(id: number) { this.router.navigate(['/kanban', id]); }

  openCreateModal() {
    this.editingProject = null;
    this.form = { title: '', description: '', status: 'PLANNING', priority: 'MEDIUM', startDate: '', endDate: '' };
    this.formError = '';
    this.showModal = true;
  }

  openEditModal(project: any) {
    this.editingProject = project;
    this.form = {
      title: project.title || '',
      description: project.description || '',
      status: project.status || 'PLANNING',
      priority: project.priority || 'MEDIUM',
      startDate: project.startDate ? project.startDate.substring(0, 10) : '',
      endDate: project.endDate ? project.endDate.substring(0, 10) : '',
    };
    this.formError = '';
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.editingProject = null; this.formError = ''; }

  saveProject() {
    if (!this.form.title.trim()) { this.formError = 'Project title is required.'; return; }
    this.isSaving = true;
    this.formError = '';
    const payload = { ...this.form, branchId: this.auth.getUser()?.branchId || 1 };

    if (this.editingProject) {
      this.http.put<any>(API.PROJECTS.BY_ID(this.editingProject.id) , payload, { headers: this.auth.getHeaders() })
        .subscribe({
          next: (updated) => { const i = this.projects.findIndex(p => p.id === updated.id); if (i !== -1) this.projects[i] = updated; this.isSaving = false; this.closeModal(); this.updateStats(); },
          error: () => { this.formError = 'Failed to update.'; this.isSaving = false; }
        });
    } else {
      this.http.post<any>(API.PROJECTS.BY_ID(this.editingProject.id) , payload, { headers: this.auth.getHeaders() })
        .subscribe({
          next: (created) => { this.projects.unshift(created); this.isSaving = false; this.closeModal(); this.updateStats(); },
          error: () => { this.formError = 'Failed to create.'; this.isSaving = false; }
        });
    }
  }

  confirmDelete(project: any) { this.deletingProject = project; this.showDeleteConfirm = true; }

  deleteProject() {
    if (!this.deletingProject) return;
    this.http.delete(API.PROJECTS.BY_ID(this.editingProject.id) , { headers: this.auth.getHeaders() })
      .subscribe({ next: () => { this.projects = this.projects.filter(p => p.id !== this.deletingProject.id); this.showDeleteConfirm = false; this.deletingProject = null; this.updateStats(); } });
  }

  getStatusClass(status: string): string {
    const map: any = { PLANNING: 'bg-gray-700 text-gray-300', ACTIVE: 'bg-blue-600/20 text-blue-400', ON_HOLD: 'bg-yellow-600/20 text-yellow-400', COMPLETED: 'bg-green-600/20 text-green-400', CANCELLED: 'bg-red-600/20 text-red-400' };
    return map[status] || 'bg-gray-700 text-gray-300';
  }

  getProjectColor(id: number): string {
    return ['bg-blue-600/20', 'bg-purple-600/20', 'bg-green-600/20', 'bg-orange-600/20', 'bg-pink-600/20'][id % 5];
  }
}

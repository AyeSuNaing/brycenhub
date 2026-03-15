import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Sidebar } from '../shared/sidebar';
import { API } from '../constants/api-endpoints';


@Component({
  selector: 'app-boss-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar],
  template: `
    <div class="flex min-h-screen bg-gray-950">
      <app-sidebar></app-sidebar>

      <main class="flex-1 p-8 overflow-auto">
        <!-- Header -->
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">Company Overview</h1>
            <p class="text-gray-400 text-sm mt-1">ASN Global · All branches</p>
          </div>
          <div class="flex items-center gap-2 bg-green-600/10 border border-green-600/20 rounded-xl px-4 py-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span class="text-green-400 text-sm font-medium">System Live</span>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div *ngFor="let stat of stats"
            class="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
            <div class="flex items-center justify-between mb-3">
              <p class="text-gray-400 text-xs font-medium uppercase tracking-wider">{{ stat.label }}</p>
              <span class="text-2xl">{{ stat.icon }}</span>
            </div>
            <p class="text-3xl font-bold text-white">{{ stat.value }}</p>
          </div>
        </div>

        <!-- Projects -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-white">All Projects</h2>
            <span class="text-xs text-gray-500">{{ projects.length }} total</span>
          </div>

          <div *ngIf="isLoading" class="flex justify-center py-8">
            <div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>

          <div *ngIf="!isLoading && projects.length === 0" class="text-center py-8 text-gray-500">
            <p class="text-4xl mb-2">📂</p>
            <p>No projects yet</p>
          </div>

          <div *ngIf="!isLoading" class="space-y-3">
            <div *ngFor="let project of projects"
              class="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
              [routerLink]="['/kanban', project.id]">

              <div class="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span class="text-blue-400 text-lg">📁</span>
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium truncate">{{ project.title }}</p>
                <div class="flex items-center gap-3 mt-1">
                  <!-- Progress bar -->
                  <div class="flex-1 bg-gray-700 rounded-full h-1.5 max-w-32">
                    <div class="bg-blue-500 h-1.5 rounded-full"
                      [style.width]="(project.progress || 0) + '%'"></div>
                  </div>
                  <span class="text-gray-500 text-xs">{{ project.progress || 0 }}%</span>
                </div>
              </div>

              <span class="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                [class]="getStatusClass(project.status)">
                {{ project.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Branches -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 class="text-lg font-semibold text-white mb-5">Branches</h2>
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div *ngFor="let branch of branches"
              class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600 transition-colors">
              <p class="text-white text-sm font-medium">{{ branch.name }}</p>
              <p class="text-gray-500 text-xs mt-1">Branch #{{ branch.id }}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class BossDashboard implements OnInit {
  projects: any[] = [];
  branches: any[] = [];
  isLoading = true;

  stats = [
    { label: 'Projects', value: '0', icon: '📁' },
    { label: 'Branches', value: '0', icon: '🏢' },
    { label: 'Active', value: '0', icon: '🟢' },
    { label: 'Completed', value: '0', icon: '✅' },
  ];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const headers = this.auth.getHeaders();

    this.http.get<any[]>(API.PROJECTS.BASE, { headers })
      .subscribe({
        next: (projects) => {
          this.projects = projects;
          this.isLoading = false;
          this.stats[0].value = String(projects.length);
          this.stats[2].value = String(projects.filter(p => p.status === 'ACTIVE').length);
          this.stats[3].value = String(projects.filter(p => p.status === 'COMPLETED').length);
        },
        error: () => { this.isLoading = false; }
      });

    this.http.get<any[]>(API.BRANCHES.BASE, { headers })
      .subscribe({
        next: (branches) => {
          this.branches = branches;
          this.stats[1].value = String(branches.length);
        }
      });
  }

  getStatusClass(status: string): string {
    const map: any = {
      PLANNING: 'bg-gray-700 text-gray-300',
      ACTIVE: 'bg-blue-600/20 text-blue-400',
      ON_HOLD: 'bg-yellow-600/20 text-yellow-400',
      COMPLETED: 'bg-green-600/20 text-green-400',
      CANCELLED: 'bg-red-600/20 text-red-400',
    };
    return map[status] || 'bg-gray-700 text-gray-300';
  }
}

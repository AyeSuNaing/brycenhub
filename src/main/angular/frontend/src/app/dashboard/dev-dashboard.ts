import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Sidebar } from '../shared/sidebar';
import { API } from '../constants/api-endpoints';


@Component({
  selector: 'app-dev-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar],
  template: `
    <div class="flex min-h-screen bg-gray-950">
      <app-sidebar></app-sidebar>

      <main class="flex-1 p-8 overflow-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-white">My Dashboard</h1>
          <p class="text-gray-400 text-sm mt-1">Welcome back, {{ userName }} 👋</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div *ngFor="let stat of stats"
            class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p class="text-gray-400 text-xs font-medium uppercase tracking-wider">{{ stat.label }}</p>
            <p class="text-3xl font-bold text-white mt-2">{{ stat.value }}</p>
            <div class="flex items-center gap-1 mt-2">
              <span class="text-xs" [class]="stat.color">{{ stat.sub }}</span>
            </div>
          </div>
        </div>

        <!-- My Tasks -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-white">My Tasks</h2>
            <a routerLink="/kanban/1"
              class="text-blue-400 text-sm hover:text-blue-300 transition-colors">
              View board →
            </a>
          </div>

          <!-- Loading -->
          <div *ngIf="isLoading" class="flex items-center justify-center py-12">
            <div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>

          <!-- Empty -->
          <div *ngIf="!isLoading && tasks.length === 0"
            class="text-center py-12 text-gray-500">
            <p class="text-4xl mb-3">📭</p>
            <p>No tasks assigned yet</p>
          </div>

          <!-- Tasks list -->
          <div *ngIf="!isLoading && tasks.length > 0" class="space-y-3">
            <div *ngFor="let task of tasks"
              class="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors">

              <!-- Priority dot -->
              <div class="w-2 h-2 rounded-full flex-shrink-0"
                [class]="getPriorityColor(task.priority)"></div>

              <!-- Title -->
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium truncate">{{ task.title }}</p>
                <p class="text-gray-500 text-xs mt-0.5">{{ task.projectId ? 'Project #' + task.projectId : '' }}</p>
              </div>

              <!-- Status badge -->
              <span class="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                [class]="getStatusClass(task.status)">
                {{ task.status }}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class DevDashboard implements OnInit {
  userName = '';
  tasks: any[] = [];
  isLoading = true;

  stats = [
    { label: 'My Tasks', value: '0', sub: 'Total assigned', color: 'text-gray-400' },
    { label: 'In Progress', value: '0', sub: 'Active now', color: 'text-blue-400' },
    { label: 'Done Today', value: '0', sub: 'Completed', color: 'text-green-400' },
    { label: 'Overdue', value: '0', sub: 'Need attention', color: 'text-red-400' },
  ];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.userName = this.auth.getUser()?.name || 'User';
    this.loadMyTasks();
  }

  loadMyTasks() {
    this.http
      .get<any[]>(API.TASKS.MY, {
        headers: this.auth.getHeaders(),
      })
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.isLoading = false;
          this.stats[0].value = String(tasks.length);
          this.stats[1].value = String(tasks.filter(t => t.status === 'IN_PROGRESS').length);
          this.stats[2].value = String(tasks.filter(t => t.status === 'DONE').length);
        },
        error: () => { this.isLoading = false; },
      });
  }

  getPriorityColor(priority: string): string {
    const map: any = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-orange-400',
      MEDIUM: 'bg-yellow-400',
      LOW: 'bg-gray-400',
    };
    return map[priority] || 'bg-gray-400';
  }

  getStatusClass(status: string): string {
    const map: any = {
      TODO: 'bg-gray-700 text-gray-300',
      IN_PROGRESS: 'bg-blue-600/20 text-blue-400',
      IN_REVIEW: 'bg-purple-600/20 text-purple-400',
      DONE: 'bg-green-600/20 text-green-400',
      DELAYED: 'bg-red-600/20 text-red-400',
    };
    return map[status] || 'bg-gray-700 text-gray-300';
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Sidebar } from '../shared/sidebar';
import { API } from '../constants/api-endpoints';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Sidebar],
  template: `
    <div class="flex min-h-screen bg-gray-950">
      <app-sidebar></app-sidebar>

      <main class="flex-1 p-8 overflow-auto">
        <!-- Header -->
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">Kanban Board</h1>
            <p class="text-gray-400 text-sm mt-1">Project #{{ projectId }}</p>
          </div>
          <button (click)="showAddTask = true"
            class="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2">
            <span>+</span> New Task
          </button>
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="flex justify-center py-20">
          <div class="animate-spin w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>

        <!-- Kanban Columns -->
        <div *ngIf="!isLoading" class="flex gap-5 overflow-x-auto pb-4">
          <div *ngFor="let col of columns"
            class="flex-shrink-0 w-72">

            <!-- Column Header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full" [class]="col.dotColor"></div>
                <h3 class="text-sm font-semibold text-gray-300">{{ col.label }}</h3>
                <span class="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  {{ getTasksByStatus(col.status).length }}
                </span>
              </div>
            </div>

            <!-- Tasks -->
            <div class="space-y-3 min-h-20">
              <div *ngFor="let task of getTasksByStatus(col.status)"
                class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer group">

                <!-- Priority + Label -->
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" [class]="getPriorityDot(task.priority)"></span>
                  <span class="text-xs text-gray-500">{{ task.priority }}</span>
                  <span *ngIf="task.label" class="ml-auto text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full truncate max-w-20">
                    {{ task.label }}
                  </span>
                </div>

                <!-- Title -->
                <p class="text-white text-sm font-medium leading-snug mb-3">{{ task.title }}</p>

                <!-- Footer -->
                <div class="flex items-center justify-between">
                  <div *ngIf="task.dueDate" class="flex items-center gap-1 text-gray-500 text-xs">
                    <span>📅</span>
                    <span>{{ task.dueDate | date:'MMM d' }}</span>
                  </div>

                  <!-- Move buttons -->
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <button *ngIf="col.prev"
                      (click)="moveTask(task, col.prev); $event.stopPropagation()"
                      class="text-gray-500 hover:text-gray-300 text-xs px-1.5 py-1 bg-gray-800 rounded-lg transition-colors">
                      ←
                    </button>
                    <button *ngIf="col.next"
                      (click)="moveTask(task, col.next); $event.stopPropagation()"
                      class="text-gray-500 hover:text-gray-300 text-xs px-1.5 py-1 bg-gray-800 rounded-lg transition-colors">
                      →
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div *ngIf="getTasksByStatus(col.status).length === 0"
                class="border-2 border-dashed border-gray-800 rounded-xl p-6 text-center text-gray-600 text-sm">
                No tasks
              </div>
            </div>
          </div>
        </div>

        <!-- Add Task Modal -->
        <div *ngIf="showAddTask"
          class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-5">New Task</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Title *</label>
                <input [(ngModel)]="newTask.title" placeholder="Task title"
                  class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Priority</label>
                <select [(ngModel)]="newTask.priority"
                  class="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Label</label>
                <input [(ngModel)]="newTask.label" placeholder="bug, feature, urgent..."
                  class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div class="flex gap-3 mt-6">
              <button (click)="showAddTask = false"
                class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-colors">
                Cancel
              </button>
              <button (click)="addTask()"
                class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                Create Task
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class Kanban implements OnInit {
  projectId: number = 1;
  tasks: any[] = [];
  isLoading = true;
  showAddTask = false;
  newTask = { title: '', priority: 'MEDIUM', label: '' };

  columns = [
    { status: 'TODO',       label: 'To Do',      dotColor: 'bg-gray-400', prev: null,          next: 'IN_PROGRESS' },
    { status: 'IN_PROGRESS',label: 'In Progress', dotColor: 'bg-blue-400', prev: 'TODO',        next: 'IN_REVIEW' },
    { status: 'IN_REVIEW',  label: 'In Review',   dotColor: 'bg-purple-400',prev: 'IN_PROGRESS',next: 'DONE' },
    { status: 'DONE',       label: 'Done',        dotColor: 'bg-green-400', prev: 'IN_REVIEW',  next: null },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.projectId = Number(this.route.snapshot.params['projectId']) || 1;
    this.loadTasks();
  }

  loadTasks() {
    this.http.get<any[]>(
      API.TASKS.BY_PROJECT(this.projectId),
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: (tasks) => { this.tasks = tasks; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(t => t.status === status);
  }

  moveTask(task: any, newStatus: string) {
    this.http.patch(
      API.TASKS.STATUS(task.id),
      { status: newStatus },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => { task.status = newStatus; }
    });
  }

  addTask() {
    if (!this.newTask.title.trim()) return;
    this.http.post<any>(
      API.TASKS.BASE,
      { ...this.newTask, projectId: this.projectId, status: 'TODO' },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: (task) => {
        this.tasks.push(task);
        this.showAddTask = false;
        this.newTask = { title: '', priority: 'MEDIUM', label: '' };
      }
    });
  }

  getPriorityDot(priority: string): string {
    const map: any = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-orange-400',
      MEDIUM: 'bg-yellow-400',
      LOW: 'bg-gray-500',
    };
    return map[priority] || 'bg-gray-500';
  }
}

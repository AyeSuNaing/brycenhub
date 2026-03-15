import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';

import {
  Announcement, Notification, ActiveProject, PortfolioProject,
  TeamMember, MyTask, OverdueTask, Activity, Deadline
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardDataService {

  constructor(private http: HttpClient) { }

  getStats(): Observable<{ total: number; active: number; overdue: number; members: number }> {
    return this.http.get<any>(API.DASHBOARD.STATS);
  }

  getActiveProjects(): Observable<ActiveProject[]> {
    return this.http.get<ActiveProject[]>(API.DASHBOARD.ACTIVE_PROJECTS);
  }

  getPortfolioProjects(): Observable<PortfolioProject[]> {
    return this.http.get<PortfolioProject[]>(API.DASHBOARD.PORTFOLIO);
  }

  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(API.DASHBOARD.TEAM);
  }

  getMyTasks(): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(API.DASHBOARD.MY_TASKS);
  }

  getOverdueTasks(): Observable<OverdueTask[]> {
    return this.http.get<OverdueTask[]>(API.DASHBOARD.OVERDUE_TASKS);
  }

  getActivities(): Observable<Activity[]> {
    return this.http.get<Activity[]>(API.DASHBOARD.ACTIVITIES);
  }

  getDeadlines(): Observable<Deadline[]> {
    return this.http.get<Deadline[]>(API.DASHBOARD.DEADLINES);
  }

  getAnnouncements(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(API.DASHBOARD.ANNOUNCEMENTS);
  }

  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(API.NOTIFICATIONS.MY);
  }

  getTaskStats(): Observable<any> {
    return this.http.get<any>(API.DASHBOARD.TASK_STATS);
  }
  
  getChartData(): Observable<any[]> {
    return this.http.get<any[]>(API.DASHBOARD.CHART_DATA);
  }

}
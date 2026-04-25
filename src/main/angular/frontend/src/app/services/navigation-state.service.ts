// navigation-state.service.ts
// Path: src/main/angular/frontend/src/app/services/navigation-state.service.ts

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {

  // ✅ Generic project state — works for VP, Member, PM, Leader, etc.
  private _projectId: number | null = null;
  private _showProject = false;
  private _sourceDashboard: string | null = null; // which dashboard opened the project

  // ── Save ──────────────────────────────────────────────────────
  saveProjectState(projectId: number, dashboard: string): void {
    this._projectId      = projectId;
    this._showProject    = true;
    this._sourceDashboard = dashboard;
  }

  // ── Restore ───────────────────────────────────────────────────
  restoreProjectState(): { projectId: number | null; showProject: boolean; dashboard: string | null } {
    return {
      projectId:   this._projectId,
      showProject: this._showProject,
      dashboard:   this._sourceDashboard,
    };
  }

  // ── Clear ─────────────────────────────────────────────────────
  clearProjectState(): void {
    this._projectId      = null;
    this._showProject    = false;
    this._sourceDashboard = null;
  }
}

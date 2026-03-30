import {
  Component, OnInit, OnDestroy, Input,
  AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-design-tool',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './design-tool.html',
  styleUrl: './design-tool.scss'
})
export class DesignToolComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() projectId!: number;

  loading = true;
  saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  canEdit = false;

  private autoSaveTimer: any;
  private designLoaded = false;
  private readonly EDIT_ROLES = ['PROJECT_MANAGER', 'UI_UX', 'LEADER'];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check edit permission
    const role = this.auth.getUser()?.role;
    this.canEdit = this.EDIT_ROLES.includes(role || '');

    // Auto-save every 30 seconds (edit roles only)
    this.autoSaveTimer = setInterval(() => {
      if (this.designLoaded && this.canEdit) this.saveDesign();
    }, 30000);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initDesignTool();
      this.loadDesign();
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
  }

  // ── Init design tool ────────────────────────────────────────────
  private initDesignTool(): void {
    const win = window as any;

    if (this.canEdit) {
      // Override save() to call Angular saveDesign()
      win.save = () => this.saveDesign();
      // Ctrl+S
      document.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          this.saveDesign();
        }
      });
    } else {
      // View only — switch to Present mode, hide edit panels
      setTimeout(() => {
        if (typeof win.setMode === 'function') win.setMode('present');
        const tb = document.getElementById('TB');
        if (tb) tb.style.display = 'none';
        const lp = document.getElementById('LP');
        if (lp) lp.style.display = 'none';
        const rp = document.getElementById('RP');
        if (rp) rp.style.display = 'none';
      }, 300);
    }

    this.loading = false;
    this.cdr.detectChanges();
  }

  // ── Load design from backend ─────────────────────────────────────
  loadDesign(): void {
    if (!this.projectId) {
      this.loading = false;
      this.designLoaded = true;
      return;
    }

    this.http.get<any>(`${environment.apiBaseUrl}/designs/by-project/${this.projectId}`)
      .subscribe({
        next: (design) => {
          if (design?.canvasData) this.restoreCanvas(design.canvasData);
          this.loading = false;
          this.designLoaded = true;
          this.cdr.detectChanges();
        },
        error: () => {
          // 404 = no design yet → fresh canvas
          this.loading = false;
          this.designLoaded = true;
          this.cdr.detectChanges();
        }
      });
  }

  // ── Save design to backend ───────────────────────────────────────
  saveDesign(): void {
    if (!this.projectId || !this.designLoaded || !this.canEdit) return;
    const win = window as any;
    const G = win.G;
    if (!G?.frames) return;

    this.saveStatus = 'saving';
    this.cdr.detectChanges();

    const body = {
      projectId:    this.projectId,
      canvasData:   JSON.stringify(G.frames),
      updatedBy:    this.auth.getUser()?.userId,
      thumbnailUrl: ''
    };

    this.http.post(`${environment.apiBaseUrl}/designs/save`, body).subscribe({
      next: () => {
        this.saveStatus = 'saved';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.saveStatus = 'idle';
          this.cdr.detectChanges();
        }, 2000);
      },
      error: (err) => {
        console.error('[DesignTool] Save error:', err);
        this.saveStatus = 'idle';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Restore canvas from JSON ─────────────────────────────────────
  private restoreCanvas(canvasDataJson: string): void {
    try {
      const win = window as any;
      const framesData = JSON.parse(canvasDataJson);
      if (typeof win.restoreSnap === 'function') {
        win.restoreSnap(framesData);
      } else {
        setTimeout(() => {
          if (typeof win.restoreSnap === 'function') win.restoreSnap(framesData);
        }, 500);
      }
    } catch (e) {
      console.error('[DesignTool] Restore error:', e);
    }
  }

  // ── Navigate back ────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/projects']);
  }
}
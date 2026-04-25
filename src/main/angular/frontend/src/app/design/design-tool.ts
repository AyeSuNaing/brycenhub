import {
  Component, OnInit, OnDestroy,
  AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { NavigationStateService } from '../services/navigation-state.service';

@Component({
  selector: 'app-design-tool',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './design-tool.html',
  styleUrl: './design-tool.scss'
})
export class DesignToolComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('designIframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  projectId!: number;
  projectName = 'Design Board';
  projectRepoUrl = '';   
  iframeSrc!: SafeResourceUrl;
  loading = true;
  saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  canEdit = false;
  designMode: 'edit' | 'present' | 'view' = 'view';

  private designLoaded = false;
  private messageHandler: any;
  private autoSaveTimer: any;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = Number(params['projectId']);
    });

    const role = this.auth.getUser()?.role;
    if (['UI_UX', 'PROJECT_MANAGER', 'LEADER'].includes(role || '')) {
      this.designMode = 'edit';
      this.canEdit = true;
    } else if (role === 'CLIENT') {
      this.designMode = 'present';
      this.canEdit = false;
    } else {
      this.designMode = 'view';
      this.canEdit = false;
    }

    const iframePath =
      this.designMode === 'edit'    ? '/design-edit.html'    :
      this.designMode === 'present' ? '/design-present.html' :
                                      '/design-dev.html';
    this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(iframePath);

    if (this.projectId) {
      this.http.get<any>(
        `${environment.apiBaseUrl}/projects/${this.projectId}`,
        { headers: this.auth.getHeaders() }
      ).subscribe({
        next: p => {
          this.projectName = p.title || 'Design Board';
          this.projectRepoUrl = p.repoUrl || '';  
          this.cdr.detectChanges();
          if (this.designLoaded) {
            this.sendProjectInfo();
          }

        },
        error: () => {}
      });
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.designLoaded && this.canEdit) {
        this.sendToIframe({ type: 'DESIGN_REQUEST_SAVE' });
      }
    }, 30000);
  }

  ngAfterViewInit(): void {
    this.messageHandler = (event: MessageEvent) => {
      this.onIframeMessage(event);
    };
    window.addEventListener('message', this.messageHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.messageHandler);
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
  }

  onIframeLoad(): void {}

  private onIframeMessage(event: MessageEvent): void {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {

      case 'DESIGN_READY': {
        this.loading = false;
        this.cdr.detectChanges();
        this.sendToIframe({ type: 'DESIGN_HIDE_TOPBAR' });
        if (this.designMode === 'present') {
          this.sendToIframe({ type: 'DESIGN_SET_MODE', mode: 'present' });
        } else if (this.designMode === 'view') {
          this.sendToIframe({ type: 'DESIGN_SET_MODE', mode: 'dev' });
        }
        this.loadDesign();
        this.loadTechStacks();
        const userLang = this.auth.getUser()?.preferredLanguage || 'en';
        this.sendToIframe({ type: 'USER_LANG_LOADED', lang: userLang });
        const token = localStorage.getItem('token') || '';
        this.sendToIframe({ type: 'AUTH_TOKEN_LOADED', token });
        // ── Project ID + User ID → iframe ပို့ (AI generate save ဖို့) ──
        this.sendProjectInfo();
        break;
      }

      case 'USER_LANG_CHANGED': {
        const newLang = msg.lang as string;
        const currentUser = this.auth.getUser();
        if (currentUser && newLang) {
          currentUser.preferredLanguage = newLang;
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const u = JSON.parse(stored);
              u.preferredLanguage = newLang;
              localStorage.setItem('user', JSON.stringify(u));
            }
          } catch(e) {
            console.warn('[DesignTool] localStorage update failed', e);
          }
          this.http.put(`${environment.apiBaseUrl}/users/me/language`, { language: newLang },
            { headers: this.auth.getHeaders() }).subscribe({
            next: () => console.log('[DesignTool] Language updated to', newLang),
            error: (e) => console.warn('[DesignTool] Language update failed', e)
          });
        }
        break;
      }

      case 'DESIGN_SAVE':
        if (msg.canvasData) {
          this.saveToBackend(msg.canvasData);
        }
        break;

      case 'AI_REQUEST':
        this.http.post<any>(`${environment.apiBaseUrl}/ai-ui-design/generate`, {
          prompt: msg.prompt,
          maxTokens: msg.maxTokens || 4000
        }, { headers: this.auth.getHeaders() }).subscribe({
          next: (res) => {
            this.sendToIframe({
              type: 'AI_RESPONSE',
              requestId: msg.requestId,
              content: res.content,
              success: true
            });
          },
          error: (err) => {
            this.sendToIframe({
              type: 'AI_RESPONSE',
              requestId: msg.requestId,
              content: '',
              success: false,
              error: err?.error?.message || err.message || 'Server error'
            });
          }
        });
        break;
    }
  }

  sendToIframe(data: any): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(data, '*');
  }

  /** ⭐ NEW: Send projectId + userId + repoUrl to iframe for AI Assistant auto-sync */
  private sendProjectInfo(): void {
    const userId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
    this.sendToIframe({
      type: 'PROJECT_INFO',
      projectId: this.projectId,
      userId,
      repoUrl: this.projectRepoUrl || ''
    });
  }

  sendCmd(cmd: string): void {
    if (cmd === 'SAVE') {
      this.sendToIframe({ type: 'DESIGN_REQUEST_SAVE' });
    } else if (cmd === 'UNDO') {
      this.sendToIframe({ type: 'DESIGN_CMD', cmd: 'UNDO' });
    } else if (cmd === 'REDO') {
      this.sendToIframe({ type: 'DESIGN_CMD', cmd: 'REDO' });
    }
  }

  private loadDesign(): void {
    if (!this.projectId) {
      this.designLoaded = true;
      return;
    }
    this.http.get<any>(
      `${environment.apiBaseUrl}/designs/by-project/${this.projectId}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: (design) => {
        if (design?.canvasData) {
          this.sendToIframe({
            type: 'DESIGN_LOAD',
            canvasData: design.canvasData
          });
        }
        this.designLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.designLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  private loadTechStacks(): void {
    if (!this.projectId) return;
    this.http.get<any[]>(
      `${environment.apiBaseUrl}/project-tech-stacks/by-project/${this.projectId}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: (stacks) => {
        if (stacks && stacks.length > 0) {
          this.sendToIframe({
            type: 'TECH_STACKS_LOADED',
            techStacks: stacks.map(s => ({ name: s.name, category: s.category || 'other' }))
          });
        }
      },
      error: () => {}
    });
  }

  private saveToBackend(canvasData: string): void {
    if (!this.projectId || !this.canEdit) return;

    this.saveStatus = 'saving';
    this.cdr.detectChanges();

    const body = {
      projectId:    this.projectId,
      canvasData:   canvasData,
      updatedBy:    this.auth.getUser()?.userId,
      thumbnailUrl: ''
    };

    this.http.post(
      `${environment.apiBaseUrl}/designs/save`,
      body,
      { headers: this.auth.getHeaders() }
    ).subscribe({
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

  goBack(): void {
    history.back();
  }
}
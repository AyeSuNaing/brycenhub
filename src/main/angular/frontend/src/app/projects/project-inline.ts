import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChatPopupComponent, ChatMember } from '../shared/chat-popup/chat-popup.component';

import {
  setupLabel, SetupI18nKey,
  ProjectOS, detectOS, osLabel,
  SetupErrorFix, FixAttempt,
  GitCommit, GitCommitsResponse,
  formatRelativeTime
} from './i18n/setup.i18n';

import {
  DesignFrame,
  DesignBoardResponse,
  parseCanvasData,
  renderFrameSvg
} from './design-preview.helper';

const BASE = environment.apiBaseUrl;
const MAX_FIX_ATTEMPTS = 5;

@Component({
  selector: 'app-project-inline',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChatPopupComponent],
  templateUrl: './project-inline.html',
  host: { style: 'display:contents' }
})
export class ProjectInlineComponent implements OnInit, OnChanges {

  @Input() projectId!: number;
  @Output() close = new EventEmitter<void>();

  project: any = null;
  stats: any = null;
  members: any[] = [];
  tasks: any[] = [];
  activities: any[] = [];
  apiEndpoints: any[] = [];
  dbTables: any[] = [];
  clients: any[] = [];

  isLoading = true;
  showDesign = false;
  showApi = false;
  showDb = false;
  showFullDesc = false;
  activeTab = 'overview';

  showEdit = false;
  isSaving = false;
  editError = '';
  showDangerZone = false;
  deleteConfirmName = '';
  isDeleting = false;

  editForm = {
    title: '', description: '', status: '',
    startDate: '', endDate: '', budget: null as number | null, priority: '',
  };

  statuses = [
    { value: 'PLANNING', label: 'Planning', color: '#64748b' },
    { value: 'ACTIVE', label: 'Active', color: '#22c55e' },
    { value: 'ON_HOLD', label: 'On Hold', color: '#f59e0b' },
    { value: 'COMPLETED', label: 'Completed', color: '#3b82f6' },
  ];

  priorities = [
    { value: 'LOW', label: 'Low', color: '#22c55e' },
    { value: 'MEDIUM', label: 'Medium', color: '#f59e0b' },
    { value: 'HIGH', label: 'High', color: '#f97316' },
    { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  ];

  techStacks: any[] = [];
  techStackLoading: boolean = false;
  showTechEdit = false;
  newTechName = '';
  newTechCategory = 'frontend';

  showMemberEdit = false;
  showRemovedMembers = false;
  removedMembers: any[] = [];
  staffList: any[] = [];
  filteredStaff: any[] = [];
  staffListLoading = false;
  memberSearchQuery = '';

  projectRules: any[] = [];
  rulesLoading: boolean = false;
  showRuleEdit = false;
  editingRuleId: number | undefined;
  ruleEditForm: { title: string; content: string; category: string }
    = { title: '', content: '', category: 'GENERAL' };
  newRuleTitle = '';
  newRuleContent = '';
  newRuleCategory = 'CODING_STANDARDS';

  setupGuide: any = null;
  setupLoading = false;
  setupGenerating = false;
  setupError = '';
  copiedStepIndex: number | null = null;

  selectedOS: ProjectOS = 'macos';
  detectedOS: ProjectOS = 'macos';

  osOptions: Array<{ value: ProjectOS; labelKey: SetupI18nKey }> = [
    { value: 'macos',   labelKey: 'osMacos'   },
    { value: 'windows', labelKey: 'osWindows' },
    { value: 'linux',   labelKey: 'osLinux'   },
  ];

  errorFixState: {
    [stepIndex: number]: {
      expanded: boolean;
      errorInput: string;
      loading: boolean;
      result: SetupErrorFix | null;
      error: string;
      copiedCommand: boolean;
      attempts: FixAttempt[];
      showNewErrorInput: boolean;
      newErrorInput: string;
    }
  } = {};

  // ══════════════════════════════════════════════════════════════════
  // GIT COMMITS state
  // ══════════════════════════════════════════════════════════════════
  gitCommits: GitCommit[] = [];
  gitCommitsLoading = false;
  gitCommitsError = '';
  gitCommitsErrorCode = '';
  gitRepoInfo: { owner?: string; repo?: string; repoUrl?: string; count?: number } = {};

  // Repo edit form
  showRepoEdit = false;
  repoForm = {
    repoUrl: '',
    githubToken: '',
  };
  isSavingRepo = false;
  repoSaveError = '';

  // ══════════════════════════════════════════════════════════════════
  // DESIGN PREVIEW state
  // ══════════════════════════════════════════════════════════════════
  designFrames: DesignFrame[] = [];
  designFramesCount = 0;
  designFramesLoading = false;
  designVersion: number | null = null;

  boardColumns = [
    { label: 'Backlog', status: 'TODO', color: '#6366f1' },
    { label: 'In Progress', status: 'IN_PROGRESS', color: '#3b82f6' },
    { label: 'In Review', status: 'IN_REVIEW', color: '#f59e0b' },
    { label: 'Customer Confirm', status: 'PENDING_APPROVAL', color: '#a855f7' },
    { label: 'Done', status: 'DONE', color: '#22c55e' },
  ];

  currentLang: string = 'en';
  translatedTitle: string = '';
  translatedDesc: string = '';
  isTranslating: boolean = false;
  pendingLang: string = '';

  selectedChatMember: ChatMember | null = null;
  isGroupChat = false;

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    const savedLang = this.auth.getUser()?.preferredLanguage || 'en';
    this.currentLang = savedLang;
    if (savedLang !== 'en') this.pendingLang = savedLang;

    this.detectedOS = detectOS();
    this.selectedOS = this.detectedOS;

    if (this.projectId) this.loadAll(this.projectId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.resetData();
      this.loadAll(this.projectId);
    }
  }

  resetData() {
    this.project = null; this.stats = null; this.members = [];
    this.tasks = []; this.activities = [];
    this.apiEndpoints = [];
    this.dbTables = [];
    this.setupGuide = null;
    this.setupError = '';
    this.errorFixState = {};
    this.gitCommits = [];
    this.gitCommitsError = '';
    this.gitRepoInfo = {};
    this.designFrames = [];
    this.designFramesCount = 0;
    this.designVersion = null;
    this.isLoading = true;
    this.showEdit = false; this.showDangerZone = false;
    this.activeTab = 'overview';
    this.editingRuleId = undefined;
    this.cdr.detectChanges();
  }

  setupLabel(key: SetupI18nKey): string {
    return setupLabel(this.currentLang, key);
  }

  relativeTime(isoDate: string | undefined | null): string {
    return formatRelativeTime(this.currentLang, isoDate);
  }

  osDisplayLabel(os: ProjectOS): string {
    return osLabel(this.currentLang, os);
  }

  selectOS(os: ProjectOS) {
    this.selectedOS = os;
    this.cdr.detectChanges();
  }

  isGuideForCurrentOS(): boolean {
    if (!this.setupGuide?.parsed) return false;
    const guideOs = this.setupGuide.parsed.os as ProjectOS | undefined;
    return guideOs === this.selectedOS;
  }

  getGuideOS(): ProjectOS | null {
    const guideOs = this.setupGuide?.parsed?.os as ProjectOS | undefined;
    return guideOs || null;
  }

  switchLang(lang: string) {
    this.currentLang = lang;
    if (lang === 'en' || !this.project) {
      this.translatedTitle = ''; this.translatedDesc = '';
      this.tasks.forEach(t => { t.translatedTitle = ''; t.translatedDesc = ''; });
      this.isTranslating = false;
      this.cdr.detectChanges();
      return;
    }
    this.isTranslating = true;
    this.cdr.detectChanges();
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/translations/project/${this.project.id}?lang=${lang}`, h).subscribe({
      next: res => {
        this.translatedTitle = res.title || '';
        this.translatedDesc = res.description || '';
        this.isTranslating = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isTranslating = false; this.cdr.detectChanges(); }
    });
    if (this.tasks.length > 0) this.translateTasks(lang);
  }

  loadAll(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.isLoading = true;
    forkJoin({
      project: this.http.get<any>(`${BASE}/projects/${id}`, h).pipe(catchError(() => of(null))),
      members: this.http.get<any[]>(`${BASE}/projects/${id}/members`, h).pipe(catchError(() => of([]))),
      tasks: this.http.get<any[]>(`${BASE}/tasks/by-project/${id}`, h).pipe(catchError(() => of([]))),
      activities: this.http.get<any[]>(`${BASE}/activity-logs/by-project/${id}`, h).pipe(catchError(() => of([]))),
      clients: this.http.get<any[]>(`${BASE}/clients`, h).pipe(catchError(() => of([]))),
      apis: this.http.get<any[]>(`${BASE}/project-design/${id}/apis/latest?limit=5`, h).pipe(catchError(() => of([]))),
      dbTables: this.http.get<any[]>(`${BASE}/project-design/${id}/db-tables/latest?limit=5`, h).pipe(catchError(() => of([]))),
    }).subscribe({
      next: (res: any) => {
        this.project = res.project; this.members = res.members || [];
        this.tasks = res.tasks || []; this.activities = res.activities || [];
        this.clients = res.clients || [];
        this.apiEndpoints = res.apis || [];
        this.dbTables = res.dbTables || [];
        this.isLoading = false;
        this.cdr.detectChanges();
        if (this.pendingLang && this.project) {
          this.switchLang(this.pendingLang);
          this.pendingLang = '';
        }
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });

    this.loadTechStackAndRules(id);
    this.loadRemovedMembers(id);
    this.loadSetupGuide(id);
    this.loadGitCommits(id);
    this.loadDesignPreview(id);
  }

  async translateTasks(lang: string) {
    const h = { headers: this.auth.getHeaders() };
    for (const t of this.tasks) {
      try {
        const res: any = await this.http.get(`${BASE}/translations/task/${t.id}?lang=${lang}`, h).toPromise();
        t.translatedTitle = res.title || ''; t.translatedDesc = res.description || '';
      } catch {
        t.translatedTitle = ''; t.translatedDesc = '';
      }
    }
    this.cdr.detectChanges();
  }

  loadTechStackAndRules(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.techStackLoading = true;
    this.http.get<any[]>(`${BASE}/project-tech-stacks/by-project/${id}`, h).subscribe({
      next: data => { this.techStacks = data || []; this.techStackLoading = false; this.cdr.detectChanges(); },
      error: () => { this.techStackLoading = false; this.cdr.detectChanges(); }
    });
    this.rulesLoading = true;
    this.http.get<any[]>(`${BASE}/projects/${id}/rules`, h).subscribe({
      next: data => { this.projectRules = data || []; this.rulesLoading = false; this.cdr.detectChanges(); },
      error: () => { this.projectRules = []; this.rulesLoading = false; this.cdr.detectChanges(); }
    });
  }

  get groupedTechStacks(): { category: string, items: any[] }[] {
    const groups: any = {};
    (this.techStacks || []).forEach(t => {
      const cat = t.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return Object.keys(groups).map(cat => ({ category: cat, items: groups[cat] }));
  }

  getCategoryColor(cat: string): string {
    const m: any = { frontend: '#3b82f6', backend: '#16a34a', database: '#f59e0b', mobile: '#a855f7', payment: '#06b6d4', realtime: '#f97316', devops: '#64748b', other: '#475569' };
    return m[cat] || '#475569';
  }

  getCategoryIcon(cat: string): string {
    const m: any = { frontend: '🖥', backend: '⚙️', database: '🗄', mobile: '📱', payment: '💳', realtime: '⚡', devops: '🐳', other: '🔧' };
    return m[cat] || '🔧';
  }

  getRuleCategoryColor(cat: string): string {
    const m: any = { CODING_STANDARDS: '#6366f1', PROCESS_RULES: '#f59e0b', GENERAL: '#64748b' };
    return m[cat] || '#64748b';
  }

  getRuleCategoryIcon(cat: string): string {
    const m: any = { CODING_STANDARDS: '📦', PROCESS_RULES: '⚙️', GENERAL: '📌' };
    return m[cat] || '📌';
  }

  loadSetupGuide(projectId: number) {
    this.setupLoading = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any>(`${BASE}/project-setup/${projectId}`, h).subscribe({
      next: data => {
        this.setupGuide = data ? this.parseSetupContent(data) : null;
        if (this.setupGuide?.parsed?.os) {
          const guideOs = this.setupGuide.parsed.os as ProjectOS;
          if (['macos', 'windows', 'linux'].includes(guideOs)) {
            this.selectedOS = guideOs;
          }
        }
        this.setupLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.setupGuide = null;
        this.setupLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private parseSetupContent(raw: any): any {
    if (!raw) return null;
    try {
      const parsed = typeof raw.content === 'string' ?
        JSON.parse(raw.content) : raw.content;
      return { ...raw, parsed: parsed || { summary: '', steps: [] } };
    } catch {
      return { ...raw, parsed: { summary: '', steps: [] } };
    }
  }

  generateSetupGuide() {
    if (!this.projectId) return;
    if (!this.techStacks || this.techStacks.length === 0) {
      this.setupError = this.setupLabel('emptyNoTech');
      this.cdr.detectChanges();
      return;
    }
    this.setupGenerating = true;
    this.setupError = '';
    this.errorFixState = {};
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    const url = `${BASE}/project-setup/${this.projectId}/generate?os=${this.selectedOS}`;
    this.http.post<any>(url, {}, h).subscribe({
      next: data => {
        this.setupGuide = this.parseSetupContent(data);
        this.setupGenerating = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.setupError = err?.error?.error || 'Failed to generate setup guide.';
        this.setupGenerating = false;
        this.cdr.detectChanges();
      }
    });
  }

  copyStepCommands(step: any, index: number) {
    const text = (step.commands || []).join('\n');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedStepIndex = index;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiedStepIndex = null;
        this.cdr.detectChanges();
      }, 1500);
    });
  }

  isComment(cmd: string): boolean {
    return cmd.trim().startsWith('#');
  }

  // ══════════════════════════════════════════════════════════════════
  // GIT COMMITS
  // ══════════════════════════════════════════════════════════════════

  loadGitCommits(projectId: number) {
    this.gitCommitsLoading = true;
    this.gitCommitsError = '';
    this.gitCommitsErrorCode = '';
    this.gitCommits = [];
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    this.http.get<GitCommitsResponse>(
      `${BASE}/project-commits/${projectId}?limit=10`, h
    ).subscribe({
      next: data => {
        if (data.error) {
          this.gitCommitsErrorCode = data.error;
          this.gitCommitsError = this.mapCommitsErrorMessage(data.error, data.message);
          this.gitCommits = [];
        } else {
          this.gitCommits = data.commits || [];
          this.gitRepoInfo = {
            owner:   data.owner,
            repo:    data.repo,
            repoUrl: data.repoUrl,
            count:   data.count,
          };
        }
        this.gitCommitsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.gitCommitsError = this.setupLabel('gitErrorFetchFailed');
        this.gitCommitsErrorCode = 'NETWORK_ERROR';
        this.gitCommitsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private mapCommitsErrorMessage(code: string, fallback?: string): string {
    switch (code) {
      case 'NO_REPO':          return this.setupLabel('gitEmptyNoRepo');
      case 'REPO_NOT_FOUND':   return this.setupLabel('gitErrorRepoNotFound');
      case 'UNAUTHORIZED':     return this.setupLabel('gitErrorInvalidToken');
      case 'RATE_LIMITED':     return this.setupLabel('gitErrorRateLimited');
      case 'NETWORK_ERROR':    return this.setupLabel('gitErrorFetchFailed');
      default:                 return fallback || this.setupLabel('gitErrorFetchFailed');
    }
  }

  refreshGitCommits() {
    if (this.projectId) this.loadGitCommits(this.projectId);
  }

  openRepoEditor() {
    this.repoForm = {
      repoUrl: this.project?.repoUrl || '',
      githubToken: '',
    };
    this.repoSaveError = '';
    this.showRepoEdit = true;
    this.cdr.detectChanges();
  }

  cancelRepoEdit() {
    this.showRepoEdit = false;
    this.repoSaveError = '';
    this.cdr.detectChanges();
  }

  saveRepoSettings() {
    if (!this.repoForm.repoUrl.trim()) {
      this.repoSaveError = 'Repository URL is required';
      return;
    }
    this.isSavingRepo = true;
    this.repoSaveError = '';
    const h = { headers: this.auth.getHeaders() };
    const payload: any = {
      repoUrl: this.repoForm.repoUrl.trim(),
    };
    if (this.repoForm.githubToken.trim()) {
      payload.githubToken = this.repoForm.githubToken.trim();
    }
    this.http.put<any>(`${BASE}/projects/${this.projectId}`, payload, h).subscribe({
      next: (updated) => {
        this.project = { ...this.project, ...updated };
        this.isSavingRepo = false;
        this.showRepoEdit = false;
        this.cdr.detectChanges();
        this.loadGitCommits(this.projectId);
      },
      error: () => {
        this.repoSaveError = 'Failed to save. Please try again.';
        this.isSavingRepo = false;
        this.cdr.detectChanges();
      }
    });
  }

  openCommitInNewTab(commit: GitCommit) {
    if (commit.htmlUrl) window.open(commit.htmlUrl, '_blank');
  }

  openRepoInNewTab() {
    if (this.gitRepoInfo.repoUrl) window.open(this.gitRepoInfo.repoUrl, '_blank');
  }

  hasRepoConfigured(): boolean {
    return !!(this.project?.repoUrl && this.project.repoUrl.trim());
  }

  // ══════════════════════════════════════════════════════════════════
  // DESIGN PREVIEW
  // ══════════════════════════════════════════════════════════════════

  loadDesignPreview(projectId: number) {
    this.designFramesLoading = true;
    this.designFrames = [];
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    this.http.get<DesignBoardResponse>(
      `${BASE}/designs/by-project/${projectId}`, h
    ).subscribe({
      next: data => {
        const frames = parseCanvasData(data?.canvasData);
        this.designFrames = frames;
        this.designFramesCount = frames.length;
        this.designVersion = data?.version || null;
        this.designFramesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.designFrames = [];
        this.designFramesCount = 0;
        this.designVersion = null;
        this.designFramesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getFrameSvg(frame: DesignFrame): SafeHtml {
    const svg = renderFrameSvg(frame, 240, 150);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ══════════════════════════════════════════════════════════════════
  // ERROR FIX — Iterative
  // ══════════════════════════════════════════════════════════════════

  getErrorFix(stepIndex: number) {
    if (!this.errorFixState[stepIndex]) {
      this.errorFixState[stepIndex] = {
        expanded: false,
        errorInput: '',
        loading: false,
        result: null,
        error: '',
        copiedCommand: false,
        attempts: [],
        showNewErrorInput: false,
        newErrorInput: '',
      };
    }
    return this.errorFixState[stepIndex];
  }

  toggleErrorFix(stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    state.expanded = !state.expanded;
    if (!state.expanded) {
      state.result = null;
      state.error = '';
    }
    this.cdr.detectChanges();
  }

  hasReachedMaxAttempts(stepIndex: number): boolean {
    return this.getErrorFix(stepIndex).attempts.length >= MAX_FIX_ATTEMPTS;
  }

  fixErrorWithAI(step: any, stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    const errorOutput = state.errorInput.trim();
    if (!errorOutput) {
      state.error = 'Please paste the error output first';
      this.cdr.detectChanges();
      return;
    }
    this.submitFixRequest(step, stepIndex, errorOutput);
  }

  retryWithNewError(step: any, stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    const newError = state.newErrorInput.trim();
    if (!newError) {
      state.error = 'Please paste the new error output first';
      this.cdr.detectChanges();
      return;
    }
    this.submitFixRequest(step, stepIndex, newError);
  }

  private submitFixRequest(step: any, stepIndex: number, errorOutput: string) {
    const state = this.getErrorFix(stepIndex);
    state.loading = true;
    state.error = '';
    this.cdr.detectChanges();

    const h = { headers: this.auth.getHeaders() };
    const url = `${BASE}/project-setup/${this.projectId}/fix-error`;
    const body = {
      stepIndex,
      stepTitle:  step.title,
      commands:   step.commands,
      errorOutput,
      previousAttempts: state.attempts,
    };

    this.http.post<SetupErrorFix>(url, body, h).subscribe({
      next: result => {
        state.result = result;
        state.loading = false;
        state.showNewErrorInput = false;
        state.newErrorInput = '';
        this.cdr.detectChanges();
      },
      error: err => {
        state.error = err?.error?.error || 'Failed to analyze error.';
        state.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  markAsDidNotWork(stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    if (!state.result) return;
    state.attempts.push({
      suggestedSolution: state.result.solution,
      triedCommands:     (state.result.commands || []).join('\n'),
      newError:          state.errorInput || state.newErrorInput,
      timestamp:         Date.now(),
    });
    state.result = null;
    state.showNewErrorInput = true;
    state.newErrorInput = '';
    state.error = '';
    this.cdr.detectChanges();
  }

  cancelRetry(stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    state.showNewErrorInput = false;
    state.newErrorInput = '';
    this.cdr.detectChanges();
  }

  dismissErrorFix(stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    state.expanded = false;
    state.result = null;
    state.error = '';
    state.errorInput = '';
    state.newErrorInput = '';
    state.showNewErrorInput = false;
    this.cdr.detectChanges();
  }

  copyFixCommands(stepIndex: number) {
    const state = this.getErrorFix(stepIndex);
    if (!state.result?.commands?.length) return;
    const text = state.result.commands.join('\n');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      state.copiedCommand = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        state.copiedCommand = false;
        this.cdr.detectChanges();
      }, 1500);
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // EDIT
  // ══════════════════════════════════════════════════════════════════

  initEditForm() {
    if (!this.project) return;
    this.editForm = {
      title: this.project.title || '',
      description: this.project.description || '',
      status: this.project.status || 'ACTIVE',
      startDate: this.project.startDate || '',
      endDate: this.project.endDate || '',
      budget: this.project.budget || null,
      priority: this.project.priority || 'MEDIUM',
    };
    this.editError = ''; this.showDangerZone = false; this.deleteConfirmName = '';
  }

  saveEdit() {
    if (!this.editForm.title.trim()) { this.editError = 'Title is required'; return; }
    this.isSaving = true; this.editError = '';
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/projects/${this.projectId}`, {
      title: this.editForm.title.trim(),
      description: this.editForm.description,
      status: this.editForm.status,
      startDate: this.editForm.startDate || null,
      endDate: this.editForm.endDate || null,
      budget: this.editForm.budget || null,
      priority: this.editForm.priority,
    }, h).subscribe({
      next: (updated) => {
        this.project = { ...this.project, ...updated };
        this.isSaving = false; this.showEdit = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.editError = 'Failed to save.';
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  get deleteConfirmMatches(): boolean {
    return this.deleteConfirmName.trim() === (this.project?.title || '').trim();
  }

  cancelProject() {
    if (!this.deleteConfirmMatches || this.isDeleting) return;
    this.isDeleting = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/projects/${this.projectId}`, { status: 'CANCELLED' }, h).subscribe({
      next: () => {
        this.isDeleting = false;
        this.project = { ...this.project, status: 'CANCELLED' };
        this.showEdit = false; this.showDangerZone = false;
        this.activeTab = 'overview'; this.deleteConfirmName = '';
        this.cdr.detectChanges();
      },
      error: () => { this.isDeleting = false; this.cdr.detectChanges(); }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ROLE / PERMISSIONS
  // ══════════════════════════════════════════════════════════════════

  getRole(): string { return this.auth.getUser()?.role || this.auth.getUser()?.roleName || ''; }

  canEdit(): boolean {
    const r = this.getRole();
    if (['BOSS', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR'].includes(r)) return true;
    if (r === 'PROJECT_MANAGER') {
      const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
      return this.project?.pmId === myId;
    }
    return false;
  }

  canDelete(): boolean {
    const r = this.getRole();
    if (r === 'BOSS') return false;
    if (['VICE_PRESIDENT', 'COUNTRY_DIRECTOR'].includes(r)) return true;
    if (r === 'PROJECT_MANAGER') {
      const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
      return this.project?.pmId === myId;
    }
    return false;
  }

  canAccessSetup(): boolean {
    const r = this.getRole();
    return ['BOSS', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'PROJECT_MANAGER'].includes(r);
  }

  // ══════════════════════════════════════════════════════════════════
  // STATS / GETTERS
  // ══════════════════════════════════════════════════════════════════

  get statsCards() {
    return [
      { label: 'Total Tasks', value: this.stats?.totalTasks ?? this.tasks.length, icon: '📋', color: 'stat-white' },
      { label: 'Completed', value: this.stats?.completed ?? 0, icon: '✅', color: 'stat-green' },
      { label: 'In Progress', value: this.stats?.inProgress ?? 0, icon: '⚡', color: 'stat-blue' },
      { label: 'Completion', value: (this.project?.progress ?? 0) + '%', icon: '📊', color: 'stat-purple' },
      { label: 'Team Size', value: this.stats?.teamSize ?? this.members.length, icon: '👥', color: 'stat-cyan' },
      { label: 'Overdue', value: this.stats?.overdue ?? 0, icon: '⚠️', color: 'stat-red' },
    ];
  }

  get myTasks(): any[] {
    const userId = this.auth.getUser()?.userId;
    return this.tasks.filter(t => t.assigneeId === userId);
  }

  get boardPct(): number {
    if (!this.tasks.length) return 0;
    return Math.round(this.tasks.filter(t => t.status === 'DONE').length / this.tasks.length * 100);
  }

  get doneCount(): number { return this.tasks.filter(t => t.status === 'DONE').length; }
  get inProgressCount(): number { return this.tasks.filter(t => t.status === 'IN_PROGRESS').length; }
  getTasksByStatus(status: string): any[] { return this.tasks.filter(t => t.status === status); }

  getClientName(): string {
    if (!this.project?.clientId) return '—';
    const client = this.clients.find(c => Number(c.id) === Number(this.project.clientId));
    if (client) return client.companyName || client.name || '—';
    const member = this.members.find(m => Number(m.userId) === Number(this.project.clientId));
    return member?.userName || member?.name || `Client #${this.project.clientId}`;
  }

  getPmName(): string {
    if (!this.project?.pmId) return '—';
    if (this.project.pmName) return this.project.pmName;
    const pm = this.members.find(m => Number(m.userId) === Number(this.project.pmId));
    return pm?.userName || pm?.name || `PM #${this.project.pmId}`;
  }

  openDesign(): void { this.router.navigate(['/design', this.project?.id]); }
  getPmInitial(): string { const name = this.getPmName(); return name.startsWith('PM #') ? 'P' : (name[0]?.toUpperCase() || 'P'); }
  formatBudget(b: any): string { return b ? '$' + Number(b).toLocaleString() : '—'; }

  getStatusColor2(s: string): string {
    const m: any = { ACTIVE: '#22c55e', PLANNING: '#f59e0b', ON_HOLD: '#6366f1', COMPLETED: '#3b82f6', CANCELLED: '#ef4444' };
    return m[s] || '#64748b';
  }

  getStatusBg(s: string): string {
    const m: any = { ACTIVE: 'rgba(34,197,94,0.12)', PLANNING: 'rgba(245,158,11,0.12)', ON_HOLD: 'rgba(99,102,241,0.12)', COMPLETED: 'rgba(59,130,246,0.12)', CANCELLED: 'rgba(239,68,68,0.12)' };
    return m[s] || 'rgba(100,116,139,0.12)';
  }

  isOverdue(): boolean {
    if (!this.project?.endDate) return false;
    return new Date(this.project.endDate) < new Date() && this.project.status !== 'COMPLETED';
  }

  isTaskOverdue(task: any): boolean {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  }

  getBudget(): string { const b = this.project?.budget; return b ? '$' + Number(b).toLocaleString() : '—'; }
  getMemberInitial(m: any): string { return (m.userName || m.name || '?')[0].toUpperCase(); }

  getPriorityColor2(p: string): string {
    const m: any = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
    return m[p] || '#f59e0b';
  }

  getMemberColor(i: number): string {
    const c = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    return c[i % c.length];
  }

  getRoleColor(role: string): string {
    const m: any = { PROJECT_MANAGER: '#16a34a', LEADER: '#0891b2', DEVELOPER: '#4f46e5', UI_UX: '#7c3aed', QA: '#ea580c', CUSTOMER: '#64748b' };
    return m[role] || '#475569';
  }

  getStatusClass(s: string): string {
    const m: any = { PLANNING: 'badge-gray', ACTIVE: 'badge-green', ON_HOLD: 'badge-yellow', COMPLETED: 'badge-blue', CANCELLED: 'badge-red' };
    return m[s] || 'badge-gray';
  }

  getTaskStatusClass(s: string): string {
    const m: any = { TODO: 'badge-gray', IN_PROGRESS: 'badge-blue', IN_REVIEW: 'badge-yellow', DONE: 'badge-green', DELAYED: 'badge-red', PENDING_APPROVAL: 'badge-purple' };
    return m[s] || 'badge-gray';
  }

  getPriorityClass(p: string): string {
    const m: any = { LOW: 'badge-gray', MEDIUM: 'badge-blue', HIGH: 'badge-orange', CRITICAL: 'badge-red' };
    return m[p] || 'badge-blue';
  }

  getPriorityTcClass(p: string): string {
    const m: any = { CRITICAL: 'tc-red', HIGH: 'tc-red', MEDIUM: 'tc-yellow', LOW: 'tc-blue' };
    return m[p] || 'tc-blue';
  }

  getMethodClass(method: string): string {
    const m: any = { GET: 'method-get', POST: 'method-post', PUT: 'method-put', PATCH: 'method-patch', DELETE: 'method-delete' };
    return m[method?.toUpperCase()] || 'method-get';
  }

  getActionIcon(action: string): string {
    const m: any = { TASK_CREATED: '✨', TASK_MOVED: '↔️', TASK_ASSIGNED: '👤', COMMENT_ADDED: '💬', FILE_UPLOADED: '📎', MEMBER_ADDED: '➕', PROJECT_CREATED: '🚀', STATUS_CHANGED: '🔄' };
    return m[action] || '📝';
  }

  getActionText(action: string): string {
    const m: any = { TASK_CREATED: 'created a task', TASK_MOVED: 'moved a task', TASK_ASSIGNED: 'assigned a task', COMMENT_ADDED: 'added a comment', FILE_UPLOADED: 'uploaded a file', MEMBER_ADDED: 'added a member', PROJECT_CREATED: 'created the project', STATUS_CHANGED: 'changed status' };
    return m[action] || action;
  }

  parseDbColumns(columnsStr: string): string[] {
    if (!columnsStr) return [];
    try {
      const parsed = JSON.parse(columnsStr);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 4).map((c: any) => {
          const name = c.name || c.column_name || '';
          const isPk = name === 'id' || (c.key || '').toUpperCase().includes('PK');
          return isPk ? `🔑 ${name}` : name;
        });
      }
    } catch {}
    return columnsStr.split(',').slice(0, 4).map(part => {
      const trimmed = part.trim();
      const tokens = trimmed.split(/\s+/);
      const name = tokens[0] || '';
      const isPk = name === 'id' || trimmed.toUpperCase().includes('PK');
      return isPk ? `🔑 ${name}` : name;
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════════════════════

  openMemberChat(m: any) {
    this.selectedChatMember = {
      id: m.userId || m.id,
      name: m.userName || m.name,
      role: m.displayName || m.roleInProject || m.role,
      color: m.color || this.getMemberColor(this.members.indexOf(m)),
      initial: this.getMemberInitial(m),
      online: m.online,
    };
    this.isGroupChat = false;
  }

  openGroupChat() {
    this.selectedChatMember = {
      id: this.projectId,
      name: this.project?.title || 'Group Chat',
      projectId: this.projectId,
      projectName: this.project?.title || 'Group Chat',
      color: '#16a34a',
    };
    this.isGroupChat = true;
  }

  closeChatPopup() { this.selectedChatMember = null; this.isGroupChat = false; }

  // ══════════════════════════════════════════════════════════════════
  // TECH STACK
  // ══════════════════════════════════════════════════════════════════

  addTechStack() {
    const name = this.newTechName.trim();
    if (!name) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/project-tech-stacks`, {
      projectId: this.projectId, name, category: this.newTechCategory, position: this.techStacks.length,
    }, h).subscribe({
      next: ts => { this.techStacks.push(ts); this.newTechName = ''; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  deleteTechStack(id: number) {
    if (!id) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/project-tech-stacks/${id}`, h).subscribe({
      next: () => { this.techStacks = this.techStacks.filter(t => t.id !== id); this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // MEMBERS
  // ══════════════════════════════════════════════════════════════════

  loadStaffList() {
    if (this.staffList.length > 0) { this.filterStaff(); return; }
    this.staffListLoading = true;
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/users/staff-list`, h).subscribe({
      next: users => {
        const exclude = ['BOSS', 'COUNTRY_DIRECTOR', 'CUSTOMER', 'ADMIN'];
        const myId = this.auth.getUser()?.id || this.auth.getUser()?.userId;
        this.staffList = users.filter(u => {
          const r = u.roleName || u.role || '';
          return !exclude.includes(r) && u.isActive !== false && u.id !== myId;
        });
        this.staffListLoading = false;
        this.filterStaff();
        this.cdr.detectChanges();
      },
      error: () => { this.staffListLoading = false; this.cdr.detectChanges(); }
    });
  }

  filterStaff() {
    const q = this.memberSearchQuery.trim().toLowerCase();
    this.filteredStaff = q
      ? this.staffList.filter(s => {
          const role = s.roleDto?.name || s.roleName || s.role || '';
          return (s.name || '').toLowerCase().includes(q) || role.toLowerCase().includes(q);
        })
      : this.staffList;
    this.cdr.detectChanges();
  }

  isAlreadyMember(userId: number): boolean {
    return this.members.some(m => m.userId === userId);
  }

  addMember(staff: any) {
    if (this.isAlreadyMember(staff.id)) return;
    const h = { headers: this.auth.getHeaders() };
    const role = this.mapRoleInProject(staff.roleDto?.name || staff.roleName || staff.role || 'DEVELOPER');
    this.http.post<any>(`${BASE}/projects/${this.projectId}/members`, { userId: staff.id, roleInProject: role }, h).subscribe({
      next: () => {
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
          next: m => { this.members = m || []; this.cdr.detectChanges(); },
          error: () => { }
        });
      },
      error: () => { }
    });
  }

  removeMember(userId: number) {
    if (!userId) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/projects/${this.projectId}/members/${userId}`, h).subscribe({
      next: () => {
        const idx = this.members.findIndex(m => m.userId === userId);
        if (idx >= 0) {
          const removed = { ...this.members[idx], status: 'REMOVED' };
          this.members.splice(idx, 1);
          this.removedMembers.push(removed);
        }
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  mapRoleInProject(role: string): string {
    const known: any = {
      PROJECT_MANAGER: 'PROJECT_MANAGER', LEADER: 'LEADER',
      UI_UX: 'UI_UX', DEVELOPER: 'DEVELOPER', QA: 'QA', CUSTOMER: 'CUSTOMER',
    };
    return known[role] || role || 'DEVELOPER';
  }

  loadRemovedMembers(id: number) {
    const h = { headers: this.auth.getHeaders() };
    this.http.get<any[]>(`${BASE}/projects/${id}/members/removed`, h).subscribe({
      next: data => { this.removedMembers = data || []; this.cdr.detectChanges(); },
      error: () => { this.removedMembers = []; }
    });
  }

  restoreMember(userId: number, roleInProject: string) {
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(
      `${BASE}/projects/${this.projectId}/members`,
      { userId, roleInProject: roleInProject || 'DEVELOPER' }, h
    ).subscribe({
      next: () => {
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members`, h).subscribe({
          next: data => { this.members = data || []; this.cdr.detectChanges(); },
          error: () => { }
        });
        this.http.get<any[]>(`${BASE}/projects/${this.projectId}/members/removed`, h).subscribe({
          next: data => { this.removedMembers = data || []; this.cdr.detectChanges(); },
          error: () => { }
        });
      },
      error: () => { }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // RULES
  // ══════════════════════════════════════════════════════════════════

  startEditRule(rule: any) {
    this.editingRuleId = Number(rule.id);
    this.ruleEditForm = { title: rule.title || '', content: rule.content || '', category: rule.category || 'GENERAL' };
    this.cdr.detectChanges();
  }

  cancelEditRule() { this.editingRuleId = undefined; this.cdr.detectChanges(); }

  saveRule(ruleId: number) {
    if (!this.ruleEditForm.title.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.put<any>(`${BASE}/project-rules/${ruleId}`, {
      title: this.ruleEditForm.title.trim(), content: this.ruleEditForm.content, category: this.ruleEditForm.category,
    }, h).subscribe({
      next: updated => {
        const idx = this.projectRules.findIndex(r => r.id === ruleId);
        if (idx >= 0) this.projectRules[idx] = updated;
        this.editingRuleId = undefined;
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  addRule() {
    if (!this.newRuleTitle.trim() || !this.newRuleContent.trim()) return;
    const h = { headers: this.auth.getHeaders() };
    this.http.post<any>(`${BASE}/projects/${this.projectId}/rules/manual`, {
      title: this.newRuleTitle.trim(),
      content: this.newRuleContent.trim(),
      category: this.newRuleCategory,
      createdBy: this.auth.getUser()?.userId || this.auth.getUser()?.id,
    }, h).subscribe({
      next: rule => {
        this.projectRules.push(rule);
        this.newRuleTitle = ''; this.newRuleContent = '';
        this.newRuleCategory = 'CODING_STANDARDS';
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  deleteRule(ruleId: number) {
    const h = { headers: this.auth.getHeaders() };
    this.http.delete(`${BASE}/project-rules/${ruleId}`, h).subscribe({
      next: () => { this.projectRules = this.projectRules.filter(r => r.id !== ruleId); this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // SORT / VISIBILITY HELPERS
  // ══════════════════════════════════════════════════════════════════

  getRoleOrder(roleInProject: string): number {
    const order: Record<string, number> = {
      'COUNTRY_DIRECTOR': 1, 'VICE_PRESIDENT': 2, 'ADMIN': 3,
      'PROJECT_MANAGER': 4, 'LEADER': 5, 'UI_UX': 6,
      'DEVELOPER': 7, 'QA': 8, 'CUSTOMER': 9,
    };
    return order[roleInProject] ?? 99;
  }

  sortMembers(members: any[]): any[] {
    return [...members].sort((a, b) => {
      const ra = this.getRoleOrder(a.roleInProject || a.role || '');
      const rb = this.getRoleOrder(b.roleInProject || b.role || '');
      return ra - rb;
    });
  }

  getVisibleMemberCount(): number {
    return this.members.filter(m =>
      m.roleInProject !== 'COUNTRY_DIRECTOR' &&
      m.roleInProject !== 'VICE_PRESIDENT' &&
      m.roleInProject !== 'ADMIN'
    ).length;
  }

  getGroupChatCount(): number {
    return this.members.filter(m => m.roleInProject !== 'ADMIN').length;
  }
}
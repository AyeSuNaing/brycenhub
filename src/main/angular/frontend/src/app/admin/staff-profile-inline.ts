import {
  Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-staff-profile-inline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './staff-profile-inline.html',
  host: { style: 'display:contents' }
})
export class StaffProfileInline implements OnInit {

  @Input()  staffId!: number;
  @Output() back     = new EventEmitter<void>();
  @Output() edit     = new EventEmitter<any>();

  staff:         any = null;
  profile:       any = null;   // member_profiles
  skills:        any[] = [];   // member_skills full list
  isLoading      = true;
  isToggling     = false;
  copiedField    = '';

  // accordion state
  accBasic    = true;
  accLogin    = true;
  accCv       = true;
  accSkills   = true;
  accProjects = true;
  accSocial   = true;
  accDanger   = false;

  constructor(
    private http:  HttpClient,
    private auth:  AuthService,
    private cdr:   ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading = true;

    // Single endpoint — all data in one call
    // lang param → server-side on-demand translation
    const lang = this.auth.getUser()?.preferredLanguage || 'en';
    this.http.get<any>(`${BASE}/users/${this.staffId}/full-profile?lang=${lang}`,
      { headers: this.auth.getHeaders() })
      .subscribe({
        next: data => {
          // Basic + role + department
          this.staff = {
            id:               data.id,
            name:             data.name,
            email:            data.email,
            phone:            data.phone,
            isActive:         data.isActive,
            preferredLanguage:data.preferredLanguage,
            profileImage:     data.profileImage,
            lastSeen:         data.lastSeen,
            roleId:           data.roleId,
            roleName:         data.roleName,
            roleDisplayName:  data.roleDisplayName,
            roleColor:        data.roleColor,
            departmentId:     data.departmentId,
            departmentName:   data.departmentName,
          };

          // CV / profile data
          if (data.cvAnalyzed !== null || data.cvFileUrl || data.educationEn) {
            // Parse projectsJson → projects array
            let projects: any[] = [];
            if (data.projectsJson) {
              try { projects = JSON.parse(data.projectsJson); } catch (_) {}
            }
            // Parse socialLinksJson → socialLinks object
            // CvDto.SocialLinks: { linkedin, github, twitter, facebook, website, other }
            let socialLinks: any = null;
            if (data.socialLinksJson) {
              try { socialLinks = JSON.parse(data.socialLinksJson); } catch (_) {}
            }
            this.profile = {
              cvAnalyzed:         data.cvAnalyzed,
              cvFileUrl:          data.cvFileUrl,
              experienceYears:    data.experienceYears,
              educationEn:        data.educationEn,
              experienceDetailEn: data.experienceDetailEn,
              cvOriginalLanguage: data.cvOriginalLanguage,
              projects:           projects,
              socialLinks:        socialLinks,
            };
          } else {
            this.profile = null;
          }

          // Skills
          this.skills    = data.skills || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ── Toggle activation ────────────────────────────────────────
  toggleActivation() {
    if (!this.staff) return;
    this.isToggling = true;
    const url = this.staff.isActive
      ? `${BASE}/users/${this.staffId}/deactivate`
      : `${BASE}/users/${this.staffId}/activate`;

    this.http.put(url, {}, { headers: this.auth.getHeaders() })
      .subscribe({
        next: () => {
          this.staff.isActive = !this.staff.isActive;
          this.isToggling = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isToggling = false; }
      });
  }

  // ── Copy credentials ─────────────────────────────────────────
  copyField(text: string, field: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2000);
    });
  }

  copyBoth() {
    if (!this.staff) return;
    const text = 'Email: ' + this.staff.email + '\nLogin URL: http://localhost:4200/login';
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = 'both';
      this.cdr.detectChanges();
      setTimeout(() => { this.copiedField = ''; this.cdr.detectChanges(); }, 2000);
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  getAvatarColor(name: string): string {
    const c = ['#16a34a','#0284c7','#7c3aed','#db2777','#ea580c','#0891b2','#d97706'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  getSkillColor(level: string): string {
    switch (level) {
      case 'SENIOR':   return '#a78bfa';
      case 'MID':      return '#60a5fa';
      case 'BEGINNER': return '#34d399';
      default:         return '#94a3b8';
    }
  }

  getSkillBg(level: string): string {
    switch (level) {
      case 'SENIOR':   return 'rgba(167,139,250,0.1)';
      case 'MID':      return 'rgba(96,165,250,0.1)';
      case 'BEGINNER': return 'rgba(52,211,153,0.1)';
      default:         return 'rgba(148,163,184,0.1)';
    }
  }

  getLangLabel(code: string): string {
    const map: Record<string,string> = {
      en:'🇺🇸 English', ja:'🇯🇵 Japanese', my:'🇲🇲 Myanmar',
      km:'🇰🇭 Khmer', vi:'🇻🇳 Vietnamese', ko:'🇰🇷 Korean'
    };
    return map[code] || code;
  }

  splitEntries(text: string): string[] {
    if (!text) return [];
    return text.split(';').map(s => s.trim()).filter(s => s.length > 0);
  }

  // ── Skill grouping helpers ─────────────────────────────────
  getSkillGroups(): { level: string; label: string; skills: any[] }[] {
    return [
      {
        level: 'SENIOR',
        label: 'Senior',
        skills: this.skills.filter(s => s.skillLevel === 'SENIOR')
      },
      {
        level: 'MID',
        label: 'Mid Level',
        skills: this.skills.filter(s => s.skillLevel === 'MID')
      },
      {
        level: 'BEGINNER',
        label: 'Beginner',
        skills: this.skills.filter(s => s.skillLevel === 'BEGINNER')
      },
      {
        level: '',
        label: 'Other',
        skills: this.skills.filter(s => !s.skillLevel)
      },
    ];
  }

  getSkillCount(level: string): number {
    return this.skills.filter(s => s.skillLevel === level).length;
  }

  getInputTypeCount(type: string): number {
    return this.skills.filter(s => s.inputType === type).length;
  }

  splitTech(tech: string): string[] {
    if (!tech) return [];
    return tech.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  hasSocialLinks(p: any): boolean {
    if (!p?.socialLinks) return false;
    const s = p.socialLinks;
    // CvDto.SocialLinks fields: linkedin, github, twitter, facebook, website, other
    return !!(s.linkedin || s.github || s.twitter || s.facebook || s.website || s.other);
  }

  toUrl(link: string): string {
    if (!link) return '#';
    return link.startsWith('http') ? link : 'https://' + link;
  }

  toggleAcc(key: string) {
    if (key === 'basic')    this.accBasic    = !this.accBasic;
    if (key === 'login')    this.accLogin    = !this.accLogin;
    if (key === 'cv')       this.accCv       = !this.accCv;
    if (key === 'skills')   this.accSkills   = !this.accSkills;
    if (key === 'projects') this.accProjects = !this.accProjects;
    if (key === 'social')   this.accSocial   = !this.accSocial;
    if (key === 'danger')   this.accDanger   = !this.accDanger;
  }
}
/**
 * Design Preview Helper — v3 (CORRECT structure from design-edit.html)
 *
 * canvas_data JSON structure:
 * [
 *   {
 *     id: 'f1', name: 'Login', x: 0, y: 0, w: 1440, h: 900, bgColor: '#ffffff',
 *     comps: [
 *       {
 *         id: 'c1',
 *         type: 'rectangle' | 'button' | 'text' | 'image' | ...,
 *         frameId: 'f1',
 *         parentId: null | 'c_parent',      // ← IMPORTANT: nested inside container
 *         x: 100, y: 100, w: 200, h: 50,    // ← coords relative to parent (if parentId)
 *         visible: true,
 *         style: {
 *           backgroundColor, color, borderColor, borderRadius,
 *           fontSize, fontFamily, fontWeight, textAlign, borderWidth
 *         },
 *         props: {
 *           content: 'Button text',          // ← REAL text/label content
 *           src: 'image url',
 *           icon: '★',
 *           value: 65
 *         }
 *       }
 *     ]
 *   }
 * ]
 *
 * Created: 2026-04-19 · v3 fixes nested layout + real text rendering
 */

export interface DesignComponent {
  id?:       string;
  type?:     string;
  frameId?:  string;
  parentId?: string | null;
  x?:        number;
  y?:        number;
  w?:        number;
  h?:        number;
  rotation?: number;
  visible?:  boolean;
  style?: {
    backgroundColor?: string;
    borderColor?:     string;
    color?:           string;
    borderRadius?:    string | number;
    borderWidth?:     string | number;
    fontSize?:        string | number;
    fontFamily?:      string;
    fontWeight?:      string | number;
    textAlign?:       string;
    boxShadow?:       string;
    opacity?:         string | number;
  };
  props?: {
    content?: string;
    src?:     string;
    fit?:     string;
    icon?:    string;
    value?:   number;
  };
}

export interface DesignFrame {
  id:       string;
  name:     string;
  x?:       number;
  y?:       number;
  w:        number;
  h:        number;
  bgColor?: string;
  comps:    DesignComponent[];
}

export interface DesignBoardResponse {
  id?:           number;
  projectId?:    number;
  canvasData?:   string;
  thumbnailUrl?: string;
  version?:      number;
  updatedAt?:    string;
}

export function parseCanvasData(canvasDataJson: string | null | undefined): DesignFrame[] {
  if (!canvasDataJson || canvasDataJson.trim() === '') return [];
  try {
    const parsed = JSON.parse(canvasDataJson);
    if (Array.isArray(parsed)) {
      return parsed.filter(f => f && f.id && f.comps !== undefined);
    }
    if (parsed.frames && Array.isArray(parsed.frames)) {
      return parsed.frames.filter((f: any) => f && f.id && f.comps !== undefined);
    }
    return [];
  } catch (e) {
    console.warn('[DesignPreview] Failed to parse canvas_data:', e);
    return [];
  }
}

function buildCompMap(comps: DesignComponent[]): Map<string, DesignComponent> {
  const map = new Map<string, DesignComponent>();
  for (const c of comps) {
    if (c.id) map.set(c.id, c);
  }
  return map;
}

function getAbsolutePos(
  c: DesignComponent,
  compMap: Map<string, DesignComponent>
): { x: number; y: number } {
  let x = c.x || 0;
  let y = c.y || 0;
  let parentId = c.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = compMap.get(parentId);
    if (!parent) break;
    x += parent.x || 0;
    y += parent.y || 0;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function renderFrameSvg(
  frame: DesignFrame,
  targetWidth: number = 240,
  targetHeight: number = 150
): string {
  if (!frame || !frame.comps) {
    return emptyFrameSvg(targetWidth, targetHeight);
  }

  const frameW = frame.w || 1440;
  const frameH = frame.h || 900;

  const scale    = Math.min(targetWidth / frameW, targetHeight / frameH);
  const scaledW  = frameW * scale;
  const scaledH  = frameH * scale;
  const offsetX  = (targetWidth  - scaledW) / 2;
  const offsetY  = (targetHeight - scaledH) / 2;

  const bgColor = sanitizeColor(frame.bgColor) || '#ffffff';

  const compMap = buildCompMap(frame.comps);
  const visibleComps = frame.comps.filter(c => c && c.visible !== false);
  const ordered = [...visibleComps].sort((a, b) => depthOf(a, compMap) - depthOf(b, compMap));

  const componentSvgs = ordered
    .map(c => renderComponent(c, scale, offsetX, offsetY, compMap))
    .filter(s => s)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetWidth} ${targetHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <rect x="${offsetX.toFixed(1)}" y="${offsetY.toFixed(1)}" width="${scaledW.toFixed(1)}" height="${scaledH.toFixed(1)}" fill="${bgColor}" stroke="#e5e7eb" stroke-width="0.5" rx="2"/>
    ${componentSvgs}
  </svg>`;
}

function depthOf(c: DesignComponent, compMap: Map<string, DesignComponent>): number {
  let d = 0;
  let pid = c.parentId;
  const visited = new Set<string>();
  while (pid && !visited.has(pid)) {
    visited.add(pid);
    d++;
    const parent = compMap.get(pid);
    pid = parent?.parentId;
  }
  return d;
}

function renderComponent(
  c:       DesignComponent,
  scale:   number,
  offsetX: number,
  offsetY: number,
  compMap: Map<string, DesignComponent>
): string {
  if (!c) return '';

  const abs = getAbsolutePos(c, compMap);
  const x = abs.x * scale + offsetX;
  const y = abs.y * scale + offsetY;
  const w = (c.w || 50) * scale;
  const h = (c.h || 20) * scale;

  if (w < 0.5 || h < 0.5) return '';

  const style   = c.style || {};
  const props   = c.props || {};
  const content = props.content || '';
  const type    = (c.type || 'rectangle').toLowerCase();

  const fill      = sanitizeColor(style.backgroundColor) || getDefaultFill(type);
  const stroke    = sanitizeColor(style.borderColor)     || 'none';
  const textColor = sanitizeColor(style.color)           || getDefaultTextColor(type);
  const borderRadius = parsePx(style.borderRadius);
  const borderWidth  = parsePx(style.borderWidth);
  const fontSize     = parsePx(style.fontSize) || 14;

  switch (type) {
    case 'circle': {
      const r  = Math.min(w, h) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${(borderWidth * scale).toFixed(1)}"/>`;
    }

    case 'text': {
      const displayText = content || 'Text';
      const scaledFontSize = Math.max(3, fontSize * scale);
      const anchor = textAnchorFor(style.textAlign);
      const tx = anchor === 'middle' ? x + w/2 : anchor === 'end' ? x + w - 2 : x + 2;
      const truncated = truncate(displayText, 28);
      return `<text x="${tx.toFixed(1)}" y="${(y + h * 0.72).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="${textColor}" text-anchor="${anchor}" font-family="sans-serif" font-weight="${style.fontWeight || '400'}">${escapeXml(truncated)}</text>`;
    }

    case 'label': {
      const labelFill   = sanitizeColor(style.backgroundColor) || '#f8fafc';
      const labelStroke = sanitizeColor(style.borderColor)     || '#e2e8f0';
      const labelColor  = sanitizeColor(style.color)           || '#64748b';
      const displayText = content || 'Label';
      const scaledFontSize = Math.max(3, (fontSize || 11) * scale);
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '2';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${labelFill}" stroke="${labelStroke}" stroke-width="0.3" rx="${rx}"/>
      <text x="${(x + w/2).toFixed(1)}" y="${(y + h * 0.7).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="${labelColor}" text-anchor="middle" font-family="sans-serif" font-weight="600">${escapeXml(truncate(displayText, 18))}</text>`;
    }

    case 'image': {
      const imgStroke = '#9CA3AF';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#E5E7EB" stroke="${imgStroke}" stroke-width="0.4" rx="1"/>
      <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+w).toFixed(1)}" y2="${(y+h).toFixed(1)}" stroke="${imgStroke}" stroke-width="0.4"/>
      <line x1="${(x+w).toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y+h).toFixed(1)}" stroke="${imgStroke}" stroke-width="0.4"/>`;
    }

    case 'icon': {
      const iconColor = sanitizeColor(style.color) || '#6b7280';
      const iconChar  = props.icon || '★';
      const scaledFontSize = Math.max(6, Math.min(w, h) * 0.7);
      return `<text x="${(x + w/2).toFixed(1)}" y="${(y + h * 0.75).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="${iconColor}" text-anchor="middle" font-family="sans-serif">${escapeXml(iconChar)}</text>`;
    }

    case 'button': {
      const displayText = content || 'Button';
      const btnFill = sanitizeColor(style.backgroundColor) || '#16a34a';
      const btnTextColor = sanitizeColor(style.color) || '#ffffff';
      const scaledFontSize = Math.max(3, (fontSize || 14) * scale);
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '2';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${btnFill}" rx="${rx}"/>
      <text x="${(x + w/2).toFixed(1)}" y="${(y + h * 0.67).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="${btnTextColor}" text-anchor="middle" font-family="sans-serif" font-weight="600">${escapeXml(truncate(displayText, 18))}</text>`;
    }

    case 'input':
    case 'textfield':
    case 'textarea': {
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '1.5';
      const inputStroke = sanitizeColor(style.borderColor) || '#d1d5db';
      let inner = '';
      if (content) {
        const scaledFontSize = Math.max(3, (fontSize || 12) * scale);
        inner = `<text x="${(x + 4).toFixed(1)}" y="${(y + h * 0.68).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="#9ca3af" font-family="sans-serif">${escapeXml(truncate(content, 20))}</text>`;
      }
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#ffffff" stroke="${inputStroke}" stroke-width="0.4" rx="${rx}"/>${inner}`;
    }

    case 'dropdown': {
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '1.5';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.4" rx="${rx}"/>
      <polyline points="${(x+w-6).toFixed(1)},${(y+h/2-1).toFixed(1)} ${(x+w-3).toFixed(1)},${(y+h/2+1.5).toFixed(1)} ${x+0+w-0.1}-0,${(y+h/2-1).toFixed(1)}" fill="none" stroke="#6b7280" stroke-width="0.5"/>`;
    }

    case 'checkbox': {
      const size = Math.min(w, h);
      const bg = sanitizeColor(style.backgroundColor) || '#ffffff';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${bg}" stroke="#9ca3af" stroke-width="0.5" rx="1"/>`;
    }

    case 'toggle': {
      const rx = (h * scale / 2).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" rx="${rx}"/>
      <circle cx="${(x + h/2).toFixed(1)}" cy="${(y + h/2).toFixed(1)}" r="${(h * 0.35).toFixed(1)}" fill="#ffffff"/>`;
    }

    case 'datepicker': {
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.4" rx="1.5"/>
      <rect x="${(x+w-h).toFixed(1)}" y="${y.toFixed(1)}" width="${h.toFixed(1)}" height="${h.toFixed(1)}" fill="#f3f4f6" stroke="none"/>`;
    }

    case 'navbar': {
      const navFill = sanitizeColor(style.backgroundColor) || '#ffffff';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${navFill}" stroke="#e5e7eb" stroke-width="0.3"/>`;
    }

    case 'sidebar': {
      const sideFill = sanitizeColor(style.backgroundColor) || '#f9fafb';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${sideFill}" stroke="#e5e7eb" stroke-width="0.3"/>`;
    }

    case 'divider': {
      return `<line x1="${x.toFixed(1)}" y1="${(y + h/2).toFixed(1)}" x2="${(x+w).toFixed(1)}" y2="${(y + h/2).toFixed(1)}" stroke="#e5e7eb" stroke-width="${Math.max(0.3, h * scale * 0.3).toFixed(1)}"/>`;
    }

    case 'badge':
    case 'tag': {
      const displayText = content || 'Badge';
      const scaledFontSize = Math.max(3, (fontSize || 10) * scale);
      const rx = (h / 2).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" rx="${rx}"/>
      <text x="${(x + w/2).toFixed(1)}" y="${(y + h * 0.7).toFixed(1)}" font-size="${scaledFontSize.toFixed(1)}" fill="${textColor}" text-anchor="middle" font-family="sans-serif" font-weight="600">${escapeXml(truncate(displayText, 10))}</text>`;
    }

    case 'progress': {
      const bg = '#e5e7eb';
      const val = Math.max(0, Math.min(100, props.value || 50));
      const fillColor = sanitizeColor(style.backgroundColor) || '#16a34a';
      const rx = Math.min(h / 2, 3).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${bg}" rx="${rx}"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w * val / 100).toFixed(1)}" height="${h.toFixed(1)}" fill="${fillColor}" rx="${rx}"/>`;
    }

    case 'alert': {
      const alertFill = sanitizeColor(style.backgroundColor) || '#fef3c7';
      const alertStroke = sanitizeColor(style.borderColor) || '#fbbf24';
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '2';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${alertFill}" stroke="${alertStroke}" stroke-width="0.4" rx="${rx}"/>`;
    }

    case 'card':
    case 'section':
    case 'modal':
    case 'container': {
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '2';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(0.3, borderWidth * scale).toFixed(1)}" rx="${rx}"/>`;
    }

    case 'table': {
      const rx = '1';
      let rows = '';
      const rowH = h / 4;
      for (let i = 1; i < 4; i++) {
        rows += `<line x1="${x.toFixed(1)}" y1="${(y + rowH * i).toFixed(1)}" x2="${(x+w).toFixed(1)}" y2="${(y + rowH * i).toFixed(1)}" stroke="#e5e7eb" stroke-width="0.3"/>`;
      }
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.4" rx="${rx}"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${rowH.toFixed(1)}" fill="#f9fafb" stroke="none"/>${rows}`;
    }

    case 'rectangle':
    default: {
      const rx = borderRadius > 0 ? (borderRadius * scale).toFixed(1) : '1';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(0.3, borderWidth * scale).toFixed(1)}" rx="${rx}"/>`;
    }
  }
}

function getDefaultFill(type: string): string {
  switch (type) {
    case 'rectangle': return '#93c5fd';
    case 'circle':    return '#86efac';
    case 'button':    return '#16a34a';
    case 'navbar':
    case 'sidebar':
    case 'input':
    case 'textfield':
    case 'textarea':
    case 'dropdown':  return '#ffffff';
    case 'text':
    case 'label':     return 'transparent';
    default:          return '#ffffff';
  }
}

function getDefaultTextColor(type: string): string {
  if (type === 'button') return '#ffffff';
  if (type === 'label')  return '#64748b';
  return '#333333';
}

function parsePx(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const match = String(v).match(/^(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function textAnchorFor(align: string | undefined): 'start' | 'middle' | 'end' {
  if (align === 'center') return 'middle';
  if (align === 'right')  return 'end';
  return 'start';
}

function sanitizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'transparent') return 'transparent';
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgb\(/.test(trimmed) || /^rgba\(/.test(trimmed)) return trimmed;
  const named = ['white','black','red','green','blue','gray','grey','yellow','orange','purple','pink','none'];
  if (named.includes(trimmed.toLowerCase())) return trimmed.toLowerCase();
  return null;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function emptyFrameSvg(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="0.5" rx="2"/>
    <text x="${w/2}" y="${h/2}" font-size="10" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">Empty frame</text>
  </svg>`;
}
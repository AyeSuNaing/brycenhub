import {
  Component, OnInit, AfterViewInit,
  ChangeDetectorRef, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export interface DbTable {
  id: number;
  projectId: number;
  frameName: string;
  tableName: string;
  columns: string;
  description: string;
}

export interface ParsedColumn {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
}

export interface TableNode {
  table: DbTable;
  columns: ParsedColumn[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FkLine {
  x1: number; y1: number;
  x2: number; y2: number;
  path: string;
  // ── Relationship metadata ──
  fromTable: string;
  fromColumn: string;
  toTable: string;
  cardinality: string;     // e.g. "N:1"
  // ── Midpoint for cardinality badge ──
  midX: number;
  midY: number;
}

// ── Layout constants ──
const CARD_W     = 230;
const COL_H      = 28;
const HEADER_H   = 48;
const CARD_PAD   = 20;
const GAP_X      = 80;
const GAP_Y      = 60;
const CANVAS_PAD = 100;

@Component({
  selector: 'app-db-schema',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './db-schema.html',
  styleUrl: './db-schema.scss'
})
export class DbSchemaComponent implements OnInit, AfterViewInit {

  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLDivElement>;

  projectId!: number;
  projectName = 'Project';
  loading = true;
  tables: DbTable[] = [];
  tableNodes: TableNode[] = [];
  fkLines: FkLine[] = [];

  svgWidth  = 4000;
  svgHeight = 3000;

  zoom = 1;
  panX = 60;
  panY = 60;

  // ── Hover highlight state ──
  hoveredTable: string | null = null;
  relatedTables: Set<string> = new Set();

  private panning = false;
  private panStart: { x: number; y: number } | null = null;
  private draggingNode: TableNode | null = null;
  private dragOffset: { x: number; y: number } | null = null;
  private rafId: number | null = null;

  readonly Math = Math;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = Number(params['projectId']);
      this.loadProjectName();
      this.loadTables();
    });
  }

  ngAfterViewInit(): void {}

  private loadProjectName(): void {
    this.http.get<any>(
      `${environment.apiBaseUrl}/projects/${this.projectId}`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: p => { this.projectName = p.title || 'Project'; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private loadTables(): void {
    this.loading = true;
    this.http.get<DbTable[]>(
      `${environment.apiBaseUrl}/project-design/${this.projectId}/db-tables`,
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: data => {
        this.tables = data || [];
        this.buildNodes();
        this.buildFkLines();
        this.updateCanvasSize();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // SMART AUTO-LAYOUT (unchanged)
  // ══════════════════════════════════════════════════════════════════

  private buildNodes(): void {
    if (this.tables.length === 0) {
      this.tableNodes = [];
      return;
    }

    const parsedTables = this.tables.map(t => ({
      table: t,
      columns: this.parseColumns(t.columns),
    }));

    const tableMap = new Map<string, typeof parsedTables[0]>();
    parsedTables.forEach(pt => tableMap.set(pt.table.tableName.toLowerCase(), pt));

    const adjacency = new Map<string, Set<string>>();
    parsedTables.forEach(pt => {
      const name = pt.table.tableName.toLowerCase();
      if (!adjacency.has(name)) adjacency.set(name, new Set());

      pt.columns.forEach(col => {
        if (!col.isFk) return;
        const refName = this.resolveTableName(col.name, parsedTables);
        if (!refName) return;
        adjacency.get(name)!.add(refName);
        if (!adjacency.has(refName)) adjacency.set(refName, new Set());
        adjacency.get(refName)!.add(name);
      });
    });

    const visited = new Set<string>();
    const clusters: string[][] = [];

    parsedTables.forEach(pt => {
      const name = pt.table.tableName.toLowerCase();
      if (visited.has(name)) return;

      const cluster: string[] = [];
      const queue: string[] = [name];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        cluster.push(cur);
        const neighbors = adjacency.get(cur);
        if (neighbors) neighbors.forEach(n => { if (!visited.has(n)) queue.push(n); });
      }
      clusters.push(cluster);
    });

    clusters.sort((a, b) => b.length - a.length);

    const total = parsedTables.length;
    const COLS = total <= 4 ? 2
              : total <= 9 ? 3
              : total <= 16 ? 4
              : 5;

    const orderedNames: string[] = [];
    clusters.forEach(cluster => orderedNames.push(...cluster));

    this.tableNodes = orderedNames.map((name, i) => {
      const pt = tableMap.get(name)!;
      const h = HEADER_H + Math.max(pt.columns.length, 1) * COL_H + CARD_PAD;

      const col = i % COLS;
      const row = Math.floor(i / COLS);

      return {
        table:   pt.table,
        columns: pt.columns,
        x: 60 + col * (CARD_W + GAP_X),
        y: 60 + row * (this.estimateRowHeight(orderedNames, row, COLS, tableMap) + GAP_Y),
        width:   CARD_W,
        height:  h,
      };
    });
  }

  private estimateRowHeight(
    names: string[], row: number, cols: number,
    tableMap: Map<string, { table: DbTable; columns: ParsedColumn[] }>
  ): number {
    let maxH = HEADER_H + COL_H + CARD_PAD;
    for (let c = 0; c < cols; c++) {
      const idx = row * cols + c;
      if (idx >= names.length) break;
      const pt = tableMap.get(names[idx]);
      if (!pt) continue;
      const h = HEADER_H + Math.max(pt.columns.length, 1) * COL_H + CARD_PAD;
      if (h > maxH) maxH = h;
    }
    return maxH;
  }

  private resolveTableName(
    colName: string,
    parsedTables: { table: DbTable; columns: ParsedColumn[] }[]
  ): string | null {
    if (!colName.endsWith('_id') || colName === 'id') return null;
    const base = colName.slice(0, -3).toLowerCase();
    const candidates = [base, base + 's'];
    if (base.endsWith('y')) candidates.push(base.slice(0, -1) + 'ies');
    if (base.endsWith('s') || base.endsWith('x') ||
        base.endsWith('ch') || base.endsWith('sh')) {
      candidates.push(base + 'es');
    }
    for (const c of candidates) {
      const match = parsedTables.find(
        pt => pt.table.tableName.toLowerCase() === c
      );
      if (match) return match.table.tableName.toLowerCase();
    }
    const loose = parsedTables.find(
      pt => pt.table.tableName.toLowerCase().startsWith(base)
    );
    return loose ? loose.table.tableName.toLowerCase() : null;
  }

  private updateCanvasSize(): void {
    if (this.tableNodes.length === 0) {
      this.svgWidth  = 2000;
      this.svgHeight = 1500;
      return;
    }
    let maxX = 0, maxY = 0;
    for (const node of this.tableNodes) {
      if (node.x + node.width > maxX) maxX = node.x + node.width;
      if (node.y + node.height > maxY) maxY = node.y + node.height;
    }
    this.svgWidth  = Math.max(2000, maxX + CANVAS_PAD);
    this.svgHeight = Math.max(1500, maxY + CANVAS_PAD);
  }

  // ══════════════════════════════════════════════════════════════════
  // COLUMN PARSING (unchanged)
  // ══════════════════════════════════════════════════════════════════

  parseColumns(columnsStr: string): ParsedColumn[] {
    if (!columnsStr) return [];
    try {
      const parsed = JSON.parse(columnsStr);
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => {
          const name = c.name || c.column_name || '';
          const type = (c.type || c.data_type || '').toLowerCase();
          return {
            name,
            type,
            isPk: name === 'id' || (c.key || '').toUpperCase().includes('PK'),
            isFk: name.endsWith('_id') && name !== 'id'
          };
        });
      }
    } catch {}

    return columnsStr.split(',').map(part => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      const tokens = trimmed.split(/\s+/);
      const name = tokens[0] || '';
      const type = (tokens[1] || '').toLowerCase()
        .replace(/\(.*\)/, '')
        .replace(/not/i, '')
        .trim();
      const upper = trimmed.toUpperCase();
      return {
        name,
        type: type || 'varchar',
        isPk: upper.includes('PK') || upper.includes('PRIMARY') || name === 'id',
        isFk: upper.includes('FK') || upper.includes('FOREIGN') ||
              (name.endsWith('_id') && name !== 'id')
      };
    }).filter((c): c is ParsedColumn => c !== null && c.name.length > 0);
  }

  // ══════════════════════════════════════════════════════════════════
  // ✅ FK LINE BUILDER — with cardinality + midpoint for badge
  // ══════════════════════════════════════════════════════════════════

  private buildFkLines(): void {
    this.fkLines = [];

    for (const node of this.tableNodes) {
      for (let i = 0; i < node.columns.length; i++) {
        const col = node.columns[i];
        if (!col.isFk) continue;

        const refNode = this.findReferencedTable(col.name);
        if (!refNode) continue;
        if (refNode === node) continue;

        // Exact column-row Y center
        const srcColY = node.y + HEADER_H + i * COL_H + COL_H / 2;
        const pkIndex = refNode.columns.findIndex(c => c.isPk);
        const targetRowIndex = pkIndex >= 0 ? pkIndex : 0;
        const tgtColY = refNode.y + HEADER_H + targetRowIndex * COL_H + COL_H / 2;

        // Nearest edges
        const srcCenterX = node.x + node.width / 2;
        const tgtCenterX = refNode.x + refNode.width / 2;
        const srcIsLeftOfTgt = srcCenterX < tgtCenterX;

        const x1 = srcIsLeftOfTgt ? node.x + node.width : node.x;
        const y1 = srcColY;
        const x2 = srcIsLeftOfTgt ? refNode.x : refNode.x + refNode.width;
        const y2 = tgtColY;

        // Horizontal tangent bezier
        const dx = Math.abs(x2 - x1);
        const reach = Math.max(Math.min(dx * 0.5, 80), 30);
        const cx1 = srcIsLeftOfTgt ? x1 + reach : x1 - reach;
        const cy1 = y1;
        const cx2 = srcIsLeftOfTgt ? x2 - reach : x2 + reach;
        const cy2 = y2;

        const path = `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;

        // Midpoint for cardinality badge (bezier t=0.5 approximation)
        const midX = (x1 + 3 * cx1 + 3 * cx2 + x2) / 8;
        const midY = (y1 + 3 * cy1 + 3 * cy2 + y2) / 8;

        this.fkLines.push({
          x1, y1, x2, y2, path,
          fromTable:   node.table.tableName,
          fromColumn:  col.name,
          toTable:     refNode.table.tableName,
          cardinality: 'N:1',   // FK default → many-to-one
          midX, midY,
        });
      }
    }
  }

  private findReferencedTable(colName: string): TableNode | null {
    if (!colName.endsWith('_id') || colName === 'id') return null;
    const base = colName.slice(0, -3).toLowerCase();
    const candidates: string[] = [base, base + 's'];
    if (base.endsWith('y')) candidates.push(base.slice(0, -1) + 'ies');
    if (base.endsWith('s') || base.endsWith('x') ||
        base.endsWith('ch') || base.endsWith('sh')) {
      candidates.push(base + 'es');
    }
    for (const candidate of candidates) {
      const match = this.tableNodes.find(
        n => n.table.tableName.toLowerCase() === candidate
      );
      if (match) return match;
    }
    const looseMatch = this.tableNodes.find(
      n => n.table.tableName.toLowerCase().startsWith(base)
    );
    return looseMatch || null;
  }

  isIdCol(col: ParsedColumn): boolean { return col.isPk; }
  isFkCol(col: ParsedColumn): boolean { return col.isFk; }

  // ══════════════════════════════════════════════════════════════════
  // ✅ HOVER HIGHLIGHT — show related tables + fade others
  // ══════════════════════════════════════════════════════════════════

  onTableHover(tableName: string): void {
    this.hoveredTable = tableName;
    this.relatedTables.clear();

    // Find all tables connected via FK to hovered table (both directions)
    for (const line of this.fkLines) {
      if (line.fromTable === tableName) this.relatedTables.add(line.toTable);
      if (line.toTable === tableName)   this.relatedTables.add(line.fromTable);
    }
    this.relatedTables.add(tableName);  // include self
    this.cdr.detectChanges();
  }

  onTableLeave(): void {
    this.hoveredTable = null;
    this.relatedTables.clear();
    this.cdr.detectChanges();
  }

  /** Is this table dimmed? (hovering active AND not in related set) */
  isTableDimmed(tableName: string): boolean {
    return this.hoveredTable !== null && !this.relatedTables.has(tableName);
  }

  /** Is this table the hover target? */
  isTableHovered(tableName: string): boolean {
    return this.hoveredTable === tableName;
  }

  /** Is this FK line faded? (hover active AND not involving hovered table) */
  isLineDimmed(line: FkLine): boolean {
    if (!this.hoveredTable) return false;
    return line.fromTable !== this.hoveredTable &&
           line.toTable   !== this.hoveredTable;
  }

  // ══════════════════════════════════════════════════════════════════
  // PAN / ZOOM / DRAG (unchanged throttled version)
  // ══════════════════════════════════════════════════════════════════

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.3, Math.min(2, this.zoom * factor));
    } else {
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
    }
  }

  onCanvasDown(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('.erd-card')) return;
    this.panning = true;
    this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
  }

  onMouseMove(e: MouseEvent): void {
    if (this.panning && this.panStart) {
      this.panX = e.clientX - this.panStart.x;
      this.panY = e.clientY - this.panStart.y;
      return;
    }
    if (this.draggingNode && this.dragOffset) {
      this.draggingNode.x = (e.clientX - this.panX) / this.zoom - this.dragOffset.x;
      this.draggingNode.y = (e.clientY - this.panY) / this.zoom - this.dragOffset.y;

      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(() => {
          this.buildFkLines();
          this.updateCanvasSize();
          this.cdr.detectChanges();
          this.rafId = null;
        });
      }
    }
  }

  onMouseUp(): void {
    this.panning = false;
    this.panStart = null;
    this.draggingNode = null;
    this.dragOffset = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  onCardDown(e: MouseEvent, node: TableNode): void {
    e.stopPropagation();
    this.draggingNode = node;
    this.dragOffset = {
      x: (e.clientX - this.panX) / this.zoom - node.x,
      y: (e.clientY - this.panY) / this.zoom - node.y
    };
  }

  zoomIn(): void  { this.zoom = Math.min(2, this.zoom + 0.15); }
  zoomOut(): void { this.zoom = Math.max(0.3, this.zoom - 0.15); }

  zoomToFit(): void {
    if (this.tableNodes.length === 0) return;
    const canvasEl = this.canvasEl?.nativeElement;
    if (!canvasEl) return;

    const vw = canvasEl.clientWidth;
    const vh = canvasEl.clientHeight;

    const zoomX = (vw - 40) / this.svgWidth;
    const zoomY = (vh - 40) / this.svgHeight;
    this.zoom = Math.max(0.3, Math.min(1.5, Math.min(zoomX, zoomY)));
    this.panX = 20;
    this.panY = 20;
    this.cdr.detectChanges();
  }

  resetLayout(): void {
    this.buildNodes();
    this.buildFkLines();
    this.updateCanvasSize();
    this.panX = 60;
    this.panY = 60;
    this.zoom = 1;
    this.cdr.detectChanges();
  }

  goBack(): void { history.back(); }
}
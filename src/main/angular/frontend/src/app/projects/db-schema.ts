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
}

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
  svgWidth = 4000;
  svgHeight = 3000;

  zoom = 1;
  panX = 60;
  panY = 60;

  private panning = false;
  private panStart: { x: number; y: number } | null = null;
  private draggingNode: TableNode | null = null;
  private dragOffset: { x: number; y: number } | null = null;

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
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  private buildNodes(): void {
    const CARD_W   = 210;
    const COL_H    = 32;
    const HEADER_H = 44;
    const FOOTER_H = 28;
    const GAP_X    = 80;
    const GAP_Y    = 60;
    const COLS     = 3;

    this.tableNodes = this.tables.map((table, i) => {
      const cols = this.parseColumns(table.columns);
      const h = HEADER_H + FOOTER_H + Math.max(cols.length, 1) * COL_H + 16;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        table,
        columns: cols,
        x: 60 + col * (CARD_W + GAP_X),
        y: 60 + row * (h + GAP_Y),
        width: CARD_W,
        height: h
      };
    });
  }

  parseColumns(columnsJson: string): ParsedColumn[] {
    if (!columnsJson) return [];
    try {
      const parsed = JSON.parse(columnsJson);
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => ({
          name: c.name || c.column_name || '',
          type: (c.type || c.data_type || '').toLowerCase()
        }));
      }
    } catch {}
    return [];
  }

  private buildFkLines(): void {
    this.fkLines = [];
    for (const node of this.tableNodes) {
      for (const col of node.columns) {
        if (col.name.endsWith('_id') && col.name !== 'id') {
          const refTableName = col.name.replace('_id', '');
          const refNode = this.tableNodes.find(n => n.table.tableName === refTableName);
          if (refNode) {
            this.fkLines.push({
              x1: node.x + node.width,
              y1: node.y + 44,
              x2: refNode.x,
              y2: refNode.y + 44
            });
          }
        }
      }
    }
  }

  isIdCol(name: string): boolean { return name === 'id'; }
  isFkCol(name: string): boolean { return name.endsWith('_id') && name !== 'id'; }

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
      this.buildFkLines();
      this.cdr.detectChanges();
    }
  }

  onMouseUp(): void {
    this.panning = false;
    this.panStart = null;
    this.draggingNode = null;
    this.dragOffset = null;
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

  resetLayout(): void {
    this.buildNodes();
    this.buildFkLines();
    this.panX = 60;
    this.panY = 60;
    this.zoom = 1;
  }

  goBack(): void { history.back(); }
}
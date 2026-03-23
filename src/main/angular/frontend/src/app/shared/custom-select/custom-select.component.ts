import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  id:           number | string;
  label:        string;        // display text
  color?:       string;        // role/dept badge color (hex)
  badgeLabel?:  string;        // e.g. "PM", "DEV"
  icon?:        string;        // emoji or icon string
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-select-wrapper" (click)="$event.stopPropagation()">

      <!-- Trigger -->
      <div
        class="custom-select-trigger"
        [class.open]="isOpen"
        [class.placeholder-shown]="selectedOption == null"
        (click)="toggle()"
        tabindex="0"
        (keydown.enter)="toggle()"
        (keydown.space)="toggle()"
        (keydown.escape)="close()">

        <!-- Selected value -->
        <ng-container *ngIf="selectedOption; else placeholderTpl">
          <!-- Color dot if role/dept has color -->
          <span *ngIf="selectedOption.color"
            class="role-dot"
            [style.background]="selectedOption.color">
          </span>
          <!-- Badge -->
          <span *ngIf="selectedOption.badgeLabel"
            class="role-badge-mini"
            [style.background]="(selectedOption.color || '#64748b') + '22'"
            [style.color]="selectedOption.color || '#64748b'">
            {{ selectedOption.badgeLabel }}
          </span>
          <!-- Label -->
          <span>{{ selectedOption.label }}</span>
        </ng-container>

        <ng-template #placeholderTpl>
          <span>{{ placeholder }}</span>
        </ng-template>

        <!-- Arrow -->
        <span class="custom-select-arrow" [class.rotated]="isOpen">▾</span>
      </div>

      <!-- Dropdown -->
      <div *ngIf="isOpen" class="custom-select-dropdown">
        <!-- Placeholder option -->
        <div class="custom-select-option"
          [class.selected]="value == null"
          (click)="selectItem(null)">
          <span style="opacity:0.4;font-style:italic;">{{ placeholder }}</span>
          <span *ngIf="value == null" class="check-mark">✓</span>
        </div>

        <!-- Options -->
        <div *ngFor="let opt of options"
          class="custom-select-option"
          [class.selected]="value == opt.id"
          (click)="selectItem(opt)">

          <!-- Color dot -->
          <span *ngIf="opt.color"
            class="role-dot"
            [style.background]="opt.color">
          </span>

          <!-- Badge -->
          <span *ngIf="opt.badgeLabel"
            class="role-badge-mini"
            [style.background]="(opt.color || '#64748b') + '22'"
            [style.color]="opt.color || '#64748b'">
            {{ opt.badgeLabel }}
          </span>

          <!-- Label -->
          <span>{{ opt.label }}</span>

          <!-- Check mark if selected -->
          <span *ngIf="value == opt.id" class="check-mark">✓</span>
        </div>

        <!-- Empty state -->
        <div *ngIf="options.length === 0"
          style="padding:12px 10px;font-size:11px;opacity:0.4;text-align:center;">
          No options available
        </div>
      </div>

    </div>
  `
})
export class CustomSelectComponent implements OnChanges {

  @Input() options:     SelectOption[] = [];
  @Input() value:       number | string | null = null;
  @Input() placeholder: string = 'Select...';
  @Output() valueChange = new EventEmitter<number | string | null>();

  isOpen = false;
  selectedOption: SelectOption | null = null;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] || changes['options']) {
      this.syncSelected();
    }
  }

  syncSelected() {
    if (this.value == null) {
      this.selectedOption = null;
    } else {
      this.selectedOption = this.options.find(o => o.id == this.value) || null;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  selectItem(opt: SelectOption | null) {
    this.value = opt ? opt.id : null;
    this.selectedOption = opt;
    this.valueChange.emit(this.value);
    this.isOpen = false;
  }

  // Close when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}

import {
  OnDestroy,
  Component,
  Input,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';

@Component({
  selector: 'app-clipboard',
  templateUrl: './clipboard.component.html',
  styleUrls: ['./clipboard.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipboardComponent implements OnDestroy {
  private pendingTimeout: ReturnType<typeof setTimeout> | undefined;
  @Input() button = false;
  @Input() class = 'btn btn-secondary ms-1';
  @Input() size: 'small' | 'normal' | 'large' = 'normal';
  @Input() text: string;
  @Input() leftPadding = true;
  private destroyed = false;
  copiedMessage: string = $localize`:@@clipboard.copied-message:Copied!`;
  showMessage = false;

  widths = {
    small: '10',
    normal: '13',
    large: '18',
  };

  constructor(private cd: ChangeDetectorRef) {}

  async copyText() {
    if (!this.destroyed && this.text && !this.showMessage) {
      try {
        await this.copyToClipboard(this.text);
        if (this.destroyed) return;
        this.showMessage = true;
        this.cd.markForCheck();
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = setTimeout(() => {
          this.showMessage = false;
          this.cd.markForCheck();
        }, 1000);
      } catch (error) {
        console.error('Clipboard copy failed:', error);
      }
    }
  }

  async copyToClipboard(text: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      // Use the 'out of viewport hidden text area' trick on non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = this.text;
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', 'true'); // Don't trigger keyboard on mobile
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.pendingTimeout);
  }
}

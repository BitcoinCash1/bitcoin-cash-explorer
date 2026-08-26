import { Component, Input } from '@angular/core';
import { BcmrMetadata } from '@app/interfaces/bcmr-api.interface';
import { resolveBcmrIconUrl } from '@app/shared/bcmr.utils';

@Component({
  selector: 'app-token-icon-and-text',
  templateUrl: './token-icon-and-text.component.html',
  styleUrls: ['./token-icon-and-text.component.scss'],
  standalone: false,
})
export class TokenIconAndTextComponent {
  @Input() metadata: BcmrMetadata | undefined;
  @Input() category: string | null;

  resolveIconUrl(icon?: string): string | null {
    return resolveBcmrIconUrl(icon);
  }
}

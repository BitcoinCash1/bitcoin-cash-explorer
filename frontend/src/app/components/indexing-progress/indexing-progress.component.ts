import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-indexing-progress',
  templateUrl: './indexing-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class IndexingProgressComponent {
  constructor() {}
}

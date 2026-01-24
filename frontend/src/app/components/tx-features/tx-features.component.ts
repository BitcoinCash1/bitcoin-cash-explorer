import {
  Component,
  ChangeDetectionStrategy,
  OnChanges,
  Input,
} from '@angular/core';
import { Transaction } from '@app/interfaces/backend-api.interface';

@Component({
  selector: 'app-tx-features',
  templateUrl: './tx-features.component.html',
  styleUrls: ['./tx-features.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxFeaturesComponent implements OnChanges {
  @Input() tx: Transaction;

  isCheap: boolean;

  ngOnChanges() {
    if (!this.tx) {
      return;
    }
    this.isCheap = this.tx.feePerSize < 10.0;
  }
}

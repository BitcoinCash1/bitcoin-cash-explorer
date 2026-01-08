import {
  Component,
  ChangeDetectionStrategy,
  OnChanges,
  Input,
} from '@angular/core';
// import { isFeatureActive } from '@app/bitcoin.utils';
import { Transaction } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-tx-features',
  templateUrl: './tx-features.component.html',
  styleUrls: ['./tx-features.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxFeaturesComponent implements OnChanges {
  @Input() tx: Transaction;

  constructor(private stateService: StateService) {}

  ngOnChanges() {
    if (!this.tx) {
      return;
    }
    // this.someFeature = this.tx.status... || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'someFeature')
  }
}

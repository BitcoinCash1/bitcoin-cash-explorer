import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { BcmrService } from '@app/services/bcmr.service';
import { BcmrMetadata } from '@app/interfaces/bcmr-api.interface';
import { Observable, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-token-details',
  templateUrl: './token-details.component.html',
  styleUrls: ['./token-details.component.scss'],
  standalone: false,
})
export class TokenDetailsComponent implements OnInit, OnDestroy {
  category: string;
  metadata: BcmrMetadata | null = null;
  isLoading = true;
  error: any = null;
  network = '';
  networkChangeSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private bcmrService: BcmrService,
    private seoService: SeoService,
    private stateService: StateService
  ) {}

  ngOnInit(): void {
    this.network = this.stateService.network;
    this.networkChangeSubscription = this.stateService.networkChanged$.subscribe(
      (network) => {
        this.network = network;
      }
    );

    this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.category = params.get('category') || '';
          this.isLoading = true;
          this.error = null;
          this.metadata = null;

          if (!this.category) {
            this.error = { message: 'Token category is required' };
            this.isLoading = false;
            return of(null);
          }

          this.seoService.setTitle(
            `Token: ${this.category}`
          );
          this.seoService.setDescription(
            `View details for Bitcoin Cash token ${this.category} including name, symbol, decimals, description and more.`
          );

          return this.bcmrService.getBcmrMetadata(this.category).pipe(
            catchError((err) => {
              this.error = err;
              this.isLoading = false;
              console.error('Error fetching token metadata:', err);
              return of(null);
            })
          );
        })
      )
      .subscribe((metadata: BcmrMetadata | null) => {
        this.metadata = metadata;
        this.isLoading = false;

        if (!metadata) {
          this.error = { message: 'Token metadata not found' };
        }
      });
  }

  ngOnDestroy(): void {
    this.networkChangeSubscription?.unsubscribe();
  }

  getTokenInfo(): any {
    if (!this.metadata || !this.category) {
      return null;
    }

    return {
      category: this.category,
      name: this.metadata.name || 'Unknown',
      symbol: this.metadata.token?.symbol || 'N/A',
      decimals: this.metadata.token?.decimals !== undefined ? this.metadata.token.decimals : 'N/A',
      description: this.metadata.description || 'No description available',
      uris: this.metadata.uris || {},
      hasIcon: !!(this.metadata.uris?.icon),
      hasWebsite: !!(this.metadata.uris?.web),
      hasDescription: !!this.metadata.description,
      isNft: this.metadata.is_nft || false,
      status: this.metadata.status || 'unknown'
    };
  }

  private readonly IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

  resolveIconUrl(icon?: string): string | null {
    if (!icon) return null;
    if (icon.startsWith('ipfs://')) {
      return this.IPFS_GATEWAY + icon.slice('ipfs://'.length);
    }
    return icon; // http(s) already fine
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-success';
      case 'burned':
        return 'bg-danger';
      case 'inactive':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  getAdditionalUris(uris: any): Array<{key: string, value: string}> {
    const excludedKeys = ['icon', 'web'];
    return Object.entries(uris)
      .filter(([key]) => !excludedKeys.includes(key))
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  hasAdditionalUris(uris: any): boolean {
    const excludedKeys = ['icon', 'web'];
    return Object.entries(uris).some(([key]) => !excludedKeys.includes(key));
  }
}

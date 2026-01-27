import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BcmrMetadata } from '@app/interfaces/bcmr-api.interface';
import { StateService } from '@app/services/state.service';

interface CacheEntry {
  data: BcmrMetadata;
  expiry: number;
}

@Injectable({
  providedIn: 'root',
})
export class BcmrService {
  private cache: { [category: string]: CacheEntry } = {};
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService
  ) {}

  /**
   * Retrieve BCMR metadata details from a token id (from both FTs and NFTs).
   *
   * @param category Cash token id (hex). eg. b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366
   */
  getBcmrMetadata(category: string): Observable<BcmrMetadata> {
    // Clean expired cache entries first
    this.cleanExpiredCache();

    // Check cache
    const cachedEntry = this.cache[category];
    if (cachedEntry) {
      return of(cachedEntry.data);
    }

    // If not in cache, fetch from API and cache the result
    // also set responseType: 'json'
    const httpOptions = { headers: { 'User-Agent': 'BCHExplorer/3.3' } };
    return this.httpClient
      .get<BcmrMetadata>(
        `${this.stateService.env.BCMR_API}/tokens/${encodeURIComponent(category)}`,
        httpOptions
      )
      .pipe(
        tap((data) => {
          // Save to cache
          this.setCache(category, data);
        })
      );
  }

  /**
   * Store BCMR metadata in cache
   * @param category Token category
   * @param data BCMR metadata to cache
   */
  private setCache(category: string, data: BcmrMetadata): void {
    this.cache[category] = {
      data,
      expiry: Date.now() + this.CACHE_DURATION,
    };
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const category of Object.keys(this.cache)) {
      if (this.cache[category].expiry <= now) {
        delete this.cache[category];
      }
    }
  }
}

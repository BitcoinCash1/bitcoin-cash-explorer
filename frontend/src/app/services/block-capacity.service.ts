import type { NetworkSettings } from '@interfaces/websocket.interface';
import { Injectable } from '@angular/core';
import { validBlockLimit } from '@app/shared/block-capacity';

@Injectable({ providedIn: 'root' })
export class BlockCapacityService {
  private settings = new Map<string, Readonly<NetworkSettings>>();
  private key = '';
  private network = 'mainnet';
  private live: number | null = null;

  activate(network: string, origin: string): void {
    this.network = network || 'mainnet';
    this.key = JSON.stringify([origin, this.network]);
    this.live = null;
  }

  acceptSettings(settings: NetworkSettings): boolean {
    if (
      !settings ||
      settings.network !== this.network ||
      !validBlockLimit(settings.minimumBlockSize)
    )
      return false;
    this.settings.set(this.key, Object.freeze({ ...settings }));
    return true;
  }

  get baseline(): number | null {
    return this.settings.get(this.key)?.minimumBlockSize ?? null;
  }
  get projection(): number | null {
    return this.live ?? this.baseline;
  }
  updateProjection(limit: unknown): void {
    if (validBlockLimit(limit)) this.live = limit;
  }
}

import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';

export const GUARDIAN_DOCUMENT_REQUIRED =
  'proof-of-work challenge requires a same-origin document request';

const GUARDIAN_RELOAD_PENDING = 'guardian-challenge-reload-pending';
const GUARDIAN_RELOAD_COOLDOWN_MS = 30_000;

@Injectable()
export class GuardianChallengeInterceptor implements HttpInterceptor {
  private readonly isBrowser: boolean;
  private reloadInProgress = false;
  private officialBCHExplorer = false;

  constructor(
    private stateService: StateService,
    @Inject(PLATFORM_ID)
    platformId: Parameters<typeof isPlatformBrowser>[0],
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.officialBCHExplorer = this.stateService.env.OFFICIAL_BCH_EXPLORER;
  }

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Bypass the interceptor if the app is not running on the official BCH explorer, as Guardian challenges are only relevant in that context.
    if (!this.stateService.env.OFFICIAL_BCH_EXPLORER) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      tap((event) => {
        if (
          event instanceof HttpResponse &&
          !this.reloadInProgress &&
          this.isSameOrigin(request.url)
        ) {
          this.clearReloadPending();
        }
      }),
      catchError((error: unknown) => {
        if (
          this.isSameOrigin(request.url) &&
          this.isGuardianDocumentRefusal(error)
        ) {
          this.reloadCurrentDocument();
        }
        return throwError(() => error);
      })
    );
  }

  private isGuardianDocumentRefusal(
    error: unknown
  ): error is HttpErrorResponse {
    return (
      this.isBrowser &&
      error instanceof HttpErrorResponse &&
      error.status === 403 &&
      typeof error.error === 'string' &&
      error.error.trim() === GUARDIAN_DOCUMENT_REQUIRED
    );
  }

  private reloadCurrentDocument(): void {
    const window = this.document.defaultView;
    if (!window || this.reloadInProgress || this.reloadPending(window)) {
      return;
    }

    this.reloadInProgress = true;
    try {
      window.sessionStorage.setItem(
        GUARDIAN_RELOAD_PENDING,
        Date.now().toString()
      );
    } catch {
      // The in-memory flag still prevents concurrent failures from reloading.
    }
    // Reload the address-bar URL, not the failed API URL, so Guardian can
    // challenge a document and return the visitor to the same Angular route.
    window.location.reload();
  }

  private reloadPending(window: Window): boolean {
    try {
      const stored = window.sessionStorage.getItem(GUARDIAN_RELOAD_PENDING);
      if (stored === null) {
        return false;
      }
      const elapsed = Date.now() - Number(stored);
      return elapsed >= 0 && elapsed < GUARDIAN_RELOAD_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  private clearReloadPending(): void {
    const window = this.document.defaultView;
    if (!window) {
      return;
    }
    try {
      window.sessionStorage.removeItem(GUARDIAN_RELOAD_PENDING);
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }

  private isSameOrigin(requestUrl: string): boolean {
    const window = this.document.defaultView;
    if (!this.isBrowser || !window) {
      return false;
    }
    try {
      return (
        new URL(requestUrl, window.location.href).origin ===
        window.location.origin
      );
    } catch {
      return false;
    }
  }
}

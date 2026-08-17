import '@angular/compiler';

import {
  HttpErrorResponse,
  HttpHandler,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  GUARDIAN_DOCUMENT_REQUIRED,
  GuardianChallengeInterceptor,
} from './guardian-challenge.interceptor';
import { StateService } from './state.service';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function browserDocument(storage = new MemoryStorage()): {
  document: Document;
  reload: ReturnType<typeof vi.fn>;
  storage: MemoryStorage;
} {
  const reload = vi.fn();
  const window = {
    location: {
      href: 'https://bchexplorer.cash/block/123?details=1#transactions',
      origin: 'https://bchexplorer.cash',
      reload,
    },
    sessionStorage: storage,
  };
  return {
    document: { defaultView: window } as unknown as Document,
    reload,
    storage,
  };
}

function requestError(error: HttpErrorResponse): HttpHandler {
  return {
    handle: () => throwError(() => error),
  };
}

describe('GuardianChallengeInterceptor', () => {
  const request = new HttpRequest('GET', '/api/v1/init-data');

  it("reloads the current document for Guardian's XHR refusal", async () => {
    const browser = browserDocument();
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: `${GUARDIAN_DOCUMENT_REQUIRED}\n`,
      url: request.url,
    });

    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it.each([
    ['an application authorization error', { error: 'forbidden' }],
    [
      "Guardian's Accept heuristic refusal",
      'proof-of-work challenge requires a document navigation: Accept must list text/html or text/*',
    ],
    ['a generic Angie denial', '<html><body>403 Forbidden</body></html>'],
  ])('does not reload for %s', async (_description, responseBody) => {
    const browser = browserDocument();
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: responseBody,
      url: request.url,
    });

    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it('does not loop when the reloaded app is still refused', async () => {
    const storage = new MemoryStorage();
    storage.setItem('guardian-challenge-reload-pending', Date.now().toString());
    const browser = browserDocument(storage);
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: request.url,
    });

    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it('allows recovery again after the reload cooldown', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'guardian-challenge-reload-pending',
      (Date.now() - 30_001).toString()
    );
    const browser = browserDocument(storage);
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: request.url,
    });

    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it('reloads at most once when requests fail concurrently', async () => {
    const browser = browserDocument();
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: request.url,
    });

    await Promise.all([
      expect(
        firstValueFrom(interceptor.intercept(request, requestError(error)))
      ).rejects.toBe(error),
      expect(
        firstValueFrom(interceptor.intercept(request, requestError(error)))
      ).rejects.toBe(error),
    ]);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it('does not reload the site for a refusal from another origin', async () => {
    const browser = browserDocument();
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );
    const externalRequest = new HttpRequest(
      'GET',
      'https://services.example/api'
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: externalRequest.url,
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(externalRequest, requestError(error))
      )
    ).rejects.toBe(error);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it('clears the reload guard after a successful same-origin request', async () => {
    const storage = new MemoryStorage();
    storage.setItem('guardian-challenge-reload-pending', Date.now().toString());
    const browser = browserDocument(storage);
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'browser',
      browser.document
    );

    await firstValueFrom(
      interceptor.intercept(request, {
        handle: () => of(new HttpResponse({ status: 200 })),
      })
    );

    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: request.url,
    });
    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it('does not reload during server-side rendering', async () => {
    const browser = browserDocument();
    const mockStateService = {
      env: {
        OFFICIAL_BCH_EXPLORER: false
      }
    } as StateService;
    const interceptor = new GuardianChallengeInterceptor(
      mockStateService,
      'server',
      browser.document
    );
    const error = new HttpErrorResponse({
      status: 403,
      error: GUARDIAN_DOCUMENT_REQUIRED,
      url: request.url,
    });

    await expect(
      firstValueFrom(interceptor.intercept(request, requestError(error)))
    ).rejects.toBe(error);
    expect(browser.reload).not.toHaveBeenCalled();
  });
});

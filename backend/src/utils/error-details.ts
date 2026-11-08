// Never serialize the original error: RPC errors may carry request configuration.
export function safeErrorDetails(error: unknown): { name?: string; code?: string; message?: string } {
  const clean = (value: unknown, limit: number): string | undefined => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }
    return String(value)
      .replace(/[\p{Cc}\u2028\u2029]/gu, ' ')
      .replace(/\b[a-z][a-z\d+.-]*:\/\/\S+/gi, '[redacted URL]')
      .replace(/\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:Basic|Bearer)\s+\S+/gi, 'authorization=[redacted]')
      .replace(
        /(["']?\b(?:authorization|proxy-authorization|password|passwd|cookie|token|secret|api[_-]?key)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        '$1[redacted]'
      )
      .slice(0, limit);
  };
  if (!(error instanceof Error)) {
    return { name: 'UnknownError' };
  }
  return {
    name: clean(error.name, 64),
    code: clean((error as Error & { code?: unknown }).code, 64),
    message: clean(error.message, 256),
  };
}

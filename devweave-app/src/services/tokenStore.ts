let memoryAccessToken: string | null = null;
type TokenListener = (token: string | null) => void;
const listeners = new Set<TokenListener>();

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function setMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token;
  listeners.forEach((listener) => {
    try {
      listener(token);
    } catch (err) {
      console.error('[TokenStore] Error in token listener:', err);
    }
  });
}

export function subscribeMemoryAccessToken(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

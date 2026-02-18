import type { CookieConfig, StorageAdapter } from '../types';

export class CookieStorageAdapter implements StorageAdapter {
  protected readonly config: CookieConfig | undefined;

  constructor(config?: CookieConfig) {
    this.config = config;
  }

  get(_key: string): string | null {
    throw new Error('CookieStorageAdapter: not implemented');
  }

  set(_key: string, _value: string): void {
    throw new Error('CookieStorageAdapter: not implemented');
  }

  remove(_key: string): void {
    throw new Error('CookieStorageAdapter: not implemented');
  }

  clear(): void {
    throw new Error('CookieStorageAdapter: not implemented');
  }
}

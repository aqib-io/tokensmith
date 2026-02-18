import type { StorageAdapter } from '../types';

export class LocalStorageAdapter implements StorageAdapter {
  get(_key: string): string | null {
    throw new Error('LocalStorageAdapter: not implemented');
  }

  set(_key: string, _value: string): void {
    throw new Error('LocalStorageAdapter: not implemented');
  }

  remove(_key: string): void {
    throw new Error('LocalStorageAdapter: not implemented');
  }

  clear(): void {
    throw new Error('LocalStorageAdapter: not implemented');
  }
}

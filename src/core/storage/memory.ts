import type { StorageAdapter } from '../types';

export class MemoryStorageAdapter implements StorageAdapter {
  get(_key: string): string | null {
    throw new Error('MemoryStorageAdapter: not implemented');
  }

  set(_key: string, _value: string): void {
    throw new Error('MemoryStorageAdapter: not implemented');
  }

  remove(_key: string): void {
    throw new Error('MemoryStorageAdapter: not implemented');
  }

  clear(): void {
    throw new Error('MemoryStorageAdapter: not implemented');
  }
}

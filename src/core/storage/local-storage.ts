import { StorageError } from '../errors';
import type { StorageAdapter } from '../types';

const TS_KEY_PREFIX = 'tk_';

function resolveLocalStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new StorageError('localStorage is not available in this environment');
  }
  return localStorage;
}

export class LocalStorageAdapter implements StorageAdapter {
  get(key: string): string | null {
    try {
      return resolveLocalStorage().getItem(key);
    } catch {
      throw new StorageError(`localStorage read failed for key: ${key}`);
    }
  }

  set(key: string, value: string): void {
    try {
      resolveLocalStorage().setItem(key, value);
    } catch {
      throw new StorageError(`localStorage write failed for key: ${key}`);
    }
  }

  remove(key: string): void {
    try {
      resolveLocalStorage().removeItem(key);
    } catch {
      throw new StorageError(`localStorage remove failed for key: ${key}`);
    }
  }

  clear(): void {
    const storage = resolveLocalStorage();
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(TS_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  }
}

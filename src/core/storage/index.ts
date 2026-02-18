import type { StorageAdapter, StorageType, TokenManagerConfig } from '../types';
import { CookieStorageAdapter } from './cookie';
import { LocalStorageAdapter } from './local-storage';
import { MemoryStorageAdapter } from './memory';

export function createStorage(config: TokenManagerConfig): StorageAdapter {
  if (typeof config.storage === 'object') return config.storage;

  const type: StorageType = config.storage ?? 'cookie';

  switch (type) {
    case 'memory':
      return new MemoryStorageAdapter();
    case 'localStorage':
      return new LocalStorageAdapter();
    case 'cookie':
      return new CookieStorageAdapter(config.cookie);
  }
}

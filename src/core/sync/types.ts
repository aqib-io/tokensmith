import type { TokenPair } from '../types';

export type SyncEventType = 'TOKEN_SET' | 'TOKEN_CLEARED' | 'TOKEN_REFRESHED';

export interface SyncEvent {
  type: SyncEventType;
  tokens?: TokenPair;
}

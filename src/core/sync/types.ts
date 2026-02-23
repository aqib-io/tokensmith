export type SyncEventType = 'TOKEN_SET' | 'TOKEN_CLEARED' | 'TOKEN_REFRESHED';

export type SyncEvent =
  | { type: 'TOKEN_SET' }
  | { type: 'TOKEN_REFRESHED' }
  | { type: 'TOKEN_CLEARED' };

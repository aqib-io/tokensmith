export type SyncEvent =
  | { type: 'TOKEN_SET' }
  | { type: 'TOKEN_REFRESHED' }
  | { type: 'TOKEN_CLEARED' };

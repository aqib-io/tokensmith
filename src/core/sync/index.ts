import { SYNC_KEY } from '../constants';
import type { SyncEvent } from './types';

function parseSyncEvent(value: string): SyncEvent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      typeof (parsed as Record<string, unknown>).type === 'string'
    ) {
      return parsed as SyncEvent;
    }
    return null;
  } catch {
    return null;
  }
}

export class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private storageListener: ((event: StorageEvent) => void) | null = null;

  constructor(
    private readonly channelName: string,
    private readonly onSync: (event: SyncEvent) => void
  ) {}

  start(): void {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event: MessageEvent) => {
        this.onSync(event.data as SyncEvent);
      };
    } else {
      this.storageListener = (event: StorageEvent) => {
        if (event.key !== SYNC_KEY || !event.newValue) return;
        const syncEvent = parseSyncEvent(event.newValue);
        if (syncEvent !== null) this.onSync(syncEvent);
      };
      window.addEventListener('storage', this.storageListener);
    }
  }

  broadcast(event: SyncEvent): void {
    if (this.channel !== null) {
      this.channel.postMessage(event);
      return;
    }
    if (typeof window === 'undefined') return;
    localStorage.setItem(SYNC_KEY, JSON.stringify(event));
    localStorage.removeItem(SYNC_KEY);
  }

  destroy(): void {
    this.channel?.close();
    this.channel = null;
    if (this.storageListener !== null) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
  }
}

export type { SyncEvent, SyncEventType } from './types';

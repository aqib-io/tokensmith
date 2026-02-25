const channels = new Map<string, Set<BroadcastChannelMock>>();

class BroadcastChannelMock {
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const existing = channels.get(name);
    if (existing) {
      existing.add(this);
    } else {
      channels.set(name, new Set([this]));
    }
  }

  postMessage(data: unknown): void {
    const siblings = channels.get(this.name);
    if (!siblings) return;
    for (const sibling of siblings) {
      if (sibling !== this) {
        sibling.onmessage?.(new MessageEvent('message', { data }));
      }
    }
  }

  close(): void {
    channels.get(this.name)?.delete(this);
  }
}

globalThis.BroadcastChannel =
  BroadcastChannelMock as unknown as typeof BroadcastChannel;

afterEach(() => {
  localStorage.clear();

  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }

  channels.clear();
});

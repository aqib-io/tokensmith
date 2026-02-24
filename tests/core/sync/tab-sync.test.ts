import { TabSyncManager } from "@/core/sync";
import type { SyncEvent } from "@/core/sync";

describe("TabSyncManager", () => {
  describe("BroadcastChannel mode", () => {
    it("delivers a broadcast from one instance to another on the same channel", () => {
      const onSyncA = vi.fn();
      const onSyncB = vi.fn();
      const a = new TabSyncManager("tokensmith", onSyncA);
      const b = new TabSyncManager("tokensmith", onSyncB);
      a.start();
      b.start();

      const event: SyncEvent = { type: "TOKEN_SET" };
      a.broadcast(event);

      expect(onSyncB).toHaveBeenCalledOnce();
      expect(onSyncB).toHaveBeenCalledWith(event);
      expect(onSyncA).not.toHaveBeenCalled();
    });

    it("does not call onSync on the sender itself", () => {
      const onSyncA = vi.fn();
      const a = new TabSyncManager("tokensmith", onSyncA);
      const b = new TabSyncManager("tokensmith", vi.fn());
      a.start();
      b.start();

      a.broadcast({ type: "TOKEN_CLEARED" });

      expect(onSyncA).not.toHaveBeenCalled();
    });

    it("destroy stops the instance from receiving further broadcasts", () => {
      const onSyncB = vi.fn();
      const a = new TabSyncManager("tokensmith", vi.fn());
      const b = new TabSyncManager("tokensmith", onSyncB);
      a.start();
      b.start();
      b.destroy();

      a.broadcast({ type: "TOKEN_SET" });

      expect(onSyncB).not.toHaveBeenCalled();
    });

    it("destroy can be called multiple times without throwing", () => {
      const manager = new TabSyncManager("tokensmith", vi.fn());
      manager.start();

      expect(() => {
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });

    it("does not call onSync when a message with an unknown type is posted to the channel", () => {
      const onSync = vi.fn();
      const receiver = new TabSyncManager("tokensmith", onSync);
      receiver.start();

      const external = new BroadcastChannel("tokensmith");
      external.postMessage({ type: "INJECTED_EVENT" });
      external.close();

      expect(onSync).not.toHaveBeenCalled();
    });
  });

  describe("fallback mode (localStorage storage event)", () => {
    beforeEach(() => {
      vi.stubGlobal("BroadcastChannel", undefined);
    });

    it("triggers onSync when a storage event for the tk_sync key is dispatched", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      const event: SyncEvent = { type: "TOKEN_SET" };
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: JSON.stringify(event),
        }),
      );

      expect(onSync).toHaveBeenCalledOnce();
      expect(onSync).toHaveBeenCalledWith(event);
    });

    it("ignores storage events for keys other than tk_sync", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some_other_key",
          newValue: JSON.stringify({ type: "TOKEN_SET" }),
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("ignores storage events with a null newValue", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", { key: "tk_sync", newValue: null }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("ignores storage events with invalid JSON in newValue", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: "not-valid-json",
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("ignores storage events with valid JSON but no type field", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: JSON.stringify({ notAType: "TOKEN_SET" }),
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("ignores storage events with a non-string type field", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: JSON.stringify({ type: 42 }),
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("ignores storage events with a valid JSON object but an unknown type value", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: JSON.stringify({ type: "UNKNOWN_EVENT" }),
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });

    it("broadcast cleans up the tk_sync key from localStorage after writing", () => {
      const manager = new TabSyncManager("tokensmith", vi.fn());
      manager.start();

      manager.broadcast({ type: "TOKEN_REFRESHED" });

      expect(localStorage.getItem("tk_sync")).toBeNull();
    });

    it("destroy removes the storage event listener", () => {
      const onSync = vi.fn();
      const manager = new TabSyncManager("tokensmith", onSync);
      manager.start();
      manager.destroy();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tk_sync",
          newValue: JSON.stringify({ type: "TOKEN_SET" }),
        }),
      );

      expect(onSync).not.toHaveBeenCalled();
    });
  });

  describe("SSR safety", () => {
    it("start and broadcast do not throw when window is undefined", () => {
      vi.stubGlobal("window", undefined);
      const manager = new TabSyncManager("tokensmith", vi.fn());
      try {
        expect(() => manager.start()).not.toThrow();
        expect(() => manager.broadcast({ type: "TOKEN_SET" })).not.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

import { StorageError } from "@/core/errors";
import { LocalStorageAdapter } from "@/core/storage/local-storage";

describe("LocalStorageAdapter", () => {
  it("returns null for a key that has not been set", () => {
    const adapter = new LocalStorageAdapter();
    expect(adapter.get("missing")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const adapter = new LocalStorageAdapter();
    adapter.set("tk_access", "token-value");
    expect(adapter.get("tk_access")).toBe("token-value");
  });

  it("remove makes the key return null", () => {
    const adapter = new LocalStorageAdapter();
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    expect(adapter.get("tk_access")).toBeNull();
  });

  it("clear removes only tk_-prefixed keys and preserves others", () => {
    const adapter = new LocalStorageAdapter();
    localStorage.setItem("other_key", "preserve-me");
    adapter.set("tk_access", "token-a");
    adapter.set("tk_refresh", "token-b");
    adapter.clear();
    expect(adapter.get("tk_access")).toBeNull();
    expect(adapter.get("tk_refresh")).toBeNull();
    expect(localStorage.getItem("other_key")).toBe("preserve-me");
  });

  it("throws StorageError for all operations when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    const adapter = new LocalStorageAdapter();
    try {
      expect(() => adapter.get("tk_access")).toThrow(StorageError);
      expect(() => adapter.set("tk_access", "value")).toThrow(StorageError);
      expect(() => adapter.remove("tk_access")).toThrow(StorageError);
      expect(() => adapter.clear()).toThrow(StorageError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws StorageError when setItem throws a quota error", () => {
    const adapter = new LocalStorageAdapter();
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    expect(() => adapter.set("tk_access", "value")).toThrow(StorageError);
  });
});

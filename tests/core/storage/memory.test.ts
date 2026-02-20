import { MemoryStorageAdapter } from "@/core/storage/memory";

describe("MemoryStorageAdapter", () => {
  it("returns null for a key that has not been set", () => {
    const adapter = new MemoryStorageAdapter();
    expect(adapter.get("missing")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.set("tk_access", "token-value");
    expect(adapter.get("tk_access")).toBe("token-value");
  });

  it("remove makes the key return null", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    expect(adapter.get("tk_access")).toBeNull();
  });

  it("clear removes all stored values", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.set("tk_access", "token-a");
    adapter.set("tk_refresh", "token-b");
    adapter.clear();
    expect(adapter.get("tk_access")).toBeNull();
    expect(adapter.get("tk_refresh")).toBeNull();
  });

  it("instances are isolated from each other", () => {
    const a = new MemoryStorageAdapter();
    const b = new MemoryStorageAdapter();
    a.set("tk_access", "from-a");
    expect(b.get("tk_access")).toBeNull();
  });

  it("clear on one instance does not affect another", () => {
    const a = new MemoryStorageAdapter();
    const b = new MemoryStorageAdapter();
    a.set("tk_access", "value");
    b.set("tk_access", "value");
    a.clear();
    expect(b.get("tk_access")).toBe("value");
  });
});

import { StorageError } from "@/core/errors";
import { CookieStorageAdapter } from "@/core/storage/cookie";
import { createTestJwt } from "../../helpers/create-test-jwt";

const cookieProtoDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "cookie",
)!;

function captureCookieWrites(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  Object.defineProperty(Document.prototype, "cookie", {
    ...cookieProtoDescriptor,
    set(this: Document, value: string) {
      writes.push(value);
      cookieProtoDescriptor.set!.call(this, value);
    },
  });
  return {
    writes,
    restore: () =>
      Object.defineProperty(
        Document.prototype,
        "cookie",
        cookieProtoDescriptor,
      ),
  };
}

describe("CookieStorageAdapter", () => {
  it("returns null for a key that has not been set", () => {
    const adapter = new CookieStorageAdapter();
    expect(adapter.get("tk_access")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-value");
    expect(adapter.get("tk_access")).toBe("token-value");
  });

  it("remove makes the key return null", () => {
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    expect(adapter.get("tk_access")).toBeNull();
  });

  it("remove writes a cookie string containing Max-Age=0", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    restore();
    expect(writes[1]).toContain("Max-Age=0");
  });

  it("clear removes both tk_access and tk_refresh cookies", () => {
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-a");
    adapter.set("tk_refresh", "token-b");
    adapter.clear();
    expect(adapter.get("tk_access")).toBeNull();
    expect(adapter.get("tk_refresh")).toBeNull();
  });

  it("includes Path=/ and SameSite=Strict by default with no Secure on http", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-value");
    restore();
    expect(writes[0]).toContain("Path=/");
    expect(writes[0]).toContain("SameSite=Strict");
    expect(writes[0]).not.toContain("Secure");
  });

  it("includes Secure when config.secure is true", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter({ secure: true });
    adapter.set("tk_access", "token-value");
    restore();
    expect(writes[0]).toContain("Secure");
  });

  it("forces Secure when sameSite is none", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter({ sameSite: "none" });
    adapter.set("tk_access", "token-value");
    restore();
    expect(writes[0]).toContain("SameSite=None");
    expect(writes[0]).toContain("Secure");
  });

  it("fromCookieHeader parses access token from a raw header string", () => {
    const adapter = new CookieStorageAdapter();
    const result = adapter.fromCookieHeader("tk_access=my-access-token");
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("my-access-token");
    expect(result!.refreshToken).toBeUndefined();
  });

  it("fromCookieHeader returns both access and refresh tokens", () => {
    const adapter = new CookieStorageAdapter();
    const result = adapter.fromCookieHeader(
      "tk_access=access-token; tk_refresh=refresh-token",
    );
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("access-token");
    expect(result!.refreshToken).toBe("refresh-token");
  });

  it("fromCookieHeader returns null when access token is absent", () => {
    const adapter = new CookieStorageAdapter();
    expect(adapter.fromCookieHeader("tk_refresh=refresh-token")).toBeNull();
    expect(adapter.fromCookieHeader("")).toBeNull();
  });

  it("throws StorageError for all operations when document is unavailable", () => {
    vi.stubGlobal("document", undefined);
    const adapter = new CookieStorageAdapter();
    try {
      expect(() => adapter.get("tk_access")).toThrow(StorageError);
      expect(() => adapter.set("tk_access", "value")).toThrow(StorageError);
      expect(() => adapter.remove("tk_access")).toThrow(StorageError);
      expect(() => adapter.clear()).toThrow(StorageError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("remove writes a cookie string containing SameSite=Strict by default", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter();
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    restore();
    expect(writes[1]).toContain("SameSite=Strict");
  });

  it("remove writes a cookie string containing Secure when config.secure is true", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter({ secure: true });
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    restore();
    expect(writes[1]).toContain("Secure");
  });

  it("remove writes a cookie string with SameSite=None and Secure when sameSite is none", () => {
    const { writes, restore } = captureCookieWrites();
    const adapter = new CookieStorageAdapter({ sameSite: "none" });
    adapter.set("tk_access", "token-value");
    adapter.remove("tk_access");
    restore();
    expect(writes[1]).toContain("SameSite=None");
    expect(writes[1]).toContain("Secure");
  });

  it("sets Max-Age derived from JWT exp when maxAge is auto", () => {
    const { writes, restore } = captureCookieWrites();
    const token = createTestJwt({}, 3600);
    const adapter = new CookieStorageAdapter({ maxAge: "auto" });
    adapter.set("tk_access", token);
    restore();
    const cookieStr = writes[0] ?? "";
    expect(cookieStr).toMatch(/Max-Age=\d+/);
    const matchResult = /Max-Age=(\d+)/.exec(cookieStr);
    const maxAge = matchResult ? Number(matchResult[1] ?? "0") : 0;
    expect(maxAge).toBeGreaterThan(3590);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });
});

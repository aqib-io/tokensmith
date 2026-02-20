import { PromiseQueue } from "@/core/refresh/queue";

describe("PromiseQueue", () => {
  it("returns the resolved value of fn", async () => {
    const queue = new PromiseQueue<string>();

    const result = await queue.execute(() => Promise.resolve("hello"));

    expect(result).toBe("hello");
  });

  it("calls fn only once when invoked concurrently by multiple callers", async () => {
    const queue = new PromiseQueue<string>();
    let resolve!: (value: string) => void;
    const controlled = new Promise<string>((r) => {
      resolve = r;
    });
    const fn = vi.fn(() => controlled);

    const p1 = queue.execute(fn);
    const p2 = queue.execute(fn);
    const p3 = queue.execute(fn);
    resolve("result");

    await Promise.all([p1, p2, p3]);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("all concurrent callers receive the same resolved value", async () => {
    const queue = new PromiseQueue<string>();
    let resolve!: (value: string) => void;
    const controlled = new Promise<string>((r) => {
      resolve = r;
    });
    const fn = vi.fn(() => controlled);

    const p1 = queue.execute(fn);
    const p2 = queue.execute(fn);
    const p3 = queue.execute(fn);
    resolve("shared");

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe("shared");
    expect(r2).toBe("shared");
    expect(r3).toBe("shared");
  });

  it("isExecuting is true while the promise is pending and false otherwise", async () => {
    const queue = new PromiseQueue<number>();
    let resolve!: (value: number) => void;
    const controlled = new Promise<number>((r) => {
      resolve = r;
    });

    expect(queue.isExecuting).toBe(false);

    const promise = queue.execute(() => controlled);
    expect(queue.isExecuting).toBe(true);

    resolve(42);
    await promise;

    expect(queue.isExecuting).toBe(false);
  });

  it("resets after completion so subsequent calls invoke fn again", async () => {
    const queue = new PromiseQueue<number>();
    const fn = vi.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const first = await queue.execute(fn);
    const second = await queue.execute(fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("all concurrent callers receive the same rejection when fn rejects", async () => {
    const queue = new PromiseQueue<never>();
    let reject!: (reason: Error) => void;
    const controlled = new Promise<never>((_, r) => {
      reject = r;
    });
    const fn = vi.fn(() => controlled);

    const p1 = queue.execute(fn);
    const p2 = queue.execute(fn);
    const p3 = queue.execute(fn);
    const error = new Error("network failed");
    reject(error);

    const results = await Promise.allSettled([p1, p2, p3]);

    expect(fn).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBe(error);
      }
    }
  });

  it("resets after rejection so subsequent calls invoke fn again", async () => {
    const queue = new PromiseQueue<string>();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("first fails"))
      .mockResolvedValueOnce("second succeeds");

    await expect(queue.execute(fn)).rejects.toThrow("first fails");
    const result = await queue.execute(fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toBe("second succeeds");
  });
});

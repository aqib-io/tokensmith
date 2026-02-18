export class PromiseQueue<T> {
  private pending: Promise<T> | null = null;

  async execute(fn: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;
    this.pending = fn().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  get isExecuting(): boolean {
    return this.pending !== null;
  }
}

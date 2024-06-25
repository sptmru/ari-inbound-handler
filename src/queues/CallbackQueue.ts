export class CallbackQueue<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static instance: CallbackQueue<any> | null = null;
  protected elements: T[] = [];

  protected constructor() {}

  public static getInstance<T>(): CallbackQueue<T> {
    if (!CallbackQueue.instance) {
      CallbackQueue.instance = new CallbackQueue<T>();
    }
    return CallbackQueue.instance;
  }

  enqueue(element: T): void {
    this.elements.push(element);
  }

  dequeue(): T | undefined {
    return this.elements.shift();
  }

  peel(): T | undefined {
    return this.elements[0];
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  size(): number {
    return this.elements.length;
  }
}

export interface Observable<T = unknown> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createObservable<T>(initial: T): Observable<T> {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get() {
      return current;
    },
    set(value: T) {
      if (Object.is(current, value)) return;
      current = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

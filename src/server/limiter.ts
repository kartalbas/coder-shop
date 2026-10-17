// Small async semaphore that bounds how many scrypt verifications (32 MiB each) may run
// in parallel and rejects would-be waiters once the queue is full — unthrottled parallel
// logins must not be able to exhaust the server.

export class LimiterBusyError extends Error {
  constructor() {
    super("limiter busy");
    this.name = "LimiterBusyError";
  }
}

export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly running: number;
  readonly queued: number;
}

export function createLimiter(maxParallel: number, maxQueue: number): Limiter {
  let running = 0;
  const queue: (() => void)[] = [];

  async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running < maxParallel) {
      running += 1;
    } else {
      if (queue.length >= maxQueue) throw new LimiterBusyError();
      await new Promise<void>((resolve) => queue.push(resolve));
      // the slot was handed over by the releasing caller; `running` stays as it was
    }
    try {
      return await task();
    } finally {
      const next = queue.shift();
      if (next) next();
      else running -= 1;
    }
  }

  return {
    run,
    get running() {
      return running;
    },
    get queued() {
      return queue.length;
    },
  };
}

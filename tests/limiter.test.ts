import { describe, expect, it } from "vitest";
import { createLimiter, LimiterBusyError } from "@/server/limiter";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("createLimiter", () => {
  it("runs at most maxParallel tasks at a time", async () => {
    const limiter = createLimiter(2, 10);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await tick();
          active -= 1;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(limiter.running).toBe(0);
  });

  it("rejects immediately once maxParallel + maxQueue tasks are waiting", async () => {
    const limiter = createLimiter(1, 2);
    const started: (() => void)[] = [];
    const held = limiter.run(
      () => new Promise<void>((resolve) => started.push(resolve)),
    );
    await poll(() => limiter.running === 1);
    const queued1 = limiter.run(async () => {});
    const queued2 = limiter.run(async () => {});
    await poll(() => limiter.queued === 2);
    await expect(limiter.run(async () => {})).rejects.toBeInstanceOf(LimiterBusyError);
    started[0]!();
    await Promise.all([held, queued1, queued2]);
    expect(limiter.queued).toBe(0);
    expect(limiter.running).toBe(0);
  });

  it("hands the slot to a waiter instead of dropping parallelism", async () => {
    const limiter = createLimiter(1, 1);
    let releaseFirst: () => void = () => {};
    const first = limiter.run(() => new Promise<void>((resolve) => (releaseFirst = resolve)));
    await poll(() => limiter.running === 1);
    let secondStarted = false;
    const second = limiter.run(async () => {
      secondStarted = true;
    });
    await poll(() => limiter.queued === 1);
    releaseFirst();
    await first;
    await second;
    expect(secondStarted).toBe(true);
  });
});

async function poll(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("poll timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

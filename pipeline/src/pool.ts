/**
 * Fixed-size worker pool: runs `worker` over every item with at most
 * `concurrency` workers in flight. Shared by classification (issue #4) and
 * the benchmark grader.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index < items.length) {
        const i = index++;
        await worker(items[i]!, i);
      }
    }),
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  status: 'loading' | 'success' | 'error';
  error: string | null;
}

export type UseApiResult<T> = AsyncState<T> & { reload: () => void };

interface Entry<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Small data-fetching hook: runs `loader` on mount and whenever the
 * serialized `deps` change, with a manual `reload()` escape hatch.
 *
 * The request key is derived during render, so no state is written
 * synchronously inside the effect — only when the promise settles.
 */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [tick, setTick] = useState(0);
  const [entry, setEntry] = useState<Entry<T> | null>(null);

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const key = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    let cancelled = false;

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setEntry({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEntry({
            key,
            data: null,
            error: error instanceof Error ? error.message : 'Something went wrong',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const isCurrent = entry?.key === key;
  const status: AsyncState<T>['status'] = !isCurrent ? 'loading' : entry?.error ? 'error' : 'success';

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return {
    data: entry?.data ?? null,
    status,
    error: isCurrent ? (entry?.error ?? null) : null,
    reload,
  };
}

/** Debounce a fast-changing value (e.g. a search box) before fetching. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

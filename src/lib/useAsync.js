import { useCallback, useEffect, useState } from 'react';

/* const { data, loading, error, reload, setData } = useAsync(() => api.something(), [deps]) */
export function useAsync(fn, deps = []) {
  const [s, set] = useState({ data: undefined, loading: true, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let alive = true;
    set((p) => ({ ...p, loading: true, error: null }));
    Promise.resolve().then(fn).then((data) => alive && set({ data, loading: false, error: null }))
      .catch((error) => alive && set({ data: undefined, loading: false, error }));
    return () => { alive = false; };
  }, deps);
  useEffect(run, [run]);
  useEffect(() => {
    const isLookupQuery = String(fn).includes('getLookups');
    if (!isLookupQuery) return undefined;
    const onChanged = () => { run(); };
    window.addEventListener('fa:lookups-changed', onChanged);
    return () => window.removeEventListener('fa:lookups-changed', onChanged);
  }, [fn, run]);
  return { ...s, reload: run, setData: (d) => set((p) => ({ ...p, data: typeof d === 'function' ? d(p.data) : d })) };
}

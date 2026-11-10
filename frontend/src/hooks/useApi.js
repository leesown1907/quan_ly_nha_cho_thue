import { useCallback, useEffect, useRef, useState } from 'react';

/** Gọi API và quản lý trạng thái loading / error / reload */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fetcher();
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e.message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { data, setData, loading, error, reload: load };
}

/** Giá trị trễ (debounce) cho ô tìm kiếm */
export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

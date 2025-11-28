import { useEffect, useState } from "react";

export function useSessionStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const item = sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  });

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

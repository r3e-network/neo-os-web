import { useEffect, useState } from "react";

export function useLocalStorage(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    const existing = window.localStorage.getItem(key);
    return existing ?? initial;
  });

  useEffect(() => {
    window.localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

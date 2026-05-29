"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_API_KEY_CHANGED_EVENT,
  hasStoredAdminApiKey,
} from "@/lib/admin-client";

export function useAdminApiKeyReady() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const sync = () => setHasKey(hasStoredAdminApiKey());
    sync();
    window.addEventListener(ADMIN_API_KEY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ADMIN_API_KEY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return hasKey;
}

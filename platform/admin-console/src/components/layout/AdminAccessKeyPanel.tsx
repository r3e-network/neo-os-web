"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_API_KEY_CHANGED_EVENT,
  getStoredAdminApiKey,
  setStoredAdminApiKey,
} from "@/lib/admin-client";

export function AdminAccessKeyPanel() {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [hasKey, setHasKey] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const sync = () => setHasKey(Boolean(getStoredAdminApiKey()));
    sync();
    window.addEventListener(ADMIN_API_KEY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ADMIN_API_KEY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const refreshQueries = () => {
    void queryClient.invalidateQueries();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStoredAdminApiKey(value);
    setValue("");
    setHasKey(Boolean(value.trim()));
    refreshQueries();
  };

  const handleClear = () => {
    setStoredAdminApiKey("");
    setValue("");
    setHasKey(false);
    refreshQueries();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-access-key-panel rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">
              Admin API access
            </span>
            <span
              aria-live="polite"
              className={
                hasKey
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700"
                  : "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-700"
              }
            >
              {hasKey ? "Active for this tab" : "Required"}
            </span>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-gray-500">
            The key stays in this tab's session storage and is sent only to this
            console's same-origin API routes.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label htmlFor={inputId} className="sr-only">
            Admin API key
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            type="password"
            autoComplete="off"
            placeholder={hasKey ? "Replace admin key" : "Paste admin key"}
            className="h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-80"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!value.trim()}
              className="h-11 flex-1 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:flex-none"
            >
              {hasKey ? "Update" : "Save"}
            </button>
            {hasKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="h-11 flex-1 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 sm:flex-none"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}

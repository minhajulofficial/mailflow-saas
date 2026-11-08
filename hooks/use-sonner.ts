"use client";

import { useMemo } from "react";
import { toast as sonnerToast } from "sonner";

type ToastOptions = {
  description?: string;
  duration?: number;
  id?: string;
};

/**
 * Thin wrapper around Sonner so every screen shows real feedback.
 * (The old implementation was a no-op, which made failed logins look like
 * "nothing happens".) The returned object is stable so it can be used in
 * `useEffect`/`useCallback` dependency arrays.
 */
export function useSonner() {
  return useMemo(
    () => ({
      success: (message: string, opts?: ToastOptions) =>
        sonnerToast.success(message, opts),
      error: (message: string, opts?: ToastOptions) =>
        sonnerToast.error(message, opts),
      warning: (message: string, opts?: ToastOptions) =>
        sonnerToast.warning(message, opts),
      info: (message: string, opts?: ToastOptions) =>
        sonnerToast(message, opts),
      loading: (message: string, opts?: ToastOptions) =>
        sonnerToast.loading(message, opts),
      dismiss: (id?: string) => sonnerToast.dismiss(id),
    }),
    []
  );
}

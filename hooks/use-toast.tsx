"use client";

import { toast as sonnerToast } from "sonner";

export const TOAST_LIMIT = 1;
export const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = {
  id?: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | string;
};

function messageOf({ title, description }: ToasterToast) {
  if (title && description) return `${title}: ${description}`;
  return description || title || "";
}

export function useToast() {
  return {
    toast: ({ title, description, variant, id }: ToasterToast) => {
      const message = messageOf({ title, description });
      if (variant === "destructive") {
        return sonnerToast.error(message, { id });
      }
      return sonnerToast(message, { id });
    },
    dismiss: (id?: string) => sonnerToast.dismiss(id),
  };
}

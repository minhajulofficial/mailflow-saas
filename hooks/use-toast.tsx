"use client";

import * as React from "react";
import { useCallback } from "react";
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export const TOAST_LIMIT = 1;
export const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export function Toast() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  );
}

export function useToast() {
  return {
    toast: ({ ...props }: ToasterToast) => {},
  };
}

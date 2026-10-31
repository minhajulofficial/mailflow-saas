"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";

export function useSonner() {
  const { toast } = useToast();
  return {
    success: (message: string, opts?: any) => toast({ title: "Success", description: message, ...opts }),
    error: (message: string, opts?: any) => toast({ title: "Error", description: message, variant: "destructive", ...opts }),
    warning: (message: string, opts?: any) => toast({ title: "Warning", description: message, ...opts }),
    info: (message: string, opts?: any) => toast({ title: "Info", description: message, ...opts }),
  };
}

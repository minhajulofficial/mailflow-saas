"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, type, ...props }, ref) => {
    // Always render a real <input>. The previous version used Radix `Slot`
    // whenever `type` was omitted, which threw "Slot failed to slot onto its
    // children" and crashed pages that used <Checkbox /> without a type.
    return (
      <input
        type={type ?? "checkbox"}
        ref={ref}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded border border-input bg-transparent checked:bg-primary checked:border-primary checked:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

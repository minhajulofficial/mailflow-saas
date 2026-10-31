"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  title?: React.ReactNode;
  side?: "top" | "bottom";
}

const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, title, side = "top", children, ...props }, ref) => {
    return (
      <hr
        ref={ref}
        className={cn(
          "flex w-full cursor-default shrink-0 border-t border-b-0 border-input",
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";

export { Separator };

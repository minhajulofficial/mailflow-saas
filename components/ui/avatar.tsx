"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  className?: string;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden",
        className
      )}
      {...props}
    >
      <span className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground font-medium">A</span>
    </div>
  );
});
Avatar.displayName = "Avatar";

export { Avatar };

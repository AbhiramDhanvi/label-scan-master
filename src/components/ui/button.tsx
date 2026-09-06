import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ink" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center justify-center border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary",
        variant === "ink" && "border-foreground bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-foreground",
        variant === "outline" && "border-border bg-background text-foreground hover:bg-muted focus-visible:outline-foreground",
        className,
      )}
      {...props}
    />
  );
}
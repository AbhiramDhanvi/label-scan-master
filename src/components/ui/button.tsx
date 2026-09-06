import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  { variants: {
    variant: {
      default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary",
      primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary",
      ink: "border-foreground bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-foreground",
      outline: "border-border bg-background text-foreground hover:bg-muted focus-visible:outline-foreground",
      secondary: "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "border-transparent text-foreground hover:bg-muted",
      link: "border-transparent text-primary underline-offset-4 hover:underline",
      destructive: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
    },
    size: { default: "h-9 px-4 py-2", sm: "h-8 px-3", lg: "h-10 px-6", icon: "size-9 p-0" },
  }, defaultVariants: { variant: "default", size: "default" } },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));
Button.displayName = "Button";
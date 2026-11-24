import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ink/8 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-ink text-white hover:bg-[#16375c]',
        outline: 'border border-line bg-white text-ink-2 hover:border-line-hover hover:text-ink',
        ghost: 'text-ink-2 hover:bg-muted hover:text-ink',
        danger: 'text-ink-3 hover:bg-[#fdf5f4] hover:text-red',
      },
      size: {
        default: 'h-9 px-4 text-[13px]',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };

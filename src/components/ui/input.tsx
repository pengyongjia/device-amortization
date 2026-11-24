import * as React from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-line bg-white px-3 py-1 text-[13.5px] text-ink outline-none transition-colors',
        'placeholder:text-ink-4',
        'focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[44px] w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors',
        'placeholder:text-ink-4',
        'focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

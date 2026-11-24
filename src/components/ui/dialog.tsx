import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';
import { Icon } from '../Icon';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-ink/42 backdrop-blur-[2px] data-[state=open]:animate-[fadeIn_.16s_ease]"
      />
      <DialogPrimitive.Content
        className={cn(
          // flex + overflow-hidden：头部/底部固定，内容区自行滚动（吸底布局）
          'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_24px_64px_-24px_rgba(10,37,64,.4)]',
          'data-[state=open]:animate-[dialogIn_.2s_cubic-bezier(.22,1,.36,1)]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors outline-none hover:bg-muted hover:text-ink"
          aria-label="关闭"
        >
          <Icon name="close" size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex shrink-0 flex-col gap-1 px-6 pt-5 pb-1', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold tracking-[-0.01em] text-ink', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-[12.5px] text-ink-3', className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 justify-end gap-2.5 border-t border-line-2 px-6 pt-4 pb-5', className)}
      {...props}
    />
  );
}

export { Dialog, DialogTrigger, DialogClose };

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { parseDate, toDateStr } from '../../utils/date';
import { Icon } from '../Icon';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  /** YYYY-MM-DD，空字符串表示未选择 */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 允许选择的最大日期（含） */
  max?: string;
  id?: string;
}

/** 日期选择器：组件库风格（Popover + 日历），替代原生 date input */
export function DatePicker({ value, onChange, placeholder = '选择日期', max, id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDate(value) : undefined;
  const maxDate = max ? parseDate(max) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-[13.5px] outline-none transition-colors',
            'hover:border-line-hover focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7',
            open && 'border-ink',
          )}
        >
          <span className={value ? 'text-ink tabular-nums' : 'text-ink-4'}>
            {value || placeholder}
          </span>
          <Icon name="calendar" size={15} className="shrink-0 text-ink-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toDateStr(d));
              setOpen(false);
            }
          }}
          disabled={maxDate ? { after: maxDate } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { zhCN } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import 'react-day-picker/style.css';

/** 日历（react-day-picker 封装，金融白主题见 index.css 的 .rdp-fin） */
export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker locale={zhCN} showOutsideDays className={cn('rdp-fin', className)} {...props} />;
}

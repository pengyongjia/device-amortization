import type { ReactNode, SVGProps } from 'react';
import type { IconName } from '../types';

/**
 * 内置线性图标集（1.6px 描边，24x24 网格）
 * 全部为手绘 SVG 路径，不引入任何图标库
 */
const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  inbox: (
    <>
      <path d="M22 12h-5l-2 3h-6l-2-3H2" />
      <path d="M5.5 5h13l3.5 7v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7l3.5-7z" />
    </>
  ),
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.8" cy="8.8" r="1.8" />
      <path d="M21 15.5l-4.5-4.5L6 21" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  file: (
    <>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8l-5.5-5.5z" />
      <path d="M14 2.5V8h5.5" />
    </>
  ),
  cloud: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
  refresh: (
    <>
      <path d="M21 4v6h-6" />
      <path d="M3 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L21 10" />
      <path d="M3 14l2.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18" />
      <path d="M16.5 14.5h.01" />
    </>
  ),
  'trending-down': (
    <>
      <path d="M22 17l-8.5-8.5-5 5L2 7" />
      <path d="M16 17h6v-6" />
    </>
  ),
  'trending-up': (
    <>
      <path d="M22 7l-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M8.6 13.2L7 21l5-3 5 3-1.6-7.8" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M2 19.5h20" />
    </>
  ),
  tablet: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  watch: (
    <>
      <circle cx="12" cy="12" r="5.5" />
      <path d="M9 6.8V3.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M9 17.2v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 17v-5a9 9 0 0 1 18 0v5" />
      <path d="M21 18a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3z" />
      <path d="M3 18a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H3z" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17.5V21" />
    </>
  ),
  mouse: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="5" />
      <path d="M12 6.5v3.5" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2" y="7" width="20" height="10.5" rx="5.25" />
      <path d="M7 10.5v3.5M5.25 12.25h3.5" />
      <path d="M15.5 11h.01M18 13.5h.01" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7l1.5-3h3L15 7" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-4.8L3 8v8l9 4.8L21 16V8z" />
      <path d="M3 8l9 4.8L21 8" />
      <path d="M12 12.8v8" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 2.8v5.4c0 4.4-3 8.1-7.5 9.1-4.5-1-7.5-4.7-7.5-9.1V5.8L12 3z" />
      <path d="M9.2 11.8l2 2 3.6-3.9" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.2l8.6 15H3.4l8.6-15z" />
      <path d="M12 10.2v3.6" />
      <path d="M12 16.9v.01" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

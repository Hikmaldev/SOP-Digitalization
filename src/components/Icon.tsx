import type { SVGProps } from 'react';

export type IconName =
  | 'overview'
  | 'library'
  | 'approvals'
  | 'history'
  | 'departments'
  | 'people'
  | 'bell'
  | 'search'
  | 'chevron'
  | 'arrow-right';

const PATHS: Record<IconName, string> = {
  overview:
    'M4 4.5A2.5 2.5 0 0 1 6.5 2H10v8H4V4.5Zm10-2h3.5A2.5 2.5 0 0 1 20 5v5h-6V2.5ZM4 14h6v8H6.5A2.5 2.5 0 0 1 4 19.5V14Zm10 0h6v5.5a2.5 2.5 0 0 1-2.5 2.5H14v-8Z',
  library:
    'M5 3.5h11A2.5 2.5 0 0 1 18.5 6v14.5H7A3.5 3.5 0 0 1 3.5 17V5A1.5 1.5 0 0 1 5 3.5Zm0 2v11.25c.58-.16 1.25-.25 2-.25h9.5V6a.5.5 0 0 0-.5-.5H5ZM7 18.5h9.5v-2H7c-1.16 0-1.5.38-1.5 1s.34 1 1.5 1Z',
  approvals:
    'M12 3a9 9 0 1 0 8.49 12h-2.15A7 7 0 1 1 12 5V3Zm1 0v8h8v-2h-6V3h-2Zm6.9 12.5 1.42 1.42-5.1 5.1-2.72-2.72 1.42-1.42 1.3 1.3 3.68-3.68Z',
  history:
    'M12 3a9 9 0 1 1-8.94 10H1l3.5-3.5L8 13H5.07A7 7 0 1 0 12 5v3l4-4-4-4v3Zm-1 4h2v5.17l3.24 1.87-1 1.73L11 13.33V7Z',
  departments:
    'M4 20V4.5A1.5 1.5 0 0 1 5.5 3h5A1.5 1.5 0 0 1 12 4.5V7h6.5A1.5 1.5 0 0 1 20 8.5V20h-2v-2H6v2H4Zm2-4h4v-3H6v3Zm0-5h4V8H6v3Zm6 5h6V9h-6v7Zm2-3h2v2h-2v-2Z',
  people:
    'M9 12a4 4 0 1 1 4-4 4 4 0 0 1-4 4Zm0-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm7 5a3 3 0 1 1 3-3 3 3 0 0 1-3 3Zm0-4a1 1 0 1 0 1 1 1 1 0 0 0-1-1ZM2 20a7 7 0 0 1 14 0h-2a5 5 0 0 0-10 0H2Zm14-4a5 5 0 0 1 6 4h-2a3 3 0 0 0-4-1.83V16Z',
  bell:
    'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8.5 11h5a2.5 2.5 0 0 1-5 0Z',
  search:
    'm20.3 18.9-4.4-4.4a7 7 0 1 0-1.4 1.4l4.4 4.4 1.4-1.4ZM5 10a5 5 0 1 1 10 0A5 5 0 0 1 5 10Z',
  chevron:
    'M9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3Z',
  'arrow-right':
    'M13.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 1 1-1.4-1.4L18 13H4a1 1 0 1 1 0-2h14l-4.7-4.3a1 1 0 0 1 0-1.4Z',
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 17, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
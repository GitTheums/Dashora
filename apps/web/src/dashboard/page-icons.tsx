import type { PageIcon } from "@dashora/shared";
import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function HomeGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M2.5 7.5 8 2.5l5.5 5V13a1 1 0 0 1-1 1H9.5v-3.5h-3V14H3.5a1 1 0 0 1-1-1V7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M2.5 12.5h11M4 12.5V8M8 12.5V4.5M12 12.5V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GamepadGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <rect x="2" y="5" width="12" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 8.5h2M6.5 7.5v2M10.2 8.2h.01M11.5 9.5h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ServerGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="9.5" width="11" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="4.5" r="0.75" fill="currentColor" />
      <circle cx="5" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function BookmarkGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M4 2.5h8v11L8 11.2 4 13.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M5 12.5h6.2A3.3 3.3 0 0 0 12 6.4 3.8 3.8 0 0 0 5.2 5.6 2.8 2.8 0 0 0 5 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function StarGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="m8 2.5 1.6 3.3 3.6.5-2.6 2.6.6 3.6L8 10.8 4.8 12.5l.6-3.6L2.8 6.3l3.6-.5L8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WrenchGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M10.2 2.8a3.2 3.2 0 0 0-4 4L2.8 10.2l3 3 3.4-3.4a3.2 3.2 0 0 0 4-4L11 8 8 5l2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PAGE_ICON_COMPONENTS: Record<PageIcon, (props: IconProps) => ReactElement> = {
  home: HomeGlyph,
  chart: ChartGlyph,
  gamepad: GamepadGlyph,
  server: ServerGlyph,
  bookmark: BookmarkGlyph,
  calendar: CalendarGlyph,
  cloud: CloudGlyph,
  grid: GridGlyph,
  star: StarGlyph,
  wrench: WrenchGlyph,
};

export function PageIconGlyph({ icon, ...props }: IconProps & { icon: PageIcon }) {
  const Component = PAGE_ICON_COMPONENTS[icon] ?? GridGlyph;
  return <Component {...props} />;
}

export const PAGE_ICON_OPTIONS: Array<{ value: PageIcon; label: string }> = [
  { value: "home", label: "Home" },
  { value: "chart", label: "Chart" },
  { value: "gamepad", label: "Gaming" },
  { value: "server", label: "Server" },
  { value: "bookmark", label: "Bookmark" },
  { value: "calendar", label: "Calendar" },
  { value: "cloud", label: "Cloud" },
  { value: "grid", label: "Grid" },
  { value: "star", label: "Star" },
  { value: "wrench", label: "Wrench" },
];

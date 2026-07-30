import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function DashoraMark(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} fill="none" {...props} aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="currentColor" opacity="0.12" />
      <path
        d="M8 7.5h6.2c3.1 0 5.3 1.9 5.3 4.7S17.3 17 14.2 17H11v3.5H8V7.5Zm3 6.7h2.9c1.5 0 2.4-.8 2.4-2s-.9-2-2.4-2H11v4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.2 10.2 13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.75v1.25M8 13v1.25M1.75 8H3M13 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M13.2 9.4A5.75 5.75 0 0 1 6.6 2.8 5.75 5.75 0 1 0 13.2 9.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M9.5 3.5 12.5 6.5M3 13l.7-3.2L10.8 2.7a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L6.2 12.3 3 13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M13 8a5 5 0 1 1-1.2-3.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 3.5V6.5H10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <circle cx="3.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M9 3.5h3.5V7M12.5 3.5 7.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 4.5H4.5A1 1 0 0 0 3.5 5.5v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" {...props} aria-hidden="true">
      <path
        d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

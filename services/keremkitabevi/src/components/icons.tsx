import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
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
      {children}
    </svg>
  );
}

/** Kerem Kitabevi işareti: iki cilt sırtı ve eğik bir üçüncü cilt, köşede sinyal noktası. */
export function LogoMark({ size = 32, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...rest}>
      <rect x="1" y="1" width="62" height="62" rx="16" fill="#141A33" stroke="#28305A" strokeWidth="2" />
      <rect x="14" y="14" width="9" height="36" rx="2.5" fill="#7A8CFF" />
      <rect x="26" y="19" width="9" height="31" rx="2.5" fill="#B7C0FF" />
      <rect x="38.2" y="16" width="9" height="34" rx="2.5" transform="rotate(14 42.7 33)" fill="#FFB547" />
      <circle cx="51" cy="13" r="3" fill="#FFB547" />
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Base {...p}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10.5V19h12v-8.5" />
    <path d="M10 19v-5h4v5" />
  </Base>
);
export const IconLibrary = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="4" height="16" rx="1" />
    <rect x="10" y="7" width="4" height="13" rx="1" />
    <path d="m16.5 8.5 3.6-.9 2.6 11.6-3.6.9z" transform="translate(-2 -1)" />
  </Base>
);
export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);
export const IconAuthor = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
  </Base>
);
export const IconSeries = (p: P) => (
  <Base {...p}>
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
  </Base>
);
export const IconGenre = (p: P) => (
  <Base {...p}>
    <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1.1.4l7.3 7.3a1.5 1.5 0 0 1 0 2.1l-6.7 6.7a1.5 1.5 0 0 1-2.1 0L3.9 13.3a1.5 1.5 0 0 1-.4-1.1z" />
    <circle cx="8.2" cy="8.2" r="1.2" />
  </Base>
);
export const IconDownload = (p: P) => (
  <Base {...p}>
    <path d="M12 4v10.5" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M5 19.5h14" />
  </Base>
);
export const IconRead = (p: P) => (
  <Base {...p}>
    <path d="M12 6.5C10.3 5.2 8 4.6 4 4.6v13.8c4 0 6.3.6 8 1.9 1.7-1.3 4-1.9 8-1.9V4.6c-4 0-6.3.6-8 1.9z" />
    <path d="M12 6.5v13.8" />
  </Base>
);
export const IconScan = (p: P) => (
  <Base {...p}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
    <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
    <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
    <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M7.5 12h9" />
  </Base>
);
export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);
export const IconMenu = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);
export const IconFilter = (p: P) => (
  <Base {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Base>
);
export const IconSun = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
  </Base>
);
export const IconMoon = (p: P) => (
  <Base {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
  </Base>
);
export const IconPaper = (p: P) => (
  <Base {...p}>
    <path d="M6.5 3.5h8l4 4v13h-12z" />
    <path d="M14.5 3.5v4h4" />
    <path d="M9 12.5h6M9 16h6" />
  </Base>
);
export const IconType = (p: P) => (
  <Base {...p}>
    <path d="M3.5 19 8 6l4.5 13" />
    <path d="M5 14.5h6" />
    <path d="M14.5 19l3-8 3 8" />
    <path d="M15.6 16.5h3.8" />
  </Base>
);
export const IconToc = (p: P) => (
  <Base {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.7" cy="6.5" r=".8" fill="currentColor" />
    <circle cx="4.7" cy="12" r=".8" fill="currentColor" />
    <circle cx="4.7" cy="17.5" r=".8" fill="currentColor" />
  </Base>
);
export const IconPrev = (p: P) => (
  <Base {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Base>
);
export const IconNext = (p: P) => (
  <Base {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Base>
);
export const IconBack = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5.5" />
    <path d="m11 6.5-5.5 5.5L11 17.5" />
  </Base>
);
export const IconPdf = (p: P) => (
  <Base {...p}>
    <path d="M6.5 3.5h8l4 4v13h-12z" />
    <path d="M14.5 3.5v4h4" />
    <path d="M9 15.5h1.3a1.2 1.2 0 0 0 0-2.4H9v4.4" />
  </Base>
);
export const IconHub = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);
export const IconFullscreen = (p: P) => (
  <Base {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Base>
);

export const IconTrack = (p: P) => (
  <Base {...p}>
    <path d="M6 4.5h12a1 1 0 0 1 1 1V20l-7-3.8L5 20V5.5a1 1 0 0 1 1-1z" />
    <path d="m9.2 10.2 2 2 3.6-3.8" />
  </Base>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}>
    <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
  </Base>
);
export const IconShelf = (p: P) => (
  <Base {...p}>
    <path d="M4 20h16" />
    <rect x="5.5" y="5" width="3.5" height="12" rx=".8" />
    <rect x="10.5" y="8" width="3.5" height="9" rx=".8" />
    <rect x="15.5" y="4" width="3.5" height="13" rx=".8" />
  </Base>
);
export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconTrash = (p: P) => (
  <Base {...p}>
    <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />
  </Base>
);

/** E-reader with a check for completed Kobo transfers. */
export const IconKobo = ({ transferred = false, ...props }: P & { transferred?: boolean }) => (
  <Base {...props}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    {transferred ? <path d="m8 11 2.5 2.5L16 8" /> : <path d="M9 8h6M9 12h6" />}
    <path d="M10 18h4" />
  </Base>
);

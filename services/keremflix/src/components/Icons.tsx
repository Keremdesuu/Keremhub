import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Genel ikonlar ---------- */
export const InfoIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></Svg>
);
export const BellIcon = (p: P) => (
  <Svg {...p}><path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 1.5h-15L6 17Z" /><path d="M10 21h4" /></Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></Svg>
);
export const ChevronRightIcon = (p: P) => (<Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>);
export const ChevronLeftIcon = (p: P) => (<Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>);
export const ChevronDownIcon = (p: P) => (<Svg {...p}><path d="m5 9 7 7 7-7" /></Svg>);
export const CaretDownIcon = (p: P) => (<Svg {...p} fill="currentColor" stroke="none"><path d="m7 10 5 5 5-5Z" /></Svg>);
export const CaretUpIcon = (p: P) => (<Svg {...p} fill="currentColor" stroke="none"><path d="m7 14 5-5 5 5Z" /></Svg>);
export const ThumbUpIcon = (p: P) => (
  <Svg {...p}><path d="M7 11v9H4v-9h3Zm0 0 4-7c1.7 0 2.6 1.1 2.3 2.7L12.8 10H19a1.8 1.8 0 0 1 1.8 2.2l-1.5 6.5A2.2 2.2 0 0 1 17.1 20H7" /></Svg>
);
export const ThumbDownIcon = (p: P) => (
  <Svg {...p}><path d="M7 13V4H4v9h3Zm0 0 4 7c1.7 0 2.6-1.1 2.3-2.7L12.8 14H19a1.8 1.8 0 0 0 1.8-2.2l-1.5-6.5A2.2 2.2 0 0 0 17.1 4H7" /></Svg>
);
export const PlusIcon = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const CheckIcon = (p: P) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>);
export const CloseIcon = (p: P) => (<Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>);
export const CloseCircleIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></Svg>
);
export const ArrowLeftIcon = (p: P) => (<Svg {...p}><path d="M20 12H4M10 6l-6 6 6 6" /></Svg>);
export const FlagIcon = (p: P) => (<Svg {...p}><path d="M5 21V4m0 0h11l-2 4 2 4H5" /></Svg>);
export const UserIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5" /></Svg>
);
export const HelpIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17v.1" /></Svg>
);
export const PencilIcon = (p: P) => (<Svg {...p}><path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1Z" /></Svg>);

/* ---------- Oynatıcı ikonları ---------- */
export const PlayIcon = (p: P) => (<Svg {...p} fill="currentColor" stroke="none"><path d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5Z" /></Svg>);
export const PauseIcon = (p: P) => (<Svg {...p} fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></Svg>);
export const Replay10Icon = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" /><path d="M7.8 3.5 6.6 6.8l3.3.9" />
    <text x="12" y="15.2" fontSize="7.2" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">10</text>
  </Svg>
);
export const Forward10Icon = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5" /><path d="m16.2 3.5 1.2 3.3-3.3.9" />
    <text x="12" y="15.2" fontSize="7.2" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">10</text>
  </Svg>
);
export const VolumeIcon = (p: P) => (
  <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" /><path d="M15.5 9a4.3 4.3 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></Svg>
);
export const MuteIcon = (p: P) => (
  <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" /><path d="m16 9.5 4.5 5M20.5 9.5l-4.5 5" /></Svg>
);
export const NextIcon = (p: P) => (
  <Svg {...p}><path d="M6 5v14l10-7L6 5Z" /><path d="M19 5v14" /></Svg>
);
export const SubtitlesIcon = (p: P) => (
  <Svg {...p}><path d="M4 5h16v11h-7l-4 3.5V16H4V5Z" /><path d="M7.5 9h9M7.5 12.5h5" /></Svg>
);
export const SpeedIcon = (p: P) => (
  <Svg {...p}><path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" /><circle cx="12" cy="14" r="1.8" fill="currentColor" /><path d="m13.3 12.7 3.2-3.7" /></Svg>
);
export const EpisodesIcon = (p: P) => (
  <Svg {...p}><rect x="8" y="3.5" width="12.5" height="9" rx="1.5" /><rect x="5.5" y="7" width="12.5" height="9" rx="1.5" /><rect x="3" y="10.5" width="12.5" height="9" rx="1.5" /></Svg>
);
export const FullscreenIcon = (p: P) => (
  <Svg {...p}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></Svg>
);
export const ReplayIcon = (p: P) => (
  <Svg {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" /><path d="M19.5 4v4.5H15" /></Svg>
);

/* ---------- Kalite rozetleri ---------- */
export function QualityBadge({ label }: { label: string }) {
  return <span className="quality-badge">{label}</span>;
}

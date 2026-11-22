import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20, props: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  ...props,
});

export const PlayIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M7.05 3.606 20.54 11.394a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z" />
  </svg>
);

export const ChevronLeftIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ChevronRightIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const SearchIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </svg>
);

export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
  </svg>
);

export const CrownIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7zm2 13h14v2H5v-2z" />
  </svg>
);

export const CopyIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
);

export const ShuffleIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);

export const FlagIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M5 2a1 1 0 0 1 1 1v.3C7.6 2.6 9.3 2.5 11.2 3.3c1.9.8 3.5.7 5.6-.2A1 1 0 0 1 18.2 4v9.5a1 1 0 0 1-.6.9c-2.6 1.1-4.8 1.2-7.1.2-1.7-.7-3.1-.6-4.5 0V21a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1z" />
  </svg>
);

export const UsersIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7.5 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM9 13c-4 0-7 2-7 4.5V20h14v-2.5C16 15 13 13 9 13zm7.5 0c-.6 0-1.2.1-1.7.2 1.4 1 2.2 2.4 2.2 4.3V20H22v-2.5c0-2.5-2.5-4.5-5.5-4.5z" />
  </svg>
);

export const ClockIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const UndoIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const MouseClickIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9l11 4-5 2-2 5-4-11zM4 4l2.5 2.5M9 2v3M2 9h3" />
  </svg>
);

export const ExternalIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const ArrowRightIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const MusicNoteIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M9 18.5a3.5 3.5 0 1 1-2-3.16V5.5a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3v12.5a3.5 3.5 0 1 1-2-3.16V6.28l-8 2V18.5z" />
  </svg>
);

export const ExitIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </svg>
);

export const SpeakerIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const MuteIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);

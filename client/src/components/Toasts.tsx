import type { Toast } from '../lib/useGame';

export function Toasts({ toasts, raised }: { toasts: Toast[]; raised: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-50 flex w-[min(92vw,480px)] -translate-x-1/2 flex-col items-center gap-2 ${raised ? 'bottom-28' : 'bottom-6'}`}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-up rounded-lg px-4 py-3 text-center text-sm font-semibold shadow-2xl ${
            t.kind === 'error' ? 'bg-[#e91429] text-white' : t.kind === 'success' ? 'bg-sp-green text-black' : 'bg-[#2e77d0] text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

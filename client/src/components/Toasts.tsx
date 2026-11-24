import type { Toast } from '../lib/useGame';

export function Toasts({ toasts, raised }: { toasts: Toast[]; raised: 0 | 1 | 2 }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-[60] flex w-[min(92vw,480px)] -translate-x-1/2 flex-col items-center gap-2 ${
        raised === 2 ? 'bottom-[164px]' : raised === 1 ? 'bottom-28' : 'bottom-6'
      }`}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex animate-fade-up items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold shadow-2xl ${
            t.kind === 'error'
              ? 'bg-[#e91429] text-white'
              : t.kind === 'success'
                ? 'bg-sp-green text-black'
                : t.kind === 'attack'
                  ? 'bg-[#1d1442] text-white ring-1 ring-[#a898ff]/50'
                  : 'bg-[#2e77d0] text-white'
          } ${t.icon ? 'pl-2.5' : 'justify-center text-center'}`}
        >
          {t.icon && <span className="shrink-0 animate-hit">{t.icon}</span>}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

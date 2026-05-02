import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  className?: string;
  /** When true, fills available space and centers vertically. */
  fullPage?: boolean;
}

/**
 * BookLoader — animated open-book SVG used as the app-wide loading indicator.
 * No blank white screens: every data-fetching page should render this while loading.
 */
export function BookLoader({ label = "Loading…", className, fullPage = false }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullPage ? "min-h-[60vh]" : "py-10",
        className,
      )}
    >
      <div className="book-loader" aria-hidden="true">
        <svg viewBox="0 0 64 48" width="64" height="48">
          <g fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {/* spine */}
            <line x1="32" y1="6" x2="32" y2="42" />
            {/* left page */}
            <path className="book-page book-page-left" d="M32 8 C 22 6, 12 8, 8 12 L 8 40 C 12 36, 22 38, 32 40 Z" fill="hsl(var(--card))" />
            {/* right page */}
            <path className="book-page book-page-right" d="M32 8 C 42 6, 52 8, 56 12 L 56 40 C 52 36, 42 38, 32 40 Z" fill="hsl(var(--card))" />
          </g>
        </svg>
      </div>
      {label && <p className="text-xs font-medium">{label}</p>}
      <span className="sr-only">Loading</span>

      <style>{`
        .book-loader { display: inline-block; perspective: 600px; }
        .book-page { transform-origin: 32px 24px; }
        .book-page-left  { animation: bookFlipLeft  1.6s ease-in-out infinite; }
        .book-page-right { animation: bookFlipRight 1.6s ease-in-out infinite; }
        @keyframes bookFlipLeft  {
          0%, 100% { transform: rotateY(0deg);   opacity: 1; }
          50%      { transform: rotateY(-60deg); opacity: 0.6; }
        }
        @keyframes bookFlipRight {
          0%, 100% { transform: rotateY(0deg);   opacity: 1; }
          50%      { transform: rotateY(60deg);  opacity: 0.6; }
        }
        @media (prefers-reduced-motion: reduce) {
          .book-page-left, .book-page-right { animation-duration: 4s; }
        }
      `}</style>
    </div>
  );
}

import type { SeedType } from '../types'

/** Мини-иконки-веточки четырёх семян (чистый stroke SVG). */
export default function SeedIcon({ type, className }: { type: SeedType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {type === 'drone' && (
        <>
          <path d="M12 21V4" />
          <path d="M12 8C10 7 9 5.5 9 3.5" />
          <path d="M12 12c2-1 3-2.5 3-4.5" />
          <path d="M12 16.5c-2-1-3-2.4-3-4.2" />
        </>
      )}
      {type === 'pluck' && (
        <>
          <path d="M12 21v-8" />
          <path d="M12 13 8.5 8.5" />
          <path d="M12 13l3.5-4.5" />
          <circle cx="8.5" cy="7" r="1.2" />
          <circle cx="15.5" cy="7" r="1.2" />
          <circle cx="12" cy="4.5" r="1.2" />
        </>
      )}
      {type === 'choir' && (
        <>
          <path d="M12 21c0-5-1.6-8-4.6-10.2" />
          <path d="M12 21V6" />
          <path d="M12 21c0-5 1.6-8 4.6-10.2" />
        </>
      )}
      {type === 'hit' && (
        <>
          <path d="M12 21v-5.5" strokeWidth={2.4} />
          <path d="M6.5 15.5A5.5 4.5 0 0 1 17.5 15.5" />
          <circle cx="7.5" cy="19.5" r="0.9" />
          <circle cx="16.5" cy="19.5" r="0.9" />
        </>
      )}
    </svg>
  )
}

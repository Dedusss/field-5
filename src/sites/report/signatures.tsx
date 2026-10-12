'use client'

/**
 * ОТЧЁТ · FIELD·5 — мини-SVG-«подписи» пяти сцен для карточек витрины.
 * Каждая подпись — 60×40 в палитре своего эксперимента (из manifest).
 */

import type { ReactElement } from 'react'
import type { SiteSlug } from '@/sites/manifest'

function MonolithSig() {
  return (
    <svg viewBox="0 0 60 40" role="img" aria-label="Подпись сцены: силуэты монолитов в тумане" className="block w-full">
      <rect width="60" height="40" fill="#0b0a09" />
      {/* туманные полосы */}
      <rect y="7" width="60" height="2" fill="#f2e3c6" opacity="0.04" />
      <rect y="23" width="60" height="3" fill="#f2e3c6" opacity="0.05" />
      <rect y="30" width="60" height="2.5" fill="#f2e3c6" opacity="0.08" />
      {/* монолиты */}
      <rect x="7" y="12" width="5" height="20" fill="#2a2420" />
      <rect x="16" y="17" width="6.5" height="15" fill="#221d19" />
      <rect x="28" y="7" width="6" height="25" fill="#2a2420" />
      <rect x="41" y="15" width="8" height="17" fill="#241f1a" />
      <rect x="53" y="20" width="4" height="12" fill="#2a2420" />
      {/* сигила — тлеющий знак в монолите */}
      <circle cx="31" cy="12" r="3.2" fill="#d9a05b" opacity="0.22" />
      <rect x="30.1" y="11.1" width="1.8" height="1.8" fill="#d9a05b" />
      {/* курсор-светоч */}
      <circle cx="48" cy="27" r="4.5" fill="#d9a05b" opacity="0.14" />
      <circle cx="48" cy="27" r="1" fill="#f2e3c6" opacity="0.7" />
    </svg>
  )
}

function SynthesisSig() {
  return (
    <svg viewBox="0 0 60 40" role="img" aria-label="Подпись сцены: концентрические кольца звукового сада" className="block w-full">
      <rect width="60" height="40" fill="#120a14" />
      {[16, 12, 8].map((r, i) => (
        <circle
          key={r}
          cx="28"
          cy="21"
          r={r}
          fill="none"
          stroke="#e84fd0"
          strokeWidth={0.8}
          opacity={0.14 + i * 0.15}
        />
      ))}
      <circle cx="28" cy="21" r="5.5" fill="none" stroke="#b6f34d" strokeWidth={0.9} opacity={0.85} />
      <circle cx="28" cy="21" r="1.6" fill="#b6f34d" />
      {/* споры */}
      <circle cx="13" cy="9" r="0.9" fill="#b6f34d" opacity="0.7" />
      <circle cx="47" cy="8" r="0.7" fill="#b6f34d" opacity="0.5" />
      <circle cx="50" cy="30" r="0.9" fill="#e84fd0" opacity="0.6" />
      <circle cx="11" cy="30" r="0.7" fill="#b6f34d" opacity="0.4" />
    </svg>
  )
}

function ArchiveSig() {
  return (
    <svg viewBox="0 0 60 40" role="img" aria-label="Подпись сцены: каркасный узел галереи" className="block w-full">
      <rect width="60" height="40" fill="#efe9dc" />
      <circle cx="30" cy="19" r="11" fill="none" stroke="#2b2118" strokeWidth={0.9} opacity={0.85} />
      <ellipse cx="30" cy="19" rx="11" ry="4.2" fill="none" stroke="#2b2118" strokeWidth={0.7} opacity={0.4} />
      <ellipse cx="30" cy="19" rx="4.2" ry="11" fill="none" stroke="#2b2118" strokeWidth={0.7} opacity={0.3} />
      <ellipse
        cx="30"
        cy="19"
        rx="11"
        ry="4.2"
        fill="none"
        stroke="#c4592f"
        strokeWidth={0.9}
        opacity={0.85}
        transform="rotate(58 30 19)"
      />
      {/* узлы каркаса */}
      <circle cx="30" cy="8" r="1.2" fill="#c4592f" />
      <circle cx="41" cy="19" r="1.2" fill="#2b2118" />
      <circle cx="30" cy="30" r="1.2" fill="#2b2118" />
      <circle cx="19" cy="19" r="1.2" fill="#c4592f" />
      {/* тень в тёплом тумане */}
      <ellipse cx="30" cy="35.5" rx="9" ry="1.6" fill="#d8c7ad" opacity={0.7} />
    </svg>
  )
}

function TextfieldSig() {
  return (
    <svg viewBox="0 0 60 40" role="img" aria-label="Подпись сцены: падающие глифы и куча текста" className="block w-full">
      <rect width="60" height="40" fill="#f4f1ea" />
      <g className="font-mono" fontSize="6.5" fill="#17140f">
        <text x="9" y="9" transform="rotate(-12 9 9)" opacity={0.85}>
          А
        </text>
        <text x="21" y="15" transform="rotate(9 21 15)" opacity={0.6}>
          й
        </text>
        <text x="32" y="7" transform="rotate(-6 32 7)" opacity={0.85}>
          Ф
        </text>
        <text x="44" y="18" transform="rotate(15 44 18)" fill="#d43d1f">
          !
        </text>
        <text x="14" y="22" transform="rotate(-8 14 22)" opacity={0.45}>
          е
        </text>
        <text x="49" y="5" transform="rotate(12 49 5)" opacity={0.55}>
          ж
        </text>
      </g>
      {/* куча на полу */}
      <path
        d="M5 40 L9 33.5 L15 31 L22 33 L30 30 L38 32.5 L46 31.5 L53 34 L55 40 Z"
        fill="#17140f"
      />
      <text x="27" y="37.5" className="font-mono" fontSize="5" fill="#d43d1f" transform="rotate(-8 27 37.5)">
        Я
      </text>
    </svg>
  )
}

function OrganismSig() {
  return (
    <svg viewBox="0 0 60 40" role="img" aria-label="Подпись сцены: ветвящееся биолюминесцентное существо" className="block w-full">
      <rect width="60" height="40" fill="#05130c" />
      <ellipse cx="30" cy="40" rx="26" ry="10" fill="#0c2b1a" opacity={0.55} />
      <g fill="none" stroke="#4ef08a" strokeLinecap="round">
        <path d="M30 40 C30 35 29.5 31 30.5 27" strokeWidth={1.3} opacity={0.95} />
        <path d="M30.3 29 C26.5 26.5 24 24 22.5 20.5" strokeWidth={1} opacity={0.75} />
        <path d="M30.4 31.5 C34 29 36.5 26.5 37.5 23" strokeWidth={1} opacity={0.75} />
        <path d="M30.5 27 C33.5 25.5 35.5 24 36.5 21.5" strokeWidth={0.7} opacity={0.4} />
        <path d="M22.5 20.5 C20.8 17.5 20.3 15.5 21 13" strokeWidth={0.8} opacity={0.55} />
        <path d="M37.5 23 C40.2 20.5 41.3 18.5 40.8 16" strokeWidth={0.8} opacity={0.55} />
      </g>
      {/* светящиеся кончики ветвей */}
      <circle cx="21" cy="13" r="1.1" fill="#4ef08a" />
      <circle cx="40.8" cy="16" r="1.1" fill="#4ef08a" />
      <circle cx="36.5" cy="21.5" r="0.8" fill="#4ef08a" opacity={0.7} />
      {/* прививка посетителя — янтарная */}
      <circle cx="25.8" cy="25" r="2.4" fill="#e8b34d" opacity={0.25} />
      <circle cx="25.8" cy="25" r="1.3" fill="#e8b34d" />
    </svg>
  )
}

const SIGNATURES: Record<SiteSlug, () => ReactElement> = {
  monolith: MonolithSig,
  synthesis: SynthesisSig,
  archive: ArchiveSig,
  textfield: TextfieldSig,
  organism: OrganismSig,
}

export function SceneSignature({ slug }: { slug: SiteSlug }) {
  const Sig = SIGNATURES[slug]
  return <Sig />
}

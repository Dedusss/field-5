'use client'

import { useCallback, useEffect, useState } from 'react'

export type RouteSlug =
  | ''
  | 'monolith'
  | 'synthesis'
  | 'archive'
  | 'textfield'
  | 'organism'
  | 'lab'
  | 'report'

export const KNOWN_ROUTES: RouteSlug[] = [
  '',
  'monolith',
  'synthesis',
  'archive',
  'textfield',
  'organism',
  'lab',
  'report',
]

function parseHash(hash: string): RouteSlug {
  const raw = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? ''
  const slug = raw.trim() as RouteSlug
  return KNOWN_ROUTES.includes(slug) ? slug : ''
}

export function navigateTo(slug: RouteSlug) {
  if (typeof window === 'undefined') return
  const next = slug === '' ? '#/' : `#/${slug}`
  if (window.location.hash === next) {
    // форсируем событие, если хэш не изменился
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = next
  }
}

export function useHashRoute(): { route: RouteSlug; navigate: (slug: RouteSlug) => void } {
  const [route, setRoute] = useState<RouteSlug>(() =>
    typeof window === 'undefined' ? '' : parseHash(window.location.hash),
  )

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((slug: RouteSlug) => navigateTo(slug), [])

  return { route, navigate }
}

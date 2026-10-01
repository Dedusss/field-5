'use client'

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useHashRoute, type RouteSlug } from '@/lib/router'
import Hub from '@/sites/hub/Hub'

function SceneLoader({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#0b0a09]">
      <div className="h-px w-24 overflow-hidden bg-white/10">
        <div className="loader-bar h-full w-1/3 bg-[#d9a05b]" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#d9a05b]/80">
        {label}
      </p>
    </div>
  )
}

const Monolith = dynamic(() => import('@/sites/monolith'), {
  ssr: false,
  loading: () => <SceneLoader label="МОНОЛИТ · прогрев шейдеров" />,
})
const Synthesis = dynamic(() => import('@/sites/synthesis'), {
  ssr: false,
  loading: () => <SceneLoader label="СИНТЕЗ · настройка осцилляторов" />,
})
const Archive = dynamic(() => import('@/sites/archive'), {
  ssr: false,
  loading: () => <SceneLoader label="АРХИВ · сборка скульптур" />,
})
const Textfield = dynamic(() => import('@/sites/textfield'), {
  ssr: false,
  loading: () => <SceneLoader label="ТЕКСТОВОЕ ПОЛЕ · загрузка материи" />,
})
const Organism = dynamic(() => import('@/sites/organism'), {
  ssr: false,
  loading: () => <SceneLoader label="ОРГАНИЗМ · пробуждение" />,
})
const Lab = dynamic(() => import('@/sites/lab'), {
  ssr: false,
  loading: () => <SceneLoader label="ЛАБОРАТОРИЯ · смешивание реактивов" />,
})
const Report = dynamic(() => import('@/sites/report'), {
  ssr: false,
  loading: () => <SceneLoader label="ОТЧЁТ · сверка данных" />,
})

export default function Home() {
  const { route, navigate } = useHashRoute()
  const exit = useCallback(() => navigate('' as RouteSlug), [navigate])

  // Телеметрия: один POST на вход в сцену
  useEffect(() => {
    if (!route) return
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: route }),
    }).catch(() => {})
  }, [route])

  useEffect(() => {
    if (route) {
      document.title = `ПОЛЕ ОПЫТОВ — ${route.toUpperCase()}`
    } else {
      document.title = 'ПОЛЕ ОПЫТОВ — пять экспериментов о будущем веба'
    }
  }, [route])

  switch (route) {
    case 'monolith':
      return <Monolith onExit={exit} />
    case 'synthesis':
      return <Synthesis onExit={exit} />
    case 'archive':
      return <Archive onExit={exit} />
    case 'textfield':
      return <Textfield onExit={exit} />
    case 'organism':
      return <Organism onExit={exit} />
    case 'lab':
      return <Lab onExit={exit} />
    case 'report':
      return <Report onExit={exit} />
    default:
      return <Hub navigate={navigate} />
  }
}

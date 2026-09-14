/**
 * Ponte entre React e a cena Pixi (`render/scene.ts`).
 *
 * `createScene` é assíncrono e o React 19 StrictMode roda o efeito duas
 * vezes em dev (monta → desmonta → monta) — `cancelled` evita que a
 * primeira instância, criada e descartada antes de terminar de inicializar,
 * vaze um canvas ou uma cena "fantasma" rodando em paralelo.
 *
 * O efeito depende de `levelId`/`levelData`: trocar de fase (Fase 3.2,
 * mapa-mundo) destrói a cena atual e monta uma nova, em vez de tentar
 * trocar o tilemap de uma cena já viva.
 */
import { useEffect, useRef } from 'react'
import type { LevelData } from '../engine/level'
import { bindKeyboardInput } from '../render/keyboardInput'
import { createScene, type Scene } from '../render/scene'

interface GameCanvasProps {
  levelId: string
  levelData: LevelData
}

export function GameCanvas({ levelId, levelData }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let scene: Scene | null = null
    let unbindKeyboard: (() => void) | null = null

    createScene(container, levelData).then((created) => {
      if (cancelled) {
        created.destroy()
        return
      }
      scene = created
      unbindKeyboard = bindKeyboardInput(created.setInput)
    })

    return () => {
      cancelled = true
      unbindKeyboard?.()
      scene?.destroy()
    }
  }, [levelId, levelData])

  return <div ref={containerRef} className="h-full w-full" />
}

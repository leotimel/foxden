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
 * trocar o tilemap de uma cena já viva. `onComplete` fica de fora dessa
 * lista de propósito (via ref): um componente pai passando uma arrow
 * function nova a cada render não pode derrubar a cena no meio de uma
 * fase só porque a referência da função mudou.
 */
import { useEffect, useRef } from 'react'
import type { LevelData } from '../engine/level'
import type { StarResult } from '../engine/scoring'
import { bindKeyboardInput } from '../render/keyboardInput'
import { createScene, type Scene } from '../render/scene'

interface GameCanvasProps {
  levelId: string
  levelData: LevelData
  onComplete?: (result: StarResult) => void
}

export function GameCanvas({ levelId, levelData, onComplete }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  // Atualiza a ref DEPOIS do render (nunca durante) — mutar um ref no
  // corpo do componente quebra a regra react-hooks/refs.
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let scene: Scene | null = null
    let unbindKeyboard: (() => void) | null = null

    createScene(container, levelData, (result) => onCompleteRef.current?.(result)).then((created) => {
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

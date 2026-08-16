/**
 * Ponte entre React e a cena Pixi (`render/scene.ts`).
 *
 * `createScene` é assíncrono e o React 19 StrictMode roda o efeito duas
 * vezes em dev (monta → desmonta → monta) — `cancelled` evita que a
 * primeira instância, criada e descartada antes de terminar de inicializar,
 * vaze um canvas ou uma cena "fantasma" rodando em paralelo.
 */
import { useEffect, useRef } from 'react'
import { bindKeyboardInput } from '../render/keyboardInput'
import { createScene, type Scene } from '../render/scene'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let scene: Scene | null = null
    let unbindKeyboard: (() => void) | null = null

    createScene(container).then((created) => {
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
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}

/**
 * Controles touch (Fase 4.1): D-pad virtual (esquerda/direita) + botão de
 * pulo, sobrepostos à cena de jogo. Mesma sensibilidade de pulo de altura
 * variável do teclado — o engine já distingue "segurar vs. soltar" (ver
 * `physics.ts`), aqui só é preciso que o toque dispare os mesmos eventos
 * de down/up que o teclado dispara via `keydown`/`keyup`.
 *
 * Push event-driven, igual `keyboardInput.ts`: um ref guarda o estado dos
 * três botões (não precisa re-renderizar o componente a cada toque) e
 * empurra o `FrameInput` recalculado pro `setInput` da cena a cada
 * mudança — não faz polling por frame.
 *
 * Handlers escritos como funções diretas (não uma fábrica chamada durante
 * o render) de propósito: `react-hooks/refs` acusa "acesso a ref durante
 * o render" em qualquer closure que toque `held.current` construída
 * dentro do JSX, mesmo quando a leitura em si só acontece depois, dentro
 * do próprio evento — só handlers definidos direto no corpo do componente
 * escapam desse falso positivo.
 *
 * Usa Pointer Events (não Touch Events): funciona igual pra touch e
 * mouse, e cada botão testado independentemente já suporta multi-toque de
 * verdade (segurar esquerda com um dedo e apertar pulo com outro).
 */
import { useRef } from 'react'
import type { FrameInput } from '../engine/types'

interface TouchControlsProps {
  setInput: (input: FrameInput) => void
}

const BUTTON_CLASS =
  'touch-none select-none rounded-full border-2 border-[#4a4234] bg-[#3a2f28]/80 text-2xl ' +
  'text-[#ff8c42] active:scale-95 active:bg-[#4a3a2e]'

export function TouchControls({ setInput }: TouchControlsProps) {
  const held = useRef({ left: false, right: false, jump: false })

  function pushInput() {
    const { left, right, jump } = held.current
    const moveX: FrameInput['moveX'] = left === right ? 0 : left ? -1 : 1
    setInput({ moveX, jumpHeld: jump })
  }

  // pointerLeave/pointerCancel cobrem o dedo arrastando pra fora do botão
  // sem soltar — sem isso, o input ficaria "preso" segurado indefinidamente.
  function onLeftDown(e: React.PointerEvent) {
    e.preventDefault()
    held.current.left = true
    pushInput()
  }
  function onLeftUp(e: React.PointerEvent) {
    e.preventDefault()
    held.current.left = false
    pushInput()
  }
  function onRightDown(e: React.PointerEvent) {
    e.preventDefault()
    held.current.right = true
    pushInput()
  }
  function onRightUp(e: React.PointerEvent) {
    e.preventDefault()
    held.current.right = false
    pushInput()
  }
  function onJumpDown(e: React.PointerEvent) {
    e.preventDefault()
    held.current.jump = true
    pushInput()
  }
  function onJumpUp(e: React.PointerEvent) {
    e.preventDefault()
    held.current.jump = false
    pushInput()
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-6">
      <div className="pointer-events-auto flex gap-4">
        <button
          type="button"
          aria-label="Mover à esquerda"
          className={`${BUTTON_CLASS} h-16 w-16`}
          onPointerDown={onLeftDown}
          onPointerUp={onLeftUp}
          onPointerLeave={onLeftUp}
          onPointerCancel={onLeftUp}
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Mover à direita"
          className={`${BUTTON_CLASS} h-16 w-16`}
          onPointerDown={onRightDown}
          onPointerUp={onRightUp}
          onPointerLeave={onRightUp}
          onPointerCancel={onRightUp}
        >
          ▶
        </button>
      </div>
      <button
        type="button"
        aria-label="Pular"
        className={`${BUTTON_CLASS} pointer-events-auto h-20 w-20`}
        onPointerDown={onJumpDown}
        onPointerUp={onJumpUp}
        onPointerLeave={onJumpUp}
        onPointerCancel={onJumpUp}
      >
        ⤒
      </button>
    </div>
  )
}

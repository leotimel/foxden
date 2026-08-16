/**
 * Adaptador de teclado → `FrameInput`.
 *
 * Fica fora do engine (que não pode tocar em DOM, ver o guardrail em
 * `engine/**`) mas não depende do Pixi — só escuta `keydown`/`keyup` e
 * empurra o `FrameInput` recalculado direto pro `setInput` da cena a cada
 * mudança. Sem polling por frame: o estado fica sempre corrente, e o
 * corte do pulo (`physics.ts`, "soltar durante a subida") vê o
 * `jumpHeld: false` no tick seguinte ao keyup, não um frame depois.
 */
import type { FrameInput } from '../engine/types'

const LEFT_CODES = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD'])
const JUMP_CODES = new Set(['Space'])
const TRACKED_CODES = new Set([...LEFT_CODES, ...RIGHT_CODES, ...JUMP_CODES])

function toFrameInput(held: ReadonlySet<string>): FrameInput {
  const left = [...LEFT_CODES].some((code) => held.has(code))
  const right = [...RIGHT_CODES].some((code) => held.has(code))
  const moveX: FrameInput['moveX'] = left === right ? 0 : left ? -1 : 1
  const jumpHeld = [...JUMP_CODES].some((code) => held.has(code))
  return { moveX, jumpHeld }
}

/**
 * Liga o teclado a `setInput` e devolve uma função de limpeza (remove os
 * listeners). Segurar esquerda+direita ao mesmo tempo cancela (`moveX: 0`).
 *
 * Trata perda de foco da janela (alt-tab, trocar de aba): sem isso, um
 * `keyup` que acontece fora da janela nunca chega, e o Fenn ficaria
 * correndo ou pulando pra sempre com uma tecla "presa".
 */
export function bindKeyboardInput(
  setInput: (input: FrameInput) => void,
  target: Window = window,
): () => void {
  const held = new Set<string>()

  function onKeyDown(e: KeyboardEvent) {
    if (!TRACKED_CODES.has(e.code)) return
    e.preventDefault()
    if (e.repeat) return
    held.add(e.code)
    setInput(toFrameInput(held))
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!TRACKED_CODES.has(e.code)) return
    held.delete(e.code)
    setInput(toFrameInput(held))
  }

  function onBlur() {
    if (held.size === 0) return
    held.clear()
    setInput(toFrameInput(held))
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)

  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('blur', onBlur)
  }
}

/**
 * Decide se os controles touch (Fase 4.1) devem aparecer: viewport mobile
 * OU nenhum teclado físico detectado — as duas condições do prompt, cada
 * uma bastando sozinha.
 *
 * `(pointer: coarse)` é o sinal padrão de "o ponteiro primário é
 * touch/dedo, não mouse" — mais confiável que só olhar a largura da
 * janela (um notebook redimensionado estreito continua tendo teclado; um
 * tablet grande continua sendo touch). Reativo a resize e a mudança do
 * media query (ex: virar o tablet, conectar/desconectar teclado).
 */
import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT_PX = 768

function computeShouldShow(): boolean {
  if (typeof window === 'undefined') return false
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const narrowViewport = window.innerWidth < MOBILE_BREAKPOINT_PX
  return coarsePointer || narrowViewport
}

export function useShouldShowTouchControls(): boolean {
  const [shouldShow, setShouldShow] = useState(computeShouldShow)

  useEffect(() => {
    const update = () => setShouldShow(computeShouldShow())
    window.addEventListener('resize', update)
    const pointerQuery = window.matchMedia('(pointer: coarse)')
    pointerQuery.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      pointerQuery.removeEventListener('change', update)
    }
  }, [])

  return shouldShow
}

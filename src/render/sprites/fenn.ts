/**
 * Placeholder geométrico do Fenn — um retângulo colorido.
 *
 * Ancorado no ponto que o engine usa como `pos`: a base/pé do personagem,
 * centralizado horizontalmente (ver `engine/physics.ts` — é onde o chão
 * provisório encosta quando `grounded` fica true). A arte real substitui
 * este retângulo depois sem mudar essa convenção de ancoragem.
 */
import { Graphics } from 'pixi.js'
import { FENN_HEIGHT_TILES, FENN_WIDTH_TILES, TILE_PX } from '../constants'

export function createFennSprite(): Graphics {
  const widthPx = FENN_WIDTH_TILES * TILE_PX
  const heightPx = FENN_HEIGHT_TILES * TILE_PX
  return new Graphics().rect(-widthPx / 2, -heightPx, widthPx, heightPx).fill(0xff8c42)
}

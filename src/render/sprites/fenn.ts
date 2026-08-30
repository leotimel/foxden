/**
 * Placeholder geométrico do Fenn — um retângulo colorido.
 *
 * Ancorado no ponto que o engine usa como `pos`: a base/pé do personagem,
 * centralizado horizontalmente (ver `engine/collision.ts`). A arte real
 * substitui este retângulo depois sem mudar essa convenção de ancoragem.
 *
 * `widthTiles`/`heightTiles` vêm de `PhysicsConfig` (`DEFAULT_CONFIG.width`/
 * `.height`), não de uma constante própria daqui — a caixa visual precisa
 * ser exatamente a caixa de colisão, senão o jogador vê uma coisa e o
 * motor colide com outra.
 */
import { Graphics } from 'pixi.js'
import { TILE_PX } from '../constants'

export function createFennSprite(widthTiles: number, heightTiles: number): Graphics {
  const widthPx = widthTiles * TILE_PX
  const heightPx = heightTiles * TILE_PX
  return new Graphics().rect(-widthPx / 2, -heightPx, widthPx, heightPx).fill(0xff8c42)
}

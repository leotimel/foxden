/**
 * Desenha os tiles sólidos de um `Tilemap` como retângulos coloridos.
 *
 * Um `rect()` por tile sólido — o tilemap de teste desta fase é pequeno
 * (dezenas de tiles), então não há necessidade de mesclar geometria ou
 * fazer chunking. Revisitar se/quando fases reais ficarem grandes o
 * bastante pra isso importar (Fase 2.3+).
 */
import { Graphics } from 'pixi.js'
import type { Tilemap } from '../../engine/level'
import { TILE_PX } from '../constants'

export function createTilemapSprite(tilemap: Tilemap): Graphics {
  const graphics = new Graphics()
  for (const key of tilemap.solid) {
    const [col, row] = key.split(',').map(Number)
    graphics.rect(col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX)
  }
  return graphics.fill(0x3a2f28)
}

/**
 * Colisão AABB do Fenn contra o tilemap (`level.ts`).
 *
 * Resolução por eixo, sem *sweep*: só checa a posição de DESTINO, não
 * varre o caminho entre origem e destino. Isso é seguro porque o
 * deslocamento por tick nunca chega perto de 1 tile (ver `assertSubTile`)
 * — não há risco de "pular" por cima de um tile fino sem nunca sobrepor.
 *
 * A caixa do Fenn é ancorada em `pos`: base (pé) no centro horizontal —
 * mesma convenção que a Fase 1 já documentou e que o render usa pro
 * placeholder visual. left=x-w/2, right=x+w/2, top=y-h, bottom=y.
 */
import type { Vec2 } from './types'
import { isSolidTile, type Tilemap } from './level'

/** Tolerância para "toque" (encostar sem sobrepor) não contar como colisão. */
const EPS = 1e-4

/**
 * Índice do tile em que uma borda MÍNIMA (esquerda/topo) de uma AABB cai.
 * O intervalo do tile é [n, n+1) — `floor` puro já casa com essa semântica.
 */
function minEdgeTile(edge: number): number {
  return Math.floor(edge)
}

/**
 * Índice do tile em que uma borda MÁXIMA (direita/baixo) de uma AABB cai.
 *
 * O epsilon aqui é o que distingue "toque" de "sobreposição real": sem ele,
 * uma borda exatamente encostada na fronteira de um tile (ex: o chão que o
 * Fenn está de pé em cima, ou uma parede que ele acabou de encostar) seria
 * lida como já colidindo. A regra é sempre esta — nunca aplicar epsilon do
 * outro lado (`minEdgeTile`) nem esquecer de aplicar aqui; os dois erros
 * geram o mesmo tipo de bug: o chão virar parede pra quem anda em cima
 * dele, ou uma parede virar teto/chão pra quem cai rente a ela.
 */
function maxEdgeTile(edge: number): number {
  return Math.floor(edge - EPS)
}

/** Levanta se o deslocamento deste tick for grande demais pro algoritmo de
 *  "checa só o destino" ser seguro (ver cabeçalho do arquivo). Barato
 *  (uma comparação) e vale a pena: se `fallSpeedMax`/`runSpeedMax` forem
 *  tunados alto demais no futuro, isso falha alto em vez de tunelizar
 *  tiles silenciosamente. */
function assertSubTileDisplacement(delta: number, axis: 'X' | 'Y'): void {
  if (Math.abs(delta) >= 1) {
    throw new Error(
      `collision: deslocamento de ${delta.toFixed(3)} tiles no eixo ${axis} ` +
        `num único tick — maior que 1 tile quebra a checagem de colisão ` +
        `(sem sweep). Revisar as constantes de velocidade em PhysicsConfig.`,
    )
  }
}

/** Resultado de resolver o movimento num eixo. */
export interface AxisResolution {
  /** Nova posição nesse eixo, já clampada se houve colisão. */
  position: number
  /** Colidiu com um tile sólido ao tentar se mover? */
  collided: boolean
}

/**
 * Resolve o movimento horizontal. Usa o `y` do INÍCIO do tick (a Fase Y
 * ainda não foi resolvida) — ver nota de ordem em `physics.ts`.
 */
export function resolveAxisX(
  x: number,
  y: number,
  width: number,
  height: number,
  dx: number,
  tilemap: Tilemap,
): AxisResolution {
  if (dx === 0) return { position: x, collided: false }
  assertSubTileDisplacement(dx, 'X')

  const candidateX = x + dx
  const top = y - height
  const bottom = y
  const rowMin = minEdgeTile(top)
  const rowMax = maxEdgeTile(bottom)

  if (dx > 0) {
    const col = maxEdgeTile(candidateX + width / 2)
    for (let row = rowMin; row <= rowMax; row++) {
      if (isSolidTile(tilemap, col, row)) {
        return { position: col - width / 2, collided: true }
      }
    }
  } else {
    const col = minEdgeTile(candidateX - width / 2)
    for (let row = rowMin; row <= rowMax; row++) {
      if (isSolidTile(tilemap, col, row)) {
        return { position: col + 1 + width / 2, collided: true }
      }
    }
  }
  return { position: candidateX, collided: false }
}

/**
 * Resolve o movimento vertical. Usa o `x` já resolvido por `resolveAxisX`
 * neste mesmo tick — ver nota de ordem em `physics.ts`.
 */
export function resolveAxisY(
  x: number,
  y: number,
  width: number,
  height: number,
  dy: number,
  tilemap: Tilemap,
): AxisResolution {
  if (dy === 0) return { position: y, collided: false }
  assertSubTileDisplacement(dy, 'Y')

  const candidateY = y + dy
  const left = x - width / 2
  const right = x + width / 2
  const colMin = minEdgeTile(left)
  const colMax = maxEdgeTile(right)

  if (dy > 0) {
    // Caindo: checa a borda de baixo.
    const row = maxEdgeTile(candidateY)
    for (let col = colMin; col <= colMax; col++) {
      if (isSolidTile(tilemap, col, row)) {
        return { position: row, collided: true }
      }
    }
  } else {
    // Subindo: checa a borda de cima.
    const row = minEdgeTile(candidateY - height)
    for (let col = colMin; col <= colMax; col++) {
      if (isSolidTile(tilemap, col, row)) {
        return { position: row + 1 + height, collided: true }
      }
    }
  }
  return { position: candidateY, collided: false }
}

/**
 * A AABB nesta posição já sobrepõe algum tile sólido? Usado uma vez, no
 * spawn (não a cada tick) — pega dado de fase quebrado (spawn dentro de
 * geometria sólida) antes que produza uma trajetória indefinida.
 */
export function isOverlapping(
  pos: Vec2,
  width: number,
  height: number,
  tilemap: Tilemap,
): boolean {
  const colMin = minEdgeTile(pos.x - width / 2)
  const colMax = maxEdgeTile(pos.x + width / 2)
  const rowMin = minEdgeTile(pos.y - height)
  const rowMax = maxEdgeTile(pos.y)
  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      if (isSolidTile(tilemap, col, row)) return true
    }
  }
  return false
}

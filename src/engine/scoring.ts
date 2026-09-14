/**
 * Estrelas (0-3) de uma corrida, com os 3 critérios do GAME_DESIGN.md:
 * colecionáveis pegos, ausência de morte, tempo sob um limite ("par
 * time", `LevelData.parTimeSeconds`). Interpretação adotada: cada
 * critério vale exatamente 1 estrela — uma corrida que chega na saída
 * sem cumprir nenhum dos três fica com 0. O doc fala em "1-3", mas isso
 * descreve o caso típico (a maioria das corridas cumpre pelo menos um
 * critério), não um piso artificial — mais simples e mais honesto do que
 * inventar uma 4ª regra só pra garantir o mínimo de 1.
 *
 * Camada separada de `lifecycle.ts` de propósito: aquele cuida de
 * morte/respawn DURANTE a corrida; este cuida de MEDIR o resultado
 * (coleta, tempo) e decidir quando ela termina (chegou na saída).
 * Colecionáveis não fazem parte do tilemap (posições livres, não
 * alinhadas a grid) — usam overlap AABB-vs-ponto simples, não a malha
 * esparsa de `collision.ts`.
 */
import { FIXED_DT } from './physics'
import type { Vec2 } from './types'

/** Meio-lado do "hitbox" de coleta, em tiles. */
const COLLECTIBLE_HALF_SIZE = 0.3

/** O Fenn (ancorado na base, ver `physics.ts`) sobrepõe um ponto (ancorado
 *  no centro) com a meia-largura `halfSize`? */
function overlapsPoint(
  fennPos: Vec2,
  width: number,
  height: number,
  point: Vec2,
  halfSize: number,
): boolean {
  const fennLeft = fennPos.x - width / 2
  const fennRight = fennPos.x + width / 2
  const fennTop = fennPos.y - height
  const fennBottom = fennPos.y
  return (
    fennLeft < point.x + halfSize &&
    fennRight > point.x - halfSize &&
    fennTop < point.y + halfSize &&
    fennBottom > point.y - halfSize
  )
}

/** Progresso de uma corrida (uma tentativa de fase, do spawn até a saída
 *  ou até desistir). Sobrevive a mortes/respawns — colecionáveis pegos e
 *  tempo decorrido não resetam ao morrer. */
export interface RunState {
  collected: ReadonlySet<number>
  elapsedTicks: number
}

export function createRunState(): RunState {
  return { collected: new Set(), elapsedTicks: 0 }
}

/** Roda uma vez por tick de física: soma o tempo e marca colecionáveis
 *  recém-tocados. Puro — não muta `run`. */
export function updateRun(
  run: RunState,
  fennPos: Vec2,
  width: number,
  height: number,
  collectibles: readonly Vec2[],
): RunState {
  let collected: ReadonlySet<number> = run.collected
  collectibles.forEach((point, i) => {
    if (!collected.has(i) && overlapsPoint(fennPos, width, height, point, COLLECTIBLE_HALF_SIZE)) {
      collected = new Set([...collected, i])
    }
  })
  return { collected, elapsedTicks: run.elapsedTicks + 1 }
}

/**
 * A saída da fase foi alcançada? Tratada como uma LINHA vertical de
 * chegada em `exit.x` (não um ponto com hitbox precisa) — um Fenn rápido
 * ou ainda no ar ao final de um pulo pode cruzar a coordenada X da saída
 * bem longe da altura exata dela; exigir sobreposição vertical também
 * faria essa corrida nunca "terminar" (foi o que aconteceu na primeira
 * versão desta função, pega por `tutorialLevels.test.ts`: a Tutorial 4
 * cruza a saída em pleno ar, descendo da última plataforma). `exit.y`
 * fica no `LevelData` mesmo assim — útil pra posicionar visualmente um
 * marcador de saída depois, só não entra nesta checagem.
 */
export function hasReachedExit(fennPos: Vec2, width: number, exit: Vec2): boolean {
  return fennPos.x + width / 2 >= exit.x
}

export interface StarResult {
  stars: 0 | 1 | 2 | 3
  collectedAll: boolean
  noDeath: boolean
  underParTime: boolean
}

/**
 * Calcula as estrelas de uma corrida já concluída (chegou na saída).
 * `livesRemaining`/`startingLives` vêm de `LifecycleState`/`STARTING_LIVES`
 * (`lifecycle.ts`) — "sem morte" é `livesRemaining === startingLives`.
 */
export function calculateStars(
  run: RunState,
  totalCollectibles: number,
  livesRemaining: number,
  startingLives: number,
  parTimeSeconds: number,
): StarResult {
  const collectedAll = totalCollectibles === 0 || run.collected.size >= totalCollectibles
  const noDeath = livesRemaining === startingLives
  const underParTime = run.elapsedTicks * FIXED_DT <= parTimeSeconds
  const stars = [collectedAll, noDeath, underParTime].filter(Boolean).length as 0 | 1 | 2 | 3
  return { stars, collectedAll, noDeath, underParTime }
}

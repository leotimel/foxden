/**
 * Vidas e checkpoints — o que acontece quando o Fenn morre.
 *
 * Vidas afetam SOMENTE pontuação (`GAME_DESIGN.md`): nunca bloqueiam o jogo
 * nem forçam reinício total, mesmo chegando a zero — só contam quantas
 * vezes o jogador morreu nesta tentativa, para o critério "sem morte" das
 * estrelas (Fase 3.3). Morrer (cair no vazio ou tocar um hazard) sempre
 * respawna no último checkpoint tocado, sem outra penalidade.
 *
 * Camada separada de `physics.ts` de propósito: a física (já validada e
 * testada) não precisa saber que hazards/checkpoints existem. Isso roda
 * DEPOIS de `physics.step()` no mesmo tick — ver `scene.ts`.
 */
import { findOverlappingTile, isOverlappingSet } from './collision'
import type { Tilemap } from './level'
import { createState } from './physics'
import type { PhysicsState, Vec2 } from './types'

export const STARTING_LIVES = 3

export interface LifecycleState {
  /** Nunca vai abaixo de 0 — não existe "game over", só o contador para. */
  lives: number
  /** Ponto de respawn atual: começa no spawn da fase, avança a cada
   *  checkpoint tocado. */
  checkpoint: Vec2
}

export function createLifecycleState(spawn: Vec2): LifecycleState {
  return { lives: STARTING_LIVES, checkpoint: spawn }
}

/**
 * Ponto de respawn de um checkpoint: a base do tile logo abaixo dele —
 * mesma convenção de `pos` (pé/base, centralizado). Pressupõe que o nível
 * coloca o marcador de checkpoint sobre chão sólido; não há guarda pra
 * isso aqui (o guardião equivalente pro spawn, em `scene.ts`, roda uma vez
 * na criação da cena — checkpoints são tocados em runtime, então falhar
 * alto ali derrubaria uma partida em andamento por um erro de autoria).
 */
function checkpointRespawnPoint(col: number, row: number): Vec2 {
  return { x: col + 0.5, y: row + 1 }
}

export interface LifecycleResult {
  physics: PhysicsState
  lifecycle: LifecycleState
  /** true só no tick em que a morte aconteceu — para UI/som futuros. */
  justDied: boolean
}

/**
 * Roda depois de `physics.step()` no mesmo tick.
 *
 * Prioridade: morte antes de checkpoint. Se a AABB sobrepõe hazard E
 * checkpoint no mesmo tick (não deveria acontecer com level design são,
 * mas o comportamento precisa ser determinístico), morrer vence — não faz
 * sentido "salvar" o checkpoint no exato tile em que você morreu.
 */
export function resolveLifecycle(
  physics: PhysicsState,
  lifecycle: LifecycleState,
  width: number,
  height: number,
  tilemap: Tilemap,
  voidY: number,
): LifecycleResult {
  const fellIntoVoid = physics.pos.y > voidY
  const touchedHazard = isOverlappingSet(physics.pos, width, height, tilemap.hazards)

  if (fellIntoVoid || touchedHazard) {
    return {
      physics: createState(lifecycle.checkpoint, true),
      lifecycle: { ...lifecycle, lives: Math.max(0, lifecycle.lives - 1) },
      justDied: true,
    }
  }

  const touched = findOverlappingTile(physics.pos, width, height, tilemap.checkpoints)
  if (touched) {
    return {
      physics,
      lifecycle: { ...lifecycle, checkpoint: checkpointRespawnPoint(touched.col, touched.row) },
      justDied: false,
    }
  }

  return { physics, lifecycle, justDied: false }
}

import { describe, expect, it } from 'vitest'
import { createLifecycleState, resolveLifecycle, STARTING_LIVES } from './lifecycle'
import { createState } from './physics'
import { tilemapFromRows } from './level'

const W = 1
const H = 2
const SPAWN = { x: 1, y: 3 }
const VOID_Y = 20

/**
 * Chão sólido em row 3; hazard em (1,2) e checkpoint em (9,2) — uma linha
 * ACIMA do chão, "na altura do corpo" de quem está parado nele (mesma
 * convenção de `checkpointRespawnPoint`: o respawn de um checkpoint em
 * (col,row) é `row+1`, ou seja, pressupõe chão sólido logo abaixo).
 */
const ROOM = tilemapFromRows(['..........', '..........', '.^.......C', '##########'])

/** Fenn parado sobre o chão da ROOM (bottom=3, ocupa rows 1-2). */
function onFloor(x: number): ReturnType<typeof createState> {
  return createState({ x, y: 3 }, true)
}

describe('vidas', () => {
  it('morrer decrementa vidas', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = createState({ x: 0, y: VOID_Y + 1 })
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.lifecycle.lives).toBe(STARTING_LIVES - 1)
  })

  it('não bloqueia o jogo em zero — continua morrendo e respawnando', () => {
    let lifecycle = createLifecycleState(SPAWN)
    for (let i = 0; i < STARTING_LIVES + 3; i++) {
      const physics = createState({ x: 0, y: VOID_Y + 1 })
      lifecycle = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y).lifecycle
    }
    expect(lifecycle.lives).toBe(0)
  })
})

describe('morte por vazio', () => {
  it('pos.y além de voidY respawna no checkpoint atual', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = createState({ x: 99, y: VOID_Y + 0.1 })
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.physics.pos).toEqual(SPAWN)
    expect(r.justDied).toBe(true)
  })

  it('respawn zera velocidade e timers (fresh state, sem inércia residual)', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const caindoRapido = { ...createState({ x: 0, y: VOID_Y + 1 }), vel: { x: 5, y: 30 } }
    const r = resolveLifecycle(caindoRapido, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.physics.vel).toEqual({ x: 0, y: 0 })
  })

  it('não morre antes do limite', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = createState({ x: 0, y: VOID_Y })
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.justDied).toBe(false)
    expect(r.lifecycle.lives).toBe(STARTING_LIVES)
  })
})

describe('morte por hazard', () => {
  it('tocar um tile de hazard mata e respawna no checkpoint atual', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = onFloor(1.5) // corpo sobrepõe o hazard em (1,2)
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.justDied).toBe(true)
    expect(r.physics.pos).toEqual(SPAWN)
    expect(r.lifecycle.lives).toBe(STARTING_LIVES - 1)
  })

  it('andar no chão longe do hazard não morre', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = onFloor(5)
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.justDied).toBe(false)
  })
})

describe('checkpoint', () => {
  it('tocar um checkpoint vira o novo ponto de respawn, sem afetar física/vidas', () => {
    const lifecycle = createLifecycleState(SPAWN)
    const physics = onFloor(9.5) // corpo sobrepõe o checkpoint em (9,2)
    const r = resolveLifecycle(physics, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.justDied).toBe(false)
    expect(r.lifecycle.lives).toBe(STARTING_LIVES)
    expect(r.physics).toBe(physics) // não mexe no estado de física
    expect(r.lifecycle.checkpoint).toEqual({ x: 9.5, y: 3 }) // col+0.5, row+1 → pousa no chão
  })

  it('morrer DEPOIS de tocar um checkpoint respawna nele, não no spawn original', () => {
    let lifecycle = createLifecycleState(SPAWN)
    lifecycle = resolveLifecycle(onFloor(9.5), lifecycle, W, H, ROOM, VOID_Y).lifecycle
    expect(lifecycle.checkpoint).not.toEqual(SPAWN)

    const morrendo = createState({ x: 20, y: VOID_Y + 1 })
    const r = resolveLifecycle(morrendo, lifecycle, W, H, ROOM, VOID_Y)
    expect(r.physics.pos).toEqual(lifecycle.checkpoint)
    expect(r.physics.pos).not.toEqual(SPAWN)
  })

  it('morrer e tocar checkpoint no mesmo tick: morte vence', () => {
    // Hazard e checkpoint adjacentes; caixa larga o bastante pra sobrepor
    // os dois ao mesmo tempo — cenário de autoria ruim, mas o resultado
    // precisa ser determinístico mesmo assim.
    const both = tilemapFromRows(['^C'])
    const lifecycle = createLifecycleState(SPAWN)
    const physics = createState({ x: 1, y: 1 }, true) // largura 3 cobre col -1..2
    const r = resolveLifecycle(physics, lifecycle, 3, 1, both, VOID_Y)
    expect(r.justDied).toBe(true)
    expect(r.lifecycle.checkpoint).toEqual(SPAWN) // não avançou pro checkpoint
  })
})

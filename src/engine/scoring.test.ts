import { describe, expect, it } from 'vitest'
import {
  calculateStars,
  createRunState,
  hasReachedExit,
  updateRun,
  type RunState,
} from './scoring'
import { STARTING_LIVES } from './lifecycle'
import { FIXED_DT } from './physics'

const COLLECTIBLES = [
  { x: 5, y: 5 },
  { x: 10, y: 5 },
]

describe('updateRun', () => {
  it('soma um tick e não coleta nada longe dos colecionáveis', () => {
    const run = updateRun(createRunState(), { x: 0, y: 0 }, 0.8, 1.5, COLLECTIBLES)
    expect(run.elapsedTicks).toBe(1)
    expect(run.collected.size).toBe(0)
  })

  it('marca um colecionável tocado, sem duplicar em ticks seguintes', () => {
    let run = createRunState()
    run = updateRun(run, { x: 5, y: 5 }, 0.8, 1.5, COLLECTIBLES)
    expect(run.collected.has(0)).toBe(true)
    expect(run.collected.has(1)).toBe(false)

    run = updateRun(run, { x: 5, y: 5 }, 0.8, 1.5, COLLECTIBLES)
    expect(run.collected.size).toBe(1) // ainda 1, não 2 — não recolhe de novo
  })

  it('tempo decorrido continua somando mesmo sem coletar nada novo', () => {
    let run = createRunState()
    for (let i = 0; i < 5; i++) {
      run = updateRun(run, { x: 0, y: 0 }, 0.8, 1.5, COLLECTIBLES)
    }
    expect(run.elapsedTicks).toBe(5)
  })

  it('coleta os dois independentemente, em ticks diferentes', () => {
    let run = createRunState()
    run = updateRun(run, { x: 5, y: 5 }, 0.8, 1.5, COLLECTIBLES)
    run = updateRun(run, { x: 10, y: 5 }, 0.8, 1.5, COLLECTIBLES)
    expect(run.collected.size).toBe(2)
  })

  it('sobrevive a um "respawn" simulado — não reseta ao continuar chamando', () => {
    let run = createRunState()
    run = updateRun(run, { x: 5, y: 5 }, 0.8, 1.5, COLLECTIBLES) // coleta
    // "morre e respawna" (posição muda, mas o RunState não é recriado)
    run = updateRun(run, { x: 0, y: 0 }, 0.8, 1.5, COLLECTIBLES)
    expect(run.collected.has(0)).toBe(true) // continua coletado
  })
})

describe('hasReachedExit', () => {
  // Linha vertical de chegada em exit.x, não um ponto com hitbox precisa
  // — um Fenn ainda no ar ao cruzar essa coordenada (ex: descendo de uma
  // plataforma bem acima ou abaixo da altura da saída) ainda conta.
  const exit = { x: 20, y: 8 }

  it('true ao cruzar exit.x, mesmo longe da altura Y da saída', () => {
    expect(hasReachedExit({ x: 20, y: 8 }, 0.8, exit)).toBe(true)
    expect(hasReachedExit({ x: 20.5, y: 0 }, 0.8, exit)).toBe(true) // bem acima, mas já passou
    expect(hasReachedExit({ x: 20.5, y: 30 }, 0.8, exit)).toBe(true) // bem abaixo, mas já passou
  })

  it('false antes de alcançar exit.x', () => {
    expect(hasReachedExit({ x: 0, y: 8 }, 0.8, exit)).toBe(false)
    expect(hasReachedExit({ x: 19.5, y: 8 }, 0.8, exit)).toBe(false) // ainda 0.1 tile antes
  })
})

describe('calculateStars', () => {
  const PAR = 10 // segundos

  function runOf(ticks: number, collectedCount: number): RunState {
    const collected = new Set<number>()
    for (let i = 0; i < collectedCount; i++) collected.add(i)
    return { collected, elapsedTicks: ticks }
  }

  it('3 estrelas: coletou tudo, sem morrer, dentro do tempo', () => {
    const run = runOf(PAR * 60 - 60, 2) // 1s de sobra
    const r = calculateStars(run, 2, STARTING_LIVES, STARTING_LIVES, PAR)
    expect(r).toEqual({ stars: 3, collectedAll: true, noDeath: true, underParTime: true })
  })

  it('0 estrelas: nenhum critério cumprido', () => {
    const run = runOf(PAR * 60 + 600, 0) // 10s acima do par
    const r = calculateStars(run, 2, 0, STARTING_LIVES, PAR)
    expect(r).toEqual({ stars: 0, collectedAll: false, noDeath: false, underParTime: false })
  })

  it('sem colecionáveis na fase, o critério de coleta é sempre satisfeito', () => {
    const run = runOf(1, 0)
    const r = calculateStars(run, 0, STARTING_LIVES, STARTING_LIVES, PAR)
    expect(r.collectedAll).toBe(true)
  })

  it('morrer uma vez só (lives < starting) reprova o critério de morte', () => {
    const run = runOf(1, 2)
    const r = calculateStars(run, 2, STARTING_LIVES - 1, STARTING_LIVES, PAR)
    expect(r.noDeath).toBe(false)
    expect(r.stars).toBe(2)
  })

  it('exatamente no limite de tempo ainda conta como dentro do par', () => {
    const run = runOf(Math.round(PAR / FIXED_DT), 0)
    const r = calculateStars(run, 0, STARTING_LIVES, STARTING_LIVES, PAR)
    expect(r.underParTime).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { STARTING_LIVES, createLifecycleState, resolveLifecycle } from './lifecycle'
import { loadLevel, type LevelData, type LoadedLevel } from './level'
import { DEFAULT_CONFIG, createState, step } from './physics'
import type { FrameInput, PhysicsState } from './types'
import tutorial1 from '../levels/tutorial/tutorial-1.json'
import tutorial2 from '../levels/tutorial/tutorial-2.json'
import tutorial3 from '../levels/tutorial/tutorial-3.json'
import tutorial4 from '../levels/tutorial/tutorial-4.json'

/**
 * Prova de completabilidade das fases do mundo-tutorial: em vez de jogar
 * manualmente, roda um "piloto automático" determinístico contra o motor
 * de verdade (mesma `step`/`resolveLifecycle` que `scene.ts` usa) e
 * verifica que ele chega no `exit` sem nenhuma morte no caminho.
 *
 * Por que não testes interativos (Playwright) como nas fases anteriores:
 * o timing real de browser variou entre execuções nas fases 2.1/2.2 (o
 * mesmo gesto às vezes limpava um buraco, às vezes não). Aqui o "piloto"
 * decide pular a partir da posição EXATA simulada a cada tick, não de uma
 * amostragem por tempo real — determinístico de verdade, sem flakiness.
 *
 * Dois perfis de pulo, medidos empiricamente (o corte SEMPRE clampa `vy`
 * pro mesmo `jumpCutSpeed`, mas a altura já ganha até o release depende de
 * quanto tempo segurou — não é binário como pareceria à primeira vista):
 * CURTO (hold=2, ápice ~1.4 tile, alcance ~3.45 tiles) e LONGO (hold>=11,
 * platô de ápice ~3.34 tiles, alcance ~5.55 tiles — usamos 20 por margem).
 */

const SHORT_HOLD = 2
const LONG_HOLD = 20

interface JumpTrigger {
  /** Dispara o pulo no primeiro tick em que, estando no chão, `pos.x`
   *  ultrapassa este valor. */
  afterX: number
  holdTicks: number
}

/**
 * Para assim que `pos.x` alcança `exitX` — sem isso, o "piloto" continua
 * segurando direita pra sempre e corre pra fora do fim do mapa (nenhum
 * nível tem parede depois da saída), caindo no vazio por um motivo que
 * nada tem a ver com o desafio em si.
 */
function autoplay(
  level: LoadedLevel,
  voidY: number,
  exitX: number,
  triggers: readonly JumpTrigger[],
  maxTicks: number,
) {
  let physics: PhysicsState = createState(level.spawn, true)
  let lifecycle = createLifecycleState(level.spawn)
  let triggerIndex = 0
  let holdRemaining = 0
  let minLives = lifecycle.lives

  for (let i = 0; i < maxTicks && physics.pos.x < exitX; i++) {
    if (
      holdRemaining === 0 &&
      triggerIndex < triggers.length &&
      physics.grounded &&
      physics.pos.x > triggers[triggerIndex].afterX
    ) {
      holdRemaining = triggers[triggerIndex].holdTicks
      triggerIndex++
    }
    const jumpHeld = holdRemaining > 0
    if (holdRemaining > 0) holdRemaining--

    const input: FrameInput = { moveX: 1, jumpHeld }
    physics = step(physics, input, DEFAULT_CONFIG, level.tilemap)
    const resolved = resolveLifecycle(
      physics,
      lifecycle,
      DEFAULT_CONFIG.width,
      DEFAULT_CONFIG.height,
      level.tilemap,
      voidY,
    )
    physics = resolved.physics
    lifecycle = resolved.lifecycle
    if (lifecycle.lives < minLives) minLives = lifecycle.lives
  }

  return { physics, lifecycle, minLives, triggersUsed: triggerIndex }
}

function load(data: LevelData) {
  return { level: loadLevel(data), voidY: data.height }
}

describe('tutorial-1: corrida básica', () => {
  it('completável correndo, com pulos curtos nos dois buracos, sem morrer', () => {
    const { level, voidY } = load(tutorial1)
    const triggers: JumpTrigger[] = [
      { afterX: 5.5, holdTicks: SHORT_HOLD },
      { afterX: 15.5, holdTicks: SHORT_HOLD },
    ]
    const result = autoplay(level, voidY, tutorial1.exit.x, triggers, 250)
    expect(result.minLives).toBe(STARTING_LIVES) // nenhuma morte
    expect(result.physics.pos.x).toBeGreaterThanOrEqual(tutorial1.exit.x)
  })
})

describe('tutorial-2: pulo curto vs. longo', () => {
  it('exige pulo curto sob o teto e pulo longo no buraco largo', () => {
    const { level, voidY } = load(tutorial2)
    const triggers: JumpTrigger[] = [
      { afterX: 11.5, holdTicks: SHORT_HOLD }, // sob o teto baixo
      { afterX: 22.5, holdTicks: LONG_HOLD }, // buraco largo
    ]
    const result = autoplay(level, voidY, tutorial2.exit.x, triggers, 320)
    expect(result.minLives).toBe(STARTING_LIVES)
    expect(result.physics.pos.x).toBeGreaterThanOrEqual(tutorial2.exit.x)
  })

  it('pulo LONGO sob o teto baixo bate a cabeça (prova que a restrição é real)', () => {
    const { level, voidY } = load(tutorial2)
    // Mesmo desafio do teto, mas com pulo longo — deve falhar (cair no
    // buraco sob o teto, já que bateu a cabeça e perdeu o impulso).
    const triggers: JumpTrigger[] = [{ afterX: 11.5, holdTicks: LONG_HOLD }]
    const result = autoplay(level, voidY, tutorial2.exit.x, triggers, 200)
    expect(result.minLives).toBeLessThan(STARTING_LIVES)
  })
})

describe('tutorial-3: timing de plataformas', () => {
  it('a sequência de 4 plataformas é vencível só com pulos longos, sem morrer', () => {
    const { level, voidY } = load(tutorial3)
    const triggers: JumpTrigger[] = [
      { afterX: 4.5, holdTicks: LONG_HOLD }, // chão -> plataforma A
      { afterX: 9.5, holdTicks: LONG_HOLD }, // A -> B
      { afterX: 14.5, holdTicks: LONG_HOLD }, // B -> C
      { afterX: 19.5, holdTicks: LONG_HOLD }, // C -> D
      { afterX: 24.5, holdTicks: LONG_HOLD }, // D -> chão final
    ]
    const result = autoplay(level, voidY, tutorial3.exit.x, triggers, 400)
    expect(result.minLives).toBe(STARTING_LIVES)
    expect(result.physics.pos.x).toBeGreaterThanOrEqual(tutorial3.exit.x)
  })
})

describe('tutorial-4: síntese', () => {
  it('combina buraco pequeno, teto+pulo curto, buraco largo e 2 plataformas, sem morrer', () => {
    const { level, voidY } = load(tutorial4)
    const triggers: JumpTrigger[] = [
      { afterX: 4.5, holdTicks: SHORT_HOLD }, // buraco pequeno
      { afterX: 13.5, holdTicks: SHORT_HOLD }, // sob o teto baixo
      { afterX: 24.5, holdTicks: LONG_HOLD }, // buraco largo
      { afterX: 31.5, holdTicks: LONG_HOLD }, // chão -> plataforma 1
      { afterX: 34.5, holdTicks: LONG_HOLD }, // plataforma 1 -> 2
      { afterX: 39.5, holdTicks: LONG_HOLD }, // plataforma 2 -> chão final
    ]
    const result = autoplay(level, voidY, tutorial4.exit.x, triggers, 450)
    expect(result.minLives).toBe(STARTING_LIVES)
    expect(result.physics.pos.x).toBeGreaterThanOrEqual(tutorial4.exit.x)
  })
})

describe('sanidade dos dados', () => {
  it.each([
    ['tutorial-1', tutorial1],
    ['tutorial-2', tutorial2],
    ['tutorial-3', tutorial3],
    ['tutorial-4', tutorial4],
  ])('%s: spawn não sobrepõe geometria sólida, tem checkpoint e colecionáveis', (_name, data) => {
    const { level } = load(data as LevelData)
    expect(level.collectibles.length).toBeGreaterThan(0)
    expect(level.tilemap.checkpoints.size).toBeGreaterThan(0)
    // spawn "no chão" = 1 tick parado não deveria estar caindo indefinidamente
    const settled = step(
      createState(level.spawn, true),
      { moveX: 0, jumpHeld: false },
      DEFAULT_CONFIG,
      level.tilemap,
    )
    expect(settled.grounded).toBe(true)
  })
})

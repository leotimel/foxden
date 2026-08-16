import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, createState, simulate, step } from './physics'
import type { FrameInput, PhysicsState } from './types'

/**
 * Os testes se dividem em dois grupos, de propósito.
 *
 * Os *invariantes* afirmam relações ("segurar o botão sobe mais que soltar
 * cedo"), não números — sobrevivem ao tuning das constantes que o CHECKPOINT
 * da Fase 1 vai exigir. A *guarda de regressão* no fim é o oposto: trava uma
 * trajetória exata, para que uma mudança acidental no feel apareça. Quando o
 * tuning for intencional, aquele snapshot é atualizado de propósito.
 */

const IDLE: FrameInput = { moveX: 0, jumpHeld: false }
const RIGHT: FrameInput = { moveX: 1, jumpHeld: false }
const JUMP: FrameInput = { moveX: 0, jumpHeld: true }
const RIGHT_JUMP: FrameInput = { moveX: 1, jumpHeld: true }

const cfg = DEFAULT_CONFIG

/** `n` frames do mesmo input. */
function inputs(n: number, input: FrameInput): FrameInput[] {
  return Array.from({ length: n }, () => input)
}

/** Fenn parado sobre o chão. */
function onGround(): PhysicsState {
  return createState({ x: 0, y: cfg.floorY }, true)
}

/** Fenn no ar, `frames` frames depois de ter deixado o chão. */
function afterLeavingLedge(frames: number): PhysicsState {
  return { ...createState({ x: 0, y: cfg.floorY - 2 }), framesSinceGrounded: frames }
}

function last(trajectory: PhysicsState[]): PhysicsState {
  return trajectory[trajectory.length - 1]
}

/** Altura máxima atingida (Y cresce pra baixo, então o ápice é o menor Y). */
function apexHeight(trajectory: PhysicsState[]): number {
  return cfg.floorY - Math.min(...trajectory.map((s) => s.pos.y))
}

describe('determinismo', () => {
  it('mesma sequência de inputs → trajetória idêntica', () => {
    const seq = [...inputs(5, RIGHT), ...inputs(10, RIGHT_JUMP), ...inputs(40, RIGHT)]
    expect(simulate(onGround(), seq, cfg)).toEqual(simulate(onGround(), seq, cfg))
  })

  it('step não muta o estado recebido', () => {
    const state = onGround()
    const antes = structuredClone(state)
    step(state, RIGHT_JUMP, cfg)
    expect(state).toEqual(antes)
  })
})

describe('inércia horizontal', () => {
  it('não atinge a velocidade máxima no primeiro frame', () => {
    const [primeiro] = simulate(onGround(), inputs(1, RIGHT), cfg)
    expect(primeiro.vel.x).toBeGreaterThan(0)
    expect(primeiro.vel.x).toBeLessThan(cfg.runSpeedMax)
  })

  it('chega na velocidade máxima e não a ultrapassa', () => {
    const t = simulate(onGround(), inputs(60, RIGHT), cfg)
    expect(last(t).vel.x).toBeCloseTo(cfg.runSpeedMax)
  })

  it('ao soltar, desacelera aos poucos em vez de parar na hora', () => {
    const correndo = last(simulate(onGround(), inputs(60, RIGHT), cfg))
    const [depois] = simulate(correndo, inputs(1, IDLE), cfg)
    expect(depois.vel.x).toBeLessThan(correndo.vel.x)
    expect(depois.vel.x).toBeGreaterThan(0)
  })

  it('para de fato quando a desaceleração termina', () => {
    const correndo = last(simulate(onGround(), inputs(60, RIGHT), cfg))
    expect(last(simulate(correndo, inputs(60, IDLE), cfg)).vel.x).toBe(0)
  })

  it('controle aéreo é mais fraco que o do chão', () => {
    const noChao = simulate(onGround(), inputs(1, RIGHT), cfg)
    const noAr = simulate(afterLeavingLedge(99), inputs(1, RIGHT), cfg)
    expect(last(noAr).vel.x).toBeLessThan(last(noChao).vel.x)
  })
})

describe('pulo de altura variável', () => {
  it('segurar o botão sobe mais alto que soltar cedo', () => {
    const segurando = simulate(onGround(), inputs(120, JUMP), cfg)
    const soltandoCedo = simulate(
      onGround(),
      [...inputs(3, JUMP), ...inputs(117, IDLE)],
      cfg,
    )
    expect(apexHeight(soltandoCedo)).toBeGreaterThan(0)
    expect(apexHeight(segurando)).toBeGreaterThan(apexHeight(soltandoCedo))
  })

  it('quanto mais tempo segurando, mais alto — até o teto do impulso', () => {
    const alturas = [2, 6, 10, 20].map((frames) =>
      apexHeight(
        simulate(onGround(), [...inputs(frames, JUMP), ...inputs(120, IDLE)], cfg),
      ),
    )
    for (let i = 1; i < alturas.length; i++) {
      expect(alturas[i]).toBeGreaterThanOrEqual(alturas[i - 1])
    }
  })

  it('segurar o botão não faz pular de novo ao aterrissar', () => {
    const t = simulate(onGround(), inputs(120, JUMP), cfg)
    const pouso = t.findIndex((s, i) => i > 5 && s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).every((s) => s.vel.y >= 0)).toBe(true)
  })
})

describe('gravidade', () => {
  it('cair é mais rápido que subir (gravidade assimétrica)', () => {
    const t = simulate(onGround(), inputs(120, JUMP), cfg)
    const apice = t.reduce((melhor, s, i) => (s.pos.y < t[melhor].pos.y ? i : melhor), 0)
    const pouso = t.findIndex((s, i) => i > apice && s.grounded)
    const subida = apice + 1
    const queda = pouso - apice
    expect(queda).toBeLessThan(subida)
  })

  it('a queda satura na velocidade terminal', () => {
    const t = simulate(createState({ x: 0, y: cfg.floorY - 1000 }), inputs(300, IDLE), cfg)
    expect(last(t).vel.y).toBeCloseTo(cfg.fallSpeedMax)
  })
})

describe('coyote time', () => {
  it('ainda dá pra pular dentro da janela depois de sair da beirada', () => {
    const [s] = simulate(afterLeavingLedge(cfg.coyoteFrames), inputs(1, JUMP), cfg)
    expect(s.vel.y).toBeLessThan(0)
  })

  it('depois da janela, não pula mais', () => {
    const [s] = simulate(afterLeavingLedge(cfg.coyoteFrames + 1), inputs(1, JUMP), cfg)
    expect(s.vel.y).toBeGreaterThan(0)
  })

  it('não vira pulo duplo: apertar de novo no ar logo após pular não faz nada', () => {
    const seq = [JUMP, ...inputs(2, IDLE), JUMP, ...inputs(60, IDLE)]
    const t = simulate(onGround(), seq, cfg)
    const noAr = t.filter((s) => !s.grounded)
    // Só a gravidade age: vy sobe monotonicamente. Um segundo pulo jogaria vy
    // de volta lá pra baixo e quebraria isso.
    for (let i = 1; i < noAr.length; i++) {
      expect(noAr[i].vel.y).toBeGreaterThanOrEqual(noAr[i - 1].vel.y)
    }
  })
})

describe('jump buffer', () => {
  it('press pouco antes de aterrissar dispara o pulo ao tocar o chão', () => {
    const t = simulate(
      createState({ x: 0, y: cfg.floorY - 0.2 }),
      [JUMP, ...inputs(30, IDLE)],
      cfg,
    )
    const pouso = t.findIndex((s) => s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).some((s) => s.vel.y < 0)).toBe(true)
  })

  it('press cedo demais expira sem disparar', () => {
    const t = simulate(
      createState({ x: 0, y: cfg.floorY - 5 }),
      [JUMP, ...inputs(60, IDLE)],
      cfg,
    )
    const pouso = t.findIndex((s) => s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).every((s) => s.vel.y >= 0)).toBe(true)
  })
})

describe('guarda de regressão', () => {
  it('trajetória de referência de corrida + pulo', () => {
    const seq = [
      ...inputs(10, RIGHT),
      ...inputs(12, RIGHT_JUMP),
      ...inputs(38, RIGHT),
    ]
    const t = simulate(onGround(), seq, cfg)
    const r = (n: number) => Math.round(n * 1000) / 1000
    const amostra = [0, 9, 15, 21, 29, 39, 59].map((frame) => ({
      frame,
      x: r(t[frame].pos.x),
      y: r(t[frame].pos.y),
      vx: r(t[frame].vel.x),
      vy: r(t[frame].vel.y),
    }))
    expect(amostra).toMatchInlineSnapshot(`
      [
        {
          "frame": 0,
          "vx": 0.6,
          "vy": 0,
          "x": 0.01,
          "y": 0,
        },
        {
          "frame": 9,
          "vx": 6,
          "vy": 0,
          "x": 0.55,
          "y": 0,
        },
        {
          "frame": 15,
          "vx": 8.55,
          "vy": -14.3,
          "x": 1.307,
          "y": -1.667,
        },
        {
          "frame": 21,
          "vx": 9,
          "vy": -8.6,
          "x": 2.206,
          "y": -2.765,
        },
        {
          "frame": 29,
          "vx": 9,
          "vy": -1,
          "x": 3.406,
          "y": -3.342,
        },
        {
          "frame": 39,
          "vx": 9,
          "vy": 13.833,
          "x": 4.907,
          "y": -2.238,
        },
        {
          "frame": 59,
          "vx": 9,
          "vy": 0,
          "x": 7.907,
          "y": 0,
        },
      ]
    `)
  })
})

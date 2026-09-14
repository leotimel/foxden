import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, createState, simulate, step } from './physics'
import { tileKey, type Tilemap } from './level'
import type { FrameInput, PhysicsState } from './types'

/**
 * Os testes se dividem em dois grupos, de propósito.
 *
 * Os *invariantes* afirmam relações ("segurar o botão sobe mais que soltar
 * cedo"), não números — sobrevivem ao tuning das constantes que o CHECKPOINT
 * da Fase 1 vai exigir. A *guarda de regressão* no fim é o oposto: trava uma
 * trajetória exata, para que uma mudança acidental no feel apareça. Quando o
 * tuning for intencional, aquele snapshot é atualizado de propósito.
 *
 * Desde a Fase 2.1, `grounded` vem de colisão real contra `TEST_TILEMAP`
 * (não mais do `cfg.floorY` provisório da Fase 1) — mas as asserções em si
 * não mudaram: o objetivo é continuar provando os mesmos invariantes de
 * física, agora sobre o mecanismo de aterrissagem definitivo.
 */

const IDLE: FrameInput = { moveX: 0, jumpHeld: false }
const RIGHT: FrameInput = { moveX: 1, jumpHeld: false }
const JUMP: FrameInput = { moveX: 0, jumpHeld: true }
const RIGHT_JUMP: FrameInput = { moveX: 1, jumpHeld: true }

const cfg = DEFAULT_CONFIG

/** Chão em y=0 (a mesma "altura" que o antigo `cfg.floorY` provisório). */
const FLOOR_ROW = 0
/** Parede isolada, longe o bastante (col 50) pra não interferir em nenhum
 *  outro teste — todos os outros ficam bem abaixo de x=20. */
const WALL_COL = 50

const TEST_TILEMAP: Tilemap = (() => {
  const solid = new Set<string>()
  for (let col = -50; col <= 150; col++) solid.add(tileKey(col, FLOOR_ROW))
  // Cobre a altura do Fenn (height=1.5) parado em pé: rows -2 e -1.
  for (let row = -3; row <= FLOOR_ROW; row++) solid.add(tileKey(WALL_COL, row))
  return { solid, hazards: new Set(), checkpoints: new Set() }
})()

/** `simulate` já fixado no tilemap de teste — todo teste usa o mesmo mundo. */
function run(state: PhysicsState, ins: readonly FrameInput[]): PhysicsState[] {
  return simulate(state, ins, cfg, TEST_TILEMAP)
}

/** `n` frames do mesmo input. */
function inputs(n: number, input: FrameInput): FrameInput[] {
  return Array.from({ length: n }, () => input)
}

/** Fenn parado sobre o chão. */
function onGround(): PhysicsState {
  return createState({ x: 0, y: FLOOR_ROW }, true)
}

/** Fenn no ar, `frames` frames depois de ter deixado o chão. */
function afterLeavingLedge(frames: number): PhysicsState {
  return { ...createState({ x: 0, y: FLOOR_ROW - 2 }), framesSinceGrounded: frames }
}

function last(trajectory: PhysicsState[]): PhysicsState {
  return trajectory[trajectory.length - 1]
}

/** Altura máxima atingida (Y cresce pra baixo, então o ápice é o menor Y). */
function apexHeight(trajectory: PhysicsState[]): number {
  return FLOOR_ROW - Math.min(...trajectory.map((s) => s.pos.y))
}

describe('determinismo', () => {
  it('mesma sequência de inputs → trajetória idêntica', () => {
    const seq = [...inputs(5, RIGHT), ...inputs(10, RIGHT_JUMP), ...inputs(40, RIGHT)]
    expect(run(onGround(), seq)).toEqual(run(onGround(), seq))
  })

  it('step não muta o estado recebido', () => {
    const state = onGround()
    const antes = structuredClone(state)
    step(state, RIGHT_JUMP, cfg, TEST_TILEMAP)
    expect(state).toEqual(antes)
  })
})

describe('inércia horizontal', () => {
  it('não atinge a velocidade máxima no primeiro frame', () => {
    const [primeiro] = run(onGround(), inputs(1, RIGHT))
    expect(primeiro.vel.x).toBeGreaterThan(0)
    expect(primeiro.vel.x).toBeLessThan(cfg.runSpeedMax)
  })

  it('chega na velocidade máxima e não a ultrapassa', () => {
    const t = run(onGround(), inputs(60, RIGHT))
    expect(last(t).vel.x).toBeCloseTo(cfg.runSpeedMax)
  })

  it('ao soltar, desacelera aos poucos em vez de parar na hora', () => {
    const correndo = last(run(onGround(), inputs(60, RIGHT)))
    const [depois] = run(correndo, inputs(1, IDLE))
    expect(depois.vel.x).toBeLessThan(correndo.vel.x)
    expect(depois.vel.x).toBeGreaterThan(0)
  })

  it('para de fato quando a desaceleração termina', () => {
    const correndo = last(run(onGround(), inputs(60, RIGHT)))
    expect(last(run(correndo, inputs(60, IDLE))).vel.x).toBe(0)
  })

  it('controle aéreo é mais fraco que o do chão', () => {
    const noChao = run(onGround(), inputs(1, RIGHT))
    const noAr = run(afterLeavingLedge(99), inputs(1, RIGHT))
    expect(last(noAr).vel.x).toBeLessThan(last(noChao).vel.x)
  })
})

describe('pulo de altura variável', () => {
  it('segurar o botão sobe mais alto que soltar cedo', () => {
    const segurando = run(onGround(), inputs(120, JUMP))
    const soltandoCedo = run(onGround(), [...inputs(3, JUMP), ...inputs(117, IDLE)])
    expect(apexHeight(soltandoCedo)).toBeGreaterThan(0)
    expect(apexHeight(segurando)).toBeGreaterThan(apexHeight(soltandoCedo))
  })

  it('quanto mais tempo segurando, mais alto — até o teto do impulso', () => {
    const alturas = [2, 6, 10, 20].map((frames) =>
      apexHeight(run(onGround(), [...inputs(frames, JUMP), ...inputs(120, IDLE)])),
    )
    for (let i = 1; i < alturas.length; i++) {
      expect(alturas[i]).toBeGreaterThanOrEqual(alturas[i - 1])
    }
  })

  it('segurar o botão não faz pular de novo ao aterrissar', () => {
    const t = run(onGround(), inputs(120, JUMP))
    const pouso = t.findIndex((s, i) => i > 5 && s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).every((s) => s.vel.y >= 0)).toBe(true)
  })
})

describe('gravidade', () => {
  it('cair é mais rápido que subir (gravidade assimétrica)', () => {
    const t = run(onGround(), inputs(120, JUMP))
    const apice = t.reduce((melhor, s, i) => (s.pos.y < t[melhor].pos.y ? i : melhor), 0)
    const pouso = t.findIndex((s, i) => i > apice && s.grounded)
    const subida = apice + 1
    const queda = pouso - apice
    expect(queda).toBeLessThan(subida)
  })

  it('a queda satura na velocidade terminal', () => {
    // Cai de y=-1000 por 300 frames; a fallSpeedMax=25 tiles/s percorre no
    // máximo ~125 tiles nesse tempo — nunca chega perto do chão em y=0.
    const t = run(createState({ x: 0, y: FLOOR_ROW - 1000 }), inputs(300, IDLE))
    expect(last(t).vel.y).toBeCloseTo(cfg.fallSpeedMax)
  })
})

describe('coyote time', () => {
  it('ainda dá pra pular dentro da janela depois de sair da beirada', () => {
    const [s] = run(afterLeavingLedge(cfg.coyoteFrames), inputs(1, JUMP))
    expect(s.vel.y).toBeLessThan(0)
  })

  it('depois da janela, não pula mais', () => {
    const [s] = run(afterLeavingLedge(cfg.coyoteFrames + 1), inputs(1, JUMP))
    expect(s.vel.y).toBeGreaterThan(0)
  })

  it('não vira pulo duplo: apertar de novo no ar logo após pular não faz nada', () => {
    const seq = [JUMP, ...inputs(2, IDLE), JUMP, ...inputs(60, IDLE)]
    const t = run(onGround(), seq)
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
    const t = run(createState({ x: 0, y: FLOOR_ROW - 0.2 }), [JUMP, ...inputs(30, IDLE)])
    const pouso = t.findIndex((s) => s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).some((s) => s.vel.y < 0)).toBe(true)
  })

  it('press cedo demais expira sem disparar', () => {
    const t = run(createState({ x: 0, y: FLOOR_ROW - 5 }), [JUMP, ...inputs(60, IDLE)])
    const pouso = t.findIndex((s) => s.grounded)
    expect(pouso).toBeGreaterThan(0)
    expect(t.slice(pouso).every((s) => s.vel.y >= 0)).toBe(true)
  })
})

describe('repouso no chão (colisão real)', () => {
  it('continua grounded no tick seguinte mesmo sem nenhum input', () => {
    // Confirma end-to-end que a gravidade (aplicada todo tick antes da
    // colisão em Y) nunca deixa dy exatamente 0 quando grounded — então a
    // colisão redispara e reconfirma `grounded` sozinha, tick após tick,
    // sem precisar de uma checagem de "chão" separada da colisão.
    const parado = last(run(onGround(), inputs(1, IDLE)))
    expect(parado.grounded).toBe(true)
    const aindaParado = last(run(parado, inputs(1, IDLE)))
    expect(aindaParado.grounded).toBe(true)
    expect(aindaParado.pos.y).toBeCloseTo(FLOOR_ROW)
  })
})

describe('colisão com parede', () => {
  it('empurrar contra uma parede não desliza através dela', () => {
    const parado = last(run(onGround(), inputs(400, RIGHT)))
    expect(parado.pos.x).toBeCloseTo(WALL_COL - cfg.width / 2)

    // Continuar segurando RIGHT contra a parede não faz a posição derivar
    // (a inércia tenta empurrar todo tick, a colisão clampa todo tick).
    const seguindo = run(parado, inputs(5, RIGHT))
    for (const s of seguindo) {
      expect(s.pos.x).toBeCloseTo(WALL_COL - cfg.width / 2)
      expect(s.vel.x).toBe(0)
    }
  })
})

describe('guarda de regressão', () => {
  it('trajetória de referência de corrida + pulo', () => {
    const seq = [...inputs(10, RIGHT), ...inputs(12, RIGHT_JUMP), ...inputs(38, RIGHT)]
    const t = run(onGround(), seq)
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

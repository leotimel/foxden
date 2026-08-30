/**
 * Física de movimento do Fenn.
 *
 * O sistema mais sensível do projeto: o "feel" do pulo é o que faz ou quebra
 * um platformer. Engine puro (sem DOM, sem Pixi, sem React) e determinístico
 * — dada a mesma sequência de inputs, a trajetória é sempre idêntica.
 * Isso não é só qualidade: o solver de completabilidade do desafio diário
 * procedural (fase futura) roda esta simulação headless e depende disso.
 *
 * Unidades em tiles, **Y crescendo para baixo** (ver `types.ts`): gravidade
 * positiva, impulso de pulo negativo. É a maior fonte de erro de sinal aqui.
 */

import { resolveAxisX, resolveAxisY } from './collision'
import type { Tilemap } from './level'
import type { FrameInput, PhysicsConfig, PhysicsState, Vec2 } from './types'

/**
 * Passo fixo da simulação (60 Hz).
 *
 * O motor só avança em ticks inteiros deste tamanho. Conciliar isso com o
 * framerate variável da tela é trabalho do acumulador na camada de render —
 * é o que faz o determinismo valer em runtime, não só nos testes.
 */
export const FIXED_DT = 1 / 60

/**
 * Teto dos contadores de frame do estado.
 *
 * `framesSinceGrounded` e `framesSinceJumpPress` só são comparados contra as
 * janelas de coyote/buffer, então saturar num inteiro pequeno preserva o
 * significado e mantém os números exatos (nada de somar até perder precisão).
 */
const TIMER_CAP = 9999

/**
 * Constantes iniciais do movimento.
 *
 * Derivadas de um ápice de ~3.5 tiles em ~0.35 s. São ponto de partida para
 * o 🛑 CHECKPOINT da Fase 1 (aprovação manual do feel), não valores finais.
 */
export const DEFAULT_CONFIG: PhysicsConfig = {
  runAccel: 36,
  runDecel: 45,
  runSpeedMax: 9,
  airControl: 0.65,
  gravityRise: 57,
  gravityFall: 97,
  jumpSpeed: 20,
  jumpCutSpeed: 10,
  fallSpeedMax: 25,
  coyoteFrames: 6,
  bufferFrames: 6,
  width: 0.8,
  height: 1.5,
}

/** Cria o estado inicial do Fenn numa posição. */
export function createState(pos: Vec2, grounded = false): PhysicsState {
  return {
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    grounded,
    framesSinceGrounded: grounded ? 0 : TIMER_CAP,
    framesSinceJumpPress: -1,
    jumpHeldPrev: false,
  }
}

/** Soma saturando em `TIMER_CAP`, para os contadores de frame não estourarem. */
function tickTimer(frames: number): number {
  return frames >= TIMER_CAP ? TIMER_CAP : frames + 1
}

/**
 * Nova velocidade horizontal após um tick.
 *
 * Com input, acelera em direção à velocidade alvo; sem input, desacelera até
 * parar. Nenhum dos dois é instantâneo — é daí que vem a inércia. No ar,
 * ambos os ritmos são reduzidos por `airControl`.
 */
function stepVelocityX(
  vx: number,
  moveX: number,
  grounded: boolean,
  cfg: PhysicsConfig,
): number {
  const control = grounded ? 1 : cfg.airControl

  if (moveX !== 0) {
    const target = moveX * cfg.runSpeedMax
    const accel = cfg.runAccel * control * FIXED_DT
    // Vale tanto para ganhar velocidade quanto para inverter a direção: em
    // ambos os casos a velocidade caminha até o alvo sem ultrapassá-lo.
    return vx < target ? Math.min(vx + accel, target) : Math.max(vx - accel, target)
  }

  const decel = cfg.runDecel * control * FIXED_DT
  if (vx > 0) return Math.max(vx - decel, 0)
  if (vx < 0) return Math.min(vx + decel, 0)
  return 0
}

/**
 * Avança a simulação em exatamente um tick de `FIXED_DT`.
 *
 * Puro: não muta `state`, devolve um estado novo. A ordem das operações
 * abaixo importa para o resultado — mexer nela muda o feel.
 */
export function step(
  state: PhysicsState,
  input: FrameInput,
  cfg: PhysicsConfig,
  tilemap: Tilemap,
): PhysicsState {
  const wasGrounded = state.grounded

  // 1-2. Borda de press do pulo e o timer do buffer.
  const jumpPressed = input.jumpHeld && !state.jumpHeldPrev
  let framesSinceJumpPress = jumpPressed
    ? 0
    : state.framesSinceJumpPress >= 0
      ? tickTimer(state.framesSinceJumpPress)
      : -1

  // 3. Horizontal (usa o `grounded` do início do tick).
  let vx = stepVelocityX(state.vel.x, input.moveX, wasGrounded, cfg)

  // 4. Disparo do pulo: um press guardado dentro da janela de buffer, com o
  //    chão ainda válido (de fato ou por coyote time).
  let vy = state.vel.y
  let framesSinceGrounded = state.framesSinceGrounded
  const hasBufferedPress =
    framesSinceJumpPress >= 0 && framesSinceJumpPress <= cfg.bufferFrames
  const canJump = wasGrounded || framesSinceGrounded <= cfg.coyoteFrames

  if (hasBufferedPress && canJump) {
    vy = -cfg.jumpSpeed
    // Consumir o press, senão ele redispara nos frames seguintes...
    framesSinceJumpPress = -1
    // ...e fechar a janela de coyote, senão ela viraria um pulo duplo no ar
    // (depois de pular, `framesSinceGrounded` recomeçaria dentro da janela).
    framesSinceGrounded = cfg.coyoteFrames + 1
  }

  // 5. Corte do pulo: soltar o botão durante a subida limita a altura.
  //    Idempotente — depois do corte a condição deixa de valer sozinha.
  if (!input.jumpHeld && vy < -cfg.jumpCutSpeed) {
    vy = -cfg.jumpCutSpeed
  }

  // 6. Gravidade assimétrica: cair é mais rápido que subir, o que deixa o
  //    pulo snappy em vez de flutuante.
  vy += (vy < 0 ? cfg.gravityRise : cfg.gravityFall) * FIXED_DT
  if (vy > cfg.fallSpeedMax) vy = cfg.fallSpeedMax

  // 7. Resolve X primeiro, usando o `y` do INÍCIO do tick (a colisão em Y
  //    ainda não rodou). Colidir zera vx — parede não guarda inércia.
  //    Essa ordem (X antes de Y) não é arbitrária: deixa o Fenn "escorregar"
  //    horizontalmente por baixo de uma quina côncava (parede+teto em L)
  //    antes da colisão vertical travar a subida, em vez de bater seco —
  //    é o comportamento esperado do gênero, não um efeito colateral.
  const moveX = resolveAxisX(state.pos.x, state.pos.y, cfg.width, cfg.height, vx * FIXED_DT, tilemap)
  const x = moveX.position
  if (moveX.collided) vx = 0

  // 8. Resolve Y usando o `x` já resolvido no passo 7. Colidir caindo
  //    (dy>0) = aterrissou (grounded); colidir subindo (dy<0) = bateu a
  //    cabeça (zera vy, mas grounded continua false — ainda está no ar).
  const dy = vy * FIXED_DT
  const moveY = resolveAxisY(x, state.pos.y, cfg.width, cfg.height, dy, tilemap)
  const y = moveY.position
  let grounded = false
  if (moveY.collided) {
    vy = 0
    grounded = dy > 0
  }

  // 9. Coyote time conta a partir do último frame no chão. `dy` nunca é
  //    exatamente 0 aqui quando grounded no tick anterior (a gravidade do
  //    passo 6 acabou de empurrar vy pra baixo de novo), então a colisão em
  //    Y sempre redispara e reconfirma `grounded` a cada tick — não precisa
  //    de uma checagem de "chão" separada da colisão.
  framesSinceGrounded = grounded ? 0 : tickTimer(framesSinceGrounded)

  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    grounded,
    framesSinceGrounded,
    framesSinceJumpPress,
    // 10. Guarda o botão para a borda de press do próximo tick.
    jumpHeldPrev: input.jumpHeld,
  }
}

/**
 * Roda uma sequência de inputs e devolve a trajetória resultante.
 *
 * O item `i` do retorno é o estado **depois** do tick `i` (o estado inicial
 * não entra). É o que os testes de regressão consomem, e é a mesma primitiva
 * que o solver headless do desafio diário procedural vai usar.
 */
export function simulate(
  initial: PhysicsState,
  inputs: readonly FrameInput[],
  cfg: PhysicsConfig,
  tilemap: Tilemap,
): PhysicsState[] {
  const trajectory: PhysicsState[] = []
  let current = initial
  for (const input of inputs) {
    current = step(current, input, cfg, tilemap)
    trajectory.push(current)
  }
  return trajectory
}

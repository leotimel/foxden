/**
 * Monta a cena Pixi do jogo: aplicação, chão provisório, o placeholder do
 * Fenn, e o laço de simulação com passo fixo.
 *
 * Ainda sem tilemap real (isso é Fase 2) — o chão é uma faixa fixa só pra
 * não cair infinitamente. O input (teclado, ver `keyboardInput.ts`) chega
 * de fora via `setInput`; esta cena não sabe de onde ele vem.
 *
 * O acumulador de tempo fica AQUI, não no engine: é o que reconcilia o
 * passo fixo determinístico do motor com o framerate variável da tela — o
 * motor nunca é chamado com um `dt` diferente de `FIXED_DT`.
 */
import { Application, Container, Graphics } from 'pixi.js'
import { DEFAULT_CONFIG, FIXED_DT, createState, step } from '../engine/physics'
import type { FrameInput, PhysicsState } from '../engine/types'
import {
  GROUND_HALF_WIDTH_TILES,
  GROUND_SCREEN_Y_RATIO,
  GROUND_THICKNESS_PX,
  TILE_PX,
} from './constants'
import { createFennSprite } from './sprites/fenn'

export interface Scene {
  app: Application
  /** Substitui o input consumido pelo próximo tick de física. */
  setInput(input: FrameInput): void
  destroy(): void
}

function createGroundSprite(): Graphics {
  const halfWidthPx = GROUND_HALF_WIDTH_TILES * TILE_PX
  return new Graphics().rect(-halfWidthPx, 0, halfWidthPx * 2, GROUND_THICKNESS_PX).fill(0x3a2f28)
}

export async function createScene(container: HTMLElement): Promise<Scene> {
  const app = new Application()
  await app.init({
    resizeTo: container,
    backgroundColor: 0x1b1e26,
    antialias: true,
  })
  container.appendChild(app.canvas)

  // "world" carrega tudo que a câmera desloca; app.stage fica parado.
  const world = new Container()
  app.stage.addChild(world)

  const ground = createGroundSprite()
  ground.y = DEFAULT_CONFIG.floorY * TILE_PX
  world.addChild(ground)

  const fenn = createFennSprite()
  world.addChild(fenn)

  let physicsState: PhysicsState = createState({ x: 0, y: DEFAULT_CONFIG.floorY }, true)
  let input: FrameInput = { moveX: 0, jumpHeld: false }
  let accumulatorS = 0

  /** Câmera simples: só acompanha o Fenn no eixo X. O chão fica numa altura
   *  fixa na tela (GROUND_SCREEN_Y_RATIO) — sem follow vertical. */
  function positionCamera() {
    world.x = app.screen.width / 2 - fenn.x
    world.y = app.screen.height * GROUND_SCREEN_Y_RATIO - ground.y
  }

  app.renderer.on('resize', positionCamera)

  const tick = () => {
    accumulatorS += app.ticker.deltaMS / 1000
    while (accumulatorS >= FIXED_DT) {
      physicsState = step(physicsState, input, DEFAULT_CONFIG)
      accumulatorS -= FIXED_DT
    }
    fenn.x = physicsState.pos.x * TILE_PX
    fenn.y = physicsState.pos.y * TILE_PX
    positionCamera()
  }
  app.ticker.add(tick)
  positionCamera()

  return {
    app,
    setInput(next) {
      input = next
    },
    destroy() {
      app.ticker.remove(tick)
      app.renderer.off('resize', positionCamera)
      app.destroy(true, { children: true })
    },
  }
}

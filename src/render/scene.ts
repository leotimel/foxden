/**
 * Monta a cena Pixi do jogo: aplicação, o tilemap de teste, o placeholder
 * do Fenn, e o laço de simulação com passo fixo.
 *
 * O input (teclado, ver `keyboardInput.ts`) chega de fora via `setInput`;
 * esta cena não sabe de onde ele vem.
 *
 * O acumulador de tempo fica AQUI, não no engine: é o que reconcilia o
 * passo fixo determinístico do motor com o framerate variável da tela — o
 * motor nunca é chamado com um `dt` diferente de `FIXED_DT`.
 */
import { Application, Container } from 'pixi.js'
import { isOverlapping } from '../engine/collision'
import { loadLevel } from '../engine/level'
import { createLifecycleState, resolveLifecycle, type LifecycleState } from '../engine/lifecycle'
import { DEFAULT_CONFIG, FIXED_DT, createState, step } from '../engine/physics'
import type { FrameInput, PhysicsState } from '../engine/types'
import { CAMERA_ANCHOR_Y_RATIO, TILE_PX } from './constants'
import { createFennSprite } from './sprites/fenn'
import { createTilemapSprite } from './sprites/tilemap'
import testRoomData from '../levels/test-room.json'

export interface Scene {
  app: Application
  /** Substitui o input consumido pelo próximo tick de física. */
  setInput(input: FrameInput): void
  destroy(): void
}

export async function createScene(container: HTMLElement): Promise<Scene> {
  // Fase 2.3: fase de teste carregada de src/levels/test-room.json (mesmo
  // layout desenhado nas Fases 2.1/2.2 — chão com buraco, checkpoint,
  // parede baixa pulável, teto isolado, hazard, duas plataformas, parede
  // alta intransponível — agora vindo de dado, não de código).
  const level = loadLevel(testRoomData)
  const { tilemap } = level

  /** Cair além disso (em tiles) conta como "vazio" — morte + respawn no
   *  checkpoint atual (ver `lifecycle.ts`). `height` já é a linha logo
   *  abaixo do chão definido, então não precisa de margem extra. */
  const voidY = testRoomData.height

  if (isOverlapping(level.spawn, DEFAULT_CONFIG.width, DEFAULT_CONFIG.height, tilemap)) {
    throw new Error('scene: spawn da fase sobrepõe geometria sólida do tilemap.')
  }

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

  world.addChild(createTilemapSprite(tilemap))

  const fenn = createFennSprite(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height)
  world.addChild(fenn)

  let physicsState: PhysicsState = createState(level.spawn, true)
  let lifecycleState: LifecycleState = createLifecycleState(level.spawn)
  let input: FrameInput = { moveX: 0, jumpHeld: false }
  let accumulatorS = 0

  /** Câmera simples: só acompanha o Fenn no eixo X. O eixo Y fica travado
   *  numa referência fixa (a altura do spawn da fase) — sem follow vertical. */
  function positionCamera() {
    world.x = app.screen.width / 2 - fenn.x
    world.y = app.screen.height * CAMERA_ANCHOR_Y_RATIO - level.spawn.y * TILE_PX
  }

  app.renderer.on('resize', positionCamera)

  const tick = () => {
    accumulatorS += app.ticker.deltaMS / 1000
    while (accumulatorS >= FIXED_DT) {
      physicsState = step(physicsState, input, DEFAULT_CONFIG, tilemap)
      // Roda depois de CADA tick de física, não uma vez por frame — senão,
      // a passo fixo alto (várias iterações do while num frame lento),
      // hazard/vazio só seria checado no último tick e poderia pular por
      // cima de um tick intermediário onde a morte deveria ter acontecido.
      const resolved = resolveLifecycle(
        physicsState,
        lifecycleState,
        DEFAULT_CONFIG.width,
        DEFAULT_CONFIG.height,
        tilemap,
        voidY,
      )
      physicsState = resolved.physics
      lifecycleState = resolved.lifecycle
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

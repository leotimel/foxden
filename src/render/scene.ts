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
import { loadLevel, type LevelData } from '../engine/level'
import {
  createLifecycleState,
  resolveLifecycle,
  STARTING_LIVES,
  type LifecycleState,
} from '../engine/lifecycle'
import { DEFAULT_CONFIG, FIXED_DT, createState, step } from '../engine/physics'
import { calculateStars, createRunState, hasReachedExit, updateRun, type StarResult } from '../engine/scoring'
import type { FrameInput, PhysicsState } from '../engine/types'
import { CAMERA_ANCHOR_Y_RATIO, TILE_PX } from './constants'
import { createFennSprite } from './sprites/fenn'
import { createTilemapSprite } from './sprites/tilemap'

export interface Scene {
  app: Application
  /** Substitui o input consumido pelo próximo tick de física. */
  setInput(input: FrameInput): void
  destroy(): void
}

/**
 * Monta a cena pra uma fase específica. `levelData` vem de quem chama
 * (Fase 3.2: a tela de mapa-mundo escolhe qual `src/levels/**.json`
 * carregar) — a cena em si não sabe nem precisa saber de onde os dados
 * vieram.
 *
 * `onComplete` (Fase 3.3) dispara UMA vez, quando o Fenn alcança a saída,
 * com as estrelas calculadas pra essa corrida — quem chama decide o que
 * fazer (persistir, voltar pro mapa). A cena continua rodando depois
 * disso (não trava input nem física); é responsabilidade de quem chama
 * desmontar a cena caso queira sair da fase nesse momento.
 */
export async function createScene(
  container: HTMLElement,
  levelData: LevelData,
  onComplete?: (result: StarResult) => void,
): Promise<Scene> {
  const level = loadLevel(levelData)
  const { tilemap } = level

  /** Cair além disso (em tiles) conta como "vazio" — morte + respawn no
   *  checkpoint atual (ver `lifecycle.ts`). `height` já é a linha logo
   *  abaixo do chão definido, então não precisa de margem extra. */
  const voidY = levelData.height

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
  let runState = createRunState()
  let completed = false
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
      runState = updateRun(
        runState,
        physicsState.pos,
        DEFAULT_CONFIG.width,
        DEFAULT_CONFIG.height,
        level.collectibles,
      )
      if (!completed && hasReachedExit(physicsState.pos, DEFAULT_CONFIG.width, level.exit)) {
        completed = true
        onComplete?.(
          calculateStars(
            runState,
            level.collectibles.length,
            lifecycleState.lives,
            STARTING_LIVES,
            level.parTimeSeconds,
          ),
        )
      }
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

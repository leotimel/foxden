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
import { tileKey, type Tilemap } from '../engine/level'
import { createLifecycleState, resolveLifecycle, type LifecycleState } from '../engine/lifecycle'
import { DEFAULT_CONFIG, FIXED_DT, createState, step } from '../engine/physics'
import type { FrameInput, PhysicsState, Vec2 } from '../engine/types'
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
 * Sala de teste PROVISÓRIA (Fases 2.1-2.2) — prova a colisão contra chão,
 * buraco, parede baixa (vencível pulando), parede alta (intransponível),
 * teto baixo isolado (bate-cabeça), plataformas em alturas diferentes, e
 * agora vidas/checkpoint/hazard. Isso NÃO é o formato de fase real (o
 * loader de JSON de fase é Fase 2.3) — é um fixture de dev, construído com
 * os mesmos tiles de 1x1 do engine, e some quando a Fase 2.3 existir.
 *
 * Layout (linha = altura em tiles; menor row = mais alto na tela, Y desce):
 * chão em FLOOR_ROW com um buraco de 4 tiles (cair nele agora mata de
 * verdade — antes da Fase 2.2 caía pra sempre sem consequência); um
 * checkpoint logo depois do buraco (pra provar que morrer mais tarde no
 * percurso respawna ali, não lá no spawn original); parede baixa de 2
 * tiles (ápice do pulo tunado na Fase 1 é ~3.5 tiles, então é vencível); um
 * tile de teto isolado bem acima do chão, sem suporte, pra bater a cabeça
 * ao pular embaixo; um hazard no chão mais adiante; duas plataformas
 * flutuantes em alturas crescentes; e uma parede de 6 tiles no fim, mais
 * alta que o ápice — intransponível mesmo pulando.
 */
const FLOOR_ROW = 13
const GROUND_MIN_COL = 0
const GROUND_MAX_COL = 45
const GAP_MIN_COL = 10
const GAP_MAX_COL = 13

const CHECKPOINT_COL = 16
const CHECKPOINT_ROW = FLOOR_ROW - 1 // uma linha acima do chão — "altura do corpo".

const LOW_WALL_MIN_COL = 20
const LOW_WALL_MAX_COL = 21
const LOW_WALL_TOP_ROW = 11 // 2 tiles de altura: rows 11-12.

const HEAD_BONK_COL = 24
const HEAD_BONK_ROW = 9

const HAZARD_COL = 27
const HAZARD_ROW = FLOOR_ROW - 1

const PLATFORM_B_MIN_COL = 31
const PLATFORM_B_MAX_COL = 34
const PLATFORM_B_ROW = 10

const PLATFORM_C_MIN_COL = 36
const PLATFORM_C_MAX_COL = 38
const PLATFORM_C_ROW = 8

const TALL_WALL_MIN_COL = 44
const TALL_WALL_MAX_COL = 45
const TALL_WALL_TOP_ROW = 7 // 6 tiles de altura: rows 7-12 (+ base no chão).

const SPAWN: Vec2 = { x: 2, y: FLOOR_ROW }

/** Cair além disso (em tiles) conta como "vazio" — morte + respawn no
 *  checkpoint atual (ver `lifecycle.ts`). Margem generosa: bem além de
 *  qualquer arco de pulo normal, só pega quem realmente caiu do mapa. */
const VOID_Y = FLOOR_ROW + 10

function buildTestRoomTilemap(): Tilemap {
  const solid = new Set<string>()
  const hazards = new Set<string>()
  const checkpoints = new Set<string>()

  for (let col = GROUND_MIN_COL; col <= GROUND_MAX_COL; col++) {
    if (col >= GAP_MIN_COL && col <= GAP_MAX_COL) continue
    solid.add(tileKey(col, FLOOR_ROW))
  }
  checkpoints.add(tileKey(CHECKPOINT_COL, CHECKPOINT_ROW))
  for (let col = LOW_WALL_MIN_COL; col <= LOW_WALL_MAX_COL; col++) {
    for (let row = LOW_WALL_TOP_ROW; row < FLOOR_ROW; row++) solid.add(tileKey(col, row))
  }
  solid.add(tileKey(HEAD_BONK_COL, HEAD_BONK_ROW))
  hazards.add(tileKey(HAZARD_COL, HAZARD_ROW))
  for (let col = PLATFORM_B_MIN_COL; col <= PLATFORM_B_MAX_COL; col++) {
    solid.add(tileKey(col, PLATFORM_B_ROW))
  }
  for (let col = PLATFORM_C_MIN_COL; col <= PLATFORM_C_MAX_COL; col++) {
    solid.add(tileKey(col, PLATFORM_C_ROW))
  }
  for (let col = TALL_WALL_MIN_COL; col <= TALL_WALL_MAX_COL; col++) {
    for (let row = TALL_WALL_TOP_ROW; row <= FLOOR_ROW; row++) solid.add(tileKey(col, row))
  }

  return { solid, hazards, checkpoints }
}

export async function createScene(container: HTMLElement): Promise<Scene> {
  const tilemap = buildTestRoomTilemap()

  if (isOverlapping(SPAWN, DEFAULT_CONFIG.width, DEFAULT_CONFIG.height, tilemap)) {
    throw new Error('scene: SPAWN sobrepõe geometria sólida do tilemap de teste.')
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

  let physicsState: PhysicsState = createState(SPAWN, true)
  let lifecycleState: LifecycleState = createLifecycleState(SPAWN)
  let input: FrameInput = { moveX: 0, jumpHeld: false }
  let accumulatorS = 0

  /** Câmera simples: só acompanha o Fenn no eixo X. O eixo Y fica travado
   *  numa referência fixa (a altura do chão da sala de teste) — sem follow
   *  vertical. */
  function positionCamera() {
    world.x = app.screen.width / 2 - fenn.x
    world.y = app.screen.height * CAMERA_ANCHOR_Y_RATIO - FLOOR_ROW * TILE_PX
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
        VOID_Y,
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

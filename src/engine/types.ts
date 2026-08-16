/**
 * Tipos do motor (engine) do Foxden.
 *
 * TS puro, sem DOM — é a fonte da verdade dos contratos do motor.
 *
 * Convenção de unidades: o motor trabalha em **tiles**, não em pixels.
 * 1 unidade = 1 tile; velocidades em tiles/s, acelerações em tiles/s².
 * A camada de render multiplica por um TILE_PX na hora de desenhar — assim
 * o motor não sabe nada sobre resolução de tela (web e mobile diferem muito)
 * e o JSON de fase, que é um grid, fica em coordenadas naturais.
 *
 * Convenção de eixos: **Y cresce para BAIXO** (padrão de tela/tilemap/Pixi,
 * e a linha 0 do grid da fase é o topo). Logo: gravidade é positiva e o
 * impulso de pulo é negativo.
 */

/** Ponto ou vetor 2D em tiles. */
export interface Vec2 {
  x: number
  y: number
}

/**
 * Estado bruto dos controles num frame.
 *
 * A camada de input não calcula bordas de press — ela só reporta o estado
 * cru dos botões, e o motor deriva o press a partir de `jumpHeldPrev`.
 */
export interface FrameInput {
  /** -1 esquerda, 0 parado, +1 direita. */
  moveX: -1 | 0 | 1
  /** Botão de pulo segurado neste frame. */
  jumpHeld: boolean
}

/** Estado completo do Fenn num instante da simulação. */
export interface PhysicsState {
  pos: Vec2
  vel: Vec2
  grounded: boolean
  /**
   * Frames desde que tocou o chão pela última vez — base do coyote time.
   * Ao consumir um pulo, é empurrado para além de `coyoteFrames` para que a
   * própria janela de coyote não vire um pulo duplo no ar.
   */
  framesSinceGrounded: number
  /**
   * Frames desde o último press do botão de pulo — base do jump buffer.
   * `-1` significa que não há press pendente (nenhum ainda, ou já consumido).
   */
  framesSinceJumpPress: number
  /** Estado do botão de pulo no frame anterior; detecta a borda de press. */
  jumpHeldPrev: boolean
}

/**
 * Constantes de física.
 *
 * Tudo que afeta o "feel" mora aqui — nada de número mágico no corpo das
 * funções. O CHECKPOINT da Fase 1 é um ciclo de tuning manual, então cada
 * ajuste tem que ser uma edição num lugar só.
 */
export interface PhysicsConfig {
  /** Aceleração horizontal com input (tiles/s²). */
  runAccel: number
  /** Desaceleração horizontal sem input (tiles/s²). */
  runDecel: number
  /** Velocidade horizontal máxima (tiles/s). */
  runSpeedMax: number
  /** Multiplicador de accel/decel no ar — controle aéreo reduzido (0-1). */
  airControl: number
  /** Gravidade durante a subida (tiles/s²). */
  gravityRise: number
  /** Gravidade durante a queda — maior que a de subida, deixa o pulo snappy. */
  gravityFall: number
  /** Velocidade vertical inicial do pulo (tiles/s, aplicada para cima). */
  jumpSpeed: number
  /** Teto da velocidade de subida ao soltar o botão cedo (tiles/s). */
  jumpCutSpeed: number
  /** Velocidade terminal de queda (tiles/s). */
  fallSpeedMax: number
  /** Frames de tolerância para pular depois de sair do chão (0 = desligado). */
  coyoteFrames: number
  /** Frames que um press de pulo fica guardado esperando o chão (0 = desligado). */
  bufferFrames: number
  /**
   * Altura do chão provisório, em tiles.
   *
   * TEMPORÁRIO — a Fase 1 não tem colisão, mas sem algo onde aterrissar o
   * `grounded` (e portanto coyote e buffer) fica intestável. Substituído por
   * `collision.ts` contra o tilemap real na Fase 2.
   */
  floorY: number
}

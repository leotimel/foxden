/**
 * Constantes de conversão do motor (tiles) para a tela (pixels).
 *
 * O engine não sabe nada sobre pixels — só a camada de render faz essa
 * conversão. É isso que mantém o motor independente de resolução (web e
 * mobile têm telas muito diferentes).
 */
export const TILE_PX = 32

/**
 * Tamanho visual do placeholder do Fenn, em tiles.
 *
 * PROVISÓRIO: a Fase 2 formaliza a caixa de colisão real contra o tilemap;
 * este valor é só estética por enquanto, não é consumido pelo engine.
 */
export const FENN_WIDTH_TILES = 0.8
export const FENN_HEIGHT_TILES = 1.5

/**
 * Onde o chão aparece na tela, como fração da altura do canvas (do topo pra
 * baixo). Dá espaço visual acima para o pulo.
 */
export const GROUND_SCREEN_Y_RATIO = 0.7

/** Espessura visual da faixa de chão provisória, em pixels. */
export const GROUND_THICKNESS_PX = 40

/**
 * Meia-largura da faixa de chão provisória, em tiles — bem larga só pra
 * "não cair infinitamente" sem precisar de tilemap real ainda (isso é
 * Fase 2).
 */
export const GROUND_HALF_WIDTH_TILES = 500

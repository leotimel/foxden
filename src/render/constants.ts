/**
 * Constantes de conversão do motor (tiles) para a tela (pixels).
 *
 * O engine não sabe nada sobre pixels — só a camada de render faz essa
 * conversão. É isso que mantém o motor independente de resolução (web e
 * mobile têm telas muito diferentes).
 */
export const TILE_PX = 32

/**
 * Onde a referência vertical fixa da câmera aparece na tela, como fração da
 * altura do canvas (do topo pra baixo). A câmera só acompanha o Fenn no
 * eixo X (ver `scene.ts`) — no eixo Y ela fica travada nessa fração, dando
 * espaço visual acima para o pulo.
 */
export const CAMERA_ANCHOR_Y_RATIO = 0.7

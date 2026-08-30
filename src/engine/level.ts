/**
 * Tilemap em grid: só a geometria (sólido vs. vazio), sem nada de conteúdo
 * de fase (checkpoints, colecionáveis, spawn, saída — isso é Fase 2.3, que
 * ainda não existe). `collision.ts` consome isso para resolver a AABB do
 * Fenn contra o mundo.
 *
 * Representação esparsa: só os tiles sólidos existem no `Set`. Qualquer
 * coordenada fora dele é vazia — inclusive fora dos limites "autorais" do
 * grid, em qualquer direção. Cair do mapa é comportamento válido (vira
 * queda livre), não um bug; morte por queda é responsabilidade de uma fase
 * futura, não deste módulo.
 */

/** Um tilemap: o conjunto de coordenadas (col,row) que são sólidas. */
export interface Tilemap {
  solid: ReadonlySet<string>
}

/** Chave canônica de uma coordenada de tile, usada como entrada do `Set`. */
export function tileKey(col: number, row: number): string {
  return `${col},${row}`
}

/** Um tile é sólido? Fora dos limites do grid = sempre vazio. */
export function isSolidTile(tilemap: Tilemap, col: number, row: number): boolean {
  return tilemap.solid.has(tileKey(col, row))
}

/**
 * Constrói um tilemap a partir de linhas ASCII — linha 0 é o TOPO do grid
 * (mesma convenção de eixos do motor, Y crescendo para baixo). `.` e espaço
 * são vazios; qualquer outro caractere é sólido. Formato pensado pra
 * autoria legível de fixtures de teste, não é o formato de fase real.
 */
export function tilemapFromRows(rows: readonly string[]): Tilemap {
  const solid = new Set<string>()
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const ch = line[col]
      if (ch !== '.' && ch !== ' ') solid.add(tileKey(col, row))
    }
  })
  return { solid }
}

/**
 * Uma faixa horizontal sólida de 1 tile de espessura, de `colMin` a
 * `colMax` (inclusive) na linha `row`. Helper pequeno para fixtures de
 * teste que só precisam de um chão plano, sem desenhar ASCII.
 */
export function flatFloor(row: number, colMin: number, colMax: number): Tilemap {
  const solid = new Set<string>()
  for (let col = colMin; col <= colMax; col++) solid.add(tileKey(col, row))
  return { solid }
}

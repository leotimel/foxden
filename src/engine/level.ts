/**
 * Tilemap em grid: geometria (sólido vs. vazio) + marcadores de gameplay
 * (hazards, checkpoints) que `lifecycle.ts` consome. Ainda NÃO é o formato
 * de fase real — dimensões, spawn, saída, colecionáveis e o loader de JSON
 * são Fase 2.3. `collision.ts` consome `solid` para resolver a AABB do
 * Fenn contra o mundo; `lifecycle.ts` consome `hazards`/`checkpoints`.
 *
 * Representação esparsa: cada categoria é o conjunto dos tiles daquele
 * tipo. Qualquer coordenada fora de um `Set` é "não é desse tipo" —
 * inclusive fora dos limites "autorais" do grid, em qualquer direção. Cair
 * do mapa sem tocar nada é comportamento válido (vira queda livre até o
 * limite de vazio que `lifecycle.ts` recebe como parâmetro), não um bug.
 */

/** Um tilemap: os conjuntos de coordenadas (col,row) de cada tipo de tile. */
export interface Tilemap {
  solid: ReadonlySet<string>
  /** Tocar mata (respawna no checkpoint, -1 vida) — ver `lifecycle.ts`. */
  hazards: ReadonlySet<string>
  /** Tocar vira o novo ponto de respawn — ver `lifecycle.ts`. */
  checkpoints: ReadonlySet<string>
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
 * são vazios; `^` é hazard; `C` é checkpoint; qualquer outro caractere
 * (convenção: `#`) é sólido. Formato pensado pra autoria legível de
 * fixtures de teste, não é o formato de fase real.
 */
export function tilemapFromRows(rows: readonly string[]): Tilemap {
  const solid = new Set<string>()
  const hazards = new Set<string>()
  const checkpoints = new Set<string>()
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const ch = line[col]
      const key = tileKey(col, row)
      if (ch === '^') hazards.add(key)
      else if (ch === 'C') checkpoints.add(key)
      else if (ch !== '.' && ch !== ' ') solid.add(key)
    }
  })
  return { solid, hazards, checkpoints }
}

/**
 * Uma faixa horizontal sólida de 1 tile de espessura, de `colMin` a
 * `colMax` (inclusive) na linha `row`. Helper pequeno para fixtures de
 * teste que só precisam de um chão plano, sem desenhar ASCII.
 */
export function flatFloor(row: number, colMin: number, colMax: number): Tilemap {
  const solid = new Set<string>()
  for (let col = colMin; col <= colMax; col++) solid.add(tileKey(col, row))
  return { solid, hazards: new Set(), checkpoints: new Set() }
}

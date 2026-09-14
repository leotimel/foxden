import { describe, expect, it } from 'vitest'
import { findOverlappingTile, isOverlapping, isOverlappingSet, resolveAxisX, resolveAxisY } from './collision'
import { flatFloor, tileKey, tilemapFromRows, type Tilemap } from './level'

/**
 * Caixa de teste com números redondos (1×2), desacoplada do tuning real do
 * Fenn (0.8×1.5 em `DEFAULT_CONFIG`) — mais fácil de verificar à mão. Os
 * deltas usados nos testes ficam sempre abaixo de 1 tile, respeitando a
 * mesma guarda de sub-tile que `resolveAxisX`/`resolveAxisY` impõem em
 * produção (ver `assertSubTileDisplacement`).
 */
const W = 1
const H = 2
const EMPTY: Tilemap = { solid: new Set(), hazards: new Set(), checkpoints: new Set() }

/** Parede vertical de 1 tile de largura, de `rowMin` a `rowMax` (inclusive). */
function verticalWall(col: number, rowMin: number, rowMax: number): Tilemap {
  const solid = new Set<string>()
  for (let row = rowMin; row <= rowMax; row++) solid.add(tileKey(col, row))
  return { solid, hazards: new Set(), checkpoints: new Set() }
}

describe('tilemap vazio', () => {
  it('não trava nada em nenhum eixo', () => {
    expect(resolveAxisX(0, 0, W, H, 0.5, EMPTY)).toEqual({ position: 0.5, collided: false })
    expect(resolveAxisY(0, 0, W, H, 0.5, EMPTY)).toEqual({ position: 0.5, collided: false })
  })
})

describe('resolveAxisY', () => {
  it('aterrissar vindo de cima: clampa no topo do tile, sinaliza colisão', () => {
    const floor = flatFloor(5, -5, 5)
    // bottom = y = 4.5; dy=0.6 leva bottom a 5.1, dentro do tile do row 5.
    const r = resolveAxisY(0, 4.5, W, H, 0.6, floor)
    expect(r).toEqual({ position: 5, collided: true })
  })

  it('bater a cabeça vindo de baixo: clampa embaixo do tile', () => {
    const ceiling = tilemapFromRows(['#']) // sólido em (col:0, row:0)
    // top = y-H = 2.8-2 = 0.8; dy=-0.7 leva top a 0.1, dentro do row 0.
    const r = resolveAxisY(0, 2.8, W, H, -0.7, ceiling)
    expect(r).toEqual({ position: 3, collided: true }) // row+1+H = 0+1+2
  })

  it('encostar numa parede vertical (tocar, não sobrepor) NÃO conta como colisão em Y', () => {
    // Espelho do bug de chão-vira-parede: aqui é parede-vira-chão/teto.
    // right = x+W/2 = 5 exatamente na borda da parede — toque, não overlap.
    const wall = verticalWall(5, 0, 5)
    const r = resolveAxisY(4.5, 2, W, H, 0.9, wall)
    expect(r).toEqual({ position: 2.9, collided: false })
  })
})

describe('resolveAxisX', () => {
  it('parede à direita: clampa a caixa antes do tile', () => {
    const wall = verticalWall(5, 0, 1)
    // right = x+W/2 = 4.5 antes do move; candidateX=4.9 levaria right a 5.4.
    const r = resolveAxisX(4, 2, W, H, 0.9, wall)
    expect(r).toEqual({ position: 4.5, collided: true }) // col - W/2 = 5 - 0.5
  })

  it('parede à esquerda: clampa a caixa depois do tile', () => {
    const wall = verticalWall(-6, 0, 1)
    const r = resolveAxisX(-4, 2, W, H, -0.9, wall)
    expect(r).toEqual({ position: -4.5, collided: true }) // col+1+W/2 = -6+1+0.5
  })

  it('andar sobre chão plano NÃO colide horizontalmente com o próprio chão', () => {
    // O bug original: bottom = y = 5 exatamente na borda do chão. Sem o
    // epsilon certo em maxEdgeTile, o row do chão vazaria pro range
    // horizontal e isso detectaria "parede" embaixo do pé do Fenn.
    const floor = flatFloor(5, -5, 10)
    const r = resolveAxisX(0, 5, W, H, 0.9, floor)
    expect(r).toEqual({ position: 0.9, collided: false })
  })
})

describe('repouso num canto côncavo (chão + parede)', () => {
  it('empurrar contra o canto por vários ticks não faz a posição derivar', () => {
    // "L": chão na linha 5 (inclui col 6), parede subindo de col 6, linhas 0-4.
    const corner = tilemapFromRows([
      '......#', // row 0
      '......#', // row 1
      '......#', // row 2
      '......#', // row 3
      '......#', // row 4
      '#######', // row 5 (chão, cols 0-6)
    ])
    let x = 5.5 // right = 6 exatamente na parede
    let y = 5 // bottom = 5 exatamente no chão
    for (let i = 0; i < 5; i++) {
      const rx = resolveAxisX(x, y, W, H, 0.2, corner)
      expect(rx.collided).toBe(true)
      x = rx.position
      const ry = resolveAxisY(x, y, W, H, 0.2, corner)
      expect(ry.collided).toBe(true)
      y = ry.position
    }
    expect(x).toBe(5.5)
    expect(y).toBe(5)
  })
})

describe('isOverlapping', () => {
  it('true quando a AABB inicial já sobrepõe um tile sólido', () => {
    const floor = flatFloor(5, -5, 5)
    // bottom = y = 6 → dentro do tile do chão (row 5), não só encostado.
    expect(isOverlapping({ x: 0, y: 6 }, W, H, floor)).toBe(true)
  })

  it('false quando só encosta, sem sobrepor', () => {
    const floor = flatFloor(5, -5, 5)
    expect(isOverlapping({ x: 0, y: 5 }, W, H, floor)).toBe(false)
  })

  it('false num tilemap vazio', () => {
    expect(isOverlapping({ x: 0, y: 0 }, W, H, EMPTY)).toBe(false)
  })
})

describe('findOverlappingTile / isOverlappingSet', () => {
  it('encontra o tile e devolve col/row quando sobrepõe', () => {
    const tiles = new Set([tileKey(3, 4)])
    expect(findOverlappingTile({ x: 3.5, y: 5 }, W, H, tiles)).toEqual({ col: 3, row: 4 })
    expect(isOverlappingSet({ x: 3.5, y: 5 }, W, H, tiles)).toBe(true)
  })

  it('null / false quando não sobrepõe nada', () => {
    const tiles = new Set([tileKey(3, 4)])
    expect(findOverlappingTile({ x: 20, y: 20 }, W, H, tiles)).toBeNull()
    expect(isOverlappingSet({ x: 20, y: 20 }, W, H, tiles)).toBe(false)
  })

  it('respeita a mesma regra de epsilon nas bordas que resolveAxisX/Y', () => {
    // bottom = y = 4 exatamente na borda do tile (3,4) — toque, não overlap.
    const tiles = new Set([tileKey(3, 4)])
    expect(isOverlappingSet({ x: 3.5, y: 4 }, W, H, tiles)).toBe(false)
  })
})

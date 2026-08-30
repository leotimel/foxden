import { describe, expect, it } from 'vitest'
import { flatFloor, isSolidTile, tileKey, tilemapFromRows } from './level'

describe('tileKey', () => {
  it('coordenadas diferentes nunca colidem no mesmo formato', () => {
    // Ex. clássico de bug de formatação ingênua: "1" + "23" === "12" + "3".
    expect(tileKey(1, 23)).not.toBe(tileKey(12, 3))
  })
})

describe('tilemapFromRows', () => {
  it('linha 0 é o topo; "." e espaço são vazios, o resto é sólido', () => {
    const map = tilemapFromRows(['.#', '# '])
    expect(isSolidTile(map, 0, 0)).toBe(false)
    expect(isSolidTile(map, 1, 0)).toBe(true)
    expect(isSolidTile(map, 0, 1)).toBe(true)
    expect(isSolidTile(map, 1, 1)).toBe(false)
  })

  it('fora dos limites autorais do grid é sempre vazio, em qualquer direção', () => {
    const map = tilemapFromRows(['##'])
    expect(isSolidTile(map, -1, 0)).toBe(false)
    expect(isSolidTile(map, 5, 0)).toBe(false)
    expect(isSolidTile(map, 0, -1)).toBe(false)
    expect(isSolidTile(map, 0, 5)).toBe(false)
  })
})

describe('flatFloor', () => {
  it('sólido só dentro do intervalo [colMin, colMax] na linha dada', () => {
    const map = flatFloor(3, -2, 2)
    expect(isSolidTile(map, -2, 3)).toBe(true)
    expect(isSolidTile(map, 2, 3)).toBe(true)
    expect(isSolidTile(map, -3, 3)).toBe(false)
    expect(isSolidTile(map, 3, 3)).toBe(false)
    expect(isSolidTile(map, 0, 4)).toBe(false)
  })
})

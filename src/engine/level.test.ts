import { describe, expect, it } from 'vitest'
import { flatFloor, isSolidTile, loadLevel, tileKey, tilemapFromRows, type LevelData } from './level'

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

  it('"^" é hazard e "C" é checkpoint, não sólido', () => {
    const map = tilemapFromRows(['#^C'])
    expect(isSolidTile(map, 0, 0)).toBe(true)
    expect(isSolidTile(map, 1, 0)).toBe(false)
    expect(isSolidTile(map, 2, 0)).toBe(false)
    expect(map.hazards.has(tileKey(1, 0))).toBe(true)
    expect(map.checkpoints.has(tileKey(2, 0))).toBe(true)
    expect(map.hazards.has(tileKey(2, 0))).toBe(false)
    expect(map.checkpoints.has(tileKey(1, 0))).toBe(false)
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

describe('loadLevel', () => {
  const DATA: LevelData = {
    width: 3,
    height: 2,
    tilemap: ['.^C', '###'],
    spawn: { x: 0.5, y: 1 },
    exit: { x: 2.5, y: 1 },
    collectibles: [{ x: 1.5, y: 0.5 }],
  }

  it('converte o tilemap ASCII e repassa spawn/exit/collectibles sem alterar', () => {
    const level = loadLevel(DATA)
    expect(isSolidTile(level.tilemap, 0, 1)).toBe(true)
    expect(level.tilemap.hazards.has(tileKey(1, 0))).toBe(true)
    expect(level.tilemap.checkpoints.has(tileKey(2, 0))).toBe(true)
    expect(level.spawn).toEqual(DATA.spawn)
    expect(level.exit).toEqual(DATA.exit)
    expect(level.collectibles).toEqual(DATA.collectibles)
  })
})

import { describe, expect, it } from 'vitest'
import { soma } from './soma'

describe('soma', () => {
  it('soma dois números positivos', () => {
    expect(soma(2, 3)).toBe(5)
  })

  it('soma com negativos', () => {
    expect(soma(-2, 5)).toBe(3)
  })
})

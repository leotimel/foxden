/**
 * Catálogo de fases do mundo-tutorial, pro lado da UI (mapa-mundo,
 * navegação). Cada entrada aponta pro `LevelData` real em `src/levels/`.
 *
 * Achatado numa lista simples (sem nós ramificados de verdade) porque o
 * mundo-tutorial é linear por design — ramificação de mapa-mundo entre
 * mundos temáticos é preocupação de fases futuras (Fase 5+).
 */
import type { LevelData } from '../engine/level'
import tutorial1 from '../levels/tutorial/tutorial-1.json'
import tutorial2 from '../levels/tutorial/tutorial-2.json'
import tutorial3 from '../levels/tutorial/tutorial-3.json'
import tutorial4 from '../levels/tutorial/tutorial-4.json'

export interface LevelEntry {
  id: string
  title: string
  data: LevelData
}

export const TUTORIAL_LEVELS: readonly LevelEntry[] = [
  { id: 'tutorial-1', title: 'Corrida Básica', data: tutorial1 },
  { id: 'tutorial-2', title: 'Pulo Curto vs. Longo', data: tutorial2 },
  { id: 'tutorial-3', title: 'Timing de Plataformas', data: tutorial3 },
  { id: 'tutorial-4', title: 'Síntese', data: tutorial4 },
]

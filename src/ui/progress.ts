/**
 * Progresso do jogador: melhor pontuação (estrelas) por fase, em
 * localStorage (Supabase só entra na Fase 6).
 *
 * Também é a base do desbloqueio fase-a-fase no mapa-mundo (Fase 3.2):
 * fase N abre quando a fase N-1 tem pelo menos 1 estrela — substitui o
 * placeholder "visitou" da 3.2, já que estrelas são um sinal melhor
 * (prova que chegou na saída) e não faz sentido manter os dois
 * mecanismos.
 */
const STORAGE_KEY = 'foxden:levelStars'

/**
 * Estrelas totais acumuladas necessárias pra desbloquear o próximo mundo
 * temático — número NÃO calibrado (mesma natureza da pendência de
 * calibração de estrelas do GAME_DESIGN.md), só uma constante fácil de
 * ajustar num lugar só. Sem efeito prático ainda: só existe o
 * mundo-tutorial até a Fase 5+ construir o próximo.
 */
export const STARS_TO_UNLOCK_NEXT_WORLD = 9

type StarsById = Record<string, number>

function readStars(): StarsById {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StarsById) : {}
  } catch {
    return {}
  }
}

export function getBestStars(id: string): 0 | 1 | 2 | 3 {
  const stars = readStars()[id]
  return (stars === 1 || stars === 2 || stars === 3 ? stars : 0) as 0 | 1 | 2 | 3
}

/** Só grava se `stars` for melhor que o recorde atual — "melhor
 *  pontuação por fase", não a última tentativa. */
export function recordStars(id: string, stars: 0 | 1 | 2 | 3): void {
  try {
    const all = readStars()
    if ((all[id] ?? 0) >= stars) return
    all[id] = stars
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // localStorage indisponível (modo privado, etc.) — resultado
    // simplesmente não persiste entre sessões; não é crítico.
  }
}

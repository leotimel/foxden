/**
 * Progresso do jogador nas fases — versão PLACEHOLDER (Fase 3.2).
 *
 * "Visitou" é só um substituto simples pra desbloqueio: ainda não existe
 * detecção de "chegou na saída" nem sistema de estrelas (isso é Fase 3.3,
 * que também vai definir o critério de desbloqueio de verdade). O que
 * importa aqui é só a distinção VISUAL entre bloqueada/desbloqueada que a
 * Fase 3.2 pede — o mecanismo por trás é provisório e deve ser substituído
 * quando as estrelas existirem.
 */
const STORAGE_KEY = 'foxden:visitedLevels'

function readVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function isLevelVisited(id: string): boolean {
  return readVisited().has(id)
}

export function markLevelVisited(id: string): void {
  try {
    const visited = readVisited()
    visited.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]))
  } catch {
    // localStorage indisponível (modo privado, etc.) — desbloqueio via
    // "visitou" simplesmente não persiste entre sessões; não é crítico.
  }
}

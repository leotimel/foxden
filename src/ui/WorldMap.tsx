/**
 * Mapa-mundo do mundo-tutorial (Fase 3.2): nós representando cada fase,
 * conectados por um caminho, navegação por clique/tap.
 *
 * Desbloqueio ainda é PLACEHOLDER (ver `progress.ts`): fase 1 sempre
 * aberta, fase N abre quando a fase N-1 foi visitada. O critério de
 * verdade (estrelas) é Fase 3.3 — aqui só existe a distinção visual que
 * o prompt pede.
 */
import { TUTORIAL_LEVELS } from './levels'
import { isLevelVisited } from './progress'

interface WorldMapProps {
  onSelectLevel: (levelId: string) => void
}

/** Posições dos nós no mapa, em % — caminho em zigue-zague clássico de
 *  mapa-mundo de platformer. */
const NODE_POSITIONS = [
  { x: 15, y: 72 },
  { x: 38, y: 38 },
  { x: 62, y: 68 },
  { x: 85, y: 32 },
]

export function WorldMap({ onSelectLevel }: WorldMapProps) {
  // Lido direto do localStorage a cada render — o componente remonta ao
  // voltar da tela de jogo (ver App.tsx), então isso já reflete qualquer
  // fase recém-visitada sem precisar de estado próprio.
  const unlocked = TUTORIAL_LEVELS.map(
    (_, i) => i === 0 || isLevelVisited(TUTORIAL_LEVELS[i - 1].id),
  )

  return (
    <div className="flex h-full w-full flex-col bg-[#1b1e26] text-[#e8e2d5]">
      <header className="px-6 py-4">
        <h1 className="text-xl font-semibold tracking-wide">Floresta de Foxden</h1>
        <p className="text-sm text-[#a89f8c]">Mundo-tutorial</p>
      </header>

      <div className="relative flex-1">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {NODE_POSITIONS.slice(1).map((pos, i) => (
            <line
              key={i}
              x1={NODE_POSITIONS[i].x}
              y1={NODE_POSITIONS[i].y}
              x2={pos.x}
              y2={pos.y}
              stroke="#4a4234"
              strokeWidth={0.8}
              strokeDasharray="2,1.5"
            />
          ))}
        </svg>

        {TUTORIAL_LEVELS.map((level, i) => {
          const pos = NODE_POSITIONS[i]
          const isUnlocked = unlocked[i]
          return (
            <button
              key={level.id}
              type="button"
              disabled={!isUnlocked}
              onClick={() => onSelectLevel(level.id)}
              aria-label={
                isUnlocked ? `Jogar fase ${i + 1}: ${level.title}` : `Fase ${i + 1} bloqueada`
              }
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <span
                className={
                  'flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold transition-transform ' +
                  (isUnlocked
                    ? 'border-[#ff8c42] bg-[#3a2f28] text-[#ff8c42] group-hover:scale-110'
                    : 'border-[#4a4234] bg-[#242730] text-[#5a5346] cursor-not-allowed')
                }
              >
                {isUnlocked ? i + 1 : '🔒'}
              </span>
              <span
                className={
                  'max-w-24 text-center text-xs ' +
                  (isUnlocked ? 'text-[#e8e2d5]' : 'text-[#5a5346]')
                }
              >
                {level.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

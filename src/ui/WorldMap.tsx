/**
 * Mapa-mundo do mundo-tutorial (Fase 3.2): nós representando cada fase,
 * conectados por um caminho, navegação por clique/tap.
 *
 * Desbloqueio (Fase 3.3): fase 1 sempre aberta, fase N abre quando a fase
 * N-1 tem pelo menos 1 estrela (ver `progress.ts`) — ainda não é o
 * critério final de progressão de MUNDO (isso depende de
 * `STARS_TO_UNLOCK_NEXT_WORLD`, sem efeito prático enquanto só existir um
 * mundo), só o suficiente pra dar sentido à distinção visual
 * bloqueada/desbloqueada dentro do mundo-tutorial.
 */
import { TUTORIAL_LEVELS } from './levels'
import { getBestStars } from './progress'

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

function StarRow({ stars }: { stars: 0 | 1 | 2 | 3 }) {
  return (
    <span aria-hidden="true" className="text-[10px] leading-none text-[#ff8c42]">
      {'★'.repeat(stars)}
      <span className="text-[#5a5346]">{'★'.repeat(3 - stars)}</span>
    </span>
  )
}

export function WorldMap({ onSelectLevel }: WorldMapProps) {
  // Lido direto do localStorage a cada render — o componente remonta ao
  // voltar da tela de jogo (ver App.tsx), então isso já reflete qualquer
  // fase recém-completada sem precisar de estado próprio.
  const starsByLevel = TUTORIAL_LEVELS.map((level) => getBestStars(level.id))
  const unlocked = TUTORIAL_LEVELS.map((_, i) => i === 0 || starsByLevel[i - 1] > 0)
  const totalStars = starsByLevel.reduce<number>((sum, s) => sum + s, 0)

  return (
    <div className="flex h-full w-full flex-col bg-[#1b1e26] text-[#e8e2d5]">
      <header className="flex items-baseline justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-wide">Floresta de Foxden</h1>
          <p className="text-sm text-[#a89f8c]">Mundo-tutorial</p>
        </div>
        <p className="text-sm text-[#ff8c42]">
          ⭐ {totalStars} / {TUTORIAL_LEVELS.length * 3}
        </p>
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
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
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
              {isUnlocked && <StarRow stars={starsByLevel[i]} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { GameCanvas } from './ui/GameCanvas'
import { WorldMap } from './ui/WorldMap'
import { TUTORIAL_LEVELS } from './ui/levels'
import { markLevelVisited } from './ui/progress'

type View = { screen: 'map' } | { screen: 'playing'; levelId: string }

function App() {
  const [view, setView] = useState<View>({ screen: 'map' })

  if (view.screen === 'playing') {
    const level = TUTORIAL_LEVELS.find((l) => l.id === view.levelId)
    if (!level) {
      // Não deveria acontecer (o id vem do próprio catálogo) — volta pro
      // mapa em vez de deixar a tela em branco.
      setView({ screen: 'map' })
      return null
    }
    return (
      <div className="relative h-full w-full">
        <GameCanvas levelId={level.id} levelData={level.data} />
        <button
          type="button"
          onClick={() => setView({ screen: 'map' })}
          className="absolute left-3 top-3 rounded-md border border-[#4a4234] bg-[#1b1e26]/80 px-3 py-1.5 text-sm text-[#e8e2d5] hover:bg-[#1b1e26]"
        >
          ← Mapa
        </button>
      </div>
    )
  }

  return (
    <WorldMap
      onSelectLevel={(levelId) => {
        markLevelVisited(levelId)
        setView({ screen: 'playing', levelId })
      }}
    />
  )
}

export default App

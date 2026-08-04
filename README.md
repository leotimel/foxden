# Foxden

Platformer 2D original — Fenn, uma raposa antropomórfica, atravessando a
Floresta de Foxden. Ver `../GAME_DESIGN.md`, `../ARCHITECTURE.md` e
`../PLAYBOOK_PROMPTS.md` para o design e o plano de desenvolvimento.

## Stack

Vite + React + TypeScript strict + Tailwind v4 + PixiJS. `src/engine/` é
TS puro (física, colisão, regras) e não pode importar `react`, `react-dom`
nem `pixi.js` — regra reforçada por ESLint (`eslint.config.js`).

## Scripts

```
npm run dev        # servidor de desenvolvimento
npm run build       # typecheck + build de produção (dist/)
npm run preview     # servir o build de produção localmente
npm run lint         # ESLint (inclui o guardrail do engine)
npm run test          # Vitest em modo watch
npm run test:run       # Vitest rodando uma vez
```

## Mobile (Capacitor)

O mesmo build web (`dist/`) roda dentro de shells nativos iOS/Android via
Capacitor — não há código nativo duplicado.

Depois de qualquer mudança no app, sincronize os projetos nativos com o
build mais recente:

```
npm run build
npx cap sync
```

Para abrir cada plataforma no IDE nativo (necessário pra rodar num
device/emulador ou gerar um build assinado):

```
npx cap open android   # abre no Android Studio
npx cap open ios       # abre no Xcode (requer macOS)
```

`android/` e `ios/` são projetos nativos gerados pelo Capacitor — não
edite os arquivos gerados manualmente além do necessário para configuração
específica de plataforma (ícones, splash screen, permissões).

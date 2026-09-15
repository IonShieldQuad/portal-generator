# HANDOFF — Portal Lab

For the next person/agent picking this up.

## What it is

A small browser minigame for the MOX "AI-first Developer 2.0" test assignment: **Лаборатория нестабильных порталов**. You run a lab, keep magic portals alive, send gnomes through them for score, and manage a shared energy pool.

- **Live:** https://ionshieldquad.github.io/portal-generator/
- **Repo:** https://github.com/IonShieldQuad/portal-generator (branch `master`)
- **Specs / decision log:** Obsidian vault at `H:\ObsidianVaultCentral\Work\Test\` (`_index.md` → `01`–`08` + `adr/`)

## Status

Phase 4 complete and deployed. **62/62 automated tests pass.** No build step, no backend, no secrets.

## Run / test / deploy

```bash
# run (ES modules need a server; any free port)
python -m http.server 8900      # → http://localhost:8900   (?seed=7 for a fixed seed)

# tests
npm test                        # node --test, zero deps

# deploy
git push origin master          # GitHub Pages: Settings → Pages → Deploy from a branch → master / root
```

## Architecture

Vanilla JS + ES modules. Pure domain separated from UI:

```
src/domain/   constants, util, rng (mulberry32), portal, game, log, actions, sim, spawn, seed
src/store.js  state container: staged actions, preview, commit simulation, presets, autoplay
src/storage.js localStorage save (versioned)
src/ui/       visual, portalShape, components, portalCanvas, hud, portals, portalDetail,
              log, summary, tutorial, about, worklog, render, styles.css
src/main.js   bootstrap
tests/        62 tests (node --test)
```

Hard rule: `src/domain/` never touches the DOM or `localStorage`, so the same code runs in the browser and in `node --test`. See `04-architecture` and `adr/adr-007-domain-module-organization`.

## Key mechanics

- **Energy pool** (`Резерв лаборатории`) recharges +45/turn; **Приток энергии** is a free action (doesn't cost the turn) that moves pool → portal reserves. Stabilize costs 60.
- **Coefficient Мерлина**: drifts each turn (worse when unstable), tuning is randomized with 20% misfires (doubled or zeroed, never reversed).
- **Stability** is an additive model (passive gain + high-energy bonus − coefficient/energy losses), scaled by distance; reaches 0 → collapse next turn.
- **Score** scales with distance; **injuries happen only in transit** through an overcharged portal.
- **Risk** is derived (`0.30/0.20/0.15/0.35`) with **time-to-collapse floors** (<3 turns → critical, <5 → high).
- **Staged actions**: select per portal, preview, then commit with «Следующий ход». The store **pre-simulates the whole turn** (`commitBlockers`) and blocks uncommittable turns with a clear reason (chip + row + red pool), counting close refunds.

Full detail in the vault specs (`02`, `03`).

## Verification notes (spec ↔ implementation)

A spec-vs-implementation pass was done; these were the material mismatches and they are now **fixed**:

- Detail card showed the **old risk formula/weights** → corrected to 0.30/0.20/0.15/0.35 + floors.
- Detail card was **missing the recommended action** (required by the assignment) → added.
- Stale test count "53" in README/about/worklog → corrected to 57.
- Spec `02` listed a `timestamp` field that isn't implemented → removed (log uses `tick` as "when").
- Spec `05` said onboarding is 4 steps → 5; spec `06` said autoplay "3 s" → 15/30/60.

### Refinement pass (post Phase 4)

Found by playtesting against the spec and fixed:

- **Injury preview** on an overcharged portal showed an uncapped probability ("125% … ~-1 из 4") and skipped the send in the projection. `injuryProbability()` (capped at 100%) now drives both the sim (`actions.js`) and the preview (`store.js`), which projects the expected arrival deterministically.
- **Stabilize tooltip** said "30 энергии" while `STABILIZE_COST` is 60 → now derived from `CONFIG`.
- **Blocked attempts are now reachable**: terminal portals render «Проверить» buttons that call `store.attemptAction` → warn toast + `result: blocked` log entry (previously the buttons were hidden, so the mandatory "forbidden action" state couldn't be reproduced in the UI).
- **Corrupt save** now shows a «Сохранение повреждено — начата новая игра» banner and reseeds, instead of silently resetting.
- Closed/collapsed portals render a "dead" view: no risk or risk band, coefficient/energy/stability shown as 0, and gnomes shown as **«Потеряно гномов»** from the new `gnomesLost` field (set on `close` and on collapse; `collapsing` portals still render normally). Detail risk text gained the medium time floor (`<8`).
- `chance()` clamps out-of-range probabilities. Tests: 57 → **62**.

Known, intentional deviations from the raw assignment (documented in `01`):
- "отправить наблюдателя" is implemented as **send gnomes**.
- "пометить как под вопросом" is implemented as **Ожидать** (a no-op skip); the `under_review` flag was removed by product decision.

## Gotchas

- **ES modules require a server** — opening `index.html` via `file://` will not work.
- **Browser caches modules aggressively** — after editing, test on a **new port** or hard-reload, or you'll see stale behavior.
- `node --test tests/` (trailing-slash dir) fails on Node 24; use `npm test` (`node --test`).
- Save is per-origin in `localStorage` (`portal-lab:save:v1`); a fixed `?seed=` only applies when there's no save. Corrupt saves are discarded and a fresh game is seeded.
- Deploy is "Deploy from a branch" (no Actions, no build).

## Open / future work

- **Sound** (deferred; noted in the in-app AI Worklog).
- Backend + leaderboard, save slots / export-import, more content (portal types, events, difficulty), full accessibility + mobile audit.

## In-app content

- **О программе** holds the **AI Worklog** (`src/ui/worklog.js`) and the verification checklist + preset buttons.
- **Обучение** holds the how-to and the formulas; a 5-step first-run onboarding overlay is shown once.

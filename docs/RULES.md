# HEXFALL — Rules & Mechanics

A compact, internally consistent strategy game. It borrows Catan's shape but is
its own thing: fewer fiddly edge cases, more spectacle.

## Goal

Be the first player to reach the **victory-point (VP) target** chosen at setup
(default 10).

Victory points come from:

| Source | VP |
| --- | --- |
| Settlement | 1 |
| City | 2 |
| Mega City | 4 |
| Longest Road (≥5 segments) | +2 |

## The board

- A procedural island of hexagonal **tiles**, each a biome that produces one
  resource: **Forest→Wood**, **Hills→Brick**, **Pasture→Sheep**,
  **Fields→Wheat**, **Mountains→Ore**. **Desert** produces nothing and starts
  with the robber. A chaos **Golden Hex** produces a wildcard resource.
- Every producing tile has a **number token** (2–12, never 7). The pips under
  the number show how likely it is to be rolled. 6 and 8 are red (most likely).
- **Ports** sit on the coast and improve trade rates (3:1 generic, or 2:1 for a
  specific resource).

## Setup phase

Players take turns in **snake order** (1,2,3,…,3,2,1) placing **two settlements
and two roads**. Your **second** settlement grants one of each adjacent tile's
resource to start. Settlements must obey the distance rule (below).

## A turn

1. **Roll** two dice.
   - The sum activates every tile with that number. Each of your settlements on
     an activated tile yields 1 resource; cities yield 2; mega cities yield 3.
   - The tile the **robber** occupies produces nothing.
   - Roll a **7**: no production. Anyone holding more than 9 cards discards half,
     and the current player moves the robber to a new tile and steals one random
     resource from an opponent with a building there.
2. **Build, trade, and use actions** in any order you can afford.
3. **End turn.**

## Building

| Build | Cost | Where |
| --- | --- | --- |
| Road | 1 Wood, 1 Brick | An empty edge connected to your road/building |
| Settlement | 1 Wood, 1 Brick, 1 Sheep, 1 Wheat | An empty vertex connected to your road, obeying the distance rule |
| City | 2 Wheat, 3 Ore | Upgrades one of your settlements |
| Mega City | 3 Wheat, 3 Ore, 2 Sheep, 2 Brick | Upgrades one of your cities — **requires a road network of ≥4** |

**Distance rule:** a settlement cannot be placed on a vertex adjacent to any
existing building.

**Longest Road:** the player with the longest continuous road of at least 5
segments holds a +2 VP banner; it transfers if someone beats it.

## Civilization growth & specialization

When a settlement becomes a **City**, it gains a **specialization** based on its
surrounding biomes, which adds a passive bonus on production hits:

- **Industrial** (ore) → +1 ore
- **Agricultural** (wheat) → +1 wheat
- **Sheep** (sheep) → +1 sheep
- **Trade** (brick) → cheaper bank trades
- **Research** (wood) → civilization momentum

A **Mega City** becomes a glowing, animated landmark visible across the board
and is worth 4 VP — a serious late-game threat, but never an automatic win.

## Trading

- **Bank / Port:** trade N identical resources for 1 of your choice. N is 4 by
  default, 3 with a generic port, 2 with a matching resource port, and less with
  a Trade-specialized city.
- **Opponents:** offer resources and request others. NPCs accept or refuse based
  on value, personality, and any grudges they hold. A live indicator shows
  whether an offer is likely to land.

## NPC personalities

Opponents play visibly different styles: **Expansionist**, **Hoarder**, **Trade
Addict**, **Chaotic Gambler**, **Defensive Builder**, and the **Apparently
Incompetent** one that occasionally does something terrifying. They react
emotionally, hold short-lived grudges, and can form **rivalries** (Trade War,
Border Dispute, The Sheep Incident, …) that flavor dialogue and nudge priorities
— never enough to override an obvious winning move.

## Chaos modifiers (optional, set at setup)

- **Turbo Economy** — more resources, lower VP target, shorter game.
- **World Events** — periodic booms, storms, festivals, and suspicious sheep,
  each with a clear announcement, affected area, and duration.
- **Golden Hex** — one tile yields wildcard loot.
- **Friendly Robber** — the robber leaves a consolation sheep.
- **NPC Drama** — grudges and rivalries amplified.
- **Maximum Sheep** — sheep matter. The game does not explain further.

Every chaotic system is bounded: it can't invalidate game state, delete required
structures, make victory impossible, or block turn progression.

## Winning

Reaching the VP target freezes the game and launches the victory celebration,
followed by a match report — real statistics (resources produced, longest road,
turns) and deliberately ridiculous ones (sheep economically mobilized, the
settlement with the strongest name, the angriest opponent). From there you can
rematch the same seed, keep settings with a new map, generate a new world, or
return to setup — no page refresh ever required.

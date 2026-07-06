// Budget/coin/plant-status logic. Pure functions are exported directly so
// they're easy to unit-test; the impure wrappers at the bottom read/write
// through services/storage.js for callers (pages/components) to use.

import {
  PLANT_THRESHOLDS,
  NOTE_COINS_REWARD,
  NOTE_BUDGET_RESTORE_MINUTES,
} from '../../shared/constants.js';
import { getGameState, setGameState } from '../../shared/storage.js';

export function getPlantStatus(minutesRemaining, budgetMinutesTotal) {
  if (budgetMinutesTotal <= 0) return 'dead';
  const pct = minutesRemaining / budgetMinutesTotal;
  if (pct <= 0) return 'dead';
  if (pct >= PLANT_THRESHOLDS.THRIVING) return 'thriving';
  if (pct >= PLANT_THRESHOLDS.OKAY) return 'okay';
  return 'wilting';
}

function withRecomputedPlant(game) {
  return {
    ...game,
    plant: getPlantStatus(game.budgetMinutesTotal - game.budgetMinutesUsed, game.budgetMinutesTotal),
  };
}

// Pure: +10 coins, +15 budget minutes restored (capped at total).
export function awardNoteCompletion(game) {
  return withRecomputedPlant({
    ...game,
    coins: game.coins + NOTE_COINS_REWARD,
    budgetMinutesUsed: Math.max(0, game.budgetMinutesUsed - NOTE_BUDGET_RESTORE_MINUTES),
  });
}

// Pure: spend `coins` to restore `minutes` of budget. Returns null if the
// user doesn't have enough coins (caller should no-op in that case).
export function redeemCoinsForTime(game, coins, minutes) {
  if (game.coins < coins) return null;
  return withRecomputedPlant({
    ...game,
    coins: game.coins - coins,
    budgetMinutesUsed: Math.max(0, game.budgetMinutesUsed - minutes),
  });
}

// --- Impure wrappers (storage-backed) -----------------------------------

export function awardForNote() {
  const current = getGameState();
  const updated = awardNoteCompletion(current);
  setGameState(updated);
  return updated;
}

export function redeemTime(coins, minutes) {
  const current = getGameState();
  const updated = redeemCoinsForTime(current, coins, minutes);
  if (updated) setGameState(updated);
  return updated;
}

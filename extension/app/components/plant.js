import { getGameState } from '../services/game.js';

const PLANT_EMOJI = {
  thriving: '🌸',
  okay: '🌿',
  wilting: '🥀',
  dead: '💀',
};

const PLANT_LABEL = {
  thriving: 'Thriving',
  okay: 'Okay',
  wilting: 'Wilting',
  dead: 'Wilted',
};

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ringColor(plant) {
  switch (plant) {
    case 'thriving': return 'var(--color-accent)';
    case 'okay': return 'var(--color-warn)';
    case 'wilting': return 'var(--color-danger)';
    default: return 'var(--color-muted)';
  }
}

// Renders the garden card into `container` and returns a `refresh()`
// function callers can invoke after game state changes elsewhere.
export function mountPlant(container) {
  container.innerHTML = `
    <div class="card plant-card">
      <h2>Dopamine Garden</h2>
      <div class="plant-card__visual" id="plantVisual"></div>
      <svg class="plant-card__gauge" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="${RING_RADIUS}" class="gauge__track" />
        <circle cx="60" cy="60" r="${RING_RADIUS}" id="gaugeFill" class="gauge__fill" />
        <text x="60" y="64" text-anchor="middle" id="gaugeText" class="gauge__text"></text>
      </svg>
      <p class="plant-card__status" id="plantStatusText"></p>
      <p class="plant-card__coins" id="plantCoins"></p>
      <button class="btn btn--accent" id="earnTimeBtn" type="button">Earn More Time</button>
    </div>
  `;

  const gaugeFill = container.querySelector('#gaugeFill');
  gaugeFill.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;

  container.querySelector('#earnTimeBtn').addEventListener('click', () => {
    document.getElementById('queueSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  function refresh() {
    const game = getGameState();
    const remaining = Math.max(0, game.budgetMinutesTotal - game.budgetMinutesUsed);
    const pct = game.budgetMinutesTotal > 0 ? remaining / game.budgetMinutesTotal : 0;

    container.querySelector('#plantVisual').textContent = PLANT_EMOJI[game.plant] || PLANT_EMOJI.dead;
    container.querySelector('#plantVisual').className = `plant-card__visual plant--${game.plant}`;
    container.querySelector('#plantStatusText').textContent =
      `${PLANT_LABEL[game.plant] || 'Unknown'} — ${remaining} / ${game.budgetMinutesTotal} min left today`;
    container.querySelector('#plantCoins').textContent = `🪙 ${game.coins} coins`;

    const offset = RING_CIRCUMFERENCE * (1 - pct);
    gaugeFill.style.stroke = ringColor(game.plant);
    gaugeFill.style.strokeDashoffset = `${offset}`;
    container.querySelector('#gaugeText').textContent = `${Math.round(pct * 100)}%`;

    return game;
  }

  refresh();
  return { refresh };
}

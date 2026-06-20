// Thin DOM helpers for the menu, HUD and toast. No game logic lives here.
export const el = (id) => document.getElementById(id);

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  el(id).classList.add('active');
}

export function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

export function enterGame() {
  el('menu').classList.add('hidden');
  el('hud').classList.add('show');
  el('hint').classList.remove('gone');
}

export function backToMenu() {
  el('menu').classList.remove('hidden');
  el('hud').classList.remove('show');
  showScreen('screen-main');
}

export function hideHint() { el('hint').classList.add('gone'); }
export function showHint() { el('hint').classList.remove('gone'); }

export function updateHud(shots, potted) {
  el('hud-shots').textContent = shots;
  el('hud-potted').textContent = `${potted}/15`;
}

export function updateTurn(mode, mine) {
  const t = el('hud-turn');
  if (mode === 'solo') { t.style.display = 'none'; return; }
  t.style.display = '';
  t.textContent = mine ? 'Tu turno' : 'Turno del rival';
  t.style.background = mine ? 'rgba(60,200,130,.25)' : 'rgba(200,80,80,.25)';
  t.style.borderColor = mine ? 'rgba(120,255,180,.5)' : 'rgba(255,140,140,.5)';
}

export function setStatus(id, text, error = false) {
  const s = el(id);
  s.textContent = text;
  s.classList.toggle('error', error);
}

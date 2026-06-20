// DOM helpers for the menu, HUD, toast, big banner and modal dialogs. No game logic.
export const el = (id) => document.getElementById(id);

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  el(id).classList.add('active');
}

export function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// big centred announcement with a pop animation
export function banner(text) {
  const b = el('banner');
  b.querySelector('.txt').textContent = text;
  b.classList.remove('show');
  void b.offsetWidth; // restart the CSS animation
  b.classList.add('show');
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

export function updateHud(shots, potted, total) {
  el('hud-shots').textContent = shots;
  el('hud-potted').textContent = `${potted}/${total}`;
}

export function updateTurn(mode, mine) {
  const t = el('hud-turn');
  if (mode === 'solo') { t.style.display = 'none'; return; }
  t.style.display = '';
  t.textContent = mine ? 'Tú' : 'Rival';
  t.style.background = mine ? 'rgba(70,220,140,.28)' : 'rgba(220,90,90,.28)';
}

export function setStatus(id, text, error = false) {
  const s = el(id);
  s.textContent = text;
  s.classList.toggle('error', error);
}

export function setMuteIcon(muted) { el('btn-mute').textContent = muted ? '🔇' : '🔊'; }

// modal that resolves true (Aceptar) / false (Rechazar)
function modal(modalId, acceptId, rejectId) {
  return new Promise((resolve) => {
    const m = el(modalId), a = el(acceptId), r = el(rejectId);
    m.classList.add('show');
    const done = (v) => { m.classList.remove('show'); a.onclick = null; r.onclick = null; resolve(v); };
    a.onclick = () => done(true);
    r.onclick = () => done(false);
  });
}
export const askNotifications = () => modal('notif-modal', 'notif-accept', 'notif-reject');
export const askRestart = () => modal('confirm-modal', 'confirm-accept', 'confirm-reject');

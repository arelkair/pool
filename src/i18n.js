const STR = {
  es: {
    tagline: 'Billar 8, directo entre navegadores.',
    solo: 'Solo', soloDesc: 'Práctica libre, sin rival.',
    multiplayer: 'Multijugador', multiDesc: 'Un rival, un código de cuatro letras.',
    settings: 'Ajustes', settingsDesc: 'Idioma.',
    back: 'Volver',
    create: 'Crear partida', createDesc: 'Genera un código y espera al rival.',
    join: 'Unirse a partida', joinDesc: 'Escribe el código de la otra persona.',
    connect: 'Conectar',
    restart: 'Reiniciar', menu: 'Menú',
    language: 'Idioma', spanish: 'Español', english: 'Inglés',
    hostHint: 'Comparte este código con quien quieras jugar.',
    joinHint: 'Escribe el código de la sala.',
    aimHint: 'Arrastra desde la bola blanca y suelta para tirar. Cuanto más estiras, más fuerza.',
    shots: 'Tiros', potted: 'Embocadas', you: 'Tú', rival: 'Rival', solids: 'Lisas', stripes: 'Rayadas',
    notifQuestion: '¿Deseas habilitar las notificaciones para saber cuando es tu turno si estás haciendo otras cosas?',
    accept: 'Aceptar', reject: 'Rechazar',
    confirmRestart: '¿Estás seguro de que quieres reiniciar la partida?',
    confirmExit: '¿Estás seguro de que quieres salir?',
    rivalJoined: 'El rival se ha unido a la partida',
    youLeft: 'Te has salido de la partida.',
    rivalLeft: 'El otro jugador se ha desconectado',
    yourTurn: 'Es tu turno.', rivalTurn: 'Es el turno del rival.',
    ballInHandYou: 'Falta: tienes la bola en mano. Colócala donde quieras.',
    placeCueHint: 'Toca la mesa para colocar la bola blanca donde quieras.',
    mustStripes: 'Tienes que meter todas las bolas rayadas.',
    mustSolids: 'Tienes que meter todas las bolas lisas.',
    won: 'Has ganado.', lost: 'Has perdido.',
    notifEnabled: 'Se han habilitado las notificaciones del sistema.',
    notifTurnBody: 'Hey, no te despistes, que es tu turno.',
    connecting: 'Conectando…', waitingHost: 'Conectado. Esperando al anfitrión…',
    closed: 'Conexión cerrada.', notFound: 'No se ha encontrado la sala o el código es incorrecto.',
    code4: 'Escribe el código de 4 letras.',
  },
  en: {
    tagline: '8-ball, peer to peer.',
    solo: 'Singleplayer', soloDesc: 'Free practice, no opponent.',
    multiplayer: 'Multiplayer', multiDesc: 'One opponent, a four-letter code.',
    settings: 'Settings', settingsDesc: 'Language.',
    back: 'Back',
    create: 'Create game', createDesc: 'Get a code and wait for your opponent.',
    join: 'Join game', joinDesc: "Type the other player's code.",
    connect: 'Connect',
    restart: 'Restart', menu: 'Menu',
    language: 'Language', spanish: 'Spanish', english: 'English',
    hostHint: 'Share this code with whoever you want to play.',
    joinHint: 'Enter the room code.',
    aimHint: 'Drag from the cue ball and release to shoot. The further you pull, the more power.',
    shots: 'Shots', potted: 'Potted', you: 'You', rival: 'Opponent', solids: 'Solids', stripes: 'Stripes',
    notifQuestion: 'Do you want to enable notifications to know when it is your turn while you are doing other things?',
    accept: 'Accept', reject: 'Decline',
    confirmRestart: 'Are you sure you want to restart the game?',
    confirmExit: 'Are you sure you want to leave?',
    rivalJoined: 'Your opponent has joined the game',
    youLeft: 'You have left the game.',
    rivalLeft: 'The other player has disconnected',
    yourTurn: 'It is your turn.', rivalTurn: 'It is your opponent’s turn.',
    ballInHandYou: 'Foul: ball in hand. Place it anywhere on the table.',
    placeCueHint: 'Tap the table to place the cue ball anywhere you want.',
    mustStripes: 'You must pot all the striped balls.',
    mustSolids: 'You must pot all the solid balls.',
    won: 'You won.', lost: 'You lost.',
    notifEnabled: 'System notifications have been enabled.',
    notifTurnBody: 'Hey, don’t get distracted, it is your turn.',
    connecting: 'Connecting…', waitingHost: 'Connected. Waiting for the host…',
    closed: 'Connection closed.', notFound: 'Room not found or the code is incorrect.',
    code4: 'Enter the 4-letter code.',
  },
};

let lang = localStorage.getItem('pool-lang') || 'en';

export function getLang() {
  return lang;
}

export function t(key) {
  return (STR[lang] && STR[lang][key]) || STR.es[key] || key;
}

export function setLang(l) {
  lang = STR[l] ? l : 'es';
  localStorage.setItem('pool-lang', lang);
  applyStatic();
}

export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

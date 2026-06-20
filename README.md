# Pool

Juego de billar 2D para navegador. Física propia, gráficos realistas y multijugador 1v1 por internet.

🎱 **Jugar:** https://pool-arelkair.vercel.app

## Cómo se juega

- **Solo:** práctica libre.
- **Multijugador:** un jugador pulsa *Crear partida* y comparte el **código de 4 letras**; el otro pulsa *Unirse a partida* y lo escribe. Funciona por internet (P2P vía WebRTC), sin servidores ni configurar el router. Se juega por turnos: si embocas, repites; si no, pasa el turno.

Para tirar: arrastra desde la bola blanca y suelta. Cuanto más estiras, más fuerza.

## Estructura

```
src/
  config.js    constantes (mesa, bolas, parámetros de física)
  physics.js   motor de billar propio (colisiones, fricción, troneras) + self-test
  scene.js     render con PixiJS (mesa, bolas, apuntado)
  net.js       multijugador P2P con PeerJS (salas por código)
  ui.js        menú, HUD y avisos (DOM)
  main.js      bucle de juego, controles y turnos
```

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # self-test de la física
npm run build    # build de producción (dist/)
```

# RL Panel

Panel de escritorio para **Rocket League (Epic Games) con Easy Anti-Cheat activado**.
Recupera parte de lo que daba BakkesMod **sin tocar el proceso del juego**: nada de inyección,
lectura de memoria ni hooks. Solo usa:

- la **Stats API oficial de Psyonix** (WebSocket local que abre el propio juego),
- el **launcher de Epic** y su configuración por juego (la misma que ves en la biblioteca),
- los **logs** que el juego escribe en `Documents\My Games\Rocket League`.

## Qué hace

| Función | Cómo |
|---|---|
| **Overlay** con marcador, reloj, tu boost y velocidad, victorias-derrotas de la sesión, goles y eventos | Página HTML que se conecta a `ws://127.0.0.1:49124` (Stats API). Ventana flotante transparente o **fuente Navegador de OBS** (archivo local, fondo transparente). |
| **Colocar el overlay arrastrándolo** | *Overlay → Colocar en pantalla*: aparece con datos de ejemplo, una barra para arrastrarlo y un deslizador de tamaño que se ve en directo. La ventana se ajusta sola al contenido. |
| **Atajo de teclado global** (por defecto `Ctrl+Alt+O`) | Muestra u oculta el overlay sin salir del juego. Se cambia en *Ajustes* tecleando la combinación. |
| **Registro de partidas**: resultado, marcador, tus goles/asistencias/paradas/tiros, duración y el MMR ganado o perdido | Escucha la Stats API mientras el panel está abierto (basta con que esté en la bandeja) y guarda cada partida. Agrupa por **hoy**, **sesión** (corta tras hora y media sin jugar) y **total**, con racha y porcentaje por playlist. El ±MMR se cruza con el log del juego. |
| **Lanzador dual**: *Jugar online (EAC)* / *Entrenar sin EAC* | Enlace oficial `com.epicgames.launcher://…` y el argumento `-noeac` (modo oficial de Psyonix para offline/entrenamiento/mods) añadido temporalmente a los *argumentos adicionales* de Epic. Como Epic solo relee esos argumentos al arrancar, el panel **cierra y reinicia el launcher de Epic** (unos 15 s) y deja tus argumentos como estaban. El modo real se verifica leyendo `EAC: bAntiCheatEnabled` del log del juego. |
| **Historial de MMR** por playlist | Lee `PartyLeaderMMR` y `PartyLeaderTier` de `Launch.log` cada vez que entras en cola. Persistente (los logs del juego se purgan solos). |
| Activar la Stats API | Escribe `PacketSendRate` en `TAStatsAPI.ini` (requiere reiniciar el juego). |

### Sobre el MMR: hay que calibrarlo una vez

El juego **no** escribe tu MMR en el log: escribe un número interno suyo, y la conversión a MMR
cambia de una cuenta a otra. Hasta que le des un valor real, el panel marca los MMR con `≈` y avisa
de que son una estimación. Los **cambios** (la columna Δ y el ±MMR de cada partida) sí son fiables
desde el primer momento.

Para calibrar: *Historial MMR* → elige una playlist → mira tu MMR real en el juego (Ajustes →
Interfaz → *Mostrar MMR*, o en tu perfil) → escríbelo. Con un punto por playlist el ajuste es casi
exacto; cada punto nuevo lo afina.

## Instalar

1. Descarga `RL Panel Setup x.y.z.exe` de [Releases](https://github.com/miquelGarcia14/rl/releases/latest) y ejecútalo.
2. Windows mostrará "Windows protegió tu PC" porque el instalador **no está firmado** (la firma cuesta
   dinero o exige un proceso de código abierto que está en marcha). Pulsa *Más información → Ejecutar de todas formas*.
3. Abre RL Panel → pestaña **Estado** → sigue los tres **primeros pasos** que aparecen ahí:
   activar la Stats API (y reiniciar Rocket League), decir tu MMR real una vez, y colocar el overlay.

## OBS

Fuente **Navegador** → marca **Archivo local** → elige `overlay.html` (el panel te copia la ruta en la
pestaña *Overlay*). Tamaño 1920×1080. Fondo transparente automático. OBS se conecta directamente al
juego; el panel puede estar cerrado.

Parámetros por URL (opcionales): `?show=score,clock,player,feed,record&scale=1.2&bg=0&scope=sesion&me=Epic|<id>|0`.

En OBS el panel puede estar cerrado; entonces el contador de victorias-derrotas cuenta solo lo que
ve desde que se abrió la fuente. Con el panel abierto usa el historial guardado.

## Entrenar sin EAC

Es el modo **oficial** "Play without Easy Anti-Cheat" de Psyonix: sin online, sin privadas, sin torneos;
sí entrenamiento, offline, LAN, repeticiones y mods (BakkesMod sigue actualizándose para este modo).
Si Epic ignorase el argumento, hazlo a mano: Epic → Rocket League → menú "···" → *Play without Easy Anti-Cheat*.

## Desarrollo

```bash
npm install
npm start                      # app en desarrollo
npm run replay                 # re-emite una captura real de la Stats API en el puerto del juego (juego cerrado)
node dev/selftest.js           # pruebas de los módulos (sobre copias de los .ini)
npx electron . --smoke         # arranca, vuelca estado y errores del renderer, y sale solo
npm run dist                   # instalador NSIS en dist/
```

## Actualizaciones

La app comprueba al arrancar si hay una versión nueva en [Releases](https://github.com/miquelGarcia14/rl/releases) de este
repositorio, la descarga en segundo plano y la instala al cerrar. Se puede desactivar en *Ajustes*.

## Privacidad y límites

- No envía nada a Internet salvo la comprobación de actualizaciones en GitHub (sin datos tuyos: solo pide la lista de versiones).
- El historial de partidas y de MMR se guarda **solo en tu equipo** (`%APPDATA%\RL Panel\`). Incluye los nombres de los jugadores de cada partida, que es lo que manda la propia Stats API.
- No modifica archivos del juego. No toca `RocketLeague_EAC.exe` ni el servicio de EAC.
- Jugar online sin EAC no es posible ni se pretende: es política de Psyonix.

Licencia MIT.

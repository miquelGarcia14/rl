# RL Panel

Panel de escritorio para **Rocket League (Epic Games) con Easy Anti-Cheat activado**.
Recupera parte de lo que daba BakkesMod **sin tocar el proceso del juego**: nada de inyección,
lectura de memoria ni hooks. Solo usa:

- la **Stats API oficial de Psyonix** (WebSocket local que abre el propio juego),
- el **launcher de Epic** y su configuración por juego (la misma que ves en la biblioteca),
- los **logs** que el juego escribe en `Documents\My Games\Rocket League`.

## Qué hace (v0.1)

| Función | Cómo |
|---|---|
| **Overlay** con marcador, reloj, tu boost y velocidad, goles y eventos | Página HTML que se conecta a `ws://127.0.0.1:49124` (Stats API). Ventana flotante transparente o **fuente Navegador de OBS** (archivo local, fondo transparente). |
| **Lanzador dual**: *Jugar online (EAC)* / *Entrenar sin EAC* | Enlace oficial `com.epicgames.launcher://…` y el argumento `-noeac` (modo oficial de Psyonix para offline/entrenamiento/mods) añadido temporalmente a los *argumentos adicionales* de Epic. Como Epic solo relee esos argumentos al arrancar, el panel **cierra y reinicia el launcher de Epic** (unos 15 s) y deja tus argumentos como estaban. El modo real se verifica leyendo `EAC: bAntiCheatEnabled` del log del juego. |
| **Historial de MMR** por playlist | Lee `PartyLeaderMMR` y `PartyLeaderTier` de `Launch.log` cada vez que entras en cola. Persistente (los logs del juego se purgan solos). Calibración configurable (por defecto MMR = valor × 20). |
| Activar la Stats API | Escribe `PacketSendRate` en `TAStatsAPI.ini` (requiere reiniciar el juego). |

## Instalar

1. Descarga `RL Panel Setup x.y.z.exe` de *Releases* y ejecútalo.
2. Windows mostrará "Windows protegió tu PC" porque el instalador **no está firmado** (la firma cuesta
   dinero o exige un proceso de código abierto que está en marcha). Pulsa *Más información → Ejecutar de todas formas*.
3. Abre RL Panel → pestaña **Estado** → pulsa **10 Hz** para activar la Stats API → reinicia Rocket League.

## OBS

Fuente **Navegador** → marca **Archivo local** → elige `overlay.html` (el panel te copia la ruta en la
pestaña *Overlay*). Tamaño 1920×1080. Fondo transparente automático. OBS se conecta directamente al
juego; el panel puede estar cerrado.

Parámetros por URL (opcionales): `?show=score,clock,player,feed&scale=1.2&bg=0&me=Epic|<id>|0`.

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

## Privacidad y límites

- No envía nada a Internet (salvo comprobar actualizaciones en GitHub si configuras un repositorio).
- No modifica archivos del juego. No toca `RocketLeague_EAC.exe` ni el servicio de EAC.
- Jugar online sin EAC no es posible ni se pretende: es política de Psyonix.

Licencia MIT.

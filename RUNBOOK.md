# RUNBOOK — EY SophIA Live Voting

Guía del operador para las **pruebas manuales** y para **gestionar el día del evento**.
Escrita para seguirse de arriba abajo. Si solo vas a leer una sección, lee
**«Cómo está configurada la cuenta»** y **«Comprobaciones previas del día del evento»**.

---

## 0. Cómo está configurada la cuenta (todos los pasos de propietario están HECHOS)

La configuración exclusiva del propietario está completa. Esta sección documenta **cómo está
configurada** para que puedas verificarla o reproducirla — aquí ya no hay nada que sea un bloqueo.

### (1) La Protección de Despliegue está DESACTIVADA (la app es pública) ✅
Producción está **desplegada y es PÚBLICA (en vivo)** en
**https://ey-sophia-live-joseluisalmendrals-projects.vercel.app**.
La Protección de Despliegue (Vercel Authentication / SSO) — el antiguo muro de login — se ha
**desactivado**, así que los asistentes que escanean el QR llegan directamente a la app.
- Confirmado: `GET /` y `GET /vote/DEMO42` devuelven ambos **200** (sin 302 a una página de
  login de Vercel).
- Para volver a comprobarlo: `curl -I https://ey-sophia-live-joseluisalmendrals-projects.vercel.app/`
  → se espera `200`.
- Dónde está el interruptor (por si alguna vez lo necesitas): Panel de Vercel → proyecto
  **ey-sophia-live** → **Settings → Deployment Protection → Vercel Authentication**.

Notas:
- Los despliegues anteriores marcados como «BLOCKED» eran un problema de **autorización del autor
  del commit**: los commits creados con un email que no pertenece al equipo
  (`joseluis.fernandez@thepower.education`) se rechazan.
  ARREGLADO — el repositorio hace los commits con el email de la cuenta de Vercel (`joseluisfunnels@gmail.com`).
- **Futuros colaboradores:** su email de commit debe ser el de un **miembro del equipo de Vercel** o
  el despliegue quedará bloqueado. Añádelos antes en **Vercel → Settings → Members**.
- Que producción esté desplegada implica que el **cron diario de keep-alive está ACTIVO** (§5) — el
  proyecto gratuito de Supabase no se pausará.

### (2) Las URLs de Auth de Supabase están configuradas (el magic-link del admin funciona) ✅
El admin inicia sesión mediante magic-link, que solo funciona si la Site URL + las Redirect URLs
están en la lista de permitidos. Esto está **hecho** — el login por magic-link está confirmado y funciona.
- Panel de Supabase → **Authentication → URL Configuration** (para referencia):
  - **Site URL:** `https://ey-sophia-live-joseluisalmendrals-projects.vercel.app`
  - **Redirect URLs (ambas configuradas):**
    - `https://ey-sophia-live-joseluisalmendrals-projects.vercel.app/**`
    - `http://localhost:3000/**`   (para que los magic-links de las pruebas en local también funcionen)

> Si alguna vez los admins no pueden iniciar sesión, esto (las Redirect URLs) es lo primero que
> hay que volver a comprobar.

---

## 1. Ejecutar la app en local (para pruebas)

```bash
# desde la raíz del proyecto
pnpm install          # solo la primera vez
pnpm build            # debe terminar LIMPIO (así es)
pnpm start            # sirve la build de producción REAL en http://localhost:3000
```
`.env.local` ya apunta a la Supabase de producción real, así que local = BD real +
realtime real. Esto es exactamente lo que vas a probar.

Poll de demo para practicar: código de acceso **DEMO42** (4 equipos). Resetéalo a borrador antes de
una ronda limpia (ver §6).

---

## 2. Recorrido del happy-path (haz esto de principio a fin al menos una vez)

Vas a necesitar **dos dispositivos**: un portátil (admin + proyector) y un móvil (votante).

1. **El admin inicia sesión.** Ve a `/admin`. Si no has iniciado sesión, se te envía a `/admin/login`.
   Introduce un email de admin de la lista de permitidos → «Enviar enlace» → abre el magic link desde
   tu bandeja de entrada → aterrizas en el panel de admin.
2. **Crea / abre un poll.** Usa el poll de demo (DEMO42) o crea uno nuevo:
   título, añade equipos (nombre + color — el selector de color muestra una vista previa de contraste
   en vivo), opcionalmente fija una **duración de apertura** (segundos) para una votación cronometrada
   con auto-cierre, y elige el tipo de gráfica. El poll empieza en **Borrador (draft)**.
3. **Abre el proyector.** En el portátil (o en una segunda pantalla/proyector), abre
   `/screen/DEMO42`. Muestra el **lobby**: un QR grande, el código de acceso corto, y
   las tarjetas de los finalistas a cero. El QR codifica la url del VOTANTE (`/vote/DEMO42`), no la
   url de la pantalla — escanéalo con el móvil para confirmarlo.
4. **Los móviles se unen y la sala se llena.** Los asistentes escanean el QR → aterrizan en `/vote/DEMO42`.
   Mientras el poll está en borrador/cuenta atrás ven un estado animado de «la votación abre en breve»
   (NO los botones de voto).
5. **Abre la votación.** En el Live Control del admin, pulsa el botón grande de siguiente estado
   (Borrador → [Cuenta atrás] → **Abrir votación**). Los móviles pasan a las tarjetas de voto
   **sin recargar, en ~12s** (consultan el endpoint de estado con una cadencia suave — esto es
   así por diseño; ver LIMITS.md). El **proyector es instantáneo**. Si se fijó una duración, el
   proyector muestra una cuenta atrás en vivo.
6. **Observa la carrera en vivo — en la pantalla grande.** A medida que los móviles votan, la carrera
   de barras del **proyector** se anima en tiempo real (la barra líder brilla en amarillo EY). Los
   móviles a propósito **no** muestran la carrera en vivo — los votantes miran la pantalla grande. Un
   votante toca un equipo → **Votar** → recibe una confirmación («Tu voto para [Equipo] está
   registrado — mirá la pantalla grande»). Un segundo toque desde el mismo móvil se rechaza
   (un voto por dispositivo).
7. **Cierra y revela.** Pulsa **Cerrar votación y revelar** (con confirmación previa). El
   proyector ejecuta la revelación en 3 tiempos: pausa de suspense → podio (1º al centro) + corona +
   confeti → fuegos artificiales → reposo. Cada móvil que haya votado muestra **«Tu equipo quedó #N»**.

Ese es todo el espectáculo. Ensáyalo una vez completo antes del evento.

---

## 3. Casos límite a revisar a ojo (haz un spot-check de estos)

Todos están verificados en el código + los tests automáticos, pero revísalos a ojo en hardware real:

- **Código incorrecto → 404 limpio.** Abre `/vote/NOPE` y `/screen/NOPE` → página 404 con marca,
  HTTP 404 real (arreglado en esta pasada de QA). Sin crash.
- **Poll en borrador → sin botones de voto.** `/vote/DEMO42` en borrador muestra «abre en breve»,
  nunca las tarjetas en crudo.
- **Doble voto bloqueado.** Vota, luego recarga el móvil → ves el estado «ya votaste», no las
  tarjetas. Vota de nuevo desde un móvil *distinto* → el conteo sube.
- **Cierre con cero votos.** Abre y luego cierra un poll SIN votos → la revelación muestra un
  estado de «sin votos» diseñado (sin corona, sin NaN, sin crash).
- **Empate.** Dos equipos con el mismo conteo máximo: la regla por defecto corona a un único ganador
  determinista (el primero en alcanzar el conteo). Si fijas `double_crown`, hay dos co-ganadores.
- **Auto-cierre cronometrado.** Fija una duración corta (p. ej. 20 s), abre, aléjate — el poll se
  cierra solo y revela aunque nadie toque nada (autoritativo en el servidor).
- **Reconexión.** Apaga y enciende brevemente el wifi en el proyector → el tablero NO debe parpadear
  a vacío; mantiene los últimos conteos y se reanuda.
- **Movimiento reducido.** Activa «Reduce Motion» en un móvil → las entradas/confeti se reducen
  a fundidos cruzados; todo sigue funcionando.
- **Legibilidad en el proyector.** En el proyector REAL a la distancia REAL: ¿se lee el texto más
  pequeño? ¿Se distinguen bien los colores de los equipos? (Los proyectores aplastan los tonos
  medios — esto es lo único que los tests automáticos no pueden comprobar por ti.)

---

## 4. Checklist de dispositivos / navegadores

Prueba el flujo del VOTANTE en cada uno; el PROYECTOR solo necesita funcionar en el portátil que lo mueve.

| Dispositivo / navegador | Qué comprobar | Salvedades conocidas |
|---|---|---|
| **iOS Safari (iPhone)** | escanear QR, votar, ver confirmación + revelación | Sin vibración (iOS no tiene `navigator.vibrate` — se omite en silencio). El audio solo suena tras un toque. Modo privado: las cookies siguen funcionando (usamos cookies, no localStorage), así que la deduplicación + el estado al recargar sobreviven. |
| **Android Chrome** | escanear QR, votar, sentir el zumbido háptico al votar | Aquí la vibración funciona. Todo lo demás es idéntico. |
| **Chrome / Edge escritorio** | flujo completo + proyector | Soporte total incl. fondo con shader WebGL. |
| **Firefox escritorio** | flujo completo + proyector | Soporte total; el shader WebGL funciona. |
| **Safari escritorio** | flujo completo | Si WebGL está deshabilitado/anticuado, el fondo cae a un gradiente cósmico estático — sin error. |
| **Cualquier dispositivo, «Reduce Motion» activado** | votar + revelación | Las animaciones pasan a fundidos cruzados; confeti/fuegos desactivados; sigue siendo totalmente usable. |

**Cookies y https:** la cookie anti-fraude es `Secure`, lo que requiere https. En la URL de prod de
Vercel eso es automático. En `http://localhost:3000` los navegadores hacen una excepción para
localhost, así que las pruebas en local también funcionan. En cualquier OTRO host de http plano la
cookie Secure se descartaría y la deduplicación se debilitaría — usa siempre la URL de prod con https
para el evento real.

---

## 5. Keep-alive (no dejes que la BD se duerma)

La Supabase gratuita se pausa tras **7 días de inactividad**. Un proyecto pausado hace que la app
dé error en la primera carga.
- El cron diario de Vercel (`/api/cron/keepalive`, `0 6 * * *`) lo previene. **Producción está
  desplegada, así que este cron está ACTIVO** — la pausa de 7 días se gestiona automáticamente.
- **Por si acaso, la mañana del evento:** carga la app una vez ~1 hora antes de abrir puertas.
  Si estaba dormida por cualquier motivo, la primera carga la despierta (unos segundos), y luego
  ya está caliente.

---

## 6. Resetear el poll de demo a un estado limpio

Antes de un ensayo limpio o del evento real, resetea DEMO42 a su estado prístino (borrador, 0 votos,
sin timestamps). Desde el proyecto, usando la contraseña de la BD:

```bash
# lo más rápido: mediante el editor SQL de Supabase o psql
UPDATE polls SET status='draft', opens_at=NULL, closes_at=NULL
  WHERE join_code='DEMO42';
DELETE FROM votes WHERE poll_id=(SELECT id FROM polls WHERE join_code='DEMO42');
UPDATE team_tallies SET count=0
  WHERE poll_id=(SELECT id FROM polls WHERE join_code='DEMO42');
```
(Para el evento real, crea un poll NUEVO en lugar de reutilizar el de demo — historial y analítica
más limpios.)

---

## 7. Comprobaciones previas del día del evento

Ejecuta esto ~60 minutos antes de abrir puertas.

- [ ] **Producción es accesible.** Abre la URL de prod, confirma que `/` devuelve 200 y carga.
      (Producción está desplegada y es pública — esto es solo una comprobación de cordura. Solo como
      fallback si la sede no puede alcanzarla por algún motivo: ejecuta desde un portátil con
      `pnpm start` en la red de la sede y confirma que los móviles llegan a `http://<ip-del-portátil>:3000`.)
- [ ] **La BD está despierta.** Carga `/vote/<código>` una vez; confirma que no hay error / que el
      arranque en frío ya pasó.
- [ ] **El admin puede iniciar sesión.** Haz un login real por magic-link ahora, no a la hora del
      show. Si falla → comprueba las Redirect URLs de Supabase (§0.2).
- [ ] **Poll creado y en borrador.** Equipos, colores, duración (si es cronometrado) y tipo de
      gráfica configurados.
- [ ] **El proyector muestra el lobby.** QR escaneable desde el fondo de la sala; código de acceso
      grande y legible; tarjetas de finalistas visibles a cero.
- [ ] **Prueba de escaneo.** Escanea el QR de la pantalla con un móvil → aterriza en la página de
      voto correcta con los equipos correctos.
- [ ] **Un ensayo completo** en la red real: abrir → 2–3 votos de prueba desde 2 móviles →
      cerrar → revelar. Luego **resetea** (§6) antes de la audiencia real.
- [ ] **Tamaño de sala dentro de los límites.** Ver LIMITS.md — el tier gratuito es cómodo hasta
      varios cientos de asistentes (verificado seguro hasta ~300 móviles con la cadencia de 12s).
      Los votantes usan polling cacheado por CDN (cero conexiones de Realtime), así que no entra en
      juego ningún límite de conexiones de Supabase. Para una sala mucho más grande, alarga el
      intervalo de polling (ver LIMITS) — sin necesidad de upgrade.
- [ ] **Cordura del wifi.** El wifi de la sede que van a usar los móviles es accesible. (Los votantes
      solo hacen peticiones HTTPS planas — sin WebSockets — así que un wifi de invitados que bloquee
      WS NO es un problema para los móviles. El portátil del proyector sí usa Realtime; ponlo en una
      red que permita WebSockets. Aun así, merece la pena lanzar un voto de prueba real en el wifi
      de la sede.)
- [ ] **Ruta de movimiento reducido** revisada rápidamente a ojo en un móvil.

---

## 8. Resolución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| El magic-link del admin no lleva a ninguna parte / da error | Redirect URLs de Supabase sin configurar (§0.2). Añade tanto prod `/**` como localhost `/**`. |
| La app da error en la primera carga la mañana del evento | La BD estaba pausada (sueño de 7 días). Recarga una vez para despertarla. El cron diario de keep-alive (§5) normalmente lo previene. |
| Los móviles no muestran la carrera en vivo | Es lo esperado — por diseño. Los móviles NO muestran la carrera en vivo; los votantes miran la pantalla grande. Los móviles solo reflejan abierto/cerrado (en ~12s) y su «#N» personal al final. |
| Los móviles tardan en pasar a «abierto»/«cerrado» | Es lo esperado — los móviles consultan con una cadencia suave de ~12s (segura por IP, ver LIMITS). El proyector es instantáneo. Nada que arreglar; el presentador da la señal de «votad ahora» y los móviles se ponen al día en un ciclo. |
| Una IP concreta recibe HTTP 403 con `x-vercel-mitigated: deny` | Mitigación de DDoS por IP de Vercel (temporal, por IP). La cadencia suave enviada está verificada para NO dispararla a escala de sala — solo las inundaciones patológicas de peticiones lo hacen. Si ocurre, se resuelve sola; no machaques con reintentos. Para una sala mucho más grande, alarga el intervalo de polling (LIMITS). |
| La carrera en vivo no se mueve en el proyector mientras hay votos | Comprueba que el proyector está en `/screen/<código>` (no una pestaña antigua), y que el estado del poll es **abierto**. El primer cambio de estado tras una página recién cargada puede tardar 1–2 s (calentamiento de realtime) — es normal. |
| Un votante no puede votar («cerrado» / «no abierto») | El poll no está `abierto`. Ábrelo desde el Live Control del admin. Los polls cronometrados se auto-cierran al llegar a la duración — reabrir requiere un poll nuevo (cerrado es terminal). |
| Parece que el voto no deduplica | Estás en un host de http plano (no localhost), así que la cookie Secure se descartó. Usa la URL de prod con https. |
| El fondo está plano (sin shader) | WebGL no disponible o Reduce-Motion activado → fallback intencionado a gradiente CSS. No es un bug. |
| La cuenta atrás está mal después de bloquear el móvil | La cuenta atrás se recalcula a partir del `closes_at` del servidor al reanudar — desbloquea y se corrige sola. |

---

## 9. Qué se verificó en QA (para que puedas confiar en lo anterior)

Probado contra la Supabase de prod REAL con la build de producción REAL:
- Smoke: todas las rutas correctas (incl. 404 real para códigos incorrectos — arreglado en esta pasada).
- Realtime E2E: voto → broadcast del recuento (conteo absoluto), deduplicación, abierto/cerrado/no-abierto,
  cuenta atrás `closes_at`. 13/13.
- Edge: cero votos, empates (corona simple + doble), podios de 1/2/12 equipos, nombres de equipo
  con emoji/largos/de inyección (almacenados de forma segura, sin XSS), doble envío rápido (exactamente 1
  voto), aislamiento entre polls. Todos pasan.
- Carga (escrituras): 150 y 200 votos concurrentes = 100% de éxito, recuentos EXACTOS,
  p95 ≈ 570–710 ms, sin rate-limits.
- Carga (polling del votante, por IP): 2250 peticiones a ~25 req/s durante 90s desde una ÚNICA IP =
  2250× HTTP 200, CERO 403 / cero `x-vercel-mitigated`. La cadencia suave no dispara la mitigación de
  DDoS por IP de Vercel a escala de sala (~300 móviles a 12s).
- Cacheo de CDN verificado en prod: `/api/poll/[id]/status` y `/results` devuelven
  `x-vercel-cache: HIT` y NINGÚN `Set-Cookie` (sin cookies → cacheable por CDN).
- Fallbacks de navegador (WebGL→CSS, WebAudio no-op, guard de vibrate, cookies, sin
  localStorage, movimiento reducido) todos presentes.
- Dos bugs encontrados y arreglados (semántica de resultado cerrado en cast_vote; notFound() devolviendo 200).
- Arquitectura del votante: los votantes usan polling HTTP cacheado por CDN (`usePollStatus`), cero
  conexiones de Realtime; solo el proyector usa Realtime (2 conexiones).
</content>
</invoke>

/**
 * BROQUI phone line pool (es-ES) — the `phone_*` categories only.
 *
 * Split from lines.es.ts so the voter bundle (PhoneMascot) ships just these
 * rows and never the projector pool. Same data contract as lines.es.ts; the
 * full LINES export there concatenates both pools for the /lab self-check.
 * Type-only import below: no runtime dependency on the projector pool.
 */

import type { Line } from "./lines.es";

export const PHONE_LINES: Line[] = [
  // phone_lobby
  { id: "plob-01", category: "phone_lobby", text: "Hola, soy Broqui. Cuando se abra la votación, te aviso aquí mismo.", expression: "talking", anonSafe: true, pack: "core", weight: 2 },
  { id: "plob-02", category: "phone_lobby", text: "Mientras esperas, dame un toque. Venga, nadie mira.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "plob-03", category: "phone_lobby", text: "Mira la pantalla grande. Yo salgo allí, más guapo.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "plob-04", category: "phone_lobby", text: "No cierres esta pestaña, que me pongo triste.", expression: "sad", anonSafe: true, pack: "core" },
  { id: "plob-05", category: "phone_lobby", text: "Todavía no se puede votar. A mí también me desespera.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "plob-06", category: "phone_lobby", text: "Se abrirá sin recargar. Magia. Bueno, código.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "plob-07", category: "phone_lobby", text: "Consejo profesional: sube el brillo. Consejo personal: sonríe.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "plob-08", category: "phone_lobby", text: "Aquí no hace falta prompt. Solo un pulgar y criterio.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "plob-09", category: "phone_lobby", text: "Si se bloquea el móvil, no pasa nada: aquí sigo.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "plob-10", category: "phone_lobby", text: "Ve pensando tu voto. Cruza fuentes: tu cabeza y tu instinto.", expression: "thinking", anonSafe: true, pack: "fy27", weight: 2 },
  // phone_poke
  { id: "ppoke-01", category: "phone_poke", text: "¡Eh! Soy un escudo, no un botón.", expression: "surprised", anonSafe: true, pack: "core", weight: 2 },
  { id: "ppoke-02", category: "phone_poke", text: "Me haces cosquillas en el logo.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "ppoke-03", category: "phone_poke", text: "¿No tienes un Excel pendiente?", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "ppoke-04", category: "phone_poke", text: "Otra vez y te lo facturo.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "ppoke-05", category: "phone_poke", text: "Vale, vale, me rindo.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "ppoke-06", category: "phone_poke", text: "Esto no cuenta como voto. Que conste en acta.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "ppoke-07", category: "phone_poke", text: "¿Me estás auditando? Porque esto ya es mucho muestreo.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "ppoke-08", category: "phone_poke", text: "Cuidado, que soy de cristal.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "ppoke-09", category: "phone_poke", text: "Ni Copilot recibe tantos toques.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "ppoke-10", category: "phone_poke", text: "Otro toque y hago un truco. Es broma, no sé trucos.", expression: "laughing", anonSafe: true, pack: "core" },
  // phone_voting
  { id: "pvote-01", category: "phone_voting", text: "Elige bien: aquí no hay Ctrl+Z.", expression: "thinking", anonSafe: true, pack: "core", weight: 2 },
  { id: "pvote-02", category: "phone_voting", text: "Tú decides y firmas. Yo solo miro. De lejos.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "pvote-03", category: "phone_voting", text: "Un toque y listo. Piénsalo, pero no le hagas un Excel.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "pvote-04", category: "phone_voting", text: "Sin prisa, pero sin pausa. Que esto cierra.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "pvote-05", category: "phone_voting", text: "Tu voto es secreto. Yo miro para otro lado. Prometido.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "pvote-06", category: "phone_voting", text: "Vota con cabeza. O con corazón. Pero vota.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "pvote-07", category: "phone_voting", text: "Aquí Copilot no puede ayudarte. Esto es cosa tuya.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "pvote-08", category: "phone_voting", text: "Momento importante. Yo no miro. Bueno, un poco.", expression: "nervous", anonSafe: true, pack: "core" },
  // phone_confirm
  { id: "pconf-01", category: "phone_confirm", text: "¡Dentro! Ahora mira la pantalla grande.", expression: "celebrating", anonSafe: true, pack: "core", weight: 2 },
  { id: "pconf-02", category: "phone_confirm", text: "Voto registrado. Tu pulgar ya es historia.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "pconf-03", category: "phone_confirm", text: "¡Hecho! Ahora, a sufrir en compañía.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "pconf-04", category: "phone_confirm", text: "Voto a {team} registrado. Decidido y firmado.", expression: "smug", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "pconf-05", category: "phone_confirm", text: "¡Voto para {team}! Buena elección. Todas lo eran, ojo.", expression: "celebrating", anonSafe: false, pack: "core", weight: 2 },
  { id: "pconf-06", category: "phone_confirm", text: "{team} tiene tu voto. Y tú, mi admiración.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "pconf-07", category: "phone_confirm", text: "Voto a {team} dentro. Trazable, secreto y precioso.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "pconf-08", category: "phone_confirm", text: "Hecho: {team}. Sin Ctrl+Z y sin arrepentimientos.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "pconf-09", category: "phone_confirm", text: "Tu voto ya corre con {team}. Mira arriba.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "pconf-10", category: "phone_confirm", text: "¿De dónde sale la cifra de {team}? Ahora, en parte, de ti.", expression: "laughing", anonSafe: false, pack: "fy27" },
  // phone_wait
  { id: "pwait-01", category: "phone_wait", text: "La carrera está arriba. Yo me quedo aquí contigo.", expression: "idle", anonSafe: true, pack: "core", weight: 2 },
  { id: "pwait-02", category: "phone_wait", text: "Ya has votado. Ahora mira la pantalla y sufre con estilo.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "pwait-03", category: "phone_wait", text: "Tu voto ya está en la carrera. Relájate y mira arriba.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "pwait-04", category: "phone_wait", text: "Mientras tanto, mira arriba: ahí se ve de dónde sale cada cifra.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "pwait-05", category: "phone_wait", text: "{team} ya cuenta con tu voto. Ahora, a mirar arriba.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "pwait-06", category: "phone_wait", text: "¿Nervios por {team}? Yo también. Y eso que soy neutral.", expression: "nervous", anonSafe: false, pack: "core", weight: 2 },
  { id: "pwait-07", category: "phone_wait", text: "{team} te da las gracias. Bueno, se las doy yo. Sin permiso.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "pwait-08", category: "phone_wait", text: "Tu voto para {team} ya empuja su barra. Mira arriba.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "pwait-09", category: "phone_wait", text: "Esperando con {team}. Esto es peor que un cierre de año.", expression: "nervous", anonSafe: false, pack: "fy27" },
  { id: "pwait-10", category: "phone_wait", text: "Ya votaste a {team}. Tu parte está hecha; la mía, comentar.", expression: "smug", anonSafe: false, pack: "core" },
  // phone_already
  { id: "palr-01", category: "phone_already", text: "Ya votaste. Un voto por móvil: lo dice la ley. La mía.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "palr-02", category: "phone_already", text: "Tu voto ya está dentro. Aquí no hay segunda ronda.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "palr-03", category: "phone_already", text: "Ya votaste a {team}. Fidelidad, se llama.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "palr-04", category: "phone_already", text: "{team} ya tiene tu voto. Dos no caben, lo siento.", expression: "laughing", anonSafe: false, pack: "core" },
  { id: "palr-05", category: "phone_already", text: "Ya votaste a {team}. Decidido, firmado y cerrado.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "palr-06", category: "phone_already", text: "Tu voto a {team} ya está. Este móvil ha cumplido.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "palr-07", category: "phone_already", text: "Ya votaste. Otro intento y te pido evidencia.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "palr-08", category: "phone_already", text: "Ya votaste a {team}. Ni Copilot te deja votar dos veces.", expression: "laughing", anonSafe: false, pack: "fy27" },
  // phone_closed
  { id: "pclos-01", category: "phone_closed", text: "Esta vez no llegaste. Yo tampoco voté, tranquilo.", expression: "sad", anonSafe: true, pack: "core", weight: 2 },
  { id: "pclos-02", category: "phone_closed", text: "Se cerró. Mira la pantalla, que viene lo bueno.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "pclos-03", category: "phone_closed", text: "Votación cerrada. Ahora toca mirar arriba y sufrir.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "pclos-04", category: "phone_closed", text: "Cerrado. Lo que queda es puro espectáculo.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "pclos-05", category: "phone_closed", text: "Se acabó. Ni el mejor prompt reabre esto.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "pclos-06", category: "phone_closed", text: "Cerrado. {team} ya tiene tu voto. Cruza los dedos.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "pclos-07", category: "phone_closed", text: "Periodo cerrado. Ahora viene el informe. El bonito.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "pclos-08", category: "phone_closed", text: "Fin de la votación. Si no llegaste, no pasa nada. Aplaude igual.", expression: "idle", anonSafe: true, pack: "core" },
  // phone_reveal_1
  { id: "pr1-01", category: "phone_reveal_1", text: "¡{team} ha ganado! Siempre creí en tu criterio.", expression: "celebrating", anonSafe: false, pack: "core", weight: 2 },
  { id: "pr1-02", category: "phone_reveal_1", text: "¡Primero! Tienes ojo de auditor senior.", expression: "celebrating", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "pr1-03", category: "phone_reveal_1", text: "¡{team}, campeones! Y tú lo viste antes que nadie.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "pr1-04", category: "phone_reveal_1", text: "¡Ganó {team}! Me atribuyo parte del mérito. Poca. Bastante.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "pr1-05", category: "phone_reveal_1", text: "¡Has votado al ganador! Criterio de manual.", expression: "celebrating", anonSafe: true, pack: "core" },
  { id: "pr1-06", category: "phone_reveal_1", text: "¡Gana {team}! Tu voto, trazable hasta lo más alto del podio.", expression: "celebrating", anonSafe: false, pack: "fy27" },
  { id: "pr1-07", category: "phone_reveal_1", text: "¡Victoria! Decidiste, firmaste y acertaste.", expression: "celebrating", anonSafe: true, pack: "fy27" },
  { id: "pr1-08", category: "phone_reveal_1", text: "¡{team}! Pide que te inviten a la foto.", expression: "laughing", anonSafe: false, pack: "core" },
  // phone_reveal_2
  { id: "pr2-01", category: "phone_reveal_2", text: "Segundo puesto. Plata con muchísima dignidad.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "pr2-02", category: "phone_reveal_2", text: "Casi, casi. Muy casi.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "pr2-03", category: "phone_reveal_2", text: "{team}, en segundo lugar. Un podio así también se enmarca.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "pr2-04", category: "phone_reveal_2", text: "Plata para {team}. En mi informe, mención especial.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "pr2-05", category: "phone_reveal_2", text: "{team} queda en segundo lugar. Tu voto, de primera.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "pr2-06", category: "phone_reveal_2", text: "Subcampeones con tu voto. Eso también es criterio.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "pr2-07", category: "phone_reveal_2", text: "Segundo puesto para {team}. Material de sobra para presumir.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "pr2-08", category: "phone_reveal_2", text: "Plata. Lo importante es que votaste con cabeza. Y con ganas.", expression: "idle", anonSafe: true, pack: "core" },
  // phone_reveal_3
  { id: "pr3-01", category: "phone_reveal_3", text: "En el podio, que es donde hay que estar.", expression: "celebrating", anonSafe: true, pack: "core", weight: 2 },
  { id: "pr3-02", category: "phone_reveal_3", text: "Tercer puesto, pero tu voto fue el más elegante.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "pr3-03", category: "phone_reveal_3", text: "{team}, bronce. Y un bronce en un hackathon brilla mucho.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "pr3-04", category: "phone_reveal_3", text: "Podio para {team}. Eso no lo tiene cualquiera.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "pr3-05", category: "phone_reveal_3", text: "{team} sube al podio. Tu voto, trazable hasta ahí.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "pr3-06", category: "phone_reveal_3", text: "Bronce. Que no te lo quite nadie. Ni yo.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "pr3-07", category: "phone_reveal_3", text: "Tercer puesto para {team}. Opinión: favorable.", expression: "smug", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "pr3-08", category: "phone_reveal_3", text: "Tercer puesto. Tú, primero en criterio.", expression: "smug", anonSafe: true, pack: "core" },
  // phone_reveal_n
  { id: "prn-01", category: "phone_reveal_n", text: "{team} quedó en el puesto {rank}. Llegar hasta aquí ya es mucho.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "prn-02", category: "phone_reveal_n", text: "Puesto {rank}. Pero tu voto contó igual que todos.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "prn-03", category: "phone_reveal_n", text: "{team}, puesto {rank}. Llegar a la final ya es de nota.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "prn-04", category: "phone_reveal_n", text: "Puesto {rank} para {team}. Y mi aplauso, que es de primera.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "prn-05", category: "phone_reveal_n", text: "Esta vez no hubo podio. Tu criterio, en cambio, intacto.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "prn-06", category: "phone_reveal_n", text: "Puesto {rank}. En mi informe, sin salvedades.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "prn-07", category: "phone_reveal_n", text: "{team}, puesto {rank}. Merece la pena votar. Siempre.", expression: "idle", anonSafe: false, pack: "core" },
];

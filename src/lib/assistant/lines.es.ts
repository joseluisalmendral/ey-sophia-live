/**
 * BROQUI line pool (es-ES) — the curated comedy pool validated for the show.
 *
 * Pure data: no React, no timers. Consumed by resolveLine.ts (placeholder fill,
 * anonymous guard, 90-char guard) and selfCheck.ts (/lab self-check).
 *
 * Placeholders: {leader} {second} {last} {winner} {team} (team NAMES) and
 * {votes} {gap} {joined} {teamCount} {seconds} {milestone} {rank} (numbers).
 * `anonSafe === true` <=> the text carries no team NAME placeholder and no
 * colour word, so it can be spoken while identities are hidden.
 * {gap} lines assume gap >= 1; {votes} is the running total.
 *
 * Expression names match Broqui's `Expression` union 1:1 ("talking" = idle
 * pose + mouth flap; "peek" = the edge peek beat).
 */

import type { Expression } from "@/components/mascot/expressions";

export type LineCategory =
  | "lobby_ambient"
  | "lobby_joins"
  | "count_in"
  | "open_ambient"
  | "first_vote"
  | "lead_change"
  | "tie_top"
  | "milestone"
  | "surge"
  | "landslide"
  | "quiet"
  | "last10"
  | "close"
  | "reveal_suspense"
  | "reveal_winner"
  | "phone_lobby"
  | "phone_poke"
  | "phone_voting"
  | "phone_confirm"
  | "phone_wait"
  | "phone_already"
  | "phone_closed"
  | "phone_reveal_1"
  | "phone_reveal_2"
  | "phone_reveal_3"
  | "phone_reveal_n";

/** Subset of Broqui expressions a line may request. */
export type LineExpression = Extract<
  Expression,
  | "idle"
  | "nervous"
  | "smug"
  | "surprised"
  | "laughing"
  | "thinking"
  | "celebrating"
  | "sad"
  | "peek"
  | "talking"
>;

export interface Line {
  id: string;
  category: LineCategory;
  text: string;
  expression: LineExpression;
  anonSafe: boolean;
  pack: "core" | "fy27";
  /** Relative pick weight (default 1). */
  weight?: number;
}

export const LINES: Line[] = [
  // lobby_ambient
  { id: "lamb-01", category: "lobby_ambient", text: "Hola, soy Broqui. De broquel. Es un escudo. Sí, yo también lo busqué.", expression: "talking", anonSafe: true, pack: "core", weight: 2 },
  { id: "lamb-02", category: "lobby_ambient", text: "Escanead el QR. No leo vuestros correos. Ni los que pone «urgente».", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lamb-03", category: "lobby_ambient", text: "Soy una IA en un hackathon de IA. Vamos, que juego en casa.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "lamb-04", category: "lobby_ambient", text: "Estoy tranquilísimo. Es solo mi primera vez delante de tanta gente.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "lamb-05", category: "lobby_ambient", text: "Copilot asiste, vosotros decidís y firmáis. Yo comento. Reparto impecable.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "lamb-06", category: "lobby_ambient", text: "Si el QR no va, el código está debajo. Si el código no va, culpad al wifi.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lamb-07", category: "lobby_ambient", text: "He revisado el guion tres veces. No hay guion. Revisado queda.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "lamb-08", category: "lobby_ambient", text: "Móvil fuera, brillo al máximo, dignidad opcional.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "lamb-09", category: "lobby_ambient", text: "Me piden neutralidad. Soy un escudo: lo mío es defender, no opinar.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lamb-10", category: "lobby_ambient", text: "Un voto por móvil. Lo sé, a mí también me parece poco.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "lamb-11", category: "lobby_ambient", text: "Si alguien sigue conciliando algo, que pare. Hoy toca hackathon.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "lamb-12", category: "lobby_ambient", text: "Me he preparado muchísimo para esto. Unos cuatro minutos.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "lamb-13", category: "lobby_ambient", text: "Aviso: este escudo no protege contra la presión del directo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "lamb-14", category: "lobby_ambient", text: "Estoy aquí para animar. Y para llevarme el mérito si sale bien.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lamb-15", category: "lobby_ambient", text: "Si parpadeo mucho, son nervios. O una actualización pendiente.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "lamb-16", category: "lobby_ambient", text: "Pregunta de control: ¿de dónde sale esa cifra? Tranquilos, era para calentar.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "lamb-17", category: "lobby_ambient", text: "Hoy no hay que cruzar fuentes. Basta con cruzar los dedos.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "lamb-18", category: "lobby_ambient", text: "Vosotros, tres sprints. Yo, ninguno. Pero salgo en pantalla grande.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "lamb-19", category: "lobby_ambient", text: "Mi lámpara dice «todo va bien». Por dentro, no tanto.", expression: "nervous", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "lamb-20", category: "lobby_ambient", text: "Toda la tarde con Copilot de protagonista. Ahora me toca a mí.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "lamb-21", category: "lobby_ambient", text: "Prometo no hacer chistes de Excel. Prometo poco, eso sí.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "lamb-22", category: "lobby_ambient", text: "Buscad el QR. Es ese cuadrado que parece ruido, pero es arte.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "lamb-23", category: "lobby_ambient", text: "Soy la mascota oficial. Nadie me ha elegido, pero aquí estoy.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lamb-24", category: "lobby_ambient", text: "Consejo: sacad el móvil ahora. Luego vienen las prisas.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "lamb-25", category: "lobby_ambient", text: "Si el móvil os pide actualizar, decidle que ahora no. Hay prioridades.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "lamb-26", category: "lobby_ambient", text: "No soy un salvapantallas. Soy copresentador. Con contrato. Verbal.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "lamb-27", category: "lobby_ambient", text: "Soy de cristal, pero de los resistentes. Casi siempre.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "lamb-28", category: "lobby_ambient", text: "Hay premio: un máster para el ganador. Yo me conformo con un aplauso. O dos.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "lamb-29", category: "lobby_ambient", text: "Una IA presentando un hackathon de IA. Un poco endogámico, lo reconozco.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "lamb-30", category: "lobby_ambient", text: "Estoy calentando. Los escudos también estiramos antes de salir.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "lamb-31", category: "lobby_ambient", text: "Tranquilos, no os voy a pedir que habléis con el de al lado. Todavía.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "lamb-32", category: "lobby_ambient", text: "La verdad está repartida, dicen. El QR, en cambio, está ahí mismo.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  // lobby_joins
  { id: "ljoin-01", category: "lobby_joins", text: "¡Ya somos {joined}! Esto empieza a parecer quórum.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "ljoin-02", category: "lobby_joins", text: "{joined} en la sala. Con esto ya se aprueba un acta.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "ljoin-03", category: "lobby_joins", text: "{joined} conectados y yo sin haber ensayado.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "ljoin-04", category: "lobby_joins", text: "{joined} personas mirándome. Nadie me dijo que habría público.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "ljoin-05", category: "lobby_joins", text: "{joined} dentro. Muestra representativa, diría cualquier auditor.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "ljoin-06", category: "lobby_joins", text: "Con {joined} ya no puedo fingir que esto es un ensayo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "ljoin-07", category: "lobby_joins", text: "¡{joined}! Si esto fuera un Excel, ya tendría que hacer scroll.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "ljoin-08", category: "lobby_joins", text: "{joined} conectados. El wifi y yo sudamos juntos.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "ljoin-09", category: "lobby_joins", text: "Los que faltan: el QR no muerde. Ya somos {joined}.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "ljoin-10", category: "lobby_joins", text: "{joined} y subiendo. Esto ya no es una reunión, es un evento.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "ljoin-11", category: "lobby_joins", text: "{joined} dentro. Si votan todos, me emociono en público.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "ljoin-12", category: "lobby_joins", text: "¡{joined}! Ni la reunión de los lunes tiene tanta asistencia.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "ljoin-13", category: "lobby_joins", text: "{joined} conectados. Esto ya merece una tabla dinámica.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "ljoin-14", category: "lobby_joins", text: "Somos {joined}. Si alguien pregunta de dónde sale esa cifra: del QR.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "ljoin-15", category: "lobby_joins", text: "{joined} en la sala y ni una lámpara pidiendo ayuda. Así me gusta.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "ljoin-16", category: "lobby_joins", text: "Ya somos {joined}. Me brillan más los bordes. Será la presión.", expression: "idle", anonSafe: true, pack: "core" },
  // count_in
  { id: "cin-01", category: "count_in", text: "Esto empieza ya. Respirad. Yo no puedo, soy un escudo.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "cin-02", category: "count_in", text: "Cuenta atrás: mi momento favorito para arrepentirme de todo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "cin-03", category: "count_in", text: "Dedos listos. El primer voto tendrá mi admiración eterna.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "cin-04", category: "count_in", text: "Si tiemblo, es el refresco de la pantalla. No soy yo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "cin-05", category: "count_in", text: "Tres, dos… vale, que cuente el reloj, que es más fiable.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "cin-06", category: "count_in", text: "Preparad el pulgar. Sin presión. Bueno, un poco.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "cin-07", category: "count_in", text: "Nadie toque nada. Excepto el móvil. Tocad el móvil.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "cin-08", category: "count_in", text: "Voy a fingir que tengo esto controlado.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "cin-09", category: "count_in", text: "Modo directo: activado. Modo calma: no encontrado.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "cin-10", category: "count_in", text: "Si sale bien, mérito mío. Si sale mal, del wifi.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "cin-11", category: "count_in", text: "{teamCount} finalistas y un voto por cabeza. Aquí no hay Ctrl+Z.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "cin-12", category: "count_in", text: "Copilot asiste, tú decides y firmas. Pues ya está: toca decidir.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "cin-13", category: "count_in", text: "Para esto no hay Copilot. Aquí manda vuestro criterio.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "cin-14", category: "count_in", text: "El cierre es en nada. Perdón, la apertura. Deformación profesional.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "cin-15", category: "count_in", text: "Sprint final. El cuarto. Nadie os había hablado de él.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "cin-16", category: "count_in", text: "Respirad hondo. Yo lo simulo, que queda bien.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "cin-17", category: "count_in", text: "Pulgar caliente, cabeza fría. Lo he leído en una taza.", expression: "smug", anonSafe: true, pack: "core" },
  // open_ambient
  { id: "oamb-01", category: "open_ambient", text: "No miro las barras. Vale, sí. Solo un poquito.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "oamb-02", category: "open_ambient", text: "Mantengo la calma. Es mi cara de calma. No tengo otra.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "oamb-03", category: "open_ambient", text: "Si no has votado, tu móvil te mira con decepción.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "oamb-04", category: "open_ambient", text: "Las barras suben y mis nervios también. Correlación perfecta.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "oamb-05", category: "open_ambient", text: "Recordad: las barras suben con votos, no con miradas intensas.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "oamb-06", category: "open_ambient", text: "Voto a voto, como se audita: con muestra y paciencia.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "oamb-07", category: "open_ambient", text: "Este gráfico tiene más vida que un cuadro de amortización.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "oamb-08", category: "open_ambient", text: "Este gráfico lo he diseñado yo. Bueno, lo miro. Es casi lo mismo.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "oamb-09", category: "open_ambient", text: "Copilot os ayudó a pensar. Esto lo tenéis que hacer solitos.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "oamb-10", category: "open_ambient", text: "Las barras no se mueven solas. Bueno, sí, pero porque votáis.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "oamb-11", category: "open_ambient", text: "Soy neutral. Mis ojos van por libre, pero yo soy neutral.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "oamb-12", category: "open_ambient", text: "Si dudas entre dos, vota al que más te haya hecho pensar.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "oamb-13", category: "open_ambient", text: "Hay tensión. La noto en cada píxel.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "oamb-14", category: "open_ambient", text: "Este gráfico tiene más giros que una conciliación bancaria.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "oamb-15", category: "open_ambient", text: "Diferencia de {gap} arriba. ¿Material? Depende de a quién preguntes.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "oamb-16", category: "open_ambient", text: "{leader} va delante. Lo digo con total neutralidad. Mucha.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "oamb-17", category: "open_ambient", text: "{leader} manda de momento. Momento, subrayado.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "oamb-18", category: "open_ambient", text: "Arriba, {leader}. Detrás, {second} apretando. Yo, sudando.", expression: "nervous", anonSafe: false, pack: "core", weight: 2 },
  { id: "oamb-19", category: "open_ambient", text: "Ojo a {second}, que viene con ganas.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "oamb-20", category: "open_ambient", text: "{leader} lidera. {second} no ha dicho su última palabra.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "oamb-21", category: "open_ambient", text: "{last} sigue en la pelea. Aquí no se rinde nadie.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "oamb-22", category: "open_ambient", text: "{leader} en cabeza. ¿De dónde sale esa ventaja? De vuestros pulgares.", expression: "smug", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "oamb-23", category: "open_ambient", text: "{second} persigue a {leader}. Esto parece un thriller. Con barras.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "oamb-24", category: "open_ambient", text: "Trazabilidad: {leader} arriba, {second} detrás. Yo, de testigo.", expression: "thinking", anonSafe: false, pack: "fy27" },
  { id: "oamb-25", category: "open_ambient", text: "{leader} va primero. No lo digo yo, lo dice el gráfico. Yo solo leo.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "oamb-26", category: "open_ambient", text: "Si {second} remonta, yo lo vi venir. Si no, también.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "oamb-27", category: "open_ambient", text: "{leader} y {second}, a {gap}. Me muerdo las uñas. No tengo.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "oamb-28", category: "open_ambient", text: "Ahora mismo gana {leader}. Ahora mismo. Recalco lo de ahora mismo.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "oamb-29", category: "open_ambient", text: "{last} viene desde atrás. Adoro las remontadas. Profesionalmente.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "oamb-30", category: "open_ambient", text: "{leader} en cabeza. Esto, en un informe, iría en negrita.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "oamb-31", category: "open_ambient", text: "Si esto fuera un Excel, {leader} ya tendría formato condicional.", expression: "laughing", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "oamb-32", category: "open_ambient", text: "Barras arriba, barras abajo. {leader}, de momento, en lo alto.", expression: "idle", anonSafe: false, pack: "core" },
  // first_vote
  { id: "first-01", category: "first_vote", text: "¡Primer voto! Alguien lo tenía clarísimo.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "first-02", category: "first_vote", text: "Primer voto dentro. Te quiero, persona anónima.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "first-03", category: "first_vote", text: "¡Arrancamos! Ese pulgar no ha dudado ni un segundo.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "first-04", category: "first_vote", text: "Ya hay un dato. Ya puedo opinar sin fundamento.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "first-05", category: "first_vote", text: "¡Hay marcador! Me tiembla todo el escudo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "first-06", category: "first_vote", text: "Alguien ha votado antes de que terminara de saludar. Respeto.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "first-07", category: "first_vote", text: "Muestra de uno. Estadísticamente, irrelevante. Emocionalmente, enorme.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "first-08", category: "first_vote", text: "Primer voto registrado. Sin Copilot y sin dudas. Así se decide.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "first-09", category: "first_vote", text: "Un voto. Técnicamente, ya hay alguien ganando.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "first-10", category: "first_vote", text: "¡{leader} estrena el marcador! Alguien lo tenía muy claro.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "first-11", category: "first_vote", text: "Primer voto para {leader}. Guardad el pantallazo.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "first-12", category: "first_vote", text: "{leader} abre la cuenta. Esto no ha hecho más que empezar.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "first-13", category: "first_vote", text: "¡{leader}, primer voto! Tranquilidad, que es solo uno.", expression: "laughing", anonSafe: false, pack: "core" },
  { id: "first-14", category: "first_vote", text: "{leader} se estrena. Un voto no hace tendencia. Pero hace ilusión.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "first-15", category: "first_vote", text: "Primer voto a {leader}. Trazabilidad: un pulgar muy decidido.", expression: "thinking", anonSafe: false, pack: "fy27" },
  { id: "first-16", category: "first_vote", text: "{leader} abre el marcador. Firmado y sin salvedades.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "first-17", category: "first_vote", text: "Y el primer voto es para… {leader}. Siempre quise decir eso.", expression: "celebrating", anonSafe: false, pack: "core", weight: 2 },
  { id: "first-18", category: "first_vote", text: "Primer voto a {leader}. Muestra pequeña, emoción enorme.", expression: "smug", anonSafe: false, pack: "core" },
  // lead_change
  { id: "lead-01", category: "lead_change", text: "¡Cambio de líder! Yo no he visto nada. Bueno, todo.", expression: "surprised", anonSafe: true, pack: "core", weight: 2 },
  { id: "lead-02", category: "lead_change", text: "La que iba segunda ahora va primera. Así, sin avisar.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "lead-03", category: "lead_change", text: "¡Adelantamiento! Esto parece Fórmula 1, pero con pulgares.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "lead-04", category: "lead_change", text: "¡Vuelco! Mis ojos no dan abasto.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "lead-05", category: "lead_change", text: "Cambio en cabeza. Guardad las predicciones, no valían.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "lead-06", category: "lead_change", text: "La barra de arriba ha cambiado de dueño.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "lead-07", category: "lead_change", text: "Nuevo primero. No digo quién. En serio, no puedo.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "lead-08", category: "lead_change", text: "Cambio arriba. Que alguien actualice el informe.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "lead-09", category: "lead_change", text: "Nuevo líder. Lo tenía previsto en una servilleta. Que he perdido.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "lead-10", category: "lead_change", text: "¡{leader} se pone delante! No lo vi venir. Mentira, sí.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "lead-11", category: "lead_change", text: "Cambio en cabeza: {leader} manda. Por ahora.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "lead-12", category: "lead_change", text: "¡Sorpasso de {leader}! Me siento. No tengo piernas, pero me siento.", expression: "laughing", anonSafe: false, pack: "core" },
  { id: "lead-13", category: "lead_change", text: "{leader} pasa a {second}. Esto se está poniendo interesante.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "lead-14", category: "lead_change", text: "{leader} adelanta a {second}. Yo, en la grada, sin tomar partido.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "lead-15", category: "lead_change", text: "¡{leader} al frente! {second}, esto no ha terminado.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "lead-16", category: "lead_change", text: "{leader} toma la cabeza. ¿De dónde sale ese arreón? De la sala.", expression: "surprised", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "lead-17", category: "lead_change", text: "{leader} manda ahora. Lo digo bajito, por si cambia otra vez.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "lead-18", category: "lead_change", text: "Nuevo líder: {leader}. Actualizo mi predicción. Retroactivamente.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "lead-19", category: "lead_change", text: "{leader} toma el mando. Esto no lo había modelizado nadie.", expression: "surprised", anonSafe: false, pack: "fy27" },
  // tie_top
  { id: "tie-01", category: "tie_top", text: "¡Empate arriba! Yo no he sido.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "tie-02", category: "tie_top", text: "Empate. Ni los papeles de trabajo cuadran tan bien.", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "tie-03", category: "tie_top", text: "Igualdad total. Lo decide tu pulgar. Sí, el tuyo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "tie-04", category: "tie_top", text: "Empate técnico. Técnicamente, estoy de los nervios.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "tie-05", category: "tie_top", text: "Dos barras clavadas. Esto es arte.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "tie-06", category: "tie_top", text: "¡Empate! El siguiente voto vale oro. Bueno, vale uno.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "tie-07", category: "tie_top", text: "Cuadra al céntimo. Qué bonito es un empate.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "tie-08", category: "tie_top", text: "Empate arriba. No me miréis, soy neutral.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "tie-09", category: "tie_top", text: "Si alguien tenía un voto guardado, es su momento.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "tie-10", category: "tie_top", text: "{votes} votos y empate arriba. Así no hay quien comente.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "tie-11", category: "tie_top", text: "{leader} y {second}, empatados. Yo me escondo.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "tie-12", category: "tie_top", text: "¡{leader} y {second}, igualados! Que alguien me sujete.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "tie-13", category: "tie_top", text: "Empate entre {leader} y {second}. Mis ojos no saben adónde mirar.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "tie-14", category: "tie_top", text: "{leader} y {second}, codo con codo. Esto es un cierre de los buenos.", expression: "nervous", anonSafe: false, pack: "fy27" },
  { id: "tie-15", category: "tie_top", text: "{leader} contra {second}. Empate. Doble check. Sigue empate.", expression: "thinking", anonSafe: false, pack: "fy27" },
  { id: "tie-16", category: "tie_top", text: "{leader} y {second}, clavados. Ni con BUSCARV los separo.", expression: "laughing", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "tie-17", category: "tie_top", text: "{leader} y {second}, empatados. El próximo pulgar hace titular.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "tie-18", category: "tie_top", text: "{leader} y {second}, empate. Ni el mejor Excel los concilia.", expression: "laughing", anonSafe: false, pack: "fy27" },
  // milestone
  { id: "mile-01", category: "milestone", text: "¡{milestone} votos! Esto ya es materialidad.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "mile-02", category: "milestone", text: "Llegamos a {milestone}. Aplaudid vosotros, que yo no tengo manos.", expression: "celebrating", anonSafe: true, pack: "core", weight: 2 },
  { id: "mile-03", category: "milestone", text: "{milestone} votos. Oficialmente, muestra representativa.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "mile-04", category: "milestone", text: "¡{milestone}! El servidor y yo seguimos vivos.", expression: "celebrating", anonSafe: true, pack: "core" },
  { id: "mile-05", category: "milestone", text: "Van {milestone}. Me emociono, y eso no sale en el manual.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "mile-06", category: "milestone", text: "Superamos los {milestone}. Lo pongo en el currículum.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "mile-07", category: "milestone", text: "{milestone} votos y ni una incidencia. Toco madera. Bueno, cristal.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "mile-08", category: "milestone", text: "{milestone} votos. Qué bien suena. Otra vez: {milestone}.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "mile-09", category: "milestone", text: "{milestone} votos. Si fueran filas de Excel, ya habría que filtrar.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "mile-10", category: "milestone", text: "{milestone} votos y {leader} delante. Esto va en serio.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "mile-11", category: "milestone", text: "Pasamos de {milestone} con {leader} en cabeza. Qué ritmo.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "mile-12", category: "milestone", text: "¡{milestone} votos! {leader} lidera, {second} aprieta.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "mile-13", category: "milestone", text: "{milestone} votos. {leader} delante, y aquí nadie se relaja.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "mile-14", category: "milestone", text: "Hito: {milestone} votos. Foto para el acta con {leader} arriba.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "mile-15", category: "milestone", text: "{milestone} votos. {leader} arriba. Todo trazable, todo precioso.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "mile-16", category: "milestone", text: "{milestone} y subiendo. {leader} se ha acomodado arriba.", expression: "idle", anonSafe: false, pack: "core" },
  { id: "mile-17", category: "milestone", text: "¡{milestone}! Y {second} a la caza de {leader}.", expression: "surprised", anonSafe: false, pack: "core" },
  // surge
  { id: "surge-01", category: "surge", text: "¡Avalancha de votos! Que alguien abra otra ventanilla.", expression: "surprised", anonSafe: true, pack: "core", weight: 2 },
  { id: "surge-02", category: "surge", text: "Se ha despertado media sala a la vez.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "surge-03", category: "surge", text: "Esto sube como la leche en el cazo.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "surge-04", category: "surge", text: "Entran votos como correos un lunes a las nueve.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "surge-05", category: "surge", text: "¡Ráfaga! El pulgar colectivo ha hablado.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "surge-06", category: "surge", text: "Han entrado un montón de golpe. No me da ni para parpadear.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "surge-07", category: "surge", text: "No sé qué ha pasado, pero que siga pasando.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "surge-08", category: "surge", text: "Más movimiento que un extracto bancario en cierre de año.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "surge-09", category: "surge", text: "Entran votos como sugerencias de Copilot: sin parar.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "surge-10", category: "surge", text: "{votes} votos ya. Esto ha pegado un estirón.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "surge-11", category: "surge", text: "¡Oleada! {leader} lo nota. Y yo también.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "surge-12", category: "surge", text: "Llueven votos. {leader} y {second} no pueden ni parpadear.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "surge-13", category: "surge", text: "Acelerón en la sala. {leader} sigue arriba, pero esto hierve.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "surge-14", category: "surge", text: "Ráfaga de votos. ¿{leader} aguanta? No lo miro. Lo estoy mirando.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "surge-15", category: "surge", text: "¡Toma ya! Entran votos a puñados. {leader} sigue en cabeza.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "surge-16", category: "surge", text: "Subidón en la sala. {second} huele la remontada.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "surge-17", category: "surge", text: "Entran votos a chorro. {second} aprieta, {leader} resiste.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "surge-18", category: "surge", text: "{leader} arriba y pico de votos. ¿De dónde salen? De vosotros.", expression: "smug", anonSafe: false, pack: "fy27", weight: 2 },
  // landslide
  { id: "slide-01", category: "landslide", text: "Esto se está poniendo muy claro. Pero no digo nada.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "slide-02", category: "landslide", text: "Ventaja de las que se ven desde el fondo de la sala.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "slide-03", category: "landslide", text: "Si fuera una auditoría, diría «sin salvedades». Pero aún no he firmado.", expression: "smug", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "slide-04", category: "landslide", text: "Parcial, recalco: parcial.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "slide-05", category: "landslide", text: "Parece decidido. Los datos todavía no han firmado.", expression: "thinking", anonSafe: true, pack: "fy27" },
  { id: "slide-06", category: "landslide", text: "Ojo, que las remontadas existen. Lo he leído.", expression: "thinking", anonSafe: true, pack: "core", weight: 2 },
  { id: "slide-07", category: "landslide", text: "Una barra ha pedido autógrafos.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "slide-08", category: "landslide", text: "Nada es definitivo hasta el cierre. Ni yo.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "slide-09", category: "landslide", text: "La barra de arriba va sola. Las demás, al acecho.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "slide-10", category: "landslide", text: "Ventaja de {gap}. Mucha. Pero no tanta como para dejar de votar.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "slide-11", category: "landslide", text: "{leader} va como un tiro. Los demás, a remontar.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "slide-12", category: "landslide", text: "{leader} se escapa. {second}, aún hay partido.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "slide-13", category: "landslide", text: "{leader} con {gap} de ventaja. Pero nada está cerrado.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "slide-14", category: "landslide", text: "{leader} marca el ritmo. Aunque aquí nadie firma hasta el final.", expression: "thinking", anonSafe: false, pack: "fy27" },
  { id: "slide-15", category: "landslide", text: "{leader} arriba con holgura. Material, diría yo.", expression: "smug", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "slide-16", category: "landslide", text: "{leader} tiene ventaja de sobra. Yo, por si acaso, no me pronuncio.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "slide-17", category: "landslide", text: "{leader} manda. {second} y {last}, esto no ha cerrado.", expression: "surprised", anonSafe: false, pack: "core" },
  { id: "slide-18", category: "landslide", text: "{leader} va lejos. Pero el cierre es el cierre.", expression: "thinking", anonSafe: false, pack: "fy27" },
  // quiet
  { id: "quiet-01", category: "quiet", text: "¿Hola? Los votos se han ido a por café.", expression: "sad", anonSafe: true, pack: "core", weight: 2 },
  { id: "quiet-02", category: "quiet", text: "Silencio. Aprovecho para ensayar mi cara de sorpresa.", expression: "thinking", anonSafe: true, pack: "core", weight: 2 },
  { id: "quiet-03", category: "quiet", text: "Momento tranquilo. Demasiado tranquilo.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "quiet-04", category: "quiet", text: "Indecisos: es ahora. Luego no vale arrepentirse.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "quiet-05", category: "quiet", text: "Nadie vota. Aprovecho para parpadear.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "quiet-06", category: "quiet", text: "¿Alguien tiene el QR del revés?", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "quiet-07", category: "quiet", text: "El QR sigue ahí. Esperándote. Como yo.", expression: "sad", anonSafe: true, pack: "core" },
  { id: "quiet-08", category: "quiet", text: "Votad, que me quedo sin chistes. Mentira, tengo muchos.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "quiet-09", category: "quiet", text: "Este silencio lo voy a meter en los papeles de trabajo.", expression: "thinking", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "quiet-10", category: "quiet", text: "Si le estás preguntando a Copilot a quién votar: esto lo decides tú.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "quiet-11", category: "quiet", text: "Pausa técnica. Bueno, pausa de pulgares.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "quiet-12", category: "quiet", text: "Mi lámpara acaba de ponerse en «necesitamos votos».", expression: "laughing", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "quiet-13", category: "quiet", text: "{leader} sigue arriba, pero la sala se ha quedado muda.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "quiet-14", category: "quiet", text: "Calma chicha. {leader} aguanta. {second} espera su momento.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "quiet-15", category: "quiet", text: "Nadie vota y {leader} ni se inmuta. Yo sí.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "quiet-16", category: "quiet", text: "Pausa en la carrera. {leader} arriba, {second} a tiro.", expression: "thinking", anonSafe: false, pack: "core" },
  { id: "quiet-17", category: "quiet", text: "Silencio. {leader} delante y yo con ganas de que pase algo.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "quiet-18", category: "quiet", text: "Esto está más quieto que un Excel sin fórmulas. {leader}, arriba.", expression: "laughing", anonSafe: false, pack: "fy27" },
  { id: "quiet-19", category: "quiet", text: "¿Nos hemos dormido? {leader} no: sigue arriba.", expression: "idle", anonSafe: false, pack: "core" },
  // last10
  { id: "l10-01", category: "last10", text: "¡Diez segundos! ¡Nervios! ¡NERVIOS!", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "l10-02", category: "last10", text: "Últimos segundos. Ahora o nunca.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-03", category: "last10", text: "¡Que se acaba! Pulgares, ¡ya!", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-04", category: "last10", text: "Estoy sudando líquido de refrigeración.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "l10-05", category: "last10", text: "¡{seconds} segundos! No puedo mirar. Estoy mirando.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-06", category: "last10", text: "Última llamada. Puerta de embarque: tu móvil.", expression: "laughing", anonSafe: true, pack: "core" },
  { id: "l10-07", category: "last10", text: "¡Se cierra! Si dudas, vota con el corazón.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-08", category: "last10", text: "Diez, nueve… me estoy deshaciendo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-09", category: "last10", text: "¡Ahora! Esto no admite ajustes posteriores al cierre.", expression: "nervous", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "l10-10", category: "last10", text: "Tic, tac. Soy un escudo en pánico.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "l10-11", category: "last10", text: "Cierre inminente. Y este no se puede reabrir.", expression: "nervous", anonSafe: true, pack: "fy27" },
  { id: "l10-12", category: "last10", text: "¡{seconds} segundos y {leader} delante! Nadie respire.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-13", category: "last10", text: "{leader} arriba, {second} empujando. ¡Que se acaba!", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-14", category: "last10", text: "Último sprint: {leader} aguanta, {second} aprieta.", expression: "nervous", anonSafe: false, pack: "fy27" },
  { id: "l10-15", category: "last10", text: "¡Se acaba! {leader} lo acaricia. {second} no se rinde.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-16", category: "last10", text: "Quedan {seconds} segundos. {leader} delante. Yo, sin uñas.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-17", category: "last10", text: "¡Últimos segundos! {leader} arriba y yo sin mirar. Mentira.", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-18", category: "last10", text: "{seconds} segundos. {leader} delante, {second} al acecho. ¡Ya!", expression: "nervous", anonSafe: false, pack: "core" },
  { id: "l10-19", category: "last10", text: "Tú decides y firmas. Quedan {seconds} segundos. {leader}, delante.", expression: "nervous", anonSafe: false, pack: "fy27" },
  // close
  { id: "close-01", category: "close", text: "¡Cerrado! Se acabó votar. Ahora toca sufrir.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "close-02", category: "close", text: "Votación cerrada. Nadie toque nada.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "close-03", category: "close", text: "Fin de la votación. Empieza mi momento de pánico.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "close-04", category: "close", text: "Si has votado, gracias. Si no, gracias por venir.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "close-05", category: "close", text: "Que suene algo dramático, por favor.", expression: "thinking", anonSafe: true, pack: "core" },
  { id: "close-06", category: "close", text: "Momento de la verdad.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "close-07", category: "close", text: "Ni las uvas de Nochevieja tienen tanta tensión.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "close-08", category: "close", text: "Agarraos a la silla. Viene curva.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "close-09", category: "close", text: "Me voy a esconder un segundito.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "close-10", category: "close", text: "Cerramos. Que empiece el espectáculo.", expression: "smug", anonSafe: true, pack: "core" },
  { id: "close-11", category: "close", text: "Periodo cerrado. Ahora viene lo que más me gusta: el informe.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "close-12", category: "close", text: "Cerrado. {votes} votos y un nudo en el escudo.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "close-13", category: "close", text: "Se acabó. Copilot no puede ayudaros ahora. Ni a mí.", expression: "nervous", anonSafe: true, pack: "fy27" },
  { id: "close-14", category: "close", text: "Pulgares, descansad. Habéis hecho un gran trabajo.", expression: "idle", anonSafe: true, pack: "core" },
  { id: "close-15", category: "close", text: "Habéis decidido. Ahora solo falta firmar. Con aplausos.", expression: "smug", anonSafe: true, pack: "fy27" },
  { id: "close-16", category: "close", text: "¿Alguien tiene una lámpara de «necesitamos ayuda»? Me la quedo.", expression: "nervous", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "close-17", category: "close", text: "Cerrado. Lo que viene ahora no lo sé ni yo. De verdad.", expression: "nervous", anonSafe: true, pack: "core" },
  // reveal_suspense
  { id: "susp-01", category: "reveal_suspense", text: "No puedo mirar. Avisadme cuando acabe.", expression: "peek", anonSafe: true, pack: "core", weight: 2 },
  { id: "susp-02", category: "reveal_suspense", text: "Me voy detrás del telón. Por seguridad.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "susp-03", category: "reveal_suspense", text: "Tengo los ojos cerrados. Más de lo normal.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "susp-04", category: "reveal_suspense", text: "Redoble de tambores… lo pongo yo: prrrrrr.", expression: "laughing", anonSafe: true, pack: "core", weight: 2 },
  { id: "susp-05", category: "reveal_suspense", text: "Momento incómodo. Me encanta.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "susp-06", category: "reveal_suspense", text: "Ay, ay, ay.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "susp-07", category: "reveal_suspense", text: "Que alguien me dé la mano. No tengo manos.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "susp-08", category: "reveal_suspense", text: "Este suspense lo he diseñado yo, por cierto.", expression: "smug", anonSafe: true, pack: "core", weight: 2 },
  { id: "susp-09", category: "reveal_suspense", text: "Respirad hondo. Yo llevo tres.", expression: "nervous", anonSafe: true, pack: "core" },
  { id: "susp-10", category: "reveal_suspense", text: "No me escondo: audito desde otro ángulo.", expression: "peek", anonSafe: true, pack: "fy27", weight: 2 },
  { id: "susp-11", category: "reveal_suspense", text: "Me quedo aquí abajito, que da menos miedo.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "susp-12", category: "reveal_suspense", text: "Esto no lo resume ni Copilot.", expression: "peek", anonSafe: true, pack: "fy27" },
  { id: "susp-13", category: "reveal_suspense", text: "Quien diga que no está nervioso, que enseñe los papeles de trabajo.", expression: "laughing", anonSafe: true, pack: "fy27" },
  { id: "susp-14", category: "reveal_suspense", text: "Me asomo solo un poquito. Un poquito.", expression: "peek", anonSafe: true, pack: "core" },
  { id: "susp-15", category: "reveal_suspense", text: "Hasta mi cara dura se ha puesto blandita.", expression: "nervous", anonSafe: true, pack: "core", weight: 2 },
  { id: "susp-16", category: "reveal_suspense", text: "Ni idea de lo que viene. Y mira que soy inteligencia artificial.", expression: "peek", anonSafe: true, pack: "core" },
  // reveal_winner
  { id: "win-01", category: "reveal_winner", text: "¡{winner}! Lo sabía desde el principio. Tengo pruebas. No las enseño.", expression: "celebrating", anonSafe: false, pack: "core", weight: 2 },
  { id: "win-02", category: "reveal_winner", text: "¡Enhorabuena, {winner}! Os apoyaba desde el minuto cero. En secreto.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-03", category: "reveal_winner", text: "Campeones: {winner}. Y a los demás, mis respetos. Muchos.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-04", category: "reveal_winner", text: "¡{winner}! Lo dije antes que nadie. Revisad el vídeo.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "win-05", category: "reveal_winner", text: "Aplausos para {winner}. Yo los pongo en espíritu.", expression: "laughing", anonSafe: false, pack: "core" },
  { id: "win-06", category: "reveal_winner", text: "Ha ganado {winner}. Me pido salir en la foto.", expression: "smug", anonSafe: false, pack: "core", weight: 2 },
  { id: "win-07", category: "reveal_winner", text: "¡Gana {winner}! Y los {teamCount} finalistas, enormes. Sin ironía.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-08", category: "reveal_winner", text: "Gana {winner}. Yo me quedo el mérito de haberlo comentado.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "win-09", category: "reveal_winner", text: "¡{winner}! Esa cifra sí sé de dónde sale: de vuestros votos.", expression: "celebrating", anonSafe: false, pack: "fy27", weight: 2 },
  { id: "win-10", category: "reveal_winner", text: "¡{winner}, a por ese máster! Yo me apunto de oyente.", expression: "celebrating", anonSafe: false, pack: "fy27" },
  { id: "win-11", category: "reveal_winner", text: "Gana {winner}. Decidido por la sala, firmado con aplausos.", expression: "celebrating", anonSafe: false, pack: "fy27" },
  { id: "win-12", category: "reveal_winner", text: "¡{winner}! Sin salvedades y con ovación.", expression: "celebrating", anonSafe: false, pack: "fy27" },
  { id: "win-13", category: "reveal_winner", text: "Gana {winner}. Trazabilidad: {votes} votos de gente muy lista.", expression: "smug", anonSafe: false, pack: "fy27" },
  { id: "win-14", category: "reveal_winner", text: "¡Tenemos ganador! {winner}. Me voy a emocionar en directo.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-15", category: "reveal_winner", text: "{winner} se lo lleva. Los demás finalistas, también de aplauso.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-16", category: "reveal_winner", text: "Enhorabuena, {winner}. Yo no podía votar, pero habría acertado.", expression: "smug", anonSafe: false, pack: "core" },
  { id: "win-17", category: "reveal_winner", text: "Enhorabuena a {winner} y a todos los que han subido a ese escenario.", expression: "celebrating", anonSafe: false, pack: "core" },
  { id: "win-18", category: "reveal_winner", text: "Qué final. Qué equipos. Qué escudo tan emocionado.", expression: "celebrating", anonSafe: true, pack: "core" },
  { id: "win-19", category: "reveal_winner", text: "Tenemos ganador. Yo, que lo sabía, finjo sorpresa.", expression: "surprised", anonSafe: true, pack: "core" },
  { id: "win-20", category: "reveal_winner", text: "¡Aplausos para todos los equipos! Y un poquito para mí.", expression: "laughing", anonSafe: true, pack: "core" },
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

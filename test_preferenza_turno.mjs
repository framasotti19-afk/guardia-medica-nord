// Test sulla preferenza di TURNO (diurno ☀️ / notturno 🌙) per i giorni che hanno entrambi i
// turni (weekend/festivi/prefestivi) — CONTEXT.md §3.9.
//
// Dichiarata come dispo[mid]["TURNOPREF:" + dataStr] = "G" | "N", decide SOLO quale dei due turni
// il medico mantiene se li vince ENTRAMBI fisicamente lo stesso giorno. Non cambia mai CHI vince
// un conflitto, non anticipa l'elaborazione, e non lascia mai una sede scoperta per questo motivo:
// se non esiste un'alternativa valida per il turno non preferito, il medico resta su entrambi
// (la copertura vince sempre, esattamente come per la spaziatura temporale — CONTEXT.md §3.7).
import { MEDICI, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_preferenza_turno — preferenza diurno/notturno stesso giorno");
const BERTUZZI = 1, CAMPANER = 2, TRIGODKO = 3, GHIZZO = 5, FOSCHIANI = 8, ZURLO = 13;

// Giorno 8 agosto 2026 = sabato: weekend "semplice" (non festivo/prefestivo), ha sia G che N con
// etichette piane ("DIURNO 8-20" / "NOTTURNO"). Giorno 3 = feriale semplice (nessun G), usato per
// verificare che la preferenza non abbia alcun effetto dove non può esistere un doppio turno.
const G8 = 8, G3 = GIORNI_FERIALI_SEMPLICI[0];
const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const TURNOPREF = (g) => "TURNOPREF:" + dk(ANNO_TEST, MESE_TEST, g);

function schemaCompleto(dispo, extraOre = {}) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
}
function turniGiorno(schema, giorno) {
  const g = schema.find((x) => x.giorno === giorno);
  return { tG: g.turni.find((t) => t.id === "G"), tN: g.turni.find((t) => t.id === "N") };
}

// ---------------------------------------------------------------------------
// Nessun effetto fuori dai giorni con entrambi i turni, o senza preferenza dichiarata
// ---------------------------------------------------------------------------
suite.test("giorno feriale semplice (nessun G): la preferenza dichiarata non ha alcun effetto, nessun crash", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][TURNOPREF(G3)] = "N"; // dichiarata su un giorno che non ha comunque il diurno
  const { schema } = schemaCompleto(d);
  const { tN } = turniGiorno(schema, G3);
  suite.eq(tN.slots[0], BERTUZZI, "comportamento invariato: nessun G quel giorno, la preferenza è un no-op");
});

suite.test("vince entrambi i turni senza aver dichiarato alcuna preferenza: li mantiene entrambi (comportamento invariato)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], BERTUZZI, "senza preferenza dichiarata, nessun intervento: mantiene entrambi come sempre");
});

suite.test("vince solo UNO dei due turni: la preferenza dichiarata non ha alcun effetto", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  // BERTUZZI non ha alcuna disponibilità per il notturno: lo vince solo un altro medico.
  d[CAMPANER][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], CAMPANER, "BERTUZZI non vince entrambi: la preferenza non si applica, nessuno scambio");
});

// ---------------------------------------------------------------------------
// Preferenza dichiarata + alternativa disponibile: lo scambio avviene
// ---------------------------------------------------------------------------
suite.test("preferisce il diurno (☀️): con un'alternativa valida, il notturno passa a lei", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]); // unico candidato sul diurno
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]); // BERTUZZI (INDET, grad0) batte CAMPANER (INDET, grad1) sul notturno
  d[CAMPANER][N(G8)] = turnoDisp(["Maniago"]); // alternativa valida, presente solo sul notturno
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "mantiene il diurno preferito");
  suite.eq(tN.slots[0], CAMPANER, "il notturno non preferito passa all'alternativa disponibile");
});

suite.test("preferisce il notturno (🌙): con un'alternativa valida, il diurno passa a lei", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CAMPANER][G(G8)] = turnoDisp(["Maniago"]); // alternativa valida, presente solo sul diurno
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]); // unico candidato sul notturno
  d[BERTUZZI][TURNOPREF(G8)] = "N";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], CAMPANER, "il diurno non preferito passa all'alternativa disponibile");
  suite.eq(tN.slots[0], BERTUZZI, "mantiene il notturno preferito");
});

// ---------------------------------------------------------------------------
// Nessuna alternativa: la copertura vince sempre, resta su entrambi
// ---------------------------------------------------------------------------
suite.test("nessuna alternativa disponibile per il turno non preferito: resta assegnato a entrambi (la copertura vince sempre)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][TURNOPREF(G8)] = "G"; // preferisce il diurno, ma nessun altro medico è disponibile sul notturno
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], BERTUZZI, "nessuna alternativa: mantiene comunque entrambi, la sede non resta mai scoperta per questo");
});

suite.test("un'alternativa presente ma su un'ALTRA sede non conta: resta assegnato a entrambi", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G8)] = turnoDisp(["Spilimbergo"]); // presente sul notturno, ma su un'altra sede
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], BERTUZZI, "CAMPANER non ha dichiarato Maniago: non è un'alternativa valida per quella sede");
  suite.eq(tN.slots[1], CAMPANER, "CAMPANER ottiene comunque la sua sede, Spilimbergo");
});

// ---------------------------------------------------------------------------
// La scelta dell'alternativo segue SEMPRE la stessa gerarchia ufficiale
// ---------------------------------------------------------------------------
suite.test("tra più alternative possibili, subentra sempre quella con priorità migliore in gerarchia", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[GHIZZO][N(G8)] = turnoDisp(["Maniago"]);   // DET36 grad91
  d[TRIGODKO][N(G8)] = turnoDisp(["Maniago"]); // DET36 grad4, priorità migliore di GHIZZO
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], TRIGODKO, "tra le alternative disponibili, subentra quella con priorità migliore (TRIGODKO, non GHIZZO)");
});

suite.test("l'alternativo scelto è sempre quello con priorità migliore anche contro un senza incarico di grad ottimo", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G8)] = turnoDisp(["Maniago"]);    // SENZA incarico, grad2 (ottimo) ma categoria inferiore
  d[FOSCHIANI][N(G8)] = turnoDisp(["Maniago"]); // DET24, categoria superiore a SENZA
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tN } = turniGiorno(schema, G8);
  suite.eq(tN.slots[0], FOSCHIANI, "la categoria decide prima della graduatoria, anche per l'alternativo di uno scambio di preferenza turno");
});

// ---------------------------------------------------------------------------
// Non anticipa l'elaborazione né cambia CHI vince: solo quale turno il vincitore mantiene
// ---------------------------------------------------------------------------
suite.test("senza preferenza dichiarata, resta in vigore la spaziatura temporale ordinaria (comportamento preesistente, invariato)", () => {
  // NON è il nuovo meccanismo di preferenza turno: è la regola di spaziatura temporale
  // preesistente (§3.7), che di norma cede il turno elaborato per SECONDO (qui il notturno,
  // dato che il diurno viene sempre elaborato prima) a un'alternativa se ne esiste una — a
  // prescindere da qualsiasi preferenza. La preferenza di turno serve esattamente a poter
  // scegliere diversamente da questo comportamento di default (vedi i test sullo scambio sopra).
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G8)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], TRIGODKO, "senza preferenza dichiarata, la spaziatura ordinaria cede comunque il notturno all'alternativa");
});

// ---------------------------------------------------------------------------
// Caso reale che ha motivato la funzionalità: un ★ preferito sul NOTTURNO fa sì che venga
// elaborato per PRIMO (fase conPref, CONTEXT.md §3.5), invertendo quale dei due turni la
// spaziatura temporale considera "a rischio" — senza una preferenza di turno esplicita, il
// medico finirebbe per mantenere il notturno e perdere il diurno che invece preferiva.
// ---------------------------------------------------------------------------
suite.test("★ preferito sul notturno + nessuna preferenza di turno: la spaziatura cede il DIURNO (il notturno è stato elaborato per primo)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // ★ sul notturno: elaborato per primo
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][G(G8)] = turnoDisp(["Maniago"]); // alternativa valida solo sul diurno
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tN.slots[0], BERTUZZI, "il notturno, elaborato per primo grazie al ★, resta suo");
  suite.eq(tG.slots[0], TRIGODKO, "senza una preferenza di turno esplicita, il diurno (elaborato per secondo) va all'alternativa — anche se BERTUZZI lo preferiva");
});

suite.test("★ preferito sul notturno + preferenza di turno ☀️ diurno: la preferenza esplicita prevale sull'ordine conPref/resto", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // ★ sul notturno: elaborato per primo
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][G(G8)] = turnoDisp(["Maniago"]); // presente solo sul diurno: non è un'alternativa per il notturno
  d[BERTUZZI][TURNOPREF(G8)] = "G"; // dichiara esplicitamente di preferire il diurno
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "la preferenza esplicita del diurno prevale: la spaziatura non glielo toglie più");
  suite.eq(tN.slots[0], BERTUZZI, "il notturno non preferito non ha alternative valide (TRIGODKO ha dichiarato solo il diurno): nessuna alternativa, la copertura vince e resta comunque a BERTUZZI");
});

suite.test("★ preferito sul notturno + preferenza di turno ☀️ diurno, con alternativa disponibile anche sul notturno: lo scambio completa il quadro", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G8)] = turnoDisp(["Maniago"]); // alternativa valida sul notturno, non preferito
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "mantiene il diurno preferito, protetto dalla spaziatura grazie alla preferenza esplicita");
  suite.eq(tN.slots[0], CAMPANER, "il notturno non preferito passa all'alternativa, esattamente come nel caso senza ★");
});

suite.finish();

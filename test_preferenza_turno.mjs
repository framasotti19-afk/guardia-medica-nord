// Test sulla preferenza di TURNO (diurno ☀️ / notturno 🌙) per i giorni che hanno entrambi i
// turni (weekend/festivi/prefestivi) — CONTEXT.md §3.9.
//
// Dichiarata come dispo[mid]["TURNOPREF:" + dataStr] = "G" | "N", decide SOLO quale dei due turni
// il medico mantiene se li vince ENTRAMBI fisicamente lo stesso giorno. Non cambia mai CHI vince
// un conflitto, non anticipa l'elaborazione, e non lascia mai una sede scoperta per questo motivo:
// se non esiste un'alternativa valida per il turno non preferito, il medico resta su entrambi (la
// copertura vince sempre). Senza una preferenza dichiarata, nessuna cessione avviene MAI: il
// medico mantiene entrambi i turni (la regola di spaziatura temporale §3.7, che un tempo cedeva
// per default il turno elaborato per secondo, è stata rimossa — CONTEXT.md §10).
//
// BERTUZZI (INDET, titolare Spilimbergo) è sempre il protagonista su Maniago (dove NON è
// titolare): le alternative sono scelte titolari di Spilimbergo (non di Maniago), per isolare i
// confronti di categoria/grad dalla titolarità universale (§3.1a). CERVESATO e PRESSACCO sono
// SENZA incarico di default nella lista attuale: vengono "resuscitati" nel loro ruolo storico
// (DET38/DET24, entrambi titolari di Spilimbergo, stessi grad) tramite comeStorico, per preservare
// esattamente i confronti originali.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI, comeStorico } from './test_utils.mjs';

const suite = makeSuite("test_preferenza_turno — preferenza diurno/notturno stesso giorno");
const BERTUZZI = 9; // INDET, titolare Spilimbergo
const FOSCHIANI = 6; // DET38, titolare Spilimbergo, grad3
const CERVESATO = 11; // SENZA di default, resuscitato come DET38 titolare Spilimbergo, grad63
const PRESSACCO = 10; // SENZA di default, resuscitato come DET24 titolare Spilimbergo, grad57
const PITAU = 3; // DET24 di default, usato come override "senza incarico" (grad14)

// Giorno 8 agosto 2026 = sabato: weekend "semplice" (non festivo/prefestivo), ha sia G che N con
// etichette piane ("DIURNO 8-20" / "NOTTURNO"). Giorno 3 = feriale semplice (nessun G), usato per
// verificare che la preferenza non abbia alcun effetto dove non può esistere un doppio turno.
const G8 = 8, G3 = GIORNI_FERIALI_SEMPLICI[0];
const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const TURNOPREF = (g) => "TURNOPREF:" + dk(ANNO_TEST, MESE_TEST, g);

const BASE = comeStorico(MEDICI_DEFAULT, CERVESATO, PRESSACCO);
function resetMedici() { setMediciGlobal(BASE); }
resetMedici();

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
  d[CERVESATO][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], CERVESATO, "BERTUZZI non vince entrambi: la preferenza non si applica, nessuno scambio");
});

// ---------------------------------------------------------------------------
// Preferenza dichiarata + alternativa disponibile: lo scambio avviene
// ---------------------------------------------------------------------------
suite.test("preferisce il diurno (☀️): con un'alternativa valida, il notturno passa a lei", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]); // unico candidato sul diurno
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]); // BERTUZZI (INDET) batte CERVESATO (DET38) sul notturno
  d[CERVESATO][N(G8)] = turnoDisp(["Maniago"]); // alternativa valida, presente solo sul notturno
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "mantiene il diurno preferito");
  suite.eq(tN.slots[0], CERVESATO, "il notturno non preferito passa all'alternativa disponibile");
});

suite.test("preferisce il notturno (🌙): con un'alternativa valida, il diurno passa a lei", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][G(G8)] = turnoDisp(["Maniago"]); // alternativa valida, presente solo sul diurno
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]); // unico candidato sul notturno
  d[BERTUZZI][TURNOPREF(G8)] = "N";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], CERVESATO, "il diurno non preferito passa all'alternativa disponibile");
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
  d[CERVESATO][N(G8)] = turnoDisp(["Spilimbergo"]); // presente sul notturno, ma su un'altra sede
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], BERTUZZI, "CERVESATO non ha dichiarato Maniago: non è un'alternativa valida per quella sede");
  suite.eq(tN.slots[1], CERVESATO, "CERVESATO ottiene comunque la sua sede, Spilimbergo (titolare lì)");
});

// ---------------------------------------------------------------------------
// La scelta dell'alternativo segue SEMPRE la stessa gerarchia ufficiale
// ---------------------------------------------------------------------------
suite.test("tra più alternative possibili, subentra sempre quella con priorità migliore in gerarchia", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G8)] = turnoDisp(["Maniago"]); // DET38 grad63
  d[FOSCHIANI][N(G8)] = turnoDisp(["Maniago"]); // DET38 grad3, priorità migliore di CERVESATO
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], FOSCHIANI, "tra le alternative disponibili, subentra quella con priorità migliore (FOSCHIANI, non CERVESATO)");
});

suite.test("l'alternativo scelto è sempre quello con priorità migliore anche contro un senza incarico di grad ottimo", () => {
  const lista = BASE.map((m) => (m.id === PITAU ? { ...m, cat: "SENZA", sedeContratto: null } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[PITAU][N(G8)] = turnoDisp(["Maniago"]);     // ora SENZA incarico, grad14 (ottimo) ma categoria inferiore
  d[PRESSACCO][N(G8)] = turnoDisp(["Maniago"]); // DET24, categoria superiore a SENZA
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const { tN } = turniGiorno(schema, G8);
  suite.eq(tN.slots[0], PRESSACCO, "la categoria decide prima della graduatoria, anche per l'alternativo di uno scambio di preferenza turno");
  resetMedici();
});

// ---------------------------------------------------------------------------
// Non anticipa l'elaborazione né cambia CHI vince: solo quale turno il vincitore mantiene.
// Senza una preferenza dichiarata, nessun meccanismo cede più nulla: chi vince un turno per
// gerarchia se lo tiene, anche se ha vinto anche l'altro turno dello stesso giorno (la regola di
// spaziatura temporale §3.7, che faceva questo per default, è stata rimossa: vedi CONTEXT.md §10).
// ---------------------------------------------------------------------------
suite.test("senza preferenza dichiarata, il vincitore mantiene ENTRAMBI i turni: nessuna cessione automatica (§3.7 rimossa)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G8)] = turnoDisp(["Maniago"]); // alternativa disponibile, ma senza preferenza dichiarata non entra in gioco
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI);
  suite.eq(tN.slots[0], BERTUZZI, "senza preferenza dichiarata, BERTUZZI mantiene anche il notturno: nessuna rotazione automatica verso CERVESATO");
});

suite.test("senza preferenza di turno dichiarata: mantiene ENTRAMBI (nessuna cessione automatica)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][G(G8)] = turnoDisp(["Maniago"]); // alternativa disponibile, ma senza preferenza dichiarata non entra in gioco
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tN.slots[0], BERTUZZI, "il notturno resta suo");
  suite.eq(tG.slots[0], BERTUZZI, "senza una preferenza di turno esplicita, mantiene anche il diurno: nessuna cessione automatica, indipendentemente da quale dei due è stato elaborato per primo");
});

suite.test("preferenza di turno ☀️ diurno dichiarata: la preferenza esplicita prevale", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][G(G8)] = turnoDisp(["Maniago"]); // presente solo sul diurno: non è un'alternativa per il notturno
  d[BERTUZZI][TURNOPREF(G8)] = "G"; // dichiara esplicitamente di preferire il diurno
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "la preferenza esplicita del diurno prevale: la spaziatura non glielo toglie più");
  suite.eq(tN.slots[0], BERTUZZI, "il notturno non preferito non ha alternative valide (CERVESATO ha dichiarato solo il diurno): nessuna alternativa, la copertura vince e resta comunque a BERTUZZI");
});

suite.test("preferenza di turno ☀️ diurno con alternativa disponibile sul notturno: lo scambio completa il quadro", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G8)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][G(G8)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G8)] = turnoDisp(["Maniago"]); // alternativa valida sul notturno, non preferito
  d[BERTUZZI][TURNOPREF(G8)] = "G";
  const { schema } = schemaCompleto(d);
  const { tG, tN } = turniGiorno(schema, G8);
  suite.eq(tG.slots[0], BERTUZZI, "mantiene il diurno preferito, protetto dalla spaziatura grazie alla preferenza esplicita");
  suite.eq(tN.slots[0], CERVESATO, "il notturno non preferito passa all'alternativa, esattamente come atteso");
});

suite.finish();

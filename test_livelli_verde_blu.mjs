// Test sui livelli verde (1-5, sede fisica) e blu (1-4, copertura a distanza) — CONTEXT.md §3.3.
// Verde: ordine di prova per la ricollocazione fisica. Blu: ordine di prova per la copertura
// a distanza, con conflitto risolto dalla stessa gerarchia usata per il fisico:
// titolarità sede → categoria → debito → graduatoria.
// A parità di livello (sia verde che blu) l'ordine di prova segue sempre SEDI5 (Maniago →
// Spilimbergo → Meduno → Claut → Anduins), MAI l'ordine in cui il medico ha dichiarato le sedi:
// la parità rende due sedi "indifferenti" per il medico, non davvero equivalenti tra loro.
// Nei test di conflitto puro (categoria/grad, non titolarità) le coppie sono scelte entrambe
// titolari della STESSA sede (o il conflitto è su Meduno/Claut, mai sedi di titolarità) per isolare
// la regola dalla titolarità universale (§3.1a).
import { MEDICI, dk, elaboraSchema, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_livelli_verde_blu — livelli verde 1-5 e blu 1-4");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const ZURLO = 1, IENGO = 13, BERTUZZI = 14; // DET38 tit.Maniago, DET38 tit.Maniago, INDET tit.Spilimbergo
const MARTINETTI = 4, PITAU = 5, DE_CANDIDO = 11; // DET24: tit.Spilimbergo, tit.Maniago, tit.Spilimbergo

function unicoTurno(dispo, extraOre = {}) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}

// ---------------------------------------------------------------------------
// ordinaPerLivello — helper generico condiviso da verde e blu
// ---------------------------------------------------------------------------
suite.test("ordinaPerLivello ordina le sedi per livello crescente", () => {
  const out = ordinaPerLivello(["Meduno", "Spilimbergo", "Claut"], { Meduno: 2, Spilimbergo: 1, Claut: 2 }, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Spilimbergo,Meduno,Claut", "livello 1 prima, poi livello 2 nell'ordine fisso SEDI5 (Meduno prima di Claut)");
});
suite.test("livello mancante (non dichiarato) vale di default 1", () => {
  const out = ordinaPerLivello(["Meduno"], {}, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Meduno");
});
suite.test("più sedi allo stesso livello: la parità NON le rende equivalenti, vince l'ordine fisso SEDI5", () => {
  const out = ordinaPerLivello(["Claut", "Anduins", "Meduno"], { Claut: 1, Anduins: 1, Meduno: 1 }, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Meduno,Claut,Anduins", "l'ordine di dichiarazione (Claut, Anduins, Meduno) viene ignorato: decide sempre Maniago→Spilimbergo→Meduno→Claut→Anduins");
});
suite.test("parità tra una CDC e una sede secondaria: la CDC vince sempre, come se fosse un livello migliore", () => {
  const out = ordinaPerLivello(["Meduno", "Maniago"], { Meduno: 1, Maniago: 1 }, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Maniago,Meduno", "Maniago dichiarato livello 1 e Meduno livello 1: si prova comunque prima Maniago, esattamente come Maniago:1 + Meduno:2");
});
suite.test("il cap di livello massimo è rispettato (blu si ferma a 4, non considera un ipotetico 5)", () => {
  const out = ordinaPerLivello(["Meduno", "Claut"], { Meduno: 4, Claut: 5 }, MAX_LIV_BLU);
  suite.eq(out.join(","), "Meduno", "un livello 5 su un elenco blu (max 4) non viene mai raggiunto dal ciclo");
});

// ---------------------------------------------------------------------------
// VERDE — ordine di prova per l'assegnazione fisica
// ---------------------------------------------------------------------------
suite.test("il motore prova le sedi verdi nell'ordine di livello dichiarato", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 2, Maniago: 1 } }); // preferisce Maniago
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "con un solo candidato ottiene la sua prima scelta (Maniago, livello 1)");
});

suite.test("i livelli verdi non influenzano MAI chi vince un conflitto, solo quale sede riceve", () => {
  const d = dispoBase(MEDICI);
  // MARTINETTI (grad5) e DE CANDIDO (grad83), entrambi DET24 titolari di Spilimbergo: contesa su
  // Maniago (nessuno dei due titolare lì) — puro grad, livelli verde opposti a quanto ci si
  // aspetterebbe non contano.
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 5 } }); // grad5, livello peggiore possibile
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } }); // grad83, livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MARTINETTI, "MARTINETTI vince per grad migliore nonostante il livello verde peggiore");
});

// ---------------------------------------------------------------------------
// BLU — ordine di prova, conflitto, retry dopo scalzamento
// ---------------------------------------------------------------------------
suite.test("il motore prova i blu del medico nell'ordine dei suoi livelli dichiarati", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"], ["Claut", "Meduno"], { bluLiv: { Claut: 2, Meduno: 1 } }); // preferisce Meduno
  const t = unicoTurno(d);
  suite.eq(t.slots[2], BERTUZZI, "copre Meduno, il suo blu di livello migliore, non Claut");
  suite.assert(t.slots[3] === null, "Claut resta scoperta: un medico copre al massimo 1 sede a distanza");
});

suite.test("conflitto sullo stesso blu su Maniago: vince categoria/grad tra due non titolari, non il livello blu dichiarato", () => {
  const d = dispoBase(MEDICI);
  // MARTINETTI e DE CANDIDO, entrambi DET24 titolari di Spilimbergo (non Maniago): blu-conflitto
  // su Maniago, nessuno dei due titolare lì. 3° candidato (PITAU) presente con verde altrove, solo
  // per portare n a 3 (target [MA,SP,ME]) senza intervenire sul conflitto.
  d[MARTINETTI][N(G1)] = turnoDisp(["Spilimbergo"], ["Maniago"], { bluLiv: { Maniago: 4 } }); // grad5, livello blu peggiore (4 = max valido)
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Meduno"], ["Maniago"], { bluLiv: { Maniago: 1 } }); // grad83, livello blu migliore
  d[PITAU][N(G1)] = turnoDisp(["Claut"]); // 3° candidato presente, verde fuori dal target [MA,SP,ME]
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MARTINETTI, "MARTINETTI (grad5) vince su DE CANDIDO (grad83) nonostante il livello blu peggiore");
});

suite.test("se il vincitore del blu preferito viene scalzato, riprova con il suo blu successivo", () => {
  const d = dispoBase(MEDICI);
  // Conflitto su Meduno (mai sede di titolarità): ZURLO e IENGO, entrambi DET38, decide il grad.
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad2
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Claut"], { bluLiv: { Meduno: 1, Claut: 2 } }); // grad107
  const t = unicoTurno(d);
  suite.eq(t.slots[2], ZURLO, "ZURLO (grad migliore) vince Meduno");
  suite.eq(t.slots[3], IENGO, "IENGO, perso Meduno, ottiene comunque il suo blu successivo (Claut)");
});

suite.test("i livelli blu non influenzano MAI chi vince un conflitto, solo quale sede riceve", () => {
  const d = dispoBase(MEDICI);
  // Conflitto su Meduno (mai sede di titolarità): MARTINETTI e DE CANDIDO, stessa categoria DET24.
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 4 } }); // grad5, livello blu peggiore
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad83, livello blu migliore
  const t = unicoTurno(d);
  suite.eq(t.slots[2], MARTINETTI, "MARTINETTI vince per grad migliore nonostante il livello blu peggiore");
});

suite.finish();

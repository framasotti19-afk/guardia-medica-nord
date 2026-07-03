// Test sui livelli verde (1-5, sede fisica) e blu (1-4, copertura a distanza) — CONTEXT.md §3.3.
// Verde: ordine di prova per la ricollocazione fisica. Blu: ordine di prova per la copertura
// a distanza, con conflitto risolto dalla stessa gerarchia usata per il fisico:
// titolarità sede → categoria → debito → graduatoria.
import { MEDICI, dk, elaboraSchema, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_livelli_verde_blu — livelli verde 1-5 e blu 1-4");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const BERTUZZI = 1, WANG = 12;

function unicoTurno(dispo, extraOre = {}) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}

// ---------------------------------------------------------------------------
// ordinaPerLivello — helper generico condiviso da verde e blu
// ---------------------------------------------------------------------------
suite.test("ordinaPerLivello ordina le sedi per livello crescente", () => {
  const out = ordinaPerLivello(["Meduno", "Spilimbergo", "Claut"], { Meduno: 2, Spilimbergo: 1, Claut: 2 }, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Spilimbergo,Meduno,Claut", "livello 1 prima, poi livello 2 nell'ordine di inserimento originale");
});
suite.test("livello mancante (non dichiarato) vale di default 1", () => {
  const out = ordinaPerLivello(["Meduno"], {}, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Meduno");
});
suite.test("più sedi allo stesso livello mantengono l'ordine di inserimento nell'array", () => {
  const out = ordinaPerLivello(["Claut", "Anduins", "Meduno"], { Claut: 1, Anduins: 1, Meduno: 1 }, MAX_LIV_VERDE);
  suite.eq(out.join(","), "Claut,Anduins,Meduno");
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
  const FOSCHIANI = 8;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 5 } }); // grad3, livello peggiore possibile
  d[WANG][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } }); // grad124, livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI vince per grad migliore nonostante il livello verde peggiore");
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

suite.test("conflitto sullo stesso blu: vince categoria/grad, non il livello blu dichiarato", () => {
  const FOSCHIANI = 8, TRIGODKO = 3;
  const d = dispoBase(MEDICI);
  // n=3: TRIGODKO fisico a Maniago (occupa il posto "normale"), FOSCHIANI a Spilimbergo, WANG a
  // Meduno — target [MA,SP,ME] tutto coperto fisicamente. Rifacciamo con Maniago scoperto invece:
  // FOSCHIANI a Spilimbergo e WANG a Meduno, un 3° medico (TRIGODKO) con verde altrove per far
  // salire n a 3 senza coprire Maniago.
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], ["Maniago"], { bluLiv: { Maniago: 4 } }); // DET24 grad3, livello blu peggiore (4 = max valido)
  d[WANG][N(G1)] = turnoDisp(["Meduno"], ["Maniago"], { bluLiv: { Maniago: 1 } }); // DET24 grad124, livello blu migliore
  d[TRIGODKO][N(G1)] = turnoDisp(["Claut"]); // 3° candidato presente, verde fuori dal target [MA,SP,ME]
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI (grad3) vince su WANG (grad124) nonostante il livello blu peggiore");
});

suite.test("se il vincitore del blu preferito viene scalzato, riprova con il suo blu successivo", () => {
  const TRIGODKO = 3, GHIZZO = 5;
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad4
  d[GHIZZO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Claut"], { bluLiv: { Meduno: 1, Claut: 2 } }); // grad91
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "TRIGODKO (grad migliore) vince Meduno");
  suite.eq(t.slots[3], GHIZZO, "GHIZZO, perso Meduno, ottiene comunque il suo blu successivo (Claut)");
});

suite.test("i livelli blu non influenzano MAI chi vince un conflitto, solo quale sede riceve", () => {
  const FOSCHIANI = 8;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 4 } }); // grad3, livello blu peggiore
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad124, livello blu migliore
  const t = unicoTurno(d);
  suite.eq(t.slots[2], FOSCHIANI, "FOSCHIANI vince per grad migliore nonostante il livello blu peggiore");
});

suite.finish();

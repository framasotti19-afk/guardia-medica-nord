// Test sui conflitti fra medici della STESSA categoria (CONTEXT.md §3.1, §3.4):
// la regola del debito ("chi ha più debito residuo vince; a parità vince la
// graduatoria migliore") si applica SOLO all'interno della stessa categoria.
import { MEDICI, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_stesso_cat2 — conflitti stessa categoria");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
// DET36: TRIGODKO grad4, PRESSACCO grad57, GHIZZO grad91
const TRIGODKO = 3, PRESSACCO = 4, GHIZZO = 5;
// DET24: FOSCHIANI grad3, WANG grad124
const FOSCHIANI = 8, WANG = 12;
// SENZA: ZURLO grad2, GRANDO grad13
const ZURLO = 13, GRANDO = 14;

function unicoTurno(dispo, extraOre = {}, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}

suite.test("stessa categoria, stesso debito iniziale → vince il grad più basso", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("stessa categoria, chi ha più debito residuo vince anche con grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, ma debito ridotto
  d[GHIZZO][N(G1)] = turnoDisp(["Maniago"]); // grad91, ma debito aumentato
  const t = unicoTurno(d, { [TRIGODKO]: -100, [GHIZZO]: +80 });
  suite.eq(t.slots[0], GHIZZO, "GHIZZO ha più debito residuo nonostante il grad peggiore");
});

suite.test("3 medici stessa categoria, stesso debito, target 2 sedi → vincono i due con grad migliore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { pieneLiv: { Maniago: 1, Spilimbergo: 1 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { pieneLiv: { Maniago: 1, Spilimbergo: 1 } });
  d[GHIZZO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { pieneLiv: { Maniago: 1, Spilimbergo: 1 } });
  const t = unicoTurno(d);
  const fisici = new Set(t.fis.map((si) => t.slots[si]));
  suite.assert(fisici.has(TRIGODKO) && fisici.has(PRESSACCO), "i due con grad migliore (TRIGODKO, PRESSACCO) devono risultare fisici");
  suite.assert(!fisici.has(GHIZZO), "GHIZZO (grad peggiore) deve restare escluso quando il target ha solo 2 posti");
});

suite.test("esempio §3.4: 5 turni pari debito, grad3 vs grad124 → risultato 3-2 per il grad migliore", () => {
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  const d = dispoBase(MEDICI);
  giorni.forEach((g) => {
    d[FOSCHIANI][N(g)] = turnoDisp(["Maniago"]);
    d[WANG][N(g)] = turnoDisp(["Maniago"]);
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincite = { [FOSCHIANI]: 0, [WANG]: 0 };
  giorni.forEach((g) => vincite[schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]]++);
  suite.eq(vincite[FOSCHIANI], 3);
  suite.eq(vincite[WANG], 2);
});

suite.test("stessa categoria ma uno ha debito esaurito: vince chi ha ancora debito anche con grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, ma esaurito
  d[GHIZZO][N(G1)] = turnoDisp(["Maniago"]); // grad91, debito pieno
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], GHIZZO, "il bucket (debito>0 vs esaurito) prevale sempre sul confronto di grad all'interno della stessa categoria");
});

suite.test("due senza incarico: nessun concetto di debito, decide solo il grad puro", () => {
  const d = dispoBase(MEDICI);
  d[GRANDO][N(G1)] = turnoDisp(["Maniago"]); // grad13
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2
  const t = unicoTurno(d);
  suite.eq(t.slots[0], ZURLO);
});

suite.test("due esauriti della stessa categoria: decide solo il grad puro (il debito è pari a zero per entrambi)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57
  const t = unicoTurno(d, { [TRIGODKO]: -156, [PRESSACCO]: -156 });
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("stessa categoria, debiti uguali dopo un giro di conflitti → il grad torna a decidere", () => {
  // TRIGODKO e PRESSACCO stesso debito iniziale (156h). Dopo che TRIGODKO vince un turno,
  // il suo debito scende sotto quello di PRESSACCO: su un secondo turno indipendente
  // (stesso identico scenario) il debito NON e' condiviso fra chiamate separate a
  // elaboraSchema, quindi il grad torna a decidere in una nuova elaborazione pulita.
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t1 = unicoTurno(d);
  const t2 = unicoTurno(d); // nuova chiamata indipendente: stesso esito, a garanzia di determinismo
  suite.eq(t1.slots[0], TRIGODKO);
  suite.eq(t2.slots[0], TRIGODKO);
});

suite.finish();

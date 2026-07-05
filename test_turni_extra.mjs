// Test sui "turni extra volontari" (CONTEXT.md §3.10): un budget SEPARATO dal debito ordinario
// (monte ore + ore extra di recupero), dichiarato in numero di turni (12h ciascuno). Si consuma
// SOLO dopo che il debito ordinario è esaurito, e in quel momento il medico compete con la STESSA
// priorità di un senza incarico (solo graduatoria, MAI priorità di categoria). Una volta esaurito
// anche il budget extra, il medico torna al comportamento attuale di "debito esaurito" (perde
// sempre contro un senza incarico vero, può solo coprire turni rimasti completamente scoperti).
import { MEDICI, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_turni_extra — turni extra volontari oltre il monte ore");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// INDET: BERTUZZI grad0 (96h monte ore), CAMPANER grad1
const BERTUZZI = 1, CAMPANER = 2;
// DET36: TRIGODKO grad4 (156h monte ore)
const TRIGODKO = 3;
// SENZA: ZURLO grad2, GRANDO grad13
const ZURLO = 13, GRANDO = 14;
// G1/G2/G3 scelti NON consecutivi (scelta ereditata da quando esisteva ancora la regola di
// spaziatura temporale §3.7, oggi rimossa — CONTEXT.md §10 — innocua qui, mantenuta per leggibilità).
const [G1, , G2, , G3] = GIORNI_FERIALI_SEMPLICI;

function unicoTurno(dispo, extraOre, turniExtra, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {}, turniExtra);
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}

suite.test("regressione: senza turni extra dichiarati, un contrattualizzato esaurito perde comunque contro un senza incarico, anche con grad migliore", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // grad0, ma monte ore azzerato
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2, senza incarico
  const t = unicoTurno(d, { [BERTUZZI]: -96 }, {}); // debito BERTUZZI: 96-96=0
  suite.eq(t.slots[0], ZURLO, "BERTUZZI esaurito senza turni extra resta nel bucket più debole, perde nonostante il grad migliore");
});

suite.test("con turni extra dichiarati, il contrattualizzato esaurito compete come senza incarico (vince per grad migliore)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // grad0
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2
  const t = unicoTurno(d, { [BERTUZZI]: -96 }, { [BERTUZZI]: 1 }); // 1 turno extra = 12h di budget
  suite.eq(t.slots[0], BERTUZZI, "con budget extra disponibile, BERTUZZI torna a competere (bucket senza incarico) e vince per grad migliore");
});

suite.test("a parità di bucket, un turno-extra con grad peggiore di un vero senza incarico perde comunque: nessun vantaggio speciale", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, ma qui esaurito + turni extra
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2, senza incarico vero — grad migliore
  const t = unicoTurno(d, { [TRIGODKO]: -156 }, { [TRIGODKO]: 1 });
  suite.eq(t.slots[0], ZURLO, "stesso bucket (senza incarico): decide il grad puro, ZURLO (grad2) batte TRIGODKO (grad4) anche se TRIGODKO ha turni extra disponibili");
});

suite.test("il budget di turni extra si esaurisce dopo il numero di turni dichiarato: al turno successivo il medico torna a perdere", () => {
  const d = dispoBase(MEDICI);
  [G1, G2, G3].forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]);
  });
  // 2 turni extra dichiarati = 24h di budget = esattamente 2 notti da 12h
  const { schema } = elaboraSchema(d, { [BERTUZZI]: -96 }, ANNO_TEST, MESE_TEST, {}, { [BERTUZZI]: 2 });
  const vince = (g) => schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0];
  suite.eq(vince(G1), BERTUZZI, "prima notte: budget extra disponibile, BERTUZZI vince per grad");
  suite.eq(vince(G2), BERTUZZI, "seconda notte: budget extra ancora disponibile (24h - 12h = 12h residue)");
  suite.eq(vince(G3), ZURLO, "terza notte: budget extra esaurito (12h - 12h = 0), BERTUZZI torna al bucket più debole e perde");
});

suite.test("i turni extra non danno MAI priorità di categoria: un contrattualizzato con debito ancora positivo vince sempre, indipendentemente dal grad di chi usa i turni extra", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // grad0 (il migliore in assoluto), ma esaurito + turni extra
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, ma con debito ordinario ancora pieno (categoria DET36)
  const t = unicoTurno(d, { [BERTUZZI]: -96 }, { [BERTUZZI]: 5 }); // budget extra ampio, non basta comunque
  suite.eq(t.slots[0], TRIGODKO, "TRIGODKO ha ancora debito ordinario positivo (bucket pieno): vince sempre su chi sta usando turni extra, anche con grad peggiore");
});

suite.test("parametro turniExtra è opzionale: elaboraSchema senza il 6° argomento si comporta come prima (nessun turno extra)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, { [BERTUZZI]: -96 }, ANNO_TEST, MESE_TEST, {}); // nessun turniExtra passato
  const t = schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
  suite.eq(t.slots[0], ZURLO, "senza turniExtra, il comportamento resta invariato: BERTUZZI esaurito perde contro il senza incarico");
});

suite.test("un vero senza incarico non è mai influenzato da turniExtra (campo irrilevante per chi non ha monte ore)", () => {
  const d = dispoBase(MEDICI);
  d[GRANDO][N(G1)] = turnoDisp(["Maniago"]); // grad13
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2
  const t = unicoTurno(d, {}, { [GRANDO]: 10 }); // turniExtra dichiarato per un senza incarico: non ha senso, deve essere ignorato
  suite.eq(t.slots[0], ZURLO, "GRANDO resta un senza incarico puro: turniExtra non gli dà alcun vantaggio, decide solo il grad");
});

suite.finish();

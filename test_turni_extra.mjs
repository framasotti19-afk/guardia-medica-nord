// Test sui "turni extra volontari" (CONTEXT.md §3.10): un budget SEPARATO dal debito ordinario
// (monte ore + ore extra di recupero), dichiarato in numero di turni (12h ciascuno). Si consuma
// SOLO dopo che il debito ordinario è esaurito, e in quel momento il medico compete con la STESSA
// priorità di un senza incarico (solo graduatoria, MAI priorità di categoria). Una volta esaurito
// anche il budget extra, il medico torna al comportamento attuale di "debito esaurito" (perde
// sempre contro un senza incarico vero, può solo coprire turni rimasti completamente scoperti).
//
// PRESSACCO e CERVESATO (entrambi DET24/DET36 titolari di Spilimbergo) sono i protagonisti,
// contesi sempre su Maniago (dove nessuno dei due è titolare) per isolare i confronti di
// debito/bucket dalla titolarità universale (§3.1a). I "senza incarico" sono ottenuti per
// override da MARTINETTI/DE CANDIDO (nessun SENZA di default nella nuova lista medici).
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_turni_extra — turni extra volontari oltre il monte ore");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// DET24, titolare Spilimbergo: PRESSACCO grad57 (104h monte ore)
const PRESSACCO = 8;
// DET36, titolare Spilimbergo: CERVESATO grad63 (156h monte ore)
const CERVESATO = 9;
// Override "senza incarico": MARTINETTI grad5 (migliore), DE CANDIDO grad83 (peggiore)
const MARTINETTI = 4, DE_CANDIDO = 11;
// G1/G2/G3 scelti NON consecutivi (scelta ereditata da quando esisteva ancora la regola di
// spaziatura temporale §3.7, oggi rimossa — CONTEXT.md §10 — innocua qui, mantenuta per leggibilità).
const [G1, , G2, , G3] = GIORNI_FERIALI_SEMPLICI;

function comeSenza(id) {
  return MEDICI_DEFAULT.map((m) => (m.id === id ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}
function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
function unicoTurno(dispo, extraOre, turniExtra, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {}, turniExtra);
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}

suite.test("regressione: senza turni extra dichiarati, un contrattualizzato esaurito perde comunque contro un senza incarico, anche con grad migliore", () => {
  const lista = comeSenza(DE_CANDIDO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, ma monte ore azzerato
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"]); // grad83, ora senza incarico (grad peggiore, ma vince comunque)
  const t = unicoTurno(d, { [PRESSACCO]: -104 }, {}); // debito PRESSACCO: 104-104=0
  suite.eq(t.slots[0], DE_CANDIDO, "PRESSACCO esaurito senza turni extra resta nel bucket più debole, perde nonostante il grad migliore");
  resetMedici();
});

suite.test("con turni extra dichiarati, il contrattualizzato esaurito compete come senza incarico (vince per grad migliore)", () => {
  const lista = comeSenza(DE_CANDIDO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"]); // grad83, ora senza incarico
  const t = unicoTurno(d, { [PRESSACCO]: -104 }, { [PRESSACCO]: 1 }); // 1 turno extra = 12h di budget
  suite.eq(t.slots[0], PRESSACCO, "con budget extra disponibile, PRESSACCO torna a competere (bucket senza incarico) e vince per grad migliore");
  resetMedici();
});

suite.test("a parità di bucket, un turno-extra con grad peggiore di un vero senza incarico perde comunque: nessun vantaggio speciale", () => {
  const lista = comeSenza(MARTINETTI);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]); // grad63, ma qui esaurito + turni extra
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]); // grad5, senza incarico vero — grad migliore
  const t = unicoTurno(d, { [CERVESATO]: -156 }, { [CERVESATO]: 1 });
  suite.eq(t.slots[0], MARTINETTI, "stesso bucket (senza incarico): decide il grad puro, MARTINETTI (grad5) batte CERVESATO (grad63) anche se CERVESATO ha turni extra disponibili");
  resetMedici();
});

suite.test("il budget di turni extra si esaurisce dopo il numero di turni dichiarato: al turno successivo il medico torna a perdere", () => {
  const lista = comeSenza(DE_CANDIDO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  [G1, G2, G3].forEach((g) => {
    d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]);
    d[DE_CANDIDO][N(g)] = turnoDisp(["Maniago"]);
  });
  // 2 turni extra dichiarati = 24h di budget = esattamente 2 notti da 12h
  const { schema } = elaboraSchema(d, { [PRESSACCO]: -104 }, ANNO_TEST, MESE_TEST, {}, { [PRESSACCO]: 2 });
  const vince = (g) => schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0];
  suite.eq(vince(G1), PRESSACCO, "prima notte: budget extra disponibile, PRESSACCO vince per grad");
  suite.eq(vince(G2), PRESSACCO, "seconda notte: budget extra ancora disponibile (24h - 12h = 12h residue)");
  suite.eq(vince(G3), DE_CANDIDO, "terza notte: budget extra esaurito (12h - 12h = 0), PRESSACCO torna al bucket più debole e perde");
  resetMedici();
});

suite.test("i turni extra non danno MAI priorità di categoria: un contrattualizzato con debito ancora positivo vince sempre, indipendentemente dal grad di chi usa i turni extra", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57 (migliore), ma esaurito + turni extra
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]); // grad63 (peggiore), ma con debito ordinario ancora pieno
  const t = unicoTurno(d, { [PRESSACCO]: -104 }, { [PRESSACCO]: 5 }); // budget extra ampio, non basta comunque
  suite.eq(t.slots[0], CERVESATO, "CERVESATO ha ancora debito ordinario positivo (bucket pieno): vince sempre su chi sta usando turni extra, anche con grad peggiore");
});

suite.test("parametro turniExtra è opzionale: elaboraSchema senza il 6° argomento si comporta come prima (nessun turno extra)", () => {
  const lista = comeSenza(DE_CANDIDO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, { [PRESSACCO]: -104 }, ANNO_TEST, MESE_TEST, {}); // nessun turniExtra passato
  const t = schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
  suite.eq(t.slots[0], DE_CANDIDO, "senza turniExtra, il comportamento resta invariato: PRESSACCO esaurito perde contro il senza incarico");
  resetMedici();
});

suite.test("un vero senza incarico non è mai influenzato da turniExtra (campo irrilevante per chi non ha monte ore)", () => {
  let lista = comeSenza(MARTINETTI);
  lista = lista.map((m) => (m.id === DE_CANDIDO ? { ...m, cat: "SENZA", sedeContratto: null } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"]); // grad83, senza incarico
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]); // grad5, senza incarico — grad migliore
  const t = unicoTurno(d, {}, { [DE_CANDIDO]: 10 }); // turniExtra dichiarato per un senza incarico: non ha senso, deve essere ignorato
  suite.eq(t.slots[0], MARTINETTI, "MARTINETTI resta un senza incarico puro con grad migliore: DE CANDIDO resta un senza incarico puro anch'esso, turniExtra non gli dà alcun vantaggio, decide solo il grad");
  resetMedici();
});

suite.finish();

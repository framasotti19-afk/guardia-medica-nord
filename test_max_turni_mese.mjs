// Test su "Max turni mese" (CONTEXT.md §3.11): un tetto SUPERIORE al numero di turni nel mese,
// dichiarato dal coordinatore per QUALSIASI categoria (anche senza incarico), indipendente dal
// monte ore/debito residuo. Il motore esclude il medico da "candidati" (candidatiOrdinati) non
// appena raggiunge quel numero, anche se ha ancora debito residuo positivo — è un blocco rigido,
// non una deprioritizzazione (stesso trattamento del blocco rigido oltre il monte ore, §3.4).
import { MEDICI, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_max_turni_mese — tetto mensile dichiarato dal coordinatore");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// Giorni feriali semplici ma spaziati di 7 in 7 (sempre distanza > 1): isolano i test dalla
// regola di spaziatura temporale (§3.7), che altrimenti sposterebbe il vincitore del giorno
// successivo su un'alternativa indipendentemente dal tetto mensile testato qui.
const [G1, G2, G3, G4, G5] = [3, 10, 17, 24, 31];
// INDET: BERTUZZI grad0 (96h monte ore = 8 notti)
const BERTUZZI = 1;
// SENZA: ZURLO grad2, GRANDO grad13 (backup di grad peggiore)
const ZURLO = 13, GRANDO = 14;

function schemaCon(dispo, extraOre, turniExtra, maxTurniMese) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {}, turniExtra || {}, maxTurniMese || {}).schema;
}
function vinceGiorno(schema, giorno) {
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N").slots[0];
}

suite.test("un contrattualizzato con debito ancora ampiamente positivo si ferma comunque al tetto mensile dichiarato (mai più di N turni nel mese)", () => {
  const d = dispoBase(MEDICI);
  [G1, G2, G3, G4, G5].forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]);
  });
  // BERTUZZI ha 96h di monte ore (8 notti) ma un tetto dichiarato di sole 3 guardie: il tetto,
  // più restrittivo del debito, dimensiona anche la distribuzione temporale (§3.11 — i due punti
  // sono collegati by design): i suoi 3 turni vengono distribuiti sui 5 giorni disponibili
  // (G1,G3,G5, i più spaziati) invece di essere i primi 3 consecutivi. Sui restanti giorni
  // (G2,G4) è comunque escluso non appena il tetto è raggiunto: qui verifichiamo che in NESSUN
  // caso vinca più di 3 notti totali nel mese, indipendentemente da quali giorni esattamente.
  const schema = schemaCon(d, {}, {}, { [BERTUZZI]: 3 });
  const vittorieBERTUZZI = [G1, G2, G3, G4, G5].filter((g) => vinceGiorno(schema, g) === BERTUZZI);
  suite.eq(vittorieBERTUZZI.length, 3, "BERTUZZI vince ESATTAMENTE 3 notti su 5 disponibili, mai di più nonostante il debito residuo");
  const vittorieZURLO = [G1, G2, G3, G4, G5].filter((g) => vinceGiorno(schema, g) === ZURLO);
  suite.eq(vittorieZURLO.length, 2, "le 2 notti restanti (oltre il tetto di BERTUZZI) vanno al senza incarico, senza lasciare buchi");
  suite.assert(vittorieBERTUZZI.includes(G1) && vittorieBERTUZZI.includes(G3) && vittorieBERTUZZI.includes(G5), "le 3 notti di BERTUZZI sono quelle più spaziate (G1,G3,G5), non i primi 3 giorni consecutivi");
});

suite.test("il tetto mensile vale anche per un senza incarico (nessun monte ore): si ferma comunque al numero dichiarato", () => {
  const d = dispoBase(MEDICI);
  [G1, G2, G3].forEach((g) => {
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]); // grad2, migliore di GRANDO
    d[GRANDO][N(g)] = turnoDisp(["Maniago"]); // grad13, backup
  });
  const schema = schemaCon(d, {}, {}, { [ZURLO]: 2 });
  suite.eq(vinceGiorno(schema, G1), ZURLO, "1ª notte: ZURLO sotto il tetto, vince per grad migliore");
  suite.eq(vinceGiorno(schema, G2), ZURLO, "2ª notte: raggiunge il tetto (2), vince ancora");
  suite.eq(vinceGiorno(schema, G3), GRANDO, "3ª notte: ZURLO ha raggiunto il proprio tetto ed è escluso, nonostante non abbia alcun monte ore — vince GRANDO");
});

suite.test("un tetto di 0 esclude completamente il medico dal mese, fin dalla prima notte", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const schema = schemaCon(d, {}, {}, { [BERTUZZI]: 0 });
  suite.eq(vinceGiorno(schema, G1), ZURLO, "BERTUZZI con tetto 0 non compete mai, nemmeno alla prima notte disponibile");
});

suite.test("un turno EXTRA conta ai fini del tetto mensile, esattamente come un turno ordinario", () => {
  const d = dispoBase(MEDICI);
  // giorno G1 con turno extra MMG mattina: unico candidato BERTUZZI, per verificare che
  // vincerlo consumi comunque il tetto mensile dichiarato.
  const extras = { [dk(ANNO_TEST, MESE_TEST, G1)]: { M: true, P: false } };
  const M = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|M`;
  d[BERTUZZI][M(G1)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G2)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G2)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras, {}, { [BERTUZZI]: 1 });
  const extraTurno = schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "M");
  suite.eq(extraTurno.slots[0], BERTUZZI, "il turno extra viene comunque assegnato a BERTUZZI (primo e unico turno del mese per lui)");
  suite.eq(vinceGiorno(schema, G2), ZURLO, "avendo già consumato il tetto (1) con il turno extra, BERTUZZI è escluso dal notturno successivo");
});

suite.test("senza tetto dichiarato (assente o null) nessuna restrizione: comportamento invariato", () => {
  const d = dispoBase(MEDICI);
  [G1, G2, G3, G4].forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]);
  });
  const schema = schemaCon(d, {}, {}, {}); // maxTurniMese vuoto
  [G1, G2, G3, G4].forEach((g) => suite.eq(vinceGiorno(schema, g), BERTUZZI, `giorno ${g}: senza tetto, BERTUZZI vince sempre per categoria`));
});

suite.test("parametro maxTurniMese è opzionale: elaboraSchema senza il 7° argomento si comporta come prima", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}); // nessun 7° argomento
  suite.eq(vinceGiorno(schema, G1), BERTUZZI, "senza maxTurniMese, il comportamento resta invariato");
});

suite.finish();

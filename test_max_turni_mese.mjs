// Test su "Max turni mese" (CONTEXT.md §3.11): un tetto SUPERIORE al numero di turni nel mese,
// dichiarato dal coordinatore per QUALSIASI categoria (anche senza incarico), indipendente dal
// monte ore/debito residuo. Il motore esclude il medico da "candidati" (candidatiOrdinati) non
// appena raggiunge quel numero, anche se ha ancora debito residuo positivo — è un blocco rigido,
// non una deprioritizzazione (stesso trattamento del blocco rigido oltre il monte ore, §3.4).
//
// BERTUZZI (INDET, titolare Spilimbergo) è il protagonista, sempre contro "senza incarico"
// ottenuti per override (nessun SENZA di default nella nuova lista medici): la titolarità
// universale (§3.1a) non entra mai in gioco qui, perché il confronto titolarità→categoria è
// gated su ENTRAMBI i contendenti contrattualizzati — un senza incarico lo disattiva sempre.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_max_turni_mese — tetto mensile dichiarato dal coordinatore");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// Giorni feriali semplici, spaziati di 7 in 7 (scelta ereditata da quando esisteva ancora la
// regola di spaziatura temporale §3.7, oggi rimossa — CONTEXT.md §10 — ma la spaziatura tra i
// giorni resta comunque comoda per leggibilità).
const [G1, G2, G3, G4, G5] = [3, 10, 17, 24, 31];
// INDET: BERTUZZI grad666 (96h monte ore = 8 notti) — il grad non conta qui: la categoria (la
// migliore, prio1) decide sempre contro un senza incarico, a prescindere dal numero di grad.
const BERTUZZI = 14;
// "senza incarico" per override: ZURLO_SENZA grad14 (migliore), GRANDO_SENZA grad72 (peggiore)
const ZURLO = 5, GRANDO = 10;

function comeSenza(id) {
  return MEDICI_DEFAULT.map((m) => (m.id === id ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}
function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
function listaConEntrambiSenza() {
  return MEDICI_DEFAULT.map((m) => (m.id === ZURLO || m.id === GRANDO ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}
function schemaCon(dispo, extraOre, turniExtra, maxTurniMese) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {}, turniExtra || {}, maxTurniMese || {}).schema;
}
function vinceGiorno(schema, giorno) {
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N").slots[0];
}

suite.test("un contrattualizzato con debito ancora ampiamente positivo si ferma comunque al tetto mensile dichiarato (mai più di N turni nel mese)", () => {
  const lista = comeSenza(ZURLO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
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
  resetMedici();
});

suite.test("il tetto mensile vale anche per un senza incarico (nessun monte ore): si ferma comunque al numero dichiarato, distribuito (§3.11)", () => {
  const lista = listaConEntrambiSenza();
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  [G1, G2, G3].forEach((g) => {
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]); // grad14, migliore di GRANDO
    d[GRANDO][N(g)] = turnoDisp(["Maniago"]); // grad72, backup
  });
  // ZURLO vincerebbe naturalmente tutte e 3 le notti (grad migliore di GRANDO); con un tetto di 2,
  // il motore tiene il sottoinsieme più equidistanziato dei suoi 3 turni vinti — G1 e G3 (gli
  // estremi), non i primi 2 cronologici — e cede G2 a GRANDO, senza lasciare buchi.
  const schema = schemaCon(d, {}, {}, { [ZURLO]: 2 });
  suite.eq(vinceGiorno(schema, G1), ZURLO, "1ª notte: tra i giorni tenuti (spaziatura massima), ZURLO vince per grad migliore");
  suite.eq(vinceGiorno(schema, G2), GRANDO, "2ª notte: ceduta da ZURLO per mantenere la distribuzione più equidistanziata — vince GRANDO");
  suite.eq(vinceGiorno(schema, G3), ZURLO, "3ª notte: anch'essa tra i giorni tenuti da ZURLO, mai superato il tetto di 2 in totale nel mese");
  resetMedici();
});

suite.test("un tetto di 0 esclude completamente il medico dal mese, fin dalla prima notte", () => {
  const lista = comeSenza(ZURLO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const schema = schemaCon(d, {}, {}, { [BERTUZZI]: 0 });
  suite.eq(vinceGiorno(schema, G1), ZURLO, "BERTUZZI con tetto 0 non compete mai, nemmeno alla prima notte disponibile");
  resetMedici();
});

suite.test("un turno EXTRA conta ai fini del tetto mensile, esattamente come un turno ordinario", () => {
  const lista = comeSenza(ZURLO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
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
  resetMedici();
});

suite.test("senza tetto dichiarato, un contrattualizzato entro il proprio monte ore non subisce alcuna restrizione", () => {
  const lista = comeSenza(ZURLO);
  setMediciGlobal(lista);
  // 4 notti, ben sotto le 8 implicite dal monte ore di BERTUZZI (96h/12h, §3.11): nessun tetto
  // esplicito e nessun sottoinsieme naturale da vinti > tetto, quindi comportamento invariato.
  const d = dispoBase(lista);
  [G1, G2, G3, G4].forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]);
  });
  const schema = schemaCon(d, {}, {}, {}); // maxTurniMese vuoto
  [G1, G2, G3, G4].forEach((g) => suite.eq(vinceGiorno(schema, g), BERTUZZI, `giorno ${g}: senza tetto, BERTUZZI vince sempre per categoria`));
  resetMedici();
});

suite.test("un senza incarico senza tetto dichiarato non ha alcuna distribuzione: nessun riferimento su cui calcolarla", () => {
  const lista = listaConEntrambiSenza();
  setMediciGlobal(lista);
  // ZURLO (senza incarico, nessun monte ore) senza Max turni mese dichiarato: a differenza di un
  // contrattualizzato, non esiste alcun tetto implicito da monte ore — vince tutte le notti in
  // cui è disponibile e superiore in graduatoria, senza alcuna distribuzione forzata (§3.11).
  const d = dispoBase(lista);
  [G1, G2, G3, G4, G5].forEach((g) => {
    d[ZURLO][N(g)] = turnoDisp(["Maniago"]);
    d[GRANDO][N(g)] = turnoDisp(["Maniago"]);
  });
  const schema = schemaCon(d, {}, {}, {});
  [G1, G2, G3, G4, G5].forEach((g) => suite.eq(vinceGiorno(schema, g), ZURLO, `giorno ${g}: nessun tetto per ZURLO, vince sempre per grad migliore`));
  resetMedici();
});

suite.test("parametro maxTurniMese è opzionale: elaboraSchema senza il 7° argomento si comporta come prima", () => {
  const lista = comeSenza(ZURLO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}); // nessun 7° argomento
  suite.eq(vinceGiorno(schema, G1), BERTUZZI, "senza maxTurniMese, il comportamento resta invariato");
  resetMedici();
});

suite.finish();

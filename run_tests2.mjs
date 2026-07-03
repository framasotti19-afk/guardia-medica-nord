// Test runtime del motore: gerarchia categorie (INDET/DET36/DET24/SENZA), titolarità di
// sede tra determinati, tie-break debito/graduatoria, scenari di copertura verde/blu (1-4
// medici), invarianti. Basato sulle regole di CONTEXT.md §3.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("run_tests2 — gerarchia, titolarità, scenari, debito");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0]; // 3

// Scorciatoie sui medici della graduatoria simulata (CONTEXT.md §4)
const BERTUZZI = 1, CAMPANER = 2, TRIGODKO = 3, PRESSACCO = 4, FOSCHIANI = 8, WANG = 12, ZURLO = 13, MICHELI = 17;

function unicoTurno(dispo, extraOre = {}, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}
function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }

// ---------------------------------------------------------------------------
// A. GERARCHIA CATEGORIE (§3.1)
// ---------------------------------------------------------------------------
suite.test("INDET batte DET36 sulla stessa sede contesa", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("BERTUZZI e CAMPANER (entrambi INDET) sono nella stessa categoria: a parità di debito decide il grad", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // grad0
  d[CAMPANER][N(G1)] = turnoDisp(["Maniago"]); // grad1
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("DET36 batte DET24 anche con grad numerico peggiore (nessuna titolarità dichiarata)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3, migliore, ma categoria inferiore
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "la categoria deve prevalere sul grad numerico");
});

suite.test("DET24 batte SENZA anche con grad numerico peggiore", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2, migliore, ma senza incarico
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI);
});

suite.test("categoria prevale SEMPRE finché il medico ha debito > 0 (anche 1h residua)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  // BERTUZZI (INDET, base 96h) con debito ridotto a 1h residua
  const t = unicoTurno(d, { [BERTUZZI]: -95 });
  suite.eq(t.slots[0], BERTUZZI, "INDET con 1h di debito deve battere DET36 con debito pieno");
});

// ---------------------------------------------------------------------------
// B. TITOLARITÀ DI SEDE (solo tra determinati) — NUOVO
// ---------------------------------------------------------------------------
suite.test("tra determinati, il titolare della sede vince l'assegnazione FISICA anche contro categoria superiore", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Maniago" } : m)); // DET24 titolare MA
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36, non titolare
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET24, titolare
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "il titolare di Maniago deve vincere anche contro un DET36 non titolare");
  resetMedici();
});

suite.test("la titolarità non ha effetto se il conteso è un altro determinato senza contratto su quella sede specifica", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Spilimbergo" } : m)); // titolare SP, non MA
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // titolare di un'altra sede: qui vale solo la categoria
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "titolarità di Spilimbergo non aiuta a vincere Maniago: decide la categoria (DET36 > DET24)");
  resetMedici();
});

suite.test("la titolarità NON si applica se uno dei due contendenti non è determinato (vs INDET)", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // INDET
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET24 titolare
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "INDET batte sempre un determinato, titolarità o no");
  resetMedici();
});

suite.test("la titolarità NON si applica contro un senza incarico", () => {
  resetMedici();
  const d = dispoBase(MEDICI_DEFAULT);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // SENZA, grad2
  const t = unicoTurno(d);
  suite.eq(t.slots[0], ZURLO, "unico candidato, nessuna sorpresa — la titolarità non crea candidature dal nulla");
});

suite.test("nelle coperture a DISTANZA (blu), la titolarità vince PRIMA della categoria, esattamente come per il fisico", () => {
  resetMedici();
  // TRIGODKO (DET36, non titolare) vs FOSCHIANI (DET24, titolare Meduno): entrambi dichiarano
  // blu su Meduno. La gerarchia è identica a quella fisica (titolarità sede → categoria → debito
  // → graduatoria): FOSCHIANI vince nonostante la categoria nominalmente inferiore.
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Meduno" } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[2], FOSCHIANI, "il titolare di Meduno vince il blu su Meduno anche contro un DET36 non titolare");
  resetMedici();
});

suite.test("nelle coperture a distanza, a parità di categoria la titolarità decide come tie-break", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === PRESSACCO ? { ...m, sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  // n=3: fisici a Spilimbergo (TRIGODKO) e Meduno (PRESSACCO); nessuno dichiara Maniago come
  // verde, quindi resta fisicamente scoperta. Entrambi (stessa categoria DET36) la dichiarano
  // come blu: titolare Maniago è PRESSACCO (grad peggiore), non TRIGODKO.
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Maniago"], { bluLiv: { Maniago: 1 } }); // grad4, non titolare
  d[PRESSACCO][N(G1)] = turnoDisp(["Meduno"], ["Maniago"], { bluLiv: { Maniago: 1 } }); // grad57, titolare Maniago
  d[WANG][N(G1)] = turnoDisp(["Claut"]); // 3° candidato presente, ma il suo verde non rientra nel target (MA,SP,ME)
  const t = unicoTurno(d);
  suite.eq(t.slots[0], PRESSACCO, "a parità di categoria (DET36), il titolare di Maniago vince il blu su Maniago nonostante grad peggiore");
  resetMedici();
});

// ---------------------------------------------------------------------------
// C. DEBITO — TIE-BREAK STESSA CATEGORIA (§3.1, §3.4)
// ---------------------------------------------------------------------------
resetMedici(); // difensivo: garantisce stato pulito anche se un test della sezione B è fallito a metà
suite.test("stessa categoria, stesso debito iniziale → vince il grad più basso", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("stessa categoria, chi ha più debito residuo vince anche col grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -100, [PRESSACCO]: +50 });
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO ha più debito residuo nonostante grad peggiore");
});

suite.test("auto-bilanciamento: 5 turni pari debito, grad3 vs grad124 → 3-2 per il grad migliore (§3.4)", () => {
  const d = dispoBase(MEDICI);
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  giorni.forEach((g) => {
    d[FOSCHIANI][N(g)] = turnoDisp(["Maniago"]);
    d[WANG][N(g)] = turnoDisp(["Maniago"]);
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincite = { [FOSCHIANI]: 0, [WANG]: 0 };
  giorni.forEach((g) => {
    const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
    vincite[t.slots[0]]++;
  });
  suite.eq(vincite[FOSCHIANI], 3, "FOSCHIANI (grad migliore) deve vincere 3 turni su 5");
  suite.eq(vincite[WANG], 2, "WANG deve vincere i restanti 2 (debito che sale dopo ogni sconfitta)");
});

suite.test("recupero ore (extraOre) aumenta il debito e può ribaltare un conflitto", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const senzaRecupero = unicoTurno(d);
  suite.eq(senzaRecupero.slots[0], TRIGODKO, "senza recupero vince il grad migliore");
  const conRecupero = unicoTurno(d, { [PRESSACCO]: 200 });
  suite.eq(conRecupero.slots[0], PRESSACCO, "col recupero ore PRESSACCO ha più debito e vince");
});

suite.test("il recupero ore NON si applica ai senza incarico", () => {
  const d = dispoBase(MEDICI);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [ZURLO]: 999 });
  suite.eq(t.slots[0], ZURLO);
  suite.assert(CAT_INFO[byId[ZURLO].cat].ore === null, "SENZA non ha un monte ore");
});

// ---------------------------------------------------------------------------
// D. DEBITO ESAURITO — ORDINE A 3 FASCE (§3.1)
// ---------------------------------------------------------------------------
suite.test("un medico con debito esaurito (0) esce dalla priorità di categoria", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI (debito>0) deve battere TRIGODKO (debito esaurito) nonostante la categoria inferiore");
});

suite.test("ordine fascia 1: contrattualizzati con debito>0 battono i senza incarico", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], WANG);
});

suite.test("ordine fascia 2: senza incarico battono i contrattualizzati con debito esaurito", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], ZURLO);
});

suite.test("fascia 3 (esauriti): competono solo per grad tra loro", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -156, [PRESSACCO]: -156 });
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("un esaurito NON può scalzare un senza incarico anche con grad migliore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[MICHELI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], MICHELI);
});

suite.test("un esaurito copre comunque un turno se non c'è nessun altro candidato", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], TRIGODKO);
});

// ---------------------------------------------------------------------------
// E. SCENARI DI COPERTURA VERDE/BLU (§3.2) — riscritti: nessuna copertura automatica
// ---------------------------------------------------------------------------
suite.test("n=1 medico: fisico nella sede verde ottenuta (NON più forzato su Maniago)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[1], TRIGODKO, "deve andare fisicamente su Spilimbergo, la sua sede verde");
  suite.eq(t.fis.length, 1);
  suite.assert(t.slots[0] === null && t.slots[2] === null && t.slots[3] === null && t.slots[4] === null, "senza blu dichiarato tutto il resto è scoperto");
});

suite.test("n=1 medico con blu dichiarato copre 1 sola sede extra a distanza", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Claut"], { bluLiv: { Meduno: 1, Claut: 2 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[1], TRIGODKO);
  suite.eq(t.slots[2], TRIGODKO, "copre Meduno, il suo blu di livello migliore");
  suite.assert(t.slots[3] === null, "Claut resta scoperta: un medico copre al massimo 1 sede a distanza");
});

suite.test("n=2 medici: fisici nelle 2 CDC, nessuna copertura automatica delle altre sedi", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
  suite.eq(t.slots[1], PRESSACCO);
  suite.assert(t.slots[2] === null && t.slots[3] === null && t.slots[4] === null, "Meduno/Claut/Anduins scoperte senza blu dichiarato");
});

suite.test("n=2 medici, conflitto sullo stesso blu senza titolarità in gioco: decide la categoria", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // DET36
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // DET24
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "DET36 batte DET24 anche nel conflitto blu");
});

suite.test("n=3 medici: fisici a Maniago, Spilimbergo, Meduno; il resto dipende dal blu", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO); suite.eq(t.slots[2], GHIZZO);
  suite.assert(t.slots[3] === null && t.slots[4] === null, "Claut e Anduins scoperte senza blu");
});

suite.test("n=3 medici con blu su Claut e Anduins: entrambe coperte se dichiarate da fisici diversi", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[3], TRIGODKO, "Claut coperta da chi l'ha dichiarata blu");
  suite.eq(t.slots[4], PRESSACCO, "Anduins coperta da chi l'ha dichiarata blu");
});

suite.test("n=4 medici: 4 sedi fisiche (MA+SP+ME+CL), Anduins dipende dal blu", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5, IENGO = 6;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Claut"]);
  const t = unicoTurno(d);
  suite.eq(t.fis.length, 4);
  suite.eq(t.slots[3], IENGO);
  suite.assert(t.slots[4] === null, "Anduins scoperta senza blu dichiarato da nessuno dei 4 fisici");
});

suite.test("un medico copre al massimo 1 sede a distanza anche con più blu dichiarati e disponibili", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno", "Claut", "Anduins"], { bluLiv: { Meduno: 1, Claut: 2, Anduins: 3 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "prende Meduno, il suo blu di livello migliore");
  suite.assert(t.slots[3] === null && t.slots[4] === null, "Claut e Anduins restano scoperte: massimo 1 sede a distanza a testa");
});

suite.test("se il vincitore del blu preferito viene scalzato, prova il blu successivo nel suo ordine", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad4
  d[GHIZZO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Claut"], { bluLiv: { Meduno: 1, Claut: 2 } }); // grad91
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "TRIGODKO (grad migliore) vince Meduno");
  suite.eq(t.slots[3], GHIZZO, "GHIZZO, perso Meduno, ottiene comunque Claut (suo blu successivo)");
});

// ---------------------------------------------------------------------------
// F. LIVELLI VERDE (ricollocazione fisica, §3.3)
// ---------------------------------------------------------------------------
suite.test("livelli verdi pari fra due sedi = indifferente: il motore ricolloca per massimizzare le coperture", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "BERTUZZI si sposta su Maniago (indifferente per lui)");
  suite.eq(t.slots[1], CAMPANER, "CAMPANER ottiene Spilimbergo, la sua unica scelta");
});

suite.test("parità di livello fra una CDC e una sede secondaria: vince sempre la CDC, MAI l'ordine di dichiarazione", () => {
  const d = dispoBase(MEDICI);
  // MICHELI unico candidato (n=1, target dinamico): dichiara Meduno PRIMA di Maniago nell'array,
  // entrambi a livello 1 (pari). Se la parità fosse risolta per ordine di inserimento, andrebbe
  // a Meduno; deve invece andare a Maniago perché le CDC vengono sempre prima a parità di livello.
  d[MICHELI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 1, Maniago: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MICHELI, "va a Maniago nonostante l'abbia dichiarato dopo Meduno nell'array");
  suite.assert(t.slots[2] === null, "Meduno resta scoperta: la parità con Maniago non la rende una scelta equivalente");
});

suite.test("parità Maniago/Meduno = identico risultato di Maniago:1 + Meduno:2 (la parità non è vera indifferenza tra CDC e sede secondaria)", () => {
  const d1 = dispoBase(MEDICI);
  d1[MICHELI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 1, Maniago: 1 } });
  const t1 = unicoTurno(d1);
  const d2 = dispoBase(MEDICI);
  d2[MICHELI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 2, Maniago: 1 } });
  const t2 = unicoTurno(d2);
  suite.eq(t1.slots[0], t2.slots[0], "stesso esito su Maniago sia dichiarando Meduno:1 (pari) sia Meduno:2 (esplicitamente peggiore)");
  suite.eq(t1.slots[0], MICHELI);
});

suite.test("livello verde migliore = diritto di tenere la sede contro chi non supera in gerarchia", () => {
  const d = dispoBase(MEDICI);
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[1], CAMPANER);
});

suite.test("scalzamento fisico consentito solo se il richiedente ha vera priorità superiore", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"]); // DET24, unica scelta
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno", "Spilimbergo"], [], { verdeLiv: { Meduno: 1, Spilimbergo: 2 } }); // INDET
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "BERTUZZI (priorità superiore) scalza WANG da Spilimbergo anche a livello peggiore");
});

// ---------------------------------------------------------------------------
// G. INVARIANTI GENERALI
// ---------------------------------------------------------------------------
suite.test("INV1: nessun medico fisico senza disponibilità verde dichiarata per quella sede", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO);
});

suite.test("INV2: nessun medico con NO esplicito viene assegnato (né fisico né a distanza)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.assert(!t.slots.includes(TRIGODKO));
  suite.eq(t.slots[0], PRESSACCO);
});

suite.test("INV3: le coperture a distanza provengono solo da medici fisicamente presenti nel turno", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO);
  suite.assert(t.fis.includes(0) && t.slots[0] === TRIGODKO, "chi copre a distanza deve essere fisico nel turno");
});

suite.test("nessuna copertura è automatica: senza alcun blu dichiarato, tutto ciò che non è fisico resta scoperto", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5, IENGO = 6;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Claut"]);
  const t = unicoTurno(d);
  suite.assert(t.slots[4] === null, "Anduins non è mai un target fisico e senza blu resta sempre scoperta");
});

suite.test("nessuna eccezione con turno completamente privo di candidati", () => {
  const d = dispoBase(MEDICI);
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null));
  suite.eq(t.fis.length, 0);
});

suite.test("nessuna eccezione con singolo candidato marcato NO esplicito", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null));
});

suite.test("due senza incarico in conflitto: vince solo il grad", () => {
  const d = dispoBase(MEDICI);
  const GRANDO = 14;
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  d[GRANDO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], ZURLO);
});

suite.test("weekend: entrambi i turni (diurno e notturno) vengono elaborati indipendentemente", () => {
  const d = dispoBase(MEDICI);
  const weekend = 1;
  const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
  d[TRIGODKO][G(weekend)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(weekend)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const giorno = schema.find((g) => g.giorno === weekend);
  suite.eq(giorno.turni.find((t) => t.id === "G").slots[0], TRIGODKO);
  suite.eq(giorno.turni.find((t) => t.id === "N").slots[0], PRESSACCO);
});

suite.test("turno extra (MMG mattina/pomeriggio): assegnazione singola secondo gerarchia", () => {
  const d = dispoBase(MEDICI);
  const giorno = GIORNI_FERIALI_SEMPLICI[0];
  const extras = { [dk(ANNO_TEST, MESE_TEST, giorno)]: { M: true } };
  const M = `${dk(ANNO_TEST, MESE_TEST, giorno)}|M`;
  d[CAMPANER][M] = turnoDisp(["Maniago"]);
  d[TRIGODKO][M] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);
  const t = schema.find((g) => g.giorno === giorno).turni.find((x) => x.id === "M");
  suite.eq(t.slots[0], CAMPANER, "INDET deve battere DET36 anche sul turno extra");
  suite.eq(t.slots.length, 1);
});

suite.test("recupero ore negativo esaurisce prima il debito e fa uscire dalla priorità di categoria", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [BERTUZZI]: -200 });
  suite.eq(t.slots[0], FOSCHIANI, "BERTUZZI esaurito da recupero negativo deve perdere contro chi ha ancora debito");
});

suite.finish();

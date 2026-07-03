// Test sulle funzioni "nuove" (CONTEXT.md §3.1a, §3.3, §6.10): livelli verde 1-5,
// titolarità di sede per i determinati, e lista medici modificabile (categoria,
// graduatoria, titolarità, aggiunta/rimozione) tramite setMediciGlobal.
import { MEDICI_DEFAULT, setMediciGlobal, byId, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_nuove_funzioni — livelli verde + titolarità + medici modificabili");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const BERTUZZI = 1, CAMPANER = 2, TRIGODKO = 3, WANG = 12, ZURLO = 13;

// Ogni test riparte dalla lista medici di default, per non contaminare i successivi
// (setMediciGlobal è idempotente e la lista è uno stato di modulo condiviso).
function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
function dispoBase() { const d = {}; MEDICI_DEFAULT.forEach((m) => (d[m.id] = {})); return d; }
function unicoTurno(dispo, extraOre = {}, mediciAttuali) {
  const list = mediciAttuali || MEDICI_DEFAULT;
  const d2 = {};
  list.forEach((m) => (d2[m.id] = dispo[m.id] || {}));
  const { schema } = elaboraSchema(d2, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}

// ---------------------------------------------------------------------------
// LIVELLI SULLE PREFERENZE VERDI (§3.3)
// ---------------------------------------------------------------------------
suite.test("livelli verdi pari = indifferenti: il motore ricolloca per massimizzare la copertura", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
  suite.eq(t.slots[1], CAMPANER);
});

suite.test("livello più basso su una sede verde = diritto di tenerla contro chi non supera in gerarchia", () => {
  resetMedici();
  const d = dispoBase();
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } });
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[1], CAMPANER, "CAMPANER (priorità superiore) deve tenere la sua sede");
});

suite.test("chi ha priorità superiore scalza comunque, anche se per l'occupante è un livello peggiore", () => {
  resetMedici();
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } }); // DET24, unica scelta
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno", "Spilimbergo"], [], { verdeLiv: { Meduno: 1, Spilimbergo: 3 } }); // INDET
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "BERTUZZI ha priorità superiore: scalza WANG da Spilimbergo anche se per lui è livello 3 (peggiore)");
});

suite.test("i livelli verdi non decidono MAI il vincitore, solo la sede finale", () => {
  resetMedici();
  const FOSCHIANI = 8;
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 5 } }); // grad3, livello peggiore possibile
  d[WANG][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } }); // grad124, livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI vince per grad migliore nonostante il livello verde peggiore");
});

suite.test("una sede non dichiarata (né verde né blu) resta sempre inaccessibile per quel medico", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // non dichiara Spilimbergo in alcuna forma
  const t = unicoTurno(d);
  // nessuna copertura automatica: senza blu dichiarato, tutto il resto resta scoperto.
  suite.assert(t.slots[1] === null, "Spilimbergo resta scoperta: BERTUZZI non l'ha dichiarata né verde né blu");
});

suite.test("una sede dichiarata come blu resta comunque di priorità inferiore a qualunque sede verde", () => {
  resetMedici();
  const FOSCHIANI = 8;
  const d = dispoBase();
  d[TRIGODKO][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { bluLiv: { Spilimbergo: 1 } }); // DET36
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } }); // DET24, priorità inferiore
  const t = unicoTurno(d);
  // TRIGODKO (DET36) ha priorità superiore a FOSCHIANI (DET24): anche arrivandoci in blu (a
  // distanza), scalza comunque FOSCHIANI dalla sua sede fisica? NO — il blu non è una forma di
  // presenza fisica: TRIGODKO è fisico a Meduno, e prova a COPRIRE Spilimbergo a distanza SOLO
  // se non è già fisicamente occupata. FOSCHIANI è fisico lì: niente scalzamento, il blu può
  // solo competere per sedi NON fisicamente coperte.
  suite.eq(t.slots[1], FOSCHIANI, "il blu non scalza mai una presenza fisica: può coprire solo sedi scoperte");
});

// ---------------------------------------------------------------------------
// TITOLARITÀ DI SEDE (§3.1a) — modificabile via setMediciGlobal
// ---------------------------------------------------------------------------
suite.test("assegnare la titolarità di Maniago a un determinato lo fa vincere anche contro categoria superiore", () => {
  resetMedici();
  const FOSCHIANI = 8;
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = {}; lista.forEach((m) => (d[m.id] = {}));
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET24, titolare
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], FOSCHIANI, "il titolare di Maniago vince anche contro un DET36 non titolare");
  resetMedici();
});

suite.test("rimuovere la titolarità (torna a null) ripristina la normale gerarchia di categoria", () => {
  resetMedici();
  const FOSCHIANI = 8;
  const conTitolarita = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: "Maniago" } : m));
  const d = {}; conTitolarita.forEach((m) => (d[m.id] = {}));
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  setMediciGlobal(conTitolarita);
  suite.eq(unicoTurno(d, {}, conTitolarita).slots[0], FOSCHIANI, "con titolarità, FOSCHIANI vince");

  const senzaTitolarita = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, sedeContratto: null } : m));
  setMediciGlobal(senzaTitolarita);
  suite.eq(unicoTurno(d, {}, senzaTitolarita).slots[0], TRIGODKO, "senza titolarità, torna a vincere TRIGODKO (DET36 > DET24)");
  resetMedici();
});

suite.test("i medici di default hanno tutti sedeContratto null (nessuna titolarità nei dati simulati)", () => {
  resetMedici();
  suite.assert(MEDICI_DEFAULT.every((m) => m.sedeContratto === null), "nessuna titolarità reale è nota: da inserire manualmente dal coordinatore");
});

// ---------------------------------------------------------------------------
// MEDICI MODIFICABILI (§6.10)
// ---------------------------------------------------------------------------
suite.test("cambiare la categoria di un medico ne cambia la priorità nel motore", () => {
  resetMedici();
  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "INDET" } : m));
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36, normalmente batterebbe un DET24
  setMediciGlobal(listaModificata);
  const t = unicoTurno(d, {}, listaModificata);
  suite.eq(t.slots[0], WANG, "WANG promosso a INDET deve ora battere TRIGODKO (DET36)");
  resetMedici();
});

suite.test("cambiare la graduatoria di un medico cambia l'esito di un conflitto stessa categoria", () => {
  resetMedici();
  const TRIGODKO_ = 3, PRESSACCO = 4;
  const d = dispoBase();
  d[TRIGODKO_][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const prima = unicoTurno(d);
  suite.eq(prima.slots[0], TRIGODKO_, "normalmente TRIGODKO (grad4) batte PRESSACCO (grad57)");

  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === PRESSACCO ? { ...m, grad: 1 } : m));
  setMediciGlobal(listaModificata);
  const dopo = unicoTurno(d, {}, listaModificata);
  suite.eq(dopo.slots[0], PRESSACCO, "con grad1, PRESSACCO deve ora battere TRIGODKO");
  resetMedici();
});

suite.test("aggiungere un nuovo medico lo rende un candidato valido", () => {
  resetMedici();
  const nuovoId = Math.max(...MEDICI_DEFAULT.map((m) => m.id)) + 1;
  const listaEstesa = [...MEDICI_DEFAULT, { id: nuovoId, nome: "NUOVO MEDICO", cat: "INDET", grad: 0, sedeContratto: null }];
  setMediciGlobal(listaEstesa);
  const d = {}; listaEstesa.forEach((m) => (d[m.id] = {}));
  d[nuovoId][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, {}, listaEstesa);
  suite.eq(t.slots[0], nuovoId, "il nuovo medico (INDET) deve battere TRIGODKO (DET36)");
  resetMedici();
});

suite.test("rimuovere un medico lo esclude dai candidati anche se aveva dichiarato disponibilità", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const listaSenzaBertuzzi = MEDICI_DEFAULT.filter((m) => m.id !== BERTUZZI);
  setMediciGlobal(listaSenzaBertuzzi);
  const t = unicoTurno(d, {}, listaSenzaBertuzzi);
  suite.eq(t.slots[0], TRIGODKO, "con BERTUZZI rimosso dalla lista medici, TRIGODKO deve vincere anche se BERTUZZI aveva dichiarato disponibilità");
  resetMedici();
});

suite.test("setMediciGlobal è idempotente: richiamarlo più volte con la stessa lista non altera l'esito", () => {
  resetMedici();
  setMediciGlobal(MEDICI_DEFAULT);
  setMediciGlobal(MEDICI_DEFAULT);
  setMediciGlobal(MEDICI_DEFAULT);
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("byId riflette sempre l'ultima lista impostata da setMediciGlobal", () => {
  resetMedici();
  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === TRIGODKO ? { ...m, nome: "TRIGODKO-RINOMINATO" } : m));
  setMediciGlobal(listaModificata);
  suite.eq(byId[TRIGODKO].nome, "TRIGODKO-RINOMINATO");
  resetMedici();
  suite.eq(byId[TRIGODKO].nome, "TRIGODKO", "dopo il reset byId deve tornare al nome originale");
});

suite.test("cambiare categoria da INDET a SENZA elimina il concetto di debito e lo declassa a senza incarico", () => {
  resetMedici();
  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === BERTUZZI ? { ...m, cat: "SENZA" } : m));
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // ora DET36 con debito ha priorità sul BERTUZZI declassato
  setMediciGlobal(listaModificata);
  const t = unicoTurno(d, {}, listaModificata);
  suite.eq(t.slots[0], TRIGODKO, "BERTUZZI declassato a SENZA deve perdere contro un contrattualizzato con debito");
  resetMedici();
});

suite.finish();

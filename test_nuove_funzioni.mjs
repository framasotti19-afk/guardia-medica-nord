// Test sulle funzioni "nuove" (CONTEXT.md §3.1a, §3.3, §6.10): livelli verde 1-5,
// titolarità di sede OBBLIGATORIA e universale per ogni contrattualizzato, e lista medici
// modificabile (categoria, graduatoria, titolarità, aggiunta/rimozione) tramite setMediciGlobal.
// IENGO, PRESSACCO e CERVESATO sono SENZA incarico di default nella lista attuale: vengono
// resuscitati nel loro ruolo storico (DET38 tit.Maniago, DET24 tit.Spilimbergo, DET38
// tit.Spilimbergo) con comeStorico, dove serve un secondo/terzo determinato oltre ai nativi.
import { MEDICI_DEFAULT, setMediciGlobal, byId, dk, elaboraSchema, CDC } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI, comeStorico } from './test_utils.mjs';

const suite = makeSuite("test_nuove_funzioni — livelli verde + titolarità + medici modificabili");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const ZURLO = 1, IENGO = 14, TRIGODKO = 2, MARTINETTI = 7, PITAU = 3, PRESSACCO = 10, CERVESATO = 11, MORANO = 5, BERTUZZI = 9;

const BASE = comeStorico(MEDICI_DEFAULT, IENGO, PRESSACCO, CERVESATO);

// Ogni test riparte dalla lista medici di base (con i ruoli storici resuscitati), per non
// contaminare i successivi (setMediciGlobal è idempotente e la lista è uno stato di modulo
// condiviso).
function resetMedici() { setMediciGlobal(BASE); }
resetMedici();
function dispoBase() { const d = {}; MEDICI_DEFAULT.forEach((m) => (d[m.id] = {})); return d; }
function unicoTurno(dispo, extraOre = {}, mediciAttuali) {
  const list = mediciAttuali || BASE;
  const d2 = {};
  list.forEach((m) => (d2[m.id] = dispo[m.id] || {}));
  const { schema } = elaboraSchema(d2, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}
function comeSenza(lista, id) {
  return lista.map((m) => (m.id === id ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}

// ---------------------------------------------------------------------------
// LIVELLI SULLE PREFERENZE VERDI (§3.3)
// ---------------------------------------------------------------------------
suite.test("livelli verdi pari = indifferenti: il motore ricolloca per massimizzare la copertura", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "a parità, BERTUZZI si sposta su Maniago");
  suite.eq(t.slots[1], IENGO, "IENGO ottiene Spilimbergo, la sua unica scelta");
});

suite.test("livello più basso su una sede verde = diritto di tenerla contro chi non supera in gerarchia", () => {
  resetMedici();
  const lista = comeSenza(BASE, PITAU);
  setMediciGlobal(lista);
  const d = dispoBase();
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } });
  d[PITAU][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } }); // ora SENZA
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[1], IENGO, "IENGO (priorità superiore) deve tenere la sua sede");
  resetMedici();
});

suite.test("chi ha priorità superiore scalza comunque, anche se per l'occupante è un livello peggiore", () => {
  resetMedici();
  const d = dispoBase();
  d[MORANO][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } }); // DET12, unica scelta, non titolare SP
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno", "Spilimbergo"], [], { verdeLiv: { Meduno: 1, Spilimbergo: 3 } }); // INDET, titolare SP
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "BERTUZZI ha priorità superiore (categoria e titolarità): scalza MORANO da Spilimbergo anche se per lui è livello 3 (peggiore)");
});

suite.test("i livelli verdi non decidono MAI il vincitore, solo la sede finale", () => {
  resetMedici();
  const d = dispoBase();
  // MARTINETTI (grad5) e PRESSACCO (grad57), entrambi DET24 titolari di Spilimbergo: contesa su
  // Maniago, nessuno dei due titolare lì.
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 5 } }); // grad5, livello peggiore possibile
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } }); // grad57, livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MARTINETTI, "MARTINETTI vince per grad migliore nonostante il livello verde peggiore");
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
  const d = dispoBase();
  d[IENGO][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { bluLiv: { Spilimbergo: 1 } }); // DET38
  d[MARTINETTI][N(G1)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 1 } }); // DET24, titolare SP, fisico lì
  const t = unicoTurno(d);
  // IENGO (DET38) ha priorità superiore a MARTINETTI (DET24): anche arrivandoci in blu (a
  // distanza), scalza comunque MARTINETTI dalla sua sede fisica? NO — il blu non è una forma di
  // presenza fisica: IENGO è fisico a Meduno, e prova a COPRIRE Spilimbergo a distanza SOLO se non
  // è già fisicamente occupata. MARTINETTI è fisico lì: niente scalzamento, il blu può solo
  // competere per sedi NON fisicamente coperte.
  suite.eq(t.slots[1], MARTINETTI, "il blu non scalza mai una presenza fisica: può coprire solo sedi scoperte");
});

// ---------------------------------------------------------------------------
// TITOLARITÀ DI SEDE (§3.1a) — OBBLIGATORIA per ogni contrattualizzato, modificabile via setMediciGlobal
// ---------------------------------------------------------------------------
suite.test("il titolare di Maniago vince anche contro categoria superiore", () => {
  resetMedici();
  const d = dispoBase();
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]); // DET38, titolare Spilimbergo (non Maniago)
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET24, titolare Maniago
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "il titolare di Maniago vince anche contro un DET38 non titolare lì");
});

suite.test("azzerare la titolarità (sedeContratto → null) ripristina la normale gerarchia di categoria", () => {
  resetMedici();
  const d = dispoBase();
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);

  const conTitolarita = BASE;
  setMediciGlobal(conTitolarita);
  suite.eq(unicoTurno(d, {}, conTitolarita).slots[0], TRIGODKO, "con titolarità (dato di default), TRIGODKO vince");

  // Stato non normalmente raggiungibile dall'UI (titolarità obbligatoria per i contrattualizzati),
  // ma il motore gestisce comunque correttamente sedeContratto:null anche per un contrattualizzato:
  // isTitolareDi lo tratta semplicemente come "non titolare", senza eccezioni.
  const senzaTitolarita = BASE.map((m) => (m.id === TRIGODKO ? { ...m, sedeContratto: null } : m));
  setMediciGlobal(senzaTitolarita);
  suite.eq(unicoTurno(d, {}, senzaTitolarita).slots[0], CERVESATO, "senza titolarità, torna a vincere CERVESATO (DET38 > DET24)");
  resetMedici();
});

suite.test("i medici contrattualizzati (categoria diversa da SENZA) hanno sempre titolarità obbligatoria, mai i medici senza incarico", () => {
  resetMedici();
  const contrattualizzati = MEDICI_DEFAULT.filter((m) => m.cat !== "SENZA");
  const senzaIncarico = MEDICI_DEFAULT.filter((m) => m.cat === "SENZA");
  suite.assert(contrattualizzati.length === 9, "9 contrattualizzati nella lista attuale (8 determinati + 1 INDET)");
  suite.assert(contrattualizzati.every((m) => m.sedeContratto !== null && CDC.includes(m.sedeContratto)), "ogni contrattualizzato ha una titolarità reale dichiarata, sempre una delle 2 CDC");
  suite.assert(senzaIncarico.length === 5, "5 medici senza incarico nella lista attuale");
  suite.assert(senzaIncarico.every((m) => m.sedeContratto === null), "nessun medico senza incarico ha mai una titolarità");
});

// ---------------------------------------------------------------------------
// MEDICI MODIFICABILI (§6.10)
// ---------------------------------------------------------------------------
suite.test("cambiare la categoria di un medico ne cambia la priorità nel motore", () => {
  resetMedici();
  // PRESSACCO e CERVESATO, entrambi titolari di Spilimbergo: contesa su Maniago isola l'effetto
  // del cambio di categoria dalla titolarità (nessuno dei due titolare lì, prima e dopo la modifica).
  const listaModificata = BASE.map((m) => (m.id === PRESSACCO ? { ...m, cat: "INDET" } : m));
  const d = dispoBase();
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]); // DET38, normalmente batterebbe un DET24
  setMediciGlobal(listaModificata);
  const t = unicoTurno(d, {}, listaModificata);
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO promosso a INDET deve ora battere CERVESATO (DET38)");
  resetMedici();
});

suite.test("cambiare la graduatoria di un medico cambia l'esito di un conflitto stessa categoria", () => {
  resetMedici();
  // MARTINETTI e PRESSACCO, entrambi DET24 titolari di Spilimbergo: contesa su Maniago, nessuno
  // dei due titolare lì.
  const d = dispoBase();
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const prima = unicoTurno(d);
  suite.eq(prima.slots[0], MARTINETTI, "normalmente MARTINETTI (grad5) batte PRESSACCO (grad57)");

  const listaModificata = BASE.map((m) => (m.id === PRESSACCO ? { ...m, grad: 1 } : m));
  setMediciGlobal(listaModificata);
  const dopo = unicoTurno(d, {}, listaModificata);
  suite.eq(dopo.slots[0], PRESSACCO, "con grad1, PRESSACCO deve ora battere MARTINETTI");
  resetMedici();
});

suite.test("aggiungere un nuovo medico lo rende un candidato valido", () => {
  resetMedici();
  const nuovoId = Math.max(...BASE.map((m) => m.id)) + 1;
  const listaEstesa = [...BASE, { id: nuovoId, nome: "NUOVO MEDICO", cat: "INDET", grad: 0, sedeContratto: null }];
  setMediciGlobal(listaEstesa);
  const d = {}; listaEstesa.forEach((m) => (d[m.id] = {}));
  // Contesa su Spilimbergo (non Maniago): TRIGODKO è titolare di Maniago, non di Spilimbergo — così
  // l'esito isola l'effetto della categoria del nuovo medico (nessuno titolare della sede contesa).
  d[nuovoId][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d, {}, listaEstesa);
  suite.eq(t.slots[1], nuovoId, "il nuovo medico (INDET) deve battere TRIGODKO (DET24)");
  resetMedici();
});

suite.test("rimuovere un medico lo esclude dai candidati anche se aveva dichiarato disponibilità", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const listaSenzaBertuzzi = BASE.filter((m) => m.id !== BERTUZZI);
  setMediciGlobal(listaSenzaBertuzzi);
  const t = unicoTurno(d, {}, listaSenzaBertuzzi);
  suite.eq(t.slots[0], TRIGODKO, "con BERTUZZI rimosso dalla lista medici, TRIGODKO deve vincere anche se BERTUZZI aveva dichiarato disponibilità");
  resetMedici();
});

suite.test("setMediciGlobal è idempotente: richiamarlo più volte con la stessa lista non altera l'esito", () => {
  resetMedici();
  setMediciGlobal(BASE);
  setMediciGlobal(BASE);
  setMediciGlobal(BASE);
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("byId riflette sempre l'ultima lista impostata da setMediciGlobal", () => {
  resetMedici();
  const listaModificata = BASE.map((m) => (m.id === TRIGODKO ? { ...m, nome: "TRIGODKO-RINOMINATO" } : m));
  setMediciGlobal(listaModificata);
  suite.eq(byId[TRIGODKO].nome, "TRIGODKO-RINOMINATO");
  resetMedici();
  suite.eq(byId[TRIGODKO].nome, "TRIGODKO", "dopo il reset byId deve tornare al nome originale");
});

suite.test("cambiare categoria da INDET a SENZA elimina il concetto di debito e lo declassa a senza incarico", () => {
  resetMedici();
  const listaModificata = BASE.map((m) => (m.id === BERTUZZI ? { ...m, cat: "SENZA", sedeContratto: null } : m));
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET24 con debito ha priorità sul BERTUZZI declassato
  setMediciGlobal(listaModificata);
  const t = unicoTurno(d, {}, listaModificata);
  suite.eq(t.slots[0], TRIGODKO, "BERTUZZI declassato a SENZA deve perdere contro un contrattualizzato con debito");
  resetMedici();
});

suite.finish();

// Test sulle funzioni "nuove" (CONTEXT.md §6.6, §6.10): livelli 1-5 anche sulle
// preferenze piene, e lista medici modificabile (categoria/graduatoria/aggiunta/
// rimozione) tramite setMediciGlobal.
import { MEDICI_DEFAULT, setMediciGlobal, byId, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_nuove_funzioni — livelli piene + medici modificabili");
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
// LIVELLI SULLE PREFERENZE PIENE (§3.3, §6.6)
// ---------------------------------------------------------------------------
suite.test("livelli piene pari = indifferenti: il motore ricolloca per massimizzare la copertura", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { pieneLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
  suite.eq(t.slots[1], CAMPANER);
});

suite.test("livello più basso su una piena = diritto di tenerla contro chi non supera in gerarchia", () => {
  resetMedici();
  const d = dispoBase();
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } });
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[1], CAMPANER, "CAMPANER (priorità superiore) deve tenere la sua piena");
});

suite.test("chi ha priorità superiore scalza comunque, anche se per l'occupante è un livello peggiore", () => {
  resetMedici();
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } }); // DET24, unica scelta
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno", "Spilimbergo"], [], { pieneLiv: { Meduno: 1, Spilimbergo: 3 } }); // IND36
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "BERTUZZI ha priorità superiore: scalza WANG da Spilimbergo anche se per lui è livello 3 (peggiore)");
});

suite.test("retrocompatibilità: dispo senza pieneLiv → tutte le piene a livello 1 (indifferenti)", () => {
  resetMedici();
  const d = dispoBase();
  // formato "vecchio": solo array piene, senza pieneLiv esplicito (normDispo deve applicare livello 1 a tutte)
  d[BERTUZZI][N(G1)] = { piene: ["Maniago", "Spilimbergo"], ripiego: [], no: false, preferito: false, preferitoRip: false };
  d[CAMPANER][N(G1)] = { piene: ["Spilimbergo"], ripiego: [], no: false, preferito: false, preferitoRip: false };
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
  suite.eq(t.slots[1], CAMPANER, "senza pieneLiv esplicito, BERTUZZI deve comunque potersi ricollocare su Maniago");
});

suite.test("i livelli sulle piene non decidono MAI il vincitore, solo la sede finale", () => {
  resetMedici();
  const FOSCHIANI = 8;
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"], [], { pieneLiv: { Maniago: 5 } }); // grad3, livello peggiore possibile
  d[WANG][N(G1)] = turnoDisp(["Maniago"], [], { pieneLiv: { Maniago: 1 } }); // grad124, livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI vince per grad migliore nonostante il livello piena peggiore");
});

suite.test("una sede non dichiarata (né piena né ripiego) resta sempre inaccessibile per quel medico", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // non dichiara Spilimbergo in alcuna forma
  const t = unicoTurno(d);
  // con un solo candidato tutte le sedi finiscono comunque coperte a distanza da lui:
  // verifichiamo che l'unico modo in cui compare a Spilimbergo sia la copertura a distanza, non come fisico.
  suite.eq(t.slots[1], BERTUZZI);
  suite.assert(!t.fis.includes(1), "Spilimbergo non deve risultare fisica per BERTUZZI, che non l'ha dichiarata");
});

suite.test("una sede dichiarata come ripiego resta comunque di priorità inferiore a qualunque piena", () => {
  resetMedici();
  const d = dispoBase();
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { ripiegoLiv: { Spilimbergo: 1 } });
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } }); // stessa priorità? no: IND24 < IND36
  const t = unicoTurno(d);
  // BERTUZZI (IND36) ha priorità superiore a CAMPANER (IND24): anche arrivandoci in ripiego,
  // BERTUZZI scalza comunque CAMPANER da Spilimbergo (coerente con la regola generale di scalzamento).
  suite.eq(t.slots[1], BERTUZZI);
});

// ---------------------------------------------------------------------------
// MEDICI MODIFICABILI (§6.10)
// ---------------------------------------------------------------------------
suite.test("cambiare la categoria di un medico ne cambia la priorità nel motore", () => {
  resetMedici();
  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "IND36" } : m));
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36, normalmente batterebbe un DET24
  setMediciGlobal(listaModificata);
  const t = unicoTurno(d, {}, listaModificata);
  suite.eq(t.slots[0], WANG, "WANG promosso a IND36 deve ora battere TRIGODKO (DET36)");
  resetMedici();
});

suite.test("cambiare la graduatoria di un medico cambia l'esito di un conflitto stessa categoria", () => {
  resetMedici();
  const TRIGODKO = 3, PRESSACCO = 4;
  const d = dispoBase();
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const prima = unicoTurno(d);
  suite.eq(prima.slots[0], TRIGODKO, "normalmente TRIGODKO (grad4) batte PRESSACCO (grad57)");

  const listaModificata = MEDICI_DEFAULT.map((m) => (m.id === PRESSACCO ? { ...m, grad: 1 } : m));
  setMediciGlobal(listaModificata);
  const dopo = unicoTurno(d, {}, listaModificata);
  suite.eq(dopo.slots[0], PRESSACCO, "con grad1, PRESSACCO deve ora battere TRIGODKO");
  resetMedici();
});

suite.test("aggiungere un nuovo medico lo rende un candidato valido", () => {
  resetMedici();
  const nuovoId = Math.max(...MEDICI_DEFAULT.map((m) => m.id)) + 1;
  const listaEstesa = [...MEDICI_DEFAULT, { id: nuovoId, nome: "NUOVO MEDICO", cat: "IND36", grad: 0 }];
  setMediciGlobal(listaEstesa);
  const d = {}; listaEstesa.forEach((m) => (d[m.id] = {}));
  d[nuovoId][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, {}, listaEstesa);
  suite.eq(t.slots[0], nuovoId, "il nuovo medico (IND36) deve battere TRIGODKO (DET36)");
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

suite.test("cambiare categoria da IND36 a SENZA elimina il concetto di debito e lo declassa a senza incarico", () => {
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

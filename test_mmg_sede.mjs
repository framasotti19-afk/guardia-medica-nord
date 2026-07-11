// Test dell'unificazione MMG↔ordinari: un turno MMG (M/P) passa dalla STESSA FASE 1/FASE 2 dei turni
// ordinari e compete sulle sedi fisiche Maniago/Spilimbergo/Meduno. Il coordinatore attiva SOLO la
// fascia (extras {M:true}/{P:true}) — nessuna sede né copertura a distanza scelte a mano: la sede di
// ogni vincitore e l'eventuale copertura a distanza le decide il motore in base alle disponibilità
// verdi/blu dichiarate dai medici, esattamente come per un turno ordinario. Le uniche differenze
// legittime restano le ore (6) e il fatto che il turno esiste solo se attivato (ed è un punto fisso
// protetto in §3.11 — vedi test_distribuzione_temporale).
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_mmg_sede — MMG assegnati come i turni ordinari (sede decisa dal motore)");
setMediciGlobal(MEDICI_DEFAULT);

// SEDI5 = [Maniago(0), Spilimbergo(1), Meduno(2), Claut(3), Anduins(4)]. Le fisiche di un MMG (M/P)
// sono Maniago/Spilimbergo/Meduno (0,1,2), come un turno ordinario notturno.
const BERTUZZI = 9;   // INDET (priorità massima), titolare Spilimbergo
const PRESSACCO = 10; // SENZA incarico (priorità minima)
const G = GIORNI_FERIALI_SEMPLICI[0]; // un feriale: normalmente solo N, ma l'MMG M è attivabile a parte
const Mk = `${dk(ANNO_TEST, MESE_TEST, G)}|M`;
const turnoM = ({ schema }) => schema.find((g) => g.giorno === G).turni.find((t) => t.id === "M");
const elab = (d, extras) => elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);
// L'MMG si attiva con la SOLA fascia: nessun campo sede/blu negli extras.
const attivaM = { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true } };

suite.test("compete su tutte le sedi fisiche come un ordinario: ognuno vince la sede che ha dichiarato", () => {
  // Nessuna sede imposta dal coordinatore. BERTUZZI dichiara Maniago, PRESSACCO Spilimbergo → il
  // motore li piazza entrambi nella rispettiva sede, come farebbe per un notturno ordinario.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Mk] = turnoDisp(["Spilimbergo"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[0], BERTUZZI, "Maniago (idx0) a BERTUZZI, che l'ha dichiarata");
  suite.eq(t.slots[1], PRESSACCO, "Spilimbergo (idx1) a PRESSACCO, che l'ha dichiarata");
  suite.eq(t.slots[2], null, "Meduno (idx2) non dichiarata da nessuno: scoperta");
});

suite.test("gerarchia a parità di sede: sulla stessa sede vince il più forte, il perdente va dove ha dichiarato", () => {
  // Entrambi puntano Spilimbergo; PRESSACCO dichiara anche Maniago. L'INDET vince Spilimbergo,
  // PRESSACCO ripiega su Maniago (indifferenza dichiarata → il motore lo ricolloca).
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Spilimbergo"]);
  d[PRESSACCO][Mk] = turnoDisp(["Spilimbergo", "Maniago"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[1], BERTUZZI, "Spilimbergo va all'INDET (priorità massima)");
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO ripiega su Maniago, l'altra sua sede dichiarata");
});

suite.test("solo la sede dichiarata conta: chi punta una sola sede già presa resta fuori", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Spilimbergo"]);
  d[PRESSACCO][Mk] = turnoDisp(["Spilimbergo"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[1], BERTUZZI, "Spilimbergo all'INDET");
  suite.assert(!t.slots.includes(PRESSACCO), "PRESSACCO, senza altre sedi dichiarate, non è piazzato");
});

suite.test("Claut/Anduins non sono sedi fisiche del MMG: chi dichiara solo quelle non è piazzato fisicamente", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Claut"]); // Claut(3) non è tra le fisiche (0,1,2) del MMG
  const t = turnoM(elab(d, attivaM));
  suite.assert(!t.slots.some(Boolean), "nessuna assegnazione fisica: Claut non è una fisica del turno");
});

suite.test("scopertura come un ordinario: fisiche non dichiarate da nessuno → avviso SCOPERTE", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]); // solo Maniago coperta
  const { schema, avvisi } = elab(d, attivaM);
  const t = schema.find((g) => g.giorno === G).turni.find((x) => x.id === "M");
  suite.eq(t.slots[0], BERTUZZI, "Maniago coperta");
  suite.assert(avvisi.some((a) => a.includes("Spilimbergo") && a.includes("Meduno") && a.includes("SCOPERTE")),
    "avviso: Spilimbergo e Meduno scoperte (le fisiche non dichiarate)");
});

suite.test("copertura a distanza (FASE 2) dai blu del MEDICO: il fisico copre un'altra sede se l'ha dichiarata", () => {
  // MMG: BERTUZZI vince Maniago (fisica) e ha dichiarato Claut a distanza (blu). Vincolo territoriale:
  // Claut (idx3) è coperta a distanza SOLO dal fisico di Maniago (idx0) — che è proprio lui.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"], ["Claut"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[0], BERTUZZI, "fisico a Maniago");
  suite.eq(t.slots[3], BERTUZZI, "Claut coperta a distanza dallo stesso fisico (FASE 2 come un ordinario)");
});

suite.test("la copertura a distanza rispetta i vincoli territoriali: Claut NON coperta se il fisico non è a Maniago", () => {
  // BERTUZZI vince Meduno (fisica) + blu Claut: Claut è raggiungibile a distanza SOLO da Maniago → scoperta.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Meduno"], ["Claut"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[2], BERTUZZI, "fisico a Meduno");
  suite.eq(t.slots[3], null, "Claut non coperta: vincolo territoriale (solo da Maniago) rispettato come per gli ordinari");
});

suite.test("l'MMG espone extra:true e nessuna sede/blu di turno (decise dal motore, non dal coordinatore)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.extra, true, "il turno resta marcato extra (punto fisso in §3.11)");
  suite.eq(t.sede, null, "nessuna sede di turno imposta dal coordinatore");
  suite.eq(t.blu, null, "nessuna copertura a distanza di turno imposta dal coordinatore");
});

suite.finish();

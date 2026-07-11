// Test dell'unificazione MMG↔ordinari (§10 voce 51): dopo il fix strutturale, un turno MMG (M/P)
// non ha più una logica separata "senza sede" (slots=[mid]) ma passa dalla STESSA FASE 1/FASE 2 dei
// turni ordinari, con un'UNICA sede fisica = quella ATTIVATA dal coordinatore (extras.M_sede/P_sede).
// Le uniche differenze legittime sono le ore (6) e il fatto che il turno esiste solo se attivato.
// Decisioni di business confermate: 1a (MMG resta punto fisso protetto in §3.11 — vedi
// test_distribuzione_temporale), 2a (eleggibile SOLO chi ha dichiarato la sede attivata), 3a
// (sede mancante → turno attivo ma scoperto + avviso, nessun blocco).
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_mmg_sede — MMG assegnati come i turni ordinari, con sede");
setMediciGlobal(MEDICI_DEFAULT);

// SEDI5 = [Maniago(0), Spilimbergo(1), Meduno(2), Claut(3), Anduins(4)]
const BERTUZZI = 9;   // INDET (priorità massima), titolare Spilimbergo
const PRESSACCO = 10; // SENZA incarico (priorità minima)
const G = GIORNI_FERIALI_SEMPLICI[0]; // un feriale: normalmente solo N, ma l'MMG M è attivabile a parte
const Mk = `${dk(ANNO_TEST, MESE_TEST, G)}|M`;
const turnoM = ({ schema }) => schema.find((g) => g.giorno === G).turni.find((t) => t.id === "M");
const elab = (d, extras) => elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);

suite.test("eleggibilità per sede (2a): vince chi ha dichiarato la sede ATTIVATA, non il più forte in gerarchia", () => {
  // MMG attivato a Spilimbergo. BERTUZZI (INDET, fortissimo) ha dichiarato solo Maniago; PRESSACCO
  // (senza incarico) ha dichiarato Spilimbergo → PRESSACCO vince la sede attivata, BERTUZZI è fuori.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Mk] = turnoDisp(["Spilimbergo"]);
  const t = turnoM(elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Spilimbergo" } }));
  suite.eq(t.slots[1], PRESSACCO, "Spilimbergo (idx1) va a PRESSACCO, unico ad averla dichiarata");
  suite.eq(t.slots[0], null, "Maniago (idx0) non è la sede attivata: BERTUZZI non è piazzato lì");
  suite.eq(t.sede, "Spilimbergo", "il turno espone la sede attivata");
});

suite.test("gerarchia a parità di sede: se entrambi hanno dichiarato la sede attivata, vince il più forte", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Spilimbergo"]);
  d[PRESSACCO][Mk] = turnoDisp(["Spilimbergo"]);
  const t = turnoM(elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Spilimbergo" } }));
  suite.eq(t.slots[1], BERTUZZI, "a parità di sede dichiarata l'INDET batte il senza incarico");
});

suite.test("nessuno ha dichiarato la sede attivata → SCOPERTO (avviso), come un ordinario", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Mk] = turnoDisp(["Maniago"]);
  const { schema, avvisi } = elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Spilimbergo" } });
  const t = schema.find((g) => g.giorno === G).turni.find((x) => x.id === "M");
  suite.assert(!t.slots.some(Boolean), "nessuna sede assegnata: turno interamente scoperto");
  suite.assert(avvisi.some((a) => a.includes("Spilimbergo") && a.includes("SCOPERTE")), "avviso di scopertura sulla sede attivata");
});

suite.test("migrazione (3a): MMG attivo SENZA sede → nessuna assegnazione + avviso dedicato, nessun blocco", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]); // dispo c'è, ma la sede del turno non è impostata
  const { schema, avvisi } = elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true } });
  const t = schema.find((g) => g.giorno === G).turni.find((x) => x.id === "M");
  suite.assert(!!t, "il turno MMG esiste comunque (nessun blocco)");
  suite.eq(t.sede, null, "sede non impostata");
  suite.assert(!t.slots.some(Boolean), "nessuna assegnazione possibile senza sede");
  suite.assert(avvisi.some((a) => a.includes("senza sede impostata")), "avviso di migrazione dedicato");
});

suite.test("copertura a distanza (FASE 2) attiva anche per gli MMG: il fisico può coprire un'altra sede", () => {
  // MMG a Maniago, il vincitore ha dichiarato anche Claut a distanza (blu). Vincolo territoriale:
  // Claut (idx3) è coperta a distanza SOLO dal fisico di Maniago (idx0) — che è proprio lui.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"], ["Claut"]);
  const t = turnoM(elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Maniago" } }));
  suite.eq(t.slots[0], BERTUZZI, "fisico a Maniago (sede attivata)");
  suite.eq(t.slots[3], BERTUZZI, "Claut coperta a distanza dallo stesso fisico (FASE 2 come un ordinario)");
});

suite.test("copertura a distanza scelta dal coordinatore (voce 53): M_blu è coperta dal vincitore anche se non l'ha dichiarata lui", () => {
  // MMG a Maniago, il coordinatore chiede copertura a distanza di Claut (raggiungibile da Maniago).
  // BERTUZZI vince Maniago pur avendo dichiarato SOLO Maniago (nessuna blu propria) → copre Claut.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  const t = turnoM(elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Maniago", M_blu: "Claut" } }));
  suite.eq(t.slots[0], BERTUZZI, "fisico a Maniago");
  suite.eq(t.slots[3], BERTUZZI, "Claut coperta a distanza per scelta del coordinatore (M_blu), pur non dichiarata dal medico");
});

suite.test("M_blu rispetta i vincoli territoriali: Claut NON coperta se la sede fisica non è Maniago", () => {
  // MMG a Meduno + M_blu Claut: Claut è raggiungibile a distanza SOLO da Maniago → resta scoperta.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Meduno"]);
  const t = turnoM(elab(d, { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true, M_sede: "Meduno", M_blu: "Claut" } }));
  suite.eq(t.slots[2], BERTUZZI, "fisico a Meduno");
  suite.eq(t.slots[3], null, "Claut non coperta: vincolo territoriale (solo da Maniago) rispettato come per gli ordinari");
});

suite.finish();

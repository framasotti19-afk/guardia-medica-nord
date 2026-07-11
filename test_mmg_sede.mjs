// Test dei turni MMG (§10 voce 55): dopo la reversione, un turno MMG (M/P) è attivato SOLO come
// esistenza dal coordinatore (checkbox), e per il resto compete ESATTAMENTE come un turno ordinario —
// la sede e la copertura a distanza le decide il MOTORE in base alle disponibilità dei medici (verde/
// blu nel tab 1), non il coordinatore. Struttura di sedi identica a un notturno: Maniago/Spilimbergo/
// Meduno fisiche, Claut/Anduins solo a distanza. Le uniche differenze legittime restano: ore 6 e il
// fatto che esiste solo se attivato. I turni MMG vinti restano PUNTI FISSI protetti in §3.11 (extra:true).
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_mmg — MMG competono come i turni ordinari (sede dalla dispo)");
setMediciGlobal(MEDICI_DEFAULT);

// SEDI5 = [Maniago(0), Spilimbergo(1), Meduno(2), Claut(3), Anduins(4)]
const BERTUZZI = 9;   // INDET (priorità massima)
const PRESSACCO = 10; // SENZA incarico (priorità minima)
const G = GIORNI_FERIALI_SEMPLICI[0]; // un feriale: solo N di ordinario, ma l'MMG M è attivabile
const Mk = `${dk(ANNO_TEST, MESE_TEST, G)}|M`;
const attivaM = { [dk(ANNO_TEST, MESE_TEST, G)]: { M: true } }; // solo la checkbox, nessuna sede
const turnoM = ({ schema }) => schema.find((g) => g.giorno === G).turni.find((t) => t.id === "M");
const elab = (d, extras, cap) => elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras, {}, cap || {});

suite.test("la sede la decide la DISPO del medico, non il coordinatore (niente più hardcode Maniago)", () => {
  // BERTUZZI (unico disponibile) dichiara SOLO Spilimbergo per l'MMG → vince Spilimbergo, non Maniago.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Spilimbergo"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[1], BERTUZZI, "Spilimbergo (idx1) va a BERTUZZI: la sede viene dalla sua disponibilità");
  suite.eq(t.slots[0], null, "Maniago non è forzata (nessun hardcode)");
});

suite.test("sede contesa: a parità vince il più forte in gerarchia (come un ordinario)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Mk] = turnoDisp(["Maniago"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[0], BERTUZZI, "Maniago va all'INDET, non al senza incarico");
});

suite.test("copertura a distanza dalla BLU del medico (non da un campo del coordinatore)", () => {
  // BERTUZZI fisico a Maniago + Claut dichiarata blu nella SUA dispo → copre Claut a distanza (FASE 2),
  // con gli stessi vincoli territoriali degli ordinari (Claut coperibile solo da Maniago).
  const d = dispoBase(MEDICI);
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"], ["Claut"]);
  const t = turnoM(elab(d, attivaM));
  suite.eq(t.slots[0], BERTUZZI, "fisico a Maniago");
  suite.eq(t.slots[3], BERTUZZI, "Claut coperta a distanza dalla blu dichiarata dal medico");
});

suite.test("nessun disponibile → MMG interamente scoperto", () => {
  const d = dispoBase(MEDICI); // nessuno dichiara nulla per l'MMG
  const { schema } = elab(d, attivaM);
  const t = schema.find((g) => g.giorno === G).turni.find((x) => x.id === "M");
  suite.assert(!t.slots.some(Boolean), "nessuna sede assegnata");
});

suite.test("l'MMG vinto consuma il tetto ed è un punto fisso §3.11 (extra:true, non ceduto)", () => {
  // BERTUZZI tutte le notti a Maniago + MMG mattina il giorno G, tetto 4. L'MMG conta come 1 turno e
  // resta assegnato (non ceduto): 1 MMG + 3 notturni distribuiti.
  const d = dispoBase(MEDICI);
  const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
  for (let g = 1; g <= 31; g++) { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); }
  d[BERTUZZI][Mk] = turnoDisp(["Maniago"]);
  const { schema } = elab(d, attivaM, { [BERTUZZI]: 4 });
  const mmg = schema.find((g) => g.giorno === G).turni.find((t) => t.id === "M").slots[0];
  const notti = schema.filter((g) => g.turni.find((t) => t.id === "N" && t.slots.includes(BERTUZZI))).map((g) => g.giorno);
  suite.eq(mmg, BERTUZZI, "l'MMG resta assegnato a BERTUZZI (punto fisso, non ceduto)");
  suite.eq(notti.length + 1, 4, "l'MMG consuma un posto del tetto: 1 MMG + 3 notturni = 4");
});

suite.finish();

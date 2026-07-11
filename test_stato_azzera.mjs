// Test delle funzioni pure per 8a (statoRealeMedico) e 8b (azzeraDispoMedico): lo stato letto dai DATI
// veri e l'azzeramento atomico "correggi da capo". Sono la base affidabile del pannello/comando di
// verifica e dell'azione azzera_medico (il wiring componente è glue, queste funzioni sono il cuore).
import { statoRealeMedico, azzeraDispoMedico, espandiAmbito, costruisciEntryDispo, dk } from "./engine_test.mjs";
import { makeSuite } from "./test_utils.mjs";

const s = makeSuite("statoRealeMedico + azzeraDispoMedico (8a/8b)");
const J = (x) => JSON.stringify(x);
const A = 2026, M = 7; // agosto 2026
const key = (g, t) => `${dk(A, M, g)}|${t}`;

// Dispo di partenza: medico 5 con slot misti (verde/blu, indifferenza, NO), un tetto
// settimanale e una preferenza turno; medico 6 con uno slot (deve restare INTATTO).
const dispoBase = () => ({
  5: {
    [key(4, "N")]: { verde: ["Spilimbergo"], verdeLiv: { Spilimbergo: 1 }, blu: ["Anduins"], bluLiv: { Anduins: 2 } , no: false },
    [key(6, "N")]: { verde: ["Maniago", "Spilimbergo"], verdeLiv: { Maniago: 2, Spilimbergo: 2 }, blu: [], bluLiv: {}, no: false },
    [key(8, "N")]: { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true },
    ["SETT:2026-08-04"]: { maxTurni: 2 },
    ["TURNOPREF:" + dk(A, M, 15)]: "G",
    ["OBBL:" + key(4, "N")]: true,
    ["OBBL:" + key(6, "N")]: "Spilimbergo",
  },
  6: { [key(10, "N")]: { verde: ["Meduno"], verdeLiv: { Meduno: 1 }, blu: [], bluLiv: {}, no: false } },
});

// --- 8a: statoRealeMedico legge esattamente i dati ---
s.test("statoRealeMedico: disponibilità, tetto mensile, tetti settimanali, preferenze turno", () => {
  const st = statoRealeMedico(5, dispoBase(), { 5: 8 });
  s.eq(st.tettoMese, 8, "tetto mensile");
  s.eq(J(st.disponibilita), J([
    { giorno: 4, turno: "N", no: false, verde: [{ sede: "Spilimbergo", liv: 1 }], blu: [{ sede: "Anduins", liv: 2 }] },
    { giorno: 6, turno: "N", no: false, verde: [{ sede: "Maniago", liv: 2 }, { sede: "Spilimbergo", liv: 2 }], blu: [] },
    { giorno: 8, turno: "N", no: true, verde: [], blu: [] },
  ]), "disponibilità strutturate diverse dall'atteso");
  s.eq(J(st.tettiSettimanali), J([{ settimana: "2026-08-04", max: 2 }]), "tetti settimanali");
  s.eq(J(st.preferenzeTurno), J([{ giorno: 15, turno: "G" }]), "preferenze turno");
  s.eq(J(st.slotObbligatori), J([{ giorno: 4, turno: "N", sede: null }, { giorno: 6, turno: "N", sede: "Spilimbergo" }]), "slot obbligatori (§10 voce 49): pin libero (sede null) e pin sede (⚓ Spilimbergo), la chiave OBBL: non inquina la disponibilità");
});
s.test("statoRealeMedico: medico senza dati → tutto vuoto, tetto null", () => {
  const st = statoRealeMedico(99, dispoBase(), { 5: 8 });
  s.eq(J(st), J({ tettoMese: null, disponibilita: [], tettiSettimanali: [], finestreSettimanali: [], preferenzeTurno: [], slotObbligatori: [] }), "medico vuoto non è tutto-vuoto");
});
s.test("statoRealeMedico è read-only: non muta la dispo", () => {
  const d = dispoBase(), snap = J(d);
  statoRealeMedico(5, d, { 5: 8 });
  s.eq(J(d), snap, "statoRealeMedico ha mutato la dispo");
});

// --- 8b: azzeraDispoMedico cancella tutto per il medico, lascia intatti gli altri ---
s.test("azzeraDispoMedico: dispo[mid] svuotata di TUTTO (slot + SETT + TURNOPREF)", () => {
  const out = azzeraDispoMedico(dispoBase(), 5);
  s.eq(Object.keys(out[5]).length, 0, "restano chiavi dopo l'azzeramento (residui)");
});
s.test("azzeraDispoMedico: gli ALTRI medici restano intatti", () => {
  const base = dispoBase(), out = azzeraDispoMedico(base, 5);
  s.eq(J(out[6]), J(base[6]), "il medico 6 è stato toccato dall'azzeramento del 5");
});
s.test("azzeraDispoMedico è puro: non muta la dispo originale", () => {
  const d = dispoBase(), snap = J(d);
  azzeraDispoMedico(d, 5);
  s.eq(J(d), snap, "azzeraDispoMedico ha mutato l'originale");
});

// --- Scenario "correggi da capo" (caso Iengo): azzera + reinserisci → SOLO i nuovi, zero residui ---
s.test("azzera + reinserisci: nessun residuo dei giorni vecchi", () => {
  // 1) azzera il medico 5 (che aveva g4/g6/g8 + SETT + TURNOPREF)
  let dispo = azzeraDispoMedico(dispoBase(), 5);
  // 2) reinserisci "da martedì a giovedì la notte a Spilimbergo" (come farebbe applicaAzioni: espandi + entry)
  const a = { sedi: ["Spilimbergo"] };
  const { entry } = costruisciEntryDispo(a, "IENGO");
  const slots = espandiAmbito({ giorni_settimana: { da: "mar", a: "gio" } }, ["N"], [], A, M, {});
  const nd = {};
  slots.forEach(({ giorno, turno }) => { nd[key(giorno, turno)] = { verde: [...entry.verde], verdeLiv: { ...entry.verdeLiv }, blu: [...entry.blu], bluLiv: { ...entry.bluLiv }, no: false }; });
  dispo = { ...dispo, 5: nd };
  // 3) verifica: dispo[5] contiene ESATTAMENTE i nuovi slot (mar/mer/gio notte), nessun residuo.
  // Nota: g4=martedì e g6=giovedì di agosto rientrano LEGITTIMAMENTE nel nuovo insieme mar→gio, quindi
  // riappaiono (sono nuovi slot, non residui); il residuo vero sarebbe g8 (sabato, fuori da mar-gio) o
  // le chiavi SETT:/TURNOPREF:, che devono sparire.
  const chiavi = Object.keys(dispo[5]);
  const atteso = slots.map(({ giorno, turno }) => key(giorno, turno)).sort();
  s.eq(J([...chiavi].sort()), J(atteso), "dispo[5] non coincide ESATTAMENTE coi nuovi slot (residuo o mancante)");
  s.assert(!chiavi.includes(key(8, "N")), "sopravvive g8 (sabato, fuori da mar-gio): residuo!");
  s.assert(!chiavi.some((k) => k.startsWith("SETT:") || k.startsWith("TURNOPREF:")), "sopravvive un tetto settimanale/preferenza turno vecchio");
});

s.finish();

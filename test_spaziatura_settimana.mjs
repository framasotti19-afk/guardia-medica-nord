// Test sulla regola di spaziatura temporale (CONTEXT.md §3.7) e sul tetto settimanale
// dichiarabile dal medico (CONTEXT.md §3.8).
//
// Spaziatura: tra i turni disponibili di un medico, il motore preferisce sempre quello più
// distante dall'ultimo turno fisico già assegnato. Non decide MAI chi vince un conflitto (tra
// eventuali alternativi decide sempre la gerarchia normale) e non lascia MAI una sede scoperta
// per questo motivo: se non esiste un'alternativa valida, il medico più recente resta dov'è.
//
// Tetto settimanale: il medico dichiara dispo[mid]["SETT:" + lunedì] = { maxTurni: N }. Una volta
// raggiunto il tetto quella settimana, il motore non lo considera più candidato — le sedi che
// sarebbero state sue restano scoperte (nessuna copertura automatica di ripiego).
import { MEDICI, dk, elaboraSchema, settimanaDi, giorniTra } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_spaziatura_settimana — spaziatura temporale e tetto settimanale");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const BERTUZZI = 1, CAMPANER = 2, TRIGODKO = 3, GHIZZO = 5, FOSCHIANI = 8, WANG = 12;

function unicoTurno(dispo, giorno, extraOre = {}) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}
function schemaCompleto(dispo, extraOre = {}) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
}
const settKey = (g) => "SETT:" + settimanaDi(dk(ANNO_TEST, MESE_TEST, g));

// Coppie di giorni feriali semplici di agosto 2026 usate nei test:
// 3,4,5,6,7 sono consecutivi e nella stessa settimana (lunedì 2026-08-03);
// 10,11,12,13 sono consecutivi e nella settimana successiva (lunedì 2026-08-10).
const G3 = 3, G4 = 4, G5 = 5, G6 = 6, G10 = 10;

// ---------------------------------------------------------------------------
// giorniTra / settimanaDi — helper di base
// ---------------------------------------------------------------------------
suite.test("giorniTra calcola la differenza in giorni con segno", () => {
  suite.eq(giorniTra(dk(ANNO_TEST, MESE_TEST, G3), dk(ANNO_TEST, MESE_TEST, G5)), 2);
  suite.eq(giorniTra(dk(ANNO_TEST, MESE_TEST, G5), dk(ANNO_TEST, MESE_TEST, G3)), -2);
});
suite.test("settimanaDi raggruppa i giorni della stessa settimana (lun-dom) sotto lo stesso lunedì", () => {
  suite.eq(settimanaDi(dk(ANNO_TEST, MESE_TEST, G3)), settimanaDi(dk(ANNO_TEST, MESE_TEST, G6)));
  suite.assert(settimanaDi(dk(ANNO_TEST, MESE_TEST, G3)) !== settimanaDi(dk(ANNO_TEST, MESE_TEST, G10)), "settimane diverse devono avere chiavi diverse");
});

// ---------------------------------------------------------------------------
// SPAZIATURA — copertura vince sempre se non c'è alternativa
// ---------------------------------------------------------------------------
suite.test("unico candidato su due notti consecutive: le ottiene entrambe, nessuna resta scoperta per spaziatura", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  const t1 = unicoTurno(d, G3);
  const t2 = unicoTurno(d, G4); // stesso oggetto dispo, nuova elaborazione indipendente per isolare il test
  suite.eq(t1.slots[0], BERTUZZI);
  suite.eq(t2.slots[0], BERTUZZI, "senza alternativa, la spaziatura non lascia mai la sede scoperta");
});

// ---------------------------------------------------------------------------
// SPAZIATURA — con un'alternativa valida, il vincitore di ieri cede il posto oggi
// ---------------------------------------------------------------------------
suite.test("con un'alternativa valida, il medico che ha lavorato ieri cede la sede oggi", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]); // unico candidato il giorno 3: vince a mani basse
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G4)] = turnoDisp(["Maniago"]); // alternativa valida, stessa sede, il giorno 4
  // CAMPANER quasi a debito esaurito: senza la regola di spaziatura, BERTUZZI vincerebbe comunque
  // il giorno 4 per debito residuo maggiore (96-12=84 contro 6) — isola l'effetto della spaziatura.
  const { schema } = schemaCompleto(d, { [CAMPANER]: -90 });
  const t1 = schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N");
  const t2 = schema.find((g) => g.giorno === G4).turni.find((t) => t.id === "N");
  suite.eq(t1.slots[0], BERTUZZI, "giorno 3: BERTUZZI unico candidato");
  suite.eq(t2.slots[0], CAMPANER, "giorno 4: BERTUZZI ha lavorato ieri, CAMPANER (alternativa valida) prende il suo posto");
});

suite.test("senza alternativa valida per QUELLA sede specifica, il medico recente resta anche se un altro medico è presente altrove", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G4)] = turnoDisp(["Spilimbergo"]); // presente, ma su un'ALTRA sede: non è un'alternativa per Maniago
  const { schema } = schemaCompleto(d);
  const t2 = schema.find((g) => g.giorno === G4).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], BERTUZZI, "CAMPANER non ha dichiarato Maniago: non è un'alternativa valida per quella sede");
  suite.eq(t2.slots[1], CAMPANER, "CAMPANER ottiene comunque la sua sede, Spilimbergo");
});

suite.test("distanza superiore a 1 giorno: nessun intervento della spaziatura, vince la gerarchia normale", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G5)] = turnoDisp(["Maniago"]); // giorno 5, distanza 2 dal giorno 3
  d[CAMPANER][N(G5)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d, { [CAMPANER]: -90 });
  const t2 = schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], BERTUZZI, "distanza 2 è già sufficiente: nessuna spaziatura forzata, decide solo il debito residuo");
});

suite.test("tra più alternative, a decidere chi subentra è SEMPRE la gerarchia normale, non un ordine arbitrario", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]); // unico il giorno 3
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  d[GHIZZO][N(G4)] = turnoDisp(["Maniago"]);   // DET36 grad91
  d[TRIGODKO][N(G4)] = turnoDisp(["Maniago"]); // DET36 grad4, priorità migliore di GHIZZO
  const { schema } = schemaCompleto(d);
  const t2 = schema.find((g) => g.giorno === G4).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], TRIGODKO, "tra le alternative disponibili, subentra quella con priorità migliore in gerarchia (TRIGODKO, non GHIZZO)");
});

suite.test("la spaziatura considera la data di calendario reale, non l'ordine di elaborazione interno (conPref/resto)", () => {
  // WANG ha un preferito il giorno 4 (elaborato PRIMA in ordine cronologico, fase conPref) e vince
  // sempre (unico candidato). FOSCHIANI ha un debito enorme e vince il giorno 3 (resto, elaborato
  // dopo). I due giorni sono comunque consecutivi in calendario: se la spaziatura calcolasse la
  // distanza sbagliando il segno per via del riordino, potrebbe interferire qui erroneamente — ma
  // WANG e FOSCHIANI sono medici DIVERSI, quindi la spaziatura (per-medico) non deve mai attivarsi.
  const d = dispoBase(MEDICI);
  d[WANG][N(G4)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  d[FOSCHIANI][N(G3)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d);
  const t3 = schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N");
  const t4 = schema.find((g) => g.giorno === G4).turni.find((t) => t.id === "N");
  suite.eq(t4.slots[0], WANG);
  suite.eq(t3.slots[0], FOSCHIANI, "medici diversi: nessuna interferenza di spaziatura tra loro");
});

// ---------------------------------------------------------------------------
// TETTO SETTIMANALE
// ---------------------------------------------------------------------------
suite.test("nessun tetto dichiarato: nessun limite, comportamento invariato", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G3)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G5)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d);
  suite.eq(schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N").slots[0], FOSCHIANI);
  suite.eq(schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "N").slots[0], FOSCHIANI);
});

suite.test("tetto settimanale raggiunto: il medico non è più candidato, la sede resta scoperta se non c'è alternativa", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G3)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G5)] = turnoDisp(["Maniago"]); // stessa settimana di G3, giorni non consecutivi
  d[FOSCHIANI][settKey(G3)] = { maxTurni: 1 };
  const { schema } = schemaCompleto(d);
  suite.eq(schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N").slots[0], FOSCHIANI, "primo turno della settimana: tetto non ancora raggiunto");
  const t2 = schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], null, "secondo turno della stessa settimana: tetto raggiunto, nessuna copertura automatica di ripiego");
});

suite.test("tetto settimanale raggiunto: se esiste un altro candidato, la sede va a lui normalmente", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G3)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G5)] = turnoDisp(["Maniago"]);
  d[WANG][N(G5)] = turnoDisp(["Maniago"]); // alternativa per il secondo turno
  d[FOSCHIANI][settKey(G3)] = { maxTurni: 1 };
  const { schema } = schemaCompleto(d);
  const t2 = schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], WANG, "FOSCHIANI escluso dal tetto: la sede va normalmente a WANG");
});

suite.test("il tetto si azzera alla settimana successiva", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G3)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G10)] = turnoDisp(["Maniago"]); // settimana successiva
  d[FOSCHIANI][settKey(G3)] = { maxTurni: 1 };
  const { schema } = schemaCompleto(d);
  suite.eq(schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N").slots[0], FOSCHIANI);
  suite.eq(schema.find((g) => g.giorno === G10).turni.find((t) => t.id === "N").slots[0], FOSCHIANI, "settimana diversa: il tetto della settimana precedente non si applica");
});

suite.test("il tetto conta anche i turni EXTRA (MMG)", () => {
  const extras = { [dk(ANNO_TEST, MESE_TEST, G3)]: { M: true }, [dk(ANNO_TEST, MESE_TEST, G5)]: { M: true } };
  const M3 = `${dk(ANNO_TEST, MESE_TEST, G3)}|M`, M5 = `${dk(ANNO_TEST, MESE_TEST, G5)}|M`;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][M3] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][M5] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][settKey(G3)] = { maxTurni: 1 };
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);
  const t3 = schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "M");
  const t5 = schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "M");
  suite.eq(t3.slots[0], FOSCHIANI, "primo turno extra della settimana: tetto non ancora raggiunto");
  suite.eq(t5.slots[0], null, "secondo turno extra della stessa settimana: tetto raggiunto anche per gli extra");
});

suite.finish();

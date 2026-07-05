// Test sul tetto settimanale dichiarabile dal medico (CONTEXT.md §3.8), più un residuo di test
// storici su `giorniTra`/`settimanaDi` (utility di date generiche, ancora usate da §3.8) e sulla
// regola di spaziatura temporale (CONTEXT.md §3.7) — RIMOSSA (vedi CONTEXT.md §10): un medico che
// vince un turno per gerarchia lo mantiene sempre, anche se ha lavorato il giorno prima o vince
// anche l'altro turno dello stesso giorno. I test §3.7 originali che dimostravano la cessione
// automatica sono stati rimossi (il comportamento che testavano non esiste più); quelli tuttora
// validi ("nessuna alternativa → copertura vince comunque", "alternativa su un'altra sede non
// conta") sono rimasti, dato che il loro esito non cambia.
//
// Tetto settimanale: il medico dichiara dispo[mid]["SETT:" + lunedì] = { maxTurni: N }. Una volta
// raggiunto il tetto quella settimana, il motore non lo considera più candidato — le sedi che
// sarebbero state sue restano scoperte (nessuna copertura automatica di ripiego).
import { MEDICI, dk, elaboraSchema, settimanaDi, giorniTra } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_spaziatura_settimana — tetto settimanale (§3.7 rimossa, vedi intro)");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const BERTUZZI = 1, CAMPANER = 2, FOSCHIANI = 8, WANG = 12;

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
// §3.7 RIMOSSA: chi vince un turno per gerarchia lo mantiene sempre, anche a giorni consecutivi
// ---------------------------------------------------------------------------
suite.test("unico candidato su due notti consecutive: le ottiene entrambe (nessuna alternativa comunque presente)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  const t1 = unicoTurno(d, G3);
  const t2 = unicoTurno(d, G4); // stesso oggetto dispo, nuova elaborazione indipendente per isolare il test
  suite.eq(t1.slots[0], BERTUZZI);
  suite.eq(t2.slots[0], BERTUZZI, "nessuna alternativa presente: la sede è comunque sua");
});

suite.test("anche con un'alternativa valida disponibile, il medico che ha lavorato ieri MANTIENE la sede oggi (§3.7 rimossa)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]); // unico candidato il giorno 3: vince a mani basse
  d[BERTUZZI][N(G4)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G4)] = turnoDisp(["Maniago"]); // alternativa valida, stessa sede, il giorno 4 — ma non entra più in gioco
  // +12h di recupero a BERTUZZI: compensa esattamente le 12h consumate vincendo il giorno 3, così
  // il giorno 4 il debito residuo è di nuovo pari a CAMPANER (mai lavorato) — isola l'effetto da
  // testare (nessuna cessione per "aver lavorato ieri") dal normale auto-bilanciamento del debito
  // (§3.4, che altrimenti farebbe vincere CAMPANER il giorno 4 per debito residuo maggiore: un
  // meccanismo diverso e preesistente, non la spaziatura rimossa qui).
  const { schema } = schemaCompleto(d, { [BERTUZZI]: 12 });
  const t1 = schema.find((g) => g.giorno === G3).turni.find((t) => t.id === "N");
  const t2 = schema.find((g) => g.giorno === G4).turni.find((t) => t.id === "N");
  suite.eq(t1.slots[0], BERTUZZI, "giorno 3: BERTUZZI unico candidato");
  suite.eq(t2.slots[0], BERTUZZI, "giorno 4: BERTUZZI ha vinto per gerarchia (categoria/debito) anche ieri, quindi se lo tiene — nessuna cessione automatica per aver lavorato il giorno prima");
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

suite.test("giorni consecutivi, ma la gerarchia (non un'euristica di distanza) decide comunque tutto normalmente", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G3)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][N(G5)] = turnoDisp(["Maniago"]); // giorno 5, distanza 2 dal giorno 3
  d[CAMPANER][N(G5)] = turnoDisp(["Maniago"]);
  const { schema } = schemaCompleto(d, { [CAMPANER]: -90 });
  const t2 = schema.find((g) => g.giorno === G5).turni.find((t) => t.id === "N");
  suite.eq(t2.slots[0], BERTUZZI, "decide solo il debito residuo, nessuna euristica di distanza in gioco");
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

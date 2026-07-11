// Test del VINCOLO DI FINESTRA SETTIMANALE (§10 voce 57): dispo[mid]["SETTWK:"+lunedì] = N è un MINIMO
// di turni voluti in quella settimana ISO (lun-dom). Diverso da SETT: (massimo) e da OBBL: (slot preciso):
// il coordinatore dà solo il numero, il motore sceglie i N migliori turni vinti per gerarchia in quella
// settimana (livello ↑, poi cronologico), li àncora come punti fissi §3.11 e distribuisce il resto attorno.
// Se ne vince < N → tiene tutti quelli vinti e AVVISA. Il tetto mensile resta RIGIDO (nodo ②a): se i minimi
// non entrano nel tetto, il tetto vince e Part B avvisa. Verifica esplicita delle settimane TRONCATE ai
// bordi del mese (conta SOLO i giorni in-mese, mai quelli del mese precedente).
import { MEDICI_DEFAULT, dk, elaboraSchema, settimanaDi, statoRealeMedico, azzeraDispoMedico } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const s = makeSuite("test_finestra_settimanale — vincolo di finestra settimanale (min turni)");
// Agosto 2026 inizia di SABATO: prima settimana ISO in-mese = [1,2] (weekend), ultima = [31] (feriale).
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const wk = (g) => settimanaDi(dk(ANNO_TEST, MESE_TEST, g));
const BERTUZZI = 9, PRESSACCO = 10;

const elab = (dispo, maxTurniMese = {}) => elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, {}, {}, maxTurniMese);
const vinceN = (schema, g) => schema.find((x) => x.giorno === g)?.turni.find((t) => t.id === "N")?.slots[0];
const nottiInSettimana = (schema, mid, gg) => gg.filter((g) => vinceN(schema, g) === mid).length;
const nottiTotali = (schema, mid, gg) => gg.filter((g) => vinceN(schema, g) === mid).length;

// Settimane feriali (solo N) di agosto 2026 usate nei test:
const W1016 = [10, 11, 12, 13];   // settimana del 10 (lun-dom): feriali 10-13
const W1723 = [17, 18, 19, 20, 21]; // settimana del 17
const TUTTE = [3, 4, 5, 6, 7, 10, 11, 12, 13, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31];

s.test("bias: min 3 nella settimana del 10 → il medico tiene ≥3 turni in quella settimana (entro il tetto), distribuiti", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  TUTTE.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["SETTWK:" + wk(10)] = 3;
  const { schema } = elab(d, { [BERTUZZI]: 4 }); // tetto 4: 3 nella settimana vincolata + 1 altrove
  s.eq(nottiTotali(schema, BERTUZZI, TUTTE), 4, "BERTUZZI tiene esattamente 4 notti (tetto rigido)");
  s.assert(nottiInSettimana(schema, BERTUZZI, W1016) >= 3, `almeno 3 notti nella settimana del 10 (osservate ${nottiInSettimana(schema, BERTUZZI, W1016)})`);
});

s.test("bias: senza vincolo le notti NON si concentrano in una sola settimana (controprova del bias)", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  TUTTE.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]); });
  const { schema } = elab(d, { [BERTUZZI]: 4 }); // nessun SETTWK
  s.assert(nottiInSettimana(schema, BERTUZZI, W1016) < 3, "senza vincolo, < 3 notti nella settimana del 10 (distribuite sul mese)");
});

s.test("vinti < N → tiene tutti quelli vinti e genera un avviso", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  // BERTUZZI disponibile solo su 2 notti della settimana del 10 (10, 11) + altrove; min 3 → impossibile.
  [10, 11, 3, 17, 24].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["SETTWK:" + wk(10)] = 3;
  const { schema, avvisi } = elab(d, { [BERTUZZI]: 8 });
  s.eq(nottiInSettimana(schema, BERTUZZI, W1016), 2, "tiene entrambe le notti vinte (10 e 11)");
  s.assert(avvisi.some((a) => a.includes("BERTUZZI") && a.includes("almeno 3") && a.includes("solo 2")), `avviso 'vinti solo 2 < 3' presente (avvisi=${JSON.stringify(avvisi)})`);
});

s.test("conflitto col tetto mensile: il tetto resta RIGIDO e viene emesso l'avviso (motivo: tetto)", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  // BERTUZZI vince 5 notti nella settimana del 17, min 4, ma tetto mensile = 2 → ne tiene solo 2.
  W1723.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["SETTWK:" + wk(17)] = 4;
  const { schema, avvisi } = elab(d, { [BERTUZZI]: 2 });
  s.eq(nottiTotali(schema, BERTUZZI, W1723), 2, "il tetto mensile (2) non viene mai superato");
  s.assert(avvisi.some((a) => a.includes("BERTUZZI") && a.includes("tetto mensile")), `avviso con motivo 'tetto mensile' presente (avvisi=${JSON.stringify(avvisi)})`);
});

s.test("finestra + OBBL nella stessa settimana: l'OBBL conta verso il minimo (nessun doppio conteggio)", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  W1016.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["OBBL:" + N(10)] = true;      // pin esplicito sul 10
  d[BERTUZZI]["SETTWK:" + wk(10)] = 2;       // min 2: l'OBBL(10) copre 1, se ne forza solo 1 in più
  const { schema } = elab(d, { [BERTUZZI]: 2 }); // tetto 2 = esattamente OBBL(10) + 1: se l'OBBL fosse ignorato, forzerebbe 2 nuovi (=3>2) e cederebbe qualcosa
  s.eq(vinceN(schema, 10), BERTUZZI, "il turno OBBL del 10 è tenuto");
  s.eq(nottiInSettimana(schema, BERTUZZI, W1016), 2, "esattamente 2 notti nella settimana (OBBL + 1), tetto pieno senza doppio conteggio");
});

s.test("settimana TRONCATA a inizio mese (agosto parte di sabato → in-mese solo 1,2): conta SOLO i giorni del mese", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  // Solo 2 notti in-mese in quella settimana (1 e 2); min 3 → impossibile con i soli giorni di agosto.
  [1, 2].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["SETTWK:" + wk(1)] = 3;
  s.eq(wk(1), "2026-07-27", "la prima settimana ISO ha lunedì il 27 luglio (a cavallo)");
  const { schema, avvisi } = elab(d, { [BERTUZZI]: 8 });
  // Se il motore contasse i giorni di luglio (27-31), min 3 sembrerebbe soddisfabile e NON avviserebbe.
  s.eq([1, 2].filter((g) => vinceN(schema, g) === BERTUZZI).length, 2, "tiene le 2 notti di agosto disponibili");
  s.assert(avvisi.some((a) => a.includes("BERTUZZI") && a.includes("solo 2")), `avviso 'solo 2' → ha contato solo i giorni in-mese, non luglio (avvisi=${JSON.stringify(avvisi)})`);
});

s.test("settimana TRONCATA a fine mese (ultima settimana in-mese = solo il 31): min > turni possibili → avviso", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  d[BERTUZZI][N(31)] = turnoDisp(["Maniago"]); // solo il 31 (lun feriale, unica notte in-mese di quella settimana)
  d[BERTUZZI]["SETTWK:" + wk(31)] = 2;
  s.eq(wk(31), "2026-08-31", "l'ultima settimana ha lunedì il 31 agosto");
  const { schema, avvisi } = elab(d, { [BERTUZZI]: 8 });
  s.eq(vinceN(schema, 31), BERTUZZI, "tiene l'unica notte in-mese (31)");
  s.assert(avvisi.some((a) => a.includes("BERTUZZI") && a.includes("solo 1")), `avviso 'solo 1 < 2' presente (avvisi=${JSON.stringify(avvisi)})`);
});

s.test("settimana troncata con min ≤ turni possibili: nessun avviso, vincolo soddisfatto sui soli giorni in-mese", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  [1, 2].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI]["SETTWK:" + wk(1)] = 2; // esattamente i 2 giorni in-mese disponibili
  const { schema, avvisi } = elab(d, { [BERTUZZI]: 8 });
  s.eq([1, 2].filter((g) => vinceN(schema, g) === BERTUZZI).length, 2, "tiene entrambe le notti in-mese");
  s.assert(!avvisi.some((a) => a.includes("BERTUZZI") && a.includes("voleva almeno")), "nessun avviso finestra (vincolo soddisfatto)");
});

s.test("chiave normalizzata al LUNEDÌ: giorni diversi della stessa settimana → stessa chiave", () => {
  s.eq(wk(10), wk(12), "il 10 e il 12 (stessa settimana) danno la stessa chiave (lunedì)");
  s.assert(wk(10) !== wk(17), "settimane diverse → chiavi diverse");
});

s.test("statoRealeMedico riporta le finestre settimanali; azzeraDispoMedico le cancella", () => {
  const d = dispoBase(MEDICI_DEFAULT);
  d[BERTUZZI][N(10)] = turnoDisp(["Maniago"]);
  d[BERTUZZI]["SETTWK:" + wk(10)] = 3;
  const st = statoRealeMedico(BERTUZZI, d, {});
  s.eq(JSON.stringify(st.finestreSettimanali), JSON.stringify([{ settimana: wk(10), min: 3 }]), "finestreSettimanali riportata dallo stato reale");
  const d2 = azzeraDispoMedico(d, BERTUZZI);
  s.eq(Object.keys(d2[BERTUZZI]).length, 0, "azzera cancella tutte le chiavi del medico, SETTWK inclusa");
});

s.finish();

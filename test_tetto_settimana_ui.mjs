// Test della LOGICA del campo "Max turni a settimana" (tab Medici): l'enumerazione delle settimane ISO
// che toccano il mese deve includere le settimane TRONCATE ai bordi (era il buco di De Candido), e le
// chiavi SETT: scritte devono essere lette dal motore via capSettimanale. Il wiring UI è glue; qui si
// verifica la logica pura (settimanaDi/capSettimanale sono funzioni del motore). NON tocca elaboraSchema.
import { settimanaDi, capSettimanale, dk } from "./engine_test.mjs";
import { makeSuite } from "./test_utils.mjs";

const s = makeSuite("Tetto settimanale UI — enumerazione settimane del mese (bordi inclusi)");
const J = (x) => JSON.stringify(x);

// Replica dell'enumerazione fatta dal componente (settimaneDelMese): distinta di settimanaDi su tutti i
// giorni del mese → tutti i lunedì-ISO delle settimane che contengono almeno un giorno del mese.
const settimaneDelMese = (anno, mese) => {
  const nG = new Date(anno, mese + 1, 0).getDate();
  const set = new Set();
  for (let g = 1; g <= nG; g++) set.add(settimanaDi(dk(anno, mese, g)));
  return [...set];
};

s.test("agosto 2026: include le settimane troncate ai bordi (27 lug e 31 ago), niente buchi", () => {
  const wks = settimaneDelMese(2026, 7);
  s.eq(J(wks), J(["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]), "settimane di agosto 2026 diverse dall'atteso");
  s.assert(wks.includes("2026-07-27"), "manca la settimana del 27 lug (copre 1-2 ago) — buco di bordo");
  s.assert(wks.includes("2026-08-31"), "manca la settimana del 31 ago (sfora a settembre) — buco di bordo");
  // ogni lunedì consecutivo è a 7 giorni dal precedente: nessun buco
  for (let i = 1; i < wks.length; i++) {
    const g = (new Date(wks[i] + "T00:00:00") - new Date(wks[i - 1] + "T00:00:00")) / 86400000;
    s.eq(g, 7, `salto diverso da 7 giorni tra ${wks[i - 1]} e ${wks[i]}`);
  }
});
s.test("il 1° e l'ultimo giorno del mese cadono davvero nelle settimane di bordo enumerate", () => {
  const wks = settimaneDelMese(2026, 7);
  s.assert(wks.includes(settimanaDi(dk(2026, 7, 1))), "la settimana del giorno 1 non è tra quelle enumerate");
  s.assert(wks.includes(settimanaDi(dk(2026, 7, 31))), "la settimana dell'ultimo giorno non è tra quelle enumerate");
});
s.test("scrittura in blocco: capSettimanale legge N su tutte le settimane del mese, null fuori", () => {
  const N = 2, mid = 7;
  const nd = {};
  settimaneDelMese(2026, 7).forEach((wk) => { nd["SETT:" + wk] = { maxTurni: N }; });
  const dispo = { [mid]: nd };
  // il motore trova il tetto per ogni settimana del mese (incluse le troncate)
  for (const wk of settimaneDelMese(2026, 7)) s.eq(capSettimanale(dispo, mid, wk), N, `cap non letto per la settimana ${wk}`);
  // una settimana che NON tocca agosto (es. metà settembre) non ha tetto
  s.eq(capSettimanale(dispo, mid, settimanaDi(dk(2026, 8, 15))), null, "tetto trovato per una settimana fuori dal mese");
});
s.test("campo vuoto = rimozione: nessuna chiave SETT: residua", () => {
  const mid = 7;
  const nd = {};
  settimaneDelMese(2026, 7).forEach((wk) => { nd["SETT:" + wk] = { maxTurni: 3 }; });
  // simula lo svuotamento del campo: rimuovi tutte le SETT:
  Object.keys(nd).forEach((k) => { if (k.startsWith("SETT:")) delete nd[k]; });
  s.eq(Object.keys(nd).filter((k) => k.startsWith("SETT:")).length, 0, "restano chiavi SETT: dopo lo svuotamento");
  s.eq(capSettimanale({ [mid]: nd }, mid, "2026-08-03"), null, "cap ancora presente dopo lo svuotamento");
});
s.test("febbraio 2026 (mese corto): settimane coerenti e bordi inclusi", () => {
  const wks = settimaneDelMese(2026, 1); // febbraio (0-based 1)
  s.assert(wks.includes(settimanaDi(dk(2026, 1, 1))), "manca la settimana del 1 feb");
  s.assert(wks.includes(settimanaDi(dk(2026, 1, 28))), "manca la settimana del 28 feb");
  for (let i = 1; i < wks.length; i++) {
    const g = (new Date(wks[i] + "T00:00:00") - new Date(wks[i - 1] + "T00:00:00")) / 86400000;
    s.eq(g, 7, "salto diverso da 7 giorni");
  }
});

s.finish();

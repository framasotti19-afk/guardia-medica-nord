// Test sulla distribuzione temporale reale (CONTEXT.md §3.11, punto 2): quando un contrattualizzato
// NON titolare ha diritto a N turni ma dispone di MOLTI più giorni disponibili di quanti gliene
// servano, il motore preferisce assegnarglieli il più possibile distanziati nel mese invece dei
// primi N cronologicamente. Il meccanismo (calcolaRiservati + bucket a 3 livelli in
// candidatiOrdinati/elaboraTurno) NON deve mai lasciare un buco di copertura, MAI intaccare la
// titolarità di sede, e restare compatibile con la spaziatura settimanale/di turno preesistenti.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_distribuzione_temporale — turni distanziati nel mese invece dei primi N");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// INDET: BERTUZZI grad0 (96h monte ore = 8 notti)
const BERTUZZI = 1;
// SENZA: ZURLO grad2, GRANDO grad13 (pool di riserva, priorità piena su ogni giorno non riservato)
const ZURLO = 13, GRANDO = 14;

function tutteLeNotti(anno, mese, verdeDiMedico) {
  const d = dispoBase(MEDICI);
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  for (let g = 1; g <= nGiorni; g++) {
    Object.entries(verdeDiMedico).forEach(([mid, sedi]) => { d[Number(mid)][`${dk(anno, mese, g)}|N`] = turnoDisp(sedi); });
  }
  return d;
}
function vincitoriNotte(schema, mid) {
  const notti = [];
  schema.forEach((g) => g.turni.forEach((t) => { if (t.id === "N" && t.slots.includes(mid)) notti.push(g.giorno); }));
  return notti;
}
suite.test("scarsità genuina su un'unica sede: BERTUZZI vince ESATTAMENTE le notti previste dalla formula di spaziatura uniforme, non le prime 8 consecutive", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [ZURLO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "BERTUZZI vince esattamente le 8 notti previste dal suo monte ore (96h/12h)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "distribuzione uniforme sull'intero mese (formula §3.11), non i primi 8 giorni consecutivi");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "nessuna notte resta scoperta: ZURLO copre tutte le notti non riservate a BERTUZZI");
});

suite.test("più siti disponibili (nessuna scarsità artificiale): la distribuzione resta uniforme e la copertura resta sempre completa su 2 sedi", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, {
    [BERTUZZI]: ["Maniago", "Spilimbergo"], [ZURLO]: ["Maniago", "Spilimbergo"], [GRANDO]: ["Maniago", "Spilimbergo"],
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "stesso identico pattern uniforme anche con più concorrenti e più sedi disponibili");
  let scoperte = 0;
  schema.forEach((g) => g.turni.forEach((t) => { if (t.id === "N" && t.slots.filter((s) => s).length < 2) scoperte++; }));
  suite.eq(scoperte, 0, "entrambe le sedi (Maniago e Spilimbergo) restano sempre coperte ogni notte del mese");
});

suite.test("un titolare di sede NON è mai soggetto alla distribuzione: consuma il proprio monte ore nei primi giorni consecutivi, non distanziati, esattamente come senza questo meccanismo", () => {
  // DET36 titolare Maniago: 156h di monte ore = 13 notti. Se la distribuzione lo riguardasse,
  // le sue 13 notti sarebbero distanziate su tutto il mese (come BERTUZZI non titolare qui sopra);
  // essendo titolare, riservatiPerMedico è null per lui (calcolaRiservati esce subito) e quindi
  // vince semplicemente i primi 13 giorni CONSECUTIVI in cui è disponibile, poi il monte ore si
  // esaurisce e il blocco rigido preesistente (§3.4) lo esclude — comportamento identico a prima
  // dell'introduzione della distribuzione temporale.
  const lista = MEDICI_DEFAULT.map((m) => (m.id === BERTUZZI ? { ...m, cat: "DET36", sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [ZURLO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), "il titolare vince i primi 13 giorni CONSECUTIVI (156h/12h), mai distanziati: la titolarità esenta dalla distribuzione");
  const notteZurlo14 = schema.find((g) => g.giorno === 14).turni.find((t) => t.id === "N");
  suite.eq(notteZurlo14.slots[0], ZURLO, "esaurito il monte ore del titolare (blocco rigido preesistente §3.4), la sede passa al senza incarico dal giorno 14 in poi");
  setMediciGlobal(MEDICI_DEFAULT);
});

suite.test("con un solo candidato disponibile e nessun backup, la distribuzione non cambia il comportamento preesistente: si consuma il monte ore nei primi giorni e il resto resta scoperto (blocco rigido §3.4, non un difetto di questo meccanismo)", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"] }); // nessun backup dichiarato
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), "unico candidato: consuma le 8 notti del monte ore nei primi giorni consecutivi (la demozione a bucket 2 non ha effetto senza un'alternativa con cui competere)");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 31 - 8, "dal giorno 9 in poi la notte resta scoperta (blocco rigido oltre il monte ore, §3.4, preesistente e invariato): non è una regressione introdotta dalla distribuzione temporale");
});

suite.test("Max turni mese più restrittivo del monte ore dimensiona anche il numero di giorni riservati (i due meccanismi sono collegati by design)", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [ZURLO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 3, "con un tetto mensile di 3, BERTUZZI vince solo 3 notti nell'intero mese (non le 8 del monte ore)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 16, 31]), "le 3 notti concesse dal tetto sono distanziate sull'intero mese (formula uniforme dimensionata sul tetto, non sul monte ore)");
});

suite.test("un contrattualizzato con debito ordinario esattamente pari ai giorni disponibili non viene mai demosso (nTarget >= k, nessuna restrizione reale)", () => {
  // Solo 5 giorni disponibili per BERTUZZI, ben sotto le 8 notti del suo monte ore:
  // calcolaRiservati riserva TUTTI i giorni disponibili (comportamento pre-esistente invariato).
  const d = dispoBase(MEDICI);
  [3, 10, 17, 24, 31].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[ZURLO][N(g)] = turnoDisp(["Maniago"]); });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 5, "BERTUZZI vince tutti e 5 i giorni in cui è disponibile: nessuna demozione quando i giorni disponibili non superano il diritto");
});

suite.finish();

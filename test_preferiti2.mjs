// Test su preferiti e ordine di elaborazione (CONTEXT.md §3.4, §3.5).
// Il flag "preferito" NON decide mai chi vince un conflitto: serve solo a far
// elaborare quel turno per primo (fase conPref), e genera avvisi post-elaborazione
// quando l'esito non corrisponde al desiderio del medico.
//
// Nota sul modello verde/blu: la copertura a distanza richiede SEMPRE una presenza
// fisica altrove nello stesso turno (INV3). Un medico che non ottiene alcuna sede
// verde non può quindi mai coprire nulla a distanza — "preferito" e "preferitoRip"
// sono perciò entrambi soddisfatti se e solo se il medico ottiene una sede FISICA
// (qualunque livello verde, non necessariamente la sua prima scelta). La distinzione
// tra i due resta solo nel testo dell'avviso quando il medico finisce escluso.
import { MEDICI, byId, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_preferiti2 — preferiti e ordine di elaborazione");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const BERTUZZI = 1, FOSCHIANI = 8, WANG = 12, TRIGODKO = 3, PRESSACCO = 4;

function elabora(dispo, extraOre = {}) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
}
// Isola gli eventuali avvisi "SCOPERTE" (copertura fisica/blu mancante, ortogonali ai preferiti)
// da quelli sui preferiti (marcati con ★), per non far dipendere questi test dal fatto che con
// pochi medici presenti ci siano quasi sempre sedi scoperte.
const avvisiPreferiti = (avvisi) => avvisi.filter((a) => a.includes("★"));

suite.test("il preferito NON decide chi vince: l'esito è identico con o senza il flag", () => {
  const senza = dispoBase(MEDICI);
  senza[TRIGODKO][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  senza[PRESSACCO][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  const { schema: s1 } = elabora(senza);

  const conPref = dispoBase(MEDICI);
  conPref[TRIGODKO][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  conPref[PRESSACCO][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"], [], { preferito: true }); // PRESSACCO vuole questo turno
  const { schema: s2 } = elabora(conPref);

  const t1 = s1.find((g) => g.giorno === GIORNI_FERIALI_SEMPLICI[0]).turni.find((t) => t.id === "N");
  const t2 = s2.find((g) => g.giorno === GIORNI_FERIALI_SEMPLICI[0]).turni.find((t) => t.id === "N");
  suite.eq(t1.slots[0], TRIGODKO);
  suite.eq(t2.slots[0], TRIGODKO, "il preferito di PRESSACCO non deve fargli vincere il conflitto: la gerarchia resta l'unico criterio");
});

suite.test("turno con preferito viene elaborato PRIMA (debito ancora pieno) rispetto a un turno cronologicamente precedente senza preferito", () => {
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(g1)] = turnoDisp(["Maniago"]);
  d[WANG][N(g1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(g2)] = turnoDisp(["Maniago"]);
  d[WANG][N(g2)] = turnoDisp(["Maniago"], [], { preferito: true });
  const { schema } = elabora(d);
  const tG2 = schema.find((g) => g.giorno === g2).turni.find((t) => t.id === "N");
  const tG1 = schema.find((g) => g.giorno === g1).turni.find((t) => t.id === "N");
  suite.eq(tG2.slots[0], FOSCHIANI, "a pari debito iniziale vince sempre il grad migliore, anche sul turno preferito da WANG");
  suite.eq(tG1.slots[0], WANG, "elaborato dopo: WANG ha più debito residuo perché FOSCHIANI ha già vinto il turno preferito");
});

suite.test("esempio §3.4: 5 turni pari debito, A(grad migliore) vs B → 3-2 anche quando B ha un preferito in mezzo", () => {
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  const d = dispoBase(MEDICI);
  giorni.forEach((g) => {
    d[FOSCHIANI][N(g)] = turnoDisp(["Maniago"]);
    d[WANG][N(g)] = turnoDisp(["Maniago"]);
  });
  d[WANG][N(giorni[2])] = turnoDisp(["Maniago"], [], { preferito: true });
  const { schema } = elabora(d);
  const vincite = { [FOSCHIANI]: 0, [WANG]: 0 };
  giorni.forEach((g) => vincite[schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]]++);
  suite.eq(vincite[FOSCHIANI] + vincite[WANG], 5);
  suite.assert(vincite[FOSCHIANI] >= 2, "il risultato deve restare vicino al 3-2 strutturale, il preferito non altera la gerarchia");
});

suite.test("preferito ottenuto (sede verde qualunque, top choice) → nessun avviso generato", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"], [], { preferito: true }); // unico candidato, ottiene sicuramente la sede
  const { avvisi } = elabora(d);
  suite.eq(avvisiPreferiti(avvisi).length, 0);
});

suite.test("preferito soddisfatto anche da una sede verde di livello peggiore (non la prima scelta)", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  // BERTUZZI vince sempre Maniago: WANG lo vuole come preferito ma non ha priorità;
  // dichiara però ANCHE Spilimbergo come seconda scelta verde e la ottiene.
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago", "Spilimbergo"], [], { preferito: true, verdeLiv: { Maniago: 1, Spilimbergo: 2 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.eq(t.slots[1], WANG, "WANG deve comunque ottenere Spilimbergo, la sua seconda scelta");
  suite.eq(avvisiPreferiti(avvisi).length, 0, "una sede fisica qualunque soddisfa il preferito, non serve sia la prima scelta");
});

suite.test("preferito su verde, escluso dal turno (nessuna alternativa) → avviso di mancata assegnazione", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago"], [], { preferito: true }); // nessuna alternativa: se perde, resta fuori
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(WANG), "WANG deve restare fuori dal turno");
  // con WANG escluso, Spilimbergo resta scoperta (n=2 candidati, nessuno la dichiara) → 2 avvisi.
  suite.eq(avvisi.length, 2);
  const avvisoPref = avvisi.find((a) => a.includes("WANG") && a.includes("★"));
  suite.assert(!!avvisoPref && avvisoPref.includes("non gli è stato assegnato"), "l'avviso preferiti deve segnalare la mancata assegnazione");
});

suite.test("preferitoRip soddisfatto allo stesso modo di preferito: qualunque sede verde va bene", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago", "Spilimbergo"], [], { preferito: true, preferitoRip: true, verdeLiv: { Maniago: 1, Spilimbergo: 2 } });
  const { avvisi } = elabora(d);
  suite.eq(avvisiPreferiti(avvisi).length, 0);
});

suite.test("preferitoRip escluso completamente dal turno → avviso \"a tutti i costi\"", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(g)] = turnoDisp(["Maniago"], [], { preferito: true, preferitoRip: true }); // nessuna alternativa: se perde, fuori
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(TRIGODKO));
  // anche qui: Spilimbergo resta scoperta (n=2 candidati, uno escluso) → 2 avvisi.
  suite.eq(avvisi.length, 2);
  const avvisoPref = avvisi.find((a) => a.includes("a tutti i costi"));
  suite.assert(!!avvisoPref, "l'avviso deve usare la formula \"a tutti i costi\" per preferitoRip non soddisfatto");
});

suite.test("dichiarare blu non basta a soddisfare il preferito se non si ottiene alcuna sede fisica", () => {
  // la copertura a distanza richiede sempre una presenza fisica altrove (INV3): se WANG non
  // ottiene alcuna sede verde, il suo blu dichiarato non può mai attivarsi, quindi resta escluso
  // e genera comunque l'avviso di mancata assegnazione, anche con preferitoRip.
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago"], ["Spilimbergo"], { preferito: true, preferitoRip: true, bluLiv: { Spilimbergo: 1 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(WANG), "WANG non può coprire Spilimbergo a distanza senza essere fisico da qualche parte");
  const avvisoPref = avvisi.find((a) => a.includes("WANG") && a.includes("a tutti i costi"));
  suite.assert(!!avvisoPref, "deve comunque generare l'avviso di mancata assegnazione");
});

suite.test("un preferito su una cella con NO esplicito non genera né priorità né avvisi", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp([], [], { no: true, preferito: true });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(t.slots.every((s) => s === null), "il medico con NO non deve essere candidato nonostante il flag preferito");
  suite.eq(avvisi.length, 0, "nessun avviso preferiti deve essere generato per una cella con NO esplicito");
});

suite.test("turno EXTRA con preferito non assegnato genera un avviso specifico per l'extra", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const extras = { [dk(ANNO_TEST, MESE_TEST, g)]: { M: true } };
  const M = `${dk(ANNO_TEST, MESE_TEST, g)}|M`;
  const d = dispoBase(MEDICI);
  d[BERTUZZI][M] = turnoDisp(["Maniago"]); // vince sempre (INDET)
  d[WANG][M] = turnoDisp(["Maniago"], [], { preferito: true }); // perde, turno extra a slot singolo
  const { avvisi } = elaboraSchemaExtras(d, extras);
  suite.eq(avvisi.length, 1);
  suite.assert(avvisi[0].includes("WANG") && avvisi[0].includes("preferito"), "l'avviso deve riguardare il turno extra");
});
function elaboraSchemaExtras(dispo, extras) { return elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, extras); }

suite.test("più medici con preferito sullo stesso turno: l'ordine tra turni conPref resta cronologico", () => {
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(g1)] = turnoDisp(["Maniago"], [], { preferito: true });
  d[WANG][N(g1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(g2)] = turnoDisp(["Maniago"]);
  d[WANG][N(g2)] = turnoDisp(["Maniago"], [], { preferito: true });
  const { schema } = elabora(d);
  const tG1 = schema.find((x) => x.giorno === g1).turni.find((x) => x.id === "N");
  const tG2 = schema.find((x) => x.giorno === g2).turni.find((x) => x.id === "N");
  suite.eq(tG1.slots[0], FOSCHIANI, "a pari debito iniziale, g1 (primo in ordine cronologico tra i conPref) vince FOSCHIANI per grad");
  suite.eq(tG2.slots[0], WANG, "elaborato dopo: WANG ha più debito residuo avendo perso g1, e vince g2");
});

suite.test("nessun preferito dichiarato nel mese → nessun avviso relativo ai preferiti, nessuna eccezione", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  const { avvisi } = elabora(d);
  suite.eq(avvisiPreferiti(avvisi).length, 0);
});

suite.test("avvisi ordinati cronologicamente per giorno", () => {
  const [g1, g2, g3] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g3)] = turnoDisp(["Maniago"]);
  d[WANG][N(g3)] = turnoDisp(["Maniago"], [], { preferito: true });
  d[BERTUZZI][N(g1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(g1)] = turnoDisp(["Maniago"], [], { preferito: true });
  d[BERTUZZI][N(g2)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(g2)] = turnoDisp(["Maniago"], [], { preferito: true });
  const { avvisi } = elabora(d);
  suite.eq(avvisi.length, 6);
  const giorniInOrdineAvvisi = avvisi.map((a) => Number(a.match(/Giorno (\d+)/)[1]));
  const atteso = [g1, g1, g2, g2, g3, g3];
  suite.assert(JSON.stringify(giorniInOrdineAvvisi) === JSON.stringify(atteso), `attesa sequenza giorni ${atteso}, ottenuta ${giorniInOrdineAvvisi}`);
});

suite.finish();

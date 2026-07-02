// Test su preferiti e ordine di elaborazione (CONTEXT.md §3.4, §3.5).
// Il flag "preferito" NON decide mai chi vince un conflitto: serve solo a far
// elaborare quel turno per primo (fase conPref), e genera avvisi post-elaborazione
// quando l'esito non corrisponde al desiderio del medico.
import { MEDICI, byId, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_preferiti2 — preferiti e ordine di elaborazione");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const BERTUZZI = 1, FOSCHIANI = 8, WANG = 12, TRIGODKO = 3, PRESSACCO = 4;

function elabora(dispo, extraOre = {}) {
  return elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
}

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
  // FOSCHIANI (DET24 grad3) e WANG (DET24 grad124) in conflitto su due giorni:
  // giorno G1 (senza preferiti, cronologicamente prima) e giorno G2 (con preferito di WANG).
  // Se l'ordine fosse puramente cronologico, G1 verrebbe deciso per primo a pari debito (vince FOSCHIANI, grad migliore),
  // e WANG avrebbe più debito residuo per G2 (vince comunque per debito). Col meccanismo conPref,
  // G2 (con preferito) viene deciso PRIMA a pari debito iniziale: vince ugualmente FOSCHIANI (grad migliore) —
  // la differenza si vede nel debito finale, non nel vincitore (che resta sempre la gerarchia).
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(g1)] = turnoDisp(["Maniago"]);
  d[WANG][N(g1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(g2)] = turnoDisp(["Maniago"]);
  d[WANG][N(g2)] = turnoDisp(["Maniago"], [], { preferito: true });
  const { schema } = elabora(d);
  const tG2 = schema.find((g) => g.giorno === g2).turni.find((t) => t.id === "N");
  const tG1 = schema.find((g) => g.giorno === g1).turni.find((t) => t.id === "N");
  // g2 (preferito) è elaborato per primo a pari debito → vince FOSCHIANI (grad migliore)
  suite.eq(tG2.slots[0], FOSCHIANI, "a pari debito iniziale vince sempre il grad migliore, anche sul turno preferito da WANG");
  // g1 è elaborato dopo: FOSCHIANI ha già consumato debito su g2, quindi su g1 WANG ora ha più debito residuo e vince
  suite.eq(tG1.slots[0], WANG, "elaborato dopo: WANG ha più debito residuo perché FOSCHIANI ha già vinto il turno preferito");
});

suite.test("esempio §3.4: 5 turni pari debito, A(grad migliore) vs B → 3-2 anche quando B ha un preferito in mezzo", () => {
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  const d = dispoBase(MEDICI);
  giorni.forEach((g) => {
    d[FOSCHIANI][N(g)] = turnoDisp(["Maniago"]);
    d[WANG][N(g)] = turnoDisp(["Maniago"]);
  });
  d[WANG][N(giorni[2])] = turnoDisp(["Maniago"], [], { preferito: true }); // WANG preferisce il 3° giorno
  const { schema } = elabora(d);
  const vincite = { [FOSCHIANI]: 0, [WANG]: 0 };
  giorni.forEach((g) => vincite[schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]]++);
  suite.eq(vincite[FOSCHIANI] + vincite[WANG], 5);
  suite.assert(vincite[FOSCHIANI] >= 2, "il risultato deve restare vicino al 3-2 strutturale, il preferito non altera la gerarchia");
});

suite.test("preferito SOLO su piena, ottenuta → nessun avviso generato", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"], [], { preferito: true }); // unico candidato, ottiene sicuramente la piena
  const { avvisi } = elabora(d);
  suite.eq(avvisi.length, 0);
});

suite.test("preferito SOLO su piena, ma finito in ripiego → avviso con la sede ottenuta e quella desiderata", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  // BERTUZZI (IND36) vince sempre Maniago: WANG lo vuole come preferito ma non ha priorità, deve accontentarsi del ripiego
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago"], ["Spilimbergo"], { preferito: true, ripiegoLiv: { Spilimbergo: 1 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.eq(t.slots[1], WANG, "WANG deve comunque ottenere il ripiego (Spilimbergo)");
  suite.eq(avvisi.length, 1);
  suite.assert(avvisi[0].includes("WANG") && avvisi[0].includes("ripiego") && avvisi[0].includes("scambio"), "l'avviso deve segnalare il declassamento a ripiego");
});

suite.test("preferito SOLO su piena, escluso dal turno → avviso di mancata assegnazione (oltre a quello di copertura scoperta)", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago"], [], { preferito: true }); // nessun ripiego dichiarato: se perde, resta fuori
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(WANG), "WANG deve restare fuori dal turno");
  // con WANG escluso, Spilimbergo resta fisicamente scoperta (scenario a 2 medici): genera
  // sia l'avviso di copertura mancante sia quello di preferito non soddisfatto.
  suite.eq(avvisi.length, 2);
  const avvisoPref = avvisi.find((a) => a.includes("WANG") && a.includes("★"));
  suite.assert(!!avvisoPref && avvisoPref.includes("non gli è stato assegnato"), "l'avviso preferiti deve segnalare la mancata assegnazione");
});

suite.test("preferitoRip (\"a tutti i costi\") soddisfatto anche dal ripiego → nessun avviso", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[WANG][N(g)] = turnoDisp(["Maniago"], ["Spilimbergo"], { preferito: true, preferitoRip: true, ripiegoLiv: { Spilimbergo: 1 } });
  const { avvisi } = elabora(d);
  suite.eq(avvisi.length, 0, "preferitoRip è soddisfatto sia dalla piena sia dal ripiego: nessun avviso se ottiene il ripiego");
});

suite.test("preferitoRip escluso completamente dal turno → avviso \"a tutti i costi\"", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(g)] = turnoDisp(["Maniago"], [], { preferito: true, preferitoRip: true }); // nessun ripiego: se perde, fuori
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(TRIGODKO));
  // anche qui: Spilimbergo resta scoperta (n=2 candidati, uno escluso) → 2 avvisi.
  suite.eq(avvisi.length, 2);
  const avvisoPref = avvisi.find((a) => a.includes("a tutti i costi"));
  suite.assert(!!avvisoPref, "l'avviso deve usare la formula \"a tutti i costi\" per preferitoRip non soddisfatto");
});

suite.test("un preferito su una cella con NO esplicito non genera né priorità né avvisi (normDispo forza preferito=false lato UI, ma qui verifichiamo che v.no esclude comunque dal conteggio preferiti)", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  // preferito=true insieme a no=true: la cella non deve produrre né candidatura né avviso "preferito"
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
  d[BERTUZZI][M] = turnoDisp(["Maniago"]); // vince sempre (IND36)
  d[WANG][M] = turnoDisp(["Maniago"], [], { preferito: true }); // perde, turno extra a slot singolo
  const { avvisi } = elaboraSchemaExtras(d, extras);
  suite.eq(avvisi.length, 1);
  suite.assert(avvisi[0].includes("WANG") && avvisi[0].includes("preferito"), "l'avviso deve riguardare il turno extra");
});
function elaboraSchemaExtras(dispo, extras) { return elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, extras); }

suite.test("più medici con preferito sullo stesso turno: l'ordine tra turni conPref resta cronologico", () => {
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  // entrambi i giorni hanno un preferito: devono restare processati in ordine g1 poi g2 (cronologico) fra i "conPref"
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
  suite.eq(avvisi.length, 0);
});

suite.test("avvisi ordinati cronologicamente per giorno", () => {
  const [g1, g2, g3] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  // 3 medici con preferito perdente su 3 giorni in ordine sparso di dichiarazione
  d[BERTUZZI][N(g3)] = turnoDisp(["Maniago"]);
  d[WANG][N(g3)] = turnoDisp(["Maniago"], [], { preferito: true });
  d[BERTUZZI][N(g1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(g1)] = turnoDisp(["Maniago"], [], { preferito: true });
  d[BERTUZZI][N(g2)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(g2)] = turnoDisp(["Maniago"], [], { preferito: true });
  const { avvisi } = elabora(d);
  // ogni giorno genera 2 avvisi (copertura scoperta + preferito non soddisfatto): 6 in totale,
  // ma devono comunque risultare raggruppati e ordinati per giorno crescente.
  suite.eq(avvisi.length, 6);
  const giorniInOrdineAvvisi = avvisi.map((a) => Number(a.match(/Giorno (\d+)/)[1]));
  const atteso = [g1, g1, g2, g2, g3, g3];
  suite.assert(JSON.stringify(giorniInOrdineAvvisi) === JSON.stringify(atteso), `attesa sequenza giorni ${atteso}, ottenuta ${giorniInOrdineAvvisi}`);
});

suite.test("preferitoRip che ottiene la piena (non il ripiego) → nessun avviso", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"], [], { preferito: true, preferitoRip: true }); // unico candidato, ottiene la piena
  const { avvisi } = elabora(d);
  suite.eq(avvisi.length, 0, "preferitoRip soddisfatto dalla piena non deve generare alcun avviso");
});

suite.finish();

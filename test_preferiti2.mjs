// Test su preferiti e ordine di elaborazione (CONTEXT.md §3.4, §3.5).
// Il flag ★ "preferito" si attacca a una SEDE VERDE SPECIFICA (non alla giornata generica):
// il medico dichiara "voglio questo turno preferibilmente su questa sede". Soddisfatto se e
// solo se ottiene fisicamente ESATTAMENTE quella sede; se ottiene una sede fisica diversa, o
// nessuna sede, genera un avviso al coordinatore. In nessun caso decide chi vince un conflitto:
// serve solo a far elaborare quel turno per primo (fase conPref) e a generare avvisi post-hoc.
//
// BERTUZZI (INDET, titolare Spilimbergo) è il protagonista che "vince sempre" su Maniago per pura
// categoria (nessuno degli oppositori, tutti titolari di Spilimbergo, è titolare di Maniago) — la
// sua graduatoria (666, deliberatamente pessima nei dati reali) non conta qui: la categoria
// (prio 1, la migliore) decide prima del grad contro qualunque altro contrattualizzato.
import { MEDICI, byId, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_preferiti2 — preferiti e ordine di elaborazione");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const BERTUZZI = 14; // INDET, titolare Spilimbergo
const TRIGODKO = 3; // DET24, titolare Maniago, grad4
const MARTINETTI = 4; // DET24, titolare Spilimbergo, grad5
const PRESSACCO = 8; // DET24, titolare Spilimbergo, grad57
const CERVESATO = 9; // DET36, titolare Spilimbergo, grad63
const DE_CANDIDO = 11; // DET24, titolare Spilimbergo, grad83

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
  senza[MARTINETTI][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  const { schema: s1 } = elabora(senza);

  const conPref = dispoBase(MEDICI);
  conPref[TRIGODKO][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  conPref[MARTINETTI][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // MARTINETTI vuole questo turno su Maniago
  const { schema: s2 } = elabora(conPref);

  const t1 = s1.find((g) => g.giorno === GIORNI_FERIALI_SEMPLICI[0]).turni.find((t) => t.id === "N");
  const t2 = s2.find((g) => g.giorno === GIORNI_FERIALI_SEMPLICI[0]).turni.find((t) => t.id === "N");
  suite.eq(t1.slots[0], TRIGODKO);
  suite.eq(t2.slots[0], TRIGODKO, "il preferito di MARTINETTI non deve fargli vincere il conflitto: la gerarchia resta l'unico criterio");
});

suite.test("turno con preferito viene elaborato PRIMA (debito ancora pieno) rispetto a un turno cronologicamente precedente senza preferito", () => {
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(g1)] = turnoDisp(["Maniago"]);
  d[DE_CANDIDO][N(g1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g2)] = turnoDisp(["Maniago"]);
  d[DE_CANDIDO][N(g2)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  const { schema } = elabora(d);
  const tG2 = schema.find((g) => g.giorno === g2).turni.find((t) => t.id === "N");
  const tG1 = schema.find((g) => g.giorno === g1).turni.find((t) => t.id === "N");
  suite.eq(tG2.slots[0], PRESSACCO, "a pari debito iniziale vince sempre il grad migliore, anche sul turno preferito da DE CANDIDO");
  suite.eq(tG1.slots[0], DE_CANDIDO, "elaborato dopo: DE CANDIDO ha più debito residuo perché PRESSACCO ha già vinto il turno preferito");
});

suite.test("esempio §3.4: 5 turni pari debito, A(grad migliore) vs B → 3-2 anche quando B ha un preferito in mezzo", () => {
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  const d = dispoBase(MEDICI);
  giorni.forEach((g) => {
    d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]);
    d[DE_CANDIDO][N(g)] = turnoDisp(["Maniago"]);
  });
  d[DE_CANDIDO][N(giorni[2])] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  const { schema } = elabora(d);
  const vincite = { [PRESSACCO]: 0, [DE_CANDIDO]: 0 };
  giorni.forEach((g) => vincite[schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]]++);
  suite.eq(vincite[PRESSACCO] + vincite[DE_CANDIDO], 5);
  suite.assert(vincite[PRESSACCO] >= 2, "il risultato deve restare vicino al 3-2 strutturale, il preferito non altera la gerarchia");
});

suite.test("preferito sulla sede effettivamente ottenuta (unico candidato) → nessun avviso generato", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // unico candidato, ottiene sicuramente quella sede
  const { avvisi } = elabora(d);
  suite.eq(avvisiPreferiti(avvisi).length, 0);
});

suite.test("preferito su una sede diversa da quella ottenuta → avviso, anche se il medico lavora comunque", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  // BERTUZZI vince sempre Maniago (categoria, nessuno dei due titolare lì): PRESSACCO lo
  // preferirebbe (categoria inferiore, non ha priorità), ma dichiara ANCHE Spilimbergo come
  // seconda scelta verde e la ottiene (titolare lì) — sede diversa da quella marcata con ★, quindi
  // il preferito NON è soddisfatto anche se PRESSACCO lavora comunque.
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"], [], { preferito: "Maniago", verdeLiv: { Maniago: 1, Spilimbergo: 2 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.eq(t.slots[1], PRESSACCO, "PRESSACCO ottiene comunque Spilimbergo, la sua seconda scelta (ed è titolare lì)");
  const avvisoPref = avvisi.find((a) => a.includes("PRESSACCO") && a.includes("★"));
  suite.assert(!!avvisoPref, "il preferito su Maniago non è soddisfatto: PRESSACCO ha ottenuto Spilimbergo, non la sede preferita");
  suite.assert(avvisoPref.includes("ha ottenuto Spilimbergo"), "l'avviso deve indicare quale sede è stata effettivamente ottenuta");
});

suite.test("preferito sulla sede esatta ottenuta, pur non essendo la prima scelta verde → nessun avviso", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  // PRESSACCO preferisce Spilimbergo (la sua SECONDA scelta verde) e la ottiene: soddisfatto,
  // perché il preferito è legato alla sede specifica marcata, non alla priorità dei livelli verdi.
  d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"], [], { preferito: "Spilimbergo", verdeLiv: { Maniago: 1, Spilimbergo: 2 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.eq(t.slots[1], PRESSACCO);
  suite.eq(avvisiPreferiti(avvisi).length, 0, "PRESSACCO ha ottenuto esattamente la sede marcata con ★, anche se non è il suo livello verde migliore");
});

suite.test("preferito su verde, escluso dal turno (nessuna alternativa) → avviso di mancata assegnazione", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // nessuna alternativa: se perde, resta fuori
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(PRESSACCO), "PRESSACCO deve restare fuori dal turno");
  // con PRESSACCO escluso, Spilimbergo resta scoperta (n=2 candidati, nessuno la dichiara) → 2 avvisi.
  suite.eq(avvisi.length, 2);
  const avvisoPref = avvisi.find((a) => a.includes("PRESSACCO") && a.includes("★"));
  suite.assert(!!avvisoPref && avvisoPref.includes("non gli è stata assegnata alcuna sede"), "l'avviso preferiti deve segnalare la mancata assegnazione");
});

suite.test("dichiarare blu non basta a soddisfare il preferito se non si ottiene alcuna sede fisica", () => {
  // la copertura a distanza richiede sempre una presenza fisica altrove (INV3): se PRESSACCO non
  // ottiene alcuna sede verde, il suo blu dichiarato non può mai attivarsi, quindi resta escluso
  // e genera comunque l'avviso di mancata assegnazione.
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g)] = turnoDisp(["Maniago"], ["Spilimbergo"], { preferito: "Maniago", bluLiv: { Spilimbergo: 1 } });
  const { avvisi, schema } = elabora(d);
  const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
  suite.assert(!t.slots.includes(PRESSACCO), "PRESSACCO non può coprire Spilimbergo a distanza senza essere fisico da qualche parte");
  const avvisoPref = avvisi.find((a) => a.includes("PRESSACCO") && a.includes("non gli è stata assegnata alcuna sede"));
  suite.assert(!!avvisoPref, "deve comunque generare l'avviso di mancata assegnazione");
});

suite.test("un preferito su una cella con NO esplicito non genera né priorità né avvisi", () => {
  const g = GIORNI_FERIALI_SEMPLICI[0];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g)] = turnoDisp([], [], { no: true, preferito: "Maniago" });
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
  d[PRESSACCO][M] = turnoDisp(["Maniago"], [], { preferito: "Maniago" }); // perde, turno extra a slot singolo
  const { avvisi } = elaboraSchemaExtras(d, extras);
  suite.eq(avvisi.length, 1);
  suite.assert(avvisi[0].includes("PRESSACCO") && avvisi[0].includes("preferito"), "l'avviso deve riguardare il turno extra");
});
function elaboraSchemaExtras(dispo, extras) { return elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, extras); }

suite.test("più medici con preferito sullo stesso turno: l'ordine tra turni conPref resta cronologico", () => {
  const [g1, g2] = GIORNI_FERIALI_SEMPLICI;
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(g1)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  d[DE_CANDIDO][N(g1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g2)] = turnoDisp(["Maniago"]);
  d[DE_CANDIDO][N(g2)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  const { schema } = elabora(d);
  const tG1 = schema.find((x) => x.giorno === g1).turni.find((x) => x.id === "N");
  const tG2 = schema.find((x) => x.giorno === g2).turni.find((x) => x.id === "N");
  suite.eq(tG1.slots[0], PRESSACCO, "a pari debito iniziale, g1 (primo in ordine cronologico tra i conPref) vince PRESSACCO per grad");
  suite.eq(tG2.slots[0], DE_CANDIDO, "elaborato dopo: DE CANDIDO ha più debito residuo avendo perso g1, e vince g2");
});

suite.test("nessun preferito dichiarato nel mese → nessun avviso relativo ai preferiti, nessuna eccezione", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(GIORNI_FERIALI_SEMPLICI[0])] = turnoDisp(["Maniago"]);
  const { avvisi } = elabora(d);
  suite.eq(avvisiPreferiti(avvisi).length, 0);
});

suite.test("avvisi ordinati cronologicamente per giorno", () => {
  // Giorni volutamente NON consecutivi: scelta ereditata da quando esisteva ancora la regola di
  // spaziatura temporale (§3.7, oggi rimossa — CONTEXT.md §10), innocua qui, mantenuta per leggibilità.
  // 3 oppositori DISTINTI, tutti titolari di Spilimbergo (non Maniago), così BERTUZZI vince
  // sempre per pura categoria in tutte e 3 le giornate.
  const [g1, g2, g3] = [GIORNI_FERIALI_SEMPLICI[0], GIORNI_FERIALI_SEMPLICI[4], GIORNI_FERIALI_SEMPLICI[8]];
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(g3)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(g3)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  d[BERTUZZI][N(g1)] = turnoDisp(["Maniago"]);
  d[MARTINETTI][N(g1)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  d[BERTUZZI][N(g2)] = turnoDisp(["Maniago"]);
  d[DE_CANDIDO][N(g2)] = turnoDisp(["Maniago"], [], { preferito: "Maniago" });
  const { avvisi } = elabora(d);
  suite.eq(avvisi.length, 6);
  const giorniInOrdineAvvisi = avvisi.map((a) => Number(a.match(/Giorno (\d+)/)[1]));
  const atteso = [g1, g1, g2, g2, g3, g3];
  suite.assert(JSON.stringify(giorniInOrdineAvvisi) === JSON.stringify(atteso), `attesa sequenza giorni ${atteso}, ottenuta ${giorniInOrdineAvvisi}`);
});

suite.finish();

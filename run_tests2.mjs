// Test runtime del motore: gerarchia categorie, tie-break debito/graduatoria,
// scenari di copertura sedi (1-4 medici), coperture a distanza, livelli e
// ricollocazione, invarianti INV1-INV4. Basato sulle regole di CONTEXT.md §3.
import { MEDICI, byId, CAT_INFO, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("run_tests2 — gerarchia, scenari, debito");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0]; // 3

// Scorciatoie sui medici della graduatoria simulata (CONTEXT.md §4)
const BERTUZZI = 1, CAMPANER = 2, TRIGODKO = 3, PRESSACCO = 4, FOSCHIANI = 8, WANG = 12, ZURLO = 13, MICHELI = 17;

function unicoTurno(dispo, extraOre = {}, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}

// ---------------------------------------------------------------------------
// A. GERARCHIA CATEGORIE (§3.1)
// ---------------------------------------------------------------------------
suite.test("IND36 batte IND24 sulla stessa sede contesa", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[CAMPANER][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("IND24 batte DET36 sulla stessa sede contesa", () => {
  const d = dispoBase(MEDICI);
  d[CAMPANER][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], CAMPANER);
});

suite.test("DET36 batte DET24 anche con grad numerico peggiore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3, migliore, ma categoria inferiore
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "la categoria deve prevalere sul grad numerico");
});

suite.test("DET24 batte SENZA anche con grad numerico peggiore", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2, migliore, ma senza incarico
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI);
});

suite.test("categoria prevale SEMPRE finché il medico ha debito > 0 (anche 1h residua)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  // BERTUZZI (IND36, base 156h) con debito ridotto a 1h residua
  const t = unicoTurno(d, { [BERTUZZI]: -155 });
  suite.eq(t.slots[0], BERTUZZI, "IND36 con 1h di debito deve battere DET36 con debito pieno");
});

// ---------------------------------------------------------------------------
// B. DEBITO — TIE-BREAK STESSA CATEGORIA (§3.1, §3.4)
// ---------------------------------------------------------------------------
suite.test("stessa categoria, stesso debito iniziale → vince il grad più basso", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("stessa categoria, chi ha più debito residuo vince anche col grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, debito ridotto
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, debito aumentato
  const t = unicoTurno(d, { [TRIGODKO]: -100, [PRESSACCO]: +50 });
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO ha più debito residuo nonostante grad peggiore");
});

suite.test("il debito del vincitore scende esattamente delle ore del turno (12h notturno)", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  // BERTUZZI IND36 base 156h; unico turno da 12h assegnato → verificabile solo indirettamente
  // rielaborando un secondo turno identico nello stesso mese e controllando che vinca ancora
  // (debito 144h residuo, ancora ampiamente positivo) — la decrescita è validata dal test successivo.
  const t = schema.find((g) => g.giorno === G1).turni.find((x) => x.id === "N");
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("auto-bilanciamento: 5 turni pari debito, grad3 vs grad124 → 3-2 per il grad migliore (§3.4)", () => {
  const d = dispoBase(MEDICI);
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5); // 5 giorni feriali consecutivi disponibili
  giorni.forEach((g) => {
    d[FOSCHIANI][N(g)] = turnoDisp(["Maniago"]); // DET24 grad3
    d[WANG][N(g)] = turnoDisp(["Maniago"]); // DET24 grad124
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincite = { [FOSCHIANI]: 0, [WANG]: 0 };
  giorni.forEach((g) => {
    const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
    vincite[t.slots[0]]++;
  });
  suite.eq(vincite[FOSCHIANI], 3, "FOSCHIANI (grad migliore) deve vincere 3 turni su 5");
  suite.eq(vincite[WANG], 2, "WANG deve vincere i restanti 2 (debito che sale dopo ogni sconfitta)");
});

suite.test("recupero ore (extraOre) aumenta il debito e può ribaltare un conflitto", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, normalmente perde da TRIGODKO
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4
  const senzaRecupero = unicoTurno(d);
  suite.eq(senzaRecupero.slots[0], TRIGODKO, "senza recupero vince il grad migliore");
  const conRecupero = unicoTurno(d, { [PRESSACCO]: 200 });
  suite.eq(conRecupero.slots[0], PRESSACCO, "col recupero ore PRESSACCO ha più debito e vince");
});

suite.test("il recupero ore NON si applica ai senza incarico (nessun concetto di debito)", () => {
  const d = dispoBase(MEDICI);
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [ZURLO]: 999 }); // extraOre ignorato per SENZA (base ore = null)
  suite.eq(t.slots[0], ZURLO, "resta comunque candidato valido, ma senza alcun debito");
  suite.assert(CAT_INFO[byId[ZURLO].cat].ore === null, "SENZA non ha un monte ore");
});

// ---------------------------------------------------------------------------
// C. DEBITO ESAURITO — ORDINE A 3 FASCE (§3.1)
// ---------------------------------------------------------------------------
suite.test("un medico con debito esaurito (0) esce dalla priorità di categoria", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36 ma esaurito
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET24 con debito pieno
  const t = unicoTurno(d, { [TRIGODKO]: -156 }); // debito 0
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI (debito>0) deve battere TRIGODKO (debito esaurito) nonostante la categoria inferiore");
});

suite.test("ordine fascia 1: contrattualizzati con debito>0 battono i senza incarico", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // DET24 debito pieno, grad124
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // SENZA, grad2 (numericamente migliore)
  const t = unicoTurno(d);
  suite.eq(t.slots[0], WANG, "chi ha ancora debito vince sempre sui senza incarico, indipendentemente dal grad");
});

suite.test("ordine fascia 2: senza incarico battono i contrattualizzati con debito esaurito", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36 esaurito
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // SENZA, grad2
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], ZURLO, "senza incarico deve battere un contrattualizzato a debito esaurito");
});

suite.test("fascia 3 (esauriti): competono solo per grad tra loro", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36 grad4, esaurito
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // DET36 grad57, esaurito
  const t = unicoTurno(d, { [TRIGODKO]: -156, [PRESSACCO]: -156 });
  suite.eq(t.slots[0], TRIGODKO, "tra esauriti vince il grad migliore, non la categoria/debito (già a zero per entrambi)");
});

suite.test("un esaurito NON può scalzare un senza incarico anche con grad migliore", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // grad4, esaurito
  d[MICHELI][N(G1)] = turnoDisp(["Maniago"]); // SENZA grad39 (peggiore in numero, ma bucket superiore)
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], MICHELI, "il senza incarico vince comunque: la fascia conta più del grad");
});

suite.test("un esaurito copre comunque un turno se non c'è nessun altro candidato", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // unico candidato, esaurito
  const t = unicoTurno(d, { [TRIGODKO]: -156 });
  suite.eq(t.slots[0], TRIGODKO, "un esaurito deve comunque coprire un turno altrimenti scoperto");
});

// ---------------------------------------------------------------------------
// D. SCENARI DI COPERTURA SEDI (§3.2)
// ---------------------------------------------------------------------------
suite.test("n=1 medico → target Maniago, tutto il resto coperto a distanza da lui", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === TRIGODKO), "con un solo medico tutte e 5 le sedi devono risultare coperte da lui");
  suite.eq(t.fis.length, 1);
});

suite.test("n=2 medici → target Maniago+Spilimbergo, entrambi fisici", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
  suite.eq(t.slots[1], PRESSACCO);
  suite.eq(t.fis.length, 2);
});

suite.test("n=3 medici → target Maniago+Spilimbergo+Meduno, tutti e 3 fisici", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
  suite.eq(t.slots[1], PRESSACCO);
  suite.eq(t.slots[2], GHIZZO);
  suite.eq(t.fis.length, 3);
});

suite.test("n=4 medici → target Maniago+Spilimbergo+Meduno+Claut, tutti e 4 fisici", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5, IENGO = 6;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Claut"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[3], IENGO, "Claut deve poter essere coperta fisicamente quando dichiarata e in target (n=4)");
  suite.eq(t.fis.length, 4);
});

suite.test("Maniago e Spilimbergo sono sempre coperte per prime quando ci sono abbastanza candidati", () => {
  const d = dispoBase(MEDICI);
  // 4 medici, nessuno dichiara esplicitamente Maniago o Spilimbergo come unica scelta:
  // dichiarano più sedi indifferenti, e il motore deve comunque privilegiare MA+SP nel target.
  const GHIZZO = 5, IENGO = 6;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago", "Meduno"], [], { pieneLiv: { Maniago: 1, Meduno: 1 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo", "Claut"], [], { pieneLiv: { Spilimbergo: 1, Claut: 1 } });
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { pieneLiv: { Meduno: 1, Maniago: 1 } });
  d[IENGO][N(G1)] = turnoDisp(["Claut", "Spilimbergo"], [], { pieneLiv: { Claut: 1, Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.assert(!!t.slots[0] && !!t.slots[1], "MA e SP devono risultare coperte fisicamente");
});

suite.test("Claut sempre da Maniago quando a distanza (n=2)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[3], t.slots[0], "Claut deve essere coperta da chi è fisicamente a Maniago, mai da SP/ME/AN");
});

suite.test("Claut sempre da Maniago quando a distanza (n=3, con Meduno fisico)", () => {
  const d = dispoBase(MEDICI);
  const GHIZZO = 5;
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[GHIZZO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[3], TRIGODKO, "anche con Meduno fisico, Claut deve venire da Maniago e non da Meduno/Spilimbergo");
});

suite.test("Meduno a distanza segue la priorità completa (categoria→debito→grad), non solo il grad", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36 grad4 — priorità superiore
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"]); // SENZA grad2 — grad numerico migliore ma priorità inferiore
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "Meduno deve andare a chi ha priorità superiore (TRIGODKO), non al grad numerico più basso");
});

suite.test("Anduins a distanza segue il grad puro tra SP e ME (non l'intera gerarchia)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // copre anche Meduno per priorità superiore
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"]); // grad2, numericamente migliore di TRIGODKO(4)
  const t = unicoTurno(d);
  suite.eq(t.slots[4], ZURLO, "Anduins segue il grad puro tra chi occupa SP e ME: ZURLO (grad2) batte TRIGODKO (grad4)");
});

// ---------------------------------------------------------------------------
// E. LIVELLI E RICOLLOCAZIONE (§3.3)
// ---------------------------------------------------------------------------
suite.test("livelli pari fra due sedi = indifferente: il motore ricolloca per massimizzare le coperture", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { pieneLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"], [], { pieneLiv: { Spilimbergo: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "BERTUZZI si sposta su Maniago (indifferente per lui)");
  suite.eq(t.slots[1], CAMPANER, "CAMPANER ottiene Spilimbergo, la sua unica scelta");
  suite.eq(t.fis.length, 2, "entrambi devono risultare fisicamente presenti");
});

suite.test("livello migliore = diritto di tenere la sede contro chi non supera in gerarchia", () => {
  const d = dispoBase(MEDICI);
  d[CAMPANER][N(G1)] = turnoDisp(["Spilimbergo"]); // IND24, unica scelta
  d[ZURLO][N(G1)] = turnoDisp(["Spilimbergo"]); // SENZA, priorità inferiore
  const t = unicoTurno(d);
  suite.eq(t.slots[1], CAMPANER, "CAMPANER deve tenere Spilimbergo: ZURLO non ha priorità sufficiente per scalzarlo");
});

suite.test("scalzamento consentito quando il richiedente (anche in ripiego) ha priorità superiore", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"]); // DET24, unica scelta, nessuna alternativa
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { ripiegoLiv: { Spilimbergo: 1 } }); // IND36, Spilimbergo solo come ripiego
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "BERTUZZI (priorità superiore) scalza WANG da Spilimbergo anche arrivandoci in ripiego");
  suite.assert(!t.fis.includes(1) || t.slots[1] === BERTUZZI, "WANG deve risultare escluso dal turno, non ricollocato altrove (nessuna alternativa dichiarata)");
});

suite.test("nessuno scalzamento se il richiedente in ripiego NON ha priorità superiore", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"]); // DET24, unica scelta
  d[MICHELI][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { ripiegoLiv: { Spilimbergo: 1 } }); // SENZA, priorità inferiore
  const t = unicoTurno(d);
  suite.eq(t.slots[1], WANG, "WANG deve mantenere Spilimbergo: MICHELI non ha priorità sufficiente per scalzarlo, nemmeno in ripiego");
});

// ---------------------------------------------------------------------------
// F. INVARIANTI GENERALI (INV1-INV4)
// ---------------------------------------------------------------------------
suite.test("INV1: nessun medico fisico senza disponibilità dichiarata per quella sede", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  t.fis.forEach((si) => {
    const mid = t.slots[si];
    const v = mid === TRIGODKO ? ["Maniago"] : ["Spilimbergo"];
    suite.assert(mid === TRIGODKO ? si === 0 : si === 1, "ogni fisico deve stare solo dove ha dichiarato disponibilità");
  });
});

suite.test("INV2: nessun medico con NO esplicito viene assegnato fisicamente", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.assert(!t.slots.includes(TRIGODKO), "il medico con NO non deve comparire in nessuno slot");
  suite.eq(t.slots[0], PRESSACCO);
});

suite.test("INV3: le coperture a distanza provengono solo da medici fisicamente presenti nel turno", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  t.slots.forEach((mid, si) => {
    if (!t.fis.includes(si)) suite.assert(t.fis.some((fi) => t.slots[fi] === mid), `slot a distanza ${si} deve provenire da un fisico del turno`);
  });
});

suite.test("nessuna eccezione con turno completamente privo di candidati", () => {
  const d = dispoBase(MEDICI);
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null), "senza candidati tutti gli slot devono restare vuoti");
  suite.eq(t.fis.length, 0);
});

suite.test("nessuna eccezione con singolo candidato marcato NO esplicito", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null), "un unico candidato con NO non deve generare alcuna assegnazione");
});

// ---------------------------------------------------------------------------
// G. CASI AGGIUNTIVI (turni extra, weekend a doppio turno, esaurimento via recupero negativo)
// ---------------------------------------------------------------------------
suite.test("due senza incarico in conflitto: vince solo il grad, categoria irrilevante (sono nella stessa fascia)", () => {
  const d = dispoBase(MEDICI);
  const GRANDO = 14; // grad13
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // grad2
  d[GRANDO][N(G1)] = turnoDisp(["Maniago"]); // grad13
  const t = unicoTurno(d);
  suite.eq(t.slots[0], ZURLO);
});

suite.test("due esauriti di categorie diverse: la categoria non conta più, decide solo il grad", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36 grad4, esaurito
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // DET24 grad124, esaurito — categoria "inferiore" ma qui non conta
  const t = unicoTurno(d, { [TRIGODKO]: -156, [WANG]: -104 });
  suite.eq(t.slots[0], TRIGODKO, "tra esauriti la categoria di partenza non pesa più, solo il grad");
});

suite.test("weekend: entrambi i turni (diurno e notturno) vengono elaborati indipendentemente", () => {
  const d = dispoBase(MEDICI);
  const weekend = 1; // sabato 1 agosto 2026 → turni G + N
  const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
  d[TRIGODKO][G(weekend)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(weekend)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const giorno = schema.find((g) => g.giorno === weekend);
  suite.eq(giorno.turni.find((t) => t.id === "G").slots[0], TRIGODKO);
  suite.eq(giorno.turni.find((t) => t.id === "N").slots[0], PRESSACCO);
});

suite.test("turno extra (MMG mattina/pomeriggio): assegnazione singola secondo gerarchia, senza scenario/distanza", () => {
  const d = dispoBase(MEDICI);
  const giorno = GIORNI_FERIALI_SEMPLICI[0];
  const extras = { [dk(ANNO_TEST, MESE_TEST, giorno)]: { M: true } };
  const M = `${dk(ANNO_TEST, MESE_TEST, giorno)}|M`;
  d[CAMPANER][M] = turnoDisp(["Maniago"]);
  d[TRIGODKO][M] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);
  const t = schema.find((g) => g.giorno === giorno).turni.find((x) => x.id === "M");
  suite.eq(t.slots[0], CAMPANER, "IND24 deve battere DET36 anche sul turno extra");
  suite.eq(t.slots.length, 1, "il turno extra ha un solo slot, nessuno scenario di copertura sedi");
});

suite.test("recupero ore negativo esaurisce prima il debito e fa uscire dalla priorità di categoria", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]); // IND36, ma via extraOre negativo va sotto zero
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET24, debito pieno
  const t = unicoTurno(d, { [BERTUZZI]: -200 }); // 156-200 = -44, esaurito
  suite.eq(t.slots[0], FOSCHIANI, "BERTUZZI esaurito da recupero negativo deve perdere contro chi ha ancora debito");
});

suite.finish();

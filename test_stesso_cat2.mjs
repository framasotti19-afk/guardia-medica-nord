// Test sui conflitti fra medici della STESSA categoria (CONTEXT.md §3.1, §3.4):
// la regola del debito ("chi ha più debito residuo vince; a parità vince la
// graduatoria migliore") si applica SOLO all'interno della stessa categoria.
// Titolarità universale (§3.1a): le coppie sono scelte in modo che nessuno dei due sia titolare
// della sede contesa (o, quando serve confrontarne 3, che siano TUTTI titolari della STESSA sede,
// quindi a parità anche lì) — per isolare la regola di debito/grad senza interferenza.
// CERVESATO, PRESSACCO e DE CANDIDO sono SENZA incarico di default nella lista attuale: vengono
// resuscitati nel loro ruolo storico (DET38/DET24, titolari di Spilimbergo) con comeStorico.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI, comeStorico } from './test_utils.mjs';

const suite = makeSuite("test_stesso_cat2 — conflitti stessa categoria");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
// DET38, titolari Spilimbergo: FOSCHIANI grad3, CERVESATO grad63
const FOSCHIANI = 6, CERVESATO = 11;
// DET24, titolari Spilimbergo: MARTINETTI grad5, PRESSACCO grad57, DE CANDIDO grad83
const MARTINETTI = 7, PRESSACCO = 10, DE_CANDIDO = 12;
// DET24, titolare Maniago: TRIGODKO grad4 (per il test del blocco rigido, unico candidato)
const TRIGODKO = 2;
// SENZA (via override): PITAU grad14, MORANO grad72
const PITAU = 3, MORANO = 5;

setMediciGlobal(comeStorico(MEDICI_DEFAULT, CERVESATO, PRESSACCO, DE_CANDIDO));

function unicoTurno(dispo, extraOre = {}, giorno = G1) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}
function comeSenza(id) {
  return (m) => (m.id === id ? { ...m, cat: "SENZA", sedeContratto: null } : m);
}

suite.test("stessa categoria (DET38), nessuno titolare della sede contesa: vince il grad più basso", () => {
  const d = dispoBase(MEDICI);
  // FOSCHIANI (grad3) e CERVESATO (grad63), entrambi titolari di Spilimbergo: contesa su Maniago,
  // nessuno dei due titolare lì.
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI);
});

suite.test("stessa categoria, chi ha più debito residuo vince anche con grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3, ma debito ridotto
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]); // grad63, ma debito aumentato
  const t = unicoTurno(d, { [FOSCHIANI]: -100, [CERVESATO]: +80 });
  suite.eq(t.slots[0], CERVESATO, "CERVESATO ha più debito residuo nonostante il grad peggiore");
});

suite.test("3 medici stessa categoria, tutti titolari della STESSA sede (parità), stesso debito, target 2 sedi → vincono i due con grad migliore", () => {
  const d = dispoBase(MEDICI);
  // MARTINETTI(grad5), PRESSACCO(grad57), DE CANDIDO(grad83): tutti DET24, tutti titolari di
  // Spilimbergo — la titolarità è a parità tra loro su QUALSIASI sede contesa (nessuno ha un
  // vantaggio relativo sugli altri due), isolando puramente il confronto di grad.
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { verdeLiv: { Maniago: 1, Spilimbergo: 1 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { verdeLiv: { Maniago: 1, Spilimbergo: 1 } });
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { verdeLiv: { Maniago: 1, Spilimbergo: 1 } });
  const t = unicoTurno(d);
  const fisici = new Set(t.fis.map((si) => t.slots[si]));
  suite.assert(fisici.has(MARTINETTI) && fisici.has(PRESSACCO), "i due con grad migliore (MARTINETTI, PRESSACCO) devono risultare fisici");
  suite.assert(!fisici.has(DE_CANDIDO), "DE CANDIDO (grad peggiore) deve restare escluso quando il target ha solo 2 posti");
});

suite.test("esempio §3.4: 5 turni pari debito, grad migliore vs peggiore → risultato 3-2 per il grad migliore", () => {
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  const d = dispoBase(MEDICI);
  giorni.forEach((g) => {
    d[MARTINETTI][N(g)] = turnoDisp(["Maniago"]); // grad5, titolare Spilimbergo (non Maniago)
    d[DE_CANDIDO][N(g)] = turnoDisp(["Maniago"]); // grad83, titolare Spilimbergo (non Maniago)
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincite = { [MARTINETTI]: 0, [DE_CANDIDO]: 0 };
  giorni.forEach((g) => vincite[schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]]++);
  suite.eq(vincite[MARTINETTI], 3);
  suite.eq(vincite[DE_CANDIDO], 2);
});

suite.test("stessa categoria ma uno ha debito esaurito: vince chi ha ancora debito anche con grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]); // grad5, ma esaurito
  d[DE_CANDIDO][N(G1)] = turnoDisp(["Maniago"]); // grad83, debito pieno
  const t = unicoTurno(d, { [MARTINETTI]: -104 }); // DET24, 104h base: esaurito esatto
  suite.eq(t.slots[0], DE_CANDIDO, "il bucket (debito>0 vs esaurito) prevale sempre sul confronto di grad all'interno della stessa categoria");
});

suite.test("due senza incarico: nessun concetto di debito, decide solo il grad puro", () => {
  const lista = [comeSenza(PITAU), comeSenza(MORANO)].reduce((l, f) => l.map(f), MEDICI);
  const d = dispoBase(lista);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]); // grad72
  d[PITAU][N(G1)] = turnoDisp(["Maniago"]); // grad14
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const t = schema.find((g) => g.giorno === G1).turni.find((x) => x.id === "N");
  suite.eq(t.slots[0], PITAU);
});

suite.test("due esauriti della stessa categoria, nessuno con turni extra: blocco rigido, il turno resta SCOPERTO (nessuno viene assegnato oltre il monte ore)", () => {
  const d = dispoBase(MEDICI);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]); // grad5, esaurito
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, esaurito
  const t = unicoTurno(d, { [MARTINETTI]: -104, [PRESSACCO]: -104 }); // DET24, 104h base: esauriti esatti
  suite.eq(t.slots[0], null, "entrambi esauriti e senza turni extra: nessuno dei due è più un candidato, Maniago resta scoperta");
});

suite.test("blocco rigido oltre il monte ore: un esaurito rimasto l'UNICO disponibile per molte notti non supera mai il proprio limite (il turno resta scoperto)", () => {
  // Regressione del bug segnalato: prima del blocco rigido, un contrattualizzato esaurito rimasto
  // l'unico candidato per un intero mese continuava a essere assegnato ben oltre il proprio monte
  // ore (l'unico modo per evitare turni scoperti). Ora deve fermarsi esattamente al monte ore e
  // lasciare scoperte le notti successive, anche se nessun altro medico è mai disponibile.
  const d = dispoBase(MEDICI);
  const GIORNI = GIORNI_FERIALI_SEMPLICI; // 20 giorni feriali semplici, tutti solo TRIGODKO disponibile
  GIORNI.forEach((g) => { d[TRIGODKO][N(g)] = turnoDisp(["Maniago"]); }); // DET24, 104h monte ore = 9 notti da 12h
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincitori = GIORNI.map((g) => schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N").slots[0]);
  const notti = vincitori.filter((v) => v === TRIGODKO).length;
  suite.eq(notti, 9, "TRIGODKO (104h monte ore ÷ 12h a notte = 9 notti, arrotondato) non deve mai superare le 9 notti assegnate, anche restando l'unico disponibile per tutte le 20");
  suite.assert(vincitori.slice(9).every((v) => v === null), "dalla 10ª notte in poi (monte ore esaurito) il turno deve restare scoperto, non assegnato a TRIGODKO oltre il limite");
});

suite.test("stessa categoria, debiti uguali dopo un giro di conflitti → il grad torna a decidere", () => {
  // MARTINETTI e PRESSACCO stesso debito iniziale (104h). Dopo che MARTINETTI vince un turno,
  // il suo debito scende sotto quello di PRESSACCO: su un secondo turno indipendente
  // (stesso identico scenario) il debito NON e' condiviso fra chiamate separate a
  // elaboraSchema, quindi il grad torna a decidere in una nuova elaborazione pulita.
  const d = dispoBase(MEDICI);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t1 = unicoTurno(d);
  const t2 = unicoTurno(d); // nuova chiamata indipendente: stesso esito, a garanzia di determinismo
  suite.eq(t1.slots[0], MARTINETTI);
  suite.eq(t2.slots[0], MARTINETTI);
});

suite.finish();

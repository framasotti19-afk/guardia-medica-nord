// Test runtime del motore: gerarchia categorie (INDET/DET38/DET24/DET12ASAP/DET12/SENZA),
// titolarità di sede OBBLIGATORIA e universale tra tutti i contrattualizzati (INDET incluso,
// non solo tra determinati), tie-break debito/graduatoria, scenari di copertura verde/blu
// (1-4 medici), invarianti. Basato sulle regole di CONTEXT.md §3.
//
// MEDICI_DEFAULT (14 medici reali — vedi turni-guardia-medica.jsx): 8 titolari determinati
// + 1 INDET fuori graduatoria + 5 SENZA incarico:
// ZURLO(1,DET38,tit.Maniago) TRIGODKO(2,DET24,tit.Maniago) PITAU(3,DET24,tit.Maniago)
// BEKAEVA(4,DET24,tit.Maniago) MORANO(5,DET12,tit.Maniago) FOSCHIANI(6,DET38,tit.Spilimbergo)
// MARTINETTI(7,DET24,tit.Spilimbergo) VALERI(8,DET12ASAP,tit.Spilimbergo) BERTUZZI(9,INDET,tit.Spilimbergo)
// PRESSACCO(10,SENZA) CERVESATO(11,SENZA) DE_CANDIDO(12,SENZA) MERLINO(13,SENZA) IENGO(14,SENZA).
// PRESSACCO/CERVESATO/DE_CANDIDO/MERLINO/IENGO sono SENZA incarico di default: dove un test
// necessita di un secondo/terzo determinato oltre agli 8 nativi, vengono "resuscitati" nel loro
// ruolo storico (categoria+titolarità) con comeStorico (test_utils.mjs) — vedi costante BASE sotto.
// Dove serve invece un test double "senza incarico" generico, si usa comeSenza() per sovrascrivere
// temporaneamente la categoria di un medico esistente (stesso pattern già usato altrove).
//
// NOTA su Maniago/Spilimbergo nei test a 2 candidati: con solo 2 medici disponibili per uno slot,
// il target fisico è SEMPRE [Maniago, Spilimbergo] (§3.2/§5) — Meduno e oltre richiedono almeno 3
// candidati. Poiché OGNI contrattualizzato è titolare di Maniago O Spilimbergo, un conflitto "puro"
// di categoria/debito/grad (senza interferenza di titolarità) va costruito scegliendo due medici
// ENTRAMBI titolari della sede NON contesa (quindi nessuno dei due titolare di quella contesa).
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI, comeStorico } from './test_utils.mjs';

const suite = makeSuite("run_tests2 — gerarchia, titolarità universale, scenari, debito");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const Gd = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`; // slotKey del turno DIURNO (esiste solo nei giorni ad alta domanda)
const G1 = GIORNI_FERIALI_SEMPLICI[0]; // 3 (feriale semplice: solo notturno, niente diurno)
const SAB = 1; // 1 agosto 2026 = sabato → ha il turno diurno (dove Claut/Anduins diventano fisiche, §3.2)

// Scorciatoie sui medici reali (CONTEXT.md §4)
const ZURLO = 1, TRIGODKO = 2, PITAU = 3, BEKAEVA = 4, MORANO = 5, FOSCHIANI = 6, MARTINETTI = 7,
  VALERI = 8, BERTUZZI = 9, PRESSACCO = 10, CERVESATO = 11, DE_CANDIDO = 12, MERLINO = 13, IENGO = 14;

// Ruoli storici resuscitati per i 5 SENZA incarico di default usati in questo file come
// determinati (PRESSACCO/CERVESATO/DE_CANDIDO/IENGO — MERLINO non è usato in nessun test qui).
const BASE = comeStorico(MEDICI_DEFAULT, PRESSACCO, CERVESATO, DE_CANDIDO, MERLINO, IENGO);

function unicoTurno(dispo, extraOre = {}, giorno = G1, turniExtra = {}) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {}, turniExtra);
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "N");
}
// Come unicoTurno ma restituisce il turno DIURNO (id "G") di un giorno ad alta domanda (default:
// SAB) — dove Claut e Anduins sono sedi fisiche assegnabili (§3.2).
function unicoTurnoDiurno(dispo, giorno = SAB) {
  const { schema } = elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, {}, {});
  return schema.find((g) => g.giorno === giorno).turni.find((t) => t.id === "G");
}
function resetMedici() { setMediciGlobal(BASE); }
resetMedici();
// Sovrascrive temporaneamente un medico come senza incarico (nessun monte ore, nessuna titolarità
// — mai null per un contrattualizzato, sempre null per SENZA), preservando nome/grad.
function comeSenza(lista, id) {
  return lista.map((m) => (m.id === id ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}

// ---------------------------------------------------------------------------
// A. GERARCHIA CATEGORIE (§3.1) — conflitti "puri", senza interferenza di titolarità
// ---------------------------------------------------------------------------
suite.test("INDET batte DET38 sulla stessa sede contesa (nessuno dei due titolare lì)", () => {
  const d = dispoBase(MEDICI);
  // BERTUZZI (INDET, titolare Spilimbergo) e FOSCHIANI (DET38, titolare Spilimbergo): nessuno dei
  // due titolare di Maniago, la sede contesa — puro confronto di categoria.
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI);
});

suite.test("stessa categoria (DET38), nessuno titolare della sede contesa: a parità di debito decide il grad", () => {
  const d = dispoBase(MEDICI);
  // FOSCHIANI (grad3) e CERVESATO (grad63), entrambi DET38 titolari di Spilimbergo: contesa su
  // Maniago, nessuno dei due titolare lì.
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI);
});

suite.test("DET38 batte DET24 anche con grad numerico peggiore, nessuno titolare della sede contesa", () => {
  const d = dispoBase(MEDICI);
  // IENGO (DET38, grad107, titolare Maniago) e TRIGODKO (DET24, grad4, titolare Maniago): contesa
  // su Spilimbergo, nessuno dei due titolare lì — puro confronto di categoria.
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[1], IENGO, "la categoria deve prevalere sul grad numerico");
});

suite.test("DET24 batte SENZA anche con grad numerico peggiore", () => {
  resetMedici();
  const lista = comeSenza(BASE, ZURLO); // ZURLO (grad2, migliore) diventa senza incarico
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]); // DET24, grad5
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // ora SENZA, grad2 (migliore, ma senza incarico)
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MARTINETTI);
  resetMedici();
});

suite.test("categoria prevale SEMPRE finché il medico ha debito > 0 (anche pochissime ore residue)", () => {
  const d = dispoBase(MEDICI);
  // BERTUZZI (INDET, titolare Spilimbergo) e FOSCHIANI (DET38, titolare Spilimbergo): contesa su
  // Maniago, nessuno dei due titolare lì.
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  // BERTUZZI (INDET, base 96h) con debito ridotto a 7h residue: sotto le 6h il tetto implicito di
  // distribuzione (§3.11, Math.round(debito/12)) arrotonda a 0 e lo esclude comunque dal mese —
  // comportamento voluto (un residuo così piccolo è considerato esaurito ai fini del tetto, il
  // resto va perso), non testato qui. Con 7h il tetto arrotonda a 1 (round(7/12)=1): resta un
  // candidato valido per QUESTO turno, isolando la sola regola di gerarchia/categoria (§3.1).
  const t = unicoTurno(d, { [BERTUZZI]: -89 });
  suite.eq(t.slots[0], BERTUZZI, "INDET con 7h di debito deve battere DET38 con debito pieno");
});

// ---------------------------------------------------------------------------
// B. TITOLARITÀ DI SEDE (§3.1a) — OBBLIGATORIA e universale tra tutti i contrattualizzati
// ---------------------------------------------------------------------------
suite.test("il titolare della sede vince l'assegnazione FISICA anche contro categoria superiore", () => {
  const d = dispoBase(MEDICI);
  // TRIGODKO (DET24, titolare Maniago) contro CERVESATO (DET38, titolare Spilimbergo, categoria
  // normalmente superiore): su Maniago vince il titolare, nonostante la categoria inferiore.
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "il titolare di Maniago deve vincere anche contro un DET38 non titolare lì");
});

suite.test("la titolarità di un'ALTRA sede non aiuta: sulla sede contesa (dove nessuno dei due è titolare) decide la categoria", () => {
  const d = dispoBase(MEDICI);
  // CERVESATO (DET38, titolare Spilimbergo) contro MARTINETTI (DET24, titolare Spilimbergo, grad
  // migliore): contesa su MANIAGO, nessuno dei due titolare lì — la titolarità di Spilimbergo di
  // entrambi è irrilevante, decide solo la categoria.
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], CERVESATO, "la titolarità di Spilimbergo non aiuta su Maniago: decide la categoria (DET38 > DET24)");
});

suite.test("la titolarità decide ANCHE contro un INDET: su Maniago vince il titolare, sulla stessa coppia su Spilimbergo vince l'INDET", () => {
  const d1 = dispoBase(MEDICI);
  // TRIGODKO (DET24, titolare Maniago) vs BERTUZZI (INDET, titolare Spilimbergo): su Maniago vince
  // il titolare (TRIGODKO), nonostante INDET normalmente batta DET24 per categoria.
  d1[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d1[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  const t1 = unicoTurno(d1);
  suite.eq(t1.slots[0], TRIGODKO, "titolare di Maniago batte l'INDET su Maniago");

  const d2 = dispoBase(MEDICI);
  // Stessa coppia, stavolta contesa su Spilimbergo: qui è BERTUZZI il titolare, quindi vince lui —
  // la stessa identica coppia produce il vincitore opposto a seconda della sede contesa.
  d2[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d2[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t2 = unicoTurno(d2);
  suite.eq(t2.slots[1], BERTUZZI, "titolare di Spilimbergo (l'INDET) batte il DET24 su Spilimbergo");
});

suite.test("due titolari della STESSA sede: la titolarità è a parità, decide categoria → debito → graduatoria", () => {
  const d = dispoBase(MEDICI);
  // TRIGODKO (DET24, titolare Maniago) e IENGO (DET38, titolare Maniago): entrambi titolari di
  // Maniago, quindi pari — decide la categoria, IENGO (DET38) batte TRIGODKO (DET24).
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[IENGO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], IENGO, "tra due titolari della stessa sede decide la categoria, non la titolarità");
});

suite.test("la titolarità NON si applica contro un senza incarico (mai contrattualizzato)", () => {
  resetMedici();
  const lista = comeSenza(BASE, MORANO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]); // ora SENZA, unico candidato
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MORANO, "unico candidato, nessuna sorpresa — la titolarità non crea candidature dal nulla");
  resetMedici();
});

suite.test("nelle coperture a DISTANZA (blu), la titolarità vince PRIMA della categoria, esattamente come per il fisico", () => {
  resetMedici();
  // CERVESATO (DET38, titolare Spilimbergo) vs MARTINETTI (DET24, titolare Spilimbergo di
  // default, qui reso titolare di Meduno per isolare il meccanismo generico di isTitolareDi):
  // entrambi dichiarano blu su Meduno, MARTINETTI vince nonostante la categoria inferiore.
  const lista = BASE.map((m) => (m.id === MARTINETTI ? { ...m, sedeContratto: "Meduno" } : m));
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[CERVESATO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[2], MARTINETTI, "il titolare di Meduno vince il blu su Meduno anche contro un DET38 non titolare");
  resetMedici();
});

// CATENA DI PRIORITÀ DI COPERTURA (regola aziendale ASFO, §10): una sede si apre SOLO se tutte
// quelle sopra hanno un medico FISICAMENTE presente (una CDC coperta solo a distanza è "spenta").
// L0={Maniago,Spilimbergo}, L1={Meduno}, L2={Claut,Anduins}. NB: questo rende IRRAGGIUNGIBILE il
// vecchio caso "titolarità decide il tie-break su una CDC coperta a distanza" — coprire una CDC a
// distanza significa CDC fisicamente vuota, che ora chiude tutto ciò che sta sotto (ex-test qui
// riscritto in (A); il tie-break a distanza superstite — su Anduins, per gerarchia — è in (B)).
suite.test("(A) catena di priorità: una CDC coperta SOLO a distanza (Maniago senza corpo) NON apre Meduno — il fisico di Meduno resta idle", () => {
  resetMedici();
  const d = dispoBase(MEDICI);
  // Stesso setup dell'ex-test sul tie-break a distanza. Ora la catena lo trasforma: Maniago è
  // fisicamente VUOTA (nessuno la dichiara verde), coperta solo a distanza → CDC spenta → Meduno
  // NON si apre → IENGO (fisico a Meduno) resta idle. La copertura a distanza di Maniago non riapre
  // nulla sotto: la decide poi FASE 2 (l'unico fisico rimasto, FOSCHIANI da Spilimbergo).
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], ["Maniago"], { bluLiv: { Maniago: 1 } });
  d[IENGO][N(G1)] = turnoDisp(["Meduno"], ["Maniago"], { bluLiv: { Maniago: 1 } }); // titolare Maniago, ma solo blu
  d[VALERI][N(G1)] = turnoDisp(["Claut"]); // fuori target (MA,SP,ME), idle
  const t = unicoTurno(d);
  suite.eq(t.slots[2], null, "Meduno NON si apre con Maniago fisicamente scoperta (catena di priorità)");
  suite.eq(t.slots.includes(IENGO), false, "IENGO (ex-fisico a Meduno) resta idle: non assegnato da nessuna parte");
  suite.eq(t.slots[0], FOSCHIANI, "Maniago resta coperta SOLO a distanza (FOSCHIANI da Spilimbergo): non riapre Meduno");
});

suite.test("(B) catena di priorità: con tutte le sedi sopra coperte da un CORPO lo sweep è NO-OP, e il tie-break a distanza su Anduins regge (decide la gerarchia)", () => {
  resetMedici();
  const d = dispoBase(MEDICI);
  // 3 fisici con un corpo su ogni sede prioritaria: Maniago (ZURLO), Spilimbergo (FOSCHIANI),
  // Meduno (MARTINETTI). Anduins contesa a distanza tra il fisico di Spilimbergo e quello di Meduno
  // (entrambe vie territoriali valide, §3.2): nessuna titolarità su Anduins → decide la gerarchia
  // (categoria: DET38 FOSCHIANI > DET24 MARTINETTI). Tutte le sedi sopra hanno un corpo → la catena
  // non svuota nulla (Meduno resta), e la copertura a distanza si risolve come sempre.
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  d[MARTINETTI][N(G1)] = turnoDisp(["Meduno"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[2], MARTINETTI, "Meduno resta: la catena è NO-OP quando le CDC hanno un corpo fisico");
  suite.eq(t.slots[4], FOSCHIANI, "Anduins coperta a distanza dal vincitore del tie-break (categoria DET38 > DET24)");
});

// ---------------------------------------------------------------------------
// C. DEBITO — TIE-BREAK STESSA CATEGORIA (§3.1, §3.4) — coppie senza titolarità in gioco
// ---------------------------------------------------------------------------
resetMedici(); // difensivo: garantisce stato pulito anche se un test della sezione B è fallito a metà
suite.test("stessa categoria, stesso debito iniziale → vince il grad più basso", () => {
  const d = dispoBase(MEDICI);
  // MARTINETTI (grad5) e PRESSACCO (grad57), entrambi DET24 titolari di Spilimbergo: contesa su
  // Maniago, nessuno dei due titolare lì.
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MARTINETTI);
});

suite.test("stessa categoria, chi ha più debito residuo vince anche col grad peggiore", () => {
  const d = dispoBase(MEDICI);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [MARTINETTI]: -100, [PRESSACCO]: +50 });
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO ha più debito residuo nonostante grad peggiore");
});

suite.test("auto-bilanciamento: 5 turni pari debito, grad migliore vs peggiore → 3-2 per il grad migliore (§3.4)", () => {
  const d = dispoBase(MEDICI);
  const giorni = GIORNI_FERIALI_SEMPLICI.slice(0, 5);
  giorni.forEach((g) => {
    d[MARTINETTI][N(g)] = turnoDisp(["Maniago"]);
    d[DE_CANDIDO][N(g)] = turnoDisp(["Maniago"]);
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const vincite = { [MARTINETTI]: 0, [DE_CANDIDO]: 0 };
  giorni.forEach((g) => {
    const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
    vincite[t.slots[0]]++;
  });
  suite.eq(vincite[MARTINETTI], 3, "MARTINETTI (grad migliore, grad5) deve vincere 3 turni su 5");
  suite.eq(vincite[DE_CANDIDO], 2, "DE CANDIDO (grad83) deve vincere i restanti 2 (debito che sale dopo ogni sconfitta)");
});

suite.test("recupero ore (extraOre) aumenta il debito e può ribaltare un conflitto", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  d[MARTINETTI][N(G1)] = turnoDisp(["Maniago"]);
  const senzaRecupero = unicoTurno(d);
  suite.eq(senzaRecupero.slots[0], MARTINETTI, "senza recupero vince il grad migliore");
  const conRecupero = unicoTurno(d, { [PRESSACCO]: 200 });
  suite.eq(conRecupero.slots[0], PRESSACCO, "col recupero ore PRESSACCO ha più debito e vince");
});

suite.test("il recupero ore NON si applica ai senza incarico", () => {
  resetMedici();
  const lista = comeSenza(BASE, MORANO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [MORANO]: 999 });
  suite.eq(t.slots[0], MORANO);
  suite.assert(CAT_INFO[byId[MORANO].cat].ore === null, "SENZA non ha un monte ore");
  resetMedici();
});

// ---------------------------------------------------------------------------
// D. DEBITO ESAURITO — ORDINE A 3 FASCE (§3.1) — bucket dominante, titolarità irrilevante
// ---------------------------------------------------------------------------
suite.test("un medico con debito esaurito (0) esce dalla priorità di categoria (bucket dominante anche sul titolare)", () => {
  const d = dispoBase(MEDICI);
  // TRIGODKO è titolare di Maniago (sede contesa), ma con debito esaurito il bucket lo esclude
  // comunque prima di qualunque confronto di titolarità/categoria.
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -104 });
  suite.eq(t.slots[0], CERVESATO, "CERVESATO (debito>0) deve battere TRIGODKO (debito esaurito, pur titolare) nonostante la categoria inferiore");
});

suite.test("ordine fascia 1: contrattualizzati con debito>0 battono i senza incarico", () => {
  resetMedici();
  const lista = comeSenza(BASE, MORANO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[PITAU][N(G1)] = turnoDisp(["Maniago"]);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], PITAU);
  resetMedici();
});

suite.test("ordine fascia 2: senza incarico battono i contrattualizzati con debito esaurito", () => {
  resetMedici();
  const lista = comeSenza(BASE, MORANO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -104 });
  suite.eq(t.slots[0], MORANO);
  resetMedici();
});

suite.test("fascia 3 (esauriti CON turni extra dichiarati): competono solo per grad tra loro", () => {
  // Monte ore ordinario esaurito per entrambi (extraOre: -104/-104) MA con turni extra dichiarati
  // (§3.10): senza turni extra, il blocco rigido (§3.4) li escluderebbe del tutto (vedi test
  // successivo e test_stesso_cat2.mjs) — qui invece restano candidati, in fascia 3, e competono
  // solo per graduatoria come tra medici della stessa categoria (bucket dominante: titolarità e
  // categoria non vengono nemmeno confrontate).
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -104, [PRESSACCO]: -104 }, G1, { [TRIGODKO]: 1, [PRESSACCO]: 1 });
  suite.eq(t.slots[0], TRIGODKO, "TRIGODKO (grad4) batte PRESSACCO (grad57): a parità di debito (entrambi 0 + turni extra), decide la graduatoria");
});

suite.test("un esaurito NON può scalzare un senza incarico anche con grad migliore", () => {
  resetMedici();
  const lista = comeSenza(BASE, VALERI);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[VALERI][N(G1)] = turnoDisp(["Maniago"]); // ora SENZA
  const t = unicoTurno(d, { [TRIGODKO]: -104 });
  suite.eq(t.slots[0], VALERI);
  resetMedici();
});

suite.test("un esaurito CON turni extra dichiarati copre comunque un turno se non c'è nessun altro candidato", () => {
  // Con turni extra dichiarati (>0), il medico resta candidato oltre il monte ore ordinario
  // esaurito (§3.10) e copre il turno in assenza di alternative.
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -104 }, G1, { [TRIGODKO]: 1 });
  suite.eq(t.slots[0], TRIGODKO);
});

suite.test("un esaurito SENZA turni extra dichiarati NON copre: blocco rigido (§3.4), la sede resta scoperta anche senza alternative", () => {
  // Regola corretta: un esaurito copre un buco SOLO se ha dichiarato turni extra (turniExtra > 0).
  // Senza turni extra, una volta esaurito il monte ore è escluso dai candidati per QUALSIASI
  // turno, anche restando l'unico disponibile — coerente con test_stesso_cat2.mjs.
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [TRIGODKO]: -104 });
  suite.eq(t.slots[0], null, "nessun turno extra dichiarato: TRIGODKO esaurito è escluso, la sede resta scoperta");
});

// ---------------------------------------------------------------------------
// E. SCENARI DI COPERTURA VERDE/BLU (§3.2) — nessuna copertura automatica
// ---------------------------------------------------------------------------
suite.test("n=1 medico: fisico nella sede verde ottenuta (NON più forzato su Maniago)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[1], TRIGODKO, "deve andare fisicamente su Spilimbergo, la sua sede verde");
  suite.eq(t.fis.length, 1);
  suite.assert(t.slots[0] === null && t.slots[2] === null && t.slots[3] === null && t.slots[4] === null, "senza blu dichiarato tutto il resto è scoperto");
});

suite.test("n=1 medico con blu dichiarato copre 1 sola sede extra a distanza", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Claut"], { bluLiv: { Meduno: 1, Claut: 2 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[1], TRIGODKO);
  suite.eq(t.slots[2], TRIGODKO, "copre Meduno, il suo blu di livello migliore");
  suite.assert(t.slots[3] === null, "Claut resta scoperta: un medico copre al massimo 1 sede a distanza");
});

suite.test("n=2 medici: fisici nelle 2 CDC, nessuna copertura automatica delle altre sedi", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO);
  suite.eq(t.slots[1], PRESSACCO);
  suite.assert(t.slots[2] === null && t.slots[3] === null && t.slots[4] === null, "Meduno/Claut/Anduins scoperte senza blu dichiarato");
});

suite.test("n=2 medici, conflitto sullo stesso blu su una sede senza titolarità in gioco (Meduno): decide la categoria", () => {
  const d = dispoBase(MEDICI);
  d[IENGO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // DET38
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // DET24
  const t = unicoTurno(d);
  suite.eq(t.slots[2], IENGO, "DET38 batte DET24 anche nel conflitto blu");
});

suite.test("n=3 medici: fisici a Maniago, Spilimbergo, Meduno; il resto dipende dal blu", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO); suite.eq(t.slots[2], CERVESATO);
  suite.assert(t.slots[3] === null && t.slots[4] === null, "Claut e Anduins scoperte senza blu");
});

suite.test("n=3 medici con blu su Claut e Anduins: entrambe coperte se dichiarate da fisici diversi", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  d[CERVESATO][N(G1)] = turnoDisp(["Meduno"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[3], TRIGODKO, "Claut coperta da chi l'ha dichiarata blu");
  suite.eq(t.slots[4], PRESSACCO, "Anduins coperta da chi l'ha dichiarata blu");
});

suite.test("NOTTE: sedi fisiche solo Maniago/Spilimbergo/Meduno — Claut e Anduins solo a distanza (§3.2)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Claut"]); // verde Claut INUTILIZZABILE di notte: Claut non è fisica
  const t = unicoTurno(d);
  suite.eq(t.fis.length, 3, "di notte solo 3 sedi fisiche (Maniago, Spilimbergo, Meduno)");
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO); suite.eq(t.slots[2], CERVESATO);
  suite.assert(t.slots[3] === null, "Claut non fisica di notte (IENGO aveva solo verde Claut, nessun blu → non piazzato)");
  suite.assert(t.slots[4] === null, "Anduins scoperta");
});

suite.test("DIURNO: Claut diventa fisica (4 medici → 4 sedi fisiche incl. Claut)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut"]); // nel diurno la verde Claut è usabile: Claut è fisica
  const t = unicoTurnoDiurno(d);
  suite.eq(t.fis.length, 4, "nel diurno Claut si aggiunge come 4ª sede fisica");
  suite.eq(t.slots[3], IENGO, "Claut fisica nel diurno");
  suite.assert(t.slots[4] === null, "Anduins scoperta (nessuno la copre, né fisica né blu)");
});

suite.test("DIURNO: con 5 medici anche Anduins è fisica (5 sedi fisiche piene)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut"]);
  d[DE_CANDIDO][Gd(SAB)] = turnoDisp(["Anduins"]);
  const t = unicoTurnoDiurno(d);
  suite.eq(t.fis.length, 5, "nel diurno con 5 medici tutte e 5 le sedi sono fisiche");
  suite.eq(t.slots[3], IENGO, "Claut fisica");
  suite.eq(t.slots[4], DE_CANDIDO, "Anduins fisica nel diurno");
});

suite.test("DIURNO: priorità invariata — con 3 medici solo Maniago/Spilimbergo/Meduno, Claut/Anduins a distanza", () => {
  const d = dispoBase(MEDICI);
  // 3 medici che dichiarano le sedi prioritarie verdi + Claut/Anduins blu: le prioritarie si
  // riempiono per prime, Claut/Anduins restano a distanza (non c'è un 4°/5° medico).
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } });
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  const t = unicoTurnoDiurno(d);
  suite.eq(t.fis.length, 3, "solo 3 medici → solo le 3 sedi prioritarie sono fisiche");
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO); suite.eq(t.slots[2], CERVESATO);
  suite.eq(t.slots[3], TRIGODKO, "Claut coperta a DISTANZA da TRIGODKO (blu)");
  suite.eq(t.slots[4], PRESSACCO, "Anduins coperta a DISTANZA da PRESSACCO (blu)");
});

suite.test("un medico copre al massimo 1 sede a distanza anche con più blu dichiarati e disponibili", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno", "Claut", "Anduins"], { bluLiv: { Meduno: 1, Claut: 2, Anduins: 3 } });
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "prende Meduno, il suo blu di livello migliore");
  suite.assert(t.slots[3] === null && t.slots[4] === null, "Claut e Anduins restano scoperte: massimo 1 sede a distanza a testa");
});

suite.test("se il vincitore del blu preferito viene scalzato, prova il blu successivo nel suo ordine", () => {
  const d = dispoBase(MEDICI);
  // Stessa categoria (DET24) per isolare il grad da qualunque interferenza di categoria: TRIGODKO
  // (grad4) vs PRESSACCO (grad57), entrambi dichiarano Meduno come blu (nessuno dei due titolare
  // lì — Meduno non è mai una sede di titolarità, riservata a Maniago/Spilimbergo).
  // Fallback su Anduins (non Claut): PRESSACCO è fisico a Spilimbergo, che può coprire Anduins a
  // distanza ma NON Claut (vincolo territoriale §3.2). Il meccanismo di "bump → blu successivo"
  // resta identico; cambia solo la sede di fallback per rispettare il vincolo geografico.
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } }); // grad4
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"], ["Meduno", "Anduins"], { bluLiv: { Meduno: 1, Anduins: 2 } }); // grad57
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO, "TRIGODKO (grad migliore) vince Meduno");
  suite.eq(t.slots[4], PRESSACCO, "PRESSACCO, perso Meduno, ottiene comunque Anduins (suo blu successivo)");
});

// ---------------------------------------------------------------------------
// E-bis. VINCOLO TERRITORIALE nella copertura a distanza (§3.2, §10 voce 31)
// Claut ← solo dal fisico di Maniago; Anduins ← solo dal fisico di Spilimbergo o Meduno.
// ---------------------------------------------------------------------------
suite.test("TERRITORIALE: Claut a distanza SOLO dal fisico di Maniago (Spilimbergo non può, anche con grad migliore)", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } });   // @Maniago (grad57) → copre Claut
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Claut"], { bluLiv: { Claut: 1 } }); // @Spilimbergo (grad4, migliore) → NON può
  const t = unicoTurno(d);
  suite.eq(t.slots[3], PRESSACCO, "Claut coperta dal fisico di Maniago, mai da Spilimbergo");
});

suite.test("TERRITORIALE: Claut resta SCOPERTA se il fisico di Maniago non l'ha dichiarata", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);                                          // @Maniago, niente Claut
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Claut"], { bluLiv: { Claut: 1 } });  // @Spilimbergo, blu Claut ma non può
  const t = unicoTurno(d);
  suite.assert(t.slots[3] === null, "Claut scoperta: Maniago non l'ha dichiarata, Spilimbergo non può coprirla");
});

suite.test("TERRITORIALE: Anduins contesa Spilimbergo vs Meduno → decide la gerarchia; Maniago escluso", () => {
  const d = dispoBase(MEDICI);
  d[IENGO][N(G1)] = turnoDisp(["Maniago"], ["Anduins"], { bluLiv: { Anduins: 1 } });       // @Maniago, blu Anduins ma NON può
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } }); // @Spilimbergo, DET24
  d[MORANO][N(G1)] = turnoDisp(["Meduno"], ["Anduins"], { bluLiv: { Anduins: 1 } });        // @Meduno, DET12 → perde per categoria
  const t = unicoTurno(d);
  suite.eq(t.slots[4], TRIGODKO, "Anduins al fisico di Spilimbergo (DET24 > DET12); Maniago escluso dal vincolo");
});

suite.test("TERRITORIALE: Anduins dal fisico di Meduno se Spilimbergo non la dichiara (seconda via)", () => {
  const d = dispoBase(MEDICI);
  d[IENGO][N(G1)] = turnoDisp(["Maniago"]);                                                // @Maniago
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);                                          // @Spilimbergo, niente Anduins
  d[MORANO][N(G1)] = turnoDisp(["Meduno"], ["Anduins"], { bluLiv: { Anduins: 1 } });        // @Meduno → copre Anduins
  const t = unicoTurno(d);
  suite.eq(t.slots[4], MORANO, "Anduins coperta dal fisico di Meduno (seconda via valida)");
});

suite.test("TERRITORIALE: Meduno a distanza NON ha vincolo geografico (coperto dal fisico di Maniago)", () => {
  const d = dispoBase(MEDICI);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } });      // @Maniago copre Meduno a distanza
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[2], PRESSACCO, "Meduno coperto a distanza dal fisico di Maniago: nessun vincolo territoriale su Meduno");
});

// ---------------------------------------------------------------------------
// E-ter. FIX "4° MEDICO SPRECATO" nel diurno (§10 voce 32)
// Il 4° medico va dove ha dichiarato verde; se indifferente (Claut+Anduins stesso livello),
// tappa il buco della copertura a distanza, altrimenti Claut. Solo diurno.
// ---------------------------------------------------------------------------
suite.test("4°-MEDICO: dichiara solo Anduins → va FISICO ad Anduins (non più sprecato)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } }); // copre Claut a distanza
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Anduins"]); // 4° solo Anduins
  const t = unicoTurnoDiurno(d);
  suite.eq(t.slots[4], IENGO, "Anduins fisica: il 4° medico è sfruttato");
  suite.eq(t.slots[3], TRIGODKO, "Claut coperta a distanza dal fisico di Maniago");
  suite.eq(t.fis.length, 4, "4 sedi fisiche (MA/SP/ME + Anduins)");
});

suite.test("4°-MEDICO indifferente + Anduins sarebbe scoperta a distanza → FISICO ad Anduins (tappa buco)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } }); // Claut coperibile
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"]);                                  // Anduins NON coperibile
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut", "Anduins"]); // indifferente (stesso livello di default)
  const t = unicoTurnoDiurno(d);
  suite.eq(t.slots[4], IENGO, "il 4° va su Anduins (il buco); Claut resta a distanza");
  suite.eq(t.slots[3], TRIGODKO, "Claut coperta a distanza dal fisico di Maniago");
});

suite.test("4°-MEDICO indifferente + Claut sarebbe scoperta / Anduins coperibile → resta FISICO su Claut", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"]);                                            // Claut NON coperibile
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } }); // Anduins coperibile
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut", "Anduins"]);
  const t = unicoTurnoDiurno(d);
  suite.eq(t.slots[3], IENGO, "il 4° resta su Claut (il buco); Anduins a distanza da Spilimbergo");
  suite.eq(t.slots[4], PRESSACCO, "Anduins coperta a distanza dal fisico di Spilimbergo");
});

suite.test("4°-MEDICO indifferente + entrambe coperibili a distanza → FISICO su Claut (più popolosa)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"], ["Claut"], { bluLiv: { Claut: 1 } });
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut", "Anduins"]);
  const t = unicoTurnoDiurno(d);
  suite.eq(t.slots[3], IENGO, "il 4° resta su Claut; Anduins a distanza");
  suite.assert(t.slots[4] === PRESSACCO, "Anduins coperta a distanza");
});

suite.test("4°-MEDICO indifferente + nessuna coperibile → FISICO su Claut", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][Gd(SAB)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][Gd(SAB)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][Gd(SAB)] = turnoDisp(["Meduno"]);
  d[IENGO][Gd(SAB)] = turnoDisp(["Claut", "Anduins"]);
  const t = unicoTurnoDiurno(d);
  suite.eq(t.slots[3], IENGO, "il 4° resta su Claut; Anduins scoperta");
  suite.assert(t.slots[4] === null, "Anduins scoperta (nessuno la copre)");
});

suite.test("4°-MEDICO: NOTTE invariata — 4° solo Anduins resta inutilizzato, Anduins mai fisica", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Anduins"], ["Anduins"], { bluLiv: { Anduins: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.fis.length, 3, "di notte solo 3 fisiche: lo step del 4° medico vale solo nel diurno");
  suite.assert(t.slots[4] === null, "Anduins non fisica di notte (IENGO non è fisico da nessuna parte → non copre)");
});

// ---------------------------------------------------------------------------
// F. LIVELLI VERDE (ricollocazione fisica, §3.3)
// ---------------------------------------------------------------------------
suite.test("livelli verdi pari fra due sedi = indifferente: il motore ricolloca per massimizzare le coperture", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 1, Maniago: 1 } });
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], BERTUZZI, "BERTUZZI si sposta su Maniago (indifferente per lui)");
  suite.eq(t.slots[1], IENGO, "IENGO ottiene Spilimbergo, la sua unica scelta");
});

// GUARD DOPPIO (§10): fissa ENTRAMBI i comportamenti — chi "aggiusta" (a) rompendo (b) fa fallire qui.
suite.test("titolarità a parità di livello: il SINGOLO medico indifferente va nella SUA sede; a più medici la copertura vince (l'indifferente si sposta)", () => {
  // (a) SINGOLO medico indifferente con titolarità → va nella SUA (gratis: nessuno da spostare).
  //     BERTUZZI titolare Spilimbergo, MA1+SP1, unico disponibile → Spilimbergo, non Maniago per indice.
  const da = dispoBase(MEDICI);
  da[BERTUZZI][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { verdeLiv: { Maniago: 1, Spilimbergo: 1 } });
  const ta = unicoTurno(da);
  suite.eq(ta.slots[1], BERTUZZI, "(a) singolo indifferente → va nella sua titolarità Spilimbergo, non Maniago per indice");
  suite.eq(ta.slots[0], null, "(a) Maniago resta scoperta: un solo medico copre una sede sola");
  // (b) DUE medici: BERTUZZI indifferente + IENGO vincolato a Spilimbergo. La titolarità NON si forza:
  //     BERTUZZI si sposta su Maniago per lasciare Spilimbergo a IENGO → 2 sedi coperte, non 1.
  const db = dispoBase(MEDICI);
  db[BERTUZZI][N(G1)] = turnoDisp(["Spilimbergo", "Maniago"], [], { verdeLiv: { Spilimbergo: 1, Maniago: 1 } });
  db[IENGO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const tb = unicoTurno(db);
  suite.eq(tb.slots[0], BERTUZZI, "(b) BERTUZZI indifferente si sposta su Maniago: la copertura vince sulla titolarità");
  suite.eq(tb.slots[1], IENGO, "(b) IENGO ottiene Spilimbergo, la sua unica scelta — 2 sedi coperte, non 1");
});

suite.test("chiusura Claut/Anduins nei notturni CON diurno (§10 voce 96): festivo → CHIUSA (null), feriale → coperta a distanza", () => {
  // FESTIVO notturno (SAB = 1 agosto, sabato → ha il diurno): ZURLO fisico Maniago + blu Claut.
  // Regola ASFO: di notte, nei giorni con diurno, Claut è CHIUSA — nemmeno a distanza. La dichiarazione
  // blu resta inerte (il motore non la copre). Feriale invariato: la copertura a distanza è valida.
  const df = dispoBase(MEDICI);
  df[ZURLO][N(SAB)] = turnoDisp(["Maniago"], ["Claut"], { verdeLiv: { Maniago: 1 }, bluLiv: { Claut: 1 } });
  const tf = unicoTurno(df, {}, SAB);
  suite.eq(tf.slots[0], ZURLO, "festivo: ZURLO fisico a Maniago");
  suite.eq(tf.slots[3], null, "festivo notturno: Claut CHIUSA (servizio non attivo, nemmeno a distanza)");
  // FERIALE notturno (G1 = 3 agosto, feriale semplice, niente diurno): stessa dichiarazione → Claut COPERTA.
  const dl = dispoBase(MEDICI);
  dl[ZURLO][N(G1)] = turnoDisp(["Maniago"], ["Claut"], { verdeLiv: { Maniago: 1 }, bluLiv: { Claut: 1 } });
  const tl = unicoTurno(dl, {}, G1);
  suite.eq(tl.slots[0], ZURLO, "feriale: ZURLO fisico a Maniago");
  suite.eq(tl.slots[3], ZURLO, "feriale notturno: Claut coperta a distanza da ZURLO (a-distanza intatta)");
});

suite.test("chiusura Claut resiste allo SCAMBIO preferenza-turno §3.9 (voce 96): il notturno festivo ri-risolto NON ri-copre Claut", () => {
  // Il call-site §3.9 ri-esegue risolviBlu dopo uno scambio: va provato che anche lì Claut resta chiusa.
  // ZURLO (titolare Maniago) vince Maniago sia sul diurno sia sul notturno del sabato (festivo) e PREFERISCE
  // il diurno → cede il notturno; VALERI subentra fisico a Maniago sul notturno e ha dichiarato blu Claut.
  const d = dispoBase(MEDICI);
  const sab = dk(ANNO_TEST, MESE_TEST, SAB);
  d[ZURLO][Gd(SAB)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } });
  d[ZURLO][N(SAB)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } });
  d[ZURLO]["TURNOPREF:" + sab] = "G"; // preferenza turno: il diurno
  d[VALERI][N(SAB)] = turnoDisp(["Maniago"], ["Claut"], { verdeLiv: { Maniago: 1 }, bluLiv: { Claut: 1 } });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {});
  const g = schema.find((x) => x.giorno === SAB);
  const tG = g.turni.find((t) => t.id === "G");
  const tN = g.turni.find((t) => t.id === "N");
  suite.eq(tG.slots[0], ZURLO, "ZURLO tiene il diurno (turno preferito)");
  suite.eq(tN.slots[0], VALERI, "scambio §3.9 avvenuto: VALERI subentra fisico a Maniago sul notturno");
  suite.eq(tN.slots[3], null, "Claut resta CHIUSA anche dopo il ri-risolviBlu dello scambio (blu Claut di VALERI ignorata)");
});

suite.test("parità di livello fra una CDC e una sede secondaria: vince sempre la CDC, MAI l'ordine di dichiarazione", () => {
  const d = dispoBase(MEDICI);
  // VALERI unico candidato (n=1, target dinamico): dichiara Meduno PRIMA di Maniago nell'array,
  // entrambi a livello 1 (pari). Se la parità fosse risolta per ordine di inserimento, andrebbe
  // a Meduno; deve invece andare a Maniago perché le CDC vengono sempre prima a parità di livello.
  d[VALERI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 1, Maniago: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[0], VALERI, "va a Maniago nonostante l'abbia dichiarato dopo Meduno nell'array");
  suite.assert(t.slots[2] === null, "Meduno resta scoperta: la parità con Maniago non la rende una scelta equivalente");
});

suite.test("parità Maniago/Meduno = identico risultato di Maniago:1 + Meduno:2 (la parità non è vera indifferenza tra CDC e sede secondaria)", () => {
  const d1 = dispoBase(MEDICI);
  d1[VALERI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 1, Maniago: 1 } });
  const t1 = unicoTurno(d1);
  const d2 = dispoBase(MEDICI);
  d2[VALERI][N(G1)] = turnoDisp(["Meduno", "Maniago"], [], { verdeLiv: { Meduno: 2, Maniago: 1 } });
  const t2 = unicoTurno(d2);
  suite.eq(t1.slots[0], t2.slots[0], "stesso esito su Maniago sia dichiarando Meduno:1 (pari) sia Meduno:2 (esplicitamente peggiore)");
  suite.eq(t1.slots[0], VALERI);
});

suite.test("livello verde migliore = diritto di tenere la sede contro chi non supera in gerarchia", () => {
  resetMedici();
  const lista = comeSenza(BASE, MORANO);
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[IENGO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[MORANO][N(G1)] = turnoDisp(["Spilimbergo"]); // ora SENZA
  const t = unicoTurno(d);
  suite.eq(t.slots[1], IENGO);
  resetMedici();
});

suite.test("scalzamento fisico consentito solo se il richiedente ha vera priorità superiore (titolarità inclusa)", () => {
  const d = dispoBase(MEDICI);
  // Con solo 2 candidati il target fisico è sempre [Maniago, Spilimbergo] (Meduno non è
  // raggiungibile): TRIGODKO (titolare di Maniago, sua unica scelta) resiste a CERVESATO (DET38,
  // categoria nominalmente superiore, ma titolare di Spilimbergo — non di Maniago). Fallito il
  // tentativo su Maniago (livello 1 per lui), CERVESATO ripiega sulla propria titolarità
  // (Spilimbergo, livello 2), libera.
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET24, titolare Maniago, unica scelta
  d[CERVESATO][N(G1)] = turnoDisp(["Maniago", "Spilimbergo"], [], { verdeLiv: { Maniago: 1, Spilimbergo: 2 } }); // DET38, titolare Spilimbergo
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO, "TRIGODKO (titolare di Maniago) resiste anche a un DET38 (categoria nominalmente superiore) che non ha titolarità lì");
  suite.eq(t.slots[1], CERVESATO, "CERVESATO, fallito il tentativo su Maniago, ottiene comunque Spilimbergo (la propria titolarità, libera)");
});

// ---------------------------------------------------------------------------
// G. INVARIANTI GENERALI
// ---------------------------------------------------------------------------
suite.test("INV1: nessun medico fisico senza disponibilità verde dichiarata per quella sede", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], TRIGODKO); suite.eq(t.slots[1], PRESSACCO);
});

suite.test("INV2: nessun medico con NO esplicito viene assegnato (né fisico né a distanza)", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.assert(!t.slots.includes(TRIGODKO));
  suite.eq(t.slots[0], PRESSACCO);
});

suite.test("INV3: le coperture a distanza provengono solo da medici fisicamente presenti nel turno", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"], ["Meduno"], { bluLiv: { Meduno: 1 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[2], TRIGODKO);
  suite.assert(t.fis.includes(0) && t.slots[0] === TRIGODKO, "chi copre a distanza deve essere fisico nel turno");
});

suite.test("nessuna copertura è automatica: senza alcun blu dichiarato, tutto ciò che non è fisico resta scoperto", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[CERVESATO][N(G1)] = turnoDisp(["Meduno"]);
  d[IENGO][N(G1)] = turnoDisp(["Claut"]);
  const t = unicoTurno(d);
  suite.assert(t.slots[4] === null, "Anduins non è mai un target fisico e senza blu resta sempre scoperta");
});

suite.test("nessuna eccezione con turno completamente privo di candidati", () => {
  const d = dispoBase(MEDICI);
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null));
  suite.eq(t.fis.length, 0);
});

suite.test("nessuna eccezione con singolo candidato marcato NO esplicito", () => {
  const d = dispoBase(MEDICI);
  d[TRIGODKO][N(G1)] = turnoDisp([], [], { no: true });
  const t = unicoTurno(d);
  suite.assert(t.slots.every((s) => s === null));
});

suite.test("due senza incarico in conflitto: vince solo il grad", () => {
  resetMedici();
  let lista = comeSenza(BASE, PITAU); // grad14
  lista = comeSenza(lista, MORANO); // grad72
  setMediciGlobal(lista);
  const d = dispoBase(lista);
  d[PITAU][N(G1)] = turnoDisp(["Maniago"]);
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d);
  suite.eq(t.slots[0], PITAU, "grad14 batte grad72 tra due senza incarico");
  resetMedici();
});

suite.test("weekend: entrambi i turni (diurno e notturno) vengono elaborati indipendentemente", () => {
  const d = dispoBase(MEDICI);
  const weekend = 1;
  const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
  d[TRIGODKO][G(weekend)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(weekend)] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const giorno = schema.find((g) => g.giorno === weekend);
  suite.eq(giorno.turni.find((t) => t.id === "G").slots[0], TRIGODKO);
  suite.eq(giorno.turni.find((t) => t.id === "N").slots[0], PRESSACCO);
});

suite.test("turno extra (MMG mattina/pomeriggio): assegnazione singola secondo gerarchia", () => {
  const d = dispoBase(MEDICI);
  const giorno = GIORNI_FERIALI_SEMPLICI[0];
  const extras = { [dk(ANNO_TEST, MESE_TEST, giorno)]: { M: true } };
  const M = `${dk(ANNO_TEST, MESE_TEST, giorno)}|M`;
  d[BERTUZZI][M] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][M] = turnoDisp(["Maniago"]);
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, extras);
  const t = schema.find((g) => g.giorno === giorno).turni.find((x) => x.id === "M");
  suite.eq(t.slots[0], BERTUZZI, "INDET deve battere DET38 anche sul turno extra (nessuno dei due titolare di Maniago)");
  // Dalla voce 52 (unificazione MMG) un turno MMG ha 5 slot come gli ordinari: qui verifichiamo ciò
  // che il test voleva dire davvero — UN SOLO medico assegnato (le altre 4 sedi restano scoperte),
  // non la forma dell'array. La vecchia asserzione `slots.length===1` era rimasta al modello mono-slot.
  suite.eq(t.slots.filter((x) => x != null).length, 1, "un solo medico assegnato (le altre 4 sedi restano scoperte)");
});

suite.test("recupero ore negativo esaurisce prima il debito e fa uscire dalla priorità di categoria", () => {
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [BERTUZZI]: -200 });
  suite.eq(t.slots[0], FOSCHIANI, "BERTUZZI esaurito da recupero negativo deve perdere contro chi ha ancora debito");
});

suite.finish();

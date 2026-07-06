// Test sulla distribuzione temporale reale (CONTEXT.md §3.11): meccanismo a DUE PASSAGGI —
// (1) elabora tutto il mese con la sola gerarchia esistente, come oracolo per scoprire quali
// turni ciascun medico vincerebbe naturalmente; (2) per chi supera il proprio tetto (il più
// restrittivo tra monte ore implicito e Max turni mese dichiarato) sceglie, tra i turni
// EFFETTIVAMENTE vinti, il sottoinsieme più equidistanziato da tenere — raggruppato PRIMA per
// livello di sede verde ottenuta (la priorità di sede è assoluta sull'equidistanza) — e cede il
// resto al candidato successivo in gerarchia in una rielaborazione pulita e definitiva. Il tetto
// resta RIGIDO: se un turno ceduto non trova un'alternativa disponibile, resta SCOPERTO (la
// copertura non prevale mai sul tetto dichiarato). Poiché il "pool" da cui si sceglie è fatto di
// vittorie EFFETTIVE (non di semplice disponibilità dichiarata), resta comunque concentrato nella
// finestra iniziale in cui il medico è naturalmente il più forte candidato — è una conseguenza
// accettata della gerarchia, non un difetto di questo meccanismo. Senza la vecchia regola di
// spaziatura temporale (§3.7, RIMOSSA — CONTEXT.md §10), quella finestra naturale è semplicemente
// i primi N giorni CONSECUTIVI in cui il medico è disponibile, dato che nulla forza più
// un'alternanza giorno per giorno.
//
// Selezione CROSS-LIVELLO (§3.11): quando un livello di sede peggiore deve anch'esso essere
// ridotto (dopo che tutti i livelli migliori sono stati riempiti per intero — la priorità di sede
// resta sempre assoluta, mai un livello peggiore "ruba" spazio a uno migliore), la scelta di quali
// turni tenere in quel livello considera ANCHE la distanza dai giorni già fissati dai livelli
// migliori (farthest-point greedy, scegliConRiferimento), non solo l'equidistanza al proprio
// interno — così i gruppi di livelli diversi si incastrano invece di sovrapporsi in giorni
// consecutivi.
//
// BERTUZZI (INDET, titolare Spilimbergo nativo) e i backup PRESSACCO/IENGO (SENZA incarico
// nativi nella lista attuale, grad57 e grad107) sono impostati UNA VOLTA a livello di modulo
// (MEDICI_TEST = MEDICI_DEFAULT): la titolarità universale (§3.1a) non interferisce qui perché il
// confronto titolarità→categoria è gated su ENTRAMBI i contendenti contrattualizzati — un senza
// incarico lo disattiva sempre.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_distribuzione_temporale — turni distanziati nel mese invece dei primi N");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
// INDET: BERTUZZI (96h monte ore = 8 notti)
const BERTUZZI = 9;
// SENZA incarico nativi: PRESSACCO grad57 (migliore), IENGO grad107 (backup di grad peggiore)
const PRESSACCO = 10, IENGO = 14;
const MEDICI_TEST = MEDICI_DEFAULT;
setMediciGlobal(MEDICI_TEST);

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
suite.test("scarsità genuina su un'unica sede: il tetto implicito (8, dal monte ore) coincide col numero di vittorie naturali, quindi nessuna cessione scatta — vince i primi 8 giorni CONSECUTIVI (nessuna alternanza forzata, §3.7 rimossa)", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "BERTUZZI vince esattamente le 8 notti previste dal suo monte ore (96h/12h): il tetto implicito non taglia nulla perché coincide col numero di vittorie naturali");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), "i primi 8 giorni CONSECUTIVI: senza la spaziatura §3.7 (rimossa) nulla forza più un'alternanza, e senza cessione (tetto = vittorie naturali) la distribuzione non ha nulla da fare");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "nessuna notte resta scoperta: PRESSACCO copre tutte le notti non vinte da BERTUZZI");
});

suite.test("più siti disponibili (nessuna scarsità artificiale): stesso principio, nessuna cessione (tetto implicito = vittorie naturali), copertura sempre completa su 2 sedi", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, {
    [BERTUZZI]: ["Maniago", "Spilimbergo"], [PRESSACCO]: ["Maniago", "Spilimbergo"], [IENGO]: ["Maniago", "Spilimbergo"],
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "8 vittorie nel mese, pari al proprio tetto implicito: nessuna cessione necessaria");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), "stesso identico pattern: i primi 8 giorni consecutivi, anche con più concorrenti e più sedi disponibili");
  let scoperte = 0;
  schema.forEach((g) => g.turni.forEach((t) => { if (t.id === "N" && t.slots.filter((s) => s).length < 2) scoperte++; }));
  suite.eq(scoperte, 0, "entrambe le sedi (Maniago e Spilimbergo) restano sempre coperte ogni notte del mese");
});

suite.test("un titolare di sede segue le stesse regole di tutti (CONTEXT.md §3.11 punto C): nessuna esenzione dal proprio tetto, ma qui il tetto implicito coincide comunque con le vittorie naturali", () => {
  // DET38 titolare Maniago: 168h di monte ore (agosto non è mese aggiustato per DET38, §3.11
  // punto 3) = 14 notti. Essendo l'unico candidato con priorità vera su Maniago (titolarità),
  // vince le prime 14 notti consecutive finché il monte ore non si esaurisce (blocco rigido §3.4)
  // — il tetto implicito (14) coincide esattamente con queste vittorie naturali, quindi nessuna
  // cessione scatta: la titolarità non è "esente" per regola speciale, semplicemente qui il tetto
  // e le vittorie naturali sono lo stesso numero.
  const lista = MEDICI_TEST.map((m) => (m.id === BERTUZZI ? { ...m, cat: "DET38", sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), "il titolare vince i primi 14 giorni CONSECUTIVI (168h/12h): tetto implicito = vittorie naturali, nessuna cessione");
  const nottePressacco15 = schema.find((g) => g.giorno === 15).turni.find((t) => t.id === "N");
  suite.eq(nottePressacco15.slots[0], PRESSACCO, "esaurito il monte ore del titolare (blocco rigido preesistente §3.4), la sede passa al senza incarico dal giorno 15 in poi");
  setMediciGlobal(MEDICI_TEST);
});

suite.test("con un solo candidato disponibile e nessun backup, la distribuzione non cambia il comportamento preesistente: si consuma il monte ore nei primi giorni e il resto resta scoperto (blocco rigido §3.4, non un difetto di questo meccanismo)", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"] }); // nessun backup dichiarato
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), "unico candidato: consuma le 8 notti del monte ore nei primi giorni consecutivi (nessuna cessione possibile senza un'alternativa con cui competere)");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 31 - 8, "dal giorno 9 in poi la notte resta scoperta (blocco rigido oltre il monte ore, §3.4, preesistente e invariato): non è una regressione introdotta dalla distribuzione temporale");
});

suite.test("Max turni mese più restrittivo del monte ore: il tetto (3) è inferiore alle vittorie naturali (8), quindi la cessione scatta davvero — il sottoinsieme tenuto è il più equidistanziato TRA LE VITTORIE EFFETTIVE, non tra i giorni disponibili", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 3, "con un tetto mensile di 3, BERTUZZI vince solo 3 notti nell'intero mese (non le 8 del monte ore, mai di più: tetto rigido)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 8]), "sottoinsieme equidistanziato scelto tra le 8 vittorie EFFETTIVE del pass 1 ([1,2,...,8], gli stessi primi 8 giorni consecutivi del primo test qui sopra), non tra tutti i 31 giorni disponibili: la finestra resta quella naturale della gerarchia");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "nessuna notte scoperta: PRESSACCO copre sempre le notti cedute da BERTUZZI");
});

suite.test("un contrattualizzato con debito ordinario esattamente pari ai giorni disponibili non viene mai demosso (nTarget >= k, nessuna restrizione reale)", () => {
  // Solo 5 giorni disponibili per BERTUZZI, ben sotto le 8 notti del suo monte ore: tutti e 5 sono
  // vinti nel pass 1 e nessuna cessione scatta (5 vittorie < tetto implicito 8).
  const d = dispoBase(MEDICI);
  [3, 10, 17, 24, 31].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]); });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 5, "BERTUZZI vince tutti e 5 i giorni in cui è disponibile: nessuna demozione quando i giorni disponibili non superano il diritto");
});

suite.test("priorità di sede ASSOLUTA sull'equidistanza (CONTEXT.md §3.11): tra i turni effettivamente vinti, un turno di livello verde peggiore viene SEMPRE ceduto per intero prima di intaccare un turno di livello migliore, anche se cedere un turno di livello migliore produrrebbe una spaziatura più uniforme", () => {
  const d = dispoBase(MEDICI);
  // BERTUZZI dichiara Maniago (livello 1, la sua sede preferita) nei giorni 3,10,17,24 e
  // Spilimbergo (livello 2, ripiego) nei giorni 6,13,20,27 — PRESSACCO copre sempre entrambe le
  // sedi da backup. Senza cap, BERTUZZI vince tutti e 8 questi turni per priorità di categoria (il
  // monte ore di 96h/8 turni si esaurisce esattamente qui, senza toccare il 9° giorno).
  const liv1 = [3, 10, 17, 24]; // Maniago, livello 1
  const liv2 = [6, 13, 20, 27]; // Spilimbergo, livello 2
  liv1.forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]);
    d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"]);
  });
  liv2.forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 2 } });
    d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"]);
  });
  // Con un tetto esplicito di 3 (inferiore alle 8 vittorie naturali), la cessione DEVE scattare:
  // il gruppo di livello 1 (4 vittorie, [3,10,17,24]) viene riempito per intero prima di
  // considerare il gruppo di livello 2 — dentro il gruppo di livello 1 si sceglie il sottoinsieme
  // più equidistanziato di 3 (scarta il giorno 10, il meno "centrale" dei 4), e TUTTO il gruppo di
  // livello 2 viene ceduto, anche se un mix avrebbe potuto distribuire meglio sull'intero mese.
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([3, 17, 24]), "BERTUZZI tiene esattamente 3 turni di livello 1 (Maniago), il sottoinsieme più equidistanziato tra i 4 vinti: nessun turno di livello 2 viene mai tenuto al suo posto");
  liv2.forEach((g) => {
    const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
    suite.eq(t.slots.includes(BERTUZZI), false, `giorno ${g} (livello 2, Spilimbergo): ceduto per intero, MAI tenuto al posto di un turno di livello 1`);
    suite.eq(t.slots.includes(PRESSACCO), true, `giorno ${g}: ceduto a PRESSACCO, nessun buco di copertura`);
  });
  const giornoScartatoLiv1 = schema.find((x) => x.giorno === 10).turni.find((x) => x.id === "N");
  suite.eq(giornoScartatoLiv1.slots.includes(PRESSACCO), true, "giorno 10 (livello 1, ma scartato dall'equidistanza): ceduto normalmente a PRESSACCO, nessun buco");
});

suite.test("selezione CROSS-LIVELLO (CONTEXT.md §3.11): quando anche il livello 2 deve essere ridotto, la scelta tiene conto della distanza dai giorni GIÀ FISSATI dal livello 1 (farthest-point), non solo dell'equidistanza interna al livello 2", () => {
  const d = dispoBase(MEDICI);
  // BERTUZZI: livello 1 (Maniago) SOLO il giorno 1 — un'unica vittoria, tenuta per intero (nessuna
  // riduzione possibile con un solo candidato). Livello 2 (Spilimbergo) sui giorni 3,5,7,28,29,30
  // (6 candidati) — PRESSACCO copre sempre entrambe le sedi da backup.
  d[BERTUZZI][N(1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(1)] = turnoDisp(["Maniago", "Spilimbergo"]);
  const liv2 = [3, 5, 7, 28, 29, 30];
  liv2.forEach((g) => {
    d[BERTUZZI][N(g)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 2 } });
    d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"]);
  });
  // Tetto esplicito di 3: il livello 1 (1 vittoria) viene riempito per intero (residuo 3→2), poi il
  // livello 2 (6 vittorie) va ridotto a 2. La pura equidistanza POSIZIONALE tra i 6 candidati di
  // livello 2 ([3,5,7,28,29,30], indici 0..5) sceglierebbe gli estremi [3,30] — ignorando che il
  // giorno 3 è vicinissimo al giorno 1 già fissato dal livello 1. La selezione CROSS-LIVELLO usa
  // invece il giorno 1 come riferimento aggiuntivo: sceglie prima il giorno più lontano da esso
  // (30, distanza 29), poi il più lontano dal riferimento aggiornato {1,30} tra i rimanenti (7,
  // distanza 6 da entrambi — più di quanto darebbe 3, a sole 2 di distanza dal giorno 1) — tenendo
  // [7,30] al posto di [3,30]: il livello 2 si incastra con il livello 1 invece di sovrapporglisi.
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 7, 30]), "tiene il giorno 1 (livello 1, intero) più i giorni 7 e 30 (livello 2, scelti anche in base alla distanza dal giorno 1 già fissato) — NON il giorno 3, che la pura equidistanza posizionale (ignara del livello 1) avrebbe scelto al suo posto");
  [3, 5, 28, 29].forEach((g) => {
    const t = schema.find((x) => x.giorno === g).turni.find((x) => x.id === "N");
    suite.eq(t.slots.includes(PRESSACCO), true, `giorno ${g} (livello 2, scartato dalla selezione cross-livello): ceduto a PRESSACCO, nessun buco di copertura`);
  });
});

suite.finish();

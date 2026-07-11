// Test sulla distribuzione temporale reale (CONTEXT.md §3.11): meccanismo a DUE PASSAGGI —
// (1) elabora tutto il mese con la sola gerarchia esistente, come oracolo per scoprire quali
// turni ciascun medico vincerebbe naturalmente; (2) per chi supera il proprio tetto (il più
// restrittivo tra monte ore implicito e Max turni mese dichiarato) sceglie, tra i turni
// EFFETTIVAMENTE vinti, il sottoinsieme più equidistanziato da tenere — raggruppato PRIMA per
// livello di sede verde ottenuta (la priorità di sede è assoluta sull'equidistanza) — e cede il
// resto al candidato successivo in gerarchia in una rielaborazione pulita e definitiva. Il tetto
// resta RIGIDO: se un turno ceduto non trova un'alternativa disponibile, resta SCOPERTO (la
// copertura non prevale mai sul tetto dichiarato). Il "pool" da cui si sceglie NON è più solo i
// turni vinti nel passaggio 1 (che il blocco monte ore §3.4 ammucchiava nei primi giorni): OGNI VOLTA
// che un medico è disponibile su più turni del proprio tetto (§3.11) — che il tetto morda per Max
// turni mese esplicito, o per il solo monte ore — il pool viene ricalcolato su TUTTO il mese con un
// oracolo che esenta SOLO quel medico dal blocco monte ore, così "vince" tutti i turni di cui è il
// legittimo vincitore per gerarchia sull'intero mese e l'equidistante li SPARGE davvero (fix del bug
// concettuale §3.11: prima la temporalità scattava solo con un cap esplicito < monte ore, lasciando
// ammucchiato il caso più comune "disponibile tutto il mese + tetto = monte ore"). Il ricalcolo è
// correttezza-neutra ma si attiva solo per chi ha davvero esaurito il monte ore in P1 (gate perf).
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
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, comeStorico } from './test_utils.mjs';

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
suite.test("disponibile tutto il mese, tetto dal solo monte ore (8): la disponibilità (31 notti) SUPERA il tetto → gli 8 turni tenuti sono SPARSI su tutto agosto, non i primi 8 consecutivi (§3.11: la temporalità vale ogni volta che la disponibilità supera il tetto, non solo quando un cap esplicito < monte ore)", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "BERTUZZI vince esattamente 8 notti (monte ore 96h/12h = tetto di distribuzione, mai di più)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "8 turni EQUIDISTANTI su tutte le 31 notti disponibili, non più [1..8] ammucchiati: fix §3.11 (il pool viene ricalcolato con l'oracolo esente ogni volta che la disponibilità supera il tetto, anche senza cap esplicito)");
  suite.eq(notti[0], 1, "primo turno = giorno 1 (estremo iniziale dell'equidistante)");
  suite.eq(notti[notti.length - 1], 31, "ultimo turno = giorno 31 (estremo finale: campata piena)");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "nessuna notte resta scoperta: PRESSACCO copre tutte le notti cedute da BERTUZZI");
});

suite.test("stesso caso con Max turni mese ESPLICITO = monte ore (tetto_mese 8): risultato identico al solo monte ore — [1,5,10,14,18,22,27,31] sparsi (il caso reale del coordinatore: 'notturni tutto il mese + max 8')", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 8 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "tetto 8 = min(monte ore 8, cap 8): 8 turni");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "sparsi su tutto il mese: un cap esplicito PARI al monte ore ora sparge come il solo monte ore (prima non scattava — era il bug concettuale)");
});

suite.test("più siti disponibili (nessuna scarsità artificiale): stesso principio, gli 8 turni tenuti sono sparsi su tutto il mese, copertura sempre completa su 2 sedi", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, {
    [BERTUZZI]: ["Maniago", "Spilimbergo"], [PRESSACCO]: ["Maniago", "Spilimbergo"], [IENGO]: ["Maniago", "Spilimbergo"],
  });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "8 vittorie tenute, pari al proprio tetto (monte ore)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "stesso pattern SPARSO su tutto il mese, anche con più concorrenti e più sedi disponibili");
  let scoperte = 0;
  schema.forEach((g) => g.turni.forEach((t) => { if (t.id === "N" && t.slots.filter((s) => s).length < 2) scoperte++; }));
  suite.eq(scoperte, 0, "entrambe le sedi (Maniago e Spilimbergo) restano sempre coperte ogni notte del mese");
});

suite.test("un titolare di sede segue le stesse regole di tutti (CONTEXT.md §3.11 punto C): nessuna esenzione dal proprio tetto, e con disponibilità piena i suoi 14 turni sono SPARSI su tutto il mese", () => {
  // DET38 titolare Maniago: 168h di monte ore (agosto non è mese aggiustato per DET38, §3.11
  // punto 3) = 14 notti. Disponibile tutte le 31 notti: la disponibilità supera il tetto (14),
  // quindi il fix §3.11 sparge i 14 turni su tutto il mese invece di ammucchiarli nei primi 14.
  // La titolarità non dà esenzione dal tetto: segue le stesse regole di distribuzione di tutti.
  const lista = MEDICI_TEST.map((m) => (m.id === BERTUZZI ? { ...m, cat: "DET38", sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 14, "14 turni (168h/12h), il tetto rigido non si supera");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 3, 6, 8, 10, 13, 15, 17, 19, 22, 24, 26, 29, 31]), "i 14 turni del titolare SPARSI su tutto agosto (equidistanti su 31 notti), non più i primi 14 consecutivi");
  suite.eq(notti[0], 1, "primo turno = giorno 1");
  suite.eq(notti[notti.length - 1], 31, "ultimo turno = giorno 31");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "le notti cedute dal titolare (le 17 non tenute) sono coperte da PRESSACCO: nessuna scoperta");
  setMediciGlobal(MEDICI_TEST);
});

suite.test("un solo candidato senza backup: consuma comunque solo il monte ore (8 turni), ora SPARSI su tutto il mese; le notti cedute restano scoperte (nessun backup) — la temporalità sparge i turni del medico anche senza concorrenti", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"] }); // nessun backup dichiarato
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "8 notti (monte ore), mai di più");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "8 turni SPARSI su tutto agosto, non più i primi 8 consecutivi: il fix §3.11 vale anche per un unico candidato (l'oracolo esente gli fa 'vincere' tutte le 31 notti, l'equidistante ne tiene 8 sparse)");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 31 - 8, "23 notti scoperte (nessun backup): il totale coperto (8) è invariato, cambia solo QUALI notti — la distribuzione le sparge invece di lasciarle tutte a fine mese");
});

suite.test("Max turni mese ESPLICITO più restrittivo del monte ore: i turni tenuti sono sparsi su TUTTO il mese, non ammucchiati nella finestra del monte ore", () => {
  // BERTUZZI (INDET, 96h = 8 turni impliciti) disponibile tutte le 31 notti, cap ESPLICITO 3.
  // Fino alla correzione §3.11 di questo bug, il pool di distribuzione erano i turni EFFETTIVAMENTE
  // vinti nel passaggio 1, dove il blocco rigido del monte ore (§3.4) esaurisce l'INDET nei primi 8
  // giorni: l'equidistante su quel pool ristretto teneva [1,5,8] — ammucchiati nella prima settimana
  // (il test precedente asseriva PROPRIO [1,5,8], codificando il bug). Ora, quando morde un cap
  // ESPLICITO più restrittivo del monte ore (3 < 8), il pool viene ricalcolato su TUTTO il mese con
  // un oracolo per-medico che esenta SOLO BERTUZZI dal blocco monte ore: vince tutte le 31 notti (è
  // INDET, batte il backup senza incarico), e l'equidistante su 31 sceglie [1,16,31] — sparsi da
  // inizio a fine mese. Il passaggio 2 resta invariato (tetto rigido: mai più di 3; 3 turni = 36h <
  // 96h di monte ore, quindi le ore bastano per tenerli tutti).
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 3, "con un tetto mensile di 3, BERTUZZI vince solo 3 notti nell'intero mese (mai di più: tetto rigido)");
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 16, 31]), "sottoinsieme equidistanziato su TUTTA la disponibilità del mese (31 notti), non solo sulla finestra del monte ore: [1,16,31] sparsi, non più [1,5,8] ammucchiati");
  const scoperte = [];
  schema.forEach((g) => { const t = g.turni.find((x) => x.id === "N"); if (!t.slots[0]) scoperte.push(g.giorno); });
  suite.eq(scoperte.length, 0, "nessuna notte scoperta: PRESSACCO copre sempre le notti cedute da BERTUZZI");
});

suite.test("regressione bug collaudo reale: DET24 disponibile TUTTE le notti + Max turni mese 4 → turni sparsi (1,10,22,31... span quasi pieno), non ammucchiati nei primi giorni", () => {
  // Il caso esatto trovato in collaudo: un DET24 (104h = 9 turni impliciti) disponibile tutte le
  // notti del mese, tetto ESPLICITO 4 (< 9). Prima della correzione otteneva giorni ammucchiati
  // nella prima settimana (es. 1,2,4,7) perché il monte ore si esauriva subito e il pool erano solo
  // quei turni iniziali. Ora deve distribuirli su tutto il mese. Uso PRESSACCO (senza incarico) come
  // ruolo storico DET24 e IENGO (senza incarico) come backup che copre le notti cedute.
  const lista = comeStorico(MEDICI_DEFAULT, PRESSACCO); // PRESSACCO torna DET24 titolare Spilimbergo
  setMediciGlobal(lista);
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [PRESSACCO]: ["Maniago"], [IENGO]: ["Maniago"] });
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [PRESSACCO]: 4 });
  const notti = vincitoriNotte(schema, PRESSACCO);
  suite.eq(notti.length, 4, "esattamente 4 notti (tetto rigido, mai di più; 4×12=48h < 104h monte ore, le ore bastano)");
  // Non fisso i giorni esatti (dipendono dal calendario), ma verifico che siano SPARSI: la campata
  // (ultimo - primo) deve coprire gran parte del mese, e nessun turno oltre il 4° deve stare tutto
  // nella prima settimana. Con equidistante su 31 notti: primo = giorno 1, ultimo = giorno 31.
  suite.eq(notti[0], 1, "il primo turno tenuto è il giorno 1 (estremo iniziale dell'equidistante)");
  suite.eq(notti[notti.length - 1], 31, "l'ultimo turno tenuto è il giorno 31 (estremo finale): la distribuzione copre TUTTO il mese");
  suite.assert(notti[notti.length - 1] - notti[0] >= 25, `campata dei turni tenuti ampia (${notti[notti.length - 1] - notti[0]} giorni), non ammucchiati nella prima settimana`);
  setMediciGlobal(MEDICI_TEST);
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

// --- SLOT OBBLIGATORI (§10 voce 49): punti fissi nella distribuzione §3.11 ---
suite.test("slot obbligatori vinti: entrano SEMPRE nei turni tenuti, consumano il tetto, e gli altri si distribuiscono ATTORNO a loro", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  [1, 15, 22].forEach((g) => { d[BERTUZZI]["OBBL:" + N(g)] = true; }); // 3 slot obbligatori (tutti vinti: BERTUZZI è INDET, li vince)
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 8 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 8, "il tetto (8) resta rigido: 3 obbligatori + 5 distribuiti");
  suite.assert([1, 15, 22].every((g) => notti.includes(g)), "i 3 slot obbligatori (1,15,22) sono SEMPRE tra i turni tenuti: " + JSON.stringify(notti));
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 4, 8, 11, 15, 22, 26, 31]), "gli altri 5 turni si distribuiscono ATTORNO ai 3 punti fissi (equidistante col seed 1,15,22)");
});
suite.test("slot obbligatorio NON vinto per gerarchia (slot non nel pool): ignorato silenziosamente, la distribuzione non cambia", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  // BERTUZZI dichiara solo i NOTTURNI; marco obbligatorio un DIURNO (G) del 2 ago (weekend) che NON ha
  // dichiarato → quello slot non è nel suo pool → obbligatorio ignorato. La sua distribuzione notturna
  // resta identica al caso senza obbligatori ([1,5,10,14,18,22,27,31]).
  d[BERTUZZI]["OBBL:" + `${dk(ANNO_TEST, MESE_TEST, 2)}|G`] = true;
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {});
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(JSON.stringify(notti), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "obbligatorio su slot non vinto = nessun effetto: stessa distribuzione del caso senza obbligatori");
  const g2 = schema.find((x) => x.giorno === 2).turni.find((t) => t.id === "G");
  suite.eq(g2.slots.includes(BERTUZZI), false, "il diurno del 2 ago NON è forzato a BERTUZZI (non l'aveva dichiarato)");
});
suite.test("slot obbligatorio di livello PEGGIORE scavalca la priorità di livello (è tenuto comunque, consumando il tetto)", () => {
  const d = dispoBase(MEDICI);
  const liv1 = [3, 10, 17, 24]; // Maniago livello 1
  const liv2 = [6, 13, 20, 27]; // Spilimbergo livello 2
  liv1.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"]); });
  liv2.forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Spilimbergo"], [], { verdeLiv: { Spilimbergo: 2 } }); d[PRESSACCO][N(g)] = turnoDisp(["Maniago", "Spilimbergo"]); });
  // Senza obbligatori + tetto 3 → [3,17,24] (tutti livello 1, vedi test priorità di sede). Marco
  // obbligatorio il giorno 6 (livello 2): DEVE essere tenuto comunque, scavalcando la priorità di livello.
  d[BERTUZZI]["OBBL:" + N(6)] = true;
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 3 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  suite.eq(notti.length, 3, "tetto 3 rigido: l'obbligatorio consuma un posto");
  suite.assert(notti.includes(6), "il giorno 6 (livello 2, obbligatorio) è tenuto pur essendo di livello peggiore: " + JSON.stringify(notti));
});
suite.test("⚓ pin SEDE: l'obbligatorio scatta solo se la sede VINTA combacia con quella pinnata, altrimenti ignorato", () => {
  const base = () => { const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] }); return d; };
  const notti = (d) => vincitoriNotte(elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, {}, {}, { [BERTUZZI]: 8 }).schema, BERTUZZI);
  // BERTUZZI vince sempre Maniago (unica sede dichiarata). Pin "Maniago" sul 15 → MATCH → 15 tenuto.
  const dM = base(); dM[BERTUZZI]["OBBL:" + N(15)] = "Maniago";
  const nM = notti(dM);
  suite.assert(nM.includes(15), "pin sede Maniago (sede vinta) → il 15 è tenuto: " + JSON.stringify(nM));
  // Pin "Spilimbergo" sul 15 → MISMATCH (vince Maniago) → ignorato → distribuzione = caso base [1,5,10,14,18,22,27,31].
  const dS = base(); dS[BERTUZZI]["OBBL:" + N(15)] = "Spilimbergo";
  suite.eq(JSON.stringify(notti(dS)), JSON.stringify([1, 5, 10, 14, 18, 22, 27, 31]), "pin sede Spilimbergo (sede NON vinta) → ignorato: stessa distribuzione del caso senza pin");
});

suite.test("MMG vinto = punto fisso automatico (§10 voce 49, opzione C): l'MMG conta nel tetto ma NON è mai ceduto, le guardie si distribuiscono attorno al suo giorno", () => {
  const d = tutteLeNotti(ANNO_TEST, MESE_TEST, { [BERTUZZI]: ["Maniago"], [PRESSACCO]: ["Maniago"] });
  d[BERTUZZI][`${dk(ANNO_TEST, MESE_TEST, 15)}|M`] = turnoDisp(["Maniago"]); // MMG mattina il 15 a Maniago, BERTUZZI lo vince
  const { schema } = elaboraSchema(d, {}, ANNO_TEST, MESE_TEST, { [dk(ANNO_TEST, MESE_TEST, 15)]: { M: true, M_sede: "Maniago" } }, {}, { [BERTUZZI]: 4 });
  const notti = vincitoriNotte(schema, BERTUZZI);
  const mmg = schema.find((g) => g.giorno === 15).turni.find((t) => t.id === "M").slots[0];
  suite.eq(mmg, BERTUZZI, "l'MMG del 15 NON è mai ceduto: resta assegnato a BERTUZZI (protetto dalla cessione)");
  suite.eq(notti.length + 1, 4, "l'MMG consuma un posto del tetto (invariante): 1 MMG + 3 notturni = tetto 4");
  suite.assert(!notti.includes(15), "il 15 è occupato dall'MMG: nessun notturno lì");
  suite.assert(Math.min(...notti.map((g) => Math.abs(g - 15))) >= 5, "le 3 guardie si distribuiscono LONTANO dal 15 (ancora): " + JSON.stringify(notti));
});

suite.finish();

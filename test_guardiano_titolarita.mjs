// Test del GUARDIANO titolarità §3.1a (§10 voce 33): controllo finale additivo che segnala (senza
// correggere) il residuo raro delle catene di ricollocazione — un titolare fuori dalla propria sede
// mentre quella è tenuta da un non-titolare. Storicamente riproduceva due scenari REALI seedati in cui
// il residuo si manifestava; il fix §3.11 (§10 voce 48) ha però eliminato quei residui (0 in 100.000
// scenari), quindi i due test positivi sono stati rimossi (vedi la NOTA più sotto). Resta il test di
// NON-falso-positivo; la verifica a scala del guardiano è ora l'invariante INV-TITOLARE della sim.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, dk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, SEDI5, isDeterminato, isContrattualizzato, MESI_DISPONIBILI, settimanaDi } from './engine_test.mjs';
import { makeSuite } from './test_utils.mjs';
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 800 semi × 125 mesi = 100.000 scenari (CONTEXT.md §12): copre ogni combinazione di
// weekend/festivi/prefestivi presente nel calendario dell'app, ripetuta con molte
// combinazioni casuali diverse di disponibilità/titolarità/turni extra/tetti mensili.
const SEMI = Array.from({ length: 800 }, (_, i) => i + 1);
const IDX_MESI = MESI_DISPONIBILI.map((_, i) => i);

let checkCount = 0;
let violazioni = [];
// Violazioni INV-TITOLARE tollerate perché corrispondono ESATTAMENTE al limite noto §3.1a/§10
// (catena di ricollocazione ricorsiva in FASE1 con 3+ contrattualizzati — determinati o INDET —
// che si contendono sedi sovrapposte): NON fanno fallire la sim (fixarle in FASE1 introduce
// regressioni peggiori, §10), ma vengono comunque RIPORTATE per non mascherarle. Qualunque
// violazione di titolarità con ≤2 contrattualizzati presenti NON è questo pattern e resta un
// fallimento vero (§10 voce 22).
let tolleratiTitolarita = [];

// Assegna titolarità casuali ad alcuni determinati, per esercitare anche quel percorso
// nella simulazione massiva (deterministico rispetto al seme).
function generaMediciConTitolarita(seed) {
  const rnd = mulberry32(seed);
  return MEDICI_DEFAULT.map((m) => {
    if (!isDeterminato(m.id) && m.cat !== "DET38" && m.cat !== "DET24") return { ...m };
    const haTitolarita = rnd() < 0.25;
    return { ...m, sedeContratto: haTitolarita ? (rnd() < 0.5 ? "Maniago" : "Spilimbergo") : null };
  });
}

function generaScenario(seed, anno, mese) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  const extras = {};
  for (let d = 1; d <= nGiorni; d++) if (chance(0.1)) extras[dk(anno, mese, d)] = { M: chance(0.5), P: chance(0.5) };

  // Combinazioni estreme (CONTEXT.md §12): alcuni medici con ZERO disponibilità dichiarata in
  // tutto il mese (restano candidati "assenti", mai eleggibili), altri disponibili TUTTI i 31
  // giorni (nessun giorno saltato dalla compilazione casuale), un altro sottoinsieme in ferie
  // esplicite (NO dichiarato su ogni turno del mese, percorso codice diverso dalla semplice
  // assenza di dichiarazione ma stesso effetto di ineleggibilità).
  const zeroDispo = new Set(MEDICI.filter(() => chance(0.08)).map((m) => m.id));
  const pienaDispo = new Set(MEDICI.filter((m) => !zeroDispo.has(m.id) && chance(0.08)).map((m) => m.id));
  const ferieTotali = new Set(MEDICI.filter((m) => !zeroDispo.has(m.id) && !pienaDispo.has(m.id) && chance(0.05)).map((m) => m.id));

  const SEDI_MAGGIORI = ["Maniago", "Spilimbergo", "Meduno"];
  const dispo = {};
  MEDICI.forEach((m) => {
    dispo[m.id] = {};
    if (zeroDispo.has(m.id)) return; // nessuna dichiarazione per l'intero mese
    const casa = pick(SEDI5);
    const altre = SEDI5.filter((s) => s !== casa);
    const nBlu = 1 + Math.floor(rnd() * 3);
    const blu = []; const bluLiv = {};
    for (let i = 0; i < nBlu; i++) { const s = pick(altre); if (!blu.includes(s)) { blu.push(s); bluLiv[s] = 1 + Math.floor(rnd() * MAX_LIV_BLU); } }
    const verde2 = chance(0.2) ? pick(SEDI_MAGGIORI.filter((s) => s !== casa)) : null;
    // #23 (censimento): ogni tanto la seconda sede verde è a un LIVELLO DIVERSO dalla prima (casa),
    // invece che sempre a pari livello — così la scelta tra sedi verdi di priorità diversa
    // (ordinaPerLivello / livelloVerdeDi / rami "liv > maxLiv" e ricollocazione "a livello peggiore"
    // in provaFisica) viene finalmente esercitata dalla simulazione. Il livello di verde2 viene poi
    // rerollato per-giorno (vedi sotto), così a volte casa è migliore, a volte verde2.
    const verde2DiffLiv = verde2 !== null && chance(0.4);

    for (let d = 1; d <= nGiorni; d++) {
      const info = turniDelGiorno(anno, mese, d, extras);
      info.turni.forEach((turno) => {
        const slotKey = `${info.key}|${turno.id}`;
        if (ferieTotali.has(m.id)) { dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true }; return; }
        if (!pienaDispo.has(m.id) && chance(0.3)) return; // giorno non compilato affatto (nessuna dichiarazione)
        if (turno.extra) {
          if (chance(0.3)) dispo[m.id][slotKey] = { verde: [casa], verdeLiv: {}, blu: [], bluLiv: {}, no: false };
          return;
        }
        if (!pienaDispo.has(m.id) && chance(0.2)) {
          dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true };
          return;
        }
        const verde = [casa]; const verdeLiv = { [casa]: 1 + Math.floor(rnd() * MAX_LIV_VERDE) };
        if (verde2) {
          verde.push(verde2);
          if (verde2DiffLiv && MAX_LIV_VERDE > 1) {
            // livello diverso da casa (a volte migliore, a volte peggiore): esercita la scelta tra
            // sedi verdi di priorità diversa (#23)
            let lv; do { lv = 1 + Math.floor(rnd() * MAX_LIV_VERDE); } while (lv === verdeLiv[casa]);
            verdeLiv[verde2] = lv;
          } else {
            verdeLiv[verde2] = verdeLiv[casa]; // pari livello: indifferenti (comportamento storico)
          }
        }
        dispo[m.id][slotKey] = {
          verde, verdeLiv, blu: [...blu], bluLiv: { ...bluLiv },
          no: false,
        };
      });
      // #22 preferenza turno G/N (§3.9): solo sui giorni con ENTRAMBI i turni (weekend/festivi/
      // prefestivi), ogni tanto, per far attraversare alla sim la logica di scambio turno stesso
      // giorno. È un no-op se il medico non vince fisicamente sia G che N — ma una frazione lo farà.
      if (!ferieTotali.has(m.id) && info.turni.some((t) => t.id === "G") && chance(0.06)) {
        dispo[m.id]["TURNOPREF:" + info.key] = chance(0.5) ? "G" : "N";
      }
    }
    // #21 tetto settimanale (§3.8): ogni tanto un medico ha un cap settimanale basso (1-2
    // turni/settimana) su tutte le settimane del mese, per far attraversare alla sim la logica di
    // conteggio/blocco settimanale (capSettimanale + settimanaCount in candidatiOrdinati).
    if (!ferieTotali.has(m.id) && chance(0.1)) {
      const capSett = 1 + Math.floor(rnd() * 2);
      const settViste = new Set();
      for (let d = 1; d <= nGiorni; d++) {
        const wk = settimanaDi(dk(anno, mese, d));
        if (settViste.has(wk)) continue;
        settViste.add(wk);
        dispo[m.id]["SETT:" + wk] = { maxTurni: capSett };
      }
    }
  });
  const extraOre = {};
  MEDICI.forEach((m) => { if (chance(0.15)) extraOre[m.id] = Math.floor((rnd() - 0.3) * 60); });
  // Turni extra volontari (§3.10): dichiarati solo per contrattualizzati (senza incarico non ha
  // senso, il motore li ignorerebbe comunque — cfr. test_turni_extra.mjs).
  const turniExtra = {};
  MEDICI.forEach((m) => { if (CAT_INFO[m.cat].ore !== null && chance(0.2)) turniExtra[m.id] = 1 + Math.floor(rnd() * 4); });
  // Max turni mese (§3.11, punto 1): tetto dichiarato dal coordinatore, valido per QUALSIASI
  // categoria (anche senza incarico) — a volte deliberatamente molto restrittivo (1-3) per
  // stressare il blocco rigido anche con debito ordinario ampiamente positivo.
  const maxTurniMese = {};
  MEDICI.forEach((m) => { if (chance(0.15)) maxTurniMese[m.id] = chance(0.5) ? 1 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 10); });
  return { dispo, extras, extraOre, turniExtra, maxTurniMese };
}

const suite = makeSuite("test_guardiano_titolarita — avviso residuo §3.1a (§10 voce 33)");

function avvisiDi(seed, idxMese) {
  setMediciGlobal(generaMediciConTitolarita(seed * 7919));
  const { anno, mese } = MESI_DISPONIBILI[idxMese];
  const { dispo, extras, extraOre, turniExtra, maxTurniMese } = generaScenario(seed * 1000 + idxMese, anno, mese);
  const { avvisi } = elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra, maxTurniMese);
  return avvisi;
}

// NOTA (§10 voce 48): i due test "positivi" storici (seed 1212 = residuo NOTTURNO BEKAEVA/Spilimbergo;
// seed 1390 = residuo DIURNO VALERI/Spilimbergo) sono stati RIMOSSI. Il fix della distribuzione temporale
// §3.11 (voce 48: il pool viene sparso su tutto il mese ogni volta che la disponibilità supera il tetto)
// ha cambiato abbastanza le dinamiche FASE1 da FAR SPARIRE quei residui: i due seed non li producono più,
// e — effetto collaterale POSITIVO — nell'intera simulazione da 100.000 scenari NON compare più ALCUN
// residuo §3.1a (0 violazioni INV-TITOLARE, 0 tollerati, vs i pochi tollerati di prima). Cercare nuovi
// seed è impraticabile (0 residui in ~7.500 scenari a semi bassi + 0 nei 100.000 della sim) e costruirne
// uno deterministico non è fattibile (è un limite EMERGENTE della catena FASE1, non componibile a mano).
// Il CODICE del guardiano (turni-guardia-medica.jsx righe ~1152-1174) è INVARIATO e resta corretto; la
// sua verifica a scala è ora `INV-TITOLARE` nella simulazione massiva (test_simulazione_completa.mjs, §8),
// che continua a esercitarlo su 100.000 scenari. Resta qui il test di NON-falso-positivo.

suite.test("il guardiano NON scatta su uno scenario senza residuo (seed 1, 2026-08): nessun avviso 'assegnato altrove'", () => {
  const g = avvisiDi(1, 0).filter((a) => a.includes("assegnato altrove"));
  suite.eq(g.length, 0, "nessun residuo → nessun avviso guardiano");
});

suite.finish();

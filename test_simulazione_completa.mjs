// Simulazione massiva: scenari casuali con tutti i 26 medici, su più mesi e più semi,
// verificando gli invarianti (CONTEXT.md §5) su OGNI singolo turno prodotto.
// È il test più importante del pacchetto: non verifica un caso puntuale, ma che il
// motore non violi mai le sue garanzie fondamentali qualunque combinazione di
// disponibilità verde/blu, titolarità, turni extra e tetti mensili gli venga data in pasto.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, dk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, SEDI5, isDeterminato, MESI_DISPONIBILI } from './engine_test.mjs';

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

// Assegna titolarità casuali ad alcuni determinati, per esercitare anche quel percorso
// nella simulazione massiva (deterministico rispetto al seme).
function generaMediciConTitolarita(seed) {
  const rnd = mulberry32(seed);
  return MEDICI_DEFAULT.map((m) => {
    if (!isDeterminato(m.id) && m.cat !== "DET36" && m.cat !== "DET24") return { ...m };
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

    for (let d = 1; d <= nGiorni; d++) {
      const info = turniDelGiorno(anno, mese, d, extras);
      info.turni.forEach((turno) => {
        const slotKey = `${info.key}|${turno.id}`;
        if (ferieTotali.has(m.id)) { dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null }; return; }
        if (!pienaDispo.has(m.id) && chance(0.3)) return; // giorno non compilato affatto (nessuna dichiarazione)
        if (turno.extra) {
          if (chance(0.3)) dispo[m.id][slotKey] = { verde: [casa], verdeLiv: {}, blu: [], bluLiv: {}, no: false, preferito: chance(0.03) ? casa : null };
          return;
        }
        if (!pienaDispo.has(m.id) && chance(0.2)) {
          dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null };
          return;
        }
        const verde = [casa]; const verdeLiv = { [casa]: 1 + Math.floor(rnd() * MAX_LIV_VERDE) };
        if (verde2) { verde.push(verde2); verdeLiv[verde2] = verdeLiv[casa]; } // pari livello: indifferenti
        dispo[m.id][slotKey] = {
          verde, verdeLiv, blu: [...blu], bluLiv: { ...bluLiv },
          no: false, preferito: chance(0.03) ? pick(verde) : null,
        };
      });
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

console.log("=== test_simulazione_completa — scenari randomici × mesi × semi (con titolarità, turni extra, tetti mensili) ===\n");
let scenari = 0;
// contatori globali per verificare a fine mese l'invariante "Max turni mese mai superato"
let meseCountPerScenario = {};

function verificaTurno(giorno, t, dispo, slotKeyBase, turniExtra, contesto) {
  if (!t) return;
  const slotKey = `${slotKeyBase}|${t.id}`;
  const pfx = contesto ? contesto + " " : "";
  if (t.extra) {
    const mid = t.slots[0];
    checkCount++;
    if (mid) {
      const v = normDispo(dispo[mid]?.[slotKey]);
      if (v.no) violazioni.push(`${pfx}g${giorno} ${t.label}: NO assegnato a extra (INV2)`);
      if (!v.verde.length) violazioni.push(`${pfx}g${giorno} ${t.label}: extra senza disponibilità verde dichiarata (INV1)`);
      meseCountPerScenario[mid] = (meseCountPerScenario[mid] || 0) + 1;
    }
    return;
  }
  const fisSet = new Set(t.fis);
  const bluDaMedico = {}; // conteggio sedi coperte a distanza per medico, in questo turno
  t.slots.forEach((mid, si) => {
    checkCount++;
    if (!mid) return;
    const v = normDispo(dispo[mid]?.[slotKey]);
    if (v.no) violazioni.push(`${pfx}g${giorno} ${t.label} ${SEDI5[si]}: NO esplicito presente in slots (INV2)`);
    if (fisSet.has(si)) {
      const site = SEDI5[si];
      if (!v.verde.includes(site)) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[mid]?.nome} fisico a ${site} senza averla dichiarata come verde (INV1)`);
      meseCountPerScenario[mid] = (meseCountPerScenario[mid] || 0) + 1; // solo la presenza FISICA consuma il tetto mensile (§3.11), mai la copertura blu
    } else {
      // INV3: la copertura a distanza deve provenire da un fisico DI QUESTO turno
      const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
      if (!presenteAltrove) violazioni.push(`${pfx}g${giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
      // deve aver dichiarato quella sede come blu
      if (!v.blu.includes(SEDI5[si])) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${SEDI5[si]} a distanza senza averla dichiarata come blu`);
      bluDaMedico[mid] = (bluDaMedico[mid] || 0) + 1;
    }
  });
  // REGOLA GENERALE: un medico copre al massimo 1 sede a distanza
  checkCount++;
  Object.entries(bluDaMedico).forEach(([mid, n]) => {
    if (n > 1) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${n} sedi a distanza, il massimo consentito è 1`);
  });

  // INV-TITOLARE (§3.1a, §3.11): un titolare di sede che oggi dichiara quella sede come sua
  // PRIMA scelta verde (non "no") e la sede risulta comunque coperta da qualcun altro, non può
  // essere fisicamente presente altrove nello STESSO turno — se è ancora un candidato attivo
  // con debito ORDINARIO residuo (bucket 0), la titolarità deve sempre fargli vincere la propria
  // sede. Non richiede di ricostruire il debito esatto: se il titolare non è più eleggibile
  // (monte ore o tetto esauriti, nessun turno extra dichiarato), semplicemente non compare più
  // tra i fisici e il check non scatta. ESCLUSO deliberatamente chi ha turniExtra dichiarati:
  // una volta esaurito il debito ordinario, un turno extra fa competere ANCHE un titolare come
  // puro senza incarico (bucket 1, solo graduatoria — cfr. test_turni_extra.mjs), perdendo
  // legittimamente la propria titolarità per il resto del mese; senza rigiocare il debito esatto
  // giorno per giorno non è possibile distinguere questo caso legittimo da una vera violazione.
  // ESCLUSO anche quando l'occupante non è determinato (la titolarità vale "solo tra
  // determinati", CONTEXT.md §3.1a: un INDET di categoria migliore vince legittimamente anche
  // contro un titolare) o quando l'occupante è ANCH'ESSO titolare della stessa sede (la
  // generazione casuale può assegnare la stessa titolarità a più medici nello stesso seme: in
  // quel caso titolarità non discrimina tra loro, decide il normale spareggio categoria/debito/grad).
  //
  // Bug storico risolto (vedi CONTEXT.md §10): in scenari con 3+ determinati che si contendono
  // più sedi sovrapposte nello STESSO turno, catene profonde di ricollocazione ricorsiva in
  // provaFisica potevano convergere a un equilibrio instabile in cui un titolare finiva
  // fisicamente altrove pur avendo diritto alla propria sede. Risolto con una funzione dedicata
  // (correggiTitolarita) mirata SOLO ai titolari, eseguita dopo FASE1 e dopo la spaziatura
  // temporale — non con una ripetizione generica dell'intero ciclo FASE1 (tentativo scartato:
  // introduceva regressioni reali di copertura altrove, la ricollocazione per indifferenza non è
  // idempotente su stati già stabili). Emerso solo alla scala di questa simulazione.
  MEDICI.forEach((m) => {
    if (!isDeterminato(m.id) || byId[m.id].sedeContratto === null) return;
    if (turniExtra && turniExtra[m.id]) return;
    const S = byId[m.id].sedeContratto;
    const si = SEDI5.indexOf(S);
    const v = normDispo(dispo[m.id]?.[slotKey]);
    if (v.no || !v.verde.includes(S)) return;
    if (ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE)[0] !== S) return; // oggi preferisce un'altra sede propria: non forziamo
    if (t.slots[si] === null || t.slots[si] === undefined) return; // sede non coperta oggi da nessuno: non è un furto di titolarità
    const occ = t.slots[si];
    if (!isDeterminato(occ) || (isDeterminato(occ) && byId[occ].sedeContratto === S)) return; // occupante non determinato, o titolare della stessa sede: nessuna violazione possibile
    checkCount++;
    const suoIndiceFisico = t.fis.find((fi) => t.slots[fi] === m.id);
    if (suoIndiceFisico !== undefined && suoIndiceFisico !== si) {
      violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[m.id].nome} titolare di ${S} (sua prima scelta oggi) presente fisicamente altrove mentre ${S} va a ${byId[t.slots[si]]?.nome} (INV-TITOLARE)`);
    }
  });
}

for (const seedBase of SEMI) {
  const mediciSeed = generaMediciConTitolarita(seedBase * 7919);
  setMediciGlobal(mediciSeed);
  for (const idxMese of IDX_MESI) {
    const { anno, mese } = MESI_DISPONIBILI[idxMese];
    const { dispo, extras, extraOre, turniExtra, maxTurniMese } = generaScenario(seedBase * 1000 + idxMese, anno, mese);
    let schema;
    try {
      ({ schema } = elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra, maxTurniMese));
    } catch (e) {
      violazioni.push(`ECCEZIONE seme=${seedBase} mese=${anno}-${mese + 1}: ${e.message}`);
      continue;
    }
    meseCountPerScenario = {};
    const contesto = `seme=${seedBase} mese=${anno}-${mese + 1}`;
    schema.forEach((g) => g.turni.forEach((t) => verificaTurno(g.giorno, t, dispo, g.key, turniExtra, contesto)));
    // INV-MAXTURNI (§3.11, punto 1): il tetto mensile dichiarato non è MAI superato, per nessuna
    // categoria (contrattualizzato o senza incarico), qualunque debito residuo o priorità.
    Object.entries(maxTurniMese).forEach(([midStr, cap]) => {
      const mid = Number(midStr);
      checkCount++;
      const usati = meseCountPerScenario[mid] || 0;
      if (usati > cap) violazioni.push(`seme=${seedBase} mese=${anno}-${mese + 1}: ${byId[mid]?.nome} ha ${usati} turni assegnati, oltre il tetto mensile di ${cap} (INV-MAXTURNI)`);
    });
    scenari++;
  }
}
setMediciGlobal(MEDICI_DEFAULT);

console.log(`Scenari elaborati: ${scenari} (${SEMI.length} semi × ${IDX_MESI.length} mesi, titolarità/turni extra/tetti mensili casuali per seme)`);
console.log(`Check di invariante eseguiti: ${checkCount}`);

if (violazioni.length) {
  console.log(`\n❌ ${violazioni.length} VIOLAZIONI:`);
  violazioni.slice(0, 40).forEach((v) => console.log(" - " + v));
  if (violazioni.length > 40) console.log(`  ... e altre ${violazioni.length - 40}`);
  console.log(`\n❌ ${violazioni.length} FALLITI`);
  process.exit(1);
} else {
  console.log(`\n✅ TUTTI I TEST SUPERATI — 0 violazioni su ${checkCount} check`);
  process.exit(0);
}

// Simulazione massiva: scenari casuali con tutti i 14 medici, su più mesi e più semi,
// verificando gli invarianti (CONTEXT.md §5) su OGNI singolo turno prodotto.
// È il test più importante del pacchetto: non verifica un caso puntuale, ma che il
// motore non violi mai le sue garanzie fondamentali qualunque combinazione di
// disponibilità verde/blu, titolarità, turni extra e tetti mensili gli venga data in pasto.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, dk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, SEDI5, isDeterminato, isContrattualizzato, MESI_DISPONIBILI, debitoOrdinarioIniziale, tettoDistribuzioneDi, settimanaDi, capSettimanale } from './engine_test.mjs';

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
  // MMG attivati casualmente (§10 voce 55): la sola attivazione (M/P). La sede e la copertura a
  // distanza le decide il motore dalle disponibilità dei medici, come per un turno ordinario.
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
    // §10 voce 56: una frazione dei medici dichiara la copertura a distanza (blu) SOLO su un sotto-periodo
    // del mese (es. "copro X a distanza dal 10 al 20") invece che su tutti i giorni. Così la blu VARIA
    // per-giorno e la sim esercita lo swap-nudge di scegliConRiferimento (inerte sulla blu uniforme).
    const bluParziale = blu.length > 0 && chance(0.25);
    const bluDa = 1 + Math.floor(rnd() * nGiorni);
    const bluA = bluDa + Math.floor(rnd() * (nGiorni - bluDa + 1));

    for (let d = 1; d <= nGiorni; d++) {
      const bluAttiva = !bluParziale || (d >= bluDa && d <= bluA); // giorno dentro la finestra blu parziale
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
          verde, verdeLiv, blu: bluAttiva ? [...blu] : [], bluLiv: bluAttiva ? { ...bluLiv } : {},
          no: false, preferito: chance(0.03) ? pick(verde) : null,
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
    // Slot obbligatori (§3.11, §10 voce 49): ogni tanto un medico marca qualcuno dei suoi slot dichiarati
    // come obbligatorio (chiave OBBL:), per far attraversare alla sim il ramo dei "punti fissi" nella
    // distribuzione. Non deve MAI causare violazioni: un obbligatorio consuma il tetto come un turno
    // qualsiasi (INV-MAXTURNI/INV-TETTO-IMPLICITO restano validi) ed è un turno legittimamente vinto.
    if (!ferieTotali.has(m.id) && chance(0.15)) {
      Object.keys(dispo[m.id]).forEach((sk) => {
        if (sk.startsWith("SETT:") || sk.startsWith("TURNOPREF:") || sk.startsWith("OBBL:")) return;
        const v = dispo[m.id][sk];
        if (v.no || !chance(0.2)) return;
        // 40% pin SEDE (una delle sedi verdi dichiarate, se ce ne sono), altrimenti pin libero (true).
        dispo[m.id]["OBBL:" + sk] = (v.verde && v.verde.length && chance(0.4)) ? v.verde[Math.floor(rnd() * v.verde.length)] : true;
      });
    }
    // Finestra settimanale (§10 voce 57): ogni tanto un medico dichiara un MINIMO (1-3) di turni su UNA
    // settimana del mese, per esercitare il bias §3.11 (Part A) e l'avviso di shortfall (Part B). Non deve
    // MAI causare violazioni: consuma il tetto come un turno qualsiasi e, se non soddisfacibile, avvisa.
    if (!ferieTotali.has(m.id) && chance(0.12)) {
      const settDelMese = [...new Set([...Array(nGiorni)].map((_, i) => settimanaDi(dk(anno, mese, i + 1))))];
      const wkScelta = settDelMese[Math.floor(rnd() * settDelMese.length)];
      dispo[m.id]["SETTWK:" + wkScelta] = 1 + Math.floor(rnd() * 3);
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
// Conteggio turni (fisici + extra) per medico E per settimana (chiave `${mid}|${wk}`, wk = lunedì
// della settimana lun-dom): usato da INV-TETTO-SETTIMANALE (§3.8, censimento #11). Stesso criterio
// del monte mensile — la copertura a distanza (blu) NON conta, esattamente come non conta per il
// tetto mensile né per il conteggio settimanale interno del motore (settimanaCount).
let settimanaCountPerScenario = {};

function verificaTurno(giorno, t, dispo, slotKeyBase, turniExtra, contesto) {
  if (!t) return;
  const slotKey = `${slotKeyBase}|${t.id}`;
  const wk = settimanaDi(slotKeyBase); // lunedì della settimana lun-dom del turno (§3.8)
  const pfx = contesto ? contesto + " " : "";
  // MMG unificati (§10 voce 51): un turno MMG ha una sede fisica reale e passa dagli STESSI controlli
  // di un ordinario (INV1 fisico=verde, tetto mensile/settimanale sui FISICI, INV3/territoriale sulla
  // copertura a distanza) — niente più ramo separato su slots[0].
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
      settimanaCountPerScenario[`${mid}|${wk}`] = (settimanaCountPerScenario[`${mid}|${wk}`] || 0) + 1; // e il tetto settimanale (§3.8), stesso criterio
    } else {
      // INV3: la copertura a distanza deve provenire da un fisico DI QUESTO turno
      const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
      if (!presenteAltrove) violazioni.push(`${pfx}g${giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
      // deve aver dichiarato quella sede come blu (per gli MMG identico agli ordinari: la copertura
      // a distanza viene dalla blu del medico, §10 voce 55)
      if (!v.blu.includes(SEDI5[si])) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${SEDI5[si]} a distanza senza averla dichiarata come blu`);
      // INV-TERRITORIALE (§3.2, §10 voce 31): Claut coperta a distanza SOLO dal fisico di Maniago (0);
      // Anduins SOLO dal fisico di Spilimbergo (1) o Meduno (2). Le altre sedi non hanno vincolo. Uso
      // la sede-base fisica del medico nel turno (dove è fisicamente presente). Vincolo rigido.
      const baseFisica = t.fis.find((fi) => t.slots[fi] === mid);
      checkCount++;
      if (baseFisica !== undefined) {
        if (si === 3 && baseFisica !== 0) violazioni.push(`${pfx}g${giorno} ${t.label}: Claut coperta a distanza da ${byId[mid]?.nome} fisico a ${SEDI5[baseFisica]} (non Maniago) (INV-TERRITORIALE)`);
        if (si === 4 && baseFisica !== 1 && baseFisica !== 2) violazioni.push(`${pfx}g${giorno} ${t.label}: Anduins coperta a distanza da ${byId[mid]?.nome} fisico a ${SEDI5[baseFisica]} (non Spilimbergo/Meduno) (INV-TERRITORIALE)`);
      }
      bluDaMedico[mid] = (bluDaMedico[mid] || 0) + 1;
    }
  });
  // REGOLA GENERALE: un medico copre al massimo 1 sede a distanza
  checkCount++;
  Object.entries(bluDaMedico).forEach(([mid, n]) => {
    if (n > 1) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${n} sedi a distanza, il massimo consentito è 1`);
  });
  // INV-FISICO-UNICO (censimento #10): un medico non può essere FISICAMENTE presente in due sedi
  // diverse dello stesso turno (una persona non si sdoppia). Vincolo rigido, nessuna eccezione
  // legittima → nessun falso positivo possibile. La copertura a distanza (blu) NON conta: è una
  // presenza logica da un'unica sede fisica, già limitata a 1 dal check sopra.
  checkCount++;
  const fisConteggio = {};
  t.fis.forEach((si) => { const id = t.slots[si]; if (id != null) fisConteggio[id] = (fisConteggio[id] || 0) + 1; });
  Object.entries(fisConteggio).forEach(([id, n]) => {
    if (n > 1) violazioni.push(`${pfx}g${giorno} ${t.label}: ${byId[id]?.nome} fisico in ${n} sedi diverse nello stesso turno (INV-FISICO-UNICO)`);
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
      // Distinzione limite-noto vs violazione vera (§10 voce 22): il limite noto §3.1a è la catena
      // di ricollocazione ricorsiva di FASE1 (provaFisica), che richiede 3+ CONTRATTUALIZZATI che si
      // contendono sedi sovrapposte nello stesso turno. Si contano i contrattualizzati — determinati
      // E INDET — perché entrambi partecipano SIA alla catena di ricollocazione SIA alla priorità di
      // titolarità (§3.1a: "titolarità vale tra tutti i contrattualizzati, INDET incluso"); contare i
      // soli determinati sottostima la catena (caso reale seed 28: chain BERTUZZI[INDET]+2 DET → 3
      // contrattualizzati ma 2 determinati). Se i contrattualizzati fisicamente presenti sono ≥3 (il
      // titolare spostato + l'occupante della sua sede + almeno un terzo che chiude la catena) è
      // esattamente quel pattern → tollerato ma RIPORTATO. Con ≤2 contrattualizzati non esiste catena
      // profonda (correggiTitolarita converge sempre): sarebbe una violazione VERA e diversa →
      // fallimento. La distinzione tiene la tolleranza stretta al limite noto senza mascherare bug.
      // Dimensione REALE della catena §3.1a: i contrattualizzati (determinati + INDET) che CONTENDONO
      // la sede contesa S (l'hanno dichiarata verde, non NO) in questo turno — NON solo quelli rimasti
      // fisicamente in slots. La catena di ricollocazione spinge FUORI alcuni contendenti (verso una blu
      // o lasciandoli inutilizzati): contarli per presenza fisica (t.fis) SOTTOSTIMA la catena — è il
      // caso reale seme=552 (4 contendono Maniago: ZURLO/BEKAEVA/FOSCHIANI titolari + MARTINETTI, ma solo
      // 2 fisicamente presenti). Con 3+ contendenti sulla sede contesa esiste la catena profonda che
      // correggiTitolarita non sempre scioglie (limite noto §3.1a) → tollerato ma RIPORTATO. Con ≤2
      // contendenti non c'è catena (risoluzione sempre convergente): sarebbe una violazione VERA → fallimento.
      const contendentiSede = MEDICI.filter((mm) => { const vv = normDispo(dispo[mm.id]?.[slotKey]); return isContrattualizzato(mm.id) && !vv.no && vv.verde.includes(S); });
      const msg = `${pfx}g${giorno} ${t.label}: ${byId[m.id].nome} titolare di ${S} (sua prima scelta oggi) presente fisicamente altrove mentre ${S} va a ${byId[t.slots[si]]?.nome} (INV-TITOLARE)`;
      if (contendentiSede.length >= 3) tolleratiTitolarita.push(`${msg} [tollerato: limite noto §3.1a, ${contendentiSede.length} contrattualizzati contendono ${S}]`);
      else violazioni.push(msg);
    }
  });
}

for (const seedBase of SEMI) {
  const mediciSeed = generaMediciConTitolarita(seedBase * 7919);
  setMediciGlobal(mediciSeed);
  for (const idxMese of IDX_MESI) {
    const { anno, mese } = MESI_DISPONIBILI[idxMese];
    const { dispo, extras, extraOre, turniExtra, maxTurniMese } = generaScenario(seedBase * 1000 + idxMese, anno, mese);
    let schema, avvisi;
    try {
      ({ schema, avvisi } = elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra, maxTurniMese));
    } catch (e) {
      violazioni.push(`ECCEZIONE seme=${seedBase} mese=${anno}-${mese + 1}: ${e.message}`);
      continue;
    }
    meseCountPerScenario = {};
    settimanaCountPerScenario = {};
    const contesto = `seme=${seedBase} mese=${anno}-${mese + 1}`;
    schema.forEach((g) => g.turni.forEach((t) => verificaTurno(g.giorno, t, dispo, g.key, turniExtra, contesto)));
    // INV-TETTO-SETTIMANALE (censimento #11, §3.8): il tetto settimanale dichiarato dal medico non è
    // MAI superato. Per ogni medico e ogni settimana (lun-dom), i turni assegnati (fisici + extra, la
    // copertura a distanza non conta) non superano capSettimanale. Vincolo RIGIDO applicato live in
    // candidatiOrdinati (settimanaCount) → nessuna eccezione legittima, nessun falso positivo. Ora
    // che la generazione lo esercita (#21, §10 voce 22) ha senso verificarlo a scala.
    Object.entries(settimanaCountPerScenario).forEach(([key, usati]) => {
      const sep = key.lastIndexOf("|");
      const mid = Number(key.slice(0, sep));
      const wk = key.slice(sep + 1);
      const cap = capSettimanale(dispo, mid, wk);
      if (cap === null) return; // nessun tetto dichiarato per quella settimana: nessun limite
      checkCount++;
      if (usati > cap) violazioni.push(`${contesto}: ${byId[mid]?.nome} ha ${usati} turni nella settimana ${wk}, oltre il tetto settimanale di ${cap} (INV-TETTO-SETTIMANALE)`);
    });
    // INV-FINESTRA (§10 voce 57): il vincolo di finestra settimanale (SETTWK = MINIMO di turni) o è
    // soddisfatto (≥N turni fisici in-mese in quella settimana), oppure il motore DEVE aver emesso un
    // avviso per quel medico — mai uno shortfall SILENZIOSO. Il tetto resta rigido (nodo ②a): quando il
    // minimo non entra nel tetto, l'avviso è la garanzia richiesta, non una violazione del tetto.
    MEDICI.forEach((m) => {
      const perM = dispo[m.id] || {};
      Object.keys(perM).forEach((k) => {
        if (!k.startsWith("SETTWK:")) return;
        const wk = k.slice(7);
        const Nmin = perM[k];
        if (!(Nmin > 0)) return;
        let assegnati = 0;
        schema.forEach((g) => {
          if (settimanaDi(dk(anno, mese, g.giorno)) !== wk) return;
          g.turni.forEach((t) => t.fis.forEach((si) => { if (t.slots[si] === m.id) assegnati++; }));
        });
        checkCount++;
        if (assegnati < Nmin && !avvisi.some((a) => a.includes(m.nome) && a.includes("voleva almeno"))) {
          violazioni.push(`${contesto}: ${m.nome} finestra settimana ${wk} min ${Nmin} non soddisfatta (${assegnati} turni) SENZA avviso (INV-FINESTRA)`);
        }
      });
    });
    // INV-MAXTURNI (§3.11, punto 1): il tetto mensile dichiarato non è MAI superato, per nessuna
    // categoria (contrattualizzato o senza incarico), qualunque debito residuo o priorità.
    Object.entries(maxTurniMese).forEach(([midStr, cap]) => {
      const mid = Number(midStr);
      checkCount++;
      const usati = meseCountPerScenario[mid] || 0;
      if (usati > cap) violazioni.push(`seme=${seedBase} mese=${anno}-${mese + 1}: ${byId[mid]?.nome} ha ${usati} turni assegnati, oltre il tetto mensile di ${cap} (INV-MAXTURNI)`);
    });
    // INV-TETTO-IMPLICITO (censimento #9, §3.11): estende INV-MAXTURNI a OGNI medico contrattualizzato,
    // non solo a quelli con Max turni mese dichiarato. Nessun medico supera il proprio tetto di
    // distribuzione = min(monte-ore-implicito, Max turni mese): il monte ore fa SEMPRE da tetto per un
    // contrattualizzato, anche senza cap dichiarato. Budget calcolato STATICAMENTE con le stesse
    // funzioni-dato del motore (debitoOrdinarioIniziale = monte ore AGGIUSTATO per mese §3.11 p.3 +
    // recupero; poi tettoDistribuzioneDi coi turni extra ×12), indipendente dal consumo effettivo
    // durante l'assegnazione — è la via indipendente da ciò che si testa (l'ASSEGNAZIONE rispetta il
    // tetto; la correttezza del tetto in sé è coperta dagli unit test aggiustamento/max_turni). Vincolo
    // rigido applicato live nel passaggio 2 → nessuna eccezione legittima, nessun falso positivo.
    MEDICI.forEach((m) => {
      const debOrd = debitoOrdinarioIniziale(m.id, extraOre, mese);
      const debExtra = debOrd === null ? null : (turniExtra[m.id] || 0) * 12;
      const tetto = tettoDistribuzioneDi(m.id, debOrd, debExtra, maxTurniMese);
      if (tetto === null) return; // senza incarico senza cap dichiarato: nessun tetto, nessuna distribuzione
      checkCount++;
      const usati = meseCountPerScenario[m.id] || 0;
      if (usati > tetto) violazioni.push(`${contesto}: ${m.nome} ha ${usati} turni, oltre il tetto di distribuzione ${tetto} (min tra monte ore implicito e Max turni mese) (INV-TETTO-IMPLICITO)`);
    });
    // INV-DETERMINISMO (censimento #20): stesso input → stesso output. Campiono ~5% degli scenari
    // (rieseguire tutti raddoppierebbe il tempo); un non-determinismo si manifesterebbe comunque
    // stabilmente, quindi un campione basta. Cloniamo TUTTI gli input per la seconda chiamata, così
    // il confronto isola il puro determinismo (funzione pura degli input + stato MEDICI del seme,
    // invariato tra le due chiamate) da un'eventuale mutazione degli input. Vincolo rigido → nessun
    // falso positivo: se differiscono c'è non-determinismo o mutazione degli input da indagare.
    if (scenari % 20 === 0) {
      checkCount++;
      const clone = (o) => JSON.parse(JSON.stringify(o));
      const { schema: schema2 } = elaboraSchema(clone(dispo), clone(extraOre), anno, mese, clone(extras), clone(turniExtra), clone(maxTurniMese));
      if (JSON.stringify(schema2) !== JSON.stringify(schema)) {
        violazioni.push(`${contesto}: rielaborazione dello stesso scenario produce output DIVERSO (INV-DETERMINISMO)`);
      }
    }
    // NOTA (§3.11, distribuzione temporale): QUI NON esiste un invariante sulla QUALITÀ della
    // distribuzione (turni "sparsi" invece che ammucchiati), ed è una scelta deliberata, non una
    // dimenticanza. È stato tentato (INV-DISTRIBUZIONE) e RIMOSSO: in uno scenario random denso
    // l'ammucchiamento LEGITTIMO è indistinguibile dal bug senza replicare il motore dentro il
    // test. Tre fonti di ammucchiamento corretto che nessun controllo a posteriori sullo schema
    // finale sa separare dal bug: (1) cap piccolo — con Max turni mese 1-2 i turni tenuti sono
    // pochissimi e la loro "campata" è naturalmente minima; (2) competizione al tempo-oracolo — i
    // competitori modellano il pool nel passaggio 1 e poi si esauriscono, lasciando gli slot
    // SCOPERTI nello schema finale, quindi un check post-hoc crede il medico "isolato" quando non
    // lo è; (3) priorità di sede assoluta (§3.11) — i turni tenuti si concentrano nella finestra
    // dei livelli-verdi migliori, che può essere stretta. Un invariante robusto dovrebbe conoscere
    // il pool dell'oracolo e i livelli di sede, cioè ri-eseguire la logica di distribuzione del
    // motore — un test però deve conoscere la risposta giusta per una via INDIPENDENTE da ciò che
    // testa, e nella sim densa quella risposta non è calcolabile senza rifare il motore stesso.
    // La qualità della distribuzione è quindi coperta dai due unit test DETERMINISTICI in
    // test_distribuzione_temporale.mjs (caso isolato, single-livello, cap ≥ 3: [1,16,31] e il DET24
    // [1,10,22,31]) — il posto giusto, senza i confondenti di competizione e priorità di sede.
    // Vedi CONTEXT.md §10 voce 20 per la storia completa.
    scenari++;
  }
}
setMediciGlobal(MEDICI_DEFAULT);

console.log(`Scenari elaborati: ${scenari} (${SEMI.length} semi × ${IDX_MESI.length} mesi, titolarità/turni extra/tetti mensili casuali per seme)`);
console.log(`Check di invariante eseguiti: ${checkCount}`);

// Riporta (senza far fallire) le violazioni di titolarità tollerate perché corrispondono al limite
// noto §3.1a/§10 (catena FASE1 con 3+ determinati): visibili, mai mascherate.
if (tolleratiTitolarita.length) {
  console.log(`\nℹ️  ${tolleratiTitolarita.length} violazioni INV-TITOLARE TOLLERATE (limite noto §3.1a, 3+ contrattualizzati — non fanno fallire, ma sono riportate):`);
  tolleratiTitolarita.slice(0, 20).forEach((v) => console.log(" · " + v));
  if (tolleratiTitolarita.length > 20) console.log(`  ... e altre ${tolleratiTitolarita.length - 20}`);
}

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

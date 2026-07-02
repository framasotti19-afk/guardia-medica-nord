
// ============ DATI SIMULAZIONE ============
// MEDICI è modificabile dall'interfaccia (tab Medici): la lista di default viene
// sovrascritta da quella salvata nello store, tramite setMediciGlobal.
const MEDICI_DEFAULT = [
  { id: 1, nome: "BERTUZZI", grad: 0, cat: "IND36" },
  { id: 2, nome: "CAMPANER", grad: 1, cat: "IND24" },
  { id: 3, nome: "TRIGODKO", grad: 4, cat: "DET36" },
  { id: 4, nome: "PRESSACCO", grad: 57, cat: "DET36" },
  { id: 5, nome: "GHIZZO", grad: 91, cat: "DET36" },
  { id: 6, nome: "IENGO", grad: 107, cat: "DET36" },
  { id: 7, nome: "DE MARCHI L", grad: 130, cat: "DET36" },
  { id: 8, nome: "FOSCHIANI", grad: 3, cat: "DET24" },
  { id: 9, nome: "BEKAEVA", grad: 17, cat: "DET24" },
  { id: 10, nome: "CERVESATO", grad: 63, cat: "DET24" },
  { id: 11, nome: "COLOSETTI", grad: 97, cat: "DET24" },
  { id: 12, nome: "WANG", grad: 124, cat: "DET24" },
  { id: 13, nome: "ZURLO", grad: 2, cat: "SENZA" },
  { id: 14, nome: "GRANDO", grad: 13, cat: "SENZA" },
  { id: 15, nome: "PITAU", grad: 14, cat: "SENZA" },
  { id: 16, nome: "DE CECCO-BEOLCHI", grad: 20, cat: "SENZA" },
  { id: 17, nome: "MICHELI", grad: 39, cat: "SENZA" },
  { id: 18, nome: "MARZANO", grad: 45, cat: "SENZA" },
  { id: 19, nome: "MUNARETTO", grad: 54, cat: "SENZA" },
  { id: 20, nome: "CESCO", grad: 59, cat: "SENZA" },
  { id: 21, nome: "PARRONI", grad: 71, cat: "SENZA" },
  { id: 22, nome: "MORANO", grad: 72, cat: "SENZA" },
  { id: 23, nome: "DE CANDIDO", grad: 83, cat: "SENZA" },
  { id: 24, nome: "SIEGA-VIGNUT", grad: 87, cat: "SENZA" },
  { id: 25, nome: "MERLINO", grad: 105, cat: "SENZA" },
  { id: 26, nome: "MARCUZZO", grad: 109, cat: "SENZA" },
];
let MEDICI = MEDICI_DEFAULT.map((m) => ({ ...m }));
let byId = Object.fromEntries(MEDICI.map((m) => [m.id, m]));
// Sostituisce la lista medici globale (usata da motore e UI). Idempotente:
// può essere chiamata a ogni render senza effetti collaterali.
const setMediciGlobal = (list) => {
  MEDICI = list.map((m) => ({ ...m }));
  byId = Object.fromEntries(MEDICI.map((m) => [m.id, m]));
};

const CAT_INFO = {
  IND36: { label: "Indet. 36h", prio: 1, ore: 156, color: "#1a5c4a", bg: "#e3f2ec" },
  IND24: { label: "Indet. 24h", prio: 2, ore: 104, color: "#1d6d5a", bg: "#e8f4ef" },
  DET36: { label: "Det. 36h", prio: 3, ore: 156, color: "#8a5a00", bg: "#fdf3dd" },
  DET24: { label: "Det. 24h", prio: 4, ore: 104, color: "#a06b00", bg: "#fef7e8" },
  SENZA: { label: "Senza inc.", prio: 5, ore: null, color: "#5b5b6b", bg: "#eeeef2" },
};

const SEDI5 = ["Maniago", "Spilimbergo", "Meduno", "Claut", "Anduins"];
const SEDI_BREVI = { Maniago: "MA", Spilimbergo: "SP", Meduno: "ME", Claut: "CL", Anduins: "AN" };

// ============ CALENDARIO ============
const FESTIVI_MAP = {
  "2026-08-15": "FERRAGOSTO", "2026-11-01": "OGNISSANTI", "2026-12-08": "IMMACOLATA",
  "2026-12-25": "NATALE", "2026-12-26": "S.STEFANO", "2026-12-31": "31 DICEMBRE",
  "2027-01-01": "CAPODANNO", "2027-01-06": "EPIFANIA", "2027-03-28": "PASQUA",
  "2027-03-29": "PASQUETTA", "2027-04-25": "25 APRILE", "2027-05-01": "1 MAGGIO",
  "2027-06-02": "2 GIUGNO", "2027-08-15": "FERRAGOSTO", "2027-11-01": "OGNISSANTI",
  "2027-12-08": "IMMACOLATA", "2027-12-25": "NATALE", "2027-12-26": "S.STEFANO", "2027-12-31": "31 DICEMBRE",
};
const PREFESTIVI = new Set([
  "2026-08-14","2026-10-31","2026-12-07","2026-12-24","2026-12-30",
  "2027-01-05","2027-03-27","2027-04-24","2027-04-30","2027-06-01",
  "2027-08-14","2027-10-31","2027-12-07","2027-12-24","2027-12-30",
]);
const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const GIORNI_IT = ["DOMENICA","LUNEDI'","MARTEDI'","MERCOLEDI'","GIOVEDI'","VENERDI'","SABATO"];
const GIORNI_BREVI = ["DO","LU","MA","ME","GI","VE","SA"];

const MESI_DISPONIBILI = [];
{ let y = 2026, m = 7;
  while (y < 2027 || (y === 2027 && m <= 11)) {
    MESI_DISPONIBILI.push({ anno: y, mese: m });
    m++; if (m > 11) { m = 0; y++; }
  }
}
const dk = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const mk = (y, m) => `${y}-${m}`;

function turniDelGiorno(y, m, d, extras) {
  const key = dk(y, m, d);
  const dow = new Date(y, m, d).getDay();
  const festivo = FESTIVI_MAP[key];
  const prefestivo = PREFESTIVI.has(key);
  const weekend = dow === 0 || dow === 6;
  const turni = [];
  const ex = (extras && extras[key]) || {};
  if (ex.M) turni.push({ id: "M", label: "MATTINA MMG 8-14", ore: 6, extra: true });
  if (festivo || prefestivo || weekend) {
    let lbl = "DIURNO 8-20";
    if (festivo) lbl = "SUPERFESTIVO DIURNO 08-20";
    else if (prefestivo) lbl = "PREFESTIVO(SUPER) DIURNO 8-20";
    turni.push({ id: "G", label: lbl, ore: 12 });
  }
  if (ex.P) turni.push({ id: "P", label: "POMERIGGIO MMG 14-20", ore: 6, extra: true });
  let nlbl = "NOTTURNO";
  if (festivo) nlbl = "SUPERFESTIVO NOTTURNO 20-08";
  else if (prefestivo) nlbl = "PREFESTIVO(SUPER) NOTTURNO 20-08";
  turni.push({ id: "N", label: nlbl, ore: 12 });
  return { turni, festivo, prefestivo, weekend, key, dow };
}

// ============ MOTORE ============
// dispo[mid][slotKey] = { piene:[sedi], pieneLiv:{sede:1..5}, ripiego:[sedi], ripiegoLiv:{sede:1..5}, no:bool, preferito:bool, preferitoRip:bool }
// - piene: sedi in preferenza piena; pieneLiv assegna un livello 1..5 a ciascuna
//   (livelli PARI = sedi indifferenti per il medico → il motore può spostarlo liberamente
//    tra di esse per massimizzare le coperture; livello più basso = sede più desiderata,
//    che il medico ha diritto di tenere a meno che qualcuno con priorità superiore lo scalzi)
// - ripiego: sedi accettate solo se necessarie a completare lo scenario, con livelli 1..5
//   (fuori→1→2→3→4→5→fuori). Il medico può assegnare liberamente lo stesso livello a più sedi.
// - no: indisponibilità dichiarata esplicitamente
// - preferito / preferitoRip: vedi commento sopra
// slots = 5 posizioni [Maniago, Spilimbergo, Meduno, Claut, Anduins]

// Normalizza il formato dati (gestisce retrocompatibilità con vecchi salvataggi)
const normDispo = (v) => {
  if (!v) return { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false };
  if (Array.isArray(v)) return { piene: v, pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false };
  // pieneLiv / ripiegoLiv: {sede: 1..5} — livello di preferenza per ogni sede.
  // Se assente o parziale, le sedi mancanti valgono 1 (prima scelta / tutte equivalenti).
  return { piene: v.piene || [], pieneLiv: v.pieneLiv || {}, ripiego: v.ripiego || [], ripiegoLiv: v.ripiegoLiv || {}, no: !!v.no, preferito: !!v.preferito, preferitoRip: !!v.preferitoRip };
};

// Restituisce le sedi di ripiego ordinate per livello crescente (prima le più desiderate).
// Sedi con lo stesso livello sono equivalenti — il motore le prova nell'ordine dell'array.
const ripiegoPerLivello = (rip, liv) => {
  const maxL = 5;
  const out = [];
  for (let l = 1; l <= maxL; l++) {
    rip.forEach((s) => { if ((liv[s] || 1) === l) out.push(s); });
  }
  return out; // es. [SP, CL, ME] se SP=1, CL=2, ME=2 -> [SP, CL, ME]
};

// Sedi fisiche richieste dallo scenario in base al numero di medici presenti
const sediScenario = (n) => (n <= 1 ? [0] : n === 2 ? [0, 1] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti condiviso.
function elaboraTurno(d, turno, slotKey, dispo, debiti) {
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    return !v.no && (v.piene.length || v.ripiego.length);
  });
  const conDeb = candidati.filter((m) => debiti[m.id] !== null && debiti[m.id] > 0)
    .sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || debiti[b.id] - debiti[a.id] || a.grad - b.grad);
  const senza = candidati.filter((m) => debiti[m.id] === null).sort((a, b) => a.grad - b.grad);
  const esaur = candidati.filter((m) => debiti[m.id] !== null && debiti[m.id] <= 0).sort((a, b) => a.grad - b.grad);
  const ordinati = [...conDeb, ...senza, ...esaur]; // già in ordine di gerarchia ufficiale

  let slots = [null, null, null, null, null];
  let fisiche = [];
  let avviso = null;

  if (turno.extra) {
    const sel = ordinati[0] || null;
    slots = [sel ? sel.id : null];
    fisiche = [0];
    if (sel && debiti[sel.id] !== null) debiti[sel.id] -= turno.ore;
  } else {
    const target = sediScenario(Math.min(ordinati.length, 4));
    // Livello "effettivo" di una sede per un medico: piene 1..5, ripieghi 11..15
    // (qualsiasi ripiego vale sempre meno di qualsiasi piena), Infinity se non dichiarata.
    const livelloDi = (mid, sede, conRipiego) => {
      const v = normDispo(dispo[mid][slotKey]);
      if (v.piene.includes(sede)) return v.pieneLiv[sede] || 1;
      if (conRipiego && v.ripiego.includes(sede)) return 10 + (v.ripiegoLiv[sede] || 1);
      return Infinity;
    };
    const accDi = (m, conRipiego) => {
      const v = normDispo(dispo[m.id][slotKey]);
      // Piene ordinate per livello (ripiegoPerLivello è un ordinamento generico per livelli);
      // con ripiego: prima tutte le piene per livello, poi i ripieghi per livello.
      const pieneOrd = ripiegoPerLivello(v.piene, v.pieneLiv);
      if (!conRipiego) return pieneOrd;
      return [...pieneOrd, ...ripiegoPerLivello(v.ripiego, v.ripiegoLiv)];
    };
    // Confronto di priorità "vero" (stessa logica usata per costruire ordinati: bucket
    // conDeb > senza incarico > debito esaurito, poi dentro il bucket categoria → debito → graduatoria).
    // Serve per decidere se un candidato può scalzare un occupante che non ha alternative:
    // questo è ciò che rende il ripiego capace di competere "a piena forza" anche contro chi
    // aveva messo quella sede come prima preferenza, come stabilito.
    const bucketOf = (mid) => {
      const d = debiti[mid];
      if (d !== null && d > 0) return 0;
      if (d === null) return 1;
      return 2;
    };
    const isBetterPriority = (aId, bId) => {
      const ba = bucketOf(aId), bb = bucketOf(bId);
      if (ba !== bb) return ba < bb;
      if (ba === 0) {
        const A = byId[aId], B = byId[bId];
        const pa = CAT_INFO[A.cat].prio, pb = CAT_INFO[B.cat].prio;
        if (pa !== pb) return pa < pb;
        if (debiti[aId] !== debiti[bId]) return debiti[aId] > debiti[bId];
        return A.grad < B.grad;
      }
      return byId[aId].grad < byId[bId].grad;
    };
    const sedeDi = {};
    // prova(): il medico m cerca una sede tra le sue, nell'ordine dei SUOI livelli,
    // senza mai accettare una sede di livello peggiore di maxLiv.
    // Ricollocazione di un occupante per fare posto:
    // - a PARI livello o migliore (indifferenza dichiarata): sempre consentita — non gli
    //   costa nulla, e libera la sede per chi non ha alternative
    // - a livello PEGGIORE: consentita SOLO se il richiedente ha priorità superiore.
    //   In quel caso l'occupante verrebbe comunque scalzato, e per lui una sede di livello
    //   peggiore è sempre meglio dell'esclusione totale dal turno.
    // Chi ha dichiarato un livello migliore su una sede ha quindi DIRITTO di tenerla
    // contro chiunque non lo superi in gerarchia (categoria → debito → graduatoria).
    const prova = (m, visitate, conRipiego, maxLiv) => {
      const acc = accDi(m, conRipiego);
      for (const sede of acc) {
        const si = target.find((i) => SEDI5[i] === sede);
        if (si === undefined || visitate.has(si)) continue;
        const liv = livelloDi(m.id, sede, conRipiego);
        if (liv > maxLiv) continue;
        visitate.add(si);
        const occ = slots[si];
        if (occ === null) {
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
        if (occ === m.id) continue;
        // Il livello massimo che l'occupante può accettare nello spostarsi:
        // pari al suo livello attuale se il richiedente NON lo supera in gerarchia,
        // illimitato se lo supera (meglio una sede peggiore che essere scalzato fuori).
        const occLiv = livelloDi(occ, sede, conRipiego);
        const occMax = isBetterPriority(m.id, occ) ? Infinity : occLiv;
        delete sedeDi[occ];
        if (prova(byId[occ], visitate, conRipiego, occMax)) {
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
        sedeDi[occ] = si; // ricollocazione fallita: l'occupante resta dov'era
        // L'occupante non ha alternative accettabili: lo scalzo SOLO se ho realmente
        // priorità migliore (categoria → debito → graduatoria), mai altrimenti
        if (isBetterPriority(m.id, occ)) {
          delete sedeDi[occ];
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
      }
      return false;
    };
    // PASSO 1: solo preferenze piene, in ordine di priorità, nei livelli dichiarati
    for (const m of ordinati) {
      if (Object.keys(sedeDi).length >= target.length) break;
      prova(m, new Set(), false, Infinity);
    }
    // PASSO 2: sedi dello scenario ancora scoperte → si attivano i ripieghi
    // (stessa funzione: l'acc ora include i ripieghi, ordinati dopo tutte le piene)
    if (Object.keys(sedeDi).length < target.length) {
      for (const m of ordinati) {
        if (Object.keys(sedeDi).length >= target.length) break;
        if (sedeDi[m.id] !== undefined) continue;
        prova(m, new Set(), true, Infinity);
      }
    }
    // Dopo tutti i passaggi, ricalcola slots dalla fonte di verità (sedeDi).
    // Durante la ricollocazione ricorsiva, il medico può essere assegnato a uno slot
    // intermedio e poi spostato su uno slot definitivo — lasciando un "fantasma"
    // in slots che non corrisponde a nessuna voce in sedeDi. Ricostruiamo per garantire
    // che slots rifletta esattamente e solo chi è effettivamente fisico.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });

    // scala il debito a chi è rimasto effettivamente dentro
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      if (debiti[mid] !== null) debiti[mid] -= turno.ore;
    });
    fisiche = Object.values(sedeDi);

    // AVVISO: sedi dello scenario rimaste senza presenza fisica.
    // I nomi suggeriti seguono SEMPRE l'ordine di gerarchia ufficiale (categoria → debito →
    // graduatoria): essendo 'fuori' derivato da 'ordinati' (già ordinato così), il primo
    // nome elencato è sempre il candidato più corretto da contattare per primo.
    const mancanti = target.filter((si) => slots[si] === null);
    if (mancanti.length && ordinati.length) {
      const dentro = new Set(Object.keys(sedeDi).map(Number));
      const fuori = ordinati.filter((m) => !dentro.has(m.id)).map((m) => {
        const v = normDispo(dispo[m.id][slotKey]);
        const parti = [];
        if (v.piene.length) parti.push(`preferenza: ${v.piene.map((s) => SEDI_BREVI[s]).join(", ")}`);
        if (v.ripiego.length) {
          const sup = ["¹","²","³","⁴","⁵"];
          parti.push(`ripiego: ${ripiegoPerLivello(v.ripiego, v.ripiegoLiv).map((s) => SEDI_BREVI[s] + sup[(v.ripiegoLiv[s] || 1) - 1]).join(", ")}`);
        }
        return `${m.nome} (${parti.join(" · ") || "nessuna sede"})`;
      });
      avviso = `Giorno ${d} · ${turno.label}: con ${ordinati.length} medici presenti lo scenario richiede la copertura fisica di ${mancanti.map((si) => SEDI5[si]).join(", ")}, rimasta scoperta per i vincoli di sede dichiarati. Contattare ${fuori.length ? fuori.join(" oppure ") : "i medici del turno"} per chiedere la disponibilità a spostarsi, in ottemperanza alla priorità delle CDC e degli scenari.`;
    }

    // coperture a distanza — logica generalizzata
    if (slots.some(Boolean)) {
      if (!slots[1]) slots[1] = slots[0] || slots[2] || slots[3];
      if (!slots[0]) slots[0] = slots[1] || slots[2] || slots[3];
      if (!slots[2]) slots[2] = byId[slots[0]].grad <= byId[slots[1]].grad ? slots[0] : slots[1];
      if (!slots[3]) slots[3] = slots[0];
      if (!slots[4]) slots[4] = byId[slots[1]].grad <= byId[slots[2]].grad ? slots[1] : slots[2];
    }
  }

  return { turnoOut: { id: turno.id, label: turno.label, ore: turno.ore, extra: !!turno.extra, slots, fis: fisiche }, avviso };
}

// Un turno ha "preferiti" se almeno un medico lo ha segnato come preferito
// (sulla preferenza piena e/o anche sul ripiego): in entrambi i casi il turno
// viene elaborato per primo, per preservare il debito verso il giorno desiderato.
function slotHaPreferiti(dispo, slotKey) {
  const v0 = (m) => normDispo(dispo[m.id]?.[slotKey]);
  return MEDICI.some((m) => { const v = v0(m); return !v.no && (v.preferito || v.preferitoRip); });
}

function elaboraSchema(dispo, extraOre, anno, mese, extras) {
  const debiti = {};
  MEDICI.forEach((m) => {
    const base = CAT_INFO[m.cat].ore;
    debiti[m.id] = base === null ? null : base + (extraOre[m.id] || 0);
  });
  const nGiorni = new Date(anno, mese + 1, 0).getDate();

  // Flat list di tutti i turni del mese, in ordine di calendario
  const voci = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    info.turni.forEach((turno) => voci.push({ d, turno, slotKey: `${info.key}|${turno.id}`, info }));
  }

  // Due passaggi: prima i turni con almeno un "preferito" dichiarato (in ordine cronologico
  // tra loro), poi tutto il resto (sempre in ordine cronologico) — così il debito viene
  // consumato dando la precedenza ai giorni desiderati, senza mai cambiare CHI vince un
  // conflitto (la gerarchia resta l'unico criterio decisionale).
  const conPref = voci.filter((v) => !v.turno.extra && slotHaPreferiti(dispo, v.slotKey));
  const resto = voci.filter((v) => v.turno.extra || !slotHaPreferiti(dispo, v.slotKey));

  const risultati = {}; // "d|turnoId" -> turnoOut
  const avvisiRaw = []; // {d, testo}

  [...conPref, ...resto].forEach(({ d, turno, slotKey }) => {
    const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispo, debiti);
    risultati[`${d}|${turno.id}`] = turnoOut;
    if (avviso) avvisiRaw.push({ d, testo: avviso });
  });

  // VALUTAZIONE PREFERITI: dopo l'elaborazione confronta l'esito con ciò che il medico
  // desiderava. Regole concordate:
  //  - preferito SOLO sulla preferenza piena → soddisfatto solo se ottiene una sede in preferenza;
  //    se finisce sul ripiego o resta fuori, viene generato un avviso.
  //  - preferito ANCHE sul ripiego ("lo vuole a tutti i costi") → soddisfatto sia con la
  //    preferenza sia con il ripiego; avviso solo se resta completamente fuori.
  // In nessun caso il preferito decide chi vince: qui si osserva soltanto il risultato.
  const meseStr = `${anno}-${String(mese + 1).padStart(2, "0")}-`;
  MEDICI.forEach((m) => {
    const perMedico = dispo[m.id] || {};
    Object.entries(perMedico).forEach(([sk, raw]) => {
      if (!sk.startsWith(meseStr)) return;
      const v = normDispo(raw);
      if (v.no || (!v.preferito && !v.preferitoRip)) return;
      const d = Number(sk.slice(8, 10));
      const tid = sk.split("|")[1];
      const out = risultati[`${d}|${tid}`];
      if (!out) return;
      let sedeOttenuta = null;
      if (out.extra) {
        if (out.slots[0] === m.id) sedeOttenuta = "MMG";
      } else {
        for (const fi of out.fis) if (out.slots[fi] === m.id) { sedeOttenuta = SEDI5[fi]; break; }
      }
      const assegnato = sedeOttenuta !== null;
      if (out.extra) {
        if (!assegnato) avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva questo turno come preferito, ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
        return;
      }
      const inPiene = assegnato && v.piene.includes(sedeOttenuta);
      const inRip = assegnato && v.ripiego.includes(sedeOttenuta);
      if (v.preferitoRip) {
        // lo vuole a tutti i costi: preferenza o ripiego vanno entrambi bene
        if (!assegnato) avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} voleva questo turno a tutti i costi (preferito anche sul ripiego), ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
        return;
      }
      // preferito solo sulla preferenza piena
      if (inPiene) return;
      if (inRip) {
        avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva questo turno come preferito sulla preferenza, ma ha ottenuto ${sedeOttenuta} (suo ripiego) invece di ${v.piene.map((s) => SEDI_BREVI[s]).join(", ") || "una sede in preferenza"}. Valutare uno scambio manuale se opportuno.` });
        return;
      }
      avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva questo turno come preferito, ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
    });
  });

  // Ricompone lo schema in ordine di calendario (l'ordine di elaborazione sopra era solo
  // interno, per il consumo del debito — l'output resta sempre cronologico)
  const schema = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    const turniOut = info.turni.map((turno) => risultati[`${d}|${turno.id}`]);
    schema.push({ giorno: d, key: info.key, dow: info.dow, festivo: info.festivo, prefestivo: info.prefestivo, weekend: info.weekend, turni: turniOut });
  }
  avvisiRaw.sort((a, b) => a.d - b.d);
  const avvisi = avvisiRaw.map((a) => a.testo);

  return { schema, avvisi };
}

// sede primaria di un medico = la sede FISICA in cui si trova (registrata dal motore);
// se non disponibile (modifiche manuali), prima posizione in cui compare
function sedePrimaria(slots, mid, fis) {
  if (fis) for (const i of fis) if (slots[i] === mid) return i;
  for (let i = 0; i < slots.length; i++) if (slots[i] === mid) return i;
  return -1;
}
function notaSlot(slots, si, fis) {
  const mid = slots[si];
  if (!mid) return { testo: "", tipo: "vuoto" };
  const prim = sedePrimaria(slots, mid, fis);
  if (prim === si) {
    const altre = [];
    for (let i = 0; i < slots.length; i++) if (i !== si && slots[i] === mid) altre.push(SEDI5[i]);
    return { testo: altre.length ? `*copre ${altre.join(", ")}` : "", tipo: "primaria" };
  }
  return { testo: `*coperto da ${SEDI5[prim]}`, tipo: "copertura" };
}


export { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ripiegoPerLivello, MESI_DISPONIBILI, MESI_IT };

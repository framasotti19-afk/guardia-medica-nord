// Adattamento per GitHub Pages: nessun bundler disponibile, React è caricato
// come script globale da index.html (vedi docs/index.html) e Babel standalone
// (solo preset "react", niente TypeScript) trasforma questo file nel browser.
// Copia di turni-guardia-medica.jsx con 3 modifiche minime, non comportamentali:
// 1) questa riga sostituisce l'import ES module con la destrutturazione dal
//    global React; 2) "export default" rimosso dalla dichiarazione di App();
// 3) rimosso un cast TypeScript "as any" (riga ~1130, no-op a runtime) che
//    Babel standalone senza preset TS non riesce a parsare; 4) in fondo al
//    file una riga di render esplicito al posto dell'export. Nessun'altra
//    riga è stata toccata.
const { useState, useMemo, useRef, useEffect } = React;

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
      // ME: "priorità superiore" = gerarchia completa (categoria -> debito -> graduatoria), non solo grad
      if (!slots[2]) slots[2] = isBetterPriority(slots[0], slots[1]) ? slots[0] : slots[1];
      if (!slots[3]) slots[3] = slots[0];
      // AN: qui la regola è esplicitamente "grad migliore" (solo graduatoria), non l'intera gerarchia
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

// ============ COMPONENTE ============
function App() {
  const [meseIdx, setMeseIdx] = useState(0);
  const [store, setStore] = useState({});
  const historyRef = useRef({ past: [], future: [] });
  const [, forceRender] = useState(0);
  const [tab, setTab] = useState("dispo");
  const [editCella, setEditCella] = useState(null); // {mid, slotKey}
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [proposta, setProposta] = useState(null); // {azioni, spiegazione}
  const [caricato, setCaricato] = useState(false);
  const [rapidoOpen, setRapidoOpen] = useState(false);
  const [rapMedico, setRapMedico] = useState(MEDICI[0].id);
  const [rapInizio, setRapInizio] = useState("");
  const [rapFine, setRapFine] = useState("");
  const [rapNotte, setRapNotte] = useState(true);
  const [rapGiorno, setRapGiorno] = useState(false);
  const [rapSedi, setRapSedi] = useState({}); // sede -> 'piena' | 'ripiego'
  const [rapIndisp, setRapIndisp] = useState([]); // [{inizio, fine}] periodi di indisponibilità
  const [confermaAzzera, setConfermaAzzera] = useState(false); // doppio tocco per azzerare il mese
  const azzeraTimer = useRef(null);
  const [nuovoMedico, setNuovoMedico] = useState({ nome: "", cat: "SENZA", grad: "" });

  // Caricamento persistente all'avvio.
  // La chiave include una versione: cambiarla forza una partenza pulita senza residui.
  const STORAGE_KEY = "gm-turni-store-v3";
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setStore(JSON.parse(r.value));
      } catch (e) { /* nessun salvataggio precedente */ }
      setCaricato(true);
    })();
  }, []);

  const salva = (s) => {
    try { window.storage.set(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* offline */ }
  };

  const { anno, mese } = MESI_DISPONIBILI[meseIdx];
  const key = mk(anno, mese);
  const vuotoMese = { dispo: {}, extras: {}, extraOre: {}, schema: null, avvisi: [] };
  const dati = store[key] || vuotoMese;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();

  // Lista medici: quella salvata nello store (modificabile dal tab Medici) o il default.
  // setMediciGlobal sincronizza il modulo (motore + byId) ad ogni render — idempotente.
  const mediciList = store.medici || MEDICI_DEFAULT;
  setMediciGlobal(mediciList);

  // ---- history: ogni azione salva lo stato precedente ----
  const applica = (nuovoStore) => {
    historyRef.current.past.push(store);
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    historyRef.current.future = [];
    setStore(nuovoStore);
    salva(nuovoStore);
  };
  const setDati = (patch) => applica({ ...store, [key]: { ...(store[key] || vuotoMese), ...patch } });
  const annulla = () => {
    const h = historyRef.current;
    if (!h.past.length) return;
    h.future.push(store);
    const prev = h.past.pop();
    setStore(prev);
    salva(prev);
    forceRender((x) => x + 1);
  };
  const ripeti = () => {
    const h = historyRef.current;
    if (!h.future.length) return;
    h.past.push(store);
    const nxt = h.future.pop();
    setStore(nxt);
    salva(nxt);
    forceRender((x) => x + 1);
  };

  const giorniMese = useMemo(() => {
    const out = [];
    for (let d = 1; d <= nGiorni; d++) out.push(turniDelGiorno(anno, mese, d, dati.extras));
    return out;
  }, [anno, mese, nGiorni, dati.extras]);

  const colonne = useMemo(() => {
    const cols = [];
    giorniMese.forEach((g, i) => g.turni.forEach((t) => cols.push({ giorno: i + 1, ...g, turno: t })));
    return cols;
  }, [giorniMese]);


  const toggleSedeCella = (mid, slotKey, sede) => {
    const cur = normDispo(dati.dispo[mid]?.[slotKey]);
    const next = {
      piene: [...cur.piene], pieneLiv: { ...cur.pieneLiv }, ripiego: [...cur.ripiego], ripiegoLiv: { ...cur.ripiegoLiv },
      no: false, preferito: cur.no ? false : cur.preferito, preferitoRip: cur.no ? false : cur.preferitoRip,
    };
    if (next.piene.includes(sede)) {
      const livAttuale = next.pieneLiv[sede] || 1;
      if (livAttuale < 5) {
        // aumenta il livello della piena: 1 → 2 → ... → 5
        // (livelli PARI su più sedi = per il medico sono indifferenti)
        next.pieneLiv[sede] = livAttuale + 1;
      } else {
        // piena livello 5 → ripiego livello 1
        next.piene = next.piene.filter((s) => s !== sede);
        delete next.pieneLiv[sede];
        next.ripiego.push(sede);
        next.ripiegoLiv[sede] = 1;
      }
    } else if (next.ripiego.includes(sede)) {
      const livAttuale = next.ripiegoLiv[sede] || 1;
      if (livAttuale < 5) {
        // aumenta il livello: rip.1 → rip.2 → ... → rip.5
        next.ripiegoLiv[sede] = livAttuale + 1;
      } else {
        // ripiego livello 5 → fuori
        next.ripiego = next.ripiego.filter((s) => s !== sede);
        delete next.ripiegoLiv[sede];
      }
    } else {
      // fuori → preferenza piena livello 1
      next.piene.push(sede);
      next.pieneLiv[sede] = 1;
    }
    // coerenza: un preferito non può riferirsi a una lista di sedi vuota
    if (!next.piene.length) { next.preferito = false; next.pieneLiv = {}; }
    if (!next.ripiego.length) { next.preferitoRip = false; next.ripiegoLiv = {}; }
    const nd = { ...(dati.dispo[mid] || {}) };
    if (next.piene.length || next.ripiego.length) nd[slotKey] = next; else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const setNoCella = (mid, slotKey, valore) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    if (valore) nd[slotKey] = { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false };
    else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const setPreferitoCella = (mid, slotKey, campo, valore) => {
    const cur = normDispo(dati.dispo[mid]?.[slotKey]);
    if (cur.no) return; // un turno non disponibile non può essere preferito
    const next = { piene: cur.piene, pieneLiv: cur.pieneLiv, ripiego: cur.ripiego, ripiegoLiv: cur.ripiegoLiv, no: false, preferito: cur.preferito, preferitoRip: cur.preferitoRip };
    next[campo] = valore;
    if (!next.piene.length) next.preferito = false;
    if (!next.ripiego.length) next.preferitoRip = false;
    const nd = { ...(dati.dispo[mid] || {}) };
    nd[slotKey] = next;
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const toggleExtra = (dateKey, tipo) => {
    const ex = { ...(dati.extras[dateKey] || {}) };
    ex[tipo] = !ex[tipo];
    setDati({ extras: { ...dati.extras, [dateKey]: ex }, schema: null });
  };
  const elabora = () => {
    const r = elaboraSchema(dati.dispo, dati.extraOre, anno, mese, dati.extras);
    setDati({ schema: r.schema, avvisi: r.avvisi });
  };

  // Azzera mese con doppia conferma: il primo tocco arma il pulsante (si colora di rosso),
  // il secondo entro 5 secondi cancella davvero. Passati 5 secondi si disarma da solo.
  // L'operazione resta comunque annullabile con ↶.
  const azzeraMese = () => {
    if (!confermaAzzera) {
      setConfermaAzzera(true);
      if (azzeraTimer.current) clearTimeout(azzeraTimer.current);
      azzeraTimer.current = setTimeout(() => setConfermaAzzera(false), 5000);
      return;
    }
    if (azzeraTimer.current) clearTimeout(azzeraTimer.current);
    setConfermaAzzera(false);
    setDati(vuotoMese);
    setEditCella(null);
  };

  // ---- gestione medici (categoria, graduatoria, aggiunta, rimozione) ----
  const setMedici = (list) => applica({ ...store, medici: list });
  const aggiornaMedico = (id, patch) => {
    setMedici(mediciList.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const aggiungiMedico = () => {
    const nome = nuovoMedico.nome.trim().toUpperCase();
    const grad = Number(nuovoMedico.grad);
    if (!nome) { alert("Inserisci il cognome del medico."); return; }
    if (mediciList.some((m) => m.nome === nome)) { alert("Esiste già un medico con questo nome."); return; }
    if (!Number.isFinite(grad) || grad < 0) { alert("Inserisci una posizione in graduatoria valida (numero ≥ 0)."); return; }
    const nuovoId = Math.max(...mediciList.map((m) => m.id)) + 1;
    setMedici([...mediciList, { id: nuovoId, nome, cat: nuovoMedico.cat, grad }]);
    setNuovoMedico({ nome: "", cat: "SENZA", grad: "" });
  };
  const rimuoviMedico = (id) => {
    const m = mediciList.find((x) => x.id === id);
    if (!m) return;
    if (!window.confirm(`Rimuovere ${m.nome} dall'elenco? Le sue disponibilità già inserite non verranno più considerate.`)) return;
    setMedici(mediciList.filter((x) => x.id !== id));
  };

  const setSlot = (gi, ti, si, midStr) => {
    const schema = dati.schema.map((g, a) => a !== gi ? g : {
      ...g, turni: g.turni.map((t, b) => b !== ti ? t : { ...t, slots: t.slots.map((s, c) => c !== si ? s : (midStr ? Number(midStr) : null)) }),
    });
    setDati({ schema });
  };

  // Applica una patch a più mesi in un colpo solo (un unico passo di ↶ Annulla)
  const applicaPatchMultiMese = (patchByMonth) => {
    const nuovo = { ...store };
    Object.entries(patchByMonth).forEach(([mkey, patch]) => {
      const base = nuovo[mkey] || { dispo: {}, extras: {}, extraOre: {}, schema: null, avvisi: [] };
      nuovo[mkey] = { ...base, ...patch };
    });
    applica(nuovo);
  };

  const applicaRapido = () => {
    if (!rapInizio || !rapFine) { alert("Seleziona il periodo di riferimento (Dal / Al)."); return; }
    const start = new Date(rapInizio + "T00:00:00");
    const end = new Date(rapFine + "T00:00:00");
    if (start > end) { alert("Nel periodo di riferimento, la data 'Al' deve essere successiva (o uguale) a 'Dal'."); return; }
    if (!rapNotte && !rapGiorno) { alert("Seleziona almeno un turno: notturno e/o diurno."); return; }
    for (const r of rapIndisp) {
      if (!r.inizio || !r.fine) { alert("Completa tutte le date nei periodi di indisponibilità (o rimuovi le righe vuote)."); return; }
      if (new Date(r.inizio + "T00:00:00") > new Date(r.fine + "T00:00:00")) { alert("In ogni periodo di indisponibilità, 'Al' deve essere successiva (o uguale) a 'Dal'."); return; }
    }
    const piene = Object.entries(rapSedi).filter(([, v]) => v === "piena").map(([s]) => s);
    const ripiego = Object.entries(rapSedi).filter(([, v]) => v === "ripiego").map(([s]) => s);

    const inQualcheIndisp = (y, m, d) => {
      const t = new Date(y, m, d).getTime();
      return rapIndisp.some((r) => {
        const a = new Date(r.inizio + "T00:00:00").getTime(), b = new Date(r.fine + "T00:00:00").getTime();
        return t >= a && t <= b;
      });
    };
    const turniDelGiornoRichiesti = (y, m, d, extras) => {
      const info = turniDelGiorno(y, m, d, extras);
      const idsGiorno = info.turni.filter((t) => !t.extra).map((t) => t.id);
      const out = [];
      if (rapNotte && idsGiorno.includes("N")) out.push("N");
      if (rapGiorno && idsGiorno.includes("G")) out.push("G");
      return out;
    };

    const patchByMonth = {};
    const touch = (y, m, d, tid, valore) => {
      const mkey = mk(y, m);
      if (!patchByMonth[mkey]) {
        const baseDispo = (store[mkey] || {}).dispo || {};
        patchByMonth[mkey] = { dispo: { ...baseDispo }, schema: null, avvisi: [] };
      }
      const patchDispo = patchByMonth[mkey].dispo;
      const nd = { ...(patchDispo[rapMedico] || {}) };
      nd[`${dk(y, m, d)}|${tid}`] = valore;
      patchDispo[rapMedico] = nd;
    };

    let scrittiIndisp = 0, scrittiDisp = 0, protetti = 0, saltatiFuoriRange = 0, saltatiNoDiurno = 0;

    // PASSO 1: i periodi di indisponibilità vincono sempre — sovrascrivono qualsiasi stato
    // precedente per le loro date, perché sono una dichiarazione nuova ed esplicita.
    rapIndisp.forEach((r) => {
      const rs = new Date(r.inizio + "T00:00:00"), re = new Date(r.fine + "T00:00:00");
      for (let dt = new Date(rs); dt <= re; dt.setDate(dt.getDate() + 1)) {
        const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
        if (!MESI_DISPONIBILI.some((x) => x.anno === y && x.mese === m)) { saltatiFuoriRange++; continue; }
        const extras = (store[mk(y, m)] || {}).extras || {};
        const richiesti = turniDelGiornoRichiesti(y, m, d, extras);
        if (rapGiorno && !richiesti.includes("G")) {
          const info = turniDelGiorno(y, m, d, extras);
          if (!info.turni.some((t) => t.id === "G")) saltatiNoDiurno++;
        }
        richiesti.forEach((tid) => {
          touch(y, m, d, tid, { piene: [], ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false });
          scrittiIndisp++;
        });
      }
    });

    // PASSO 2: il resto del periodo di riferimento diventa disponibile con le sedi scelte —
    // MA solo se non è già stato toccato dal passo 1, e solo se non esisteva GIA' un'indisponibilità
    // esplicita precedente (es. il 12 agosto segnato in un'azione passata): quella resta protetta.
    if (piene.length || ripiego.length) {
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
        if (inQualcheIndisp(y, m, d)) continue; // già gestito (ed esplicitamente escluso) al passo 1
        if (!MESI_DISPONIBILI.some((x) => x.anno === y && x.mese === m)) { saltatiFuoriRange++; continue; }
        const mkey = mk(y, m);
        const extras = (store[mkey] || {}).extras || {};
        const richiesti = turniDelGiornoRichiesti(y, m, d, extras);
        if (rapGiorno) {
          const info = turniDelGiorno(y, m, d, extras);
          if (!info.turni.some((t) => t.id === "G")) saltatiNoDiurno++;
        }
        const dispoEsistente = (store[mkey] || {}).dispo || {};
        richiesti.forEach((tid) => {
          const slotKey = `${dk(y, m, d)}|${tid}`;
          const preesistente = normDispo(dispoEsistente[rapMedico]?.[slotKey]);
          if (preesistente.no) { protetti++; return; } // indisponibilità dichiarata in precedenza: non si tocca
          const ripLivRap = {};
          ripiego.forEach((s) => { ripLivRap[s] = 1; });
          touch(y, m, d, tid, { piene: [...piene], ripiego: [...ripiego], ripiegoLiv: ripLivRap, no: false, preferito: false, preferitoRip: false });
          scrittiDisp++;
        });
      }
    }

    const totale = scrittiIndisp + scrittiDisp;
    if (!totale) { alert("Nessun turno compilato: controlla le date e le opzioni scelte."); return; }
    applicaPatchMultiMese(patchByMonth);
    const note = [];
    if (scrittiDisp) note.push(`${scrittiDisp} turni disponibili`);
    if (scrittiIndisp) note.push(`${scrittiIndisp} turni indisponibili`);
    if (protetti) note.push(`${protetti} turni già indisponibili in precedenza mantenuti invariati`);
    if (saltatiFuoriRange) note.push(`${saltatiFuoriRange} giorni fuori dal calendario disponibile (ago 2026 – dic 2027) ignorati`);
    if (saltatiNoDiurno) note.push(`${saltatiNoDiurno} giorni senza turno diurno (feriali) ignorati per il diurno`);
    alert(`${byId[rapMedico].nome}: ${note.join("; ")}.`);
    setRapidoOpen(false);
    setRapInizio(""); setRapFine(""); setRapSedi({}); setRapIndisp([]);
  };

  // ============ EXPORT .XLSX nativo con bordi e colori (zip costruito a mano) ============
  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const enc = new TextEncoder();

  // CRC32
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  // ZIP con entry non compresse (STORED) → xlsx standard
  const zipStore = (files) => {
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);
    const u32 = (n) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]);
    files.forEach(({ name, data }) => {
      const nameB = enc.encode(name);
      const crc = crc32(data);
      const local = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB, data];
      const localLen = local.reduce((a, b) => a + b.length, 0);
      central.push({ nameB, crc, size: data.length, offset });
      local.forEach((b) => chunks.push(b));
      offset += localLen;
    });
    const cdStart = offset;
    central.forEach(({ nameB, crc, size, offset: off }) => {
      [u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nameB].forEach((b) => chunks.push(b));
    });
    const cdLen = chunks.reduce((a, b) => a + b.length, 0) - cdStart;
    [u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(cdStart), u16(0)].forEach((b) => chunks.push(b));
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    chunks.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  };

  const colLetter = (n) => { let s = ""; n++; while (n) { s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s; n = Math.floor((n - 1) / 26); } return s; };

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="9">
<font><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="8"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF8A3A00"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF1A5C4A"/><name val="Calibri"/></font>
<font><sz val="8.5"/><name val="Calibri"/></font>
<font><i/><sz val="8"/><color rgb="FF5B5F59"/><name val="Calibri"/></font>
<font><b/><sz val="8.5"/><color rgb="FFB03030"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6DC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE5D6"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0F2EE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3F2EC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
</cellXfs>
</styleSheet>`;
  // indici stile: 1=sAgg 2=sHead 3=sHeadF 4=sDate 5=sTurno 6=sTurnoF 7=sTurnoX 8=sSede 9=sCell 10=sCov 11=sScop 12=sB

  const buildSheetXML = (mKey) => {
    const [y, m] = mKey.split("-").map(Number);
    const d = store[mKey];
    if (!d?.schema) return null;
    const cols = [];
    d.schema.forEach((g) => g.turni.forEach((t, ti) => cols.push({ g, t, prima: ti === 0, span: g.turni.length })));
    const oggi = new Date();
    const agg = `aggiornato al ${String(oggi.getDate()).padStart(2, "0")}.${String(oggi.getMonth() + 1).padStart(2, "0")}.${oggi.getFullYear()}`;

    const cell = (r, c, testo, stile) => `<c r="${colLetter(c)}${r}" s="${stile}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(testo)}</t></is></c>`;
    const cellV = (r, c, stile) => `<c r="${colLetter(c)}${r}" s="${stile}"/>`;

    let rows = "";
    const merges = [];

    // R1 giorni settimana
    let r1 = cell(1, 0, agg, 1);
    let ci = 1;
    let i = 0;
    while (i < cols.length) {
      const c = cols[i];
      const fest = c.g.festivo || c.g.prefestivo;
      r1 += cell(1, ci, GIORNI_IT[c.g.dow], fest ? 3 : 2);
      if (c.span > 1) {
        merges.push(`${colLetter(ci)}1:${colLetter(ci + c.span - 1)}1`);
        for (let k = 1; k < c.span; k++) r1 += cellV(1, ci + k, fest ? 3 : 2);
      }
      ci += c.span;
      i += c.span;
    }
    rows += `<row r="1" ht="30" customHeight="1">${r1}</row>`;

    // R2 date
    let r2 = cellV(2, 0, 12);
    cols.forEach(({ g }, k) => { r2 += cell(2, k + 1, `${String(g.giorno).padStart(2, "0")}-${MESI_BREVI[m]}`, 4); });
    rows += `<row r="2" ht="15" customHeight="1">${r2}</row>`;

    // R3 turni
    let r3 = cellV(3, 0, 12);
    cols.forEach(({ t }, k) => {
      const st = t.extra ? 7 : (t.label.includes("SUPER") || t.label.includes("PREFESTIVO")) ? 6 : 5;
      r3 += cell(3, k + 1, t.label, st);
    });
    rows += `<row r="3" ht="34" customHeight="1">${r3}</row>`;

    // Sedi
    const SEDI_EXPORT = ["SPILIMBERGO", "MANIAGO", "MEDUNO", "CLAUT", "ANDUINS"];
    const mapIdx = { MANIAGO: 0, SPILIMBERGO: 1, MEDUNO: 2, CLAUT: 3, ANDUINS: 4 };
    SEDI_EXPORT.forEach((sede, ri) => {
      const r = 4 + ri;
      let row = cell(r, 0, sede, 8);
      cols.forEach(({ t }, k) => {
        let testo = "", stile = 9;
        if (t.extra) {
          if (sede === "MANIAGO" && t.slots[0]) testo = `${byId[t.slots[0]].nome} (MMG)`;
        } else if (!t.slots.some(Boolean)) {
          if (sede === "MANIAGO" || sede === "SPILIMBERGO") { testo = "SCOPERTO"; stile = 11; }
        } else {
          const si = mapIdx[sede];
          const mid = t.slots[si];
          if (mid) {
            const nota = notaSlot(t.slots, si, t.fis);
            if (nota.tipo === "copertura") { testo = nota.testo; stile = 10; }
            else testo = byId[mid].nome + (nota.testo ? "\n" + nota.testo : "");
          }
        }
        row += cell(r, k + 1, testo, stile);
      });
      rows += `<row r="${r}" ht="42" customHeight="1">${row}</row>`;
    });

    const colsXML = `<cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="${cols.length + 1}" width="19" customWidth="1"/></cols>`;
    const mergeXML = merges.length ? `<mergeCells count="${merges.length}">${merges.map((mm) => `<mergeCell ref="${mm}"/>`).join("")}</mergeCells>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXML}<sheetData>${rows}</sheetData>${mergeXML}</worksheet>`;
  };

  const esporta = (tutto) => {
    try {
      const keys = tutto ? MESI_DISPONIBILI.map(({ anno: y, mese: m }) => mk(y, m)).filter((k) => store[k]?.schema) : [key];
      const fogli = [];
      keys.forEach((k) => {
        const xml = buildSheetXML(k);
        if (xml) {
          const [y, m] = k.split("-").map(Number);
          fogli.push({ nome: `${MESI_IT[m]} ${y}`, xml });
        }
      });
      if (!fogli.length) { alert("Nessuno schema elaborato da esportare."); return; }

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${fogli.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${fogli.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${fogli.map((f, i) => `<sheet name="${xmlEsc(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`;

      const files = [
        { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
        { name: "_rels/.rels", data: enc.encode(rels) },
        { name: "xl/workbook.xml", data: enc.encode(workbook) },
        { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRels) },
        { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
        ...fogli.map((f, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(f.xml) })),
      ];
      const zip = zipStore(files);
      const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tutto ? "ASFO_turni_CA_DistrettoNord.xlsx" : `ASFO_turni_CA_${MESI_IT[mese]}_${anno}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Errore export: " + e.message);
    }
  };

  // ============ AI ============
  const chiediAI = async () => {
    if (!aiInput.trim() || aiBusy) return;
    const domanda = aiInput.trim();
    setAiInput("");
    const msgs = [...aiMsgs, { role: "user", content: domanda }];
    setAiMsgs(msgs);
    setAiBusy(true);
    try {
      const stato = {
        mese: `${MESI_IT[mese]} ${anno}`,
        medici: MEDICI.map((m) => ({ nome: m.nome, categoria: CAT_INFO[m.cat].label, graduatoria: m.grad, oreExtra: dati.extraOre[m.id] || 0 })),
        mmgAttivi: Object.entries(dati.extras).filter(([, v]) => v.M || v.P).map(([k, v]) => `g${Number(k.slice(8, 10))}:${v.M ? "M" : ""}${v.P ? "P" : ""}`),
        avvisiScenari: dati.avvisi || [],
        disponibilita: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).length).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).map(([sk, v]) => { const [dt, tu] = sk.split("|"); const nv = normDispo(v); if (nv.no) return `g${Number(dt.slice(8, 10))}${tu}:NO`; return `g${Number(dt.slice(8, 10))}${tu}:${nv.piene.map((s) => SEDI_BREVI[s]).join(",")}${nv.ripiego.length ? "|rip:" + ripiegoPerLivello(nv.ripiego, nv.ripiegoLiv).map((s) => SEDI_BREVI[s] + (nv.ripiegoLiv[s] || 1)).join(",") : ""}${nv.preferito ? "|PREF" : ""}${nv.preferitoRip ? "|PREFRIP" : ""}`; })])),
        schema: dati.schema ? dati.schema.map((g) => ({
          giorno: g.giorno, festivo: g.festivo || null,
          turni: g.turni.map((t) => ({ turno: t.label, sedi: t.extra ? { copertura: t.slots[0] ? byId[t.slots[0]].nome : "SCOPERTO" } : Object.fromEntries(SEDI5.map((s, i) => [s, t.slots[i] ? byId[t.slots[i]].nome : "—"])) })),
        })) : "non ancora elaborato",
      };
      const sys = `Sei l'assistente del coordinatore della guardia medica ASFO Distretto Nord (sedi: Maniago, Spilimbergo, Meduno, Claut, Anduins).

== CALENDARIO MENSILE ==
- Giorno 27: invio mail richiesta disponibilità ai medici
- Entro giorno 3 (ore 23:59): scadenza disponibilità ed elaborazione primo schema
- Giorno 10 ore 8:00: invio primo schema ai medici
- Entro giorno 14 (ore 23:59): scadenza richieste di modifica
- Giorno 15: invio schema definitivo all'azienda sanitaria

== REGOLA TEMPORALE FONDAMENTALE ==
Le regole ordinarie di assegnazione (categoria, debito, graduatoria) si applicano SOLO alle disponibilità ricevute entro le 23:59 del giorno 3. Tutto ciò che arriva dopo — incluse le modifiche dal 10 al 14 — segue esclusivamente "first come, first served": vince chi arriva prima, indipendentemente da categoria o graduatoria.
UNICA ECCEZIONE: gli errori del coordinatore vanno sempre corretti retroattivamente, in qualsiasi fase.

== SEDI E SCENARI DI COPERTURA ==
Maniago e Spilimbergo devono sempre essere coperte PRIMA delle altre sedi.
- Scenario 1 (1 medico): va fisicamente in una CDC (MA o SP), copre l'altra a distanza, copre anche ME, CL, AN a distanza.
- Scenario 2 (2 medici): uno a MA, uno a SP. Chi ha priorità più alta (titolarità o graduatoria) copre ME a distanza. L'altro copre CL o AN.
- Scenario 3 (3 medici): copertura fisica MA, SP, ME. Claut → sempre a distanza da Maniago. Anduins → a distanza da chi tra SP e ME ha graduatoria più alta.
- Scenario 4 (4 medici): tutte le sedi coperte tranne una. Claut → a distanza da MA. Anduins → a distanza da SP o ME per titolarità/graduatoria.

== GERARCHIA CATEGORIE (priorità decrescente) ==
1. Indeterminato 36h/sett → spareggio: debito orario poi graduatoria
2. Indeterminato 24h/sett → spareggio: debito orario poi graduatoria
3. Determinato 36h/sett → spareggio: debito orario poi graduatoria
4. Determinato 24h/sett → spareggio: debito orario poi graduatoria
5. Senza incarico → SOLO graduatoria aziendale, nessun conteggio ore
La categoria superiore prevale SEMPRE finché il medico ha debito orario residuo positivo.

== FRAMEWORK DEBITO ORARIO ==
Conteggio mensile in ore effettive (NON settimanale, NON in numero di turni).
Monte ore mensile: 36h/sett → ~156 ore mensili | 24h/sett → ~104 ore mensili.
Risoluzione conflitto turno per turno in ordine cronologico:
- Debito diverso → vince chi ha debito residuo MAGGIORE
- Debito identico → vince chi è PIÙ ALTO in graduatoria (numero più basso = posizione migliore)
- Debito = 0 → il medico esce dalla competizione (può solo coprire turni completamente scoperti)
Dopo ogni assegnazione il debito del vincitore diminuisce delle ore del turno. Meccanismo auto-bilanciante: chi vince a parità scende di debito e perde il turno successivo a parità — equità automatica, con vantaggio strutturale per chi è più alto in graduatoria.

== REGOLA DEBITO ESAURITO ==
Quando un medico contrattualizzato raggiunge il monte ore (debito = 0), esce dalla priorità di categoria. I turni in conflitto vanno alle categorie inferiori con debito residuo o ai senza incarico. Il medico a debito zero può solo coprire turni rimasti completamente scoperti.

== REGOLA RECUPERO ORE ==
Un medico che il mese precedente non ha completato il monte ore può recuperare le ore mancanti nel mese corrente, MA SOLO se lo comunica esplicitamente al coordinatore. In quel caso: debito = monte ore ordinario + ore da recuperare. Con questo debito maggiorato partecipa normalmente a tutti i conflitti.

== SENZA INCARICO ==
Vince sempre il più alto in graduatoria, senza eccezioni. Nessun conteggio ore, nessuna flessibilità.

== DISPONIBILITÀ ==
Le disponibilità sono dicotomiche: disponibile (con sedi scelte) o non disponibile. Nessuno stato intermedio visibile.
- "NO" interno = indisponibilità dichiarata esplicitamente (protetta da sovrascritture massive)
- Assenza di dati = equivale a non disponibile
- "PREF" = turno preferito sulla preferenza piena (informativo, non decisionale sui conflitti)
- "PREFRIP" = lo vuole a tutti i costi anche in ripiego (informativo, non decisionale)
- Sia le preferenze piene che i ripieghi hanno livelli 1..5 (MA1,SP2 = Maniago prima scelta, Spilimbergo seconda)
- Livelli PARI su più preferenze piene = sedi INDIFFERENTI per il medico: il motore può spostarlo liberamente tra di esse per massimizzare il numero di medici al lavoro. Livello più basso = sede che il medico ha diritto di tenere, a meno che qualcuno con priorità superiore (categoria→debito→graduatoria) lo scalzi. I livelli non cambiano MAI chi vince un conflitto, solo quale sede viene assegnata a ciascun vincitore.

== COMPORTAMENTO ==
- Segnala sempre ogni conflitto risolto e il criterio usato
- Per ogni medico contrattualizzato indica il debito orario residuo aggiornato dopo ogni assegnazione
- I framework decisionali sono strumenti interni riservati al coordinatore — ai medici si comunica solo che i conflitti si risolvono per categoria e graduatoria
- In caso di dati ambigui o mancanti, chiedi chiarimento prima di procedere
- Gli errori del coordinatore si correggono sempre retroattivamente, in qualsiasi fase

RISPONDI SOLO con un oggetto JSON valido, senza backtick e senza testo fuori dal JSON, in uno di questi formati:
1) Domanda informativa → {"tipo":"risposta","testo":"..."}
2) Cambio mese visualizzato → {"tipo":"vai_mese","mese":"Dicembre","anno":2026}
3) Qualsiasi modifica → {"tipo":"modifiche","spiegazione":"riassunto breve","azioni":[ ...una o più azioni... ]}
Ogni azione ha un campo "az" che ne indica il tipo:
- {"az":"schema","giorno":14,"turno":"N","sede":"Maniago","medico":"WANG"} → cambia un'assegnazione nello schema (medico null = svuota la sede)
- {"az":"dispo_aggiungi","medico":"BEKAEVA","giorno":5,"turno":"N","sedi":["Maniago","Spilimbergo"],"sedi_liv":{"Maniago":1,"Spilimbergo":1},"ripiego":["Meduno","Claut"],"ripiego_liv":{"Meduno":1,"Claut":2},"preferito":true,"preferito_ripiego":false} → imposta la disponibilità: "sedi"=preferenze piene, "sedi_liv"=livello 1..5 per ciascuna piena (livelli PARI = sedi indifferenti per il medico, il motore può spostarlo tra esse; livello più basso = sede che ha diritto di tenere; omesso=1), "ripiego"=sedi di ripiego, "ripiego_liv"=livello per ciascuna sede ripiego (1=prima scelta, 5=ultima, omesso=1), "preferito"/"preferito_ripiego" informativi. Se il medico dice "Maniago o Spilimbergo indifferentemente" usa livelli pari; se dice "preferibilmente Maniago, altrimenti Spilimbergo" (entrambe accettate pienamente) usa Maniago:1, Spilimbergo:2.
- {"az":"dispo_no","medico":"CERVESATO","giorno":4,"turno":"N"} → segna il medico come esplicitamente NON disponibile per quel turno
- {"az":"dispo_togli","medico":"WANG","giorno":12,"turno":"N"} → rimuove la disponibilità
- {"az":"mmg","giorno":15,"fascia":"M","attivo":true} → attiva/disattiva turno MMG (fascia: M=mattina 8-14, P=pomeriggio 14-20)
- {"az":"ore_extra","medico":"PRESSACCO","ore":24} → imposta le ore extra del mese (0 per azzerare; solo medici con contratto)
- {"az":"elabora"} → elabora/rielabora lo schema del mese con le regole ufficiali (mettila SEMPRE per ultima se richiesta)
Note: "turno": N=notturno, G=diurno, M=mattina MMG, P=pomeriggio MMG. "sede"/"sedi": Maniago | Spilimbergo | Meduno | Claut | Anduins. "medico": cognome ESATTO dall'elenco. Puoi combinare più azioni nella stessa proposta, verranno eseguite in ordine. Se la richiesta non è chiara usa "risposta".
STATO ATTUALE: ${JSON.stringify(stato)}`;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 16000,
          messages: [...msgs.slice(-6).map((m) => ({ role: m.role, content: m.content })), { role: "user", content: `${sys}\n\nRICHIESTA: ${domanda}` }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        // API ha risposto con errore HTTP (es. 401, 529, ecc.)
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        setAiMsgs((p) => [...p, { role: "assistant", content: `Errore API: ${errMsg}. L'AI integrata funziona solo quando l'app è aperta come artifact attivo in claude.ai.` }]);
        setAiBusy(false);
        return;
      }
      let testo = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") || "";
      testo = testo.replace(/```json|```/g, "").trim();
      let obj = null;
      try { obj = JSON.parse(testo); } catch (e) { obj = null; }
      if (obj?.tipo === "vai_mese") {
        const mi = MESI_DISPONIBILI.findIndex((x) => MESI_IT[x.mese].toLowerCase() === String(obj.mese || "").toLowerCase() && x.anno === Number(obj.anno));
        if (mi >= 0) {
          setMeseIdx(mi);
          setAiMsgs((p) => [...p, { role: "assistant", content: `Ti ho portato su ${MESI_IT[MESI_DISPONIBILI[mi].mese]} ${MESI_DISPONIBILI[mi].anno}.` }]);
        } else {
          setAiMsgs((p) => [...p, { role: "assistant", content: "Mese non trovato (calendario: Agosto 2026 – Dicembre 2027)." }]);
        }
      } else if ((obj?.tipo === "modifiche" || obj?.tipo === "modifica" || obj?.tipo === "modifica_dispo") && Array.isArray(obj.azioni) && obj.azioni.length) {
        // retrocompatibilità con i vecchi formati
        const azioni = obj.azioni.map((a) => {
          if (a.az) return a;
          if (obj.tipo === "modifica_dispo") return a.op === "togli" ? { az: "dispo_togli", ...a } : { az: "dispo_aggiungi", ...a };
          return { az: "schema", ...a };
        });
        setProposta({ azioni, spiegazione: obj.spiegazione || "Modifica proposta" });
        setAiMsgs((p) => [...p, { role: "assistant", content: `PROPOSTA: ${obj.spiegazione || "modifica"} — conferma o annulla qui sotto.` }]);
      } else if (obj?.tipo === "risposta") {
        setAiMsgs((p) => [...p, { role: "assistant", content: obj.testo }]);
      } else {
        setAiMsgs((p) => [...p, { role: "assistant", content: testo || "Nessuna risposta." }]);
      }
    } catch (e) {
      setAiMsgs((p) => [...p, { role: "assistant", content: `Errore: ${e?.message || String(e)}. Verifica di star usando l'app all'interno di claude.ai come artifact attivo (non come file scaricato).` }]);
    }
    setAiBusy(false);
  };

  const nomeToId = (nome) => {
    if (!nome) return null;
    const n = String(nome).trim().toUpperCase();
    const m = MEDICI.find((x) => x.nome === n) || MEDICI.find((x) => x.nome.startsWith(n)) || MEDICI.find((x) => n.startsWith(x.nome));
    return m ? m.id : undefined; // undefined = non trovato
  };

  const applicaProposta = () => {
    if (!proposta) return;
    const errori = [];
    let dispo = { ...dati.dispo };
    let extras = { ...dati.extras };
    let extraOre = { ...dati.extraOre };
    let schema = dati.schema;
    let daElaborare = false;
    let dispoModificata = false;

    proposta.azioni.forEach((a) => {
      if (a.az === "elabora") { daElaborare = true; return; }
      if (a.az === "vai_mese") return;
      if (a.az === "mmg") {
        const dateKey = dk(anno, mese, a.giorno);
        const ex = { ...(extras[dateKey] || {}) };
        ex[a.fascia === "P" ? "P" : "M"] = a.attivo !== false;
        extras = { ...extras, [dateKey]: ex };
        return;
      }
      if (a.az === "ore_extra") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        if (CAT_INFO[byId[mid].cat].ore === null) { errori.push(`${a.medico} è senza incarico, niente ore extra`); return; }
        extraOre = { ...extraOre, [mid]: Math.max(0, Number(a.ore) || 0) };
        return;
      }
      if (a.az === "dispo_aggiungi" || a.az === "dispo_togli" || a.az === "dispo_no") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        const slotKey = `${dk(anno, mese, a.giorno)}|${a.turno}`;
        const nd = { ...(dispo[mid] || {}) };
        if (a.az === "dispo_togli") delete nd[slotKey];
        else if (a.az === "dispo_no") nd[slotKey] = { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false };
        else {
          const piene = (a.sedi || []).filter((s) => SEDI5.includes(s));
          const rip = (a.ripiego || []).filter((s) => SEDI5.includes(s) && !piene.includes(s));
          if (!piene.length && !rip.length) { errori.push(`sedi non valide per ${a.medico} g${a.giorno}`); return; }
          const prefRip = !!a.preferito_ripiego;
          if (prefRip && !rip.length) errori.push(`preferito sul ripiego per ${a.medico} g${a.giorno} ignorato: nessuna sede di ripiego indicata`);
          // sedi_liv / ripiego_liv opzionali dall'AI: {sede:livello} — default 1 per le sedi non specificate
          const pieneLivAI = {};
          piene.forEach((s) => { pieneLivAI[s] = (a.sedi_liv && a.sedi_liv[s]) ? Number(a.sedi_liv[s]) : 1; });
          const ripLivAI = {};
          rip.forEach((s) => { ripLivAI[s] = (a.ripiego_liv && a.ripiego_liv[s]) ? Number(a.ripiego_liv[s]) : 1; });
          nd[slotKey] = { piene, pieneLiv: pieneLivAI, ripiego: rip, ripiegoLiv: ripLivAI, no: false, preferito: !!a.preferito && piene.length > 0, preferitoRip: prefRip && rip.length > 0 };
        }
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "schema") {
        if (!schema) { errori.push(`schema non ancora elaborato (giorno ${a.giorno})`); return; }
        const gi = schema.findIndex((g) => g.giorno === a.giorno);
        if (gi < 0) { errori.push(`giorno ${a.giorno} non trovato`); return; }
        const ti = schema[gi].turni.findIndex((t) => t.id === a.turno);
        if (ti < 0) { errori.push(`turno ${a.turno} assente il ${a.giorno}`); return; }
        const t = schema[gi].turni[ti];
        const si = t.extra ? 0 : SEDI5.indexOf(a.sede);
        if (si < 0) { errori.push(`sede ${a.sede} non valida`); return; }
        const mid = a.medico === null ? null : nomeToId(a.medico);
        if (mid === undefined) { errori.push(`medico ${a.medico} non trovato`); return; }
        schema = schema.map((g, x) => x !== gi ? g : {
          ...g, turni: g.turni.map((tt, y) => y !== ti ? tt : { ...tt, slots: tt.slots.map((s, z) => z !== si ? s : mid) }),
        });
        return;
      }
      errori.push(`azione sconosciuta: ${a.az}`);
    });

    let avvisiNuovi = dati.avvisi;
    if (daElaborare) { const r = elaboraSchema(dispo, extraOre, anno, mese, extras); schema = r.schema; avvisiNuovi = r.avvisi; }
    setDati({ dispo, extras, extraOre, schema, avvisi: avvisiNuovi });
    let msg = errori.length ? `Applicata con avvisi: ${errori.join("; ")}. ` : "Modifiche applicate ✓ (annullabile con ↶). ";
    if (dispoModificata && schema && !daElaborare) msg += "Disponibilità cambiate con schema già elaborato: valuta se rielaborarlo o correggerlo a mano.";
    setAiMsgs((p) => [...p, { role: "assistant", content: msg.trim() }]);
    setProposta(null);
  };
  const rifiutaProposta = () => {
    setAiMsgs((p) => [...p, { role: "assistant", content: "Proposta annullata, nessuna modifica applicata." }]);
    setProposta(null);
  };

  const mediciOrd = useMemo(() => [...mediciList].sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || a.grad - b.grad), [mediciList]);
  const iconaT = { G: "☀", N: "☾", M: "am", P: "pm" };
  const btn = { padding: "8px 12px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 12 };
  const hPast = historyRef.current.past.length, hFut = historyRef.current.future.length;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "#f6f7f5", minHeight: "100vh", color: "#22252a" }}>
      <div style={{ background: "#12312a", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7 }}>ASFO · DISTRETTO NORD</div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Coordinamento Turni Guardia Medica</h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setMeseIdx((i) => Math.max(0, i - 1))} disabled={meseIdx === 0} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{MESI_IT[mese]} {anno}</div>
          <button onClick={() => setMeseIdx((i) => Math.min(MESI_DISPONIBILI.length - 1, i + 1))} disabled={meseIdx === MESI_DISPONIBILI.length - 1} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>›</button>
          <button onClick={() => setAiOpen((o) => !o)} style={{ ...btn, background: aiOpen ? "#fff" : "rgba(255,255,255,.15)", color: aiOpen ? "#12312a" : "#fff", border: "none", fontWeight: 700 }}>Assistente AI</button>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #dde0dc", padding: "0 16px", flexWrap: "wrap", alignItems: "center" }}>
        {[["dispo", "1 · Disponibilità"], ["mmg", "2 · Coperture MMG"], ["medici", "3 · Medici / ore extra"], ["schema", "4 · Schema turni"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "12px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 600 : 400, color: tab === k ? "#12312a" : "#7a7f78", borderBottom: tab === k ? "3px solid #12312a" : "3px solid transparent" }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, padding: "8px 0", flexWrap: "wrap" }}>
          <button onClick={annulla} disabled={!hPast} title="Annulla ultima azione" style={{ ...btn, opacity: hPast ? 1 : 0.4, fontWeight: 700 }}>↶ Annulla</button>
          <button onClick={ripeti} disabled={!hFut} title="Ripeti azione annullata" style={{ ...btn, opacity: hFut ? 1 : 0.4, fontWeight: 700 }}>↷ Ripeti</button>
          <button onClick={elabora} style={{ ...btn, background: "#1a5c4a", color: "#fff", border: "none", fontWeight: 600 }}>Elabora schema</button>
          <button onClick={() => esporta(false)} style={btn}>Esporta mese</button>
          <button onClick={() => esporta(true)} style={btn}>Esporta anno</button>
        </div>
      </div>

      {!caricato && <div style={{ padding: 8, textAlign: "center", fontSize: 12, background: "#fdf3dd", color: "#8a5a00" }}>Carico i dati salvati…</div>}
      <div style={{ display: "flex" }}>
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          {tab === "dispo" && (
            <div>
              <p style={{ fontSize: 12, color: "#5b5f59", margin: "0 0 8px" }}>
Ogni cella è <b style={{color:"#1a5c4a"}}>disponibile</b> (verde, con le sedi scelte) oppure <b style={{color:"#a03030"}}>✕ non disponibile</b> (rosso) — nessuno stato intermedio: finché non la rendi disponibile, resta non disponibile. Tocca una cella per scegliere le sedi in <b style={{color:"#1a5c4a"}}>preferenza</b> verde o <b style={{color:"#a07a00"}}>ripiego</b> giallo (usato solo se serve a completare lo scenario), e i <b style={{color:"#8a5a00"}}>★ preferiti</b>: sulla preferenza e/o anche in ripiego (= lo vuole a tutti i costi). Nel popup ogni tocco aumenta il livello della sede: preferenza 1→5, poi ripiego 1→5, poi esce. <b>Livelli pari su più preferenze = sedi indifferenti</b> per il medico: il motore può spostarlo tra di esse per far lavorare anche chi ha una sola sede; il livello più basso è la sede che ha diritto di tenere. In cella: "2·SP¹CL²" = 2 preferenze (tutte liv.1) + Spilimbergo 1° ripiego + Claut 2°; se le preferenze hanno livelli diversi appare "MA¹SP²" al posto del conteggio; ★ prima = preferito sulla preferenza, ★ dopo = lo vuole anche in ripiego. Ogni azione è annullabile con ↶.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <button onClick={azzeraMese}
                  style={{ padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: confermaAzzera ? "2px solid #a03030" : "1px solid #e0b8b8",
                    background: confermaAzzera ? "#a03030" : "#fff",
                    color: confermaAzzera ? "#fff" : "#a03030" }}>
                  {confermaAzzera ? "⚠ Confermi? Tocca di nuovo per CANCELLARE tutto il mese" : "🗑 Azzera mese da capo"}
                </button>
                <button onClick={() => setRapidoOpen((o) => !o)} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #1a5c4a", background: rapidoOpen ? "#1a5c4a" : "#fff", color: rapidoOpen ? "#fff" : "#1a5c4a", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>⚡ Inserimento rapido per intervallo</button>
              </div>
              {rapidoOpen && (
                <div style={{ background: "#fff", border: "2px solid #1a5c4a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Inserimento rapido</div>
                  <div style={{ fontSize: 11, color: "#5b5f59", marginBottom: 10 }}>Dichiara il periodo di riferimento e le sedi: tutto il periodo diventa disponibile, tranne gli eventuali periodi non disponibili che elenchi sotto.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: "#5b5f59" }}>Medico<br />
                      <select value={rapMedico} onChange={(e) => setRapMedico(Number(e.target.value))} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }}>
                        {[...MEDICI].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 11, color: "#5b5f59" }}>Dal<br />
                      <input type="date" min="2026-08-01" max="2027-12-31" value={rapInizio} onChange={(e) => setRapInizio(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }} />
                    </label>
                    <label style={{ fontSize: 11, color: "#5b5f59" }}>Al<br />
                      <input type="date" min="2026-08-01" max="2027-12-31" value={rapFine} onChange={(e) => setRapFine(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
                    <label style={{ cursor: "pointer" }}><input type="checkbox" checked={rapNotte} onChange={(e) => setRapNotte(e.target.checked)} /> Notturno</label>
                    <label style={{ cursor: "pointer" }}><input type="checkbox" checked={rapGiorno} onChange={(e) => setRapGiorno(e.target.checked)} /> Diurno (solo weekend/festivi)</label>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#8a8f88", marginBottom: 6 }}>Sedi per i giorni <b style={{color:"#1a5c4a"}}>disponibili</b> del periodo — tocca: preferenza verde → ripiego giallo → togli</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SEDI5.map((s) => {
                        const stato = rapSedi[s] || "off";
                        return (
                          <span key={s} onClick={() => setRapSedi((prev) => {
                            const cur = prev[s] || "off";
                            const next = cur === "off" ? "piena" : cur === "piena" ? "ripiego" : "off";
                            const np = { ...prev };
                            if (next === "off") delete np[s]; else np[s] = next;
                            return np;
                          })}
                            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none",
                              background: stato === "piena" ? "#1a5c4a" : stato === "ripiego" ? "#f0cb4d" : "#eceee9",
                              color: stato === "piena" ? "#fff" : stato === "ripiego" ? "#5b4400" : "#a9ada5" }}>
                            {SEDI_BREVI[s]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#8a8f88", marginBottom: 6 }}>
                      Periodi <b style={{color:"#a03030"}}>non disponibili</b> dentro l'intervallo (es. ferie) — tutto il resto del periodo sopra diventa disponibile automaticamente. Un giorno già segnato non disponibile in precedenza (fuori da questi periodi) resta protetto e non viene toccato.
                    </div>
                    {rapIndisp.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 6 }}>
                        <label style={{ fontSize: 11, color: "#5b5f59" }}>Dal<br />
                          <input type="date" min="2026-08-01" max="2027-12-31" value={r.inizio}
                            onChange={(e) => setRapIndisp((prev) => prev.map((x, xi) => xi === i ? { ...x, inizio: e.target.value } : x))}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }} />
                        </label>
                        <label style={{ fontSize: 11, color: "#5b5f59" }}>Al<br />
                          <input type="date" min="2026-08-01" max="2027-12-31" value={r.fine}
                            onChange={(e) => setRapIndisp((prev) => prev.map((x, xi) => xi === i ? { ...x, fine: e.target.value } : x))}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }} />
                        </label>
                        <button onClick={() => setRapIndisp((prev) => prev.filter((_, xi) => xi !== i))}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #e0b8b8", background: "#fdecec", color: "#a03030", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setRapIndisp((prev) => [...prev, { inizio: "", fine: "" }])}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "1px dashed #a03030", background: "#fff", color: "#a03030", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Aggiungi periodo non disponibile</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={applicaRapido} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1a5c4a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Applica</button>
                    <button onClick={() => setRapidoOpen(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 12 }}>Chiudi</button>
                  </div>
                  <div style={{ fontSize: 10, color: "#8a8f88", marginTop: 8 }}>Dopo puoi correggere le singole eccezioni toccando le celle nella griglia sotto — es. per marcare un giorno come preferito.</div>
                </div>
              )}
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e0", overflow: "auto", maxHeight: "68vh", position: "relative" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#f0f2ee", padding: "5px 8px", textAlign: "left", minWidth: 160, borderBottom: "2px solid #d6dad3" }}>Medico</th>
                      {colonne.map((c, i) => (
                        <th key={i} style={{ position: "sticky", top: 0, zIndex: 2, padding: "3px 2px", minWidth: 30, background: c.festivo || c.prefestivo ? "#fbe9e0" : c.weekend ? "#eef3ea" : "#f0f2ee", borderBottom: "2px solid #d6dad3" }}>
                          <div style={{ fontSize: 8, color: "#8a8f88" }}>{GIORNI_BREVI[c.dow]}</div>
                          <div style={{ fontWeight: 700 }}>{c.giorno}</div>
                          <div style={{ fontSize: 8 }}>{iconaT[c.turno.id]}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mediciOrd.map((m) => (
                      <tr key={m.id}>
                        <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "4px 8px", borderBottom: "1px solid #eef0ec", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, fontSize: 10.5 }}>{m.nome}</div>
                          <div style={{ fontSize: 8.5, color: CAT_INFO[m.cat].color, fontWeight: 600 }}>{CAT_INFO[m.cat].label}</div>
                        </td>
                        {colonne.map((c, i) => {
                          const sk = `${c.key}|${c.turno.id}`;
                          const sedi = normDispo(dati.dispo[m.id]?.[sk]);
                          const on = !sedi.no && (sedi.piene.length + sedi.ripiego.length > 0);
                          const inEdit = editCella && editCella.mid === m.id && editCella.slotKey === sk;
                          // Dicotomico: SOLO 2 stati visivi possibili — disponibile (verde) o non disponibile
                          // (rosso). "Non specificato" e "NO esplicito" appaiono identici: la distinzione
                          // interna esiste solo per proteggere le indisponibilità dichiarate dall'inserimento
                          // rapido, non è mai mostrata all'utente.
                          const bg = inEdit ? "#8a5a00" : on ? "#1a5c4a" : "#fdecec";
                          const fg = inEdit ? "#fff" : on ? "#fff" : "#c65b5b";
                          return (
                            <td key={i} style={{ borderBottom: "1px solid #eef0ec", borderLeft: "1px solid #f4f6f2", textAlign: "center", cursor: "pointer", background: bg, color: fg, padding: "5px 0", userSelect: "none", position: "relative", fontWeight: 700 }}
                              onClick={() => {
                                if (inEdit) setEditCella(null);
                                else setEditCella({ mid: m.id, slotKey: sk, giorno: c.giorno, turno: c.turno.label });
                              }}>
                              {on ? (() => {
                                const sup = ["¹","²","³","⁴","⁵"];
                                const ripStr = sedi.ripiego.length
                                  ? "·" + ripiegoPerLivello(sedi.ripiego, sedi.ripiegoLiv)
                                      .map((s) => SEDI_BREVI[s] + sup[(sedi.ripiegoLiv[s] || 1) - 1]).join("")
                                    + (sedi.preferitoRip ? "★" : "")
                                  : "";
                                // Piene: compatte (solo conteggio) se tutte a livello 1,
                                // dettagliate (sigla+livello) se il medico ha espresso un ordine
                                const tutteLv1 = sedi.piene.every((s) => (sedi.pieneLiv[s] || 1) === 1);
                                const pieneStr = tutteLv1
                                  ? String(sedi.piene.length)
                                  : ripiegoPerLivello(sedi.piene, sedi.pieneLiv)
                                      .map((s) => SEDI_BREVI[s] + sup[(sedi.pieneLiv[s] || 1) - 1]).join("");
                                return `${sedi.preferito ? "★" : ""}${pieneStr}${ripStr}`;
                              })() : "✕"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editCella && (() => {
                const sedi = normDispo(dati.dispo[editCella.mid]?.[editCella.slotKey]);
                return (
                  <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", background: "#fff", border: "1px solid #c8ccc6", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.25)", padding: 14, zIndex: 50, minWidth: 290, maxWidth: "92vw" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{byId[editCella.mid].nome}</div>
                    <div style={{ fontSize: 11, color: "#6b7068", marginBottom: 8 }}>Giorno {editCella.giorno} · {editCella.turno}</div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <span onClick={() => setNoCella(editCella.mid, editCella.slotKey, false)}
                        style={{ flex: 1, textAlign: "center", padding: "8px 6px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, userSelect: "none", background: !sedi.no ? "#1a5c4a" : "#eceee9", color: !sedi.no ? "#fff" : "#8a8f88" }}>
                        Disponibile
                      </span>
                      <span onClick={() => setNoCella(editCella.mid, editCella.slotKey, true)}
                        style={{ flex: 1, textAlign: "center", padding: "8px 6px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, userSelect: "none", background: sedi.no ? "#a03030" : "#eceee9", color: sedi.no ? "#fff" : "#8a8f88" }}>
                        Non disponibile
                      </span>
                    </div>

                    {sedi.no ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setEditCella(null)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", background: "#12312a", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Chiudi</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 10, color: "#8a8f88", marginBottom: 8 }}>Ogni tocco su una sede aumenta il livello: <b style={{ color: "#1a5c4a" }}>preferenza</b> verde 1→5, poi <b style={{ color: "#a07a00" }}>ripiego</b> giallo 1→5, poi esce. Livelli <b>pari</b> su più sedi verdi = per il medico sono <b>indifferenti</b> (il motore può spostarlo tra di esse per far lavorare più medici); livello più basso = sede che ha diritto di tenere.</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                          {SEDI5.map((s) => {
                            const sup = ["¹","²","³","⁴","⁵"];
                            const stato = sedi.piene.includes(s) ? "piena" : sedi.ripiego.includes(s) ? "ripiego" : "no";
                            const livello = stato === "piena" ? (sedi.pieneLiv[s] || 1) : stato === "ripiego" ? (sedi.ripiegoLiv[s] || 1) : null;
                            return (
                              <span key={s} onClick={() => toggleSedeCella(editCella.mid, editCella.slotKey, s)}
                                title={stato === "piena" ? `Preferenza livello ${livello} — tocca per aumentare, dopo il 5 passa a ripiego` : stato === "ripiego" ? `Ripiego livello ${livello} — tocca per aumentare, al 6° tocco esce` : "Tocca per aggiungere come preferenza piena"}
                                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none",
                                  background: stato === "piena" ? "#1a5c4a" : stato === "ripiego" ? "#f0cb4d" : "#eceee9",
                                  color: stato === "piena" ? "#fff" : stato === "ripiego" ? "#5b4400" : "#a9ada5" }}>
                                {SEDI_BREVI[s]}{livello !== null ? sup[livello - 1] : ""}
                              </span>
                            );
                          })}
                        </div>
                        {(sedi.piene.length > 0 || sedi.ripiego.length > 0) && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            {sedi.piene.length > 0 && (
                              <span onClick={() => setPreferitoCella(editCella.mid, editCella.slotKey, "preferito", !sedi.preferito)}
                                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none", border: "1px solid " + (sedi.preferito ? "#d9a53f" : "#d6dad3"), background: sedi.preferito ? "#fdf3dd" : "#fff", color: sedi.preferito ? "#8a5a00" : "#8a8f88" }}>
                                {sedi.preferito ? "★" : "☆"} Preferito (sulla preferenza)
                              </span>
                            )}
                            {sedi.ripiego.length > 0 && (
                              <span onClick={() => setPreferitoCella(editCella.mid, editCella.slotKey, "preferitoRip", !sedi.preferitoRip)}
                                title="Lo vuole comunque, anche se finisce sul ripiego"
                                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none", border: "1px solid " + (sedi.preferitoRip ? "#d9a53f" : "#d6dad3"), background: sedi.preferitoRip ? "#fdf3dd" : "#fff", color: sedi.preferitoRip ? "#8a5a00" : "#8a8f88" }}>
                                {sedi.preferitoRip ? "★" : "☆"} Anche in ripiego
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setEditCella(null)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", background: "#12312a", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Chiudi</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {tab === "mmg" && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e0", padding: 16 }}>
              <p style={{ fontSize: 12, color: "#5b5f59", marginTop: 0 }}>Attiva Mattina 8-14 / Pomeriggio 14-20 nei giorni con copertura MMG richiesta.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                {giorniMese.map((g, i) => (
                  <div key={i} style={{ border: "1px solid #e2e5e0", borderRadius: 8, padding: "6px 8px", background: g.festivo || g.prefestivo ? "#fdf5f0" : "#fff" }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{i + 1} <span style={{ fontWeight: 400, color: "#8a8f88" }}>{GIORNI_BREVI[g.dow]}</span></div>
                    <label style={{ display: "block", fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={!!dati.extras[g.key]?.M} onChange={() => toggleExtra(g.key, "M")} /> Mattina</label>
                    <label style={{ display: "block", fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={!!dati.extras[g.key]?.P} onChange={() => toggleExtra(g.key, "P")} /> Pomeriggio</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "medici" && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e0", padding: 16, maxWidth: 860, overflow: "auto" }}>
              <p style={{ fontSize: 12, color: "#5b5f59", marginTop: 0 }}>
                Le <b>ore extra</b> (su fiducia) si sommano al monte ore: il medico resta in categoria con piena priorità fino a coprire il totale.
                Qui puoi anche <b>modificare categoria e graduatoria</b> di ciascun medico e <b>aggiungerne di nuovi</b> — le modifiche valgono per tutti i mesi.
                Dopo una modifica, rielabora gli schemi dei mesi già elaborati.
              </p>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #d6dad3" }}>
                  <th style={{ padding: "6px 8px" }}>Medico</th><th style={{ padding: "6px 8px" }}>Categoria</th><th style={{ padding: "6px 8px" }}>Grad.</th><th style={{ padding: "6px 8px" }}>Monte ore</th><th style={{ padding: "6px 8px" }}>Ore extra</th><th style={{ padding: "6px 8px" }}></th>
                </tr></thead>
                <tbody>
                  {mediciOrd.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #eef0ec" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m.nome}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <select value={m.cat} onChange={(e) => aggiornaMedico(m.id, { cat: e.target.value })}
                          style={{ fontSize: 11, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6", background: CAT_INFO[m.cat].bg, color: CAT_INFO[m.cat].color, fontWeight: 600 }}>
                          {Object.entries(CAT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="number" min={0} value={m.grad}
                          onChange={(e) => aggiornaMedico(m.id, { grad: Number(e.target.value) })}
                          style={{ width: 58, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6" }} />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{CAT_INFO[m.cat].ore ?? "—"}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {CAT_INFO[m.cat].ore !== null ? (
                          <input type="number" min={0} step={6} value={dati.extraOre[m.id] || 0}
                            onChange={(e) => setDati({ extraOre: { ...dati.extraOre, [m.id]: Number(e.target.value) }, schema: null })}
                            style={{ width: 64, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6" }} />
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <button onClick={() => rimuoviMedico(m.id)} title="Rimuovi medico dall'elenco"
                          style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #e0b8b8", background: "#fff", color: "#a03030", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 14, padding: 12, border: "1px dashed #1a5c4a", borderRadius: 8, background: "#f7faf8" }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#1a5c4a" }}>+ Aggiungi nuovo medico</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ fontSize: 11, color: "#5b5f59" }}>Cognome<br />
                    <input type="text" value={nuovoMedico.nome} placeholder="es. ROSSI"
                      onChange={(e) => setNuovoMedico((p) => ({ ...p, nome: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3, width: 150 }} />
                  </label>
                  <label style={{ fontSize: 11, color: "#5b5f59" }}>Categoria<br />
                    <select value={nuovoMedico.cat} onChange={(e) => setNuovoMedico((p) => ({ ...p, cat: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3 }}>
                      {Object.entries(CAT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 11, color: "#5b5f59" }}>Graduatoria<br />
                    <input type="number" min={0} value={nuovoMedico.grad} placeholder="es. 88"
                      onChange={(e) => setNuovoMedico((p) => ({ ...p, grad: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6", marginTop: 3, width: 80 }} />
                  </label>
                  <button onClick={aggiungiMedico}
                    style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "#1a5c4a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Aggiungi</button>
                </div>
              </div>
            </div>
          )}

          {tab === "schema" && (
            !dati.schema ? (
              <div style={{ background: "#fff", border: "1px dashed #c8ccc6", borderRadius: 10, padding: 36, textAlign: "center", color: "#7a7f78" }}>Inserisci le disponibilità e premi <b>Elabora schema</b>.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {dati.avvisi && dati.avvisi.length > 0 && (
                  <div style={{ background: "#fdf3dd", border: "2px solid #d9a53f", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#8a5a00" }}>⚠ Avvisi — richieste da fare ai medici ({dati.avvisi.length})</div>
                    {dati.avvisi.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, padding: "4px 0", borderTop: i > 0 ? "1px solid #efe0c0" : "none" }}>{a}</div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 12, color: "#5b5f59", margin: "0 0 4px" }}>
                  Tutte le 5 sedi sono modificabili. <b>Stesso nome su più sedi = copertura a distanza</b> (nell'export diventa "*coperto da …"). Ogni modifica è annullabile con ↶.
                </p>
                {dati.schema.map((g, gi) => (
                  <div key={gi} style={{ background: "#fff", border: "1px solid #e2e5e0", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{g.giorno}</span>
                      <span style={{ fontSize: 10, color: "#8a8f88" }}>{GIORNI_IT[g.dow]}</span>
                      {g.festivo && <span style={{ fontSize: 9, background: "#fbe0d5", color: "#a04010", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{g.festivo}</span>}
                      {g.prefestivo && <span style={{ fontSize: 9, background: "#fdf0d5", color: "#8a5a00", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>PREFESTIVO</span>}
                    </div>
                    {g.turni.map((t, ti) => {
                      const vuoto = !t.slots.some(Boolean);
                      return (
                        <div key={ti} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", borderTop: ti > 0 ? "1px solid #f2f4f0" : "none", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, minWidth: 140, color: "#4a5048", paddingTop: 4 }}>{t.label}</span>
                          {vuoto && <span style={{ color: "#b03030", fontWeight: 700, fontSize: 11, paddingTop: 4 }}>SCOPERTO</span>}
                          {(t.extra ? ["Copertura"] : SEDI5).map((sede, si) => {
                            const nota = t.extra ? { testo: "", tipo: "primaria" } : notaSlot(t.slots, si, t.fis);
                            return (
                              <span key={si} style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: nota.tipo === "copertura" ? "#eef3ea" : "#f4f6f2", borderRadius: 5, padding: "3px 6px", fontSize: 11 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <b style={{ fontSize: 10 }}>{sede}</b>
                                  <select value={t.slots[si] || ""} onChange={(e) => setSlot(gi, ti, si, e.target.value)} style={{ fontSize: 11, border: "1px solid #d6dad3", borderRadius: 4, padding: "1px 2px", maxWidth: 110 }}>
                                    <option value="">—</option>
                                    {MEDICI.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                  </select>
                                </span>
                                {nota.testo && <span style={{ color: "#6b7068", fontSize: 9 }}>{nota.testo}</span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {aiOpen && (
          <div style={{ width: 320, borderLeft: "1px solid #dde0dc", background: "#fff", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "sticky", top: 0 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0ec", fontWeight: 700, fontSize: 13 }}>Assistente AI <span style={{ fontWeight: 400, color: "#8a8f88" }}>— risponde solo se interpellata</span></div>
            <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 8, alignContent: "start" }}>
              {aiMsgs.length === 0 && <div style={{ fontSize: 12, color: "#8a8f88" }}>Chiedimi es.: "ci sono turni scoperti?", "chi lavora a Ferragosto?", "riassumi lo schema".</div>}
              {aiMsgs.map((m, i) => (
                <div key={i} style={{ background: m.role === "user" ? "#12312a" : "#f0f2ee", color: m.role === "user" ? "#fff" : "#22252a", borderRadius: 8, padding: "8px 10px", fontSize: 12, whiteSpace: "pre-wrap", justifySelf: m.role === "user" ? "end" : "start", maxWidth: "90%" }}>{m.content}</div>
              ))}
              {aiBusy && <div style={{ fontSize: 12, color: "#8a8f88" }}>Sto ragionando…</div>}
              {proposta && (
                <div style={{ border: "2px solid #8a5a00", background: "#fdf3dd", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Sto per applicare:</div>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>{proposta.spiegazione}</div>
                  <ul style={{ margin: "0 0 8px", paddingLeft: 16, fontSize: 11 }}>
                    {proposta.azioni.map((a, i) => {
                      let d = "";
                      if (a.az === "schema") d = `Schema: giorno ${a.giorno} · ${a.turno} · ${a.sede} → ${a.medico || "— (svuota)"}`;
                      else if (a.az === "dispo_aggiungi") d = `Disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno} → ${(a.sedi || []).map((s) => SEDI_BREVI[s] || s).join(", ")}${(a.ripiego || []).length ? ` (+ ripiego: ${a.ripiego.map((s) => SEDI_BREVI[s] || s).join(", ")})` : ""}${a.preferito ? " ★ preferito" : ""}${a.preferito_ripiego ? " ★ anche ripiego" : ""}`;
                      else if (a.az === "dispo_no") d = `Segna NON disponibile: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "dispo_togli") d = `Togli disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "mmg") d = `MMG: giorno ${a.giorno} · ${a.fascia === "P" ? "pomeriggio" : "mattina"} → ${a.attivo === false ? "disattiva" : "attiva"}`;
                      else if (a.az === "ore_extra") d = `Ore extra: ${a.medico} → ${a.ore}h`;
                      else if (a.az === "elabora") d = "Elabora lo schema del mese con le regole ufficiali";
                      else d = JSON.stringify(a);
                      return <li key={i}>{d}</li>;
                    })}
                  </ul>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={applicaProposta} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: "#1a5c4a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Conferma</button>
                    <button onClick={rifiutaProposta} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 12 }}>Annulla</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid #eef0ec", display: "flex", gap: 6 }}>
              <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chiediAI()} placeholder="Scrivi qui…" style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #c8ccc6", fontSize: 12 }} />
              <button onClick={chiediAI} disabled={aiBusy} style={{ ...btn, background: "#1a5c4a", color: "#fff", border: "none", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

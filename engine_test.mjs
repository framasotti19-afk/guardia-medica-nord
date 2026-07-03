
// ============ DATI SIMULAZIONE ============
// MEDICI è modificabile dall'interfaccia (tab Medici): la lista di default viene
// sovrascritta da quella salvata nello store, tramite setMediciGlobal.
// sedeContratto: solo per i determinati (DET36/DET24) — "Maniago" | "Spilimbergo" | null.
// Vedi CONTEXT.md §3.1a per la regola di titolarità.
const MEDICI_DEFAULT = [
  { id: 1, nome: "BERTUZZI", grad: 0, cat: "INDET", sedeContratto: null },
  { id: 2, nome: "CAMPANER", grad: 1, cat: "INDET", sedeContratto: null },
  { id: 3, nome: "TRIGODKO", grad: 4, cat: "DET36", sedeContratto: null },
  { id: 4, nome: "PRESSACCO", grad: 57, cat: "DET36", sedeContratto: null },
  { id: 5, nome: "GHIZZO", grad: 91, cat: "DET36", sedeContratto: null },
  { id: 6, nome: "IENGO", grad: 107, cat: "DET36", sedeContratto: null },
  { id: 7, nome: "DE MARCHI L", grad: 130, cat: "DET36", sedeContratto: null },
  { id: 8, nome: "FOSCHIANI", grad: 3, cat: "DET24", sedeContratto: null },
  { id: 9, nome: "BEKAEVA", grad: 17, cat: "DET24", sedeContratto: null },
  { id: 10, nome: "CERVESATO", grad: 63, cat: "DET24", sedeContratto: null },
  { id: 11, nome: "COLOSETTI", grad: 97, cat: "DET24", sedeContratto: null },
  { id: 12, nome: "WANG", grad: 124, cat: "DET24", sedeContratto: null },
  { id: 13, nome: "ZURLO", grad: 2, cat: "SENZA", sedeContratto: null },
  { id: 14, nome: "GRANDO", grad: 13, cat: "SENZA", sedeContratto: null },
  { id: 15, nome: "PITAU", grad: 14, cat: "SENZA", sedeContratto: null },
  { id: 16, nome: "DE CECCO-BEOLCHI", grad: 20, cat: "SENZA", sedeContratto: null },
  { id: 17, nome: "MICHELI", grad: 39, cat: "SENZA", sedeContratto: null },
  { id: 18, nome: "MARZANO", grad: 45, cat: "SENZA", sedeContratto: null },
  { id: 19, nome: "MUNARETTO", grad: 54, cat: "SENZA", sedeContratto: null },
  { id: 20, nome: "CESCO", grad: 59, cat: "SENZA", sedeContratto: null },
  { id: 21, nome: "PARRONI", grad: 71, cat: "SENZA", sedeContratto: null },
  { id: 22, nome: "MORANO", grad: 72, cat: "SENZA", sedeContratto: null },
  { id: 23, nome: "DE CANDIDO", grad: 83, cat: "SENZA", sedeContratto: null },
  { id: 24, nome: "SIEGA-VIGNUT", grad: 87, cat: "SENZA", sedeContratto: null },
  { id: 25, nome: "MERLINO", grad: 105, cat: "SENZA", sedeContratto: null },
  { id: 26, nome: "MARCUZZO", grad: 109, cat: "SENZA", sedeContratto: null },
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
  INDET: { label: "Indet.", prio: 1, ore: 96, color: "#1a5c4a", bg: "#e3f2ec" },
  DET36: { label: "Det. 36h", prio: 2, ore: 156, color: "#8a5a00", bg: "#fdf3dd" },
  DET24: { label: "Det. 24h", prio: 3, ore: 104, color: "#a06b00", bg: "#fef7e8" },
  SENZA: { label: "Senza inc.", prio: 4, ore: null, color: "#5b5b6b", bg: "#eeeef2" },
};
const isDeterminato = (mid) => byId[mid].cat === "DET36" || byId[mid].cat === "DET24";

const SEDI5 = ["Maniago", "Spilimbergo", "Meduno", "Claut", "Anduins"];
const SEDI_BREVI = { Maniago: "MA", Spilimbergo: "SP", Meduno: "ME", Claut: "CL", Anduins: "AN" };
const CDC = ["Maniago", "Spilimbergo"]; // le 2 sedi fisiche sempre prioritarie

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
// dispo[mid][slotKey] = { verde:[sedi], verdeLiv:{sede:1..5}, blu:[sedi], bluLiv:{sede:1..4}, no:bool, preferito:bool, preferitoRip:bool }
// - verde: sedi FISICHE desiderate, in ordine di preferenza (livelli 1..5, livelli PARI = sedi
//   indifferenti per il medico: il motore può spostarlo liberamente tra loro per massimizzare le
//   coperture; livello più basso = sede che ha diritto di tenere contro chi non lo supera in gerarchia)
// - blu: sedi che il medico è disposto a COPRIRE A DISTANZA, da qualunque sede fisica gli venga
//   assegnata, in ordine di preferenza (livelli 1..4). Nessuna copertura a distanza è automatica:
//   serve sempre una dichiarazione blu esplicita. Un medico copre al massimo 1 sede a distanza
//   (la prima disponibile nel suo ordine blu dichiarato).
// - no: indisponibilità dichiarata esplicitamente
// - preferito: vuole questo turno come assegnazione fisica (verde)
// - preferitoRip: soddisfatto anche se ottiene solo una copertura a distanza (blu) invece che fisica
// slots = 5 posizioni [Maniago, Spilimbergo, Meduno, Claut, Anduins]

// Normalizza il formato dati
const normDispo = (v) => {
  if (!v) return { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: false, preferito: false, preferitoRip: false };
  return {
    verde: v.verde || [], verdeLiv: v.verdeLiv || {},
    blu: v.blu || [], bluLiv: v.bluLiv || {},
    no: !!v.no, preferito: !!v.preferito, preferitoRip: !!v.preferitoRip,
  };
};

// Ordina un elenco di sedi per livello crescente (prima le più desiderate). Sedi con lo stesso
// livello sono equivalenti — il motore le prova nell'ordine dell'array originale.
const ordinaPerLivello = (sedi, liv, maxLivello) => {
  const out = [];
  for (let l = 1; l <= maxLivello; l++) {
    sedi.forEach((s) => { if ((liv[s] || 1) === l) out.push(s); });
  }
  return out;
};
const MAX_LIV_VERDE = 5, MAX_LIV_BLU = 4;

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti condiviso.
function elaboraTurno(d, turno, slotKey, dispo, debiti) {
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    return !v.no && (v.verde.length || v.blu.length);
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
    // Bucket di priorità (conDeb > senza incarico > debito esaurito), usato sia per il confronto
    // fisico che per quello a distanza.
    const bucketOf = (mid) => {
      const deb = debiti[mid];
      if (deb !== null && deb > 0) return 0;
      if (deb === null) return 1;
      return 2;
    };
    const isTitolareDi = (mid, sede) => isDeterminato(mid) && byId[mid].sedeContratto === sede;
    // Confronto di priorità "vero", parametrizzato sulla sede contesa. Vale identico sia per
    // l'assegnazione fisica che per la copertura a distanza (CONTEXT.md §3.1a):
    //   titolarità sede (solo tra determinati) → categoria → debito → graduatoria.
    const isBetterPriority = (aId, bId, sede) => {
      const ba = bucketOf(aId), bb = bucketOf(bId);
      if (ba !== bb) return ba < bb;
      if (ba !== 0) return byId[aId].grad < byId[bId].grad;
      const A = byId[aId], B = byId[bId];
      if (isDeterminato(aId) && isDeterminato(bId)) {
        const titA = isTitolareDi(aId, sede), titB = isTitolareDi(bId, sede);
        if (titA !== titB) return titA;
      }
      const pa = CAT_INFO[A.cat].prio, pb = CAT_INFO[B.cat].prio;
      if (pa !== pb) return pa < pb;
      if (debiti[aId] !== debiti[bId]) return debiti[aId] > debiti[bId];
      return A.grad < B.grad;
    };

    // ---- FASE 1: assegnazione fisica (verde) ----
    // Target fisico: quante e quali sedi puntare in base al numero di medici presenti (max 4).
    // Con 1 solo medico il target è dinamico: qualunque sede sia la sua preferenza verde migliore
    // (non più forzato su Maniago). Con 2/3/4 medici, Maniago e Spilimbergo restano sempre le
    // prime sedi puntate, poi Meduno, poi Claut — coerentemente con "MA e SP sempre prioritarie".
    const nFisici = Math.min(ordinati.length, 4);
    let target = [];
    if (nFisici === 1) {
      const v = normDispo(dispo[ordinati[0].id]?.[slotKey]);
      if (v.verde.length) {
        const top = ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE)[0];
        target = [SEDI5.indexOf(top)];
      }
    } else if (nFisici === 2) target = [0, 1];
    else if (nFisici === 3) target = [0, 1, 2];
    else if (nFisici >= 4) target = [0, 1, 2, 3];

    const accVerdeDi = (mid) => {
      const v = normDispo(dispo[mid]?.[slotKey]);
      return ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE);
    };
    const livelloVerdeDi = (mid, sede) => {
      const v = normDispo(dispo[mid]?.[slotKey]);
      return v.verde.includes(sede) ? (v.verdeLiv[sede] || 1) : Infinity;
    };
    const sedeDi = {};
    // provaFisica(): il medico m cerca una sede fisica tra le sue preferenze verdi, nell'ordine
    // dei SUOI livelli, senza mai accettare una sede di livello peggiore di maxLiv. Ricollocazione
    // dell'occupante: a pari/miglior livello sempre consentita (indifferenza dichiarata, non gli
    // costa nulla); a livello peggiore solo se il richiedente ha VERA priorità superiore su quella
    // sede (titolarità → categoria → debito → graduatoria tra determinati).
    const provaFisica = (m, visitate, maxLiv) => {
      const acc = accVerdeDi(m.id);
      for (const sede of acc) {
        const si = target.find((i) => SEDI5[i] === sede);
        if (si === undefined || visitate.has(si)) continue;
        const liv = livelloVerdeDi(m.id, sede);
        if (liv > maxLiv) continue;
        visitate.add(si);
        const occ = slots[si];
        if (occ === null) { slots[si] = m.id; sedeDi[m.id] = si; return true; }
        if (occ === m.id) continue;
        const occLiv = livelloVerdeDi(occ, sede);
        const occMax = isBetterPriority(m.id, occ, sede) ? Infinity : occLiv;
        delete sedeDi[occ];
        if (provaFisica(byId[occ], visitate, occMax)) { slots[si] = m.id; sedeDi[m.id] = si; return true; }
        sedeDi[occ] = si; // ricollocazione fallita: l'occupante resta dov'era
        if (isBetterPriority(m.id, occ, sede)) {
          delete sedeDi[occ];
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
      }
      return false;
    };
    for (const m of ordinati) {
      if (Object.keys(sedeDi).length >= target.length) break;
      provaFisica(m, new Set(), Infinity);
    }
    // Rebuild slots da sedeDi (fonte di verità), per eliminare "fantasmi" da ricollocazioni intermedie.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      if (debiti[mid] !== null) debiti[mid] -= turno.ore;
    });
    fisiche = Object.values(sedeDi);

    // ---- FASE 2: copertura a distanza (blu) ----
    // Nessuna copertura è automatica: solo i FISICI di questo turno possono coprire a distanza,
    // e solo le sedi per cui hanno dichiarato blu. Ogni medico copre al massimo 1 sede a distanza
    // (la prima disponibile nel suo ordine blu). In caso di conflitto sulla stessa sede, vince
    // isBetterPriority — stessa identica gerarchia usata per il fisico: titolarità sede → categoria
    // → debito → graduatoria (CONTEXT.md §3.1a).
    const sitiCoperti = new Set(Object.values(sedeDi));
    const accBluDi = (mid) => {
      const v = normDispo(dispo[mid]?.[slotKey]);
      return ordinaPerLivello(v.blu, v.bluLiv, MAX_LIV_BLU);
    };
    const sedeBluDi = {};
    const provaBlu = (mid, visitate) => {
      const acc = accBluDi(mid);
      for (const sede of acc) {
        const si = SEDI5.indexOf(sede);
        if (sitiCoperti.has(si) || visitate.has(si)) continue;
        visitate.add(si);
        const occ = sedeBluDi[si];
        if (occ === undefined) { sedeBluDi[si] = mid; return true; }
        if (occ === mid) continue;
        if (isBetterPriority(mid, occ, sede)) {
          delete sedeBluDi[si];
          if (provaBlu(occ, visitate)) { sedeBluDi[si] = mid; return true; }
          sedeBluDi[si] = mid;
          return true;
        }
      }
      return false;
    };
    ordinati.filter((m) => sedeDi[m.id] !== undefined).forEach((m) => provaBlu(m.id, new Set()));
    Object.entries(sedeBluDi).forEach(([siStr, mid]) => { slots[Number(siStr)] = mid; });

    // AVVISO: qualunque sede (fisica o a distanza) resti scoperta per mancanza di dichiarazione.
    const scoperte = [0, 1, 2, 3, 4].filter((si) => slots[si] === null);
    if (scoperte.length && ordinati.length) {
      avviso = `Giorno ${d} · ${turno.label}: con ${ordinati.length} medici presenti, restano SCOPERTE (nessuna disponibilità verde o blu dichiarata): ${scoperte.map((si) => SEDI5[si]).join(", ")}.`;
    }
  }

  return { turnoOut: { id: turno.id, label: turno.label, ore: turno.ore, extra: !!turno.extra, slots, fis: fisiche }, avviso };
}

// Un turno ha "preferiti" se almeno un medico lo ha segnato come preferito (in entrambi i casi
// il turno viene elaborato per primo, per preservare il debito verso il giorno desiderato).
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
  // desiderava. Nel sistema verde/blu la copertura a distanza richiede SEMPRE una presenza
  // fisica altrove nello stesso turno (INV3): un medico che non ottiene alcuna sede verde
  // non può quindi mai coprire nulla a distanza. Di conseguenza "preferito" e "preferitoRip"
  // sono entrambi soddisfatti se e solo se il medico ottiene una sede fisica (qualunque
  // livello verde, non necessariamente la sua prima scelta) — la distinzione tra i due resta
  // solo nel testo dell'avviso quando il medico finisce escluso dal turno.
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
      const assegnatoFisico = sedeOttenuta !== null;
      if (out.extra) {
        if (!assegnatoFisico) avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva questo turno come preferito, ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
        return;
      }
      if (assegnatoFisico) return;
      if (v.preferitoRip) {
        avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} voleva questo turno a tutti i costi, ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
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


export { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, MESI_DISPONIBILI, MESI_IT };

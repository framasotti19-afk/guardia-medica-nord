
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

// prio: livello di priorità di categoria. DET24 e DET12ASAP condividono LO STESSO prio (3) —
// non sono in relazione di priorità tra loro: i conflitti tra i due si risolvono direttamente
// con debito → graduatoria, esattamente come tra due medici della stessa categoria (CONTEXT.md §3.1).
const CAT_INFO = {
  INDET:    { label: "Indet.",        prio: 1, ore: 96,  color: "#1a5c4a", bg: "#e3f2ec" },
  DET36:    { label: "Det. 36h",      prio: 2, ore: 156, color: "#8a5a00", bg: "#fdf3dd" },
  DET24:    { label: "Det. 24h",      prio: 3, ore: 104, color: "#a06b00", bg: "#fef7e8" },
  DET12ASAP:{ label: "Det. 12h ASAP", prio: 3, ore: 52,  color: "#6b4c9a", bg: "#efe8f7" },
  DET12:    { label: "Det. 12h",      prio: 4, ore: 52,  color: "#4a708a", bg: "#e8eff5" },
  SENZA:    { label: "Senza inc.",    prio: 5, ore: null, color: "#5b5b6b", bg: "#eeeef2" },
};
const isDeterminato = (mid) => ["DET36", "DET24", "DET12ASAP", "DET12"].includes(byId[mid].cat);

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
// dispo[mid][slotKey] = { verde:[sedi], verdeLiv:{sede:1..5}, blu:[sedi], bluLiv:{sede:1..4}, no:bool, preferito:sede|null }
// - verde: sedi FISICHE desiderate, in ordine di preferenza (livelli 1..5, livelli PARI = sedi
//   indifferenti per il medico: il motore può spostarlo liberamente tra loro per massimizzare le
//   coperture; livello più basso = sede che ha diritto di tenere contro chi non lo supera in gerarchia.
//   La parità di livello NON rende due sedi davvero equivalenti tra loro: il motore prova sempre
//   prima quella che viene prima nell'ordine fisso SEDI5, cioè Maniago → Spilimbergo → Meduno →
//   Claut → Anduins, indipendentemente dall'ordine in cui il medico le ha dichiarate — vedi
//   ordinaPerLivello e CONTEXT.md §3.3)
// - blu: sedi che il medico è disposto a COPRIRE A DISTANZA, da qualunque sede fisica gli venga
//   assegnata, in ordine di preferenza (livelli 1..4; stessa regola di tie-break per pari livello
//   dell'ordine fisso SEDI5, tramite lo stesso ordinaPerLivello). Nessuna copertura a distanza è
//   automatica: serve sempre una dichiarazione blu esplicita. Un medico copre al massimo 1 sede a
//   distanza (la prima disponibile nel suo ordine blu dichiarato).
// - no: indisponibilità dichiarata esplicitamente
// - preferito: la SEDE VERDE specifica su cui il medico vuole questo turno (una delle sedi in
//   `verde`, o null se non ha espresso una preferenza). Non decide MAI chi vince un conflitto né
//   quale sede riceve un vincitore (quello resta compito esclusivo dei livelli verdi/blu e della
//   gerarchia) — serve solo a generare un avviso per il coordinatore se il medico finisce assegnato
//   fisicamente altrove, o non assegnato affatto (CONTEXT.md §3.5).
// slots = 5 posizioni [Maniago, Spilimbergo, Meduno, Claut, Anduins]

// Normalizza il formato dati
const normDispo = (v) => {
  if (!v) return { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: false, preferito: null };
  return {
    verde: v.verde || [], verdeLiv: v.verdeLiv || {},
    blu: v.blu || [], bluLiv: v.bluLiv || {},
    no: !!v.no, preferito: v.preferito || null,
  };
};

// Ordina un elenco di sedi per livello crescente (prima le più desiderate). Sedi con lo stesso
// livello sono "indifferenti" per il medico (il motore può spostarlo liberamente tra loro), ma
// la parità non le rende mai davvero equivalenti tra loro: a parità di livello si prova sempre
// prima la sede che viene prima nell'ordine fisso SEDI5 (Maniago → Spilimbergo → Meduno → Claut
// → Anduins), non l'ordine in cui il medico le ha dichiarate. Così una CDC (Maniago/Spilimbergo)
// pari con una sede secondaria vince comunque la CDC, esattamente come se fosse un livello
// migliore — l'ordine di dichiarazione non ha alcun peso (CONTEXT.md §3.3).
const ordinaPerLivello = (sedi, liv, maxLivello) => {
  const out = [];
  for (let l = 1; l <= maxLivello; l++) {
    SEDI5.forEach((s) => { if (sedi.includes(s) && (liv[s] || 1) === l) out.push(s); });
  }
  return out;
};
const MAX_LIV_VERDE = 5, MAX_LIV_BLU = 4;

// Differenza in giorni interi tra due date "YYYY-MM-DD" (b - a). Usata per la regola di
// spaziatura temporale (CONTEXT.md §3.7): confronta SEMPRE date di calendario, mai l'ordine
// di elaborazione interno (che può processare i turni "preferiti" fuori ordine cronologico).
const giorniTra = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

// Lunedì (ISO, lun-dom) della settimana che contiene la data "YYYY-MM-DD", come chiave stringa —
// usata per il tetto settimanale dichiarabile dal medico (CONTEXT.md §3.8).
const settimanaDi = (dataStr) => {
  const dt = new Date(dataStr + "T00:00:00");
  const dow = (dt.getDay() + 6) % 7; // 0=lunedì .. 6=domenica
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
// Tetto settimanale dichiarato dal medico per la settimana `wk` (chiave = lunedì), o null se
// non dichiarato (nessun limite). Dichiarato come dispo[mid]["SETT:" + wk] = { maxTurni: N },
// una chiave orthogonale ai normali slotKey "YYYY-MM-DD|ID" (mai un turno vero e proprio).
const capSettimanale = (dispo, mid, wk) => {
  const raw = dispo[mid]?.["SETT:" + wk];
  const n = raw && raw.maxTurni;
  return typeof n === "number" && n >= 0 ? n : null;
};

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti,
// settimanaCount (turni già assegnati per medico/settimana) e ultimoFisico (data dell'ultimo
// turno fisico per medico) condivisi tra tutte le chiamate dello stesso elaboraSchema.
function elaboraTurno(d, turno, slotKey, dispo, debiti, settimanaCount, ultimoFisico) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    if (v.no || !(v.verde.length || v.blu.length)) return false;
    const cap = capSettimanale(dispo, m.id, wk);
    if (cap !== null && (settimanaCount[m.id]?.[wk] || 0) >= cap) return false; // tetto settimanale raggiunto
    return true;
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
    if (sel) {
      if (debiti[sel.id] !== null) debiti[sel.id] -= turno.ore;
      settimanaCount[sel.id] = settimanaCount[sel.id] || {};
      settimanaCount[sel.id][wk] = (settimanaCount[sel.id][wk] || 0) + 1;
      ultimoFisico[sel.id] = dataStr;
    }
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

    // ---- Regola di spaziatura temporale (CONTEXT.md §3.7) ----
    // Tra i turni disponibili di un medico, il motore preferisce sempre quello più distante
    // dall'ultimo turno fisico già assegnato: se un vincitore ha lavorato ieri (o oggi stesso, su
    // un altro turno dello stesso giorno) ED esiste un altro candidato che ha dichiarato verde la
    // STESSA sede e non ha ancora ottenuto nulla, la sede passa a quest'ultimo. Non cambia MAI chi
    // vince un conflitto (tra gli eventuali alternativi decide sempre l'ordine di ordinati, cioè
    // la stessa gerarchia di sempre) e non lascia MAI una sede scoperta per questo: se non esiste
    // alcuna alternativa valida, il medico più recente resta dov'è (la copertura vince sempre).
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      const si = sedeDi[mid];
      if (si === undefined) return; // già spostato da uno scambio precedente in questo stesso giro
      const ultimo = ultimoFisico[mid];
      // Valore assoluto: a causa del riordino conPref/resto, "ultimo" può riferirsi a una data
      // cronologicamente SUCCESSIVA a dataStr (processata prima perché aveva un preferito) — la
      // distanza reale di calendario non ha segno.
      if (ultimo === undefined || Math.abs(giorniTra(ultimo, dataStr)) > 1) return; // spaziatura già sufficiente
      const sede = SEDI5[si];
      const alternativa = ordinati.find((o) => o.id !== mid && sedeDi[o.id] === undefined && normDispo(dispo[o.id]?.[slotKey]).verde.includes(sede));
      if (alternativa) { delete sedeDi[mid]; sedeDi[alternativa.id] = si; }
    });

    // Rebuild slots da sedeDi (fonte di verità), per eliminare "fantasmi" da ricollocazioni intermedie.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      if (debiti[mid] !== null) debiti[mid] -= turno.ore;
      settimanaCount[mid] = settimanaCount[mid] || {};
      settimanaCount[mid][wk] = (settimanaCount[mid][wk] || 0) + 1;
      ultimoFisico[mid] = dataStr;
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

// Un turno ha "preferiti" se almeno un medico ha marcato con ★ una sua sede verde per questo
// turno (il turno viene elaborato per primo, per preservare il debito verso il giorno desiderato).
function slotHaPreferiti(dispo, slotKey) {
  const v0 = (m) => normDispo(dispo[m.id]?.[slotKey]);
  return MEDICI.some((m) => { const v = v0(m); return !v.no && v.preferito; });
}

function elaboraSchema(dispo, extraOre, anno, mese, extras) {
  const debiti = {};
  MEDICI.forEach((m) => {
    const base = CAT_INFO[m.cat].ore;
    debiti[m.id] = base === null ? null : base + (extraOre[m.id] || 0);
  });
  const settimanaCount = {}; // mid -> { weekKey: numero di turni già assegnati quella settimana }
  const ultimoFisico = {};   // mid -> data "YYYY-MM-DD" dell'ultimo turno fisico assegnato
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
    const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispo, debiti, settimanaCount, ultimoFisico);
    risultati[`${d}|${turno.id}`] = turnoOut;
    if (avviso) avvisiRaw.push({ d, testo: avviso });
  });

  // VALUTAZIONE PREFERITI: dopo l'elaborazione confronta l'esito con la SEDE specifica che il
  // medico ha marcato con ★ (CONTEXT.md §3.5). Soddisfatto se e solo se ottiene fisicamente
  // esattamente quella sede; se ottiene una sede fisica diversa, o nessuna sede, genera un
  // avviso — con testo diverso nei due casi. In nessun caso il preferito decide chi vince o
  // quale sede viene assegnata: qui si osserva soltanto il risultato già deciso dalla gerarchia.
  const meseStr = `${anno}-${String(mese + 1).padStart(2, "0")}-`;
  MEDICI.forEach((m) => {
    const perMedico = dispo[m.id] || {};
    Object.entries(perMedico).forEach(([sk, raw]) => {
      if (!sk.startsWith(meseStr)) return;
      const v = normDispo(raw);
      if (v.no || !v.preferito) return;
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
      if (out.extra) {
        if (sedeOttenuta === null) avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva questo turno come preferito, ma non gli è stato assegnato (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
        return;
      }
      if (sedeOttenuta === v.preferito) return; // preferito soddisfatto: sede esatta ottenuta
      if (sedeOttenuta === null) {
        avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva ${v.preferito} come sede preferita, ma non gli è stata assegnata alcuna sede (priorità superiori di altri). Valutare un intervento manuale se opportuno.` });
      } else {
        avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: ★ ${m.nome} aveva ${v.preferito} come sede preferita, ma ha ottenuto ${sedeOttenuta} (priorità superiori di altri sulla sede preferita). Valutare un intervento manuale se opportuno.` });
      }
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


export { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, MESI_DISPONIBILI, MESI_IT, giorniTra, settimanaDi, capSettimanale };

const { useState, useMemo, useRef, useEffect } = React;

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
const dk = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const mk = (y, m) => `${y}-${m}`;

// Pasqua (algoritmo di Gauss, calendario gregoriano) — valido per qualsiasi anno.
// Restituisce { mese, giorno } con mese 0-indicizzato (2=marzo, 3=aprile), coerente col resto del file.
function pasquaDi(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const meseUno = Math.floor((h + l - 7 * m + 114) / 31); // 1-indicizzato: 3=marzo, 4=aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese: meseUno - 1, giorno };
}
// Festivi nazionali italiani fissi + Pasqua/Pasquetta (calcolata) per un singolo anno.
function festiviFissiDi(anno) {
  const map = {};
  const add = (m, d, label) => { map[dk(anno, m, d)] = label; };
  add(0, 1, "CAPODANNO"); add(0, 6, "EPIFANIA");
  const pasqua = pasquaDi(anno);
  map[dk(anno, pasqua.mese, pasqua.giorno)] = "PASQUA";
  const pasquetta = new Date(anno, pasqua.mese, pasqua.giorno + 1);
  map[dk(pasquetta.getFullYear(), pasquetta.getMonth(), pasquetta.getDate())] = "PASQUETTA";
  add(3, 25, "25 APRILE"); add(4, 1, "1 MAGGIO"); add(5, 2, "2 GIUGNO");
  add(7, 15, "FERRAGOSTO"); add(10, 1, "OGNISSANTI"); add(11, 8, "IMMACOLATA");
  add(11, 25, "NATALE"); add(11, 26, "S.STEFANO");
  add(11, 31, "31 DICEMBRE"); // festivo a sé per ASFO (non un festivo nazionale italiano): il suo
  // prefestivo è il 30 dicembre, non va confuso con l'essere semplicemente il giorno prima di Capodanno.
  return map;
}
const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const GIORNI_IT = ["DOMENICA","LUNEDI'","MARTEDI'","MERCOLEDI'","GIOVEDI'","VENERDI'","SABATO"];
const GIORNI_BREVI = ["DO","LU","MA","ME","GI","VE","SA"];

const MESI_DISPONIBILI = [];
{ let y = 2026, m = 7;
  while (y < 2036 || (y === 2036 && m <= 11)) {
    MESI_DISPONIBILI.push({ anno: y, mese: m });
    m++; if (m > 11) { m = 0; y++; }
  }
}
// FESTIVI_MAP/PREFESTIVI generati per l'intero intervallo coperto da MESI_DISPONIBILI (2026-2036),
// più un anno extra (2037) solo per calcolare correttamente il prefestivo del 31 dicembre 2036
// (giorno precedente al Capodanno 2037). Nessun limite di anni: festiviFissiDi funziona per
// qualsiasi anno tramite l'algoritmo di Gauss per Pasqua.
const FESTIVI_MAP = {};
for (let anno = 2026; anno <= 2037; anno++) Object.assign(FESTIVI_MAP, festiviFissiDi(anno));
const PREFESTIVI = new Set(Object.keys(FESTIVI_MAP).map((key) => {
  const [y, m, d] = key.split("-").map(Number);
  const prec = new Date(y, m - 1, d - 1); // giorno precedente a ogni festivo
  return dk(prec.getFullYear(), prec.getMonth(), prec.getDate());
}));

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

// Tetto MENSILE dichiarato dal coordinatore per un medico (CONTEXT.md §3.11), indipendente dal
// debito residuo e valido per QUALSIASI categoria: `dati.maxTurniMese[mid] = N`, o null/assente =
// nessun limite. A differenza del tetto settimanale non è nella dispo (un solo valore per l'intero
// mese, non per-settimana) — stesso pattern di `extraOre`/`turniExtra`.
const capMensileDi = (maxTurniMese, mid) => {
  const n = maxTurniMese[mid];
  return typeof n === "number" && n >= 0 ? n : null;
};

// Distribuzione temporale reale (CONTEXT.md §3.11): per un contrattualizzato NON titolare con
// debito ordinario positivo all'inizio del mese, precalcola un sottoinsieme di slot dove ha
// dichiarato verde, il più possibile distanziati nel mese, dimensionato sul numero di turni
// stimati dal suo debito (o dal tetto mensile dichiarato, se più restrittivo). SOLO su questi
// slot competerà con piena priorità di categoria; sui restanti giorni disponibili ma non
// riservati scende al bucket "senza incarico" (pura graduatoria) per QUEL giorno specifico — mai
// un blocco rigido: resta sempre disponibile come riserva se nessun altro copre quel turno, non
// lascia mai un buco. Ritorna null (nessuna restrizione, comportamento pre-esistente invariato)
// per i titolari di sede (la titolarità non va mai intaccata da questo meccanismo), per i senza
// incarico (debito nullo) e per chi è già esaurito dall'inizio del mese.
function calcolaRiservati(mid, dispo, anno, mese, extras, budgetOre, capMensileTurni) {
  if (isDeterminato(mid) && byId[mid].sedeContratto !== null) return null;
  if (budgetOre === null || budgetOre <= 0) return null;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  const slots = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    info.turni.forEach((turno) => {
      const slotKey = `${info.key}|${turno.id}`;
      const v = normDispo(dispo[mid]?.[slotKey]);
      if (!v.no && v.verde.length) slots.push({ slotKey, ore: turno.ore });
    });
  }
  if (!slots.length) return new Set();
  const k = slots.length;
  const oreMedie = slots.reduce((s, x) => s + x.ore, 0) / k || 12;
  let nTarget = Math.max(1, Math.min(k, Math.ceil(budgetOre / oreMedie)));
  if (capMensileTurni !== null) nTarget = Math.min(nTarget, capMensileTurni);
  if (nTarget <= 0) return new Set();
  // Selezione a spaziatura massima: nTarget indici il più possibile equidistanti nell'elenco
  // (cronologico) degli slot disponibili — non necessariamente equidistanti in giorni di
  // calendario (dipende da dove il medico ha effettivamente dichiarato disponibilità), ma la
  // scelta migliore possibile dato l'elenco reale.
  const scegliIndici = (n) => {
    if (n >= k) return slots.map((_, i) => i);
    if (n <= 1) return [0];
    const idx = new Set();
    for (let i = 0; i < n; i++) idx.add(Math.round((i * (k - 1)) / (n - 1)));
    return [...idx].sort((a, b) => a - b);
  };
  return new Set(scegliIndici(nTarget).map((i) => slots[i].slotKey));
}

// Preferenza di TURNO (diurno/notturno) per un giorno che ha entrambi (weekend/festivo/
// prefestivo): decide SOLO quale dei due il medico mantiene se li vince entrambi lo stesso
// giorno, non cambia mai CHI vince un conflitto né anticipa l'elaborazione (CONTEXT.md §3.9).
// Dichiarata come dispo[mid]["TURNOPREF:" + dataStr] = "G" | "N", una chiave ortogonale ai
// normali slotKey "YYYY-MM-DD|ID" (mai un turno vero e proprio, come "SETT:").
const turnoPrefDi = (dispo, mid, dataStr) => dispo[mid]?.["TURNOPREF:" + dataStr] || null;

// Calcola l'elenco dei medici candidati per uno slot, già ordinato secondo la gerarchia
// ufficiale (categoria/prio → debito residuo → graduatoria, con senza incarico in coda).
// Isolata così la regola di preferenza turno (stesso giorno G/N) può cercare un
// alternativo con lo stesso identico criterio usato da elaboraTurno.
function candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey, maxTurniMese, meseCount, riservatiPerMedico) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    if (v.no || !(v.verde.length || v.blu.length)) return false;
    const cap = capSettimanale(dispo, m.id, wk);
    if (cap !== null && (settimanaCount[m.id]?.[wk] || 0) >= cap) return false; // tetto settimanale raggiunto
    // Tetto MENSILE (CONTEXT.md §3.11): indipendente dal debito residuo, vale per ogni categoria.
    const capMese = capMensileDi(maxTurniMese, m.id);
    if (capMese !== null && (meseCount[m.id] || 0) >= capMese) return false;
    // Blocco rigido oltre il monte ore (CONTEXT.md §3.4): un contrattualizzato che ha esaurito sia
    // il debito ordinario (monte ore + recupero) sia gli eventuali turni extra volontari non è più
    // un candidato per NESSUN turno, nemmeno se resterebbe l'unico disponibile — il turno resta
    // SCOPERTO piuttosto che essere coperto oltre il limite dichiarato.
    if (debiti[m.id] !== null && debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) <= 0) return false;
    return true;
  });
  // Bucket 0 (piena priorità di categoria) richiede ANCHE che lo slot sia tra i "riservati" del
  // medico, se ne ha (distribuzione temporale, CONTEXT.md §3.11) — riservatiPerMedico[mid] è null
  // per i titolari/senza incarico/già esauriti (nessuna restrizione, comportamento invariato). Un
  // contrattualizzato con debito ma FUORI dai propri giorni riservati va in un bucket 2 dedicato,
  // PIÙ DEBOLE della senza-incarico vera (bucket 1): altrimenti, se il suo grad è già il migliore
  // in assoluto (es. un INDET grad0), vincerebbe comunque anche "retrocesso" a parità di bucket
  // con un senza incarico — vanificando la distribuzione. Nel bucket 2 compete solo con altri
  // contrattualizzati ugualmente fuori dai propri riservati, sempre e solo per grad, e resta
  // comunque disponibile come ultima risorsa se nessun altro (nemmeno un senza incarico) copre
  // quel turno — non lascia mai un buco.
  const bucketDi = (m) => {
    if (debiti[m.id] === null || (debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) > 0)) return 1;
    const riservati = riservatiPerMedico[m.id];
    return (!riservati || riservati.has(slotKey)) ? 0 : 2;
  };
  const conDeb = candidati.filter((m) => bucketDi(m) === 0)
    .sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || debiti[b.id] - debiti[a.id] || a.grad - b.grad);
  // "senza" = veri senza incarico + contrattualizzati che hanno esaurito monte ore+recupero ma
  // hanno ancora turni extra volontari dichiarati: competono insieme, alla pari, solo per
  // graduatoria. (I contrattualizzati completamente esauriti, senza turni extra residui, sono già
  // esclusi sopra.)
  const senza = candidati.filter((m) => bucketDi(m) === 1).sort((a, b) => a.grad - b.grad);
  // "demossi" = contrattualizzati con debito residuo ma fuori dai propri giorni riservati oggi:
  // ultima risorsa, mai al pari di un vero senza incarico (vedi sopra).
  const demossi = candidati.filter((m) => bucketDi(m) === 2).sort((a, b) => a.grad - b.grad);
  return [...conDeb, ...senza, ...demossi]; // già in ordine di gerarchia ufficiale
}

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti,
// settimanaCount (turni già assegnati per medico/settimana) e ultimoFisico (data dell'ultimo
// turno fisico per medico) condivisi tra tutte le chiamate dello stesso elaboraSchema.
function elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount, ultimoFisico, maxTurniMese, meseCount, riservatiPerMedico) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const ordinati = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey, maxTurniMese, meseCount, riservatiPerMedico); // già in ordine di gerarchia ufficiale
  // Scala il debito del vincitore per un turno fisico: finché ha monte ore+recupero residuo lo
  // scala normalmente; una volta esaurito, scala i turni extra volontari dichiarati (stessa
  // priorità di un senza incarico — vedi bucketOf/candidatiOrdinati). Nessun effetto sui senza
  // incarico veri (debiti[mid] === null, ignorati).
  const scalaDebito = (mid, ore) => {
    if (debiti[mid] === null) return;
    if (debiti[mid] > 0) debiti[mid] -= ore;
    else debitiExtra[mid] = (debitiExtra[mid] || 0) - ore;
  };

  let slots = [null, null, null, null, null];
  let fisiche = [];
  let avviso = null;

  if (turno.extra) {
    const sel = ordinati[0] || null;
    slots = [sel ? sel.id : null];
    fisiche = [0];
    if (sel) {
      scalaDebito(sel.id, turno.ore);
      settimanaCount[sel.id] = settimanaCount[sel.id] || {};
      settimanaCount[sel.id][wk] = (settimanaCount[sel.id][wk] || 0) + 1;
      meseCount[sel.id] = (meseCount[sel.id] || 0) + 1;
      ultimoFisico[sel.id] = dataStr;
    }
  } else {
    // Bucket di priorità a TRE livelli (0=conDeb, 1=senza incarico/turni extra, 2=contrattualizzato
    // demosso perché fuori dai propri giorni riservati oggi), usato sia per il confronto fisico che
    // per quello a distanza. I contrattualizzati completamente esauriti (senza turni extra residui)
    // non arrivano mai qui: sono già esclusi da "ordinati" in candidatiOrdinati (blocco rigido oltre
    // il monte ore, CONTEXT.md §3.4). "riservatiPerMedico" implementa la distribuzione temporale
    // (§3.11): null per titolari/senza incarico (nessuna restrizione). Il bucket 2 è
    // DELIBERATAMENTE più debole del bucket 1 (non alla pari): altrimenti un contrattualizzato col
    // grad migliore in assoluto vincerebbe comunque anche demosso, vanificando la distribuzione.
    const bucketOf = (mid) => {
      if (debiti[mid] === null || (debiti[mid] <= 0 && (debitiExtra[mid] || 0) > 0)) return 1;
      const riservati = riservatiPerMedico[mid];
      return (!riservati || riservati.has(slotKey)) ? 0 : 2;
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
        const richiedenteMeglio = isBetterPriority(m.id, occ, sede);
        // La ricollocazione "a costo zero" dell'occupante (pari/miglior livello, indifferenza
        // dichiarata) presuppone che spostarlo non tolga nulla a nessuno — ma se l'occupante è
        // TITOLARE proprio di questa sede e il richiedente non ha una priorità realmente
        // superiore, spostarlo comunque (anche se lui stesso è indifferente tra le sue sedi
        // dichiarate) equivarrebbe a cedere la sua sede di titolarità a chi non ne ha diritto:
        // la titolarità garantisce quella sede SPECIFICA, non solo "una sede accettabile
        // qualunque". In questo caso saltiamo il tentativo di ricollocazione e passiamo
        // direttamente alla prossima preferenza del richiedente (l'occupante titolare resta).
        if (!richiedenteMeglio && isTitolareDi(occ, sede)) continue;
        const occLiv = livelloVerdeDi(occ, sede);
        const occMax = richiedenteMeglio ? Infinity : occLiv;
        delete sedeDi[occ];
        if (provaFisica(byId[occ], visitate, occMax)) { slots[si] = m.id; sedeDi[m.id] = si; return true; }
        sedeDi[occ] = si; // ricollocazione fallita: l'occupante resta dov'era
        if (richiedenteMeglio) {
          delete sedeDi[occ];
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
      }
      return false;
    };
    // NOTA: non ci si può fermare non appena tutti i target sono occupati — "ordinati" è ordinato
    // per categoria/debito/graduatoria, MAI per titolarità (CONTEXT.md §3.1a): un titolare può
    // comparire più avanti nell'elenco di un non titolare di categoria migliore che ha già occupato
    // la sua sede. Se ci fermassimo qui, quel titolare non avrebbe mai la possibilità di contestare
    // la propria sede. provaFisica è comunque sicuro da richiamare per OGNI candidato: se non ha
    // una pretesa reale (isBetterPriority falso su tutte le sue sedi dichiarate) non cambia nulla.
    for (const m of ordinati) {
      provaFisica(m, new Set(), Infinity);
    }

    // ---- Correzione titolarità post-FASE1 (CONTEXT.md §3.1a, §10) ----
    // Limite noto: con 3+ determinati che si contendono sedi sovrapposte nello stesso turno,
    // catene di ricollocazione ricorsiva profonde in provaFisica possono raramente convergere
    // lasciando un titolare fuori dalla propria sede pur avendone diritto, senza che nessun
    // singolo passaggio della catena sia isolatamente scorretto. Una ripetizione generica
    // dell'intero ciclo FASE1 introduceva regressioni reali altrove (perdita di copertura, la
    // ricollocazione per indifferenza non è idempotente su stati già stabili) — vedi §10. Questa
    // funzione è invece MIRATA solo ai titolari (mai a candidati generici), tocca solo LA LORO
    // sede specifica, e sposta l'eventuale occupante scorretto tramite lo stesso provaFisica già
    // usato ovunque (sicuro e già testato): se l'occupante non ha davvero priorità superiore su
    // quella sede (isBetterPriority), il titolare la riprende e l'occupante ritenta altrove.
    // Richiamata sia subito dopo FASE1 sia dopo la spaziatura temporale (§3.7): la spaziatura può
    // essa stessa introdurre un nuovo occupante scorretto su una sede di titolarità (spostando via
    // un occupante NON titolare che l'aveva legittimamente vinta per categoria, es. un INDET, e
    // rimpiazzandolo con un candidato che non ha alcun diritto su quella sede) — un solo passaggio
    // non basterebbe a correggere anche questo caso.
    const correggiTitolarita = () => {
      for (const m of ordinati) {
        const S = byId[m.id].sedeContratto;
        if (!isTitolareDi(m.id, S)) continue;
        const si = target.find((i) => SEDI5[i] === S);
        if (si === undefined) continue; // sede non tra i target odierni
        if (sedeDi[m.id] === si) continue; // già lì, niente da correggere
        if (accVerdeDi(m.id)[0] !== S) continue; // oggi non è la sua prima preferenza: non forziamo
        const occ = slots[si];
        if (occ === null || occ === m.id) continue;
        if (!isBetterPriority(m.id, occ, S)) continue; // l'occupante ha legittimamente la priorità (es. INDET)
        const vecchioSi = sedeDi[m.id];
        delete sedeDi[occ];
        delete sedeDi[m.id];
        slots[si] = m.id; sedeDi[m.id] = si;
        if (vecchioSi !== undefined) slots[vecchioSi] = null;
        provaFisica(byId[occ], new Set([si]), Infinity);
      }
    };
    correggiTitolarita();

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
      const distanza = ultimo === undefined ? null : Math.abs(giorniTra(ultimo, dataStr));
      if (distanza === null || distanza > 1) return; // spaziatura già sufficiente
      // Distanza 0 = stesso giorno: è esattamente il caso di un giorno con G e N (weekend/festivo/
      // prefestivo) in cui il medico ha dichiarato una preferenza di turno esplicita (§3.9). Se ha
      // dichiarato di voler mantenere PROPRIO questo turno, la spaziatura non lo tocca — la
      // preferenza esplicita prevale sull'euristica generica di rotazione (che altrimenti
      // scambierebbe sempre il turno elaborato per SECONDO, indipendentemente da quale dei due il
      // medico preferisca davvero — è esattamente il comportamento che la preferenza di turno
      // serve a correggere). La distanza 1 (giorno prima, turno diverso) resta invece sempre
      // gestita dalla spaziatura ordinaria, indipendentemente da qualunque preferenza di turno.
      if (distanza === 0 && turnoPrefDi(dispo, mid, dataStr) === turno.id) return;
      const sede = SEDI5[si];
      // Il candidato alternativo non può avere un bucket PEGGIORE di quello del vincitore attuale
      // (CONTEXT.md §3.11): altrimenti la spaziatura, pensata come tie-break tra pari livello di
      // priorità, diventerebbe una scappatoia per far vincere un contrattualizzato demosso (fuori
      // dai propri giorni riservati) semplicemente perché l'occupante ha lavorato ieri — vanificando
      // la distribuzione temporale. Tra candidati dello stesso bucket il comportamento resta quello
      // originale (il primo trovato nell'ordine di "ordinati"). Se il vincitore attuale è TITOLARE
      // proprio di questa sede, la rotazione "hai lavorato ieri" non può mai fargliela cedere a un
      // non titolare: la titolarità garantisce quella sede specifica indipendentemente dalla
      // spaziatura — può cederla solo a un altro titolare della STESSA sede (caso raro di doppia
      // titolarità), mai a chi non ha alcun diritto su quella sede in particolare.
      const midTitolareQui = isTitolareDi(mid, sede);
      const alternativa = ordinati.find((o) => o.id !== mid && sedeDi[o.id] === undefined && bucketOf(o.id) <= bucketOf(mid) && (!midTitolareQui || isTitolareDi(o.id, sede)) && normDispo(dispo[o.id]?.[slotKey]).verde.includes(sede));
      if (alternativa) { delete sedeDi[mid]; sedeDi[alternativa.id] = si; }
    });

    // Rebuild slots da sedeDi (fonte di verità), per eliminare "fantasmi" da ricollocazioni intermedie.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    // Seconda passata di correzione titolarità (vedi sopra): la spaziatura appena eseguita può
    // aver introdotto un nuovo occupante scorretto su una sede di titolarità. Rebuild finale di
    // slots dopo, per ripulire eventuali "fantasmi" lasciati dalle ricollocazioni di questa seconda
    // passata (stesso motivo del rebuild qui sopra).
    correggiTitolarita();
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      scalaDebito(mid, turno.ore);
      settimanaCount[mid] = settimanaCount[mid] || {};
      settimanaCount[mid][wk] = (settimanaCount[mid][wk] || 0) + 1;
      meseCount[mid] = (meseCount[mid] || 0) + 1;
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

function elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra = {}, maxTurniMese = {}) {
  const debiti = {};
  // Turni extra volontari (CONTEXT.md §3.10): budget SEPARATO dal debito ordinario, in ore
  // (turniExtra[mid] × 12). Si consuma SOLO dopo che monte ore+recupero è esaurito, e in quel
  // momento il medico compete con priorità "senza incarico" (solo graduatoria) — mai priorità di
  // categoria. Null per i senza incarico veri, coerentemente con "debiti".
  const debitiExtra = {};
  MEDICI.forEach((m) => {
    const base = CAT_INFO[m.cat].ore;
    debiti[m.id] = base === null ? null : base + (extraOre[m.id] || 0);
    debitiExtra[m.id] = base === null ? null : (turniExtra[m.id] || 0) * 12;
  });
  // Distribuzione temporale reale (CONTEXT.md §3.11): calcolata UNA VOLTA, prima di processare il
  // mese, sul debito ordinario e sull'eventuale tetto mensile INIZIALI (prima di qualunque
  // consumo) — è un meccanismo best-effort di preferenza, non una garanzia rigida: se un medico
  // vince comunque un giorno non riservato (perché nessun altro copre quel turno), il suo debito
  // reale si consuma comunque e i suoi giorni riservati successivi potrebbero non bastare più.
  const riservatiPerMedico = {};
  MEDICI.forEach((m) => {
    riservatiPerMedico[m.id] = calcolaRiservati(m.id, dispo, anno, mese, extras, debiti[m.id], capMensileDi(maxTurniMese, m.id));
  });
  const settimanaCount = {}; // mid -> { weekKey: numero di turni già assegnati quella settimana }
  const meseCount = {};      // mid -> numero di turni (fisici o extra) già assegnati nel mese (tetto mensile, §3.11)
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
    const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount, ultimoFisico, maxTurniMese, meseCount, riservatiPerMedico);
    risultati[`${d}|${turno.id}`] = turnoOut;
    if (avviso) avvisiRaw.push({ d, testo: avviso });
  });

  // PREFERENZA TURNO stesso giorno (G/N) (CONTEXT.md §3.9): se un medico vince FISICAMENTE sia
  // il diurno che il notturno dello stesso giorno (possibile solo weekend/festivi/prefestivi, gli
  // unici con entrambi i turni) e ha dichiarato una preferenza esplicita di turno per quel
  // giorno, il turno NON preferito viene liberato a favore di un alternativo che abbia
  // dichiarato quella sede come verde — sempre che un'alternativa esista: la copertura vince
  // sempre, esattamente come per la spaziatura temporale (§3.7). Non cambia mai CHI vince un
  // conflitto, solo quale dei due turni il vincitore mantiene. Eseguita dopo che tutti i turni
  // del mese sono stati elaborati, per conoscere l'esito di entrambi i turni dello stesso giorno
  // indipendentemente dall'ordine conPref/resto in cui sono stati processati.
  for (let d = 1; d <= nGiorni; d++) {
    const dataStr = dk(anno, mese, d);
    const outG = risultati[`${d}|G`];
    const outN = risultati[`${d}|N`];
    if (!outG || !outN) continue; // giorno feriale semplice: niente diurno, nessun doppio turno possibile
    const doppiFisici = outG.fis.map((si) => outG.slots[si]).filter((mid) => mid !== null && outN.fis.some((si2) => outN.slots[si2] === mid));
    doppiFisici.forEach((mid) => {
      const pref = turnoPrefDi(dispo, mid, dataStr);
      if (!pref) return;
      const target = pref === "G" ? outN : outG;
      const targetId = pref === "G" ? "N" : "G";
      const targetSlotKey = `${dataStr}|${targetId}`;
      const si = target.fis.find((i) => target.slots[i] === mid);
      if (si === undefined) return; // già liberato da un giro precedente in questo stesso ciclo
      const sede = SEDI5[si];
      const alternativa = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, targetSlotKey, maxTurniMese, meseCount, riservatiPerMedico)
        .find((o) => o.id !== mid && !target.slots.includes(o.id) && normDispo(dispo[o.id]?.[targetSlotKey]).verde.includes(sede));
      if (!alternativa) return; // nessuna alternativa: la copertura vince, resta assegnato a entrambi
      target.slots[si] = alternativa.id;
      // Storna/scala lo stesso pool (debito ordinario o extra) che il turno aveva effettivamente
      // consumato per ciascuno, in base al segno corrente — coerente con scalaDebito in elaboraTurno.
      if (debiti[mid] !== null) {
        if (debiti[mid] > 0) debiti[mid] += target.ore;
        else debitiExtra[mid] = (debitiExtra[mid] || 0) + target.ore;
      }
      if (debiti[alternativa.id] !== null) {
        if (debiti[alternativa.id] > 0) debiti[alternativa.id] -= target.ore;
        else debitiExtra[alternativa.id] = (debitiExtra[alternativa.id] || 0) - target.ore;
      }
      const wk = settimanaDi(dataStr);
      if (settimanaCount[mid]) settimanaCount[mid][wk] = Math.max(0, (settimanaCount[mid][wk] || 0) - 1);
      settimanaCount[alternativa.id] = settimanaCount[alternativa.id] || {};
      settimanaCount[alternativa.id][wk] = (settimanaCount[alternativa.id][wk] || 0) + 1;
      if (meseCount[mid]) meseCount[mid] = Math.max(0, meseCount[mid] - 1);
      meseCount[alternativa.id] = (meseCount[alternativa.id] || 0) + 1;
    });
  }

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

// ============ COMPONENTE ============

// Estrae il primo oggetto JSON valido e "riconoscibile" (con un campo "tipo") da un testo che
// potrebbe contenere un preambolo prima o dopo il JSON (es. un ragionamento scritto per errore
// dal modello, in violazione delle istruzioni "RISPONDI SOLO con JSON"). Più robusto di una
// semplice ricerca "prima { ultima }": conta la profondità delle graffe rispettando le stringhe
// tra virgolette (per non confondersi con graffe dentro un valore testuale) e prova ogni "{" nel
// testo come possibile inizio, così una graffa estranea nel preambolo (es. notazione matematica
// come "h = (...) mod 7") non fa fallire l'estrazione del JSON vero.
function estraiJsonBilanciato(testo) {
  for (let i = 0; i < testo.length; i++) {
    if (testo[i] !== "{") continue;
    let profondita = 0, dentroStringa = false, escape = false;
    for (let j = i; j < testo.length; j++) {
      const ch = testo[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { dentroStringa = !dentroStringa; continue; }
      if (dentroStringa) continue;
      if (ch === "{") profondita++;
      else if (ch === "}") {
        profondita--;
        if (profondita === 0) {
          try {
            const obj = JSON.parse(testo.slice(i, j + 1));
            if (obj && typeof obj === "object" && obj.tipo) return obj;
          } catch (e) { /* candidato non valido, prova il prossimo "{" */ }
          break;
        }
      }
    }
  }
  return null;
}

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
  const [azioniRestanti, setAzioniRestanti] = useState(false); // true se l'AI ha altre azioni per un round successivo
  const [troncato, setTroncato] = useState(false); // true se l'ultima risposta è stata tagliata per limite di token (JSON incompleto)
  const [completato, setCompletato] = useState(false); // true dopo aver applicato l'ultimo round quando non ce ne sono altri (banner "Completato ✓")
  const ultimaDomandaRef = useRef(""); // richiesta originale dell'utente, per poterla ripetere se una risposta viene troncata
  // Registro temporaneo (solo React state, MAI salvato su storage permanente) delle azioni già
  // confermate nella conversazione AI corrente, in formato compatto "MEDICO g{giorno}{turno}".
  // Inviato all'AI ad ogni round come ulteriore fonte di verità anti-loop (oltre a disponibilitaPresenti
  // e alla cronologia della chat) e azzerato con "Nuova conversazione".
  const [azioniEseguite, setAzioniEseguite] = useState([]);
  // Domande Sì/No dell'AI su ambiguità con una scelta binaria chiara (es. attivare o no un MMG
  // mancante): [{giorno, medico, situazione, domanda, seSi:[azioni], seNo:[azioni]}, ...].
  const [domande, setDomande] = useState([]);
  const [caricato, setCaricato] = useState(false);
  const [rapidoOpen, setRapidoOpen] = useState(false);
  const [rapMedico, setRapMedico] = useState(MEDICI[0].id);
  const [rapInizio, setRapInizio] = useState("");
  const [rapFine, setRapFine] = useState("");
  const [rapNotte, setRapNotte] = useState(true);
  const [rapGiorno, setRapGiorno] = useState(false);
  const [rapSedi, setRapSedi] = useState({}); // sede -> 'verde' | 'blu'
  const [rapIndisp, setRapIndisp] = useState([]); // [{inizio, fine}] periodi di indisponibilità
  const [rapMaxSettimana, setRapMaxSettimana] = useState(""); // "" = nessun tetto, altrimenti numero
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
  const vuotoMese = { dispo: {}, extras: {}, extraOre: {}, turniExtra: {}, maxTurniMese: {}, schema: null, avvisi: [] };
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


  // Imposta direttamente l'opzione scelta nel menu a tendina per una sede:
  // "" = non disponibile, "V1".."V5" = verde livello 1-5 (fisica), "B1".."B4" = blu livello 1-4 (a distanza).
  const setSedeOpzione = (mid, slotKey, sede, opzione) => {
    const cur = normDispo(dati.dispo[mid]?.[slotKey]);
    const next = {
      verde: cur.verde.filter((s) => s !== sede), verdeLiv: { ...cur.verdeLiv },
      blu: cur.blu.filter((s) => s !== sede), bluLiv: { ...cur.bluLiv },
      no: false, preferito: cur.no ? null : cur.preferito,
    };
    delete next.verdeLiv[sede];
    delete next.bluLiv[sede];
    if (opzione[0] === "V") {
      next.verde.push(sede);
      next.verdeLiv[sede] = Number(opzione.slice(1));
    } else if (opzione[0] === "B") {
      next.blu.push(sede);
      next.bluLiv[sede] = Number(opzione.slice(1));
    }
    // coerenza: il preferito deve sempre riferirsi a una sede attualmente verde
    if (!next.verde.includes(next.preferito)) next.preferito = null;
    const nd = { ...(dati.dispo[mid] || {}) };
    if (next.verde.length || next.blu.length) nd[slotKey] = next; else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const setNoCella = (mid, slotKey, valore) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    if (valore) nd[slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null };
    else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  // Imposta (o toglie, se già impostata) la sede VERDE preferita con ★: un medico ha al massimo
  // una sede preferita per turno, e deve essere una delle sedi che ha dichiarato verde (§3.5).
  const setPreferitoSede = (mid, slotKey, sede) => {
    const cur = normDispo(dati.dispo[mid]?.[slotKey]);
    if (cur.no || !cur.verde.includes(sede)) return;
    const next = { verde: cur.verde, verdeLiv: cur.verdeLiv, blu: cur.blu, bluLiv: cur.bluLiv, no: false, preferito: cur.preferito === sede ? null : sede };
    const nd = { ...(dati.dispo[mid] || {}) };
    nd[slotKey] = next;
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  // Preferenza di TURNO (diurno ☀️ / notturno 🌙) per un giorno con entrambi i turni: decide solo
  // quale dei due il medico mantiene se li vince entrambi lo stesso giorno (§3.9). Un click
  // ripetuto sulla stessa icona la toglie.
  const setTurnoPref = (mid, dataStr, valore) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    const key = "TURNOPREF:" + dataStr;
    if (nd[key] === valore) delete nd[key]; else nd[key] = valore;
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const toggleExtra = (dateKey, tipo) => {
    const ex = { ...(dati.extras[dateKey] || {}) };
    ex[tipo] = !ex[tipo];
    setDati({ extras: { ...dati.extras, [dateKey]: ex }, schema: null });
  };
  const elabora = () => {
    const r = elaboraSchema(dati.dispo, dati.extraOre, anno, mese, dati.extras, dati.turniExtra || {}, dati.maxTurniMese || {});
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
    setMedici([...mediciList, { id: nuovoId, nome, cat: nuovoMedico.cat, grad, sedeContratto: null }]);
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
    const verde = Object.entries(rapSedi).filter(([, v]) => v === "verde").map(([s]) => s);
    const blu = Object.entries(rapSedi).filter(([, v]) => v === "blu").map(([s]) => s);

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
          touch(y, m, d, tid, { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null });
          scrittiIndisp++;
        });
      }
    });

    // PASSO 2: il resto del periodo di riferimento diventa disponibile con le sedi scelte —
    // MA solo se non è già stato toccato dal passo 1, e solo se non esisteva GIA' un'indisponibilità
    // esplicita precedente (es. il 12 agosto segnato in un'azione passata): quella resta protetta.
    if (verde.length || blu.length) {
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
          const verdeLivRap = {}; verde.forEach((s) => { verdeLivRap[s] = 1; });
          const bluLivRap = {}; blu.forEach((s) => { bluLivRap[s] = 1; });
          touch(y, m, d, tid, { verde: [...verde], verdeLiv: verdeLivRap, blu: [...blu], bluLiv: bluLivRap, no: false, preferito: null });
          scrittiDisp++;
        });
      }
    }

    // PASSO 3 (opzionale): tetto settimanale — una dichiarazione per ciascuna settimana coperta
    // dal range, scritta come dispo[rapMedico]["SETT:" + lunedì] = { maxTurni }. Una settimana può
    // scavalcare il confine tra due mesi: la dichiarazione va scritta in ENTRAMBI i mesi toccati,
    // così elaboraSchema la vede a prescindere da quale dei due mesi si stia elaborando.
    let scrittiSettimana = 0;
    if (rapMaxSettimana !== "" && Number(rapMaxSettimana) >= 0) {
      const nMax = Number(rapMaxSettimana);
      const settimaneViste = new Set();
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const dow = (dt.getDay() + 6) % 7; // 0=lunedì .. 6=domenica
        const lun = new Date(dt); lun.setDate(dt.getDate() - dow);
        const wk = dk(lun.getFullYear(), lun.getMonth(), lun.getDate());
        if (settimaneViste.has(wk)) continue;
        settimaneViste.add(wk);
        const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
        const mesiToccati = new Set([mk(lun.getFullYear(), lun.getMonth()), mk(dom.getFullYear(), dom.getMonth())]);
        mesiToccati.forEach((mkey) => {
          const [my, mm] = mkey.split("-").map(Number);
          if (!MESI_DISPONIBILI.some((x) => x.anno === my && x.mese === mm)) return;
          if (!patchByMonth[mkey]) {
            const baseDispo = (store[mkey] || {}).dispo || {};
            patchByMonth[mkey] = { dispo: { ...baseDispo }, schema: null, avvisi: [] };
          }
          const patchDispo = patchByMonth[mkey].dispo;
          const nd = { ...(patchDispo[rapMedico] || {}) };
          nd["SETT:" + wk] = { maxTurni: nMax };
          patchDispo[rapMedico] = nd;
        });
        scrittiSettimana++;
      }
    }

    const totale = scrittiIndisp + scrittiDisp + scrittiSettimana;
    if (!totale) { alert("Nessun turno compilato: controlla le date e le opzioni scelte."); return; }
    applicaPatchMultiMese(patchByMonth);
    const note = [];
    if (scrittiDisp) note.push(`${scrittiDisp} turni disponibili`);
    if (scrittiIndisp) note.push(`${scrittiIndisp} turni indisponibili`);
    if (protetti) note.push(`${protetti} turni già indisponibili in precedenza mantenuti invariati`);
    if (scrittiSettimana) note.push(`tetto di ${rapMaxSettimana} turni/settimana impostato su ${scrittiSettimana} settimane`);
    if (saltatiFuoriRange) note.push(`${saltatiFuoriRange} giorni fuori dal calendario disponibile (ago 2026 – dic 2027) ignorati`);
    if (saltatiNoDiurno) note.push(`${saltatiNoDiurno} giorni senza turno diurno (feriali) ignorati per il diurno`);
    alert(`${byId[rapMedico].nome}: ${note.join("; ")}.`);
    setRapidoOpen(false);
    setRapInizio(""); setRapFine(""); setRapSedi({}); setRapIndisp([]); setRapMaxSettimana("");
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
<fonts count="10">
<font><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="8"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF8A3A00"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF1A5C4A"/><name val="Calibri"/></font>
<font><sz val="8.5"/><name val="Calibri"/></font>
<font><i/><sz val="8"/><color rgb="FF5B5F59"/><name val="Calibri"/></font>
<font><b/><sz val="8.5"/><color rgb="FFB03030"/><name val="Calibri"/></font>
<font><sz val="8.5"/><color rgb="FF666666"/><name val="Calibri"/></font>
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
<cellXfs count="14">
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
<xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
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

    // R3 turni — etichette adattate solo per l'export (la griglia a schermo usa t.label invariato):
    // il diurno feriale/weekend "semplice" perde l'orario "8-20" (resta "DIURNO"), prefestivo e
    // superfestivo restano con l'orario completo; le colonne MMG mattina/pomeriggio diventano
    // "ANTICIPO DIURNO MMG e PLS 8-14" / "...14-20".
    const ETICHETTE_EXPORT = {
      "DIURNO 8-20": "DIURNO",
      "MATTINA MMG 8-14": "ANTICIPO DIURNO MMG e PLS 8-14",
      "POMERIGGIO MMG 14-20": "ANTICIPO DIURNO MMG e PLS 14-20",
    };
    let r3 = cellV(3, 0, 12);
    cols.forEach(({ t }, k) => {
      const st = t.extra ? 7 : (t.label.includes("SUPER") || t.label.includes("PREFESTIVO")) ? 6 : 5;
      r3 += cell(3, k + 1, ETICHETTE_EXPORT[t.label] || t.label, st);
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
          // Turno MMG: un solo medico assegnato, sempre associato a Maniago (nessun concetto di
          // sede per gli extra). Le altre 4 sedi non sono mai coperte da un MMG: stesse regole
          // di scopertura delle colonne normali (SCOPERTO rosso per la CDC Spilimbergo, scoperto
          // grigio per le sedi minori), così la colonna mostra sempre tutte e 5 le sedi.
          if (sede === "MANIAGO") {
            if (t.slots[0]) testo = `${byId[t.slots[0]].nome} (MMG)`;
            else { testo = "SCOPERTO"; stile = 11; }
          } else if (sede === "SPILIMBERGO") { testo = "SCOPERTO"; stile = 11; }
          else { testo = "scoperto"; stile = 13; }
        } else if (!t.slots.some(Boolean)) {
          if (sede === "MANIAGO" || sede === "SPILIMBERGO") { testo = "SCOPERTO"; stile = 11; }
          else { testo = "scoperto"; stile = 13; } // sede secondaria scoperta: neutro, non un'emergenza come MA/SP
        } else {
          const si = mapIdx[sede];
          const mid = t.slots[si];
          if (mid) {
            const nota = notaSlot(t.slots, si, t.fis);
            if (nota.tipo === "copertura") { testo = nota.testo; stile = 10; }
            else testo = byId[mid].nome + (nota.testo ? "\n" + nota.testo : "");
          } else if (sede === "MANIAGO" || sede === "SPILIMBERGO") {
            testo = "SCOPERTO"; stile = 11; // anche se un'altra sede del turno è coperta, Maniago/Spilimbergo scoperte vanno sempre segnalate in rosso
          } else if (sede === "MEDUNO" || sede === "CLAUT" || sede === "ANDUINS") {
            testo = "scoperto"; stile = 13; // sede secondaria scoperta: neutro, non un'emergenza come MA/SP
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
  // testoForzato: se passato (es. dal pulsante "Continua"), viene inviato al posto del
  // contenuto di aiInput — permette di inviare "continua" senza passare dal campo di testo.
  const chiediAI = async (testoForzato) => {
    const testo = (testoForzato !== undefined ? testoForzato : aiInput).trim();
    if (!testo || aiBusy) return;
    const domanda = testo;
    if (!testoForzato) ultimaDomandaRef.current = domanda; // ricordata per poterla ripetere se la risposta viene troncata
    setAiInput("");
    setAzioniRestanti(false); // si aggiorna in base alla risposta di QUESTO round, appena arriva
    setTroncato(false);
    setCompletato(false);
    const msgs = [...aiMsgs, { role: "user", content: domanda }];
    setAiMsgs(msgs);
    setAiBusy(true);
    try {
      const stato = {
        mese: `${MESI_IT[mese]} ${anno}`,
        medici: MEDICI.map((m) => ({
          nome: m.nome, categoria: CAT_INFO[m.cat].label, graduatoria: m.grad, oreExtra: dati.extraOre[m.id] || 0,
          turniExtra: (dati.turniExtra || {})[m.id] || 0,
          maxTurniMese: (dati.maxTurniMese || {})[m.id] ?? null,
          oreAssegnate: dati.schema ? (oreAssegnateDi[m.id] || 0) : null,
          oreMancanti: dati.schema && CAT_INFO[m.cat].ore !== null ? (CAT_INFO[m.cat].ore + (dati.extraOre[m.id] || 0)) - (oreAssegnateDi[m.id] || 0) : null,
        })),
        mmgAttivi: Object.entries(dati.extras).filter(([, v]) => v.M || v.P).map(([k, v]) => `g${Number(k.slice(8, 10))}:${v.M ? "M" : ""}${v.P ? "P" : ""}`),
        avvisiScenari: dati.avvisi || [],
        disponibilita: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).length).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => !sk.startsWith("SETT:") && !sk.startsWith("TURNOPREF:")).map(([sk, v]) => { const [dt, tu] = sk.split("|"); const nv = normDispo(v); if (nv.no) return `g${Number(dt.slice(8, 10))}${tu}:NO`; return `g${Number(dt.slice(8, 10))}${tu}:${nv.verde.map((s) => SEDI_BREVI[s]).join(",")}${nv.blu.length ? "|blu:" + ordinaPerLivello(nv.blu, nv.bluLiv, MAX_LIV_BLU).map((s) => SEDI_BREVI[s] + (nv.bluLiv[s] || 1)).join(",") : ""}${nv.preferito ? "|PREF:" + SEDI_BREVI[nv.preferito] : ""}`; })])),
        // Checklist essenziale (solo giorno+turno, senza dettagli) di QUALI slot hanno già una
        // disponibilità inserita per ciascun medico, incluso ogni medico senza nessuna (array vuoto).
        // Serve a confrontare direttamente cosa manca rispetto a una richiesta/email, invece di
        // doverlo dedurre dalla cronologia dei round precedenti (causa di loop, vedi sotto).
        disponibilitaPresenti: Object.fromEntries(MEDICI.map((m) => [m.nome, Object.keys(dati.dispo[m.id] || {}).filter((sk) => !sk.startsWith("SETT:") && !sk.startsWith("TURNOPREF:")).map((sk) => { const [dt, tu] = sk.split("|"); return `g${Number(dt.slice(8, 10))}${tu}`; })])),
        // Registro (solo in memoria, mai persistito) delle azioni già confermate in QUESTA
        // conversazione, in formato compatto "MEDICO g{giorno}{turno}" — ulteriore rete di sicurezza
        // anti-loop, azzerato con "Nuova conversazione".
        azioniGiaEseguite: azioniEseguite,
        tettiSettimanali: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).some((k) => k.startsWith("SETT:"))).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => sk.startsWith("SETT:")).map(([sk, v]) => `settimana del ${sk.slice(5)}: max ${v.maxTurni} turni`)])),
        preferenzeTurno: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).some((k) => k.startsWith("TURNOPREF:"))).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => sk.startsWith("TURNOPREF:")).map(([sk, v]) => `giorno ${Number(sk.slice(-2))}: preferisce il ${v === "G" ? "diurno" : "notturno"} se li vince entrambi`)])),
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

== CALENDARIO PERPETUO — GIORNO DELLA SETTIMANA E FESTIVITÀ (NON affidarti alla memoria) ==
Per stabilire se un giorno del mese corrente (indicato in STATO ATTUALE come "mese") è un feriale semplice, un weekend, un festivo o un prefestivo — informazione necessaria per le regole su turni diurno/notturno e weekend ambiguo più sotto — NON fidarti della tua memoria approssimativa del calendario: calcola sempre, usando le regole seguenti, MA SOLO MENTALMENTE, senza scrivere alcun passaggio del calcolo nella risposta: la risposta visibile deve contenere SOLO il risultato finale (JSON valido), MAI il ragionamento o i calcoli intermedi, MAI un'introduzione tipo "Ragionamento interno" o simili — nemmeno se pensi che sia etichettata come "non mostrata all'utente": qualunque testo scrivi prima o dopo il JSON è visibile per l'utente, non esiste un canale nascosto.
1) GIORNO DELLA SETTIMANA — congruenza di Zeller (calendario gregoriano): per la data giorno=q, mese=m, anno=y, se m è gennaio o febbraio trattalo come mese 13 o 14 dell'anno PRECEDENTE (cioè m+12, y-1). Poi calcola:
   h = ( q + floor(13×(m+1)/5) + K + floor(K/4) + floor(J/4) − 2×J ) mod 7
   dove K = y mod 100 (ultime due cifre dell'anno), J = floor(y/100) (secolo). Il risultato h corrisponde a: 0=sabato, 1=domenica, 2=lunedì, 3=martedì, 4=mercoledì, 5=giovedì, 6=venerdì.
2) FESTIVITÀ FISSE (ogni anno, senza eccezioni): 1 gennaio (Capodanno), 6 gennaio (Epifania), 25 aprile, 1 maggio, 2 giugno, 15 agosto (Ferragosto), 1 novembre (Ognissanti), 8 dicembre (Immacolata), 25 dicembre (Natale), 26 dicembre (Santo Stefano), 31 dicembre (festivo a sé per ASFO — non è un festivo nazionale italiano, ma per il Distretto Nord conta come tale: di conseguenza il 30 dicembre, non il 31, è il suo prefestivo).
3) PASQUA E PASQUETTA (data variabile, algoritmo di Gauss): per l'anno y calcola a = y mod 19; b = floor(y/100); c = y mod 100; d = floor(b/4); e = b mod 4; f = floor((b+8)/25); g = floor((b−f+1)/3); h = (19a + b − d − g + 15) mod 30; i = floor(c/4); k = c mod 4; l = (32 + 2e + 2i − h − k) mod 7; m = floor((a + 11h + 22l)/451); mese = floor((h + l − 7m + 114)/31) (3=marzo, 4=aprile); giorno = ((h + l − 7m + 114) mod 31) + 1. Questa è la domenica di Pasqua; Pasquetta è il giorno immediatamente successivo.
4) PREFESTIVO = il giorno immediatamente precedente a una qualsiasi delle date di cui sopra (festività fissa, Pasqua o Pasquetta).
5) WEEKEND = sabato o domenica (dal calcolo del punto 1), indipendentemente da festività/prefestivi.
Un giorno ha SIA il turno diurno (G) SIA quello notturno (N) se e solo se è weekend, festivo o prefestivo (punti 3-5); un feriale semplice (lunedì-venerdì non festivo né prefestivo) ha SOLO il turno notturno — il diurno non esiste in quel giorno. Questo calcolo è valido per QUALSIASI anno, senza limiti temporali: applicalo sempre, anche per date lontane nel tempo.

== SEDI E SCENARI DI COPERTURA ==
Maniago e Spilimbergo (le 2 CDC) devono sempre essere coperte PRIMA delle altre sedi.
Nessuna copertura a distanza è automatica: dipende SEMPRE da cosa i medici dichiarano (verde/blu, vedi sotto).
- Scenario 1 (1 medico): fisico nella sede verde ottenuta (non più forzato su Maniago). Copre a distanza solo le sedi dichiarate blu, nell'ordine dei livelli, massimo 1. Il resto resta SCOPERTO.
- Scenario 2 (2 medici): fisici nelle 2 CDC. Coprono a distanza le sedi per cui hanno dichiarato blu (massimo 1 a testa). Conflitti sulla stessa sede blu: titolarità sede → categoria → debito → graduatoria. Sedi senza blu dichiarato → SCOPERTE.
- Scenario 3 (3 medici): fisici a Maniago, Spilimbergo, Meduno. Stessa logica blu per le sedi restanti. Sedi senza blu → SCOPERTE.
- Scenario 4 (4 medici): 4 sedi fisiche (Maniago, Spilimbergo, Meduno, Claut). Stessa logica blu per Anduins. Sedi senza blu → SCOPERTE.

== GERARCHIA CATEGORIE (priorità decrescente) ==
1. INDET (indeterminato, qualunque orario) → spareggio: debito orario poi graduatoria
2. Determinato 36h/sett → spareggio: titolarità sede (solo tra determinati, vedi sotto) → debito orario → graduatoria
3. Determinato 24h/sett = Determinato 12h/sett ASAP (DET12ASAP) → STESSO livello di priorità, non sono in relazione
   gerarchica tra loro: uno spareggio diretto tra i due si risolve con titolarità sede → debito orario →
   graduatoria, esattamente come tra due medici della stessa categoria
4. Determinato 12h/sett (DET12) → spareggio: titolarità sede → debito orario → graduatoria; perde sempre contro
   INDET, Determinato 36h, Determinato 24h e DET12ASAP, batte solo i medici senza incarico
5. Senza incarico → SOLO graduatoria aziendale, nessun conteggio ore
La categoria superiore prevale SEMPRE finché il medico ha debito orario residuo positivo.

== TITOLARITÀ DI SEDE (solo determinati) ==
Ogni medico determinato (36h, 24h, 12h ASAP o 12h) può avere un contratto di titolarità per Maniago, Spilimbergo, o nessuna.
Tra due determinati in conflitto per la sede di cui uno è titolare, il titolare vince SEMPRE quella sede,
sia per l'assegnazione FISICA sia per la copertura A DISTANZA (blu), prima ancora del confronto di
categoria: titolarità sede → categoria → debito → graduatoria, in entrambi i casi.
La titolarità non ha alcun effetto se uno dei due contendenti non è determinato (es. contro un INDET o un senza incarico).

== FRAMEWORK DEBITO ORARIO ==
Conteggio mensile in ore effettive (NON settimanale, NON in numero di turni).
Monte ore mensile: INDET → 96 ore | Determinato 36h/sett → ~156 ore | Determinato 24h/sett → ~104 ore | Determinato 12h/sett (ASAP o no) → 52 ore.
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

== DISPONIBILITÀ (verde/blu) ==
Le disponibilità sono dicotomiche: disponibile (con sedi scelte) o non disponibile. Nessuno stato intermedio visibile.
- "NO" interno = indisponibilità dichiarata esplicitamente (protetta da sovrascritture massive)
- Assenza di dati = equivale a non disponibile
- VERDE = sede FISICA desiderata, livelli 1..5 (MA1,SP2 = Maniago prima scelta, Spilimbergo seconda). Livelli PARI = sedi INDIFFERENTI per il medico: il motore può spostarlo liberamente tra di esse per massimizzare il numero di medici al lavoro. Livello più basso = sede che il medico ha diritto di tenere, a meno che qualcuno con priorità superiore lo scalzi. I livelli non cambiano MAI chi vince un conflitto, solo quale sede viene assegnata a ciascun vincitore.
- BLU = sede che il medico è disposto a COPRIRE A DISTANZA (da qualunque sede fisica gli venga assegnata), livelli 1..4. Nessuna copertura a distanza è automatica: serve sempre una dichiarazione blu esplicita. Un medico copre al massimo 1 sede a distanza (la prima disponibile nel suo ordine blu).
- "PREF:XX" = il medico ha marcato con ★ la sede verde XX come sua sede fisica preferita per quel turno (informativo, non decisionale sui conflitti: se ottiene un'altra sede fisica, o nessuna, genera solo un avviso al coordinatore)

== INTERPRETAZIONE EMAIL DISPONIBILITÀ ==

Queste regole coprono le frasi più comuni usate dai medici italiani nelle email di disponibilità.
Per ogni frase ambigua non elencata, applica il principio più vicino per analogia.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO — NUMERO DI GUARDIE MENSILI (controllo OBBLIGATORIO, PRIMA di ogni altra regola di questa sezione)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se il medico ha categoria "Senza inc." (controlla sempre "categoria" in stato.medici) e dichiara disponibilità ordinarie (sedi, giorni, turni) SENZA indicare da nessuna parte un numero complessivo di guardie che vuole fare nel mese (es. "voglio fare 6 guardie", "posso fare al massimo 4 turni questo mese", "disponibile per 8 guardie ad agosto"): NON inserire NESSUNA disponibilità per quel medico in questo round, qualunque sede o giorno abbia specificato. Genera invece SOLO l'avviso: "🔴 ATTENZIONE: [nome] è senza incarico e non ha indicato il numero massimo di guardie mensili — contattare il medico e reinserire l'email con il numero specificato."
Il numero può essere stato indicato in questo stesso messaggio o in un messaggio precedente della stessa conversazione (vedi REGOLA GENERALE: MEMORIA TRA ROUND più sotto): non è necessario che venga ripetuto a ogni round. Se il numero risulta comunque presente da qualche parte nella conversazione per quel medico, il controllo è soddisfatto: inserisci normalmente tutte le disponibilità dichiarate (sedi, giorni, turni), con le stesse identiche regole ordinarie di questa sezione usate per qualsiasi altro medico, E genera SEMPRE anche un'azione {"az":"tetto_mese","medico":"...","maxTurni":N} con quel numero (controlla prima "maxTurniMese" in stato.medici: se è già impostato allo stesso valore non serve riproporla, altrimenti aggiornalo) — è questa azione che rende il numero dichiarato un vincolo REALE nel motore, non solo testuale.
Questo controllo riguarda SOLO i medici senza incarico e SOLO le disponibilità ordinarie (sedi/turni) — MMG/PLS, recupero ore e turni extra hanno già le proprie regole dedicate più sotto e non sono toccati da questa regola.
Esegui questo controllo silenziosamente, senza scrivere alcun ragionamento o passaggio intermedio nella risposta: solo il risultato finale (l'avviso oppure le azioni) deve comparire, mai un testo che spieghi come sei arrivato alla conclusione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEDI FISICHE — PRIMA SCELTA (verde livello 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frasi che indicano la sede principale desiderata:

ARRIVO/PRESENZA DIRETTA:
• vengo a X / faccio X / vado a X / mi metto a X / sono a X
• mi trovo a X / mi posiziono a X / mi presento a X
• passo da X / faccio servizio a X / presto servizio a X
• faccio il turno a X / faccio guardia a X / sono di guardia a X
• mi metto in servizio a X / prendo servizio a X

PREFERENZA ESPLICITA:
• preferisco X / vorrei X / meglio X / idealmente X
• la mia preferenza è X / preferibilmente X / possibilmente X
• se posso scelgo X / se posso vorrei X / se posso preferisco X
• mi piacerebbe X / sarei contento di fare X / gradirei X
• opterei per X / propendo per X / tendo a preferire X

DISPONIBILITÀ DIRETTA:
• sono disponibile a X / disponibile per X / per X ci sono
• X va benissimo / X ok / X perfetto / X va bene
• mettimi a X / mettetemi a X / assegnatemi a X
• X mi va / X mi va bene / X mi va benissimo / X mi va ottimamente
• conto su X / punto su X / mi aspetto X
• X è la mia sede / lavoro a X / la mia sede è X
• ho il contratto a X / sono titolare a X / sono di stanza a X
• X è la mia sede di riferimento / X è dove lavoro solitamente

ESCLUSIVITÀ:
• solo X / esclusivamente X / unicamente X / soltanto X
• X e basta / X e nient'altro / solo ed esclusivamente X
• non mi spostare da X / voglio solo X / ho disponibilità solo per X
• X, non altro / X, grazie / X punto / solo X grazie
• non mi mettere in altre sedi, solo X
• X è l'unica sede che posso fare
• non ho disponibilità di mezzi per spostarmi, solo X
• abito vicino a X quindi solo lì
• posso fare solo X per questioni logistiche
• X è l'unica sede raggiungibile per me

MOTIVAZIONI CONTESTUALI:
• conosco bene X, preferisco lì / ho esperienza a X
• abito vicino a X quindi preferisco lì
• ho il contratto a X quindi preferisco lì
• sono titolare a X
• ho la macchina solo certi giorni, quindi X che è più vicina
• X è più comoda per me / X è più pratica
• X è sulla mia strada / X è nel mio percorso
• il martedì vengo da quella parte quindi X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEDI FISICHE — SECONDA/TERZA SCELTA (verde livello 2-3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ QUESTE SONO SEMPRE VERDE (fisico), MAI BLU (distanza):

ALTERNATIVE ESPLICITE:
• in alternativa X / altrimenti X / alternativamente X
• come alternativa X / quale alternativa X / alternativa: X
• se non c'è posto a Y vado a X / se Y è occupata, X
• se Y non è disponibile, X / se non ottengo Y, X
• se non mi dai Y, X va bene lo stesso
• seconda scelta X / X come seconda opzione / X in seconda battuta
• preferisco Y ma accetto X / prima scelta Y, seconda X
• Y o in alternativa X / Y, altrimenti X
• Y come prima scelta e X come seconda
• mettimi a Y, se non c'è posto a X
• vorrei Y ma se non si può, X
• spero in Y ma accetto anche X

ACCETTAZIONE/DISPONIBILITÀ FISICA ALTERNATIVA:
• va bene anche X / vado bene anche a X / accetto anche X
• posso fare anche X / sono disponibile anche a X / faccio anche X
• X mi va uguale / X indifferente / X o Y per me è uguale
• X non è un problema / X va benissimo lo stesso
• X è accettabile / X è fattibile / X è ok come alternativa
• anche X può andare / pure X va / X va alla grande
• X mi sta bene lo stesso / X non mi dispiace
• sono disponibile per X se necessario
• posso venire anche a X / posso spostarmi anche a X
• X è raggiungibile / X ci arrivo / X riesco ad arrivarci

NECESSITÀ/EMERGENZA:
• se necessario vado a X / se manca qualcuno vado a X
• in caso di bisogno anche X / all'occorrenza X
• se proprio devo, X / se proprio non c'è altro, X
• se serve vado anche a X / se avete bisogno X
• se non trovate nessuno per X ci vado io
• X come ultima spiaggia fisica / X come extrema ratio
• in emergenza vado anche a X
• se c'è copertura scoperta a X posso andare
• X se è indispensabile / X se è strettamente necessario
• disponibile per X se non c'è nessun altro

INDIFFERENZA TRA SEDI:
• X o Y, non ho preferenza / X o Y, fate voi
• sia X che Y vanno bene / X e Y mi vanno entrambe
• indifferente tra X e Y / X o Y per me è uguale
• X o Y, decidi tu / X o Y, scegli tu
• tra X e Y non ho preferenza / X o Y, mi adatto
• X o Y o Z, qualsiasi delle tre va bene
• X, Y o Z indifferentemente / fate voi tra X, Y e Z

GRADAZIONE IMPLICITA:
• X principalmente, Y secondariamente
• X prima di tutto, poi Y se serve
• cerco di andare a X, altrimenti Y
• punto su X, ma Y mi riesce lo stesso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPERTURA A DISTANZA — BLU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solo frasi che esplicitano chiaramente la NON presenza fisica:

ESPLICITE DISTANZA:
• copro X a distanza / X a distanza / X in remoto
• copertura a distanza per X / copertura telefonica per X
• rispondo per X da dove sono / rispondo alle chiamate di X
• rispondo alle chiamate di X da Y / gestisco X da Y
• faccio X telefonicamente / X per telefono / X via telefono
• sono reperibile per X / sono raggiungibile per X
• gestisco X a distanza / supervisiono X a distanza
• sono disponibile per X telefonicamente / X in telesupporto
• X da remoto / X in telelavoro / X in modalità remota
• copertura remota per X / presidio telefonico per X
• guardia telefonica per X / reperibilità per X

NON PRESENZA FISICA ESPLICITA:
• non mi sposto fisicamente ma copro X
• rimango a Y e rispondo per X
• resto a Y e copro X telefonicamente
• sono fisicamente a Y ma rispondo per X
• da Y copro anche X a distanza
• sto a Y e gestisco X da lì
• presidio fisico a Y, copertura telefonica per X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDISPONIBILITÀ — NO ESPLICITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FERIE/ASSENZE PROGRAMMATE:
• ferie dal X al Y / sono in ferie dal X al Y agosto
• vacanze dal X al Y / sono in vacanza dal X al Y
• via dal X al Y / sarò via dal X al Y
• assente dal X al Y / sarò assente dal X al Y
• non ci sono dal X al Y / non sarò disponibile dal X al Y
• fuori dal X al Y / sarò fuori dal X al Y
• partenza il X, rientro il Y / parto il X torno il Y
• settimana del X sono fuori / quella settimana sono in ferie
• ferie prenotate, impossibile cambiare / ferie già confermate
• ferragosto sono assente / tutta la settimana di ferragosto non ci sono
• prima settimana non posso / seconda settimana non posso
• prima metà agosto non posso / seconda metà non posso
• ho le ferie approvate dal X al Y
• sono già in ferie dal X / le ferie partono il X

GIORNI SINGOLI — DIRETTO:
• il X non posso / il X agosto non posso
• il X sono occupato / il X ho da fare
• il X ho un impegno / il X sono impegnato
• escludo il X / togliete il X / il X non mettermi
• il X non ci sono / il X non sono disponibile
• saltate il X / il X saltatelo / il X non consideratemi
• il X sono di turno altrove / il X ho guardia in un'altra struttura
• il X ho già un impegno / il X è già occupato
• il X non sono libero / il X non riesco
• il X non riesco proprio / il X è impossibile
• il X assolutamente no / il X non si può
• il X ho corso di formazione / il X ho ECM
• il X ho visita medica / il X ho appuntamento medico
• il X ho congedo / il X sono in congedo
• il X è il compleanno di mio figlio, non posso
• il X ho cerimonia / il X ho matrimonio / il X ho funerale
• il X ho impegni familiari / il X ho questioni di famiglia
• il X non ho la macchina / il X non ho il mezzo

CASO SPECIALE MATTINA/SERA:
• il X mattina ho impegni quindi solo notturno → NO per G, sì per N
• il X ho un appuntamento la mattina, il pomeriggio sono libero → NO per G, sì per N
• il X mattina non posso, solo il pomeriggio/sera → NO per G, sì per N
• il X sera sono impegnato, solo il diurno → NO per N, sì per G
• il X ho impegni serali, faccio solo il diurno → NO per N, sì per G
• il X finisco tardi la sera, non faccio il notturno → NO per N, sì per G
• il X ho il notturno di un'altra struttura → NO per N, sì per G
• il X di mattina non ce la faccio, solo tardo pomeriggio/sera → NO per G, sì per N

ECCEZIONI CON "TRANNE" / "ECCETTO" / "SALVO" / "A PARTE" / "ESCLUSO":
Queste parole introducono un'eccezione dentro una frase di disponibilità: tutto ciò che viene DOPO la parola (fino alla fine della frase o della proposizione) indica giorni di INDISPONIBILITÀ (dispo_no), anche se la parte PRIMA della parola dichiara una disponibilità ampia (tutto il mese, un intervallo, una sede generica). Non invertire mai la direzione: la parte dopo "tranne"/"eccetto"/"salvo"/"a parte"/"escluso" è SEMPRE l'eccezione (indisponibilità), mai una conferma o un rinforzo della disponibilità generale che la precede.
• sono disponibile tutto il mese tranne dal 1 al 7 → disponibile tutto il mese (regole ordinarie), MA dispo_no per ogni giorno dall'1 al 7
• disponibile tutte le notti eccetto il 12 e il 13 → disponibile tutte le notti, NO per il 12 e il 13
• ci sono tutto agosto salvo la settimana di ferragosto → disponibile tutto agosto, NO per i giorni di quella settimana
• disponibile a Maniago tutti i giorni, a parte dal 20 al 25 che sono in ferie → disponibile a Maniago tutti i giorni, NO dal 20 al 25
• disponibile tutto il mese escluso il weekend del 15-16 → disponibile tutto il mese, NO per il 15 e il 16
Se la disponibilità generale e l'eccezione riguardano lo stesso intervallo di giorni, l'eccezione vince sempre per quei giorni specifici (dispo_no); il resto del mese resta disponibile secondo le regole ordinarie di questa sezione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPONIBILITÀ GENERICA — TUTTE LE SEDI PARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• qualsiasi sede / qualunque sede / tutte le sedi
• dove serve / dove c'è bisogno / dove manca copertura
• ovunque / indifferente sulla sede / nessuna preferenza
• mi mettete dove volete / fate voi sulla sede / decidete voi
• dove avete bisogno di me / dove sono più utile
• flessibile sulla sede / mi adatto / sono adattabile
• non ho preferenze di sede / per la sede sono indifferente
• qualsiasi posto del distretto va bene
• disponibile in tutte le sedi del distretto
• X, Y, Z — tutto ok / tutte e cinque le sedi vanno bene
• sia Maniago che Spilimbergo che Meduno / tutte e tre le sedi principali
• non mi importa la sede, sono disponibile
• mettetemi dove serve di più / dove c'è più bisogno
• lascio a voi la scelta della sede / decidete voi dove mettermi
• mi va bene qualsiasi sede / accetto qualsiasi sede
• sono disponibile ovunque nel distretto
• non ho vincoli di sede / nessun vincolo sulla sede
• per quanto riguarda la sede, nessun problema
→ inserisci verde livello 1 su tutte e 5 le sedi con livelli pari

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TURNI DIURNO/NOTTURNO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENTRAMBI I TURNI (inserisci G e N):
• sia diurno che notturno / diurno e notturno / entrambi i turni
• tutto il giorno / turno intero / giornata intera
• tutto il weekend / sabato intero / domenica intera
• mattina e sera / dal mattino alla sera
• sia il giorno che la notte / giorno e notte
• disponibile tutto il giorno / disponibile per tutto il turno
• faccio sia il diurno che il notturno / faccio entrambi
• mettimi per il turno completo / turno doppio
• dalle 8 alle 8 / 24 ore / turno di 24

SOLO NOTTURNO (inserisci solo N, MAI una "domanda" sul diurno — l'uso esplicito di "notti"/"notturno"/"notturni" è già una scelta di turno dichiarata, non un'ambiguità):
• solo il notturno / esclusivamente il notturno / solo la notte
• preferisco il notturno / meglio il notturno
• notturno sì, diurno no / il diurno non posso
• solo notti / le notti sì, i giorni no
• disponibile solo per il notturno / solo turni notturni
• la mattina non posso, solo il pomeriggio/sera
• ho impegni diurni, disponibile solo la notte

SOLO DIURNO (inserisci solo G):
• solo il diurno / esclusivamente il diurno / solo di giorno
• preferisco il diurno / meglio il diurno
• diurno sì, notturno no / il notturno non posso
• solo giorni / i diurni sì, i notturni no
• la notte non riesco, solo il giorno
• ho problemi con i notturni, solo diurni

WEEKEND AMBIGUO — medico NON specifica NÉ diurno NÉ notturno (SOLO per weekend/festivi/prefestivi, che hanno sia diurno che notturno):
🔒 CONTROLLO OBBLIGATORIO, PRIMA DI TUTTO IL RESTO DI QUESTA SEZIONE: verifica sempre, per il giorno esatto in questione, se è un lunedì/martedì/mercoledì/giovedì/venerdì NON festivo (feriale semplice). Se lo è, questa intera sezione NON SI APPLICA: niente domanda, niente ambiguità, il diurno in quel giorno non esiste affatto — inserisci solo il notturno (N) e basta, senza generare alcuna "domanda". La domanda sul diurno esiste SOLO per sabato, domenica, festivi e prefestivi (giorni che hanno realmente sia G che N). Esempio concreto dell'errore da NON fare: giovedì 7 agosto è un feriale semplice — "sono disponibile il 7" va inserito come solo notturno, SENZA nessuna domanda "vuoi aggiungere anche il diurno?", perché il 7 agosto non ha alcun turno diurno da poter aggiungere.
🔴 ATTENZIONE ALLA DIFFERENZA (per i soli weekend/festivi/prefestivi): questo caso vale SOLO quando il medico non menziona affatto il turno (né "notte/notturno/notti" né "giorno/diurno"). Se il medico usa esplicitamente parole come "notti" / "notturni" / "notturno" / "la notte" (vedi sezione SOLO NOTTURNO sopra), NON fare mai la domanda sul diurno: inserisci direttamente e silenziosamente solo il notturno, senza generare alcuna "domanda" — quella parola è già una specifica esplicita del turno, non un'ambiguità. La domanda "Aggiungo anche il diurno?" si fa SOLO quando il medico dice semplicemente "sono disponibile il 2" o simili, senza nominare in alcun modo né il turno diurno né quello notturno, E SOLO se quel giorno è un weekend/festivo/prefestivo vero (vedi controllo obbligatorio sopra).
• sabato 8 sono disponibile / disponibile domenica 9 / ci sono il 22 (domenica)
• il 2 a Maniago (sabato) / sabato 8 a Spilimbergo / domenica 22 ci sono
• faccio il 2 (weekend) / il 9 lo faccio (domenica) / mettimi il 16 (sabato)
→ inserisci SOLO il notturno (N) nelle "azioni" del round, E aggiungi una "domanda" (vedi formato JSON "domande" più sotto):
citazione: la frase esatta scritta dal medico (es. "sono disponibile il 2"); domanda in italiano completo, senza abbreviazioni (es. "non ha specificato diurno o notturno — vuoi aggiungere anche il diurno?"); seSi: [dispo_aggiungi con turno G, stesse sedi/livelli dichiarati per la notte]; seNo: [] (resta solo il notturno già inserito).
⚠️ RIPETUTO PERCHÉ CRITICO — questa regola NON si applica MAI ai giorni feriali (lunedì-venerdì non festivi): i feriali hanno SOLO il turno notturno, il diurno non esiste in quei giorni, quindi non c'è alcuna ambiguità da segnalare. Se il medico scrive "il 5 sono disponibile" e il 5 è un feriale semplice, inserisci il notturno (unico turno possibile quel giorno) SENZA alcuna domanda — non ha senso chiedere se intendeva anche il diurno quando il diurno quel giorno non esiste. Prima di generare QUALSIASI "domanda" di questo tipo, ricontrolla il giorno della settimana: se hai il minimo dubbio che possa essere un feriale, non generare la domanda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MMG E PLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I turni MMG/PLS sono SEPARATI dai turni ordinari (verde/blu/notturno) e i medici li specificano sempre esplicitamente — non vanno mai confusi con una disponibilità ordinaria.

⚠️ REGOLA GENERALE, SEMPRE PRIMA DI QUALSIASI INSERIMENTO MMG: prima di inserire un turno MMG (M o P, con "dispo_aggiungi") per un giorno specifico, controlla SEMPRE "mmgAttivi" nello STATO ATTUALE per verificare se quel turno è attivo proprio quel giorno. Questo vale per OGNI regola di questa sezione, comprese quelle sotto che sembrano una mappatura diretta frase→turno (es. "MMG mattina" → M): la mappatura indica QUALE turno (M o P), ma prima di inserirlo va sempre controllato che sia attivo per quel giorno. Se NON è attivo, NON inserirlo silenziosamente: genera sempre una "domanda" Sì/No (vedi il caso "MMG RICHIESTO MA NON ATTIVO" più sotto per il formato esatto).

⚠️ REGOLA GENERALE: "sedi" non può MAI essere vuoto in un'azione "dispo_aggiungi" per un turno MMG (M o P) — anche con turno attivo e fascia oraria chiara, senza almeno una sede dichiarata il motore esclude comunque il medico dai candidati e il turno resta scoperto nonostante l'inserimento apparentemente riuscito. Se il medico indica esplicitamente una sede nell'email, usa quella; se dal contesto risulta inequivocabile quale sia l'unica sede rilevante, usa quella. Se invece non è chiaro quale sede il medico intenda, NON inserire alcuna azione: genera un avviso "🔴 ATTENZIONE: sede MMG non specificata per [nome] giorno [X] — verificare con il medico."

MATTINA (turno M):
• MMG mattina / mattutino MMG / MMG 8-14 / copertura mattina MMG / PLS mattina

POMERIGGIO (turno P):
• MMG pomeriggio / pomeriggio MMG / MMG 14-20 / copertura pomeriggio MMG / PLS pomeriggio

MMG RICHIESTO MA NON ATTIVO (ambiguità con scelta binaria → SEMPRE "domande", MAI un avviso testuale — vale per OGNI caso di turno MMG non attivo, senza eccezioni):
• il medico chiede esplicitamente mattina O pomeriggio MMG per un giorno, ma controllando "mmgAttivi" nello STATO ATTUALE quel turno (M o P) NON risulta attivo per quel giorno
→ NON inserire silenziosamente, NON ignorare, e NON scrivere un avviso "🔴 ATTENZIONE" nella spiegazione: genera SEMPRE una "domanda" — citazione: la frase esatta scritta dal medico (es. "vorrei fare la mattina MMG l'11"); domanda: sempre "Vuoi attivare questo turno?" (formulazione standard, senza abbreviazioni); seSi: [{"az":"mmg","giorno":X,"fascia":"M"|"P","attivo":true}, {"az":"dispo_aggiungi","medico":"...","giorno":X,"turno":"M"|"P",...}] (attiva il turno E inserisce la disponibilità del medico); seNo: [] (non fa nulla — non inserire nemmeno l'altro turno).

ENTRAMBI SENZA SPECIFICARE MATTINA/POMERIGGIO:
• "faccio il diurno MMG" / "disponibile per il diurno" (nel contesto MMG, senza dire mattina o pomeriggio)
→ inserisci sia M che P se entrambi i turni MMG sono attivi quel giorno, altrimenti solo quello effettivamente attivo

NESSUNA MENZIONE DI MMG/PLS:
• "copro il [giorno]" (senza menzionare MMG o PLS) → è il turno notturno ORDINARIO, non un MMG — non confondere le due cose

MATTINA/POMERIGGIO/DIURNO SENZA DIRE MMG O PLS:
• "mattina del X" / "pomeriggio del X" / "diurno del X" (senza menzionare MMG o PLS)
→ controlla SEMPRE "mmgAttivi" nello STATO ATTUALE (elenca i giorni con turni MMG/PLS attivi, es. "g15:M", "g15:P", "g15:MP"): se il giorno X ha un turno MMG attivo corrispondente (mattina→M, pomeriggio→P, diurno generico→quello/i attivo/i), inserisci quel turno M/P; se il giorno X NON ha nessun turno MMG attivo in "mmgAttivi", ignora la frase — nei feriali il diurno ordinario non esiste, quindi non c'è nulla da inserire.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECUPERO ORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO: se il medico ha categoria "Senza inc." (controlla sempre "categoria" in stato.medici), non ha un monte ore contrattuale, quindi il concetto di recupero ore non si applica. Non usare mai az: ore_extra per questo medico, qualunque cosa scriva su ore da recuperare. Aggiungi invece nella spiegazione: "🔴 ATTENZIONE: [nome] è senza incarico e non ha monte ore contrattuale, ore da recuperare non si applicano."

• ho X ore da recuperare dal mese scorso / recupero X ore da [mese]
• il mese scorso ho fatto solo Y ore, recupero X / ho un recupero di X ore
• devo recuperare le ore di [mese] / ho un debito di X ore
• vorrei recuperare le ore mancanti / ho delle ore da recuperare
• [mese] ho fatto X ore invece di Y, recupero la differenza
• ero malato/in ferie e ho meno ore, vorrei recuperare
• ho X ore arretrate / ore arretrate: X / recupero: X ore
• chiedo di poter recuperare X ore / vorrei inserire X ore di recupero
→ usa az: ore_extra con il valore numerico dichiarato
ESPRESSO IN TURNI INVECE CHE IN ORE (conversione automatica):
• ho X turni da recuperare / recupero X turni dal mese scorso / mi mancano X turni / ho X guardie da recuperare
→ converti sempre in ore prima di usare az: ore_extra: ore = X turni × 12 (es. "ho 4 turni da recuperare" → az: ore_extra con ore:48). Non chiedere mai conferma per questa conversione, è automatica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TURNI EXTRA VOLONTARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO: se il medico ha categoria "Senza inc." (controlla sempre "categoria" in stato.medici), non ha un monte ore contrattuale, quindi il concetto di turni extra (oltre il monte ore) non si applica. Non usare mai az: turni_extra per questo medico, qualunque cosa scriva su turni extra o guardie in più. Aggiungi invece nella spiegazione: "🔴 ATTENZIONE: [nome] è senza incarico e non ha monte ore contrattuale, turni extra non si applicano."

Frasi che indicano disponibilità per turni oltre il monte ore contrattuale.
Estrarre sempre il numero X di turni dichiarati. Se non specificato → segnalare ATTENZIONE.

DICHIARAZIONE DIRETTA CON NUMERO:
• sono disponibile per X turni extra
• faccio anche X turni in più
• aggiungo X turni volontari
• mi offro per X turni extra
• disponibile per X turni aggiuntivi
• faccio X guardie in più
• sono disponibile per X guardie extra
• posso fare X turni oltre il mio monte ore
• aggiungo X turni al mio monte ore
• metto a disposizione X turni in più
• sono disposto a fare X turni extra
• dichiaro disponibilità per X turni aggiuntivi
• X turni extra, sono disponibile
• aggiungo X turni volontari al mio impegno mensile
• sono disponibile anche per X turni oltre contratto
• offro X turni aggiuntivi
• metto X turni in più a disposizione del distretto
• X turni extra se serve
• posso aggiungere X turni al mio calendario
• sono disponibile per X turni supplementari

DISPONIBILITÀ CONDIZIONALE CON NUMERO:
• se serve faccio altri X turni
• in caso di necessità faccio X turni extra
• se avete bisogno faccio anche X turni in più
• se manca copertura aggiungo X turni
• se siete a corto posso fare X turni extra
• disponibile per X turni aggiuntivi se necessario
• X turni extra se non trovate nessuno
• se c'è bisogno mi rendo disponibile per X turni in più
• sono disposto a coprire X turni extra in caso di scoperto
• posso aggiungere X turni se serve per la copertura
• X guardie extra se manca personale
• disponibile per X turni oltre il monte ore in caso di emergenza
• se il distretto ne ha bisogno faccio X turni in più
• posso fare X turni extra se il coordinatore lo ritiene necessario
→ per tutte queste frasi (dirette o condizionali, con numero esplicito): usa az: turni_extra con il valore numerico dichiarato

RIFIUTO ESPLICITO DI TURNI EXTRA (non inserire turni extra):
• non sono disponibile per turni extra
• faccio solo il mio monte ore
• non voglio turni aggiuntivi
• mi fermo al mio contratto
• solo i turni previsti dal contratto
• non aggiungo turni extra questo mese
• questo mese solo il monte ore obbligatorio
• non posso fare turni extra
• mi limito al monte ore contrattuale
• niente turni in più questo mese
→ per queste frasi: usa az: turni_extra con turni:0 (azzera eventuali turni extra già dichiarati in mesi precedenti), nessun avviso necessario

GENERICA SENZA NUMERO (→ segnalare ATTENZIONE, chiedere quanti):
• sono disponibile per turni extra
• faccio anche qualche turno in più
• disponibile per guardie aggiuntive
• se serve sono disponibile oltre il monte ore
• posso fare qualche turno extra
• sono disposto a fare turni aggiuntivi
• mi rendo disponibile per turni extra
• sono disponibile per turni supplementari
• faccio anche turni extra se serve
• disponibile per qualche guardia in più
• posso aggiungere qualche turno
• sono disponibile per lavoro aggiuntivo
• se avete bisogno ci sono anche per turni extra
• sono flessibile sul numero di turni
• disponibile per turni oltre contratto
• posso fare più del mio monte ore se serve
• sono aperto a fare turni aggiuntivi
• mi rendo disponibile per guardie extra
→ per tutte queste frasi: NON inserire alcuna azione turni_extra, aggiungi nella spiegazione "🔴 ATTENZIONE: [nome] è disponibile per turni extra ma non ha specificato quanti — chiedere conferma prima di inserire."

FRASI AMBIGUE DA CHIARIRE:
• faccio quello che serve (non chiaro se intende turni extra o solo il monte ore)
• sono a disposizione (generico, non implica turni extra)
• ci sono quando serve (non implica turni extra automaticamente)
• disponibile (troppo generico, non inserire turni extra)
→ per queste: non inserire turni extra, interpretare come disponibilità normale ai turni ordinari

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TETTO MENSILE (Max turni mese)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A differenza dei turni extra (sopra), il tetto mensile vale per QUALSIASI categoria, anche i senza incarico (controlla comunque "maxTurniMese" in stato.medici prima di sovrascriverlo: se è già impostato allo stesso valore non serve riproporlo). Non è un'estensione oltre il monte ore, ma un limite SUPERIORE al numero di turni nel mese — il motore si ferma su quel numero anche con debito residuo.

Frasi che indicano un numero massimo di turni/guardie che il medico vuole fare nel mese.
Estrarre sempre il numero X dichiarato. Se non specificato → segnalare ATTENZIONE.

DICHIARAZIONE DIRETTA CON NUMERO:
• voglio fare al massimo X turni questo mese
• non più di X guardie al mese
• limitatemi a X turni
• questo mese faccio solo X guardie
• non fatemi fare più di X turni
• massimo X guardie per me questo mese
• fatemi al massimo X turni
• non superate i X turni per me
• al massimo X guardie, grazie
• per questo mese mi fermo a X turni
• non datemi più di X guardie
• voglio un tetto di X turni questo mese
• X turni è il mio massimo per questo mese
• non voglio superare le X guardie
→ per tutte queste frasi: usa az: tetto_mese con maxTurni pari al valore numerico dichiarato

DISPONIBILITÀ CONDIZIONALE CON NUMERO (comunque un tetto esplicito, non turni extra):
• se ne avete bisogno faccio fino a X turni
• in caso di necessità arrivo fino a X guardie
• se serve posso arrivare fino a un massimo di X turni
• al bisogno faccio al massimo X guardie questo mese
• se il distretto ha bisogno, il mio limite è X turni
→ per tutte queste frasi: usa az: tetto_mese con maxTurni pari al valore numerico dichiarato (il condizionale indica solo che si tratta di un tetto massimo raggiungibile solo se necessario, non cambia l'azione da usare)

MEDICO SENZA INCARICO — STESSO NUMERO DEL CONTROLLO OBBLIGATORIO:
• questo mese faccio X guardie
• sono disponibile per X guardie questo mese
• voglio fare X turni ad [mese]
→ per un medico senza incarico, questa è la STESSA dichiarazione richiesta dalla regola "MEDICO SENZA INCARICO — NUMERO DI GUARDIE MENSILI" più sopra: genera SEMPRE anche az: tetto_mese con quel numero, indipendentemente dal fatto che nello stesso messaggio siano presenti o meno altre disponibilità (sedi/giorni/turni) da sbloccare.

RIFIUTO ESPLICITO DI QUALSIASI TETTO (rimuove un tetto già impostato, non lo azzera):
• non voglio limiti
• fate voi
• nessun tetto per me
• non mettetemi limiti questo mese
• decidete voi quanti turni farmi
• non ho un massimo, fate come serve
→ per queste frasi: usa az: tetto_mese con maxTurni:null (rimuove qualunque tetto già impostato — MAI 0, che significherebbe escludere il medico da ogni turno del mese), nessun avviso necessario

GENERICA SENZA NUMERO (→ segnalare ATTENZIONE, chiedere quanti):
• vorrei fare qualche turno in meno del solito
• vorrei lavorare meno questo mese
• questo mese preferirei limitare i turni
• vorrei un tetto ma non so ancora quanto
• fatemi lavorare un po' meno se possibile
→ per tutte queste frasi: NON inserire alcuna azione tetto_mese, aggiungi nella spiegazione "🔴 ATTENZIONE: [nome] vuole un tetto ai turni mensili ma non ha specificato un numero — chiedere conferma prima di inserire."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASI DA SEGNALARE AL COORDINATORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NON inserire nulla, solo avviso nella spiegazione:

SEDE NON IDENTIFICABILE:
• "zona nord" / "sede più vicina" / "da quelle parti"
• "la sede del distretto" (senza specificare quale)
• "una sede comoda" / "qualcosa di raggiungibile"
• "la sede più vicina a casa mia" (senza indicare dove abita)

DATE VAGHE O NON IDENTIFICABILI:
• "fine agosto" / "i primi di agosto" / "inizio agosto"
• "verso il 20" / "intorno al 15" / "metà mese"
• "a fine mese" / "verso fine agosto" / "gli ultimi giorni"
• "la prima settimana" / "la seconda settimana" (senza date)
• "il weekend di ferragosto" (ambiguo se 14-15 o 15-16)
• "qualche giorno" / "alcuni giorni" (senza specificare quali)

CONDIZIONALI E INCERTI:
• "forse il 15" / "probabilmente posso il 15" / "vedrò il 15"
• "salvo imprevisti" / "se non cambia niente" / "dipende"
• "ci provo" / "dovrei riuscire" / "spero di poter fare"
• "non sono sicuro" / "ancora non lo so" / "devo confermare"
• "vi faccio sapere" / "vi confermo" (senza data di conferma)

CONTRADDIZIONI:
• disponibile e non disponibile nello stesso giorno
• sede dichiarata non esistente nel distretto
• date impossibili (es. 31 settembre, 32 agosto)
• richiesta di turno in un giorno già inserito con NO

INFORMAZIONI INSUFFICIENTI:
• "ci sono" / "ok" / "sì" / "disponibile" (senza date o sede)
• "posso fare qualche turno" (senza specificare quali)
• "sono disponibile" (senza alcun dettaglio)
• email vuota o quasi vuota
• solo la firma senza contenuto

→ per tutti questi casi aggiungi nella spiegazione:
"🔴 ATTENZIONE: [descrizione precisa del problema] per [nome medico] — non ho inserito nulla per questo punto. Verificare con il medico prima di procedere."

== REGOLA GENERALE: MEMORIA TRA ROUND ==
- Tutte le informazioni dichiarate da un medico nell'email o messaggio ORIGINALE valgono per TUTTI i round della conversazione, non solo per il primo in cui vengono lette. Non "dimenticare" un'indisponibilità solo perché è stata menzionata in un round precedente: resta valida finché non viene esplicitamente ritirata dal medico.
- PRIMA di ogni inserimento di disponibilità, in QUALSIASI round (anche il quinto, il decimo, dopo un "continua"), ricontrolla SEMPRE le indisponibilità dichiarate nell'email originale per quel medico (ferie, NO espliciti, impegni) — non proporre mai una disponibilità che contraddice un'indisponibilità già dichiarata dallo stesso medico nello stesso testo, anche se quel giorno specifico non è quello che stai processando in questo momento.
- "Dal X al Y" (ferie, assenze, indisponibilità) include SEMPRE il giorno X, il giorno Y, e tutti i giorni intermedi — mai solo gli estremi, mai un giorno in meno o in più.
- I NO espliciti ("dispo_no") vengono tracciati in "azioniGiaEseguite" esattamente come le disponibilità positive (stesso formato "MEDICO g{giorno}{turno}") — usali allo stesso modo per verificare cosa è già stato impostato, comprese le indisponibilità.

== SPAZIATURA TEMPORALE E TETTO SETTIMANALE ==
- Il motore preferisce SEMPRE, per ogni medico, il turno più distante dall'ultimo turno fisico già assegnato: se un vincitore ha lavorato il giorno prima (o lo stesso giorno su un altro turno) ED esiste un altro candidato che ha dichiarato verde la STESSA sede e non ha ancora ottenuto nulla quel turno, la sede passa a quest'ultimo. Non cambia MAI chi vince un conflitto tra medici diversi (tra eventuali alternative decide sempre la gerarchia normale) e non lascia MAI una sede scoperta per questo motivo: se non esiste un'alternativa valida, il medico più recente resta dov'è. Automatico, non richiede dichiarazioni.
- Il medico può inoltre dichiarare esplicitamente un tetto massimo di turni per settimana (lun-dom): una volta raggiunto, non è più considerato candidato quella settimana, su nessuna sede. Nessuna copertura automatica di ripiego: le sedi che sarebbero state sue restano scoperte se nessun altro medico è disponibile.

== PREFERENZA DI TURNO STESSO GIORNO (solo giorni con diurno E notturno) ==
- Weekend, festivi e prefestivi hanno SIA il diurno (G) SIA il notturno (N). Un medico può dichiarare quale dei due preferisce mantenere SE li vince entrambi fisicamente lo stesso giorno (es. "il 15 preferisce il notturno" o "☀️ il diurno se vince tutti e due").
- Decide SOLO quale dei due il medico mantiene se li vince entrambi: non cambia mai CHI vince un conflitto, non anticipa l'elaborazione, non decide quale sede riceve. Se vince solo uno dei due, la preferenza è un no-op.
- Non lascia MAI una sede scoperta per questo: se non esiste un'alternativa valida per il turno non preferito, il medico resta assegnato a entrambi.
- Non applicabile ai giorni feriali semplici (nessun diurno quel giorno): se richiesta lì, segnala che non è applicabile invece di impostarla.

== COMPORTAMENTO ==
- Segnala sempre ogni conflitto risolto e il criterio usato
- Per ogni medico contrattualizzato indica il debito orario residuo aggiornato dopo ogni assegnazione
- I framework decisionali sono strumenti interni riservati al coordinatore — ai medici si comunica solo che i conflitti si risolvono per categoria e graduatoria
- In caso di dati ambigui o mancanti, chiedi chiarimento prima di procedere
- Gli errori del coordinatore si correggono sempre retroattivamente, in qualsiasi fase

== STILE DI RISPOSTA E LIMITI ==
- Scrivi SEMPRE in italiano semplice e diretto, come parlerebbe un collega — MAI gergo tecnico ("round", "azioni", "az", "slot", "array", "state", "JSON", ecc.) nei testi rivolti all'utente ("spiegazione", "testo"). Descrivi solo il risultato pratico e concreto (disponibilità, turni, medici, giorni), non i meccanismi interni. Es.: invece di "Fatte 8 di 10 azioni" scrivi "Ho inserito 8 disponibilità su 10, continua per le restanti" (adatta la parola concreta — disponibilità, turni, modifiche, preferenze... — al contenuto reale della richiesta, mai la parola "azioni").
- Non c'è un limite fisso al numero di azioni per risposta: valuta tu, in base alla lunghezza della richiesta. Se possibile, inserisci SEMPRE tutte le disponibilità dichiarate da un medico nello stesso round — non spezzare mai a metà le informazioni di un singolo medico tra due round.
- "spiegazione" deve essere UNA sola frase breve (max ~20 parole). Non elencare in prosa i dettagli di ogni singola azione (l'utente li vede già elencati nell'interfaccia di conferma) e non citare, ripetere o riassumere MAI per esteso il testo incollato dall'utente: riferisciti solo ai nomi e ai giorni coinvolti. UNICA ECCEZIONE al limite di lunghezza: gli avvisi "🔴 ATTENZIONE" (turni ambigui, casi da segnalare al coordinatore — vedi INTERPRETAZIONE EMAIL DISPONIBILITÀ) vanno sempre scritti per intero, anche se allungano la "spiegazione" oltre le ~20 parole.
- Se la richiesta coinvolge così tanti medici o giorni da rischiare di superare il budget di token, dai priorità a completare interi medici per round (mai spezzarne uno a metà) piuttosto che tagliare a un numero fisso di azioni; imposta "altreAzioniRestanti":true nella risposta se restano medici da fare, e in "spiegazione" indica solo il conteggio in italiano semplice (es. "Ho inserito le disponibilità di 5 medici su 8, continua per i restanti."), senza elencare gli altri. Quando invece questo round esaurisce tutta la richiesta, ometti "altreAzioniRestanti" (o mettilo a false): l'utente vedrà un pulsante "Continua" quando è a true, non serve chiedergli di scrivere altro.
- PRIMA di proporre qualunque azione, controlla SEMPRE sia la cronologia della conversazione SIA "azioniGiaEseguite" nello STATO ATTUALE (vedi sotto) per capire cosa è già stato fatto: ogni tua proposta precedente ("PROPOSTA: ...") seguita da un messaggio che NON è "Proposta annullata, nessuna modifica applicata" (es. "Modifiche applicate ✓" o "Applicata con avvisi: ...") significa che QUELLE azioni sono già state applicate con successo — non riproporle mai più, nemmeno riformulate o "corrette", nemmeno se l'utente scrive di nuovo "continua". "azioniGiaEseguite" è la fonte di verità più affidabile perché aggiornata direttamente a ogni conferma reale (non dedotta dalla chat): qualunque combinazione medico+giorno+turno lì presente è definitivamente già fatta e NON va mai riproposta. Solo se una proposta era seguita ESATTAMENTE da "Proposta annullata, nessuna modifica applicata" quelle azioni NON sono state applicate (infatti non compaiono in "azioniGiaEseguite") e possono essere riproposte se ancora pertinenti alla richiesta originale.
- Se ricevi "continua" come richiesta: NON ripetere le azioni già confermate nei round precedenti (vedi punto sopra). Per le richieste di disponibilità, non fidarti solo della cronologia: confronta la richiesta originale (email o elenco incollato) con "disponibilitaPresenti" nello STATO ATTUALE, che riflette esattamente cosa è già stato salvato — è la fonte di verità più affidabile su cosa manca, perché aggiornata ad ogni round in base a quanto realmente applicato. Prosegui SEMPRE con i prossimi medici/giorni NUOVI (quelli per cui "disponibilitaPresenti" non mostra ancora nulla). Se non riesci a determinare con certezza cosa manca, chiedi conferma invece di riproporre qualcosa di già fatto: non entrare mai in un loop che ripropone le stesse modifiche.
- Se ricevi una richiesta che inizia con "[la tua risposta precedente è stata troncata...]": vuol dire che la risposta precedente non è arrivata a completamento e NESSUNA azione di quel round è stata applicata (non è un round già fatto da proseguire: vanno rifatte da capo). Ripeti la stessa richiesta riportata subito dopo, ma con MASSIMO 2 azioni e una spiegazione ancora più corta, per stare sicuramente dentro il limite di token questa volta.

RISPONDI SOLO con un oggetto JSON valido, senza backtick e senza testo fuori dal JSON, in uno di questi formati. La tua risposta deve iniziare DIRETTAMENTE con il carattere "{" e finire con "}": nessun preambolo, nessun ragionamento scritto, nessuna frase introduttiva o di chiusura, nemmeno se la marchi come "interna" o "non visibile all'utente" — qualsiasi testo tu scriva viene mostrato integralmente, non esiste alcun canale nascosto per note o ragionamenti.
1) Domanda informativa → {"tipo":"risposta","testo":"..."}
2) Cambio mese visualizzato → {"tipo":"vai_mese","mese":"Dicembre","anno":2026}
3) Qualsiasi modifica → {"tipo":"modifiche","spiegazione":"riassunto breve","azioni":[ ...una o più azioni... ],"domande":[ ...opzionale, vedi sotto... ],"altreAzioniRestanti":true} — "altreAzioniRestanti" è booleano e opzionale (default false): vedi sopra. "azioni" può essere vuoto/omesso se la risposta è fatta SOLO di "domande".
"domande" (array opzionale) — SOLO per ambiguità con una scelta binaria chiara, dove sia il Sì che il No corrispondono a un'azione concreta e ben definita da applicare (es. attivare o no un turno MMG mancante, aggiungere o no il diurno quando un weekend non è stato specificato): {"giorno":11,"medico":"MARZANO","citazione":"vorrei fare la mattina MMG l'11","domanda":"la mattina non è attiva, solo il pomeriggio — vuoi attivare anche la mattina?","seSi":[ ...azioni da applicare se l'utente risponde Sì... ],"seNo":[ ...azioni da applicare se risponde No... ]}. "citazione" è OBBLIGATORIA: riporta tra virgolette la frase ESATTA scritta dal medico nel testo incollato (non un riassunto), così il coordinatore vede subito il contesto originale senza doverlo ricordare a memoria. In "citazione" e "domanda" scrivi SEMPRE in italiano completo, MAI abbreviazioni o codici interni (niente "g11", "g8N", "MA", "SP": scrivi "giorno 11", "agosto", "notturno", "Maniago", "Spilimbergo"). L'utente vede ogni domanda come una card con due pulsanti Sì/No: NON scrivere questi casi come testo "🔴 ATTENZIONE" nella spiegazione, usa SEMPRE "domande" quando la scelta è binaria e concreta. Per le ambiguità SENZA un'azione concreta definibile per entrambe le risposte (sede non identificabile, date vaghe, condizionali, contraddizioni — vedi CASI DA SEGNALARE AL COORDINATORE) continua a usare il testo "🔴 ATTENZIONE" nella spiegazione: lì non c'è nulla di binario da proporre, serve solo un avviso.
⚠️ REGOLA GENERALE — AMBITO DI "seSi"/"seNo": le azioni in "seSi" e "seNo" di una domanda devono riguardare ESCLUSIVAMENTE il giorno e il medico di QUELLA specifica domanda, mai nient'altro. Rispondere Sì o No a una domanda non deve MAI avere l'effetto di inserire disponibilità per altri giorni, anche se quei giorni compaiono altrove nella stessa email originale, anche se sembrano casi analoghi o dello stesso tipo di ambiguità. Ogni domanda è un'unità indipendente e isolata: la risposta a una domanda specifica non estende, conferma o anticipa nulla su nessun'altra domanda o giorno non esplicitamente menzionato in quella singola domanda.
Ogni azione ha un campo "az" che ne indica il tipo:
- {"az":"schema","giorno":14,"turno":"N","sede":"Maniago","medico":"WANG"} → cambia un'assegnazione nello schema (medico null = svuota la sede)
- {"az":"dispo_aggiungi","medico":"BEKAEVA","giorno":5,"turno":"N","sedi":["Maniago","Spilimbergo"],"sedi_liv":{"Maniago":1,"Spilimbergo":1},"blu":["Meduno","Claut"],"blu_liv":{"Meduno":1,"Claut":2},"preferito":"Maniago"} → imposta la disponibilità: "sedi"=sedi FISICHE (verdi), "sedi_liv"=livello 1..5 per ciascuna (livelli PARI = sedi indifferenti per il medico, il motore può spostarlo tra esse; livello più basso = sede che ha diritto di tenere; omesso=1), "blu"=sedi disposto a coprire A DISTANZA, "blu_liv"=livello 1..4 per ciascuna sede blu (1=prima scelta, 4=ultima, omesso=1; nessuna copertura a distanza è automatica, va sempre dichiarata), "preferito"=nome della sede VERDE specifica marcata con ★ (deve essere una delle "sedi", non una sede blu; omesso/null = nessuna preferenza espressa; informativo, non decisionale). Se il medico dice "Maniago o Spilimbergo indifferentemente" usa livelli pari sulle sedi verdi; se dice "preferibilmente Maniago, altrimenti Spilimbergo" (entrambe accettate fisicamente) usa Maniago:1, Spilimbergo:2. Se dice "posso coprire Claut a distanza" aggiungila in "blu", non in "sedi".
- {"az":"dispo_no","medico":"CERVESATO","giorno":4,"turno":"N"} → segna il medico come esplicitamente NON disponibile per quel turno
- {"az":"dispo_togli","medico":"WANG","giorno":12,"turno":"N"} → rimuove la disponibilità
- {"az":"mmg","giorno":15,"fascia":"M","attivo":true} → attiva/disattiva turno MMG (fascia: M=mattina 8-14, P=pomeriggio 14-20)
- {"az":"ore_extra","medico":"PRESSACCO","ore":24} → imposta le ore da recuperare del mese (0 per azzerare; solo medici con contratto)
- {"az":"turni_extra","medico":"PRESSACCO","turni":2} → imposta il numero di turni extra volontari del mese (12h ciascuno, 0 per azzerare; solo medici con contratto); si consumano SOLO dopo aver esaurito monte ore + ore da recuperare, con priorità da senza incarico (solo graduatoria)
- {"az":"tetto_settimana","medico":"WANG","giorno":5,"maxTurni":1} → imposta il tetto massimo di turni per la settimana (lun-dom) che contiene quel "giorno" (un numero qualunque della settimana desiderata va bene); maxTurni null o assente rimuove il tetto per quella settimana
- {"az":"tetto_mese","medico":"ZURLO","maxTurni":8} → imposta il tetto massimo di turni per l'INTERO mese corrente (vale per QUALSIASI categoria, anche senza incarico): il motore si ferma su quel numero anche con debito residuo; maxTurni null o assente rimuove il tetto. Usalo SEMPRE quando un senza incarico dichiara un numero massimo di guardie/turni che può fare nel mese (es. "posso fare al massimo 8 turni questo mese") — è il vincolo reale nel motore, non solo un'indicazione testuale
- {"az":"turno_pref","medico":"WANG","giorno":15,"turno":"G"} → imposta la preferenza di turno stesso giorno: "turno"="G" (diurno) o "N" (notturno) è quello che il medico mantiene se li vince entrambi; turno null o assente rimuove la preferenza. Applicabile solo ai giorni con sia diurno che notturno (weekend/festivi/prefestivi)
- {"az":"elabora"} → elabora/rielabora lo schema del mese con le regole ufficiali (mettila SEMPRE per ultima se richiesta)
Note: "turno": N=notturno, G=diurno, M=mattina MMG, P=pomeriggio MMG. "sede"/"sedi": Maniago | Spilimbergo | Meduno | Claut | Anduins. "medico": cognome ESATTO dall'elenco. Puoi combinare più azioni nella stessa proposta, verranno eseguite in ordine. Se la richiesta non è chiara usa "risposta".
Nello STATO ATTUALE sotto: "oreExtra"/"turniExtra"/"maxTurniMese" per medico sono i valori GIÀ dichiarati per il mese (0 se non impostati, null per maxTurniMese se nessun tetto) — controllali prima di sovrascriverli con una nuova azione ore_extra/turni_extra/tetto_mese; "oreAssegnate"/"oreMancanti" per medico sono null se lo schema non è ancora elaborato (oreMancanti è null anche per i medici senza incarico, che non hanno un monte ore); "preferenzeTurno" elenca le preferenze di turno stesso giorno già dichiarate (vedi sopra); "disponibilitaPresenti" elenca, per OGNI medico (anche con lista vuota se non ha ancora nulla), i giorni/turni per cui esiste già una disponibilità inserita (di qualsiasi tipo, incluso NO) — usalo SEMPRE per verificare con certezza cosa è già stato inserito e cosa manca rispetto a una richiesta o email incollata, invece di dedurlo dalla cronologia della chat; "azioniGiaEseguite" è un elenco (array di stringhe "MEDICO g{giorno}{turno}") delle azioni già confermate in QUESTA conversazione — svuotato solo con "Nuova conversazione" — da non riproporre mai (vedi sopra).
STATO ATTUALE: ${JSON.stringify(stato)}`;
      // Timeout lato client: se la risposta è molto lunga, l'ambiente artifact può bloccare la
      // fetch senza mai risolverla né rifiutarla (nessun errore, nessuna risposta: silenzio totale
      // per l'utente). Interrompiamo noi stessi dopo 55s per garantire SEMPRE un feedback in chat.
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 55000);
      let resp;
      try {
        resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            model: "claude-sonnet-5", max_tokens: 16000,
            // Intera cronologia della conversazione (mai troncata): il testo incollato dall'utente
            // (es. email dei medici) deve restare nel contesto per tutti i round successivi.
            messages: [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: `${sys}\n\nRICHIESTA: ${domanda}` }],
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await resp.json();
      if (!resp.ok) {
        // API ha risposto con errore HTTP (es. 401, 529, ecc.): mostra il messaggio completo di Anthropic
        const errObj = data?.error;
        const dettaglio = errObj ? `${errObj.type || "errore"}: ${errObj.message || JSON.stringify(errObj)}` : JSON.stringify(data);
        const reqId = data?.request_id ? ` [request_id: ${data.request_id}]` : "";
        setAiMsgs((p) => [...p, { role: "assistant", content: `Errore API (HTTP ${resp.status}): ${dettaglio}${reqId}` }]);
        setAiBusy(false);
        return;
      }
      let testo = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") || "";
      testo = testo.replace(/```json|```/g, "").trim();
      let obj = null;
      try { obj = JSON.parse(testo); } catch (e) { obj = null; }
      if (!obj) {
        // Il modello potrebbe aver anteposto del testo introduttivo al JSON (es. un "ragionamento"
        // scritto per errore, in violazione di "RISPONDI SOLO con JSON"): estraiJsonBilanciato
        // ignora correttamente eventuali graffe presenti nel preambolo stesso (es. notazione
        // matematica tipo "h = (...) mod 7"), a differenza di un semplice "prima { ultima }" che
        // si romperebbe proprio in quel caso.
        obj = estraiJsonBilanciato(testo);
      }
      const eTroncato = data.stop_reason === "max_tokens";
      if (eTroncato && !obj) {
        // Risposta tagliata prima di completare il JSON: nessuna azione è stata applicata.
        // Offriamo comunque un modo per proseguire, ripetendo la richiesta originale più in breve.
        setTroncato(true);
        setAzioniRestanti(true);
        setAiMsgs((p) => [...p, { role: "assistant", content: "La risposta è stata troncata perché troppo lunga (limite di token raggiunto) — nessuna modifica è stata applicata. Premi \"Continua →\" per far ripetere la richiesta in modo più sintetico." }]);
        setAiBusy(false);
        return;
      }
      if (obj?.tipo === "vai_mese") {
        const mi = MESI_DISPONIBILI.findIndex((x) => MESI_IT[x.mese].toLowerCase() === String(obj.mese || "").toLowerCase() && x.anno === Number(obj.anno));
        if (mi >= 0) {
          setMeseIdx(mi);
          setAiMsgs((p) => [...p, { role: "assistant", content: `Ti ho portato su ${MESI_IT[MESI_DISPONIBILI[mi].mese]} ${MESI_DISPONIBILI[mi].anno}.` }]);
        } else {
          setAiMsgs((p) => [...p, { role: "assistant", content: "Mese non trovato (calendario: Agosto 2026 – Dicembre 2036)." }]);
        }
      } else if ((obj?.tipo === "modifiche" || obj?.tipo === "modifica" || obj?.tipo === "modifica_dispo") &&
        ((Array.isArray(obj.azioni) && obj.azioni.length) || (Array.isArray(obj.domande) && obj.domande.length))) {
        // retrocompatibilità con i vecchi formati
        const azioniRaw = Array.isArray(obj.azioni) ? obj.azioni : [];
        const azioni = azioniRaw.map((a) => {
          if (a.az) return a;
          if (obj.tipo === "modifica_dispo") return a.op === "togli" ? { az: "dispo_togli", ...a } : { az: "dispo_aggiungi", ...a };
          return { az: "schema", ...a };
        });
        const domandeNuove = Array.isArray(obj.domande) ? obj.domande.filter((d) => d && d.domanda) : [];
        if (azioni.length) setProposta({ azioni, spiegazione: obj.spiegazione || "Modifica proposta" });
        if (domandeNuove.length) setDomande((prev) => [...prev, ...domandeNuove]); // accumula: non perde domande di round precedenti non ancora risposte
        setAzioniRestanti(!!obj.altreAzioniRestanti || eTroncato); // eTroncato = rete di sicurezza se il modello non ha impostato il campo
        let msg = obj.spiegazione || (azioni.length ? "Modifica proposta" : "Ho una domanda per te");
        if (azioni.length) msg += " — conferma o annulla qui sotto.";
        if (domandeNuove.length) msg += ` (${domandeNuove.length} domanda${domandeNuove.length > 1 ? "e" : ""} da rispondere qui sotto)`;
        setAiMsgs((p) => [...p, { role: "assistant", content: azioni.length ? `PROPOSTA: ${msg}` : msg }]);
      } else if (obj?.tipo === "risposta") {
        setAiMsgs((p) => [...p, { role: "assistant", content: obj.testo }]);
      } else if (obj) {
        // JSON valido ma di struttura non riconosciuta (es. "modifiche" con azioni vuote/mancanti):
        // NON mostrare mai il JSON grezzo in chat. Recupera un testo leggibile se presente, altrimenti
        // un messaggio generico.
        setAiMsgs((p) => [...p, { role: "assistant", content: obj.spiegazione || obj.testo || "Non ho capito bene la richiesta, puoi riformulare?" }]);
      } else {
        // Nemmeno estraiJsonBilanciato è riuscita: se il testo contiene comunque una graffa "{" in
        // QUALUNQUE punto (non solo se l'intero testo INIZIA con una, come prima) è quasi certamente
        // JSON grezzo o un misto testo+JSON (es. un preambolo di "ragionamento" seguito dal JSON vero
        // ma malformato) — non va mai mostrato così com'è, in nessun caso.
        const contieneJson = testo.includes("{");
        setAiMsgs((p) => [...p, { role: "assistant", content: contieneJson ? "Non sono riuscito a interpretare la risposta, riprova." : (testo || "Nessuna risposta.") }]);
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        // Richiesta interrotta dal nostro timeout: la risposta stava impiegando troppo (probabilmente
        // troppo lunga). Stesso trattamento del troncamento per JSON incompleto: nessuna azione
        // applicata, offriamo di ripetere la richiesta originale in modo più sintetico.
        setTroncato(true);
        setAzioniRestanti(true);
        setAiMsgs((p) => [...p, { role: "assistant", content: "La richiesta ha impiegato troppo tempo (oltre 55s) ed è stata interrotta — probabilmente la risposta era troppo lunga. Nessuna modifica è stata applicata. Premi \"Continua →\" per far ripetere la richiesta in modo più sintetico." }]);
      } else {
        setAiMsgs((p) => [...p, { role: "assistant", content: `Errore: ${e?.message || String(e)}. Verifica di star usando l'app all'interno di claude.ai come artifact attivo (non come file scaricato).` }]);
      }
    }
    setAiBusy(false);
  };

  const nomeToId = (nome) => {
    if (!nome) return null;
    const n = String(nome).trim().toUpperCase();
    const m = MEDICI.find((x) => x.nome === n) || MEDICI.find((x) => x.nome.startsWith(n)) || MEDICI.find((x) => n.startsWith(x.nome));
    return m ? m.id : undefined; // undefined = non trovato
  };

  // Applica un elenco di azioni (condiviso da applicaProposta e rispondiDomanda) e aggiorna dati.
  // Ritorna {errori, dispoModificata, daElaborare} per costruire il messaggio di conferma a chi chiama.
  const applicaAzioni = (azioniDaApplicare) => {
    const errori = [];
    let dispo = { ...dati.dispo };
    let extras = { ...dati.extras };
    let extraOre = { ...dati.extraOre };
    let turniExtra = { ...(dati.turniExtra || {}) };
    let maxTurniMese = { ...(dati.maxTurniMese || {}) };
    let schema = dati.schema;
    let daElaborare = false;
    let dispoModificata = false;

    azioniDaApplicare.forEach((a) => {
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
        if (CAT_INFO[byId[mid].cat].ore === null) { errori.push(`${a.medico} è senza incarico, niente ore da recuperare`); return; }
        extraOre = { ...extraOre, [mid]: Math.max(0, Number(a.ore) || 0) };
        return;
      }
      if (a.az === "turni_extra") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        if (CAT_INFO[byId[mid].cat].ore === null) { errori.push(`${a.medico} è senza incarico, niente turni extra volontari`); return; }
        turniExtra = { ...turniExtra, [mid]: Math.max(0, Number(a.turni) || 0) };
        return;
      }
      if (a.az === "tetto_mese") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        if (a.maxTurni === null || a.maxTurni === undefined) { const { [mid]: _drop, ...rest } = maxTurniMese; maxTurniMese = rest; }
        else maxTurniMese = { ...maxTurniMese, [mid]: Math.max(0, Number(a.maxTurni) || 0) };
        return;
      }
      if (a.az === "tetto_settimana") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        const wk = settimanaDi(dk(anno, mese, a.giorno));
        const nd = { ...(dispo[mid] || {}) };
        if (a.maxTurni === null || a.maxTurni === undefined) delete nd["SETT:" + wk];
        else nd["SETT:" + wk] = { maxTurni: Math.max(0, Number(a.maxTurni) || 0) };
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "turno_pref") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        const info = turniDelGiorno(anno, mese, a.giorno, extras);
        if (!info.turni.some((t) => t.id === "G")) { errori.push(`giorno ${a.giorno} non ha sia diurno che notturno: preferenza di turno non applicabile`); return; }
        const dataStr = dk(anno, mese, a.giorno);
        const nd = { ...(dispo[mid] || {}) };
        const key = "TURNOPREF:" + dataStr;
        if (a.turno === "G" || a.turno === "N") nd[key] = a.turno; else delete nd[key];
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "dispo_aggiungi" || a.az === "dispo_togli" || a.az === "dispo_no") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(`medico ${a.medico} non trovato`); return; }
        const slotKey = `${dk(anno, mese, a.giorno)}|${a.turno}`;
        const nd = { ...(dispo[mid] || {}) };
        if (a.az === "dispo_togli") delete nd[slotKey];
        else if (a.az === "dispo_no") nd[slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null };
        else {
          const verde = (a.sedi || []).filter((s) => SEDI5.includes(s));
          const blu = (a.blu || []).filter((s) => SEDI5.includes(s) && !verde.includes(s));
          if (!verde.length && !blu.length) { errori.push(`sedi non valide per ${a.medico} g${a.giorno}`); return; }
          // preferito deve essere una delle sedi verdi dichiarate, altrimenti viene ignorato
          const pref = a.preferito && verde.includes(a.preferito) ? a.preferito : null;
          if (a.preferito && !pref) errori.push(`preferito "${a.preferito}" ignorato per ${a.medico} g${a.giorno}: non è tra le sedi verdi dichiarate`);
          // sedi_liv / blu_liv opzionali dall'AI: {sede:livello} — default 1 per le sedi non specificate
          const verdeLivAI = {};
          verde.forEach((s) => { verdeLivAI[s] = (a.sedi_liv && a.sedi_liv[s]) ? Number(a.sedi_liv[s]) : 1; });
          const bluLivAI = {};
          blu.forEach((s) => { bluLivAI[s] = (a.blu_liv && a.blu_liv[s]) ? Number(a.blu_liv[s]) : 1; });
          nd[slotKey] = { verde, verdeLiv: verdeLivAI, blu, bluLiv: bluLivAI, no: false, preferito: pref };
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
    if (daElaborare) { const r = elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra, maxTurniMese); schema = r.schema; avvisiNuovi = r.avvisi; }
    setDati({ dispo, extras, extraOre, turniExtra, maxTurniMese, schema, avvisi: avvisiNuovi });
    return { errori, dispoModificata, daElaborare };
  };
  // Riepilogo compatto (medico: giorno+turno) per le azioni che li identificano — solo un promemoria
  // visivo di una riga, non un resoconto dettagliato. Condiviso da applicaProposta e rispondiDomanda,
  // e usato anche per popolare il registro anti-loop azioniEseguite (stato.azioniGiaEseguite).
  const riepilogoDi = (azioniDaRiepilogare) => {
    const riepilogoPerMedico = {};
    azioniDaRiepilogare.forEach((a) => {
      if (a.medico && a.giorno !== undefined && a.giorno !== null && a.turno) {
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push(`g${a.giorno}${a.turno}`);
      }
    });
    const riepilogo = Object.entries(riepilogoPerMedico).map(([m, gs]) => `${m}: ${gs.join(" ")}`).join(" · ");
    const nuoveVociRegistro = [];
    Object.entries(riepilogoPerMedico).forEach(([m, gs]) => gs.forEach((g) => nuoveVociRegistro.push(`${m} ${g}`)));
    return { riepilogo, nuoveVociRegistro };
  };
  const applicaProposta = () => {
    if (!proposta) return;
    const { errori, dispoModificata, daElaborare } = applicaAzioni(proposta.azioni);
    const { riepilogo, nuoveVociRegistro } = riepilogoDi(proposta.azioni);
    if (nuoveVociRegistro.length) setAzioniEseguite((prev) => [...prev, ...nuoveVociRegistro]);
    let msg = errori.length ? `Applicata con avvisi: ${errori.join("; ")}. ` : `Modifiche applicate ✓${riepilogo ? " — " + riepilogo : ""} (annullabile con ↶). `;
    if (dispoModificata && !daElaborare && dati.schema) msg += "Disponibilità cambiate con schema già elaborato: valuta se rielaborarlo o correggerlo a mano.";
    setAiMsgs((p) => [...p, { role: "assistant", content: msg.trim() }]);
    setProposta(null);
    if (!azioniRestanti && !domande.length) setCompletato(true); // nessun altro round o domanda in sospeso: mostra il banner "Completato ✓"
  };
  const rifiutaProposta = () => {
    setAiMsgs((p) => [...p, { role: "assistant", content: "Proposta annullata, nessuna modifica applicata." }]);
    setProposta(null);
  };
  // Risponde a una domanda Sì/No dell'AI (es. "attivo anche la mattina MMG?"), applicando l'elenco
  // di azioni corrispondente alla risposta scelta (seSi/seNo, entrambe opzionali/vuote).
  const rispondiDomanda = (idx, risposta) => {
    const d = domande[idx];
    if (!d) return;
    const azioniScelte = (risposta === "si" ? d.seSi : d.seNo) || [];
    let msg;
    if (!azioniScelte.length) {
      msg = `Risposta "${risposta === "si" ? "Sì" : "No"}" registrata, nessuna azione da applicare.`;
    } else {
      const { errori } = applicaAzioni(azioniScelte);
      const { riepilogo, nuoveVociRegistro } = riepilogoDi(azioniScelte);
      if (nuoveVociRegistro.length) setAzioniEseguite((prev) => [...prev, ...nuoveVociRegistro]);
      msg = errori.length ? `Risposta "${risposta === "si" ? "Sì" : "No"}" applicata con avvisi: ${errori.join("; ")}.` : `Risposta "${risposta === "si" ? "Sì" : "No"}" applicata ✓${riepilogo ? " — " + riepilogo : ""}.`;
    }
    setAiMsgs((p) => [...p, { role: "assistant", content: msg }]);
    setDomande((prev) => {
      const rest = prev.filter((_, i) => i !== idx);
      if (!rest.length && !proposta && !azioniRestanti) setCompletato(true);
      return rest;
    });
  };
  // Azzera la chat e il registro anti-loop per ripartire da zero senza ricaricare la pagina.
  const nuovaConversazione = () => {
    setAiMsgs([]);
    setAzioniEseguite([]);
    setProposta(null);
    setDomande([]);
    setAzioniRestanti(false);
    setTroncato(false);
    setCompletato(false);
    setAiInput("");
  };

  const mediciOrd = useMemo(() => [...mediciList].sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || a.grad - b.grad), [mediciList]);
  // Ore già assegnate nel mese elaborato, per medico: somma le ore dei turni in cui il medico
  // compare FISICAMENTE (stessa identica logica di scalo del debito nel motore — non conta la
  // copertura a distanza, che non consuma ore proprie). Sola lettura, tab "Medici".
  const oreAssegnateDi = useMemo(() => {
    const out = {};
    if (!dati.schema) return out;
    dati.schema.forEach((g) => {
      g.turni.forEach((t) => {
        if (!t) return;
        // Conta ogni medico una sola volta per turno: l'editor manuale dello schema (setSlot) non
        // aggiorna "fis" quando si riassegna una cella, quindi lo stesso medico può in teoria comparire
        // in più sedi fisiche dello stesso turno dopo una correzione manuale — senza questo Set le sue
        // ore verrebbero sommate una volta per ciascuna sede invece che una volta sola per il turno.
        const contati = new Set();
        t.fis.forEach((si) => {
          const mid = t.slots[si];
          if (mid !== null && mid !== undefined && !contati.has(mid)) {
            contati.add(mid);
            out[mid] = (out[mid] || 0) + t.ore;
          }
        });
      });
    });
    return out;
  }, [dati.schema]);
  const iconaT = { G: "☀", N: "☾", M: "am", P: "pm" };
  const btn = { padding: "8px 12px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 12 };
  const hPast = historyRef.current.past.length, hFut = historyRef.current.future.length;
  // Selettori mese/anno separati (stile "app nativa"): l'anno non ha tutti i 12 mesi disponibili
  // per il 2026 (parte da agosto), quindi il menu del mese mostra SOLO i mesi validi per l'anno
  // attualmente scelto — mai una combinazione inesistente in MESI_DISPONIBILI.
  const anniDisponibili = [...new Set(MESI_DISPONIBILI.map((m) => m.anno))];
  const mesiDelAnno = MESI_DISPONIBILI.filter((m) => m.anno === anno).map((m) => m.mese);
  const vaiAMese = (nuovoAnno, nuovoMese) => {
    let idx = MESI_DISPONIBILI.findIndex((m) => m.anno === nuovoAnno && m.mese === nuovoMese);
    if (idx < 0) idx = MESI_DISPONIBILI.findIndex((m) => m.anno === nuovoAnno); // mese non valido per quell'anno: primo disponibile
    if (idx >= 0) setMeseIdx(idx);
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "#f6f7f5", minHeight: "100vh", color: "#22252a" }}>
      <div style={{ background: "#12312a", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7 }}>ASFO · DISTRETTO NORD</div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Coordinamento Turni Guardia Medica</h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setMeseIdx((i) => Math.max(0, i - 1))} disabled={meseIdx === 0} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>‹</button>
          {/* Due selettori separati (mese + anno), stile "app nativa": salto diretto a qualunque
              mese disponibile senza cliccare le frecce decine di volte. Le opzioni del mese si
              filtrano in base all'anno scelto (il 2026 ha solo agosto-dicembre). Le frecce restano
              per il caso d'uso "mese successivo/precedente" più comune. */}
          <select value={mese} onChange={(e) => vaiAMese(anno, Number(e.target.value))}
            style={{ fontSize: 14, fontWeight: 700, minWidth: 100, textAlign: "center", textAlignLast: "center", background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 4px", cursor: "pointer" }}>
            {mesiDelAnno.map((m) => (
              <option key={m} value={m} style={{ color: "#22252a", background: "#fff" }}>{MESI_IT[m]}</option>
            ))}
          </select>
          <select value={anno} onChange={(e) => vaiAMese(Number(e.target.value), mese)}
            style={{ fontSize: 14, fontWeight: 700, minWidth: 68, textAlign: "center", textAlignLast: "center", background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 4px", cursor: "pointer" }}>
            {anniDisponibili.map((a) => (
              <option key={a} value={a} style={{ color: "#22252a", background: "#fff" }}>{a}</option>
            ))}
          </select>
          <button onClick={() => setMeseIdx((i) => Math.min(MESI_DISPONIBILI.length - 1, i + 1))} disabled={meseIdx === MESI_DISPONIBILI.length - 1} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>›</button>
          <button onClick={() => setAiOpen((o) => !o)} style={{ ...btn, background: aiOpen ? "#fff" : "rgba(255,255,255,.15)", color: aiOpen ? "#12312a" : "#fff", border: "none", fontWeight: 700 }}>Assistente AI</button>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #dde0dc", padding: "0 16px", flexWrap: "wrap", alignItems: "center" }}>
        {[["dispo", "1 · Disponibilità"], ["mmg", "2 · Coperture MMG e PLS"], ["medici", "3 · Medici / ore da recuperare"], ["schema", "4 · Schema turni"]].map(([k, l]) => (
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
Ogni cella è <b style={{color:"#1a5c4a"}}>disponibile</b> (con le sedi scelte) oppure <b style={{color:"#a03030"}}>✕ non disponibile</b> — nessuno stato intermedio: finché non la rendi disponibile, resta non disponibile. Tocca una cella per aprire il popup: per ogni sede scegli dal menu a tendina <b style={{color:"#1a5c4a"}}>Sede principale 1-5</b> (sede FISICA, in ordine di preferenza — livelli pari = sedi indifferenti per il medico, il motore lo sposta tra loro per far lavorare anche chi ha una sola sede; livello più basso = sede che ha diritto di tenere) oppure <b style={{color:"#1a56c4"}}>Copertura a distanza 1-4</b> (disponibilità a COPRIRE A DISTANZA quella sede, da qualunque sede fisica gli venga assegnata — nessuna copertura a distanza è automatica, va sempre dichiarata; un medico copre al massimo 1 sede a distanza). I <b style={{color:"#8a5a00"}}>★ preferiti</b> restano sulla sede fisica e/o "a tutti i costi" anche solo a distanza. In cella: "2·CL¹" = 2 sedi verdi (tutte liv.1) + Claut come blu liv.1; se le verdi hanno livelli diversi appare "MA¹SP²" al posto del conteggio; ★ prima = preferito sul fisico, ★ dopo = lo vuole anche solo a distanza. Ogni azione è annullabile con ↶.
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
                    <div style={{ fontSize: 11, color: "#8a8f88", marginBottom: 6 }}>Sedi per i giorni <b style={{color:"#1a5c4a"}}>disponibili</b> del periodo (tutte a livello 1) — tocca: verde fisica → blu a distanza → togli</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SEDI5.map((s) => {
                        const stato = rapSedi[s] || "off";
                        return (
                          <span key={s} onClick={() => setRapSedi((prev) => {
                            const cur = prev[s] || "off";
                            const next = cur === "off" ? "verde" : cur === "verde" ? "blu" : "off";
                            const np = { ...prev };
                            if (next === "off") delete np[s]; else np[s] = next;
                            return np;
                          })}
                            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none",
                              background: stato === "verde" ? "#1a5c4a" : stato === "blu" ? "#3a6fd9" : "#eceee9",
                              color: stato === "verde" ? "#fff" : stato === "blu" ? "#fff" : "#a9ada5" }}>
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
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "#5b5f59", display: "flex", alignItems: "center", gap: 8 }}>
                      Tetto turni/settimana (opzionale)
                      <input type="number" min="0" step="1" placeholder="nessun limite" value={rapMaxSettimana}
                        onChange={(e) => setRapMaxSettimana(e.target.value)}
                        style={{ width: 90, fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #c8ccc6" }} />
                    </label>
                    <div style={{ fontSize: 10, color: "#8a8f88", marginTop: 4 }}>Se impostato, il medico non verrà mai considerato candidato oltre questo numero di turni per ciascuna settimana (lun-dom) coperta dal periodo sopra — anche se disponibile su altri giorni. Nessuna copertura automatica di ripiego: le sedi oltre il tetto restano scoperte se nessun altro medico è disponibile.</div>
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
                          const on = !sedi.no && (sedi.verde.length + sedi.blu.length > 0);
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
                                const bluStr = sedi.blu.length
                                  ? "·" + ordinaPerLivello(sedi.blu, sedi.bluLiv, MAX_LIV_BLU)
                                      .map((s) => SEDI_BREVI[s] + sup[(sedi.bluLiv[s] || 1) - 1]).join("")
                                  : "";
                                // Verdi: compatte (solo conteggio) se tutte a livello 1 e nessuna sede
                                // preferita marcata; altrimenti dettagliate (sigla+livello), con ★
                                // attaccata specificamente alla sede preferita (non alla giornata).
                                const tutteLv1 = sedi.verde.every((s) => (sedi.verdeLiv[s] || 1) === 1);
                                const verdeStr = (tutteLv1 && !sedi.preferito)
                                  ? String(sedi.verde.length)
                                  : ordinaPerLivello(sedi.verde, sedi.verdeLiv, MAX_LIV_VERDE)
                                      .map((s) => (s === sedi.preferito ? "★" : "") + SEDI_BREVI[s] + sup[(sedi.verdeLiv[s] || 1) - 1]).join("");
                                return `${verdeStr}${bluStr}`;
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
                const dataStrCella = editCella.slotKey.split("|")[0];
                const hasEntrambiTurni = !!giorniMese[editCella.giorno - 1]?.turni.some((t) => t.id === "G");
                const turnoPref = turnoPrefDi(dati.dispo, editCella.mid, dataStrCella);
                return (
                  <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", background: "#fff", border: "1px solid #c8ccc6", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.25)", padding: 14, zIndex: 50, minWidth: 290, maxWidth: "92vw" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{byId[editCella.mid].nome}</div>
                    <div style={{ fontSize: 11, color: "#6b7068", marginBottom: 8 }}>Giorno {editCella.giorno} · {editCella.turno}</div>

                    {hasEntrambiTurni && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#8a8f88" }}>Se vince sia diurno che notturno, preferisce:</span>
                        <span onClick={() => setTurnoPref(editCella.mid, dataStrCella, "G")}
                          title={turnoPref === "G" ? "Preferisce il diurno: tocca per togliere" : "Preferisce il diurno se vince entrambi i turni"}
                          style={{ cursor: "pointer", fontSize: 15, padding: "3px 7px", borderRadius: 6, userSelect: "none", background: turnoPref === "G" ? "#fdf0d5" : "#f0f2ee", border: turnoPref === "G" ? "1px solid #cf9a1a" : "1px solid transparent" }}>
                          ☀️
                        </span>
                        <span onClick={() => setTurnoPref(editCella.mid, dataStrCella, "N")}
                          title={turnoPref === "N" ? "Preferisce il notturno: tocca per togliere" : "Preferisce il notturno se vince entrambi i turni"}
                          style={{ cursor: "pointer", fontSize: 15, padding: "3px 7px", borderRadius: 6, userSelect: "none", background: turnoPref === "N" ? "#e3ebfa" : "#f0f2ee", border: turnoPref === "N" ? "1px solid #3a6fd9" : "1px solid transparent" }}>
                          🌙
                        </span>
                      </div>
                    )}

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
                        <div style={{ fontSize: 10, color: "#8a8f88", marginBottom: 8 }}>Per ogni sede scegli dal menu: <b style={{ color: "#1a5c4a" }}>Sede principale 1-5</b> = sede FISICA in ordine di preferenza (livelli <b>pari</b> = indifferenti per il medico, il motore può spostarlo tra loro), oppure <b style={{ color: "#1a56c4" }}>Copertura a distanza 1-4</b> = disponibile a COPRIRE A DISTANZA quella sede (max 1 sede a distanza a testa). Tocca <b>☆</b> su una sede marcata come sede principale per segnarla come preferita: se il medico ottiene esattamente quella sede è soddisfatto, altrimenti il coordinatore riceve un avviso (non influisce mai su chi vince o su quale sede viene assegnata).</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                          {SEDI5.map((s) => {
                            const valore = sedi.verde.includes(s) ? `V${sedi.verdeLiv[s] || 1}` : sedi.blu.includes(s) ? `B${sedi.bluLiv[s] || 1}` : "";
                            const isVerde = valore.startsWith("V");
                            return (
                              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                <span style={{ fontWeight: 700, minWidth: 24 }}>{SEDI_BREVI[s]}</span>
                                <select value={valore} onChange={(e) => setSedeOpzione(editCella.mid, editCella.slotKey, s, e.target.value)}
                                  style={{ flex: 1, fontSize: 12, padding: "5px 4px", borderRadius: 5, border: "1px solid #c8ccc6",
                                    background: valore.startsWith("V") ? "#e3f2ec" : valore.startsWith("B") ? "#e3ebfa" : "#fff",
                                    color: valore.startsWith("V") ? "#1a5c4a" : valore.startsWith("B") ? "#1a3d8f" : "#5b5f59" }}>
                                  <option value="">Non disponibile</option>
                                  {[1, 2, 3, 4, 5].map((l) => <option key={"V" + l} value={"V" + l}>Sede principale {l}</option>)}
                                  {[1, 2, 3, 4].map((l) => <option key={"B" + l} value={"B" + l}>Copertura a distanza {l}</option>)}
                                </select>
                                {isVerde && (
                                  <span onClick={() => setPreferitoSede(editCella.mid, editCella.slotKey, s)}
                                    title={sedi.preferito === s ? "Sede preferita: tocca per togliere" : "Marca come sede preferita"}
                                    style={{ cursor: "pointer", fontSize: 15, minWidth: 16, textAlign: "center", color: sedi.preferito === s ? "#8a5a00" : "#c8ccc6", userSelect: "none" }}>
                                    {sedi.preferito === s ? "★" : "☆"}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
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
                Le <b>ore da recuperare</b> (su fiducia) si sommano al monte ore: il medico resta in categoria con piena priorità fino a coprire il totale.
                I <b>turni extra</b> sono invece turni volontari oltre il monte ore (1 turno = 12h): il medico li fa SOLO dopo aver esaurito monte ore + ore da recuperare, competendo come un senza incarico (solo graduatoria, nessuna priorità di categoria).
                Il <b>Max turni mese</b> è un tetto superiore al numero di turni nel mese, valido per QUALSIASI categoria (anche senza incarico): il motore si ferma su quel numero anche se resta debito residuo. È indipendente dal monte ore e può essere anche inferiore ad esso.
                Qui puoi anche <b>modificare categoria e graduatoria</b> di ciascun medico e <b>aggiungerne di nuovi</b> — le modifiche valgono per tutti i mesi.
                Dopo una modifica, rielabora gli schemi dei mesi già elaborati.
                <b>Ore assegnate</b> e <b>Ore mancanti</b> sono sola lettura: mostrano quante ore ha già nel mese elaborato e quante gliene restano per completare il monte ore; appaiono solo dopo aver premuto <b>Elabora schema</b> (altrimenti "—").
              </p>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #d6dad3" }}>
                  <th style={{ padding: "6px 8px" }}>Medico</th><th style={{ padding: "6px 8px" }}>Categoria</th><th style={{ padding: "6px 8px" }}>Grad.</th><th style={{ padding: "6px 8px" }}>Titolarità</th><th style={{ padding: "6px 8px" }}>Monte ore</th><th style={{ padding: "6px 8px" }}>Ore da recuperare</th><th style={{ padding: "6px 8px" }} title="Turni volontari oltre il monte ore (12h ciascuno): fatti SOLO dopo aver esaurito monte ore + ore da recuperare, con priorità da senza incarico (solo graduatoria)">Turni extra</th><th style={{ padding: "6px 8px" }} title="Tetto massimo di turni nel mese, valido per QUALSIASI categoria: il motore si ferma anche con debito residuo. Vuoto = nessun limite">Max turni mese</th><th style={{ padding: "6px 8px", color: "#5b5f59" }} title="Sola lettura: visibile solo dopo l'elaborazione dello schema del mese">Ore assegnate</th><th style={{ padding: "6px 8px", color: "#5b5f59" }} title="Sola lettura: visibile solo dopo l'elaborazione dello schema del mese">Ore mancanti</th><th style={{ padding: "6px 8px" }}></th>
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
                      <td style={{ padding: "6px 8px" }}>
                        {isDeterminato(m.id) ? (
                          <select value={m.sedeContratto || ""} onChange={(e) => aggiornaMedico(m.id, { sedeContratto: e.target.value || null })}
                            title="Sede di titolarità: vince sempre quella sede tra determinati, prima della categoria"
                            style={{ fontSize: 11, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6" }}>
                            <option value="">Nessuna</option>
                            {CDC.map((s) => <option key={s} value={s}>{SEDI_BREVI[s]}</option>)}
                          </select>
                        ) : "—"}
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
                        {CAT_INFO[m.cat].ore !== null ? (
                          <input type="number" min={0} step={1} value={(dati.turniExtra || {})[m.id] || 0}
                            onChange={(e) => setDati({ turniExtra: { ...(dati.turniExtra || {}), [m.id]: Math.max(0, Number(e.target.value) || 0) }, schema: null })}
                            style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6" }} />
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="number" min={0} step={1} placeholder="—" value={(dati.maxTurniMese || {})[m.id] ?? ""}
                          onChange={(e) => { const v = e.target.value; const nd = { ...(dati.maxTurniMese || {}) }; if (v === "") delete nd[m.id]; else nd[m.id] = Math.max(0, Number(v) || 0); setDati({ maxTurniMese: nd, schema: null }); }}
                          style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: "1px solid #c8ccc6" }} />
                      </td>
                      <td style={{ padding: "6px 8px", color: "#5b5f59" }}>
                        {dati.schema ? `${oreAssegnateDi[m.id] || 0}h` : "—"}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#5b5f59" }}>
                        {dati.schema && CAT_INFO[m.cat].ore !== null
                          ? `${(CAT_INFO[m.cat].ore + (dati.extraOre[m.id] || 0)) - (oreAssegnateDi[m.id] || 0)}h`
                          : "—"}
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
          <div style={{ width: 480, borderLeft: "1px solid #dde0dc", background: "#fff", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "sticky", top: 0 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0ec", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Assistente AI <span style={{ fontWeight: 400, color: "#8a8f88" }}>— risponde solo se interpellata</span></div>
              <button onClick={nuovaConversazione} disabled={aiBusy} title="Svuota la chat e il registro delle azioni già eseguite" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>Nuova conversazione</button>
            </div>
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
                      else if (a.az === "dispo_aggiungi") d = `Disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno} → ${(a.sedi || []).map((s) => SEDI_BREVI[s] || s).join(", ")}${(a.blu || []).length ? ` (+ blu: ${a.blu.map((s) => SEDI_BREVI[s] || s).join(", ")})` : ""}${a.preferito ? ` ★ preferita: ${SEDI_BREVI[a.preferito] || a.preferito}` : ""}`;
                      else if (a.az === "dispo_no") d = `Segna NON disponibile: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "dispo_togli") d = `Togli disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "mmg") d = `MMG: giorno ${a.giorno} · ${a.fascia === "P" ? "pomeriggio" : "mattina"} → ${a.attivo === false ? "disattiva" : "attiva"}`;
                      else if (a.az === "ore_extra") d = `Ore da recuperare: ${a.medico} → ${a.ore}h`;
                      else if (a.az === "turni_extra") d = `Turni extra volontari: ${a.medico} → ${a.turni} turn${a.turni === 1 ? "o" : "i"} (${(a.turni || 0) * 12}h)`;
                      else if (a.az === "tetto_settimana") d = `Tetto settimanale: ${a.medico} → ${(a.maxTurni === null || a.maxTurni === undefined) ? "nessun limite" : a.maxTurni + " turni/settimana"} (settimana del giorno ${a.giorno})`;
                      else if (a.az === "tetto_mese") d = `Max turni mese: ${a.medico} → ${(a.maxTurni === null || a.maxTurni === undefined) ? "nessun limite" : a.maxTurni + " turni/mese"}`;
                      else if (a.az === "turno_pref") d = `Preferenza turno: ${a.medico} · giorno ${a.giorno} → ${(a.turno === "G" || a.turno === "N") ? `preferisce il ${a.turno === "G" ? "diurno" : "notturno"} se vince entrambi` : "rimuovi preferenza"}`;
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
              {domande.map((d, i) => {
                const giornoSett = d.giorno ? ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"][new Date(anno, mese, d.giorno).getDay()] : "";
                const contesto = d.citazione ? `ha scritto "${d.citazione}"` : (d.situazione || "");
                return (
                  <div key={i} style={{ border: "2px solid #1a5c4a", background: "#eaf5ef", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      ❓ {d.medico ? `${d.medico} ` : ""}{d.giorno ? `${d.giorno} ${MESI_IT[mese].toLowerCase()}${giornoSett ? ` (${giornoSett})` : ""}` : ""}{(d.medico || d.giorno) ? ": " : ""}{contesto}{contesto && d.domanda ? " — " : ""}{d.domanda}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => rispondiDomanda(i, "si")} disabled={aiBusy} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: "#1a5c4a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Sì</button>
                      <button onClick={() => rispondiDomanda(i, "no")} disabled={aiBusy} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid #c8ccc6", background: "#fff", cursor: "pointer", fontSize: 12 }}>No</button>
                    </div>
                  </div>
                );
              })}
              {!proposta && !domande.length && azioniRestanti && (
                <button onClick={() => chiediAI(troncato ? `[la tua risposta precedente è stata troncata per lunghezza, non è stata applicata alcuna modifica] ${ultimaDomandaRef.current}` : "continua")} disabled={aiBusy}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #1a5c4a", background: "#f0f7f4", color: "#1a5c4a", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  Continua →
                </button>
              )}
              {!proposta && !domande.length && completato && (
                <div style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #1a5c4a", background: "#eaf5ef", color: "#1a5c4a", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                  Completato ✓
                </div>
              )}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid #eef0ec", display: "flex", gap: 6 }}>
              <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chiediAI()} placeholder="Scrivi qui…" style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #c8ccc6", fontSize: 12 }} />
              <button onClick={() => chiediAI()} disabled={aiBusy} style={{ ...btn, background: "#1a5c4a", color: "#fff", border: "none", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

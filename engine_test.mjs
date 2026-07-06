
// ============ DATI SIMULAZIONE ============
// MEDICI è modificabile dall'interfaccia (tab Medici): la lista di default viene
// sovrascritta da quella salvata nello store, tramite setMediciGlobal.
// sedeContratto: OBBLIGATORIA per ogni contrattualizzato (INDET, DET38, DET24, DET12ASAP, DET12) —
// "Maniago" | "Spilimbergo", mai null per loro. Solo i senza incarico (SENZA) non hanno titolarità
// (sedeContratto sempre null). Vedi CONTEXT.md §3.1a per la regola di titolarità.
const MEDICI_DEFAULT = [
  { id: 1, nome: "ZURLO", grad: 2, cat: "DET38", sedeContratto: "Maniago" },
  { id: 2, nome: "FOSCHIANI", grad: 3, cat: "DET38", sedeContratto: "Spilimbergo" },
  { id: 3, nome: "TRIGODKO", grad: 4, cat: "DET24", sedeContratto: "Maniago" },
  { id: 4, nome: "MARTINETTI", grad: 5, cat: "DET24", sedeContratto: "Spilimbergo" },
  { id: 5, nome: "PITAU", grad: 14, cat: "DET24", sedeContratto: "Maniago" },
  { id: 6, nome: "BEKAEVA", grad: 17, cat: "DET38", sedeContratto: "Maniago" },
  { id: 7, nome: "VALERI", grad: 25, cat: "DET12ASAP", sedeContratto: "Spilimbergo" },
  { id: 8, nome: "PRESSACCO", grad: 57, cat: "DET24", sedeContratto: "Spilimbergo" },
  { id: 9, nome: "CERVESATO", grad: 63, cat: "DET38", sedeContratto: "Spilimbergo" },
  { id: 10, nome: "MORANO", grad: 72, cat: "DET12", sedeContratto: "Maniago" },
  { id: 11, nome: "DE CANDIDO", grad: 83, cat: "DET24", sedeContratto: "Spilimbergo" },
  { id: 12, nome: "MERLINO", grad: 105, cat: "DET12ASAP", sedeContratto: "Maniago" },
  { id: 13, nome: "IENGO", grad: 107, cat: "DET38", sedeContratto: "Maniago" },
  { id: 14, nome: "BERTUZZI", grad: 666, cat: "INDET", sedeContratto: "Spilimbergo" },
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
  DET38:    { label: "Det. 38h",      prio: 2, ore: 168, color: "#8a5a00", bg: "#fdf3dd" },
  DET24:    { label: "Det. 24h",      prio: 3, ore: 104, color: "#a06b00", bg: "#fef7e8" },
  DET12ASAP:{ label: "Det. 12h ASAP", prio: 3, ore: 52,  color: "#6b4c9a", bg: "#efe8f7" },
  DET12:    { label: "Det. 12h",      prio: 4, ore: 52,  color: "#4a708a", bg: "#e8eff5" },
  SENZA:    { label: "Senza inc.",    prio: 5, ore: null, color: "#5b5b6b", bg: "#eeeef2" },
};
const isDeterminato = (mid) => ["DET38", "DET24", "DET12ASAP", "DET12"].includes(byId[mid].cat);
// Contrattualizzato = ha un monte ore (tutte le categorie tranne SENZA incarico) — INDET incluso.
// Usato per la titolarità di sede (§3.1a): OBBLIGATORIA e universale tra tutti i contrattualizzati,
// non solo tra i determinati (isDeterminato resta distinto, usato altrove per il solo confronto
// tra categorie determinate).
const isContrattualizzato = (mid) => CAT_INFO[byId[mid].cat].ore !== null;

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

// Tetto di distribuzione temporale (CONTEXT.md §3.11) per un medico: il più restrittivo tra il
// monte ore implicito (arrotondato a turni da 12h — INDET≈8, DET38≈14, DET24≈9, DET12ASAP/DET12≈4
// — Math.round(debito/12): un residuo inferiore a 6h arrotonda a 0 turni in meno, un medico con
// debito residuo così piccolo è considerato esaurito ai fini del tetto e il resto va perso — non
// è un difetto da correggere, è il comportamento voluto) e l'eventuale Max turni mese dichiarato
// esplicitamente. Vale per QUALSIASI categoria, titolari inclusi (la titolarità non esonera dal
// proprio tetto — è già protetta separatamente dalla gerarchia normale finché il medico resta in
// gara, vedi più sotto). Per i senza incarico (debitoIniziale null, nessun monte ore) vale SOLO se
// un tetto è stato dichiarato esplicitamente: senza quello non esiste alcun riferimento su cui
// calcolare una distribuzione, e nessuna scatta.
function tettoDistribuzioneDi(mid, debitoIniziale, debitoExtraIniziale, maxTurniMese) {
  const capDichiarato = capMensileDi(maxTurniMese, mid);
  if (debitoIniziale === null) return capDichiarato;
  // Il monte ore implicito conta ANCHE gli eventuali turni extra volontari dichiarati (§3.10): il
  // coordinatore che approva turni extra vuole esplicitamente che il medico lavori oltre il monte
  // ore ordinario, quindi il tetto automatico deve riflettere il budget TOTALE a disposizione, non
  // solo quello ordinario — altrimenti un medico con debito ordinario azzerato apposta a favore dei
  // turni extra (extraOre negativo) si vedrebbe un tetto implicito di 0, escluso anche da quelli.
  const implicito = Math.max(0, Math.round((debitoIniziale + (debitoExtraIniziale || 0)) / 12));
  return capDichiarato !== null ? Math.min(implicito, capDichiarato) : implicito;
}

// Sceglie n indici il più possibile equidistanti tra 0 e k-1 — usato per selezionare, tra i
// turni EFFETTIVAMENTE vinti da un medico (non tra i giorni semplicemente dichiarati disponibili),
// il sottoinsieme più distanziato nel tempo da tenere quando supera il proprio tetto (§3.11).
function scegliIndiciEquidistanti(k, n) {
  if (n >= k) return Array.from({ length: k }, (_, i) => i);
  if (n <= 1) return k > 0 ? [0] : [];
  const idx = new Set();
  for (let i = 0; i < n; i++) idx.add(Math.round((i * (k - 1)) / (n - 1)));
  return [...idx].sort((a, b) => a - b);
}

// Sceglie n turni da tenere tra candidati (array di {slotKey, giorno}, in ordine cronologico) di
// un livello di sede che deve essere ridotto, tenendo conto ANCHE della distanza dai giorni già
// fissati da livelli di sede migliori (giorniFissi, §3.11) — la priorità di sede resta assoluta
// sull'equidistanza: questa funzione agisce SOLO sulla selezione dentro il livello corrente, mai
// sostituendo un turno di un livello migliore. Senza giorni di riferimento (nessun livello migliore
// fissato, o questo è l'unico/primo livello con vittorie per il medico) ricade sulla pura
// equidistanza posizionale (scegliIndiciEquidistanti), comportamento invariato. Con dei giorni di
// riferimento, sceglie greedily un turno alla volta preferendo sempre quello con la distanza minima
// (dal più vicino tra riferimento + scelte già fatte in questo livello) più ALTA possibile — un
// "farthest-point": ogni scelta si aggiunge essa stessa al riferimento per la successiva, così il
// livello si distribuisce bene sia rispetto ai livelli migliori sia al proprio interno, incastrandosi
// con essi invece di sovrapporsi. A parità di distanza, vince il candidato cronologicamente più
// vicino tra quelli rimasti (determinismo, nessuna scelta arbitraria).
function scegliConRiferimento(candidati, n, giorniFissi) {
  if (n >= candidati.length) return candidati.map((c) => c.slotKey);
  if (!giorniFissi.length) return scegliIndiciEquidistanti(candidati.length, n).map((i) => candidati[i].slotKey);
  const riferimento = [...giorniFissi];
  const rimanenti = [...candidati];
  const scelti = [];
  for (let k = 0; k < n; k++) {
    let bestIdx = 0, bestDist = -1;
    rimanenti.forEach((c, idx) => {
      const dist = Math.min(...riferimento.map((g) => Math.abs(c.giorno - g)));
      if (dist > bestDist) { bestDist = dist; bestIdx = idx; }
    });
    scelti.push(rimanenti[bestIdx].slotKey);
    riferimento.push(rimanenti[bestIdx].giorno);
    rimanenti.splice(bestIdx, 1);
  }
  return scelti;
}

// Livello della sede VERDE effettivamente vinta da un medico in un turno (1 = più desiderata),
// usato per raggruppare i turni vinti per qualità di sede prima di scegliere quali cedere in
// eccesso al proprio tetto mensile (§3.11): la priorità di sede dichiarata dal medico è ASSOLUTA
// sull'equidistanza, mai il contrario — un turno di livello migliore va sempre tenuto rispetto a
// uno di livello peggiore, anche se quest'ultimo sarebbe temporalmente più distanziato. Per un
// turno extra (nessuna sede fisica reale in gioco) si usa il livello migliore tra le sedi verdi
// dichiarate per quello slot, semplice indicatore di preferenza.
function livelloVintoDi(dispo, mid, slotKey, turno, si) {
  const v = normDispo(dispo[mid]?.[slotKey]);
  if (turno.extra) {
    if (!v.verde.length) return 1;
    return Math.min(...v.verde.map((s) => v.verdeLiv[s] || 1));
  }
  const sede = SEDI5[si];
  return v.verde.includes(sede) ? (v.verdeLiv[sede] || 1) : 1;
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
function candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    if (v.no || !(v.verde.length || v.blu.length)) return false;
    const cap = capSettimanale(dispo, m.id, wk);
    if (cap !== null && (settimanaCount[m.id]?.[wk] || 0) >= cap) return false; // tetto settimanale raggiunto
    // Blocco rigido oltre il monte ore (CONTEXT.md §3.4): un contrattualizzato che ha esaurito sia
    // il debito ordinario (monte ore + recupero) sia gli eventuali turni extra volontari non è più
    // un candidato per NESSUN turno, nemmeno se resterebbe l'unico disponibile — il turno resta
    // SCOPERTO piuttosto che essere coperto oltre il limite dichiarato. Il tetto mensile (Max
    // turni mese/distribuzione, CONTEXT.md §3.11) NON è più un filtro qui: è applicato interamente
    // in un secondo passaggio di post-elaborazione in elaboraSchema, dopo che il mese è stato
    // elaborato una prima volta con la gerarchia pura (vedi elaboraSchema per i dettagli).
    if (debiti[m.id] !== null && debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) <= 0) return false;
    return true;
  });
  const bucketDi = (m) => (debiti[m.id] === null || (debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) > 0)) ? 1 : 0;
  const conDeb = candidati.filter((m) => bucketDi(m) === 0)
    .sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || debiti[b.id] - debiti[a.id] || a.grad - b.grad);
  // "senza" = veri senza incarico + contrattualizzati che hanno esaurito monte ore+recupero ma
  // hanno ancora turni extra volontari dichiarati: competono insieme, alla pari, solo per
  // graduatoria. (I contrattualizzati completamente esauriti, senza turni extra residui, sono già
  // esclusi sopra.)
  const senza = candidati.filter((m) => bucketDi(m) === 1).sort((a, b) => a.grad - b.grad);
  return [...conDeb, ...senza]; // già in ordine di gerarchia ufficiale
}

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti e
// settimanaCount (turni già assegnati per medico/settimana) condivisi tra tutte le chiamate dello
// stesso elaboraSchema.
function elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const ordinati = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey); // già in ordine di gerarchia ufficiale
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
    }
  } else {
    // Bucket di priorità a DUE livelli (0=con debito ordinario residuo, 1=senza incarico/turni
    // extra), usato sia per il confronto fisico che per quello a distanza. I contrattualizzati
    // completamente esauriti (senza turni extra residui) non arrivano mai qui: sono già esclusi
    // da "ordinati" in candidatiOrdinati (blocco rigido oltre il monte ore, CONTEXT.md §3.4). Il
    // tetto mensile e la distribuzione temporale (§3.11) NON intervengono più qui: sono applicati
    // interamente in un secondo passaggio di post-elaborazione in elaboraSchema.
    const bucketOf = (mid) => (debiti[mid] === null || (debiti[mid] <= 0 && (debitiExtra[mid] || 0) > 0)) ? 1 : 0;
    const isTitolareDi = (mid, sede) => isContrattualizzato(mid) && byId[mid].sedeContratto === sede;
    // Confronto di priorità "vero", parametrizzato sulla sede contesa. Vale identico sia per
    // l'assegnazione fisica che per la copertura a distanza (CONTEXT.md §3.1a):
    //   titolarità sede (tra tutti i contrattualizzati, INDET incluso) → categoria → debito → graduatoria.
    const isBetterPriority = (aId, bId, sede) => {
      const ba = bucketOf(aId), bb = bucketOf(bId);
      if (ba !== bb) return ba < bb;
      if (ba !== 0) return byId[aId].grad < byId[bId].grad;
      const A = byId[aId], B = byId[bId];
      if (isContrattualizzato(aId) && isContrattualizzato(bId)) {
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
    // sede (titolarità → categoria → debito → graduatoria tra tutti i contrattualizzati).
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
    // Richiamata due volte: subito dopo FASE1, e di nuovo più sotto dopo un rebuild di slots dalla
    // fonte di verità (sedeDi) — la seconda chiamata è una verifica difensiva economica contro
    // eventuali residui ("fantasmi", §10 bug storico #1) lasciati dalla ricollocazione ricorsiva
    // della prima chiamata stessa su slots, non del tutto affidabile senza un rebuild pulito prima.
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

    // Rebuild slots da sedeDi (fonte di verità), per eliminare "fantasmi" da ricollocazioni
    // intermedie di provaFisica/correggiTitolarita.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    // Seconda passata di correzione titolarità (vedi sopra): verifica difensiva su uno slots
    // appena ricostruito pulito. Rebuild finale di slots dopo, per ripulire eventuali "fantasmi"
    // lasciati dalle ricollocazioni di questa seconda passata (stesso motivo del rebuild qui sopra).
    correggiTitolarita();
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      scalaDebito(mid, turno.ore);
      settimanaCount[mid] = settimanaCount[mid] || {};
      settimanaCount[mid][wk] = (settimanaCount[mid][wk] || 0) + 1;
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

// Aggiustamento mensile del monte ore (bilanciamento turni annui, §3.11): il monte ore BASE resta
// sempre quello di CAT_INFO, ma per DET38, DET24 e DET12/DET12ASAP viene aggiustato di ±8h/±12h in
// mesi specifici PRIMA di calcolare il debito e il tetto automatico di distribuzione — DET38 perde
// 12h (168→156h, 14→13 turni impliciti) a Febbraio/Aprile/Settembre; DET24 perde 8h (104→96h, 9→8
// turni impliciti) a Febbraio/Aprile/Settembre/Novembre; DET12 e DET12ASAP guadagnano 8h (52→60h,
// 4→5 turni impliciti) a Marzo/Maggio/Agosto/Dicembre. Compensato sugli altri mesi dell'anno: 165
// turni/anno per DET38 (9×14 + 3×13), 104 per DET24 (8×9 + 4×8), 52 per DET12/DET12ASAP (8×4 +
// 4×5). INDET non ha mai aggiustamento. "mese" è l'indice 0-based usato ovunque (Gennaio=0, MESI_IT).
const AGGIUSTAMENTO_MESE_ORE = {
  DET38: { mesi: [1, 3, 8], delta: -12 },
  DET24: { mesi: [1, 3, 8, 10], delta: -8 },
  DET12ASAP: { mesi: [2, 4, 7, 11], delta: 8 },
  DET12: { mesi: [2, 4, 7, 11], delta: 8 },
};

// Costruisce il debito ORDINARIO iniziale (prima di qualunque consumo) per ciascun medico: monte
// ore contrattuale (con l'eventuale aggiustamento mensile sopra) + ore extra di recupero dichiarate
// per il mese, null per i senza incarico (nessun monte ore). È un valore puramente statico (dipende
// solo da categoria, mese ed extraOre, mai dal consumo effettivo) — usato sia per popolare "debiti"
// a inizio elaborazione sia, invariato, per calcolare il tetto di distribuzione temporale (§3.11)
// anche dopo che il debito è stato speso.
function debitoOrdinarioIniziale(mid, extraOre, mese) {
  const cat = byId[mid].cat;
  const base = CAT_INFO[cat].ore;
  if (base === null) return null;
  const agg = AGGIUSTAMENTO_MESE_ORE[cat];
  const baseAggiustato = agg && agg.mesi.includes(mese) ? base + agg.delta : base;
  return baseAggiustato + (extraOre[mid] || 0);
}

function elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra = {}, maxTurniMese = {}) {
  const debiti0 = {};
  const debitiExtra0 = {};
  MEDICI.forEach((m) => {
    debiti0[m.id] = debitoOrdinarioIniziale(m.id, extraOre, mese);
    debitiExtra0[m.id] = debiti0[m.id] === null ? null : (turniExtra[m.id] || 0) * 12;
  });

  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  // Flat list di tutti i turni del mese, in ordine di calendario
  const voci = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    info.turni.forEach((turno) => voci.push({ d, turno, slotKey: `${info.key}|${turno.id}` }));
  }
  // Due passaggi: prima i turni con almeno un "preferito" dichiarato (in ordine cronologico
  // tra loro), poi tutto il resto (sempre in ordine cronologico) — così il debito viene
  // consumato dando la precedenza ai giorni desiderati, senza mai cambiare CHI vince un
  // conflitto (la gerarchia resta l'unico criterio decisionale). Stesso ordine usato SIA dal
  // passaggio 1 (gerarchia pura) SIA dal passaggio 2 (definitivo, §3.11) qui sotto.
  const conPref = voci.filter((v) => !v.turno.extra && slotHaPreferiti(dispo, v.slotKey));
  const resto = voci.filter((v) => v.turno.extra || !slotHaPreferiti(dispo, v.slotKey));
  const ordineVoci = [...conPref, ...resto];

  // Esegue l'intero mese, nell'ordine sopra, con eventuali esclusioni per singolo turno
  // (escludiPerSlot: slotKey -> Set<mid> forzati a "no" SOLO per quello slot specifico — non
  // tocca nessun'altra dichiarazione del medico). dopoTurno (opzionale) è richiamato subito dopo
  // ogni turno elaborato, per un eventuale conteggio live (§3.11, passaggio 2).
  function eseguiMese(debiti, debitiExtra, settimanaCount, escludiPerSlot, dopoTurno) {
    const risultati = {}; // "d|turnoId" -> turnoOut
    const avvisiRaw = []; // {d, testo}
    ordineVoci.forEach(({ d, turno, slotKey }) => {
      let dispoEff = dispo;
      const esclusi = escludiPerSlot && escludiPerSlot(slotKey);
      if (esclusi && esclusi.size) {
        dispoEff = { ...dispo };
        esclusi.forEach((mid) => {
          dispoEff[mid] = { ...dispoEff[mid], [slotKey]: { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null } };
        });
      }
      const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispoEff, debiti, debitiExtra, settimanaCount);
      risultati[`${d}|${turno.id}`] = turnoOut;
      if (avviso) avvisiRaw.push({ d, testo: avviso });
      if (dopoTurno) dopoTurno(turno, turnoOut);
    });
    return { risultati, avvisiRaw };
  }

  // ---- PASSAGGIO 1 (CONTEXT.md §3.11): gerarchia pura, nessun tetto, nessuna distribuzione ----
  // Serve SOLO da oracolo per scoprire, per ogni medico, quali turni vincerebbe naturalmente se
  // non esistesse alcun tetto — necessario perché non c'è altro modo affidabile di saperlo
  // (dipende da chi altro è disponibile, titolarità...). Scartato subito dopo l'uso: il risultato
  // REALE viene interamente dal passaggio 2 più sotto.
  const { risultati: risultatiP1 } = eseguiMese({ ...debiti0 }, { ...debitiExtra0 }, {}, null, null);

  // Tetto di distribuzione (§3.11) per ogni medico, fisso per l'intero mese: il più restrittivo
  // tra il monte ore implicito e l'eventuale Max turni mese dichiarato (null = nessun tetto,
  // possibile solo per i senza incarico senza tetto dichiarato — per loro nessuna distribuzione).
  const tetto = {};
  MEDICI.forEach((m) => { tetto[m.id] = tettoDistribuzioneDi(m.id, debiti0[m.id], debitiExtra0[m.id], maxTurniMese); });

  // Turni FISICI/EXTRA effettivamente vinti nel passaggio 1, in ordine cronologico (per giorno di
  // calendario, non per ordine di elaborazione conPref/resto), con il livello della sede verde
  // ottenuta — per medico (la copertura a distanza non conta mai ai fini del tetto mensile, come
  // per Max turni mese).
  const vintiDi = {};
  MEDICI.forEach((m) => (vintiDi[m.id] = []));
  voci.forEach(({ d, turno, slotKey }) => {
    const out = risultatiP1[`${d}|${turno.id}`];
    if (turno.extra) {
      const mid = out.slots[0];
      if (mid) vintiDi[mid].push({ slotKey, giorno: d, livello: livelloVintoDi(dispo, mid, slotKey, turno, 0) });
    } else {
      out.fis.forEach((si) => {
        const mid = out.slots[si];
        if (mid) vintiDi[mid].push({ slotKey, giorno: d, livello: livelloVintoDi(dispo, mid, slotKey, turno, si) });
      });
    }
  });

  // Per ogni medico che supera il proprio tetto: raggruppa i turni EFFETTIVAMENTE vinti per
  // livello della sede verde ottenuta (1 = più desiderata) e riempie il tetto residuo partendo
  // dal livello migliore, esaurendo interamente ogni livello prima di considerare il successivo —
  // la priorità di sede è ASSOLUTA sull'equidistanza: un livello viene anche solo toccato SOLO dopo
  // che tutti i livelli migliori sono stati riempiti per intero. Solo quando un livello non entra
  // per intero nel tetto residuo se ne sceglie il sottoinsieme da tenere: il PRIMO livello mai
  // ridotto (nessun livello migliore fissato prima) usa la pura equidistanza posizionale
  // (scegliIndiciEquidistanti, comportamento invariato); un livello successivo ridotto tiene conto
  // ANCHE della distanza dai giorni già fissati dai livelli migliori (scegliConRiferimento) — così i
  // gruppi si incastrano invece di sovrapporsi in giorni consecutivi. Il resto di quel livello e
  // tutti i livelli peggiori successivi sono interamente marcati "da cedere" (§3.11).
  const cessioniPerSlot = new Map(); // slotKey -> Set<mid> di chi cede QUEL turno specifico
  MEDICI.forEach((m) => {
    const cap = tetto[m.id];
    if (cap === null) return;
    const vinti = vintiDi[m.id];
    if (vinti.length <= cap) return;
    const perLivello = new Map();
    vinti.forEach((v) => {
      if (!perLivello.has(v.livello)) perLivello.set(v.livello, []);
      perLivello.get(v.livello).push(v); // già in ordine cronologico (vinti costruito su voci)
    });
    const livelliOrdinati = [...perLivello.keys()].sort((a, b) => a - b);
    const kept = new Set();
    const giorniFissi = []; // giorni già tenuti dai livelli migliori già processati (interi o ridotti)
    let residuo = cap;
    livelliOrdinati.forEach((liv) => {
      if (residuo <= 0) return;
      const gruppo = perLivello.get(liv);
      if (gruppo.length <= residuo) {
        gruppo.forEach((v) => { kept.add(v.slotKey); giorniFissi.push(v.giorno); });
        residuo -= gruppo.length;
      } else {
        scegliConRiferimento(gruppo, residuo, giorniFissi).forEach((slotKey) => kept.add(slotKey));
        residuo = 0;
      }
    });
    vinti.forEach(({ slotKey }) => {
      if (kept.has(slotKey)) return;
      if (!cessioniPerSlot.has(slotKey)) cessioniPerSlot.set(slotKey, new Set());
      cessioniPerSlot.get(slotKey).add(m.id);
    });
  });

  // ---- PASSAGGIO 2 (CONTEXT.md §3.11): rielaborazione pulita e DEFINITIVA ----
  // Rifà l'intero mese da zero (stato iniziale, nessun residuo dal passaggio 1) applicando le
  // cessioni decise sopra, e facendo rispettare il tetto RIGIDAMENTE per QUALUNQUE medico lo
  // raggiunga durante questo stesso passaggio — non solo a chi il passaggio 1 aveva segnalato:
  // le esclusioni cambiano le dinamiche del mese (un concorrente escluso oggi può far vincere un
  // altro medico un giorno che nel passaggio 1 non avrebbe vinto), quindi il conteggio va tenuto
  // vivo turno per turno. Il tetto non si supera MAI: se un turno ceduto non trova nessun altro
  // candidato disponibile, resta SCOPERTO (la copertura non prevale sul tetto dichiarato).
  const debiti = { ...debiti0 };
  const debitiExtra = { ...debitiExtra0 };
  const settimanaCount = {}; // mid -> { weekKey: numero di turni già assegnati quella settimana }
  const contoMensile = {};   // mid -> turni fisici/extra già confermati nel passaggio 2, finora
  MEDICI.forEach((m) => (contoMensile[m.id] = 0));
  const escludiPerSlot = (slotKey) => {
    const esclusi = new Set(cessioniPerSlot.get(slotKey) || []);
    MEDICI.forEach((m) => { if (tetto[m.id] !== null && contoMensile[m.id] >= tetto[m.id]) esclusi.add(m.id); });
    return esclusi;
  };
  const aggiornaContoMensile = (turno, turnoOut) => {
    if (turno.extra) {
      if (turnoOut.slots[0]) contoMensile[turnoOut.slots[0]]++;
    } else {
      turnoOut.fis.forEach((si) => { if (turnoOut.slots[si]) contoMensile[turnoOut.slots[si]]++; });
    }
  };
  const { risultati, avvisiRaw } = eseguiMese(debiti, debitiExtra, settimanaCount, escludiPerSlot, aggiornaContoMensile);

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
      // L'alternativa non può già aver raggiunto il proprio tetto di distribuzione (§3.11): questo
      // scambio le farebbe vincere un turno IN PIÙ quel giorno, e il tetto non si supera mai.
      const alternativa = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, targetSlotKey)
        .find((o) => o.id !== mid && !target.slots.includes(o.id) && (tetto[o.id] === null || contoMensile[o.id] < tetto[o.id]) && normDispo(dispo[o.id]?.[targetSlotKey]).verde.includes(sede));
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
      contoMensile[mid] = Math.max(0, contoMensile[mid] - 1);
      contoMensile[alternativa.id] = (contoMensile[alternativa.id] || 0) + 1;
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


export { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, isContrattualizzato, MESI_DISPONIBILI, MESI_IT, giorniTra, settimanaDi, capSettimanale };

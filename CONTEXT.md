# CONTEXT — App Turni Guardia Medica ASFO Distretto Nord

## LEGGERE PRIMA DI QUALSIASI INTERVENTO

Questo file contiene tutto il contesto necessario per lavorare sull'app senza ricominciare da capo.
**Leggi prima il file `turni-guardia-medica.jsx`, poi questo documento, prima di toccare qualsiasi cosa.**

---

## 1. CONTESTO DEL PROGETTO

App React single-file (`turni-guardia-medica.jsx`) per la gestione mensile dei turni di guardia medica del Distretto Nord ASFO (Azienda Sanitaria Friuli Occidentale). L'utente è il futuro coordinatore.

**Sedi del distretto:** Maniago (MA), Spilimbergo (SP), Meduno (ME), Claut (CL), Anduins (AN). Maniago e Spilimbergo sono le 2 "CDC" (Centri Di Coordinamento), sempre prioritarie.

L'app:
- Permette di inserire disponibilità mensili per ciascun medico: per ogni sede, un menu a tendina con **Non disponibile / Verde 1-5 (sede fisica) / Blu 1-4 (copertura a distanza)**, indisponibilità NO esplicita, preferiti
- Applica le regole di assegnazione turni (gerarchia, titolarità di sede, debito orario, graduatoria) per produrre uno schema
- Permette correzioni manuali post-elaborazione
- Esporta lo schema in Excel (.xlsx) fedele al formato reale ASFO
- Ha un assistente AI integrato (chiama `https://api.anthropic.com/v1/messages` con claude-sonnet-4-6)
- **NON usa React Router, NON usa librerie esterne** (solo React + useState/useMemo/useRef/useEffect). L'xlsx viene costruito a mano come ZIP binario.
- Anche pubblicata su GitHub Pages (`docs/`), come copia adattata senza bundler — vedi §14.

---

## 2. STRUTTURA DEL FILE (~1794 righe)

```
righe 1-113     → DATI SIMULAZIONE (MEDICI_DEFAULT con sedeContratto, byId, CAT_INFO, SEDI5, CDC, calendari)
righe 114-188   → MOTORE: normDispo, ordinaPerLivello, MAX_LIV_VERDE/BLU, giorniTra, settimanaDi, capSettimanale
righe 189-390   → MOTORE: elaboraTurno (cuore dell'algoritmo: fisica + a distanza + spaziatura + tetto settimanale)
righe 391-474   → MOTORE: elaboraSchema (orchestrazione mese, preferiti prima, poi resto)
righe 475-491   → MOTORE: sedePrimaria, notaSlot (helper post-elaborazione)
righe 492-831   → COMPONENTE REACT (parte iniziale: state, event handlers disponibilità/medici/rapido)
righe 832-1082  → EXPORT XLSX (costruito a mano come ZIP/OOXML)
righe 1083-1794 → COMPONENTE REACT (UI, AI, render)
```

**La sezione motore è pura JavaScript** (niente React hooks) — può essere estratta e testata con Node.js:
```bash
# Estrai il motore e crea engine_test.mjs per i test
python3 -c "
src = open('turni-guardia-medica.jsx').read()
end = src.index('// ============ COMPONENTE ============')
engine = src[:end].replace('import { useState, useMemo, useRef, useEffect } from \"react\";\n', '')
open('engine_test.mjs', 'w').write(engine + '\nexport { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, MESI_DISPONIBILI, MESI_IT, giorniTra, settimanaDi, capSettimanale };\n')
print('motore estratto')
"
```

---

## 3. REGOLE DI BUSINESS (IMMUTABILI — NON INTERPRETARE, NON SEMPLIFICARE)

### 3.1 Gerarchia categorie

| Priorità (prio) | Categoria | Debito mensile | Spareggio interno |
|----------|-----------|----------------|-------------------|
| 1° | INDET — Indeterminato (qualunque orario) | 96h | debito ↓ → graduatoria |
| 2° | DET36 — Determinato 36h/sett | 156h | titolarità sede → debito ↓ → graduatoria |
| 3° | DET24 — Determinato 24h/sett | 104h | titolarità sede → debito ↓ → graduatoria |
| 3° | DET12ASAP — Determinato 12h/sett ASAP | 52h | titolarità sede → debito ↓ → graduatoria |
| 4° | DET12 — Determinato 12h/sett | 52h | titolarità sede → debito ↓ → graduatoria |
| 5° | SENZA — Senza incarico | null (nessun debito) | solo graduatoria |

**INDET** sostituisce le vecchie categorie IND36/IND24 (fuse in un'unica categoria a priorità massima con un unico monte ore mensile di 96h, indipendentemente dall'orario contrattuale settimanale).

**DET24 e DET12ASAP condividono lo STESSO livello di priorità (prio 3, in `CAT_INFO`).** Non sono in relazione gerarchica tra loro — nessuna delle due batte l'altra per categoria. Uno spareggio diretto tra un DET24 e un DET12ASAP si risolve esattamente come tra due medici della stessa categoria: titolarità sede → debito residuo → graduatoria. Il monte ore mensile resta comunque diverso (104h contro 52h), perché ciascuno matura debito secondo il proprio contratto — la parità riguarda solo la priorità di categoria nel confronto, non le ore.

**DET12** è l'unica categoria "determinata" priva di priorità speciale: perde sempre contro INDET, DET36, DET24 e DET12ASAP, e batte solo i medici senza incarico. Monte ore mensile 52h (12h/sett × 52 settimane ÷ 12 mesi), come DET12ASAP.

**Regola del debito:** chi ha più debito residuo vince; a parità vince chi ha il numero di graduatoria più basso (= posizione migliore). Questo si applica SOLO all'interno dello stesso prio (quindi anche tra DET24 e DET12ASAP, che condividono prio 3).

**La categoria prevale SEMPRE finché il medico ha debito > 0.** Un INDET con un'ora di debito batte qualsiasi DET36, e così via lungo tutta la gerarchia (eccetto tra DET24 e DET12ASAP, che sono a pari livello).

**Debito esaurito (= 0 o negativo):** il medico esce dalla priorità di categoria. L'ordine di precedenza diventa:
1. contrattualizzati con debito > 0 (ordinati per cat → titolarità → debito → grad)
2. senza incarico (solo grad)
3. contrattualizzati con debito ≤ 0 (possono solo coprire turni SCOPERTI, non in conflitto)

**Recupero ore da mese precedente:** dichiarato esplicitamente al coordinatore. Aumenta il debito mensile: `debito = monte_ore + ore_recupero`. Partecipa normalmente a tutti i conflitti. NON applicabile ai senza incarico (che non hanno debito).

### 3.1a Titolarità di sede (solo determinati)

Ogni medico **determinato** (DET36, DET24, DET12ASAP o DET12 — `isDeterminato(mid)`) può avere un campo `sedeContratto`: `"Maniago"`, `"Spilimbergo"`, oppure `null` (nessuna). Non esiste per INDET o SENZA — è un concetto legato al contratto di lavoro dei soli determinati.

**Tra due determinati** in conflitto sulla sede di cui uno dei due è titolare, il titolare vince **sempre** quella sede — anche contro un determinato di categoria nominalmente superiore (es. un DET24 titolare di Maniago batte un DET36 non titolare, per Maniago). Questa regola vale **identica sia per l'assegnazione FISICA sia per la copertura A DISTANZA (blu)** — non ci sono due ordini diversi:

```
titolarità sede (per la sede contesa) → categoria → debito → graduatoria
```

La titolarità **non ha mai effetto** se uno dei due contendenti non è determinato (un INDET batte sempre un determinato titolare o no; un senza incarico perde sempre contro un determinato con debito, titolare o no) e non ha effetto se il contendente è titolare di una sede **diversa** da quella contesa.

I dati simulati (§4) hanno tutti `sedeContratto: null` — va assegnata manualmente dal coordinatore tramite la colonna "Titolarità" nel tab "3 · Medici / ore extra" quando si hanno i dati reali.

### 3.2 Sedi e scenari di copertura — sistema dichiarativo verde/blu

**REGOLA GENERALE (fondamentale): nessuna copertura è automatica.** Tutto dipende da quello che i medici dichiarano. Un medico copre al massimo **1 sola sede a distanza** — se vuole poterne coprire di più deve dichiararle esplicitamente come blu (con livelli di preferenza).

**Maniago e Spilimbergo (le 2 CDC) sono sempre le prime sedi fisiche puntate.**

| N. medici presenti | Target fisico | Copertura a distanza |
|---|---|---|
| 1 | la sede verde ottenuta (non più forzato su Maniago) | solo le sedi dichiarate blu, nell'ordine dei livelli, **massimo 1**. Il resto SCOPERTO. |
| 2 | Maniago + Spilimbergo | ciascun fisico copre al più 1 sede blu dichiarata. Conflitto sulla stessa sede blu → titolarità sede → categoria → debito → graduatoria. Sedi senza blu dichiarato → SCOPERTE. |
| 3 | Maniago + Spilimbergo + Meduno | stessa logica blu per le sedi restanti (Claut, Anduins). Sedi senza blu → SCOPERTE. |
| 4 | Maniago + Spilimbergo + Meduno + Claut | stessa logica blu per Anduins. Senza blu dichiarato → SCOPERTA. |

Con **1 solo medico**, il target fisico non è più forzato su Maniago come nella versione precedente: il medico va fisicamente dove porta la sua migliore preferenza verde (Maniago, Spilimbergo, o qualsiasi altra sede l'abbia dichiarata). Questo risolveva un bug noto della versione precedente (§7 storico).

**Non esistono più regole geografiche automatiche** ("Claut sempre da Maniago", "Anduins da SP/ME per grad") — quelle regole descrivevano il comportamento di fallback automatico del vecchio sistema piene/ripiego, ora completamente sostituito dal meccanismo dichiarativo verde/blu sopra.

### 3.3 Disponibilità — formato dati (sistema verde/blu)

```javascript
dispo[mid][slotKey] = {
  verde: ["Maniago", "Spilimbergo"],     // sedi FISICHE desiderate, in ordine di preferenza
  verdeLiv: { Maniago: 1, Spilimbergo: 2 }, // livello 1..5 per ogni sede verde
  blu: ["Meduno"],                        // sedi che è disposto a COPRIRE A DISTANZA
  bluLiv: { Meduno: 1 },                  // livello 1..4 per ogni sede blu
  no: false,                              // NO esplicito (protegge dall'inserimento rapido)
  preferito: "Maniago",                   // ★ SEDE VERDE specifica preferita per questo turno,
                                           // o null — deve essere una delle sedi in `verde` (§3.5)
}
```

**Verde (sede fisica):**
- Livelli 1..5. Livelli PARI tra più sedi rendono il medico "indifferente" ai fini della ricollocazione: il motore può spostarlo tra quelle sedi per massimizzare le coperture.
- **La parità NON rende però due sedi davvero equivalenti tra loro.** L'ordine in cui il motore le prova a parità di livello segue sempre l'ordine fisso `SEDI5` — Maniago → Spilimbergo → Meduno → Claut → Anduins — **mai** l'ordine in cui il medico le ha dichiarate. Una CDC (Maniago/Spilimbergo) pari con una sede secondaria vince quindi sempre la CDC, esattamente come se fosse un livello migliore: un medico che dichiara Maniago livello 1 e Meduno livello 1 va a Maniago, con lo stesso risultato di Maniago livello 1 + Meduno livello 2 (vedi `ordinaPerLivello` in §5).
- Livello più basso = sede che il medico ha diritto di tenere contro chiunque non lo superi in gerarchia (titolarità → categoria → debito → graduatoria tra determinati; categoria → debito → graduatoria altrimenti).
- **I livelli non cambiano MAI chi vince un conflitto.** Cambiano solo quale sede viene assegnata a ciascun vincitore, massimizzando il numero di medici al lavoro.
- Non esiste più una distinzione piena/ripiego a due livelli: verde è un'unica lista di preferenze fisiche 1-5.

**Blu (copertura a distanza):**
- Livelli 1..4 (non 5: al massimo 4 "altre" sedi da poter coprire oltre alla propria).
- Stessa regola di parità del verde: a livello blu pari tra più sedi, l'ordine di prova segue sempre `SEDI5` (Maniago → Spilimbergo → Meduno → Claut → Anduins), non l'ordine di dichiarazione — stesso helper `ordinaPerLivello` condiviso con il verde.
- Il medico deve essere **fisicamente presente** (verde) da qualche parte nello stesso turno per poter coprire una sede a distanza — un medico che dichiara solo blu (senza alcuna sede verde raggiungibile) non copre mai nulla.
- Copre al massimo **1 sola sede a distanza**, la prima disponibile nel suo ordine blu dichiarato. Se scalzato dalla sua prima scelta blu (da un medico con priorità superiore), riprova con la successiva.
- Conflitto sulla stessa sede blu tra più medici fisici: **titolarità sede → categoria → debito → graduatoria** — stessa identica gerarchia usata per l'assegnazione fisica (vedi §3.1a).
- Il blu non scalza mai una presenza fisica: può competere solo per sedi non fisicamente coperte.

**Nessuna retrocompatibilità con il vecchio formato piene/ripiego:** il salvataggio dati esistente basato su `piene`/`ripiego` non viene automaticamente convertito — è un cambio di formato deliberato (§6, punto "sistema di disponibilità"), le disponibilità già inserite vanno reinserite con il nuovo menu a tendina.

### 3.4 Meccanismo auto-bilanciante del debito

Turni elaborati in ordine cronologico (ma i turni con almeno un preferito ★ dichiarato vengono elaborati TUTTI PRIMA del resto):

```
turni_del_mese = [...conPref, ...resto]  // conPref = turni con almeno un preferito ★ dichiarato
```

Questo è critico: cambia i debiti progressivi e quindi i risultati di conflitti successivi.

A parità di debito e categoria, vince la graduatoria migliore (numero più basso).
Dopo ogni assegnazione il debito del vincitore scende. Al turno successivo a parità, l'altro medico ha più debito → vince lui. **L'equità emerge automaticamente**, con vantaggio strutturale per chi ha graduatoria migliore (vince i tie-break).

Esempio con 5 turni a parità di debito iniziale:
- A(grad3) vs B(grad124): A 1°, B 2°, A 3°, B 4°, A 5° → risultato 3-2 per A

### 3.5 Preferiti — sede specifica

Il flag ★ **preferito si attacca a una sede VERDE specifica**, non alla giornata generica: il medico dichiara "voglio questo turno preferibilmente su questa sede", marcando con ★ una delle sedi che ha già dichiarato verde per quel turno (`preferito` = nome della sede, o `null`).

- Il preferito NON decide mai chi vince un conflitto. Serve solo a garantire che il turno venga elaborato tra i primi (fase `conPref`), così il debito del medico è ancora pieno quando viene valutato — aumentando la probabilità (non la certezza) di ottenerlo. La gerarchia rimane l'unico criterio decisionale.
- **Soddisfatto se e solo se il medico ottiene fisicamente esattamente quella sede** — non una sede verde qualunque. Se ottiene una sede fisica diversa (anche se dichiarata come sua seconda scelta verde), o se non ottiene alcuna sede, il coordinatore riceve un avviso; il testo distingue i due casi ("ha ottenuto SEDEX invece" vs "non gli è stata assegnata alcuna sede").
- Un medico ha al massimo **un solo** preferito per turno: marcarne uno nuovo toglie automaticamente quello precedente (radio, non multi-selezione).
- Il preferito deve sempre riferirsi a una sede che il medico ha **attualmente** dichiarato verde per quel turno: se la sede verde viene rimossa (o cambiata in blu/non disponibile), il preferito su quella sede si azzera automaticamente.
- **Non esiste più un preferito "anche in ripiego a distanza"** (il vecchio `preferitoRip`): era ridondante col blu, dato che coprire a distanza richiede comunque una presenza fisica altrove, e comunque il preferito ora è già specifico sulla sede fisica desiderata.

### 3.6 Calendario mensile e fasi

- **Giorno 27**: invio mail richiesta disponibilità ai medici
- **Entro giorno 3** (23:59): scadenza disponibilità → regole ordinarie
- **Giorno 10**: invio primo schema
- **Entro giorno 14** (23:59): modifiche → first come, first served (niente gerarchia)
- **Giorno 15**: invio schema definitivo all'azienda

**First come, first served** si applica solo alle richieste arrivate dopo il giorno 3. Le regole ordinarie (gerarchia, debito, graduatoria) si applicano solo alle disponibilità entro il giorno 3. **Eccezione assoluta:** errori del coordinatore si correggono sempre retroattivamente.

### 3.7 Spaziatura temporale

Tra i turni disponibili di un medico, il motore preferisce **sempre** quello temporalmente più distante dall'ultimo turno FISICO già assegnato allo stesso medico. Vale sempre, non solo se il medico ha dichiarato un tetto settimanale (§3.8).

- **Non decide mai chi vince un conflitto tra medici diversi, né quale sede viene assegnata** — questo resta compito esclusivo della gerarchia normale (titolarità → categoria → debito → graduatoria) e dei livelli verdi/blu. Meccanicamente, la spaziatura agisce come un **pre-filtro sulla candidatura**, non come un criterio di gerarchia aggiuntivo: se il vincitore "naturale" di una sede ha lavorato il giorno prima (o lo stesso giorno, su un altro turno) — distanza di calendario ≤ 1 — ED esiste un altro candidato che ha dichiarato verde la STESSA sede e non ha ancora ottenuto nulla quel turno, la sede passa a quest'ultimo. Tra più alternative possibili, a decidere chi subentra è sempre e soltanto la gerarchia normale (non un ordine arbitrario).
- **Non lascia MAI una sede scoperta per questo motivo**: se non esiste alcuna alternativa valida per quella sede specifica, il medico più recente resta dov'è — la copertura vince sempre sulla spaziatura. Un'alternativa "vale" solo se ha dichiarato verde la stessa identica sede contesa; un medico presente su un'ALTRA sede non conta come alternativa.
- La distanza si misura in **giorni di calendario reali**, non nell'ordine interno di elaborazione (che può processare un turno con un preferito ★ prima di uno cronologicamente precedente — §3.4): la spaziatura calcola sempre `|data_turno - data_ultimo_assegnato|`, quindi resta corretta anche quando "ultimo assegnato" si riferisce, al momento del controllo, a una data cronologicamente successiva a quella in elaborazione.
- Automatica, non richiede alcuna dichiarazione esplicita dal medico.
- Un turno coperto **a distanza** (blu) non conta come "turno fisico" ai fini di questa regola: la distanza si misura sempre dall'ultimo posizionamento FISICO, mai da una copertura blu (che comunque avviene sempre nello stesso giorno di una presenza fisica — INV3).

### 3.8 Tetto settimanale (opzionale)

Il medico può dichiarare, per una specifica settimana (lunedì-domenica), un numero massimo di turni che vuole fare: `dispo[mid]["SETT:" + lunedì] = { maxTurni: N }` — una chiave ortogonale ai normali slotKey `"YYYY-MM-DD|ID"` (mai un turno vero e proprio, va sempre esclusa da qualunque iterazione sui turni di un medico).

- Una volta raggiunto il tetto quella settimana, il medico **non è più candidato per nessuna sede** di nessun turno rimanente della stessa settimana — è come se avesse dichiarato NO per quei turni, ma solo a partire dal momento in cui il tetto viene raggiunto (i turni della settimana già elaborati restano validi).
- **Nessuna copertura automatica di ripiego**: le sedi che sarebbero state sue restano scoperte se nessun altro medico è disponibile — coerente con la filosofia generale del sistema dichiarativo (§3.2).
- Se non dichiarato, nessun limite (comportamento invariato, retrocompatibile).
- Il tetto si applica anche ai turni **extra** (MMG mattina/pomeriggio): contano come "un turno" ai fini del conteggio.
- Impostabile dall'interfaccia nel pannello "Inserimento rapido per intervallo" (campo opzionale "Tetto turni/settimana", applicato a tutte le settimane coperte dal periodo scelto) o via assistente AI (azione `tetto_settimana`).

---

## 4. GRADUATORIA SIMULATA (dati di test — da sostituire con la reale)

```
INDET:  BERTUZZI(id1, grad0), CAMPANER(id2, grad1)
DET36:  TRIGODKO(id3, grad4), PRESSACCO(id4, grad57), GHIZZO(id5, grad91), IENGO(id6, grad107), DE MARCHI L(id7, grad130)
DET24:  FOSCHIANI(id8, grad3), BEKAEVA(id9, grad17), CERVESATO(id10, grad63), COLOSETTI(id11, grad97), WANG(id12, grad124)
SENZA:  ZURLO(id13, grad2), GRANDO(id14, grad13), PITAU(id15, grad14), DE CECCO-BEOLCHI(id16, grad20),
        MICHELI(id17, grad39), MARZANO(id18, grad45), MUNARETTO(id19, grad54), CESCO(id20, grad59),
        PARRONI(id21, grad71), MORANO(id22, grad72), DE CANDIDO(id23, grad83), SIEGA-VIGNUT(id24, grad87),
        MERLINO(id25, grad105), MARCUZZO(id26, grad109)
```

Tutti i determinati (DET36/DET24/DET12ASAP/DET12) hanno `sedeContratto: null` nei dati simulati — nessuna titolarità nota, va assegnata quando si hanno i dati reali. Nessun medico di default è DET12ASAP o DET12 (categorie disponibili ma non usate nei dati simulati).

La lista è modificabile dall'interfaccia (tab "3 · Medici / ore extra": categoria, graduatoria, titolarità di sede per i determinati) e salvata nello store persistente. In `store.medici` se presente, altrimenti `MEDICI_DEFAULT`.

---

## 5. ARCHITETTURA DEL MOTORE

### elaboraTurno (cuore)

```javascript
function elaboraTurno(d, turno, slotKey, dispo, debiti, settimanaCount, ultimoFisico) {
  // 1. Trova candidati con disponibilità valida (verde o blu) per questo slotKey, ESCLUSI quelli
  //    che hanno già raggiunto il tetto settimanale dichiarato per la settimana di questo turno
  //    (capSettimanale, §3.8) — se non dichiarato, nessuna esclusione (comportamento invariato)
  // 2. Li ordina: [conDeb (cat→deb→grad), senzaInc (grad), esaur (grad)] — ordine globale,
  //    la titolarità NON entra in questo ordinamento globale (è specifica per sede)
  // 3. FASE 1 — assegnazione fisica (verde):
  //    - target = sedi fisiche da puntare (dinamico per n=1, altrimenti MA[,SP[,ME[,CL]]])
  //    - provaFisica() — assegnazione con ricollocazione e scalzamento:
  //      - Rispetta livelli verdi (veto se livello migliore); a parità di livello l'ordine di
  //        prova segue sempre SEDI5 (Maniago→Spilimbergo→Meduno→Claut→Anduins), MAI l'ordine
  //        di dichiarazione — vedi ordinaPerLivello
  //      - Ricollocazione: se l'occupante è indifferente (pari livello), si sposta
  //      - Scalzamento: solo se il richiedente ha priorità superiore secondo isBetterPriority()
  //        (titolarità sede → categoria → debito → graduatoria tra determinati)
  //    - SPAZIATURA TEMPORALE (§3.7): per ogni vincitore fisico, se ha lavorato ieri (o oggi
  //      stesso su un altro turno — distanza di calendario ≤ 1, con Math.abs perché conPref può
  //      processare fuori ordine cronologico) ED esiste un'alternativa che ha dichiarato verde
  //      la STESSA sede e non ha ancora ottenuto nulla, la sede passa all'alternativa (decisa
  //      sempre dalla gerarchia normale tra gli alternativi). Mai una sede scoperta per questo:
  //      senza alternativa valida, il medico recente resta.
  //    - Rebuild slots da sedeDi (elimina "fantasmi" da ricollocazioni intermedie)
  //    - Scala i debiti dei fisici, incrementa settimanaCount, aggiorna ultimoFisico
  // 4. FASE 2 — copertura a distanza (blu):
  //    - Solo i FISICI di questo turno tentano, nell'ordine di ordinati
  //    - provaBlu() — stesso schema ricorsivo di bump/retry, con la STESSA isBetterPriority()
  //      usata per il fisico (titolarità sede → categoria → debito → graduatoria tra determinati)
  //    - Ogni medico copre al massimo 1 sede a distanza
  // 5. Avviso per qualunque sede (fisica o a distanza) rimasta scoperta
  // 6. Avvisi per preferiti non rispettati (valutati in elaboraSchema)
}
```

**INVARIANTI DEL MOTORE (non devono mai essere violati):**
- INV1: nessun medico fisico senza sede VERDE dichiarata per quella sede
- INV2: nessun medico con NO esplicito assegnato (né fisico né a distanza)
- INV3: coperture a distanza solo da medici fisicamente presenti nel turno, e solo su sedi che hanno dichiarato come BLU
- INV_BLU1: un medico copre al massimo 1 sede a distanza per turno
- INV_GER: nessun medico con priorità inferiore (titolarità sede → categoria → debito → grad — stessa identica gerarchia sia per il fisico che per il blu) occupa una sede che un medico con priorità superiore voleva e non ha ottenuto
- INV_SETT: nessun medico risulta fisico più volte di quante dichiarate dal proprio tetto settimanale (se dichiarato) per la settimana di quel turno

**Invarianti storiche RIMOSSE con il nuovo sistema** (non più valide, sostituite dal modello dichiarativo):
- ~~INV4: Claut a distanza viene sempre da Maniago~~ — ora dipende esclusivamente da chi dichiara blu su Claut.

### elaboraSchema (orchestratore)

```javascript
function elaboraSchema(dispo, extraOre, anno, mese, extras) {
  // Inizializza debiti: CAT_INFO[cat].ore + (extraOre[mid] || 0)
  // Inizializza settimanaCount ({}) e ultimoFisico ({}) — stato condiviso tra tutte le chiamate
  // a elaboraTurno di questo stesso elaboraSchema (§3.7, §3.8)
  // Costruisce lista turni del mese
  // ORDINE CRITICO: [...conPref, ...resto]
  //   conPref = turni dove almeno un medico ha marcato con ★ una sua sede verde (preferito != null)
  //   Questo ordine cambia i debiti progressivi — il checker di gerarchia DEVE rispettarlo
  // Chiama elaboraTurno per ogni turno nell'ordine sopra
  // Raccoglie avvisi: copertura scoperta (per sede) + preferiti non rispettati
}
```

---

## 6. FEATURE IMPLEMENTATE (tutte complete e testate)

1. **Disponibilità dicotomiche** (verde disponibile / rosso non disponibile) — visivamente 2 stati, internamente 3 (no esplicito, non specificato, disponibile)
2. **NO esplicito** — protegge l'indisponibilità dall'inserimento rapido massivo
3. **Inserimento rapido per intervallo** — compila blocchi di disponibilità (verde e/o blu) con periodi di eccezione
4. **Menu a tendina per sede** — sostituisce il vecchio ciclo a tocchi: per ogni sede, un `<select>` con Non disponibile / Verde 1-5 / Blu 1-4
5. **Sistema verde/blu** — verde = sede fisica (unificata, niente più piena/ripiego a due livelli), blu = disponibilità a coprire a distanza (nessuna copertura automatica, un medico copre al massimo 1 sede a distanza)
6. **Titolarità di sede per i determinati** — campo `sedeContratto` (Maniago/Spilimbergo/nessuna), decide i conflitti fisici tra determinati (DET36/DET24/DET12ASAP/DET12) prima della categoria
7. **Preferito su sede verde specifica** — ★ attaccato a una sede, non alla giornata; informativo, non decisionale (§3.5)
8. **Avvisi post-elaborazione** per sedi scoperte e per preferiti non rispettati
9. **Esportazione Excel** — layout identico al file reale ASFO (costruito a mano come ZIP OOXML). Sede scoperta: Maniago/Spilimbergo → cella "SCOPERTO" (maiuscolo) rossa grassetto (stile 11, emergenza); Meduno/Claut/Anduins → cella "scoperto" (minuscolo) grigio scuro `#666666` non grassetto (stile 13, neutro, sede secondaria) — mai vuota, mai rossa, per distinguere visivamente un buco su una CDC da uno su una sede minore. Etichette dei turni adattate SOLO per l'export (`ETICHETTE_EXPORT` in `buildSheetXML`, la griglia a schermo resta invariata): il diurno feriale/weekend "semplice" perde l'orario e diventa solo "DIURNO" (prefestivo e superfestivo restano con l'orario completo); le colonne MMG mattina/pomeriggio diventano "ANTICIPO DIURNO MMG e PLS 8-14" / "...14-20", con tutte e 5 le sedi mostrate (Maniago = il medico assegnato o SCOPERTO; Spilimbergo sempre SCOPERTO rosso; Meduno/Claut/Anduins sempre "scoperto" grigio, perché il turno MMG non le copre mai).
10. **Spaziatura temporale** — a parità di alternative valide, evita di assegnare due turni consecutivi allo stesso medico; non lascia mai sedi scoperte per questo (§3.7)
11. **Tetto settimanale opzionale** — il medico dichiara un massimo di turni per settimana, impostabile da UI (Rapido) o AI (§3.8)
12. **AI integrata** — conosce tutte le regole (incluse titolarità e verde/blu), può modificare disponibilità e schema tramite JSON
13. **Medici modificabili** — categoria, graduatoria e titolarità di sede modificabili dall'UI, aggiunta/rimozione medici
14. **Azzera mese con doppio tocco** — sicuro, posizionato lontano dai pulsanti di esportazione
15. **Undo/redo** — history completo di tutte le azioni
16. **Storage persistente** — `window.storage` (API Claude.ai), chiave `gm-turni-store-v3`
17. **Pubblicazione GitHub Pages** — copia in `docs/` con React/Babel vendorizzati localmente (vedi §14)
18. **Categorie DET12ASAP e DET12** — determinati 12h/sett, 52h mensili; DET12ASAP a pari priorità con DET24 (spareggio diretto per titolarità → debito → graduatoria), DET12 sotto entrambi, sopra solo ai senza incarico (§3.1)

---

## 7. FEATURE NON IMPLEMENTATE / POSSIBILI FUTURI

- Integrazione con graduatoria reale definitiva (attualmente lista simulata).
- Titolarità di sede reali per i determinati (attualmente tutte `null` nei dati simulati).
- Export del Progetto Claude per elaborare email di disponibilità → vedi prompt separato.

**Risolto nella revisione verde/blu:** lo scenario "1 medico con sede preferita SP" (il motore forzava sempre il target su Maniago) è stato corretto — ora con 1 solo medico il target fisico è dinamico e segue la sua migliore preferenza verde.

---

## 8. SUITE DI TEST (Node.js, usa engine_test.mjs estratto)

Tutti i file di test usano `import` da `./engine_test.mjs`. Devono girare **tutti verdi** dopo qualsiasi modifica al motore.

```bash
# Estrai motore (da fare dopo ogni modifica al file .jsx)
python3 -c "
src = open('turni-guardia-medica.jsx').read()
end = src.index('// ============ COMPONENTE ============')
engine = src[:end].replace('import { useState, useMemo, useRef, useEffect } from \"react\";\n', '')
open('engine_test.mjs', 'w').write(engine + '\nexport { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, MESI_DISPONIBILI, MESI_IT, giorniTra, settimanaDi, capSettimanale };\n')
"

# Lancia tutti i test
node run_tests2.mjs            # 46 test runtime (gerarchia, titolarità, scenari verde/blu, debito)
node test_preferiti2.mjs       # 13 test preferiti (sede specifica) e ordine elaborazione
node test_rapido2.mjs          # 18 test inserimento rapido, menu a tendina e protezione NO
node test_livelli_verde_blu.mjs # 11 test livelli verde 1-5 e blu 1-4
node test_stesso_cat2.mjs      # 8 test conflitti stessa categoria
node test_nuove_funzioni.mjs   # 16 test livelli verde, titolarità e medici modificabili
node test_spaziatura_settimana.mjs  # 13 test spaziatura temporale (§3.7) e tetto settimanale (§3.8)
node test_categorie_12h.mjs    # 11 test DET12ASAP e DET12 (§3.1)
node test_simulazione_completa.mjs  # ~41600 check su scenari randomici (10 semi × 17 mesi, con titolarità)
node test_simulazione_email.mjs     # simulazione leggibile di un mese intero (26 medici via "email")
```

**Il test di simulazione** (`test_simulazione_completa.mjs`) è il più importante: genera scenari casuali con tutti i 26 medici (incluse titolarità casuali) e verifica gli invarianti su ogni singolo turno.

**Quando si aggiunge un test:** scrivilo in Node.js puro (ESM, `import`), con `process.exit(0/1)` e output `✅ TUTTI I TEST SUPERATI` o `❌ N FALLITI`. Aggiungilo al blocco `# Lancia tutti i test` sopra.

---

## 9. COME VERIFICARE CHE NON HAI ROTTO NIENTE

```bash
# 1. Controlla compilazione (solo errori reali, ignora type inference)
cd /tmp && cp ../turni-guardia-medica.jsx check.tsx
npx tsc --jsx preserve --noEmit --allowJs check.tsx 2>&1 | grep -E "error TS(1[0-9]{3}|2304|2339|2552|2454)[^0-9]"
# output vuoto = ok

# 2. Verifica nessuna funzione duplicata
for fn in setSedeOpzione setNoCella setPreferitoSede toggleExtra elabora azzeraMese \
  setMedici aggiornaMedico aggiungiMedico rimuoviMedico setSlot applicaRapido \
  applicaProposta chiediAI nomeToId elaboraSchema elaboraTurno normDispo \
  ordinaPerLivello isDeterminato setMediciGlobal giorniTra settimanaDi capSettimanale; do
  n=$(grep -c "const $fn = \|function $fn(" turni-guardia-medica.jsx)
  [ "$n" != "1" ] && echo "DUPLICATA: $fn"
done

# 3. Estrai motore e lancia tutti i test
python3 -c "..."  # vedi sopra
node run_tests2.mjs && node test_preferiti2.mjs && node test_rapido2.mjs && \
  node test_livelli_verde_blu.mjs && node test_stesso_cat2.mjs && \
  node test_nuove_funzioni.mjs && node test_spaziatura_settimana.mjs && \
  node test_categorie_12h.mjs && \
  node test_simulazione_completa.mjs && node test_simulazione_email.mjs

# 4. Se si tocca turni-guardia-medica.jsx, rigenera anche docs/app.jsx (copia GitHub Pages) —
#    vedi §14 per le 3 modifiche minime da riapplicare dopo la copia.
```

---

## 10. BUG NOTI E STORICI (risolti)

Questi bug sono stati trovati e corretti durante lo sviluppo. Se riappaiono è una regressione.

1. **Phantom slot bug** — la ricollocazione ricorsiva lasciava un "fantasma" in `slots` non corrispondente a `sedeDi`. Fix: rebuild di `slots` da `sedeDi` dopo tutti i passaggi.

2. **delete sedeDi[occ] prematuro** — in `provaFisica()`, il `delete sedeDi[occ]` avveniva dopo la ricollocazione riuscita, cancellando la nuova sede dell'occupante. Fix: `provaFisica()` usa `maxLiv` per permettere/negare la ricollocazione, e gestisce correttamente il ripristino.

3. **normDispo con oggetti residui di formati legacy** — rompeva silenziosamente il motore. Fix: `normDispo` normalizza sempre a `{verde, verdeLiv, blu, bluLiv, no, preferito}`.

4. **Meduno a distanza usava il solo grad invece della gerarchia completa** (bug storico del vecchio sistema automatico, non più applicabile: nel sistema verde/blu ogni copertura a distanza è dichiarativa e il conflitto usa sempre categoria→titolarità→debito→graduatoria).

5. **Livello blu oltre il cap (5) su un elenco max 4** — `ordinaPerLivello` con `maxLivello=4` ignora silenziosamente un livello 5 mai raggiunto dal ciclo `for l=1..maxLivello`: comportamento corretto e verificato da test dedicato, ma da tenere a mente se si costruiscono dati di test blu manualmente (livelli validi: 1-4, non 1-5 come per verde).

---

## 11. CONVENZIONI DI CODICE

- Il file è un **single-file React component** — non spezzarlo in più file.
- Nessuna libreria esterna (niente axios, date-fns, lodash, ecc.).
- Il motore (funzioni prima di `// ============ COMPONENTE ============`) è **puro JavaScript** senza hooks React.
- I tipi di TypeScript NON sono usati — il file è `.jsx`. Il compilatore tsc serve solo per rilevare errori sintattici reali (filtro su codici TS1xxx, TS2304, TS2339, TS2552, TS2454).
- Lo storage usa `window.storage` (API specifica di Claude.ai artifacts) — NON usare `localStorage`.
- Le chiamate API ai modelli usano `fetch("https://api.anthropic.com/v1/messages")` senza API key (gestita da Claude.ai).

---

## 12. COME SEGNALARE E CORREGGERE UN BUG

**Per un bug concettuale (comportamento sbagliato):**
1. Scrivi un test Node.js che riproduce il caso atteso e verifica che fallisce
2. Identifica la funzione del motore responsabile (quasi sempre `elaboraTurno`, `provaFisica` o `provaBlu`)
3. Correggi rispettando gli invarianti (§5) e la gerarchia titolarità→categoria→debito→graduatoria (fisica) / categoria→titolarità→debito→graduatoria (distanza)
4. Rilancia tutti i test — zero fallimenti prima di considerare il fix completo

**Template test minimo:**
```javascript
import { MEDICI, byId, CAT_INFO, SEDI5, dk, elaboraSchema } from './engine_test.mjs';
const base = () => { const d={}; MEDICI.forEach(m=>d[m.id]={}); return d; };
const N = (g) => `${dk(2026,7,g)}|N`;
const disp = (v=[], b=[]) => ({ verde:v, verdeLiv:{}, blu:b, bluLiv:{}, no:false, preferito:null });
// ... test case ...
```

**Per modificare il motore:** lavora SOLO sulle funzioni tra riga 109 e 418 (vedi §2). La UI non dovrebbe mai contenere logica di assegnazione.

---

## 13. PROMPTS E SISTEMI ESTERNI

**Assistente AI nell'app** — usa il system prompt in `chiediAI`. Conosce tutte le regole di business (gerarchia, titolarità, debito), il formato JSON per modificare disponibilità (verde/blu) e schema. Il prompt è nel codice e può essere aggiornato.
- Modello `claude-sonnet-4-6`, `max_tokens: 16000`.
- Sezione `STILE DI RISPOSTA E LIMITI` nel prompt: massimo 3-4 azioni per risposta, output entro 2000 token. Se l'utente chiede più modifiche di quante ne stiano in un round, l'AI ne esegue solo le prime 3-4 e indica nella "spiegazione" quante azioni restano — l'utente prosegue con round successivi finché non ne restano.
- Errori HTTP dalla chiamata a `api.anthropic.com` (`!resp.ok`): mostrato in chat il messaggio completo restituito da Anthropic (`error.type` + `error.message`, più `request_id` se presente), non più un messaggio generico fisso.

**Progetto Claude separato** — esiste un prompt di sistema separato (fuori da questa app) per processare email di disponibilità e produrre un file Excel. Non è nel file `.jsx`.

---

## 14. GITHUB PAGES (docs/)

`docs/` contiene una copia pubblicabile su GitHub Pages, poiché il progetto non usa bundler:
- `docs/index.html` — carica React 18, ReactDOM 18 e Babel standalone da `docs/vendor/` (vendorizzati localmente, nessuna dipendenza da CDN esterni), trasforma `docs/app.jsx` nel browser al volo
- `docs/app.jsx` — copia di `turni-guardia-medica.jsx` con 3 modifiche minime, non comportamentali, da riapplicare dopo ogni copia dal file root:
  1. `import { useState, ... } from "react"` → `const { useState, ... } = React;` (nessun bundler, React è un global)
  2. `export default function App()` → `function App()`, con `ReactDOM.createRoot(document.getElementById("root")).render(<App />);` aggiunto in fondo al file
  3. Rimozione di un cast TypeScript orfano `(e as any)` → `e` (era un no-op a runtime, ma Babel standalone senza preset TypeScript non riesce a parsarlo)

**Limiti su GitHub Pages** (non modificabili, solo da tenere presenti): l'assistente AI e lo storage persistente (`window.storage`) sono pensati per l'ambiente artifact di Claude.ai — su Pages falliscono silenziosamente (try/catch), quindi l'app funziona ma senza quelle due funzionalità.

Abilitazione: Settings → Pages → Deploy from a branch → branch del progetto, cartella `/docs` (passo manuale una tantum).

---

*Ultimo aggiornamento: luglio 2026. File app: turni-guardia-medica.jsx (~1646 righe).*

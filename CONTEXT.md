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

## 2. STRUTTURA DEL FILE (~2500 righe)

```
righe 1-113     → DATI SIMULAZIONE (MEDICI_DEFAULT con sedeContratto, byId, CAT_INFO, SEDI5, CDC, calendari)
righe 114-182   → MOTORE: normDispo, ordinaPerLivello, MAX_LIV_VERDE/BLU, giorniTra, settimanaDi, capSettimanale
righe 184-217   → MOTORE: turnoPrefDi, candidatiOrdinati (preferenza turno §3.9 + turni extra §3.10 + estrazione candidati condivisa)
righe 219-427   → MOTORE: elaboraTurno (cuore dell'algoritmo: fisica + a distanza + spaziatura + tetto settimanale + turni extra §3.10)
righe 429-563   → MOTORE: elaboraSchema (orchestrazione mese, preferiti prima, poi resto, poi preferenza turno §3.9)
righe 564-580   → MOTORE: sedePrimaria, notaSlot (helper post-elaborazione)
righe 581-... (nota: numeri di riga oltre questo punto non aggiornati a ogni modifica UI — usa grep per i marker esatti) → COMPONENTE REACT (state, event handlers, EXPORT XLSX, UI, AI, render)
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
2. senza incarico, oppure contrattualizzati esauriti con turni extra volontari residui (§3.10) — competono insieme, solo per grad
3. **blocco rigido**: un contrattualizzato che ha esaurito sia il debito ordinario (monte ore + recupero) sia gli eventuali turni extra volontari **non è più un candidato per nessun turno**, nemmeno se resterebbe l'unico disponibile — il turno resta SCOPERTO piuttosto che essere coperto oltre il limite dichiarato. Le sue ore assegnate nel mese non possono mai superare monte ore + recupero + turni extra dichiarati.

*(Storico: prima di questa regola un esaurito senza turni extra poteva ancora coprire un turno se restava l'unico candidato disponibile, per non lasciarlo scoperto — comportamento cambiato dopo un bug segnalato in cui un medico finiva con ore assegnate ben oltre il proprio monte ore. Vedi `candidatiOrdinati` in §5: il filtro iniziale esclude ora esplicitamente questi medici da "candidati", non solo dall'ordinamento di priorità.)*

**Recupero ore da mese precedente:** dichiarato esplicitamente al coordinatore. Aumenta il debito mensile: `debito = monte_ore + ore_recupero`. Partecipa normalmente a tutti i conflitti. NON applicabile ai senza incarico (che non hanno debito).

### 3.1a Titolarità di sede (solo determinati)

Ogni medico **determinato** (DET36, DET24, DET12ASAP o DET12 — `isDeterminato(mid)`) può avere un campo `sedeContratto`: `"Maniago"`, `"Spilimbergo"`, oppure `null` (nessuna). Non esiste per INDET o SENZA — è un concetto legato al contratto di lavoro dei soli determinati.

**Tra due determinati** in conflitto sulla sede di cui uno dei due è titolare, il titolare vince **sempre** quella sede — anche contro un determinato di categoria nominalmente superiore (es. un DET24 titolare di Maniago batte un DET36 non titolare, per Maniago). Questa regola vale **identica sia per l'assegnazione FISICA sia per la copertura A DISTANZA (blu)** — non ci sono due ordini diversi:

```
titolarità sede (per la sede contesa) → categoria → debito → graduatoria
```

La titolarità **non ha mai effetto** se uno dei due contendenti non è determinato (un INDET batte sempre un determinato titolare o no; un senza incarico perde sempre contro un determinato con debito, titolare o no) e non ha effetto se il contendente è titolare di una sede **diversa** da quella contesa.

I dati simulati (§4) hanno tutti `sedeContratto: null` — va assegnata manualmente dal coordinatore tramite la colonna "Titolarità" nel tab "3 · Medici / ore da recuperare" quando si hanno i dati reali.

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

**Mesi disponibili e calcolo di festivi/prefestivi (calendario perpetuo)**: `MESI_DISPONIBILI` copre da Agosto 2026 a Dicembre 2036 (125 mesi). `FESTIVI_MAP`/`PREFESTIVI` non sono più hardcoded: `festiviFissiDi(anno)` genera per qualsiasi anno le festività fisse italiane (1 gennaio, 6 gennaio, 25 aprile, 1 maggio, 2 giugno, 15 agosto, 1 novembre, 8 dicembre, 25 dicembre, 26 dicembre) **più il 31 dicembre — festivo a sé stante per ASFO, non un festivo nazionale italiano ma incluso esplicitamente in `festiviFissiDi` per questo motivo** — più Pasqua/Pasquetta calcolate con `pasquaDi(anno)` (algoritmo di Gauss, verificato contro valori noti: 2026→5 aprile, 2027→28 marzo, 2024→31 marzo). `FESTIVI_MAP` è la fusione di `festiviFissiDi` per gli anni 2026-2037 (l'anno 2037 extra serve solo a calcolare correttamente eventuali prefestivi a cavallo d'anno). `PREFESTIVI` è calcolato automaticamente come il giorno immediatamente precedente a ogni data in `FESTIVI_MAP`: il 30 dicembre è quindi sempre prefestivo del 31 dicembre (non il 31 dicembre stesso, che è festivo con etichetta "SUPERFESTIVO" — il flag `festivo` ha sempre priorità sul flag `prefestivo` nell'etichetta di `turniDelGiorno`, quindi il 31 dicembre mostra "SUPERFESTIVO" anche se tecnicamente rientra anche nel calcolo generico di "giorno precedente a un festivo" rispetto al Capodanno successivo — nessun conflitto, la priorità è esplicita nel codice).

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

### 3.9 Preferenza di turno (diurno ☀️ / notturno 🌙), solo giorni con entrambi i turni

Il medico può dichiarare, per un giorno che ha SIA il diurno (G) SIA il notturno (N) — cioè weekend, festivi e prefestivi, gli unici con entrambi — quale dei due preferisce mantenere se li vince ENTRAMBI fisicamente lo stesso giorno: `dispo[mid]["TURNOPREF:" + dataStr] = "G" | "N"` — una chiave ortogonale ai normali slotKey `"YYYY-MM-DD|ID"` (come `"SETT:"`, va sempre esclusa da qualunque iterazione sui turni di un medico, incluso lo stato serializzato per l'assistente AI).

- **Decide SOLO quale dei due turni il medico mantiene se li vince entrambi** — non cambia mai CHI vince un conflitto, non anticipa l'elaborazione, e non decide quale sede riceve. Se il medico vince solo uno dei due turni, la preferenza è un no-op.
- **Non lascia MAI una sede scoperta per questo motivo**: se non esiste un'alternativa valida per il turno NON preferito (nessun altro medico ha dichiarato verde la stessa sede su quel turno), il medico resta assegnato a entrambi — la copertura vince sempre, esattamente come per la spaziatura temporale (§3.7).
- **Perché serve, non basta la spaziatura temporale**: nella spaziatura ordinaria, tra i due turni dello stesso giorno viene sempre considerato "a rischio" quello elaborato per SECONDO — normalmente il notturno, dato che il diurno è sempre elaborato prima (§5). Ma un ★ preferito marcato sul notturno lo sposta nella fase conPref, facendolo elaborare PRIMA del diurno (§3.4) — invertendo quale dei due la spaziatura considera "a rischio": senza una preferenza di turno esplicita, il medico finirebbe per mantenere il notturno e perdere il diurno che invece preferiva (il caso reale che ha motivato la funzionalità). La preferenza di turno **prevale sempre** su questo effetto collaterale dell'ordine conPref/resto: se il medico ha dichiarato di voler mantenere PROPRIO il turno che la spaziatura vorrebbe cedere, la spaziatura non lo tocca; il turno non preferito (se ancora assegnato a lui dopo tutta l'elaborazione del mese) viene liberato a favore della stessa identica gerarchia usata per la spaziatura (categoria → debito → graduatoria, tramite `candidatiOrdinati`, condivisa con `elaboraTurno`).
- Impostabile dal popup di disponibilità (icone ☀️/🌙 accanto al toggle Disponibile/Non disponibile, visibili solo nei giorni con entrambi i turni) oppure via assistente AI (azione `turno_pref`, vedi §13).

### 3.10 Turni extra volontari (oltre il monte ore)

Il coordinatore può dichiarare, per ciascun medico contrattualizzato (non per i senza incarico, che non hanno un concetto di monte ore), un numero di **turni extra volontari** per il mese: `dati.turniExtra[mid] = N` (tab "3 · Medici / ore da recuperare", campo "Turni extra", accanto alle ore extra di recupero). Ogni turno vale sempre 12 ore, quindi il budget in ore è `N × 12`.

- **Pool separato dal debito ordinario**: le ore extra di recupero (`extraOre`) si sommano al monte ore contrattuale — il medico compete con **piena priorità di categoria** finché quel totale (monte + recupero) non è esaurito, esattamente come oggi. I turni extra volontari sono un budget **completamente distinto**, consumato SOLO dopo che monte ore + recupero raggiungono zero.
- **Priorità durante i turni extra**: mentre il budget extra è disponibile (e il debito ordinario è esaurito), il medico compete con la **stessa priorità di un senza incarico** — spareggio SOLO per graduatoria, mai per categoria. Nella pratica, in `candidatiOrdinati` ed `elaboraTurno` viene inserito nello stesso bucket dei senza incarico veri, ordinato insieme a loro puramente per `grad`.
- **Dopo aver esaurito anche il budget extra**, il medico torna al comportamento di "debito esaurito" (§3.1): **blocco rigido**, non è più un candidato per nessun turno, nemmeno per coprire uno slot altrimenti completamente scoperto.
- **Non cambia mai la gerarchia per chi ha ancora debito ordinario positivo**: un medico in bucket 0 (categoria con debito residuo) batte SEMPRE un medico che sta usando i turni extra, indipendentemente dal grad di quest'ultimo — i turni extra non sono mai una scorciatoia per superare la priorità di categoria.
- Implementato con un secondo accumulatore parallelo a `debiti`, chiamato `debitiExtra` (mid → ore residue del budget extra, `null` per i senza incarico), inizializzato in `elaboraSchema` da `turniExtra[mid] × 12` e passato sia a `elaboraTurno` sia a `candidatiOrdinati`. Lo scalo avviene tramite l'helper `scalaDebito` in `elaboraTurno`: se `debiti[mid] > 0` scala il debito ordinario, altrimenti scala `debitiExtra[mid]` — mai entrambi per lo stesso turno. La copertura a distanza (blu) non consuma né l'uno né l'altro pool, coerentemente con la regola generale (§3.2).
- `elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra = {})`: il nuovo parametro è **opzionale** (default `{}`, nessun turno extra) — tutte le chiamate esistenti restano valide senza modifiche.

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

La lista è modificabile dall'interfaccia (tab "3 · Medici / ore da recuperare": categoria, graduatoria, titolarità di sede per i determinati) e salvata nello store persistente. In `store.medici` se presente, altrimenti `MEDICI_DEFAULT`.

---

## 5. ARCHITETTURA DEL MOTORE

### elaboraTurno (cuore)

```javascript
function elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount, ultimoFisico) {
  // 1. Trova candidati con disponibilità valida (verde o blu) per questo slotKey, ESCLUSI quelli
  //    che hanno già raggiunto il tetto settimanale dichiarato per la settimana di questo turno
  //    (capSettimanale, §3.8) — se non dichiarato, nessuna esclusione (comportamento invariato) —
  //    ED ESCLUSI i contrattualizzati con debito ordinario e turni extra ENTRAMBI esauriti
  //    (blocco rigido oltre il monte ore, §3.1/§3.4): non sono più candidati per nessun turno,
  //    nemmeno se resterebbero l'unico disponibile, il turno resta SCOPERTO.
  // 2. Li ordina: [conDeb (cat→deb→grad), senzaInc+turniExtra (grad)] — ordine globale, la
  //    titolarità NON entra in questo ordinamento globale (è specifica per sede). Un
  //    contrattualizzato con debito esaurito ma con debitiExtra[mid] > 0 (turni extra volontari
  //    residui, §3.10) rientra nel bucket "senza incarico" (è già filtrato fuori se anche i turni
  //    extra sono esauriti, vedi punto 1).
  //    Scala il debito del vincitore con scalaDebito(mid, ore): se debiti[mid] > 0 scala il
  //    debito ordinario, altrimenti scala debitiExtra[mid] — mai entrambi per lo stesso turno.
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
  //      senza alternativa valida, il medico recente resta. ECCEZIONE (§3.9): se la distanza è
  //      esattamente 0 (stesso giorno: caso G/N) e il medico ha dichiarato una preferenza di
  //      turno che combacia con questo turno, la spaziatura non lo tocca — la preferenza esplicita
  //      prevale sull'euristica generica.
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
function elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra = {}) {
  // Inizializza debiti: CAT_INFO[cat].ore + (extraOre[mid] || 0)
  // Inizializza debitiExtra: (turniExtra[mid] || 0) × 12 — budget separato, §3.10 (turniExtra è
  // opzionale, default {}: tutte le chiamate esistenti restano valide senza modifiche)
  // Inizializza settimanaCount ({}) e ultimoFisico ({}) — stato condiviso tra tutte le chiamate
  // a elaboraTurno di questo stesso elaboraSchema (§3.7, §3.8)
  // Costruisce lista turni del mese
  // ORDINE CRITICO: [...conPref, ...resto]
  //   conPref = turni dove almeno un medico ha marcato con ★ una sua sede verde (preferito != null)
  //   Questo ordine cambia i debiti progressivi — il checker di gerarchia DEVE rispettarlo
  // Chiama elaboraTurno per ogni turno nell'ordine sopra
  // PREFERENZA TURNO (§3.9): dopo che TUTTO il mese è elaborato, per ogni giorno con G e N,
  // per ogni medico che vince fisicamente ENTRAMBI e ha dichiarato una preferenza, libera il
  // turno non preferito a favore della stessa gerarchia (candidatiOrdinati, ora anche debitiExtra-
  // aware) — se un'alternativa esiste. Storna/scala lo stesso pool (debiti o debitiExtra) che il
  // turno aveva effettivamente consumato per ciascuno, in base al segno corrente di debiti[mid]
  // (identica logica di scalaDebito). Eseguita in un passaggio a parte, dopo l'intero ciclo
  // conPref+resto, perché deve conoscere l'esito di entrambi i turni dello stesso giorno
  // indipendentemente da quale dei due è stato elaborato per primo.
  // Raccoglie avvisi: copertura scoperta (per sede) + preferiti non rispettati
}
```

---

## 6. FEATURE IMPLEMENTATE (tutte complete e testate)

1. **Disponibilità dicotomiche** (verde disponibile / rosso non disponibile) — visivamente 2 stati, internamente 3 (no esplicito, non specificato, disponibile)
2. **NO esplicito** — protegge l'indisponibilità dall'inserimento rapido massivo
3. **Inserimento rapido per intervallo** — compila blocchi di disponibilità (verde e/o blu) con periodi di eccezione
4. **Menu a tendina per sede** — sostituisce il vecchio ciclo a tocchi: per ogni sede, un `<select>` con Non disponibile / Sede principale 1-5 / Copertura a distanza 1-4 (etichette solo UI: `verde`/`blu` restano i nomi interni nel motore — vedi §3)
5. **Sistema verde/blu** — verde = sede fisica (unificata, niente più piena/ripiego a due livelli), blu = disponibilità a coprire a distanza (nessuna copertura automatica, un medico copre al massimo 1 sede a distanza)
6. **Titolarità di sede per i determinati** — campo `sedeContratto` (Maniago/Spilimbergo/nessuna), decide i conflitti fisici tra determinati (DET36/DET24/DET12ASAP/DET12) prima della categoria
7. **Preferito su sede verde specifica** — ★ attaccato a una sede, non alla giornata; informativo, non decisionale (§3.5)
8. **Avvisi post-elaborazione** per sedi scoperte e per preferiti non rispettati — `dati.avvisi` continua a essere generato dal motore e inviato all'assistente AI (`stato.avvisiScenari`), ma dalla UI non è più visualizzato: la sezione "⚠ Avvisi — richieste da fare ai medici" nel tab Schema turni è stata rimossa (era troppo dispersiva)
9. **Esportazione Excel** — layout identico al file reale ASFO (costruito a mano come ZIP OOXML). Sede scoperta: Maniago/Spilimbergo → cella "SCOPERTO" (maiuscolo) rossa grassetto (stile 11, emergenza); Meduno/Claut/Anduins → cella "scoperto" (minuscolo) grigio scuro `#666666` non grassetto (stile 13, neutro, sede secondaria) — mai vuota, mai rossa, per distinguere visivamente un buco su una CDC da uno su una sede minore. Questo vale anche quando un'ALTRA sede dello stesso turno è coperta (es. scenario 1 con un solo medico fisico su una sede diversa da Maniago): Maniago/Spilimbergo mostrano comunque "SCOPERTO" invece di una cella vuota (bug corretto — in precedenza il ramo `t.slots.some(Boolean)` di `buildSheetXML` gestiva l'assenza di medico solo per Meduno/Claut/Anduins, lasciando Maniago/Spilimbergo senza testo in quel caso). Etichette dei turni adattate SOLO per l'export (`ETICHETTE_EXPORT` in `buildSheetXML`, la griglia a schermo resta invariata): il diurno feriale/weekend "semplice" perde l'orario e diventa solo "DIURNO" (prefestivo e superfestivo restano con l'orario completo); le colonne MMG mattina/pomeriggio diventano "ANTICIPO DIURNO MMG e PLS 8-14" / "...14-20", con tutte e 5 le sedi mostrate (Maniago = il medico assegnato o SCOPERTO; Spilimbergo sempre SCOPERTO rosso; Meduno/Claut/Anduins sempre "scoperto" grigio, perché il turno MMG non le copre mai).
10. **Spaziatura temporale** — a parità di alternative valide, evita di assegnare due turni consecutivi allo stesso medico; non lascia mai sedi scoperte per questo (§3.7)
11. **Tetto settimanale opzionale** — il medico dichiara un massimo di turni per settimana, impostabile da UI (Rapido) o AI (§3.8)
12. **AI integrata** — conosce tutte le regole (incluse titolarità e verde/blu), può modificare disponibilità e schema tramite JSON
13. **Medici modificabili** — categoria, graduatoria e titolarità di sede modificabili dall'UI, aggiunta/rimozione medici
14. **Azzera mese con doppio tocco** — sicuro, posizionato lontano dai pulsanti di esportazione
15. **Undo/redo** — history completo di tutte le azioni
16. **Storage persistente** — `window.storage` (API Claude.ai), chiave `gm-turni-store-v3`
17. **Pubblicazione GitHub Pages** — copia in `docs/` con React/Babel vendorizzati localmente (vedi §14)
18. **Categorie DET12ASAP e DET12** — determinati 12h/sett, 52h mensili; DET12ASAP a pari priorità con DET24 (spareggio diretto per titolarità → debito → graduatoria), DET12 sotto entrambi, sopra solo ai senza incarico (§3.1)
19. **Preferenza di turno stesso giorno (☀️/🌙)** — solo nei giorni con diurno e notturno: decide quale dei due il medico mantiene se li vince entrambi, prevalendo sull'effetto collaterale dell'ordine conPref/resto sulla spaziatura temporale; impostabile dal popup di disponibilità o via assistente AI (azione `turno_pref`) (§3.9)
20. **Colonne "Ore assegnate" / "Ore mancanti" nel tab Medici** — sola lettura, visibili solo dopo l'elaborazione dello schema del mese ("—" altrimenti). "Ore assegnate" = somma delle ore dei turni in cui il medico compare FISICAMENTE nello schema elaborato (stessa logica di scalo del debito nel motore — la copertura a distanza non consuma ore proprie, coerente con `elaboraTurno`), contato UNA SOLA VOLTA per turno anche se lo stesso medico compare in più sedi fisiche dello stesso turno (bug corretto: l'editor manuale `setSlot` nel tab Schema turni riassegna `slots` ma non aggiorna mai `fis`, quindi una correzione manuale può in teoria lasciare lo stesso medico su 2 sedi fisiche dello stesso turno — `oreAssegnateDi` deduplica con un `Set` per evitare di contare le sue ore due volte). "Ore mancanti" = monte ore + ore extra − ore assegnate; per i medici senza incarico (nessun monte ore) mostra sempre "—", anche a schema elaborato. Calcolate interamente lato UI da `dati.schema` — nessuna modifica al motore
21. **Pulsante "Nuova conversazione" nel pannello AI** — azzera chat, proposta in sospeso e registro anti-loop `azioniEseguite` (§13) senza dover ricaricare la pagina
22. **Turni extra volontari** — campo "Turni extra" nel tab Medici (accanto alle ore extra di recupero): budget separato dal debito ordinario, consumato SOLO dopo aver esaurito monte ore + recupero, con priorità da senza incarico (solo graduatoria) (§3.10)
23. **Blocco rigido oltre il monte ore (fix bug)** — un contrattualizzato con debito ordinario e turni extra ENTRAMBI esauriti non è più un candidato per nessun turno, nemmeno se resterebbe l'unico disponibile: il turno resta SCOPERTO invece di essere assegnato oltre il limite dichiarato (§3.1). Prima di questo fix un medico rimasto l'unico candidato disponibile per molte notti consecutive continuava a essere assegnato ben oltre il proprio monte ore (bug segnalato: 228h assegnate su un monte ore di 96h). Filtro applicato in `candidatiOrdinati`, `bucketOf` semplificato di conseguenza (§5)
24. **Selettore diretto mese/anno nell'header** — accanto alle frecce ‹/› (che restano per il caso d'uso "mese successivo/precedente"), un `<select>` con tutti i 125 mesi di `MESI_DISPONIBILI` (Agosto 2026 – Dicembre 2036) permette di saltare direttamente a qualunque mese senza cliccare ripetutamente le frecce. Stato invariato (`meseIdx`), nessuna nuova variabile — l'`onChange` chiama semplicemente `setMeseIdx(Number(e.target.value))`. Testato in browser (Playwright): 125 opzioni presenti, range corretto, salto diretto a un mese lontano (Marzo 2029) verificato visivamente.

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
node test_preferenza_turno.mjs # 13 test preferenza di turno stesso giorno G/N (§3.9)
node test_turni_extra.mjs      # 7 test turni extra volontari oltre il monte ore (§3.10)
node test_simulazione_completa.mjs  # ~306500 check su scenari randomici (10 semi × 125 mesi, agosto 2026-dicembre 2036, con titolarità)
node test_simulazione_email.mjs     # simulazione leggibile di un mese intero (26 medici via "email")
```

**Il test di simulazione** (`test_simulazione_completa.mjs`) è il più importante: genera scenari casuali con tutti i 26 medici (incluse titolarità casuali) e verifica gli invarianti su ogni singolo turno.

**Quando si aggiunge un test:** scrivilo in Node.js puro (ESM, `import`), con `process.exit(0/1)` e output `✅ TUTTI I TEST SUPERATI` o `❌ N FALLITI`. Aggiungilo al blocco `# Lancia tutti i test` sopra.

---

## 8bis. TEST AUTOMATICO DEL PROMPT AI (email simulate contro l'API reale)

A differenza della suite sopra (pura, deterministica, offline), questo harness testa il **prompt di sistema** di `chiediAI` (interpretazione email dei medici) chiamando davvero l'API Anthropic. È diviso in tre file indipendenti:

- **`test_email_generator.mjs`** — genera un corpus di 1250 email simulate in italiano su 26 categorie (sedi fisiche, copertura a distanza, indisponibilità/ferie, recupero ore in ore e in turni, turni extra in tutte le varianti, MMG/PLS attivo e non attivo, weekend ambiguo, notti esplicite, condizionali, contraddizioni, senza-incarico con richieste improprie, sede non identificabile, date vaghe, tetto settimanale, preferenza turno), con un RNG seedato (mulberry32, seed fisso) per riproducibilità totale. Ogni caso ha un `atteso`: azioni che devono comparire, azioni che NON devono mai comparire (`azioniVietate`, usato per testare le regole di protezione come senza-incarico + recupero/turni-extra), domande Sì/No attese o vietate, avvisi 🔴 ATTENZIONE attesi. Girato da solo scrive `test_email_corpus.json` (non committato, vedi `.gitignore`).
- **`test_email_runner.mjs`** — **estrae il prompt "sys" direttamente dal sorgente** di `turni-guardia-medica.jsx` (stesso principio di sezionamento di `engine_test.mjs`, cercando il marker `const sys = \`` fino a `STATO ATTUALE: ${JSON.stringify(stato)}\`;`) e lo compila con `new Function`, così il test resta sempre sincronizzato col prompt reale senza copie manuali. Per ogni caso costruisce lo `stato` JSON esatto e chiama `api.anthropic.com/v1/messages` (richiede `ANTHROPIC_API_KEY` in env o in un `.env` locale MAI committato). Ha una **guardia di sicurezza**: oltre 20 casi richiede il flag esplicito `--yes` (altrimenti si ferma con un avviso di costo), più un flag `--dry-run` che valida solo il rendering dei prompt senza fare alcuna chiamata di rete. Supporto a `--limit N` (run di prova), `--concurrency N` (default 6), salvataggio incrementale ogni 50 casi. Scrive `test_email_results.json` (non committato).
  - **Modalità Message Batches API** (`--batch-submit`, `--batch-status <id>`, `--batch-fetch <id>`) — ~50% più economica dell'API sincrona, consigliata per corpus grandi. `--batch-submit` costruisce tutte le richieste (stessi prompt renderizzati dallo stesso `renderSys`), le invia in un'unica chiamata a `/v1/messages/batches` e salva lo stato locale (mapping custom_id → caso, necessario per ricostruire i risultati) in `test_email_batch_state.json` (non committato). Il batch è asincrono lato Anthropic: `--batch-status` interroga i conteggi senza costo, `--batch-fetch` scarica il risultato (JSONL da `results_url`) solo quando `processing_status === "ended"` e lo UNISCE per id nel file risultati esistente (preserva gli esiti già presenti per i casi non inclusi in quel batch). Flag `--retry-failed <file>` (usabile sia in modalità sincrona sia batch): filtra il corpus ai soli casi che in quel file di risultati avevano `erroreRete`, per ripetere a basso costo solo ciò che è fallito (es. per credito esaurito a metà run). **Guardia**: `--batch-status`/`--batch-fetch` senza un batch_id valido come argomento successivo generano un errore esplicito invece di ricadere silenziosamente sul flusso sincrono — durante lo sviluppo un id dimenticato ha fatto ripartire per un attimo il flusso normale (quasi un'altra run reale accidentale, vedi nota di sicurezza sotto).
- **`test_email_report.mjs`** — legge i risultati e verifica ogni caso con un matcher **strutturale/parziale** (non uguaglianza esatta sull'intero JSON): un'azione attesa deve comparire con i campi discriminanti giusti, un'azione vietata non deve mai comparire, domande/avvisi attesi devono essere presenti. Produce: % di successo globale, breakdown per categoria, pattern di errore ricorrenti (categoria × tipo errore, es. "azione_vietata", "domanda_mancante", "avviso_mancante"), suggerimenti euristici precompilati per le categorie più delicate, e in coda il dettaglio di ogni fallimento. Output sia a console sia su `test_email_report.md` (non committato). Flag opzionale `--ai-suggestions` (richiede anch'esso `ANTHROPIC_API_KEY`): fa una chiamata finale in più per suggerimenti in prosa scritti dall'AI a partire dai fallimenti reali, invece della sola euristica.

```bash
node test_email_generator.mjs                  # genera test_email_corpus.json (1250 casi)
node test_email_runner.mjs --dry-run            # verifica il rendering dei prompt, ZERO chiamate API
node test_email_runner.mjs --limit 20           # run di prova economica (sotto la soglia --yes)
node test_email_runner.mjs --yes                # run completa sull'intero corpus (a pagamento)
node test_email_report.mjs                      # report di verifica semantica + suggerimenti

# Modalità Message Batches API (~50% più economica), utile anche per ripetere solo i casi
# falliti (es. per credito esaurito a metà run precedente):
node test_email_runner.mjs --batch-submit --retry-failed test_email_results.json --yes
node test_email_runner.mjs --batch-status <batch_id>     # nessun costo, interroga i conteggi
node test_email_runner.mjs --batch-fetch <batch_id>      # solo a batch "ended": unisce i risultati
```

Nota di sicurezza: durante lo sviluppo di questo harness, importare `test_email_runner.mjs` senza controllarne l'entry point ha innescato una run reale accidentale — per questo il file ha una guardia esplicita (`main()` parte solo se eseguito come CLI diretta, mai se importato come modulo) e la soglia `--yes` sopra descritta.

---

## 9. COME VERIFICARE CHE NON HAI ROTTO NIENTE

```bash
# 1. Controlla compilazione (solo errori reali, ignora type inference)
cd /tmp && cp ../turni-guardia-medica.jsx check.tsx
npx tsc --jsx preserve --noEmit --allowJs check.tsx 2>&1 | grep -E "error TS(1[0-9]{3}|2304|2339|2552|2454)[^0-9]"
# output vuoto = ok

# 2. Verifica nessuna funzione duplicata
for fn in setSedeOpzione setNoCella setPreferitoSede setTurnoPref toggleExtra elabora azzeraMese \
  setMedici aggiornaMedico aggiungiMedico rimuoviMedico setSlot applicaRapido \
  applicaProposta applicaAzioni riepilogoDi rispondiDomanda nomeToId elaboraSchema elaboraTurno normDispo \
  ordinaPerLivello isDeterminato setMediciGlobal giorniTra settimanaDi capSettimanale \
  turnoPrefDi candidatiOrdinati oreAssegnateDi scalaDebito chiediAI estraiJsonBilanciato \
  pasquaDi festiviFissiDi; do
  n=$(grep -c "const $fn = \|function $fn(" turni-guardia-medica.jsx)
  [ "$n" != "1" ] && echo "DUPLICATA: $fn"
done

# 3. Estrai motore e lancia tutti i test
python3 -c "..."  # vedi sopra
node run_tests2.mjs && node test_preferiti2.mjs && node test_rapido2.mjs && \
  node test_livelli_verde_blu.mjs && node test_stesso_cat2.mjs && \
  node test_nuove_funzioni.mjs && node test_spaziatura_settimana.mjs && \
  node test_categorie_12h.mjs && node test_preferenza_turno.mjs && node test_turni_extra.mjs && \
  node test_simulazione_completa.mjs && node test_simulazione_email.mjs

# 4. Se si tocca turni-guardia-medica.jsx, rigenera anche docs/app.jsx (copia GitHub Pages) —
#    vedi §14 per le 2 modifiche minime da riapplicare dopo la copia.
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

**Per modificare il motore:** lavora SOLO sulle funzioni tra riga 114 e 555 (vedi §2). La UI non dovrebbe mai contenere logica di assegnazione.

---

## 13. PROMPTS E SISTEMI ESTERNI

**Assistente AI nell'app** — usa il system prompt in `chiediAI`. Conosce tutte le regole di business (gerarchia, titolarità, debito), il formato JSON per modificare disponibilità (verde/blu) e schema. Il prompt è nel codice e può essere aggiornato.
- Modello `claude-sonnet-5`, `max_tokens: 16000`.
- **Sezione `CALENDARIO PERPETUO — GIORNO DELLA SETTIMANA E FESTIVITÀ`** (subito dopo `REGOLA TEMPORALE FONDAMENTALE`): istruisce esplicitamente l'AI a NON affidarsi alla memoria per calcolare che giorno della settimana cade una data — usa la congruenza di Zeller passo per passo (formula completa nel prompt, risultato 0=sabato...6=venerdì), l'elenco delle festività fisse italiane (incluso il 31 dicembre, festivo a sé per ASFO — non nazionale, ma allineato a `festiviFissiDi`, §3.6, per cui il prompt precisa esplicitamente che il 30, non il 31, è il suo prefestivo), e l'algoritmo di Gauss per Pasqua/Pasquetta (stessa formula usata in `pasquaDi`, §3.6, così prompt e motore calcolano lo stesso identico calendario). Valido per qualsiasi anno, nessun limite temporale. Aggiunta dopo un bug segnalato: l'AI aveva generato la domanda "vuoi aggiungere anche il diurno?" per un giorno feriale (deducendo male il giorno della settimana a memoria) — vedi anche il rinforzo "WEEKEND AMBIGUO" più sotto in questa stessa lista. Il 31 dicembre è stato aggiunto in un secondo momento, dopo aver verificato che il motore lo trattava già come festivo ma il prompt no (disallineamento tra i due, corretto qui).
- **Regola sull'ambito di "seSi"/"seNo" (bug "domande multiple")**: le azioni di una domanda Sì/No devono riguardare ESCLUSIVAMENTE il giorno e il medico di quella specifica domanda — rispondere Sì o No non deve mai inserire disponibilità per altri giorni menzionati altrove nella stessa email originale, anche se sembrano casi analoghi. Ogni domanda è un'unità isolata. Aggiunta dopo un bug segnalato in cui la risposta a una domanda aveva effetto anche su giorni non esplicitamente coperti da quella domanda.
- **Italiano semplice, senza gergo tecnico**: il prompt istruisce l'AI a scrivere sempre in "spiegazione"/"testo" come parlerebbe un collega, mai termini interni ("round", "azioni", "az", "slot", "array", "state", "JSON"). Esempio guida nel prompt: invece di "Fatte 8 di 10 azioni" → "Ho inserito 8 disponibilità su 10, continua per le restanti" (la parola concreta si adatta al contenuto reale: disponibilità, turni, modifiche, preferenze...). L'esempio "Fatte X di Y" nella sezione limiti round è stato aggiornato di conseguenza.
- **Sezione `INTERPRETAZIONE EMAIL DISPONIBILITÀ`** nel prompt (sostituita per intero con una versione molto più estesa fornita dall'utente): raccolta esaustiva, per categoria, delle frasi italiane più comuni usate dai medici nelle email di disponibilità, con l'azione da produrre per ciascuna. Categorie coperte: sedi fisiche prima scelta/verde livello 1 (arrivo diretto, preferenza esplicita, disponibilità diretta, esclusività, motivazioni contestuali); sedi fisiche seconda/terza scelta/verde livello 2-3 — SEMPRE verdi, mai blu (alternative esplicite, accettazione di sede alternativa, necessità/emergenza, indifferenza tra sedi, gradazione implicita); copertura a distanza/blu (solo frasi che esplicitano chiaramente l'assenza fisica); indisponibilità/NO esplicito (ferie/assenze programmate, giorni singoli diretti, caso speciale mattina/sera → NO solo su G o solo su N); disponibilità generica su tutte le sedi pari; turni diurno/notturno (entrambi, solo notturno, solo diurno, e il caso "weekend ambiguo" — medico non specifica G o N → inserisce SOLO il notturno e aggiunge sempre un avviso "🔴 ATTENZIONE: [nome] giorno [X] non ha specificato diurno o notturno — inserito solo notturno. Verificare con il medico se intendeva anche il diurno."; questo caso e il relativo avviso valgono SOLO per weekend/festivi/prefestivi, che hanno sia G che N — il prompt precisa esplicitamente che NON si applicano mai ai feriali semplici, che hanno solo il notturno: lì non esiste alcuna ambiguità da segnalare perché il diurno non esiste in quel giorno); MMG/PLS (turni separati dagli ordinari, sempre dichiarati esplicitamente dal medico — REGOLA GENERALE che precede ogni sotto-caso: prima di inserire QUALSIASI turno MMG con `dispo_aggiungi`, anche quando la frase sembra mappare direttamente a un turno ("MMG mattina" → M), va sempre controllato `mmgAttivi` nello STATO ATTUALE per verificare che quel turno sia attivo proprio quel giorno; se non lo è, mai un inserimento silenzioso, sempre una "domanda" Sì/No: "MMG mattina"/"mattutino MMG"/"MMG 8-14"/"PLS mattina" → turno M; "MMG pomeriggio"/"MMG 14-20"/"PLS pomeriggio" → turno P; "faccio il diurno MMG" senza specificare mattina/pomeriggio → sia M che P se entrambi attivi quel giorno, altrimenti solo quello attivo; "copro il [giorno]" SENZA menzionare MMG/PLS → notturno ordinario, non un MMG; "mattina/pomeriggio/diurno del X" senza dire MMG o PLS → controlla `mmgAttivi` nello STATO ATTUALE (elenca i giorni con turni MMG/PLS attivi, es. "g15:M", "g15:P", "g15:MP"): se il giorno ha un MMG attivo corrispondente lo inserisce, altrimenti ignora la frase perché nei feriali il diurno ordinario non esiste); recupero ore (→ azione `ore_extra`; se espresso in TURNI invece che in ore — es. "ho 4 turni da recuperare" — conversione automatica senza chiedere conferma: ore = turni × 12); casi da segnalare al coordinatore SENZA inserire nulla (sede non identificabile, date vaghe, condizionali/incerti, contraddizioni, informazioni insufficienti) con avviso "🔴 ATTENZIONE: [descrizione] per [medico] — non ho inserito nulla per questo punto. Verificare con il medico prima di procedere.". Il prompt istruisce l'AI ad applicare il principio più vicino per analogia per le frasi non elencate. Gli avvisi "🔴 ATTENZIONE" (sia turni ambigui che casi da segnalare) sono l'UNICA eccezione al limite di ~20 parole della "spiegazione" (vedi sopra): vanno scritti per intero anche se la allungano.
- **WEEKEND AMBIGUO — rinforzo anti-feriale (bug segnalato dall'utente)**: l'AI aveva generato la domanda "vuoi aggiungere anche il diurno?" per un medico su un giorno feriale semplice (giovedì, solo notturno) — la regola di esclusione feriali esisteva già in fondo alla sezione ma non veniva sempre rispettata. Rinforzata spostando il controllo (giorno feriale → sezione non applicabile) in cima, PRIMA degli esempi, con un caso concreto lavorato (giovedì 7 agosto) invece che solo una regola astratta; il paragrafo "🔴 ATTENZIONE ALLA DIFFERENZA" ora specifica esplicitamente "per i soli weekend/festivi/prefestivi"; l'avviso finale è ripetuto con l'introduzione "RIPETUTO PERCHÉ CRITICO" e un invito a ricontrollare il giorno della settimana in caso di dubbio prima di generare la domanda. Nessuna modifica di logica — è un rinforzo di prompt engineering (ripetizione + esempio concreto), dato che l'informazione sul giorno della settimana non è nello STATO ATTUALE ma dedotta dall'AI dalla conoscenza generale del calendario. Copertura di test: nuova categoria `feriale_no_domanda_diurno` (30 casi) in `test_email_generator.mjs`, stessa identica frase ambigua della categoria `weekend_ambiguo` ma su un giorno feriale — verifica che NON venga mai generata alcuna domanda né inserito il diurno.
- **MMG/PLS — "sedi" non può mai essere vuoto (fix bug trovato con `test_email_report.mjs`)**: un test su 1200+ email simulate ha rivelato che l'AI produceva spesso `dispo_aggiungi` con `"sedi":[]` per i turni MMG (M/P) quando l'email non indicava alcuna sede — un'azione sintatticamente valida ma verificata (contro il motore reale) come funzionalmente INERTE: senza almeno una sede in `verde`, `candidatiOrdinati` esclude il medico dai candidati e il turno resta scoperto, nonostante il coordinatore veda "disponibilità inserita" in chat. Aggiunta una seconda regola generale nella sezione MMG E PLS, subito dopo quella su `mmgAttivi`: se la sede è indicata nell'email o comunque inequivocabile dal contesto, usala; altrimenti NON inserire alcuna azione e genera l'avviso "🔴 ATTENZIONE: sede MMG non specificata per [nome] giorno [X] — verificare con il medico." Copertura di test: categoria `mmg_attivo` in `test_email_generator.mjs` aggiornata per includere sempre una sede nell'email e verificare `sedi` non vuoto nell'atteso; nuova categoria `mmg_sede_non_specificata` (20 casi) che verifica esplicitamente il nuovo ramo di ambiguità.
- Sezione `STILE DI RISPOSTA E LIMITI` nel prompt: NESSUN limite fisso al numero di azioni per risposta (storico: 3-4 → 3 → 8 → 15 → rimosso), "spiegazione" limitata a una frase breve, vietato citare/ripetere per esteso il testo incollato dall'utente. La regola ora è di completezza per medico: l'AI inserisce SEMPRE tutte le disponibilità di un medico nello stesso round, non le spezza mai a metà tra due round. Solo se la richiesta è così ampia da rischiare di superare il budget di token, l'AI dà priorità a completare interi medici per round (mai un medico a metà), indica nella "spiegazione" solo il conteggio in italiano semplice, e imposta il campo strutturato opzionale `"altreAzioniRestanti":true` nella risposta JSON di tipo "modifiche" (default false/omesso). Il fallback dopo una risposta troncata (vedi sotto) resta più conservativo, a 2 azioni, per non rischiare un nuovo troncamento.
- **Sezione `REGOLA GENERALE: MEMORIA TRA ROUND`** nel prompt: le informazioni dichiarate da un medico nell'email/messaggio originale valgono per TUTTI i round della conversazione, non solo il primo — un'indisponibilità (ferie, NO esplicito, impegno) resta valida finché non viene esplicitamente ritirata dal medico, e va ricontrollata PRIMA di ogni inserimento di disponibilità in qualsiasi round successivo, anche molti round dopo. "Dal X al Y" (ferie/assenze) include sempre X, Y e tutti i giorni intermedi. I NO espliciti (`dispo_no`) vengono già tracciati in `azioniGiaEseguite` esattamente come le disponibilità positive — nessuna modifica di codice necessaria: `dispo_no` ha già `medico`+`giorno`+`turno` come qualunque altra azione, quindi rientra automaticamente nello stesso filtro di `applicaProposta` che popola sia il riepilogo compatto in chat sia il registro (§13).
- **Pulsante "Continua →"**: quando l'ultima risposta ha `altreAzioniRestanti:true`, appare automaticamente un pulsante nella chat (visibile solo a proposta risolta, cioè dopo Conferma o Annulla — mai insieme al riquadro di conferma azioni, per evitare di passare al round successivo prima che quello corrente sia stato applicato). Un click invia `"continua"` come messaggio successivo senza bisogno di digitarlo. Stato `azioniRestanti` (booleano), azzerato a ogni nuovo invio e ricalcolato dalla risposta che arriva.
- **Anti-loop multi-round**: il prompt istruisce esplicitamente l'AI a controllare la cronologia della conversazione prima di proporre azioni — una sua "PROPOSTA: ..." seguita da qualunque messaggio diverso da "Proposta annullata, nessuna modifica applicata" (quindi anche "Modifiche applicate ✓" o "Applicata con avvisi: ...") indica azioni già applicate con successo, da non riproporre mai più nei round successivi (nemmeno riformulate). Solo un annullamento esplicito rende quelle azioni ripetibili. Corregge un bug osservato in produzione in cui l'AI, su "continua", riproponeva le stesse modifiche già confermate invece di procedere con quelle nuove.
- **`stato.disponibilitaPresenti`**: checklist essenziale (per OGNI medico, anche con array vuoto) di quali slot giorno+turno hanno già una disponibilità inserita (di qualsiasi tipo, incluso NO) — solo "g15G"/"g16N" ecc., senza dettagli di contenuto (quelli sono già in `stato.disponibilita`). Aggiunta perché la sola cronologia della chat non bastava a evitare il loop: l'AI ora ha una fonte di verità direttamente confrontabile con una richiesta o email incollata (aggiornata ad ogni round in base a quanto realmente salvato in `dati.dispo`, non a quanto l'AI *pensa* di aver proposto) per determinare con certezza cosa manca ancora.
- **Riepilogo compatto in "Modifiche applicate ✓"**: `applicaProposta` ora costruisce, dalle azioni appena confermate, un promemoria di una riga tipo "Modifiche applicate ✓ — BERTUZZI: g1G g1N g2G · WANG: g5N (annullabile con ↶)." — raggruppa per medico i token "g{giorno}{turno}" delle azioni che hanno sia `medico` che `giorno`+`turno` (dispo_aggiungi/dispo_no/dispo_togli/turno_pref/schema con medico non null); azioni senza questa tripla (mmg, ore_extra, tetto_settimana, elabora) non compaiono nel riepilogo. Solo nel caso di successo pieno (non nel ramo "Applicata con avvisi: ...").
- **`azioniEseguite` (registro anti-loop di sessione)**: state React puro (array di stringhe "MEDICO g{giorno}{turno}"), MAI persistito su storage — esiste solo durante la conversazione AI corrente. Popolato dopo ogni conferma con successo (stesse azioni del riepilogo compatto sopra, appiattite in singole voci). Inviato all'AI ad ogni round come `stato.azioniGiaEseguite`, con nota nel prompt che lo indica come fonte di verità più affidabile della cronologia della chat per l'anti-loop (§13, aggiornata anche la sezione `STILE DI RISPOSTA E LIMITI`): qualunque tripla medico+giorno+turno lì presente è definitivamente già applicata e non va mai riproposta. Azzerato (insieme a `aiMsgs`, `proposta`, `domande`, `azioniRestanti`, `troncato`, `completato`, `aiInput`) dal pulsante **"Nuova conversazione"** nell'header del pannello AI.
- **Refactor `applicaAzioni`/`riepilogoDi`**: la logica di applicazione delle azioni (il grande `forEach` su tutti gli `az` possibili) e la costruzione del riepilogo compatto/registro sono state estratte da `applicaProposta` in due funzioni condivise — `applicaAzioni(azioni)` (applica un elenco di azioni a `dati` e ritorna `{errori, dispoModificata, daElaborare}`) e `riepilogoDi(azioni)` (ritorna `{riepilogo, nuoveVociRegistro}`) — così da poterle riusare identiche anche per le "domande" Sì/No (vedi sotto), senza duplicare codice.
- **Domande Sì/No dell'AI**: per le ambiguità con una scelta binaria chiara (entrambe le risposte corrispondono a un'azione concreta e ben definita — es. attivare o no un turno MMG mancante, aggiungere o no il diurno su un weekend non specificato), l'AI usa il nuovo campo opzionale `"domande"` nella risposta JSON di tipo "modifiche" (può coesistere con "azioni", o essere l'unico contenuto della risposta se non ci sono azioni dirette): `{"giorno":11,"medico":"MARZANO","citazione":"vorrei fare la mattina MMG l'11","domanda":"Vuoi attivare questo turno?","seSi":[...azioni...],"seNo":[]}`. `"citazione"` è OBBLIGATORIA: la frase esatta scritta dal medico nel testo incollato (non un riassunto), così il coordinatore vede subito il contesto originale. In `"citazione"`/`"domanda"` il prompt vieta esplicitamente abbreviazioni o codici interni (niente "g11"/"g8N"/"MA"/"SP": sempre "giorno 11"/"notturno"/"Maniago"/"Spilimbergo" per esteso). Per il caso specifico "MMG richiesto ma non attivo" la domanda è SEMPRE la formulazione standard "Vuoi attivare questo turno?" — mai un avviso testuale, senza eccezioni — con `seSi` che attiva il turno MMG e inserisce la disponibilità, `seNo` sempre vuoto (nessuna azione, non si inserisce nemmeno l'altro turno). La UI (`domande.map` nel pannello AI) renderizza ogni card come `❓ {medico} {giorno} {mese in minuscolo} ({giorno della settimana}): ha scritto "{citazione}" — {domanda}` (giorno della settimana calcolato al volo con `new Date(anno, mese, d.giorno).getDay()`, non richiede stato aggiuntivo). Per le ambiguità SENZA un'azione concreta definibile (sede non identificabile, date vaghe, condizionali, contraddizioni) l'AI continua a usare il testo "🔴 ATTENZIONE" nella spiegazione (invariato).
  - **Precedenza esplicita "notti"/"notturni" sulla domanda weekend-ambiguo**: il prompt chiarisce che la domanda "Aggiungo anche il diurno?" si fa SOLO quando il medico non menziona affatto il turno (né diurno né notturno). Se usa esplicitamente parole come "notti"/"notturni"/"notturno"/"la notte" (sezione SOLO NOTTURNO), quella è già una scelta di turno dichiarata: si inserisce direttamente e silenziosamente solo il notturno, senza generare alcuna domanda.
  - Stato `domande` (array, accumulato — non sovrascritto — a ogni round, per non perdere domande di round precedenti non ancora risposte).
  - UI: ogni domanda appare come una card propria (formato esatto sopra) con due pulsanti **Sì**/**No**, sotto l'eventuale riquadro di conferma della proposta.
  - `rispondiDomanda(idx, risposta)`: applica `seSi` o `seNo` tramite `applicaAzioni`/`riepilogoDi` (stessa logica di `applicaProposta`), aggiunge un messaggio di conferma in chat, rimuove la domanda risposta dall'elenco.
  - Il pulsante "Continua →" e il banner "Completato ✓" ora richiedono anche `domande.length === 0` (oltre a `!proposta`): tutte le domande in sospeso vanno risolte prima di procedere al round successivo o considerare il giro concluso.
- **Turni extra volontari (§3.10) — integrazione AI completa**: `stato.medici` include ora `turniExtra` (valore già dichiarato per il mese, 0 se non impostato — l'AI lo controlla prima di sovrascriverlo con una nuova azione, stessa nota già esistente per `oreExtra`). Nuova azione `{"az":"turni_extra","medico":"...","turni":N}` (12h ciascuno, 0 per azzerare, solo medici con contratto), gestita in `applicaAzioni` con lo stesso schema di `ore_extra`. Nuova sottosezione `TURNI EXTRA VOLONTARI` in `INTERPRETAZIONE EMAIL DISPONIBILITÀ` (contenuto fornito dall'utente): dichiarazione diretta o condizionale con numero esplicito → azione `turni_extra`; rifiuto esplicito → azione `turni_extra` con `turni:0`; dichiarazione generica SENZA numero → nessuna azione, avviso "🔴 ATTENZIONE: [nome] è disponibile per turni extra ma non ha specificato quanti — chiedere conferma prima di inserire."; frasi ambigue (es. "sono a disposizione") → ignorate, interpretate come disponibilità ordinaria.
- **Medico senza incarico: recupero ore e turni extra non si applicano (a livello di prompt, non di motore)**: sia in `RECUPERO ORE` sia in `TURNI EXTRA VOLONTARI` una regola in testa alla sezione impone all'AI di controllare `categoria` in `stato.medici` — se è "Senza inc.", non usare mai `ore_extra` né `turni_extra` per quel medico (qualunque cosa scriva sull'argomento), e segnalare invece un avviso "🔴 ATTENZIONE: [nome] è senza incarico e non ha monte ore contrattuale, ore da recuperare/turni extra non si applicano." Nessuna modifica al motore: `elaboraSchema` tratta già `debiti`/`debitiExtra` come `null` per i senza incarico indipendentemente da `extraOre`/`turniExtra` residui (nessun errore mai sollevato in quel punto); questa è solo una guardia lato AI per evitare che vengano proposte azioni prive di senso su questi campi.
- **Gestione risposta troncata**: se la risposta dell'API si interrompe per limite di token (`data.stop_reason === "max_tokens"`) prima di completare il JSON, `JSON.parse` fallisce e NESSUNA azione di quel round è stata applicata. In questo caso l'app non mostra il fallback generico (testo grezzo): mostra un messaggio esplicito ("risposta troncata... nessuna modifica applicata") e forza comunque `azioniRestanti:true` (stato `troncato`), così il pulsante "Continua →" appare anche se il modello non ha potuto impostare `altreAzioniRestanti` da sé. In questo caso specifico il click NON invia `"continua"` (che presupporrebbe azioni già applicate da proseguire) ma rinvia la richiesta ORIGINALE dell'utente (salvata in `ultimaDomandaRef`, non aggiornata quando si invia un `testoForzato`) preceduta da un prefisso che spiega al modello che il round precedente va rifatto da capo, non proseguito — il prompt istruisce l'AI a ripeterla con massimo 2 azioni. Come rete di sicurezza aggiuntiva, anche quando il parsing riesce, `eTroncato` forza comunque `azioniRestanti:true` indipendentemente da cosa ha impostato il modello.
- **Cronologia mai troncata**: `chiediAI` invia SEMPRE l'intera conversazione (`aiMsgs`) all'API, non solo gli ultimi messaggi — il testo incollato dall'utente (email dei medici, disponibilità, ecc.) resta nel contesto per tutti i round successivi, anche su conversazioni lunghe con molti round.
- `chiediAI(testoForzato)` accetta un parametro opzionale: se assente usa `aiInput` (flusso normale, Invio/Invia), altrimenti invia direttamente il testo passato (usato dal pulsante "Continua").
- Errori HTTP dalla chiamata a `api.anthropic.com` (`!resp.ok`): mostrato in chat il messaggio completo restituito da Anthropic (`error.type` + `error.message`, più `request_id` se presente), non più un messaggio generico fisso.
- **Il JSON grezzo non deve MAI apparire in chat**: tre reti di sicurezza in `chiediAI`. (1) Se `JSON.parse(testo)` fallisce, prima di arrendersi si prova `estraiJsonBilanciato(testo)` — funzione dedicata (COMPONENTE, subito prima di `App()`) che cerca ogni "{" nel testo e ne segue la profondità delle graffe (rispettando le stringhe tra virgolette) fino alla sua chiusura, provando il parse di ogni candidato finché uno risulta un oggetto con un campo "tipo" valido. È più robusta della vecchia ricerca "prima { ultima }": quella si rompeva se il modello anteponeva un preambolo di testo contenente a sua volta graffe (es. notazione matematica come "h = (...) mod 7" nei calcoli del calendario perpetuo, §13) — caso reale che ha causato un leak di JSON grezzo in chat, corretto sia qui sia nel prompt (vedi sotto). (2) Se il parse riesce ma `obj.tipo` non corrisponde a nessun formato riconosciuto (es. "modifiche" con `azioni` vuoto/mancante) — prima il codice mostrava `testo`, cioè il JSON grezzo già validato: ora mostra `obj.spiegazione` o `obj.testo` se presenti, altrimenti un messaggio generico ("Non ho capito bene la richiesta, puoi riformulare?"). (3) Se anche l'estrazione fallisce, il testo residuo NON viene mai mostrato se contiene un solo carattere "{" in qualunque punto (non più solo se l'intero testo inizia e finisce con una graffa, controllo troppo permissivo che lasciava passare un misto testo-libero + JSON) — si sostituisce con "Non sono riuscito a interpretare la risposta, riprova."
- **Il prompt non deve mai istruire l'AI a "mostrare i passaggi" di un ragionamento**: la sezione `CALENDARIO PERPETUO` (§3.6/§13) diceva inizialmente di eseguire il calcolo di Zeller "mostrando i passaggi a te stesso nel ragionamento" — il modello ha preso questo alla lettera e ha scritto un preambolo visibile in chat (a volte letteralmente etichettato "Ragionamento interno (non mostrato all'utente)", pensando erroneamente che esistesse un canale nascosto), violando "RISPONDI SOLO con JSON, senza testo fuori dal JSON". Corretto specificando esplicitamente che il calcolo va fatto SOLO mentalmente, che non esiste alcun canale nascosto, e che qualunque testo scritto (anche etichettato come "interno") è comunque visibile all'utente; rinforzata la stessa istruzione anche nella riga "RISPONDI SOLO con un oggetto JSON valido" più in basso nel prompt.
- Le chiavi ortogonali `"SETT:"` e `"TURNOPREF:"` (§3.8, §3.9) sono escluse dallo stato `disponibilita` serializzato per l'AI (non hanno il formato di uno slotKey).
- `stato.medici` include anche `oreAssegnate`/`oreMancanti` per medico (stessi valori mostrati nel tab Medici — §6 punto 20): `null` se lo schema non è ancora elaborato; `oreMancanti` è `null` anche per i senza incarico (nessun monte ore).
- `stato.preferenzeTurno` elenca le preferenze di turno stesso giorno già dichiarate (§3.9), leggibile e impostabile dall'AI tramite l'azione `turno_pref` (valida solo sui giorni con sia diurno che notturno — l'AI segnala se richiesta su un giorno feriale semplice invece di impostarla).
- **Banner "Completato ✓"**: solo visivo, non cliccabile. Compare (`!proposta && completato`) subito dopo aver confermato (`applicaProposta`) un round che NON ha altre azioni in sospeso (`!azioniRestanti` al momento della conferma) — segnala che il giro di modifiche, anche multi-round, è terminato. Stato `completato`, azzerato a ogni nuovo invio come `azioniRestanti`/`troncato`; non si attiva con "Annulla" (`rifiutaProposta`), solo con una conferma effettiva.
- **Timeout lato client (55s, `AbortController`)**: il rilevamento del troncamento via `stop_reason` presuppone che la `fetch` restituisca comunque una risposta (valida o malformata). Nell'ambiente artifact di claude.ai, per risposte molto lunghe la `fetch` può restare bloccata senza mai risolversi né rifiutarsi — nessun errore, nessun dato: silenzio totale in chat, indistinguibile per l'utente da un'app bloccata. Per questo `chiediAI` avvia un `AbortController` con `setTimeout(..., 55000)` che interrompe la richiesta se non risponde in tempo; l'abort viene intercettato nel `catch` (`e.name === "AbortError"`) e trattato come il caso di risposta troncata (stesso messaggio esplicito, stesso stato `troncato`/`azioniRestanti`, stesso comportamento del pulsante "Continua →" che rinvia la richiesta originale invece di "continua").
- **Pannello AI più largo**: larghezza del riquadro laterale portata da 320 a 480px (era percepito troppo stretto per leggere risposte lunghe).

**Progetto Claude separato** — esiste un prompt di sistema separato (fuori da questa app) per processare email di disponibilità e produrre un file Excel. Non è nel file `.jsx`.

---

## 14. GITHUB PAGES (docs/)

`docs/` contiene una copia pubblicabile su GitHub Pages, poiché il progetto non usa bundler:
- `docs/index.html` — carica React 18, ReactDOM 18 e Babel standalone da `docs/vendor/` (vendorizzati localmente, nessuna dipendenza da CDN esterni), trasforma `docs/app.jsx` nel browser al volo
- `docs/app.jsx` — copia di `turni-guardia-medica.jsx` con 2 modifiche minime, non comportamentali, da riapplicare dopo ogni copia dal file root:
  1. `import { useState, ... } from "react"` → `const { useState, ... } = React;` (nessun bundler, React è un global)
  2. `export default function App()` → `function App()`, con `ReactDOM.createRoot(document.getElementById("root")).render(<App />);` aggiunto in fondo al file

  (Il file root non contiene più cast TypeScript orfani come `(e as any)` — rimosso anche lì dopo che un artifact fresco su claude.ai ha mostrato che poteva bloccare il rendering pure lì, non solo su Babel standalone.)

**Limiti su GitHub Pages** (non modificabili, solo da tenere presenti): l'assistente AI e lo storage persistente (`window.storage`) sono pensati per l'ambiente artifact di Claude.ai — su Pages falliscono silenziosamente (try/catch), quindi l'app funziona ma senza quelle due funzionalità.

Abilitazione: Settings → Pages → Deploy from a branch → branch del progetto, cartella `/docs` (passo manuale una tantum).

---

*Ultimo aggiornamento: luglio 2026. File app: turni-guardia-medica.jsx (~1646 righe).*

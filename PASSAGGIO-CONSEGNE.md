# PASSAGGIO CONSEGNE — App Turni Guardia Medica ASFO Distretto Nord

> **QUESTO È L'UNICO FILE DI PASSAGGIO CONSEGNE.** Da aggiornare a fine di ogni sessione: cambia il "RIPARTI DA QUI" in cima e aggiungi un blocco nuovo in cima allo STORICO. NON creare file di passaggio nuovi.

═══════════════════════════════════════════════════════════
## 🚀 RIPARTI DA QUI  *(aggiornato: 13 luglio 2026 — fine sessione voci 92-94)*
═══════════════════════════════════════════════════════════

**STATO:** voci fino a **97** su `claude/new-session-tufavl`. Questo file È ORA NEL REPO (committato in voce 91).

> **MOTORE:** hash **`89f9bf3e`** (voce 96: chiusura Claut/Anduins nei notturni festivi portata nel motore, `sitiChiusi`). Storia hash: `c155ffce` → (v90 catena) `5bd338ba` → (v92 commento) `6591df4b` → (v93 titolarità target) `27c332e5` → (v96 chiusura Claut/Anduins) **`89f9bf3e`**. Suite: **unit 66/66** (incl. test dello scambio §3.9), **sim 100k = 0 violazioni su 34,6M check**. ⚠️ **RED-LINE MOTORE:** ogni modifica al motore è un cambio deliberato a sé, con sim 100k piena e testa fresca, MAI impilato su altro lavoro a fine nottata. NB (voce 96): la "cascata di 14.900 slot" che aveva bloccato questa modifica era un **artefatto di misura** (medici seedati su un solo motore) — ri-misurato: **0 diff fisici su 260.000 turni**. Vedi la lezione "§ IL METRO PRIMA DELL'OGGETTO — anche quando il metro sei TU" in CONTEXT.

> **FINDINGS (propagazione §3.11):** la CATENA (voce 90) agisce PRIMA della distribuzione §3.11 → si PROPAGA: i turni che toglie vengono ridistribuiti, e muovono celle in giorni che non c'entrano con la regola. Titolarità (93) e chiusura (96) restano LOCALI. (Nessun numero: dipende dalla fixture.)

**PRIMA DI LAVORARE:** leggere `turni-guardia-medica.jsx`, poi `CONTEXT.md`, poi questo file.

> ### ✅ Claut/Anduins chiuse nei notturni festivi — LA REGOLA VIVE NEL MOTORE (voce 96)
> Fonte di verità unica: `elaboraTurno`/`risolviBlu` (`sitiChiusi`). Di notte, nei giorni con diurno, quelle sedi sono `null` nello schema. Restano **3 superfici display** legittime (con A "chiuso"=="scoperto"==`null`, e l'input manuale resta): 1. tendina dialogo+griglia schema (vincolo di INPUT) · 2. export celle (grigio-vs-bianco, il motore non distingue null-chiuso da null-scoperto) · 3. pillola griglia inserimento (fossile nel `dispo`). Tolti 2 filtri morti (`avvisiUI`, nota `*copre` export).
> ⚖️ **La lezione grave (leggila in CONTEXT):** la "cascata di 14.900 slot" che aveva spinto verso l'opzione B era **un metro rotto** (medici seedati su un solo motore) — non un fatto. La smontò un **ragionamento** ("la a-distanza non tocca fis/debiti → impossibile che sposti uno slot fisico"), non un test. Quando la misura dice l'impossibile, è la misura. E su quel numero falso stava per congelarsi un'architettura.

---

## 📌 SESSIONE voci 92-94 (13 luglio)

- **Voce 92 — audit prompt↔motore.** Il prompt prometteva ancora la spaziatura §3.7, morta dal 5/7. Audit sistematico di tutte le affermazioni fattuali del prompt (~18k parole) → **3 divergenze su 21**, tutte da modifiche motore non propagate. Corrette nel prompt (motore invariato salvo 1 commento). **Lezione:** quando il motore cambia, cerca SEMPRE nel prompt chi racconta ancora la regola vecchia.
- **Voce 93 — titolarità target singolo (motore `27c332e5`) + font export + tendina unificata.** Fix RISTRETTO (non generale: il fix generale regrediva la copertura, caso IENGO). Test doppio a guardia di entrambi i comportamenti. Tendina unificata fisico+a-distanza (2 optgroup). Chiude il PENDING (c)-vs-`fis` (voce 90). Sim 100k = 0 violazioni.
- **Voce 94 — Claut/Anduins CHIUSE nei notturni festivi. SOLO DISPLAY (motore intatto).** Regola ASFO: nei notturni dei giorni con diurno (sab/dom/festivi/prefestivi) Claut/Anduins chiuse, nemmeno a distanza; feriali invariati. **Scelta A-vs-B misurata:** la versione motore ("A") NON è chirurgica — il §3.9 (`!target.slots.includes` conta la a-distanza come "già nel turno") provoca una **cascata month-wide di 6.006 slot feriali** (misurata su 3.000 scenari). Scelto **B (solo app)**: griglia (no tendina, "servizio non attivo") + export (grigio SEMPRE, un documento ufficiale non dichiara aperto un servizio chiuso) + `avvisiUI` (chiuso ≠ scoperto). Coerente col pattern già benedetto "solo visualizzazione, motore intatto". Versione A completa → **PENDING §7** coi numeri. **Lezione:** una regola di visibilità/input vive nel display, non nel motore, anche se "in teoria" il motore resta impreciso. Il metro prima dell'oggetto.
- **Voce 95 — i quattro angoli scoperti di voce 94. SOLO DISPLAY (motore intatto `27c332e5`).** Stesso principio ("chiuso ≠ scoperto"), quattro superfici che voce 94 non aveva coperto: (1) **dialogo disponibilità** — tendine CL/AN disabilitate + frase "chiuse" nei notturni festivi; dichiarazioni già inserite → **INERTI** (filtrate al display, pillola inclusa; dato+motore intatti, la pulizia è versione A); (2) **export diurno** — criterio generale: si segnala "scoperto" solo se la sede può aprirsi, altrimenti BIANCA; Meduno frase↔scoperto secondo le CDC; Claut/Anduins scoperte solo se MA/SP/ME presidiate; (3) **export nota** — "*copre Claut/Anduins" filtrata nei notturni festivi (il foglio non deve contraddirsi: riga chiusa + Maniago che "copre Claut"). "Coperta" = `fis` (presidiata fisicamente), stessa semantica del motore. Smoke: dialogo95, criterio95, chiusura-B esteso. **Lezione:** una regola nuova ha più superfici di quante ne vedi al primo giro — cerca TUTTI i posti che raccontano lo stato (input, note secondarie, celle bloccate dalla catena).
- **Voce 96 — chiusura Claut/Anduins portata NEL MOTORE (opzione A). Hash `27c332e5`→`89f9bf3e`.** Il coordinatore ha messo in dubbio la spiegazione della "cascata" (§3.9 `!includes` è invariante — aveva ragione) e ha chiesto la causa vera. **Non c'era cascata:** era un artefatto di misura (medici seedati su un solo motore; ogni modulo ha il suo `byId`). Ri-misurato correttamente: **0 diff fisici su 260.000 turni.** Adottata A — UNA modifica (`sitiChiusi` in `risolviBlu` + `haDiurno` da `elaboraSchema`), non due. Rimossi 2 dei 5 filtri (morti: avvisiUI, nota export); restano 3 (input + null-ambiguity). Unit 66/66 (incl. lo scambio §3.9: il notturno ri-risolto non ri-copre Claut), sim 100k = 0 violazioni su 34,6M check. **Lezione registrata (§ IL METRO PRIMA DELL'OGGETTO — anche quando il metro sei TU):** un metro rotto stava per congelare un'architettura; l'ha smascherato un ragionamento sull'impossibilità logica, non un test.
- **Voce 97 — la SESTA superficie: il PROMPT AI non sapeva della chiusura (voce 96). Motore intatto (`89f9bf3e`).** Il prompt diceva ancora "nel notturno sempre a distanza" → un medico che scriveva "copro Claut sabato notte" veniva accettato in silenzio su una sede chiusa. **Ricaduta esatta della voce 92**, 7 voci dopo. Audit rifatto (90-96): UNA divergenza reale (la chiusura), tutto il resto allineato. Corretto il prompt (SEDI E SCENARI + parsing blu → avviso INFO nel campo JSON), 4 mail curate (60-63, con **controllo negativo** feriale — MAIL 61) in `mail_test_prompt_ai.md` + categoria API **`chiusura_notturno`** (10 casi) nel corpus `test_email_generator.mjs` con nuovo matcher `avvisoVietato` nel report. **Comando unico (a credito):** `node scratchpad/run14.mjs` → 14 pendenti + 10 chiusura, 3× con report di stabilità. **La parte che conta:** REGISTRO "regole del motore che il prompt deve rispecchiare" in cima al CONTEXT (lookup, non rilettura) + item §9.5. **NO differ automatico** (prosa↔codice fragile). Lezione: il prompt è la 6ª superficie della stessa regola; la difesa è il registro, non "ricordarsene".
- **Metodo confermato:** ogni volta un tool di misura ha mentito (assert stale nei conteggi degli smoke; e la falsa cascata di voce 96); il segnale vero era sempre verde. Misura su copia scratch — e **con lo stato globale impostato su TUTTI i moduli confrontati**.

---

## 🔑 LA SCOPERTA CENTRALE DELLA SESSIONE

**Il modello onora lo SCHEMA, non la PROSA.**

**Prova regina (MORANO):** la stessa regola (voce 74) prescrive due cose — l'azione `escludi 29,30,31` e un 🔴. L'azione esce **3/3 stabile**; il 🔴 **0/3, mai**. L'azione vive in un **campo JSON**; l'avviso viveva come **testo libero nella `spiegazione`**.

Dove il 🔴 usciva 3/3 era perché era l'**unico output** — nessuna azione con cui competere. Con output strutturato accanto, la prosa viene abbandonata.

### 🧭 IL COROLLARIO OPERATIVO (applicato 4 volte con successo)

> **Guard dove è un FATTO, prompt dove è un GIUDIZIO — e sempre nel CANALE CHE REGGE.**

| Caso | Difesa | Perché |
|---|---|---|
| data **impossibile** ("31 settembre") | **guard-date** (voce 84) | fatto verificabile → codice |
| data **valida, mese sbagliato** ("30 settembre") in una richiesta | **regola prompt → domanda** (voce 85) | giudizio richiesta-vs-contesto → modello, canale forte |
| mese diverso come **contesto** puro | nessuna azione | corretto già |

**E il principio dei guard:**
> **Una decisione con conseguenze irreversibili non si delega a un modello a temperatura 1 — si fa rispettare nel codice. Il prompt riduce la probabilità di errore; il guard ne elimina la conseguenza.**

---

## ✅ FATTO IN QUESTA SESSIONE (voci 70-89, tutte pushate)

### Fix del prompt
- **Bug 10** (pin su slot senza disponibilità) → pin solo sui turni dichiarati
- **Bug 11** (contraddizione aritmetica: somma minimi > tetto mese) → 🔴, zero azioni
- **Voce 71** — `turni_extra` fantasma. **PRINCIPIO:** *nessuna azione che AUMENTA il carico può derivare da un vincolo che lo RIDUCE.* CALCOLO AUTONOMO ristretto al solo COORDINATORE
- **Voce 72** — guardia feriale su CASO SPECIALE MATTINA/SERA
- **Voce 74** — ULTIMA RISORSA: comportamento vecchio **preservato** (giorno escluso via `escludi`, MAI `dispo_no`). Distinzione **`escludi` ≠ `dispo_no`**
- **Voce 79** — DATE INESISTENTI: precedenza sulla morbida
- **Voce 85** — **mese sbagliato in una richiesta** ("il 30 settembre" lavorando su agosto) → **DOMANDA** *"intendeva il 30 agosto?"*

### 🔬 STEP A — AVVISI COME CAMPO JSON (voci 76-77)
```json
"avvisi": [{"livello": "rosso"|"info", "testo": "..."}]
```
Il livello è un **enum**, non un carattere in una stringa. L'emoji la disegna l'app.
**Risultato:** MORANO 🔴 **0/3 → 3/3**. BEKAEVA 1/3 → 3/3. CERVESATO 2/3 → 3/3. **Leak: ZERO su 36 run.**

### 🔬 STEP B — MIGRAZIONE AL CAMPO `system` (voce 78)
Regolamento in `system` + stato volatile fuori dal blocco cacheabile + fix della `domanda` duplicata + `cache_control`.
**Ha risolto DA SOLO, senza una riga nuova:** VALERI complemento mar/gio **1/3 → 3/3** · TRIGODKO 🔴 stabile · BERTUZZI errore `dispo_no` sparito · stabilità **7/12 → 9/12** · **costo $2,51 → $1,02**.

### 🛡️ I QUATTRO GUARD APP-SIDE (motore mai toccato)

| Guard | Voce | Chiude | Stato |
|---|---|---|---|
| **pin** | 81 | pin piantato in silenzio nel batch | ✅ + modello corretto 3/3 corpus-wide |
| **date** | 84 | data impossibile ~1/3 → deterministico | ✅ |
| **fuori-sede** | 86 | titolare che dichiara solo sedi ≠ titolarità, silent-insert 1/3 | ✅ |
| **iniquità** | 87-88 | criterio assoluto → relativo + livello per medico | ✅ |
| **avviso CDC** | 89 | CDC vuota mentre un corpo è su una sede minore | ✅ |

**Guard pin:** ogni `slot_obbligatorio` viene **estratto** dal batch e reso card Sì/No distinta.
**+ Ancoraggio schema:** riga **CANALE in TESTA** alla definizione (non l'NB in coda a 600 parole) → **20 mail con pin, ZERO in `azioni`, corpus-wide.**

**Guard date:** scansiona il **testo della mail** (non le azioni: il motore rigetta già le date impossibili). Solo date **impossibili di fatto**. Dedup col modello.
**Scartato** il coherence-check "mese sbagliato + azione" per falso positivo (collisione numero-giorno: *"il 2 settembre ho un impegno. Ad agosto: il 2, il 9…"*) → **un guard rumoroso addestra il coordinatore a ignorarlo.** Poi risolto meglio dal prompt (voce 85).

---

### Voci 88-89
- **Voce 88** — barra riassuntiva iniquità **rimossa** (più povera del dettaglio per-medico) + **−104 righe di codice morto** (il correttivo serviva solo alla barra) + mini-nota condizionale sopra la tabella
- **Voce 89** — **(c) avviso CDC scoperte** (box blu: *fatto* vs *azione possibile*, distinto dal banner ambra) + **fix export Excel**: Claut/Anduins nei non-diurni → **"servizio non attivo"** su grigio (stile 14 **nuovo**, stili 0-13 byte-identici) + righe **Reperibilità / Area 1**

---

## 🧮 INIQUITÀ PERCEPITA (voci 87-88) — teoria dell'equità di Adams (1963)

**Il principio, confermato dalla letteratura:** *l'iniquità nasce dal CONFRONTO con gli altri, non dal valore assoluto.* Radici nel confronto sociale di Festinger. Adams: *"la realtà è come la si percepisce"*.

**Il bug trovato:** il correttivo "chi sta peggio" usava una soglia **assoluta** (`< 25%`) → in un mese di penuria (tutti al 15-20%, nessuno favorito) il divario è ~0 ma l'etichetta saliva a "Media". **Misurava insoddisfazione, non iniquità.**

**[DECISION] Il fix:** `penalizzato = s < maxP − MARGINE` (25 punti sotto il migliore). Identico sui casi canonici di voce 29 (`50,50,50,50,0` → Alta; `50,0,0,0,0` → Altissima); chiude la penuria. **Edge `100,40,40,40,40` → Altissima confermata** (più severo: uno ha preso tutto).

**[DECISION] Livello PER SINGOLO MEDICO** (non solo il totale):
```
distanza = maxP − soddisfazione(medico)   →  stesse INIQUITA_SOGLIE
```
Es. migliore al 100%: ZURLO 17% → dist 83 → **Altissima**; MORANO 50% → **Media**; VALERI 80% → **Bassa**; BEKAEVA 100% → **Nessuna**. Colorato (verde→ambra→rosso), niente marcatore separato.

**Ambito invariato: solo turni extra, solo chi ne ha CHIESTI.** (`ottenuti ÷ chiesti` — non i turni assoluti.)

**⚠️ NOTA CONCETTUALE (decisa e chiusa):** i medici NON conoscono quanti extra hanno chiesto i colleghi — vedono solo i turni fatti. Quindi esistono **due iniquità diverse**: (A) quella del coordinatore *"ho onorato le richieste in modo diseguale"*, e (B) quella del medico *"lui ha fatto più turni di me"*. **Si misura solo (A)** — è quella che serve a Francesco per sapere se è stato equo. (B) scartata: troppo complessa e non è il suo problema.

---

## ✅ CHIUSI STANOTTE — I DUE FRONTI SUL MOTORE

### 1️⃣ BUG MMG → **FALSO ALLARME. CHIUSO.**

Il test rosso in baseline (*"atteso 1, ottenuto 5"*) **non era un bug del motore**.

L'asserzione era `slots.length === 1`. Ma `slots` è **l'array delle 5 sedi** — la lunghezza è 5 **per costruzione**. Prova empirica: `slots = [9, null, null, null, null]` → **un solo medico assegnato**, come previsto.

**Il test era rimasto indietro alla voce 52** (unificazione MMG: da mono-slot a 5 slot come i turni ordinari). Rosso da allora, e nessuno se n'era accorto.

**Corretto in voce 90:** `slots.filter(x => x != null).length === 1` — verifica quello che il test voleva davvero dire, non la forma dell'array.

---

### 2️⃣ CATENA DI PRIORITÀ → **IMPLEMENTATA (voce 90). MOTORE CAMBIATO.**

**LA REGOLA (aziendale, ASFO):**
> **Una sede si apre SOLO se tutte quelle sopra di lei sono coperte FISICAMENTE.**
> **Maniago = Spilimbergo → Meduno → Claut / Anduins**

**Semantica:** *"CDC coperta"* = **CORPO FISICO** (`fis`). Una CDC presidiata solo al telefono è **spenta** → Meduno non apre.

**PATCH 1 — target del singolo medico → solo CDC** (`nFisici===1`): `[0,1]` soltanto. Se non dichiara nessuna CDC → `target=[]` → **non lavora**. Il fix "CDC preferita invece di Maniago d'ufficio" (revisione verde/blu) **resta**: non torna il forcing su Maniago.

**PATCH 2 — sweep a valle** (dopo lo step voce-32, **prima** di `scalaDebito` e della FASE 2):
```js
const cdcOk = slots[0] !== null && slots[1] !== null;
const meOk  = slots[2] !== null;
const svuota = !cdcOk ? [2, 3, 4] : (!meOk ? [3, 4] : []);
svuota.forEach((si) => { const mid = slots[si]; if (mid != null) { delete sedeDi[mid]; slots[si] = null; } });
```
Rimozione da `sedeDi` **prima** di `scalaDebito` → **debito non consumato** → idle vero.

**LE DUE INVARIANTI:**
- **INV1 resta SACRO:** nessuno viene forzato dove non si è offerto.
- **La massimizzazione della copertura CEDE:** un medico disponibile può restare **idle**, ed è **voluto**.

**VERIFICATO:** sim 100k **0 violazioni / 35.013.231 check** · unit **63/63** · 5 smoke verdi (incluso `smoke_catena` end-to-end) · il patch rompeva **esattamente 1 test**, riscritto in due (A: il test della catena; B: il tie-break spostato su uno scenario legale — Anduins a distanza).

**EDGE NOTO, lasciato aperto di proposito:** la catena guarda i **corpi fisici**. Nel **notturno** Claut/Anduins **non sono mai fisiche** → non c'è nessun corpo da spostare, solo copertura a distanza, che **non toglie niente a nessuno**. Nel **diurno** invece la catena le svuota, ed è lì che serviva.

---

## 🛡️ IL BOX (c) — RUOLO RISTRETTO, MA VIVO

**Dopo la catena, il motore NON PUÒ PIÙ produrre l'inversione:** su **172.558 turni** random, **0 occorrenze**.

**Ma resta raggiungibile in due modi:**
1. **Edit manuale** — il coordinatore toglie a mano il medico da una CDC in uno schema già elaborato
2. **Schemi vecchi in localStorage** — mesi elaborati col motore **pre-catena**: al reload, il box li segnala

**È il guard di ciò che il motore non controlla: la mano umana.** Tenuto.

---

## ⏳ PENDING — DA MANDARE A CLAUDE CODE

### 🔴 §3.7 — DUBBIO SUL MOTORE (findings, prima cosa da chiarire)
`giorniTra` (riga 292) è **codice morto**: zero chiamate in 4.658 righe. Il commento dice che serve a §3.7 (spaziatura temporale). **Ma il prompt (riga ~2760) promette ai medici una regola che non trovo nel motore:** *"se un vincitore ha lavorato il giorno prima, la sede passa a un altro candidato"*. **§3.11 esiste** (distribuzione equidistante, tetto implicito dal monte ore, attiva per tutti i contrattualizzati) — **ma distribuisce, non cede.** Chiedere: §3.7 esiste? È stata rimossa? Il prompt va corretto o il motore completato?

### GUARD RESTANTI
- **(d) avviso pin-inerte batch-aware** — l'ULTIMO dei quattro guard, e il più delicato: il check va fatto **DOPO** che tutto il batch è applicato, altrimenti falso positivo nel caso normale (pin+dispo insieme)
- **coherence-check date** (mese sbagliato + azione) — con la nota sul falso positivo (collisione numero-giorno)

### EXPORT PDF (design approvato, da implementare)
- **Una pagina per SETTIMANA** (7 giorni), non un unico foglio largo: deve essere **leggibile su telefono e PC**. Ogni pagina **visivamente identica all'Excel** (colori, bordi, font).
- **Zero librerie.** Estrarre `buildSheetModel(mKey)` → da lì escono **sia l'Excel sia il PDF**, così non divergono **per costruzione**. Il PDF via stampa-in-PDF del browser (`<iframe>` nascosto + CSS `@page`).
- **Niente jsPDF/pdfmake:** pesano 350KB-2MB e costringono a **ridisegnare la tabella a mano** → seconda implementazione che diverge col tempo.
- **UI:** i bottoni *Esporta mese* / *Esporta anno* restano, + una **tendina**: Excel / PDF / Entrambi. "Entrambi" = download xlsx + apertura stampa.

### EXPORT EXCEL — frase su Meduno (da mandare)
Quando **Meduno è VUOTA**, al posto di "scoperto" deve comparire: **"Assegnazione solo dopo inserimento medico su Spilimbergo e Maniago"** (frase esatta, stile neutro — non è un'emergenza, è la priorità).

**I tre casi di cella vuota nell'export:**
- **Maniago / Spilimbergo** → **"SCOPERTO"** in rosso *(emergenza)*
- **Meduno** → **"Assegnazione solo dopo inserimento medico su Spilimbergo e Maniago"**
- **Claut / Anduins nei non-diurni** → **"servizio non attivo"** su grigio *(il turno non esiste)* ✅ già fatto (voce 89)

### ALTRO
- **Rifare il ritest completo** (59 mail, 3 run, ~$4-5) alla fine di tutto — i guard toccano il flusso di parsing. **È il "prima" che servirà la prossima volta.**
- **Rifare l'A/B Sonnet vs Opus con lo script** (quello di ieri era a mano, 1 run/mail = dato nullo)
- **Valutare `medium` come default** (oggi è `high`; la doc Anthropic raccomanda effort basso, *"un effort eccessivo su compiti semplici produce output peggiori"*)
- **Revocare la chiave API** (è passata in chiaro in chat)
- **Storico iniquità** ("ZURLO penalizzato 3 mesi su 4") — vale più di qualunque etichetta mensile. L'indicatore oggi guarda un mese alla volta, non ha memoria
- Audit attese di `test_email_generator.mjs` (1478 casi)
- **Marcare le cicatrici anti-Sonnet** nel prompt (es. `[CICATRICE-SONNET]`)

---

## 🧭 PENDING STRATEGICA — LA DIVISIONE DEL LAVORO

**IL PRINCIPIO:** *tutto ciò che è verificabile dal codice non va delegato a un modello a temperatura 1.*

Buona parte delle ~18.000 parole del prompt spiega al modello **come contare** (feriali, settimane ISO, tetti, date). **Il codice conta meglio, sempre.** Se quelle regole diventassero guard, **il prompt si sfoltirebbe da solo**.

È l'unica cosa che **cambia la scala** del problema invece di limarlo. Analisi già richiesta a Claude Code (inventario fatti-vs-interpretazione; quante parole; quali guard; cosa resterebbe).

---

## 📊 BASELINE MISURATE (script, Sonnet 5 + effort medium + `--cache`)

- **12 toste (42-53):** stabilità 6/12 → **9/12** dopo lo step B. Costo $1,02
- **41 corpus (1-41):** **25 → 29 stabili**, zero leak, **$3,14**. Pin-channel chiuso corpus-wide
- **MAIL 54-56** (titolarità fuori-sede, blu, MMG): blu **PASS 3/3**. Fuori-sede 2/3 → chiuso dal guard (voce 86). MMG → **l'attesa era troppo aggressiva**, corretta
- **MAIL 57-59** (mese sbagliato): **3/3, 3/3, 0/3** — criterio centrato (chiede sulle richieste, tace sul contesto)

**Spesa sessione: ~$25.** L'uso normale (14 mail/mese) resta ~$1,70/mese.

**Corpus: 59 mail** in `mail_test_prompt_ai.md` (nel repo). **È la cosa più preziosa costruita: il prompt lo puoi riscrivere, il metro per misurarlo no.**

---

## ⚙️ CONFIGURAZIONE API (verificata sulla doc)

- **`temperature`/`top_p`/`top_k` NON impostabili** → 400 su Sonnet 5 e Opus 4.8. Il determinismo via sampling è **chiuso**. Sostituto raccomandato: **effort basso**
- **Sintassi effort:** `"output_config": { "effort": "high" }` — NON dentro `thinking`
- **Selettore in-app** (low/medium/high, localStorage `gmn_ai_effort`). **Default ancora `high`**
- **`cache_control`:** `{"type":"ephemeral"}`. Il vero ostacolo era l'ordine dei turni, non il campo `system`
- **Prompt reale: ~57.500 token/chiamata**
- **Model string:** `claude-sonnet-5`. Selettore in app: Sonnet / Opus 4.8

---

## 🔒 BUG 10 — QUESTIONE CHIUSA (motore mai da toccare)

**Findings definitivi:** l'ortogonalità pin↔disponibilità (commento a ~riga 3385) è **CORRETTA e intenzionale**. Il pin significa *"tienimelo SE lo vinco"*, non *"sono disponibile"*. Accoppiarli **inventerebbe disponibilità** — bug peggiore.

**Il nodo:** un pin inerte ha **due facce indistinguibili all'apply**:
- **Caso A** — medico senza disponibilità → **errore** (rilevabile)
- **Caso B** — disponibile ma perde per gerarchia → **corretto** (non rilevabile prima dell'elaborazione)

Un guard nel motore colpirebbe **anche B**. → **Motore invariato.** Difesa: prompt (voce 70) + avviso caso-A component-side batch-aware (PENDING (d)).

---

## 🏛️ DECISIONI DI MERITO PRESE (non riaprire senza motivo)

**1. Il medico solo che dichiara solo Meduno.** Lo scenario 1 lo mette a Meduno, le CDC restano scoperte. **Il motore è corretto.** Il commento a riga 666 dice: *"Con 1 solo medico il target è dinamico... **non più forzato su Maniago**"* → il comportamento vecchio (forzare su Maniago) è stato **cambiato di proposito**. **Non si torna indietro:** forzare un medico su una sede che non ha dichiarato viola il principio *"la disponibilità la dichiara il medico"*. La difesa è l'**avviso** (PENDING c), non il motore.

**2. GLI SCENARI ASFO descrivono il NOTTURNO.** Claut/Anduins **fisiche nel diurno** è un **superset approvato da Francesco** (voci 30/32), non una deviazione del motore. Voce 30: *"su richiesta, cambiata la regola delle sedi fisiche"*. **Non riaprire.** Con 4 medici le CDC sono coperte comunque, e lì la preferenza del medico può vincere.

**3. Il "non più forzato su Maniago" (riga 666) risolveva MA-vs-SP, non MA-vs-Meduno.** CONTEXT riga 509: *"lo scenario '1 medico con sede preferita SP' (il motore forzava sempre il target su Maniago) è stato corretto"*. **Spilimbergo È una CDC** → il fix è **compatibile** con lo scenario 1 (*"va in una CDC"*) e **va tenuto**. Il bug è l'**over-generalizzazione** (il target dinamico include Meduno). La catena di priorità passa **esattamente in mezzo**: restringe alle CDC senza far rivivere il forcing su Maniago.

**4. La titolarità è un DIRITTO, non un OBBLIGO.** Riga 758: `if (accVerdeDi(m.id)[0] !== S) continue; // oggi non è la sua prima preferenza: non forziamo`. Un titolare di Maniago che dichiara Spilimbergo **va a Spilimbergo**. La titolarità gli dà **priorità** su Maniago se la vuole; non lo obbliga. Il controllo è la §3.1a (domanda di conferma) + il guard fuori-sede (voce 86).

---

**CICATRICI / REGOLE NON NEGOZIABILI:**
1. **Motore = red-line:** hash `c155ffce`. Una modifica alla volta, sim 100k, 203 unit test, diff+stop per ok (lo Stop-hook **NON** è approvazione)
2. **Un solo file** di passaggio consegne — questo
3. **I file di lavoro vanno nel repo, mai in `~/.claude/uploads/`** — quella cartella è **morta**
4. **Ogni fix è una regola GENERALE** — mai nomi di medici, mai date, mai liste chiuse. Trigger = esempi **aperti**
5. **Il prompt non si accorcia senza baseline + misurazione**
6. **Ogni caso borderline va rieseguito 2-3 volte** prima di dichiararlo un bug (temperature bloccata a 1.0)
7. **Prima di attribuire una regressione a un commit, verificare con `git show --stat`** che abbia davvero toccato la regola
8. **Prima di cambiare qualcosa, capire cosa faceva davvero e perché** — leggere i commenti, cercare la voce di storico

**CHI FA COSA:**
- **Advisor in chat** (Claude qui): prepara messaggi copia-incolla e casi di test. NON ha accesso a repo/API/Claude Code
- **Claude Code**: esegue, testa, pusha. Non pusha MAI senza ok esplicito
- **Francesco**: approva. Inizia a fare il coordinatore il prossimo mese

---

## 💡 LEZIONI DELLA SESSIONE

- **Il DOVE conta più del COSA.** Una regola in un "NB" in coda a 600 parole non viene letta; la stessa riga in testa allo schema sì
- **Quando un test dà un risultato troppo brutto per essere vero, il primo sospetto è lo STRUMENTO DI MISURA.** (Claude Code ha trovato due bug nel proprio harness — l'intera narrazione del "pin raccontato invece che fatto" era **falsa**)
- **Un guard rumoroso è peggio di nessun guard** — addestra il coordinatore a ignorarlo
- **Un run solo non prova niente.** I test a mano nascondevano che 6 mail su 12 erano instabili
- **Dove sbagliano ENTRAMBI i modelli è il prompt. Dove sbaglia uno solo è il modello**
- **Il controllo negativo è essenziale.** Senza MAIL 59 (contesto puro), un 3/3 sulle richieste non distingue *"la regola funziona"* da *"chiedo sempre"*
- **⚖️ IL METRO PRIMA DELL'OGGETTO.** Tre volte stanotte uno **strumento di misura** ha mentito: (1) l'harness di Claude Code (la riga `**Da:** NOME` mancante → l'intera narrazione del "pin raccontato invece che fatto" era **falsa**); (2) l'attesa della MAIL 56 (troppo aggressiva: il modello aveva ragione); (3) il test MMG (`slots.length===1`, rimasto indietro alla voce 52 → sembrava un incendio, era un falso allarme). **Quando un test dà un risultato troppo brutto per essere vero, il primo sospetto è il METRO, non l'oggetto.**

═══════════════════════════════════════════════════════════
## 📜 STORICO COMPLETO DEL PROGETTO  *(dal più recente al più vecchio)*
═══════════════════════════════════════════════════════════

> Diario di tutte le sessioni, dal 2 lug (nascita) a oggi. Ogni sessione è un blocco riassuntivo; i transcript integrali sono in /mnt/transcripts/ (indice: journal.txt) e i dettagli fini delle sessioni recenti in archivio-passaggi/.

### [13 lug, ore 5:00] Voce 91 — copertura a distanza MANUALE · righe export piccole · lo storico che non c'era

**Due rifiniture, e una scoperta amministrativa.**

**#1 — Copertura a distanza a mano.** Claut/Anduins nel notturno/MMG ora **editabili**. La tendina offre **solo i coprenti territorialmente validi** (Claut → solo il fisico di Maniago; Anduins → Spilimbergo o Meduno): le combinazioni impossibili **non sono nemmeno offerte**. Micro-fix `sedePrimaria` al posto di `t.fis.find(...)` → *"a distanza da [sede]"* corretta anche dopo un edit manuale (`fis` fermo). `notaSlot`/export **invariati** (avevano già il fallback). **Motore byte-identico.**

**#2 — Righe CLAUT/ANDUINS più piccole nell'export:** `ht 42→28`, font `sz7` su **tutta la riga**. 5 stili nuovi (16-20), additivi.

**🚨 LO STORICO NON ERA NEL REPO.** Claude Code, cercando `PASSAGGIO-CONSEGNE.md` per aggiornarlo, ha scoperto che **non è mai stato committato**: 149 commit, tutti i rami, stash, reflog, filesystem intero → niente. **Il file vive SOLO nei caricamenti/scaricamenti di chat.** Recuperato da questa conversazione (Francesco l'aveva caricato a inizio sessione). **DA COMMITTARE nel repo, subito.**

**§3.7 — DUBBIO APERTO (findings richiesti):** `giorniTra` (riga 292) è **definita e MAI chiamata** — zero occorrenze in 4.658 righe. Il suo commento dice *"usata per la spaziatura temporale §3.7"*. Ma il **prompt** (riga ~2760) dice al modello che *"il motore preferisce SEMPRE il turno più distante dall'ultimo assegnato: se un vincitore ha lavorato il giorno prima, la sede passa a un altro candidato"*. **§3.11 (distribuzione equidistante) c'è ed è attiva per tutti i contrattualizzati** (tetto implicito dal monte ore) — ma è una **DISTRIBUZIONE**, non una **CESSIONE**. **Sono due meccanismi diversi.** Findings in coda.

---

### [13 lug, notte fonda] Voci 88-89 · gli SCENARI ASFO · la catena di priorità (design approvato)

**GLI SCENARI UFFICIALI ASFO sono emersi solo a fine sessione** — e hanno rivelato una violazione che stava lì da mesi.

> **SC.1:** 1 medico → **va in una CDC** e copre l'altra · **SC.2:** 2 → nelle 2 CDC, uno copre Meduno, l'altro Claut/Anduins · **SC.3:** 3 → MA, SP, ME fisici, territorio integro (Claut↔Maniago, Anduins↔Meduno/Spilimbergo) · **SC.4:** 4 → resta scoperta Claut o Anduins, coperte a distanza · **SC.5:** tutte coperte.

**Il codice rispetta gli scenari 2-5** (il vincolo territoriale `puoCoprireADistanza` è letteralmente lo scenario 3). **Lo scenario 1 NO:** con `nFisici===1` il target è **la preferenza del medico**, non una CDC. Un medico che dichiara **solo Meduno** ci finisce, e le due CDC restano vuote.

**LA SCOPERTA DI CLAUDE CODE (findings, CONTEXT riga 509):** il commento *"non più forzato su Maniago"* risolveva un problema **diverso** — il vecchio motore mandava il medico solo **sempre a Maniago**, anche quando preferiva **Spilimbergo**. **Quel fix è giusto e va tenuto** (Spilimbergo è una CDC). **Il bug è l'over-generalizzazione:** il target dinamico è diventato *"miglior verde tra le sedi fisiche"*, e quell'insieme include Meduno. **La correzione passa esattamente in mezzo.**

**LA REGOLA DECISA (aziendale):** *una sede si apre solo se tutte quelle sopra sono coperte **fisicamente***. **CDC coperta = corpo dentro**, non copertura a distanza (una CDC al telefono è **spenta**).

**Le due invarianti:** **INV1 resta sacro** (nessuno forzato dove non si è offerto) · **la massimizzazione della copertura CEDE** (un medico può restare **idle**, ed è voluto).

**MISURATO su copia scratch (motore mai toccato):** **1 solo test rotto su 23 file** · **0 violazioni su ~1,3M check** · i **6 test di voce-32 verdi**. Il test rotto è **una prova semantica**, non una regressione: codificava lo stato che la regola rende impossibile. **Riscrittura in due test (A+B).**

**BUG MMG SCOPERTO PER CASO:** un unit test è **rosso in baseline**, nel motore in produzione (*"atteso 1, ottenuto 5"*). Non l'ha rotto nessuna patch — era rosso **da chissà quando**. **Primo lavoro di domani.**

**Voce 88:** barra iniquità rimossa (il dettaglio per-medico è più ricco) + **−104 righe di codice morto**. **Voce 89:** avviso CDC scoperte + export Excel (*"servizio non attivo"* grigio per Claut/Anduins nei non-diurni, righe Reperibilità/Area 1).

**VOCE 90 — IL MOTORE È CAMBIATO.** Prima modifica dopo mesi: la **catena di priorità** implementata (PATCH 1: target del singolo medico → solo CDC; PATCH 2: sweep a valle che svuota le sedi sotto una scoperta). Hash **`c155ffce` → `5bd338ba`**.

**Verificata come si deve:** **sim 100k = 0 violazioni su 35.013.231 check** · unit **63/63** · il patch rompeva **esattamente 1 test**, riscritto in due (A: il test della catena; B: il tie-break su uno scenario legale). **Il box (c) resta**, con ruolo ristretto: il motore non può più produrre l'inversione (172k turni, 0 occorrenze), ma **la mano umana sì** (edit manuali, schemi vecchi in localStorage).

**BUG MMG → FALSO ALLARME.** L'asserzione era `slots.length===1`, ma `slots` è l'array delle 5 sedi. Il test era rimasto indietro alla **voce 52** (unificazione MMG a 5 slot). Corretto: `slots.filter(x => x != null).length === 1`.

**Export Excel completato:** i tre casi di cella vuota — **SCOPERTO** rosso (CDC) · **"Assegnazione solo dopo inserimento medico su Spilimbergo e Maniago"** (Meduno) · **"servizio non attivo"** grigio (Claut/Anduins non-diurni) — più le righe **Reperibilità / Area 1**. Stili **additivi**, i preesistenti byte-identici.

**Sessione chiusa alle 4:00 dopo diciotto ore.** Il motore, dichiarato intoccabile per mesi, è stato modificato **con giro completo** — e adesso rispetta gli scenari ASFO.

---


### [12-13 lug, sessione notturna] Voci 70-87 — il modello onora lo SCHEMA, non la PROSA · migrazione al campo `system` · quattro guard app-side

**LA SCOPERTA CENTRALE.** Prova regina (MORANO): la stessa regola prescrive un'azione (`escludi`) e un 🔴. L'azione esce **3/3**, il 🔴 **0/3**. L'azione vive in un **campo JSON**, l'avviso viveva come **prosa libera**. Dove il 🔴 usciva era solo perché era l'unico output. → **Il modello onora lo schema, non la prosa.**

**STEP A — avvisi come campo JSON** (voci 76-77). `"avvisi": [{"livello": "rosso"|"info", "testo": "..."}]` — il livello è un **enum**, non un carattere in una stringa. Una regola globale nello schema + 9 conversioni chirurgiche (testo byte-identico, cambia solo il contenitore). **MORANO 0/3 → 3/3. BEKAEVA 1/3 → 3/3. CERVESATO 2/3 → 3/3. Zero leak su 36 run.**

**STEP B — migrazione al campo `system`** (voce 78). Quattro cose insieme: regolamento in `system` + stato volatile fuori dal blocco cacheabile + fix della `domanda` duplicata + `cache_control`. **Ha risolto da solo, senza una riga nuova:** VALERI 1/3 → 3/3 (bug 4 chiuso dalla struttura), TRIGODKO stabile, BERTUZZI errore sparito. Stabilità **7/12 → 9/12**. **Costo $2,51 → $1,02.**

**I QUATTRO GUARD APP-SIDE** (motore mai toccato, hash `c155ffce`):
- **pin** (81) — ogni `slot_obbligatorio` estratto dal batch → card Sì/No. **+ ancoraggio CANALE in testa allo schema** → il modello ha imparato: 20 mail con pin, **zero in `azioni`, corpus-wide**
- **date** (84) — scansione del **testo della mail** (non delle azioni: il motore rigetta già le date impossibili). Solo impossibili-di-fatto. Dedup col modello. PITAU ~1/3 → **deterministico**
- **fuori-sede** (86) — titolare che dichiara solo sedi ≠ titolarità → card Sì/No. Chiude il silent-insert 1/3 di MAIL 54
- **iniquità** (87) — criterio assoluto → relativo + livello per singolo medico

**VOCE 85 — mese sbagliato.** *"Il 30 settembre"* mentre si lavora agosto: data **valida**, mese **sbagliato**, dentro una **richiesta** → il modello rimappava in silenzio. Il guard-code è stato **scartato** (falso positivo da collisione numero-giorno: *"il 2 settembre ho un impegno. Ad agosto: il 2, il 9…"*). Risolto invece **nel prompt** → **DOMANDA** *"intendeva il 30 agosto?"*. **3/3 su richiesta netta, 3/3 su morbida (la precedenza tiene), 0/3 su contesto puro.** Il triangolo è coperto.

**INIQUITÀ PERCEPITA (87) — teoria di Adams (1963), verificata sulla letteratura.** Il correttivo "chi sta peggio" usava una soglia **assoluta** (< 25%) → in penuria (tutti al 15-20%) l'etichetta saliva a "Media" pur con divario zero: **misurava insoddisfazione, non iniquità**. Fix: `penalizzato = s < maxP − MARGINE`. Identico sui canonici di voce 29, chiude la penuria. **+ livello per SINGOLO medico** (`distanza = maxP − s`, stesse soglie). Decisa e chiusa anche la questione concettuale: si misura l'iniquità **del coordinatore** (ho onorato le richieste in modo diseguale), non quella **percepita dal medico** (che non conosce le richieste altrui).

**DECISIONI DI MERITO.** (1) Il medico solo che dichiara solo Meduno → il motore è **corretto**, e il commento a riga 666 dice che il forzamento su Maniago è stato **rimosso di proposito**. Non si torna indietro: la difesa è un **avviso**. (2) La **titolarità è un diritto, non un obbligo** (riga 758: *"oggi non è la sua prima preferenza: non forziamo"*).

**Corpus: da 41 a 59 mail.** Baseline complete misurate. Spesa sessione ~$25.

**LEZIONI:** il **dove** conta più del **cosa** (una regola in coda a 600 parole non viene letta) · quando un test dà un risultato troppo brutto per essere vero, il primo sospetto è **lo strumento di misura** · **un guard rumoroso è peggio di nessun guard** · il **controllo negativo** è essenziale (senza, un 3/3 non distingue "funziona" da "dico sempre sì").

---

### [12 lug, mattina] Voce 69 — tagli a rischio basso · 6 mail nuove · bug 10 e 11

**VOCE 69 — sfoltimento a rischio basso (~330 parole, 18.250 → 17.922).** Il prompt era cresciuto a **18.250 parole** (non 14.400 come si credeva). Audit delle ridondanze e tagli **solo dove il contenuto era duplicato letteralmente**:
- rimosso un paragrafo che si dichiarava esso stesso `⚠️ RIPETUTO PERCHÉ CRITICO` (doppione al 100%)
- "Rispondi SOLO JSON" era scritto **per intero due volte** → tenuta una
- due sezioni "leggi il calendario, non calcolare a mente" → la seconda ridotta a cross-ref
- blocco senza-incarico near-verbatim per `ore_extra`/`turni_extra` → fuso
- due esempi JSON MMG identici al 90% → tenuto uno
- `TUTTE LE SEDI PARI`: 18 sinonimi → criterio + esempi, **lista aperta**

**Motore byte-identico** (hash `c155ffce`). Nessuna regola indebolita.

**DECISIONE IMPORTANTE — l'enfasi NON è stata toccata.** Gli **89 `NON`, 33 `MAI`, 36 `SEMPRE`, 8 `OBBLIGATORIO`** restano. Motivo (di Claude Code, corretto): *de-enfatizzare direttive vive **non è pulizia, è un cambio di comportamento*** — proprio quello che potrebbe ridurre l'over-blocking. Va fatto **da solo e misurato**, non infilato in un batch di pulizia. È il prossimo esperimento serio, ma **dopo** lo spostamento in `system` (che potrebbe risolvere l'over-blocking da solo, amplificando anche le carve-out anti-blocco).

**6 MAIL NUOVE (corpus toste: 6 → 12).** Costruite per attaccare da direzioni **diverse** dalle prime sei. Esito: **4/6 pulite**, 2 bug nuovi (10 e 11). Le regole scritte nella notte hanno retto su formulazioni **mai viste**: il discriminatore TIENI-lo/TOGLI-me ha funzionato su *"non provateci nemmeno"* (non in lista); il calendario è stato letto per risolvere *"Ferragosto"*, *"il 5 mattina"*, *"l'ultimo weekend"*, *"il lunedì successivo"*. **È il segno che sono regole generali, non match testuali.**

**LEZIONE:** l'advisor in chat ha segnalato **due bug inesistenti** perché ha giudicato a memoria invece di leggere il codice — il giorno della settimana del 19 agosto (è **mercoledì**, non martedì) e le sedi di PRESSACCO (che sono **corrette**: il vincolo territoriale §3.2 impone che Claut si copra solo da Maniago e Anduins solo da SP/ME). Entrambe le volte è stato l'utente a fermarlo. **Verifica sempre dal codice, mai a memoria — vale per tutti, advisor incluso.**

---

### [12 lug, alba] Voce 68 — regressione del pin chiusa · campo `settimane` · domande binarie

**REGRESSIONE CHIUSA.** Dopo i 7 fix, Sonnet aveva iniziato a leggere *"il 23 non me lo toccate"* come **indisponibilità** (`dispo_no`) invece che come **pin** — l'opposto esatto dell'intenzione del medico, che veniva così **escluso** dal giorno a cui teneva. Il peggior errore possibile.

**Diagnosi (Claude Code, fondamentale):**
- Il medico in questione è **INDET, non senza incarico** → la regola senza-incarico non c'entrava. Correggere lì sarebbe stato il punto sbagliato.
- Le due debolezze erano **PRE-ESISTENTI e latenti**, non create dai 7 fix: (a) collisione fra i trigger PIN ("il X non me lo toccate", già letteralmente nel prompt) e i trigger `dispo_no` ("il X non mettermi", "saltate il X") — negazioni **simili in superficie, opposte nel senso**; (b) *"praticamente sempre"* scambiato per *"quasi sempre"* dalla regola ECCEZIONI NON SPECIFICATE.
- I 7 fix hanno aggiunto **molto testo di divieto** ("NON/🔴/blocco/nessuna azione") → hanno alzato il **prior verso letture negative** in tutto il prompt (interferenza **diffusa di tono**, non un singolo colpevole), facendo **emergere** una fragilità che c'era già. Opus, più capace, la assorbiva.
- Il "tranne Maniago sparisce" era **downstream del blocco**: sistemato il blocco, la regola voce 65 gira di nuovo.

**FIX (voce 68, prompt + un campo di stato):**
1. **DISCRIMINATORE "TIENI-lo vs TOGLI-me"** — criterio **semantico**, non match testuale: *"non toccare/togliere/levare/cedere **ciò che HO**"* (non me lo toccate / non me lo togliete / non lo cedo / non si tocca / giù le mani dal X) = **PIN 📌**. *"Togliere/saltare/non mettere **ME**"* (togliete il X / saltate il X / il X non mettermi / non consideratemi) = **`dispo_no`**. Prominente, con cross-reference bidirezionale e **precedenza su ogni regola di blocco**.
2. **"quasi/praticamente sempre" = disponibilità ampia** (≈ tutto il mese) → non blocca. Distinta dalla *regolarità con eccezioni implicite* (che resta bloccante).
3. **Campo di stato `settimane`** (componente, riusa `settimanaDi()`; motore byte-identico, hash invariato): elenca **tutte** le settimane che toccano il mese — inclusa quella a cavallo — con lunedì e **giorno rappresentativo sempre in-mese**. Regola generale: *"per identificare una settimana o iterare su tutte le settimane, LEGGI `settimane` — non calcolarle a mente"*. Vale per `tetto_settimana`, `finestra_settimanale`, e qualunque riferimento a "la settimana del X". Corretto l'esempio stale "× 5 settimane".
4. **Domande binarie** — vietato l'aut-aut ("vuoi X o Y?") e le domande "opzionali" che offrono azioni non richieste.

**VERIFICA:** BERTUZZI su Sonnet, **3 giri su 3**: pin sul 23 ✅, nessun blocco ✅, "tranne Maniago" ✅ (SP/ME/CL/AN), nessuna azione sul 24 ✅. Il fix è **stabile**, non era fortuna.

**LEZIONE:** un fix può far **emergere** una fragilità latente altrove. Dopo ogni batch di regole nuove, ritestare **anche ciò che già funzionava** — non solo ciò che si è corretto.

---

### [12 lug, notte] Test A/B Sonnet vs Opus · 7 bug del prompt · selettore di modello (voci 64-66)

**Voce 64 — regola ⚓/📌 ristretta.** La regola scritta poche ore prima era **sbagliata**: ⚓ su TUTTE le sedi dichiarate ≡ 📌 libero (il motore non può assegnare una sede non dichiarata, quindi il pin libero non scatterà mai su una sede esclusa). Semantica corretta: **⚓ solo su un sottoinsieme PROPRIO** delle sedi dichiarate ("disponibile a SP e ME, il 19 solo se sono a SP"). Altrimenti 📌 libero, anche con meno di 5 sedi. Corpus di test riallineato (7 mail).

**Voce 65 — ESCLUSIONE DI SEDE.** Il prompt **non gestiva il "tranne"**: le uniche occorrenze erano commenti del motore. Caso reale: *"tutte le sedi tranne Maniago"* → l'AI dichiarava tutte e 5 le sedi e poi proponeva un `dispo_no` su Maniago per rimediare. Regola aggiunta: le sedi escluse **non vanno dichiarate**, `dispo_no` non serve a escludere una sede.

**Voce 66 — selettore di modello** (`MODELLI_AI`, stato React, localStorage `gmn_ai_model`, default Sonnet). Segmented control sotto l'header della chat.

**TEST A/B — 6 mail toste, entrambi i modelli. Vince Sonnet, si resta su Sonnet.** Opus decide da sé invece di applicare le regole: inventa inferenze non richieste, blocca dove non serve, salta regole che Sonnet applica. Causa: il prompt è **tarato su Sonnet** — le cicatrici in maiuscolo scritte per spingerlo su Opus 4.8 producono l'effetto opposto (over-triggering), come documentato da Anthropic.

**7 BUG DEL PROMPT** emersi dal test (sbagliano **entrambi** i modelli → è il prompt): date impossibili corrette in silenzio · fantasma della ☆ rimossa · preferenza morbida trattata come pin · esclusione ricorrente di giorni-settimana · `turno_pref` su feriale · regola senza-incarico incoerente · `tetto_mese` a vuoto. Dettaglio e fix in RIPARTI DA QUI.

**ANOMALIA SCOPERTA:** il system prompt **non è nel campo `system`** dell'API — è concatenato nel messaggio user. Possibile causa di fondo dei 7 bug ("regole che ci sono ma non mordono"). Da provare dopo, con baseline pulita.

**LEZIONI:**
- **Un modello non può simulare un altro modello.** La verifica statica trova bug nel *prompt*; il comportamento si misura solo eseguendo.
- **Dove sbagliano entrambi i modelli è il prompt. Dove sbaglia uno solo è il modello.** È il criterio che ha separato i 7 bug veri dalle idiosincrasie di Opus (che NON sono state corrette: farlo avrebbe storto il prompt verso un modello che non si usa).
- **Chiedere "che modello sei" non è un test.** Un modello non ha accesso al proprio model string: risponde con quello che ricorda dal training e sbaglia quasi sempre. Si guarda F12 → Network → campo `model`.
- **Prompt e modello sono un sistema unico.** Non esiste un prompt ottimo per due modelli.

---

### [11-12 lug] Sessione lunga: MMG unificati, min-maxGap, finestra settimanale, rimozione ☆, pin turno preferito (voci 52-64)

**Voce 52 — Unificazione MMG:** i turni MMG seguono FASE 1/FASE 2 come gli ordinari. Il coordinatore attiva SOLO la checkbox: sede e copertura a distanza le decide il motore dalle disponibilità dei medici. `extra:true` conservato come pin automatico §3.11. Sim 100k: 0 violazioni.

**Voce 54 — `scegliConRiferimento` ottimale:** sostituito il greedy farthest-point con **binary-search min-maxGap** (ottimo esatto, ~0,01 ms). Il greedy era subottimo nel 78% dei casi con pin (+1,69 giorni di buco medio).

**Voce 56 — Swap-nudge blu:** tiebreak in `scegliConRiferimento` — a parità di gap ottimale preferisce i giorni con blu dichiarata. Inerte su blu uniforme, +2% copertura a distanza su blu parziale.

**Voce 57 — Vincolo di finestra settimanale** (`SETTWK:`): il medico vuole ALMENO N turni in una settimana. Il motore àncora i migliori N vinti. Tetto mensile resta rigido. Settimane troncate contano solo i giorni in-mese.

**Voci 58-60 — UI:** sfoltiti gli spiegoni; rimosso dead code (ESLint 11→8); pannello 📅 con label "Al massimo" e "Vorrei assolutamente"; banner avvisi rinominato "Da verificare prima di esportare", testo umanizzato ("sede fisica o copertura a distanza" invece di "verde o blu"), filtro degli avvisi SCOPERTO ovvi (mostrati solo con 2+ medici presenti). Motore byte-identico (transform di sola visualizzazione).

**Voce 61 — Pin del turno preferito in §3.11 (fix A).** Se un medico vince ENTRAMBI G e N di un giorno e ha una `TURNOPREF`, il turno preferito entra in **`kept`** (non solo in `giorniFissi`). **Errore concettuale scoperto da Claude Code:** `giorniFissi` sono ancore da cui *allontanarsi*, non slot tenuti — il codice originariamente proposto avrebbe **ceduto entrambi** i turni del giorno preferito. Unit test 4/4 con controprova (senza pref §3.11 cede il 14G; con pref lo mantiene).

**Voce 62 — Rimozione completa della ☆ sede preferita.** Analizzando il codice si è scoperto che **non aveva alcun effetto pratico**: l'unico meccanismo era l'ordine `conPref` (turni con preferito elaborati per primi), ma nel passaggio 1 tutti i medici partono con il debito pieno → l'ordine non cambia mai chi vince. Restava solo un avviso che il coordinatore non usa. Rimossa da motore, UI, prompt e test (`test_preferiti2.mjs` eliminato). `ordineVoci = voci` (cronologico puro). **NON byte-identico** — accettato.

**Voce 63 — Nota di combinazione nel prompt AI:** i 4 casi (📌, 📌+turno_pref, ⚓, ⚓+turno_pref) con le frasi trigger.

**Voce 64 — Regola "restrizione di sede → ⚓" nel prompt.** ⚠️ **SCOPERTA POI SBAGLIATA** dalla verifica statica delle 40 mail: ⚓ su tutte le sedi dichiarate è equivalente a 📌 libero. Da restringere (vedi PENDING #1).

**VERIFICATO CON DATI REALI** (BERTUZZI solo, tutto agosto): pin 3N e 22N rispettati; finestra settimanale "almeno 3 turni la settimana del 3-9" soddisfatta (3N, 4N, 9N); distribuzione con gap massimo 8, ottimale con quei vincoli.

**LEZIONI:**
- **La sim può essere vacua:** il generatore metteva la blu uniforme su tutti i giorni → il tiebreak blu misurava 0 per costruzione. Scoperto solo strumentando il contatore di swap.
- **`giorniFissi` vs `kept`:** confonderli produce l'effetto opposto a quello voluto.
- **Le preferenze morbide non servono a nulla con §3.11 attivo** — o pinni, o lasci decidere al motore. Nessuna zona grigia. (È il motivo della rimozione della ☆.)
- **Un modello non può simulare un altro modello:** la verifica statica trova bug nel *prompt*, non nel *comportamento*.

---

### [11 lug, notte] Bug strutturale MMG scoperto + fix prompt AI in corso

**BUG STRUTTURALE MMG (scoperto usando l'app):** i turni MMG (`turno.extra === true`) hanno sempre avuto una logica separata senza sede — `slots = [mid]` invece di `slots = [MA, SP, ME, CL, AN]`, hardcoded su Maniago nel rendering. Il motore decide solo CHI fa il MMG, non DOVE. Il commento riga 1814 lo dichiarava esplicitamente: "sempre associato a Maniago (nessun concetto di sede per gli extra)". Era una decisione di Claude Code dal giorno zero, sbagliata e mai confermata dal coordinatore. I MMG devono seguire esattamente la stessa logica dei turni ordinari: FASE 1 con sede fisica, titolarità, gerarchia, preferenze. Fix: rimuovere branch `if (turno.extra)` separato in `elaboraTurno`, aggiungere campo `sede` all'azione `mmg`, fix rendering Excel e UI. Messaggio pronto.

**CICATRICE:** Claude Code non deve mai fare assunzioni su logiche di business senza conferma esplicita del coordinatore.

**FIX PROMPT AI IN CORSO** (5 punti, Claude Code ha il messaggio, aspetta diff + ok): (a) `tetto_mese` non dedotto dal settimanale; (b) turni extra dedotti autonomamente; (c) `slot_obbligatorio` frasi trigger; (d) CONFERMA IMPLICITA copre nuove azioni; (e) calendario: leggere sempre lo stato, non ragionare da solo.

---

### [11 lug] Feature slot obbligatori 📌 + push ⚓ pin sede in corso

**PUSHATO (commit in sessione):** feature **slot obbligatori 📌** completa — motore §3.11 + azione AI `slot_obbligatorio` + UI popup + badge griglia + `statoRealeMedico` + `azzera_medico`. Struttura dati: `"OBBL:" + slotKey = true`. Gli slot obbligatori vinti entrano sempre in `kept` come seed `giorniFissi`; la distribuzione equidistante costruisce attorno a loro. Consumano il tetto (tetto:8 con 3 pin → 3 fissi + 5 distribuiti). Se non vinti: ignorati silenziosamente. BERTUZZI `tetto_mese:8` + pin 1N/15N/22N → `[1,4,8,11,15,22,26,31]`. Sim 100k: 0 violazioni su 34.476.568 check.

**IN ATTESA DI PUSH:** ⚓ pin sede specifica (`OBBL: = "NomeSede"` — pin scatta solo se sede vinta = sede pinned) + fix ☆ sempre visibile (grigia inattiva → dorata attiva) + badge ⚓ alto destra griglia. Messaggio inviato a Claude Code, aspetta ok.

**DESIGN DISCUSSO E CONSOLIDATO:**
- 📌 = voglio questo turno (giorno+turno) se vinto, qualsiasi sede — high sinistra griglia
- ⚓ = voglio questo turno solo se ottengo quella sede specifica — accanto a ☆ nel popup, alto destra griglia
- I due sono indipendenti e combinabili
- Pin e temporalità: gli obbligatori sono seed `giorniFissi`, l'equidistante distribuisce il resto attorno — non bypassa la temporalità, ci costruisce dentro
- MMG vinti → pin automatici (feature futura, ~5 righe motore)
- Slot obbligatori consumano il tetto normalmente

---

### [10 lug, notte] Fix motore §3.11 — distribuzione temporale non funzionava nel caso comune (commit 076993e)

**BUG CONCETTUALE.** La distribuzione temporale §3.11 scattava solo quando `maxTurniMese` esplicito < monte ore implicito — cioè quasi mai. Il caso comune (BERTUZZI disponibile tutto agosto, tetto = monte ore = 8) lasciava i turni ammucchiati nelle prime settimane. Causa: il gate `capDich >= implicito` saltava la correzione; e il fix proposto dall'advisor (`poolP1.length <= tetto`) era un no-op algebrico (pool P1 già limitato dal blocco monte ore a ≤ implicito ≈ tetto). Claude Code ha trovato il difetto e applicato il fix corretto.

**FIX MOTORE** (gate §3.11, 2 modifiche): il pool viene ricalcolato con l'oracolo esente ogni volta che il medico ha davvero esaurito il monte ore in P1 (`poolP1.length === implicito`), indipendentemente da come è stato impostato il tetto. Gate perf/correttezza-neutra: salta il ricalcolo se il pool non è esaurito (no-op comunque). Principio ora corretto: "se la disponibilità supera il tetto, distribuisci sempre".

**VERIFICHE:** BERTUZZI `tetto_mese:8` notturni tutto agosto → `[1,5,10,14,18,22,27,31]` (era `[1..8]`). Suite unit 10/10 (4 test aggiornati dal vecchio ammucchiamento). Sim 100k: 0 violazioni su 34.478.743 check. Effetto collaterale positivo: residui §3.1a passano a 0 in 100k scenari → rimossi 2 test seed-pinned del guardiano (sostituiti con nota; verifica a scala resta INV-TITOLARE della sim). CONTEXT.md voce 48 + §0 inv.7 + §8 aggiornati.

**BUG TROVATI DURANTE LA SESSIONE (prompt, non ancora fixati):**
- `tetto_mese` dedotto automaticamente dal settimanale quando non dichiarato (messaggio per Claude Code pronto)
- `CONFERMA IMPLICITA`: quando AI propone azione in linguaggio naturale e utente risponde "sì", l'azione non veniva emessa — **già pushata** in questa sessione

**FIX UI pushato nella stessa sessione:** box settimana a cavallo read-only mostrava vuoto invece del conteggio turni luglio quando nessun tetto dichiarato (3 casi: null+0→"", null+N→N in arancio, dichiarato→dichiarato-luglio).

---

### [10 lug, notte] Fix visivo: box settimana a cavallo vuoto dopo spunta turno luglio

**BUG UI.** Nel pannello 📅 (tab Medici), spuntare un turno di luglio nel riquadro giallo non aggiornava il box read-only della settimana a cavallo se non era dichiarato un tetto settimanale — il box restava vuoto. Fix: 3 casi nel rendering del box read-only. Engine byte-identico.

---

### [10 lug, sera] Fix: giorno mancante chiesto come Sì/No (bug trovato usando l'app)

**CICATRICE nuova (trovata da Francesco usando l'assistente).** Mail: "vorrei fare 2 turni a settimana ad agosto, a fine luglio però ne ho già fatto uno". L'AI ha capito giusto (tetti settimanali + turno_precedente con giorno mancante) MA ha chiesto il giorno con una card Sì/No — assurdo (la risposta è un giorno, non un sì/no). **Causa:** messaggio MISTO — il prompt diceva "usa tipo `risposta`" per il giorno mancante, ma `risposta` non può contenere azioni; dovendo applicare anche i tetti, l'AI ha ripiegato sull'array `domande` (che si renderizza Sì/No). Lo strumento giusto (domanda aperta testuale insieme alle azioni) non era nominato.

**FIX pushato (solo prompt + corpus, motore byte-identico):**
- **Mod.1** voce turno_precedente: giorno mancante → chiedilo come TESTO nella `spiegazione` ("Dimmi quale giorno di luglio"), MAI Sì/No; se ci sono altre azioni applicabili (tetti) applicale comunque; se non c'è altro usa tipo `risposta`.
- **Mod.2** (principio generale sulle `domande`): un DATO MANCANTE non-binario (quale giorno/numero/sede) NON è mai una card Sì/No → testo. Copre casi futuri, spirito AZIONE vs CONTESTO.
- **Corpus** caso #7 (turno_precedente_giorno_mancante) irrobustito con `domandaVietata:true`.
- Sì/No legittime (MMG, diurno weekend) intatte. Verifica AI vera del caso misto → alla run batch quando c'è credito.

### [10 lug] Fase 3 `turno_precedente` + principio AZIONE vs CONTESTO + decisione accorciamento

**PUSHATO:**
- **Fase 3 `turno_precedente`**: il coordinatore in chat scrive "Bertuzzi ha fatto un notturno il 30 luglio" → l'AI emette `{"az":"turno_precedente","medico":"BERTUZZI","giorno":30,"turno":"N"}` → il motore registra nella settimana a cavallo. `giorno`=numero di luglio; `turno` opzionale; `presente:false` toglie. L'AI fa il minimo, il motore calcola + rete di sicurezza. Solo coordinatore, MAI da mail. Deterministico verde (test 10/10, suite completa, elaboraSchema byte-identico, corpus pulito).
- **Principio `AZIONE vs CONTESTO`**: blocco in testa a INTERPRETAZIONE EMAIL, letto prima di ogni regola → governa tutte le azioni. Distingue "azione da eseguire" da "racconto/motivazione/passato citato". Nato dal buco sui casi dove il medico usa il passato come contesto ("il mese scorso ho fatto pochi turni", "ero in ferie", "l'anno scorso"), lessicalmente vicini al trigger di turno_precedente. Scelta di design (intuizione di Francesco): UN principio trasversale invece di 4 esempi sparsi. +1 blocco, −4 esempi evitati, motore byte-identico.

**14 mail di test create** (advisor + Francesco, Claude Code le fa girare — niente API dall'advisor): A(4) registrazione turno luglio; B(8) disponibilità che NON deve innescare turno_precedente, trabocchetti #7/#9/#10/#12; C(2) giorno mancante → l'AI CHIEDE. Verifica API bloccata (saldo zero). Giudizio a tavolino di Claude Code: tutti tornerebbero, buco su 9/12 risolto proprio dal principio ora pushato ("rinforzato" ≠ "verificato": sigillo = API).

**DECISIONE — accorciamento prompt: NON ora.** Doppia analisi concorde (advisor + Claude Code). Il prompt è "cicatriziale" (difese anti-bug reali, es. "⚠️ ERRORE DA NON COMMETTERE MAI"): tagliare rischia di far tornare i bug. Unica ridondanza verbatim: "quasi sempre/di solito". Insight: la domanda giusta non è brevità ma coerenza/ordine (contraddizioni + lead sepolto). Preferire SEMPRE principi consolidanti agli esempi sparsi. **Se mai accorciare (solo con API):** baseline sul corpus PRIMA → gestire rumore stocastico (temperature:0 o N run, l'app non fissa temperature) → misura PER-CATEGORIA → non tagliare ciò che non ha test → un lotto per volta, revert se una categoria scende. Margine: ~1-3% verbatim + ~10-20% prolissità, ~0% regole vere.

---

### [9 lug] Azioni compatte `dispo_set`, giorni-settimana, collaudo AI vera, settimana a cavallo

**PUSHATO:** `dispo_set` (azioni compatte: sposta logica dal prompt AI al motore deterministico — commit c94940c) · ambito `giorni_settimana` per pattern giorno-della-settimana (fix del "bug Iengo") · `statoRealeMedico` (lettura stato reale del medico) · campo grafico "max turni a settimana" nel tab Medici · **settimana a cavallo passo 1 (vincolo V-A) + passo 2 (distribuzione sopra-tetto)** — primo tocco a elaboraSchema, il turno di luglio riempie la settimana a cavallo per il vincolo settimanale e serve da riferimento per la distribuzione, ma NON consuma mai il totale mensile · 5 ritocchi al prompt (period expressions, senza-incarico edge cases, "dove capita").

**Collaudo 14 mail su AI vera** (agosto 2026): fatto, molto istruttivo, la maggior parte dei sistemi funziona. **Principio chiave ribadito da Francesco:** l'AI fa il minimo (linguaggio), il MOTORE fa tutti i calcoli + rete di sicurezza — l'AI non è brava sui calcoli. **Consiglio per Francesco coordinatore novizio:** i primi mesi usare l'app come "assistente che propone", non "oracolo che decide"; appoggiarsi agli schemi precedenti e al feedback dei 14 medici come metro. Idea futura: far sì che l'app SPIEGHI le sue decisioni ("ho messo Tizio qui perché titolare/più debito") — così Francesco costruisce l'occhio più in fretta.

---

### [8 lug] Grafica, buchi prompt, invarianti, titolarità · dispo_set + collaudo (sessione lunga)

**PUSHATO:** collaudo 600 mail a tavolino → 4 buchi prompt corretti · 3 buchi prompt precedenti (commit 793d970) · pacchetto grafico completo (celle "che respirano") · **INVARIANTI INTOCCABILI nel CONTEXT.md** (§0, le regole che non si toccano) · nuova regola prompt: titolare che chiede SOLO un'altra sede → DOMANDA al coordinatore · export Excel: rimosso "(MMG)" dal nome.

**Dibattito a tre (Francesco + Claude + ChatGPT) su rifattorizzazione — CONCLUSO.** Decisioni prese e volutamente NON implementate (non riaprirle senza motivo): titolarità come obbligo rigido → NO, lasciata com'è. Logica livelli/indifferenza → PENDING delicatissima (tocca titolarità). Titolarità nel motore verificata dal codice (righe 465-478, 516-594).

**Bug ancora da fare** (dettaglio in BUG-DA-SISTEMARE-collaudo-luglio.md): vari ritocchi motore design-first. Nota strategica: preferire "azzera e reinserisci" a "modifica AI-driven"; per piccole correzioni spesso più veloce il click manuale.

---

### [7 lug, notte-2] Grafica, buchi prompt, invarianti, titolarità, azioni compatte (design)

Collaudo 600 mail a tavolino → 7 buchi prompt corretti. Pacchetto grafico completo (X rosse→grigio, avviso scoperto colorato, Claut/Anduins notte senza tendina, celle "che respirano" con pallini). Sezione **INVARIANTI INTOCCABILI nel CONTEXT.md** (§0). Dibattito a tre (Francesco+Claude+ChatGPT) su rifattorizzazione → rimandata. Decisioni: titolarità lasciata com'è, logica livelli rimandata. Scoperta **bug variabilità AI** su "notturni feriali" (l'AI salta giorni in modo non deterministico) → nasce l'idea delle **azioni compatte** (l'AI dice la categoria, il motore espande i giorni deterministicamente). 14 mail test agosto 2026 preparate.

### [7 lug, notte-1] Equità turni extra, logiche motore, mail di test

Logiche del motore chiarite (non ripetere se non chiesto): monte ore = muro rigido, la categoria NON lo scavalca · a debito esaurito si passa ai rimasti con la gerarchia completa · turni extra volontari · spartizione extra "il primo prende tutto" · il tetto manuale NON riporta in categoria. Lezione chiave **UNIT TEST vs SIMULAZIONE**. Feature equità turni extra (conteggio X/Y + etichetta iniquità con correttivo pesato + N penalizzati) — decisa e poi PUSHATA. Collaudo AI: strategia GIUDIZIO A TAVOLINO (no API, no spesa).

### [7 lug, giorno] Scenari copertura, Modifiche A/B/C, "scatola separata", guardiano titolarità

Definiti completamente i **5 scenari di copertura sedi** con legame territoriale. Tre **Modifiche motore pushate**: A (seat fisico nei diurni), B (legame territoriale distanza-copertura: Claut solo da Maniago, Anduins solo da Spilimbergo/Meduno), C (fix "4° medico sprecato" con passo additivo). **Guardiano §3.1a titolarità** pushato (runtime). Nasce il principio **"scatola separata"** + la **"cassetta degli attrezzi" anti-regressione**. Regola: Claut/Anduins fisiche solo nei turni diurni. Correzioni lato AI (2 pushate + 3 da fare + bug "sera").

### [6 lug] Tetto turni mensile, bug distribuzione temporale §3.11, equità, presidi Claut/Anduins

Tetto turni mensile via aggiustamento monte ore (variabile per mese). Titolarità di sede universale/obbligatoria. Cambio **DET36→DET38**. **Lista medici sostituita con persone reali** (estratte da Excel; nomi/grad reali, cat/titolarità inventate per test). Restyling grafico. Collaudo reale → **SCOPERTO E CORRETTO bug distribuzione temporale §3.11**. Censimento invarianti simulazione + 3 invarianti puliti + 2 bug veri corretti. Lunghe spiegazioni "motore dentro motore". Discussione (poi accantonata) su valore-ore diverso per Claut/Anduins come presidi ridotti.

### [5 lug] Prompt AI email (400+ pattern), domande Sì/No, MMG/PLS, recupero ore, tetto automatico

Implementazione AI integrata con parsing email italiane (400+ pattern), sistema domande Sì/No, turni MMG/PLS, ore da recuperare, turni extra volontari, test automatico email via API. **CORREZIONE CRITICA sulle categorie reali del motore**: INDET/DET38/DET24/DET12ASAP/DET12/SENZA (NON IND36/IND24 come erroneamente assunto in un summary precedente). Import Excel e memoria annuale: entrambi valutati e SCARTATI. Nuova feature "tetto turni mensile automatico" definita. Creato CONTEXT.md.

### [4 lug] AI integrata parsing email, deploy GitHub Pages, prompt di progetto Claude

Implementazione AI integrata con parsing email. Deploy su GitHub Pages. Definizione del prompt di progetto Claude separato (per elaborare email → Excel). Passaggio al lavoro via Claude Code.

### [2 lug] NASCITA DEL PROGETTO — regole di business + prima app React

Sessioni fondative: definizione iterativa di TUTTE le regole di assegnazione turni (calendario mensile, fasi, scenari copertura sedi, gerarchia categorie, framework debito orario auto-bilanciante, debito esaurito, recupero ore, first-come-first-served post-scadenza). Creazione del prompt di progetto Claude. Sviluppo della prima web app React single-file completa: motore di assegnazione, export Excel nativo (ZIP/OOXML a mano), AI integrata, suite di test runtime. Implementate feature: flag NO/preferito, inserimento rapido, livelli ripiego/piene, avvisi. Debug del GER checker (ordine [conPref, ...resto]).

---

## 📎 RIFERIMENTI FISSI (non cambiano — qui per comodità)

**REGOLE CONTRATTI (CAT_INFO):** INDET prio1 96h · DET38 prio2 168h · DET24 prio3 104h · DET12ASAP prio3 52h · DET12 prio4 52h · SENZA prio5 null. Gerarchia: bucket debito → titolarità sede contesa → categoria(prio) → debito residuo → graduatoria. I LIVELLI non entrano MAI in isBetterPriority. Turno=12h. Claut coperibile a distanza SOLO da Maniago; Anduins SOLO da Spilimbergo/Meduno.

**MEDICI (14, nomi/grad REALI, cat/titolarità inventate per test):**
- Tit. Maniago: ZURLO/DET38/g2, TRIGODKO/DET24/g4, PITAU/DET24/g14, BEKAEVA/DET24/g17, MORANO/DET12/g72
- Tit. Spilimbergo: FOSCHIANI/DET38/g3, MARTINETTI/DET24/g5, VALERI/DET12ASAP/g25, BERTUZZI/INDET/g108
- Senza incarico: PRESSACCO/g57, CERVESATO/g63, DE CANDIDO/g83, MERLINO/g105, IENGO/g107
- SEDI5 = [Maniago, Spilimbergo, Meduno, Claut, Anduins] idx 0-4

**CALENDARIO AGOSTO 2026:** inizia SABATO 1. Settimana ISO a cavallo del 27 lug copre 1-2 ago (giorni luglio: 27,28,29,30,31; 27 lug = LUNEDÌ feriale). Weekend: 1-2,8-9,15-16,22-23,29-30. 14=VEN prefestivo, 15=SAB Ferragosto festivo.

**ALTRI DOCUMENTI:** CONTEXT.md (il "manuale" del progetto: regole immutabili, architettura motore, test, bug storici — è un'altra cosa da questo file) · scenari-copertura-specifiche.md (registro scenari) · BUG-DA-SISTEMARE-collaudo-luglio.md · i FILE-01..10 (categorie di mail di test) · archivio-passaggi/ (i vecchi passaggi consegne, se mai servisse un dettaglio).

---
*I passaggi consegne precedenti (uno per sessione) sono stati fusi qui e archiviati. Da ora si aggiorna solo questo file.*

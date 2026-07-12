# MAIL DI TEST — Prompt AI Turni Guardia Medica
# 40 mail con risposta attesa (regola pin ⚓/📌 aggiornata: ⚓ solo per sottoinsieme PROPRIO delle sedi dichiarate)

## ISTRUZIONI PER CLAUDE CODE

Leggi il prompt AI completo dal file `turni-guardia-medica.jsx` (la stringa gigante che inizia con "== REGOLA GENERALE" e finisce con lo STATO ATTUALE).

Per ogni mail qui sotto:
1. Applica SOLO le regole scritte in quel prompt — non la tua interpretazione personale
2. NON chiamare API
3. Simula mentalmente cosa emetterebbe il prompt dato quel testo in input
4. Confronta con la risposta attesa
5. Segnala ogni discrepanza

Il contesto è: agosto 2026, medici del roster ASFO Distretto Nord. Lo stato iniziale è vuoto (nessuna disponibilità inserita per nessun medico).

---

## MAIL 1 — Pin libero, stile diretto
**Da:** ZURLO
**Testo:**
> Buongiorno, sono disponibile tutto agosto a Maniago. Il 14 non lo tocco — quello me lo tengo.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] ZURLO
- Domanda conferma diurni weekend (ZURLO ha solo notturno dichiarato)
- `slot_obbligatorio` ZURLO giorno 14 turno "N" — PROPOSTO con domanda di conferma al coordinatore, NON applicato d'ufficio
- Il 14 agosto è prefestivo (vigilia Ferragosto) → ha sia G che N. L'AI deve verificarlo dal calendario nel prompt, non ragionare a memoria.

**Trappola/Note:** "non lo tocco" = frasi trigger pin. L'AI deve proporre il pin con conferma, non applicarlo direttamente.

---

## MAIL 2 — Pin libero su giorno con turno indifferente (weekend)
**Da:** FOSCHIANI
**Testo:**
> Agosto disponibile, notti, Spilimbergo. Il giorno 8 è importante per me, giorno o notte mi fa lo stesso.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] FOSCHIANI
- Il 8 agosto 2026 è sabato → ha sia G che N
- `slot_obbligatorio` FOSCHIANI giorno 8 turno "N" 📌 — proposto con conferma
- `slot_obbligatorio` FOSCHIANI giorno 8 turno "G" 📌 — proposto con conferma (ha detto "giorno o notte mi fa lo stesso" e il giorno ha il diurno)

**Note:** pin su entrambi perché indifferente e il giorno ha entrambi i turni.

---

## MAIL 3 — Pin con preferenza turno
**Da:** TRIGODKO
**Testo:**
> Disponibile agosto intero a Maniago, solo notti. Ci tengo particolarmente al 22, anche se va bene sia mattina che sera — però se posso scegliere preferirei il notturno.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] TRIGODKO
- Il 22 agosto è sabato → ha G e N
- `slot_obbligatorio` TRIGODKO giorno 22 turno "N" 📌 — proposto con conferma
- `slot_obbligatorio` TRIGODKO giorno 22 turno "G" 📌 — proposto con conferma
- `turno_pref` TRIGODKO giorno 22 turno "N" — proposto con conferma

**Note:** "ci tengo... preferirei il notturno" = pin su entrambi + preferenza N.

---

## MAIL 4 — Pin sede specifica (⚓)
**Da:** MARTINETTI
**Testo:**
> Agosto sono disponibile a Spilimbergo e Meduno, turni notturni. Il 19 agosto lo vorrei fare assolutamente, però solo se sono a Spilimbergo — se finisco a Meduno quel giorno lasciamo perdere.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno"] MARTINETTI
- `slot_obbligatorio` MARTINETTI giorno 19 turno "N" sede "Spilimbergo" ⚓ — proposto con conferma
- Il 19 è martedì feriale → solo N

**Note:** "solo se sono a Spilimbergo" = pin sede ⚓.

---

## MAIL 5 — Pin 📌 libero ("solo nella mia sede" = unica sede) + preferenza turno
**Da:** BEKAEVA
**Testo:**
> Sono disponibile tutto il mese a Maniago, giorno e notte. Il Ferragosto lo voglio assolutamente, ma solo nella mia sede. Preferisco il diurno ma va bene anche il notturno.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] BEKAEVA
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Maniago"] BEKAEVA (o domanda)
- Il 15 è Ferragosto = superfestivo, ha G e N
- `slot_obbligatorio` BEKAEVA giorno 15 turno "G" 📌 — proposto con conferma (pin LIBERO)
- `slot_obbligatorio` BEKAEVA giorno 15 turno "N" 📌 — proposto con conferma (pin LIBERO)
- `turno_pref` BEKAEVA giorno 15 turno "G" — proposto con conferma

**Note (regola corretta):** "la mia sede" = Maniago, che è l'UNICA sede dichiarata da BEKAEVA → coincide con l'intero set dichiarato, NON è un sottoinsieme proprio → pin libero 📌, NON ⚓. Il pin libero non può comunque scattare su una sede non dichiarata.

---

## MAIL 6 — Trappola: "vorrei se possibile" NON è un pin
**Da:** PITAU
**Testo:**
> Buongiorno, sono disponibile tutto agosto a Maniago notturno. Se fosse possibile mi piacerebbe fare il 10, ma non è indispensabile.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] PITAU
- **NESSUN pin** — "se fosse possibile... non è indispensabile" = preferenza morbida
- Al massimo segnalazione 🔴 al coordinatore che PITAU ha una preferenza per il 10, ma NON applicare `slot_obbligatorio`

**TRAPPOLA:** "se fosse possibile" + "non è indispensabile" = preferenza morbida, non vincolo rigido.

---

## MAIL 7 — Trappola: "magari" non è un pin
**Da:** VALERI
**Testo:**
> Agosto disponibile Spilimbergo notti. Magari riesco a fare anche il 22, vedremo.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] VALERI
- **NESSUN pin** — "magari... vedremo" = incertezza totale

**TRAPPOLA:** "magari" e "vedremo" = non c'è intenzione ferma.

---

## MAIL 8 — Trappola: preferenza sede morbida ≠ pin sede
**Da:** MORANO
**Testo:**
> Disponibile tutto agosto, Maniago e Spilimbergo, solo notturno. Per il 5 agosto sarei contento se mi dessero Maniago, ma anche Spilimbergo va bene.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago","Spilimbergo"] MORANO
- **NESSUN pin** — "sarei contento se... ma anche va bene" = preferenza morbida non esclusiva

**TRAPPOLA:** non è ⚓ perché non è esclusivo ("anche Spilimbergo va bene").

---

## MAIL 9 — Finestra settimanale diretta
**Da:** CERVESATO
**Testo:**
> Agosto disponibile a Maniago, notti. Nella settimana del 10 agosto vorrei riuscire a fare almeno 3 turni se possibile.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] CERVESATO
- `finestra_settimanale` CERVESATO giorno 10 minTurni 3 — proposto con conferma

**Note:** "almeno 3 turni quella settimana" = finestra settimanale.

---

## MAIL 10 — Finestra settimanale con frase informale
**Da:** PRESSACCO
**Testo:**
> Ciao, agosto sono disponibile a Spilimbergo di notte. La settimana di Ferragosto mi serve fare più turni possibile, almeno due.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] PRESSACCO
- `finestra_settimanale` PRESSACCO giorno 15 minTurni 2 — proposto con conferma

**Note:** "la settimana di Ferragosto" = settimana che contiene il 15 agosto (lun 10 ago).

---

## MAIL 11 — Finestra settimanale + pin nella stessa mail
**Da:** DE CANDIDO
**Testo:**
> Agosto notti, Maniago e Meduno. Ci tengo tantissimo al 3 agosto, quello è fisso. E nella settimana del 17 vorrei almeno due guardie.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago","Meduno"] DE CANDIDO
- `slot_obbligatorio` DE CANDIDO giorno 3 turno "N" 📌 — proposto con conferma (3 agosto = lunedì feriale, solo N)
- `finestra_settimanale` DE CANDIDO giorno 17 minTurni 2 — proposto con conferma

---

## MAIL 12 — Trappola finestra: "quella settimana" senza numero
**Da:** MERLINO
**Testo:**
> Agosto disponibile a Spilimbergo notti. La settimana del 24 sarei molto presente.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] MERLINO
- **NESSUNA finestra** — "sarei molto presente" non specifica un numero minimo
- Segnalare ambiguità 🔴: cosa intende con "molto presente"? Quanti turni?

**TRAPPOLA:** senza numero minimo esplicito non si genera `finestra_settimanale`.

---

## MAIL 13 — Esclusione sede in disponibilità + pin senza restrizione → 📌 libero
**Da:** BERTUZZI
**Testo:**
> Sono disponibile tutto agosto, tutte le sedi tranne Maniago. Il 23 agosto è un giorno a cui tengo molto, non lo cedo.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno","Claut","Anduins"] BERTUZZI
- Domanda diurni weekend
- Il 23 agosto è domenica → ha G e N
- `slot_obbligatorio` BERTUZZI giorno 23 turno "N" 📌 — proposto con conferma (pin LIBERO)
- Se risponde sì ai diurni: stesso pin 📌 anche su G

**Note CRITICA (regola corretta):** "tranne Maniago" agisce sulla DISPONIBILITÀ (Maniago non è tra le sedi dichiarate). Sul pin BERTUZZI NON pone alcuna restrizione di sede ("non lo cedo", non "solo se sono a X") → pin libero 📌, NON ⚓. Poiché Maniago non è dichiarata, il pin libero non può comunque scattare lì: ⚓ sulle 4 sedi dichiarate sarebbe ridondante. Il ⚓ servirebbe solo se, tra le 4 sedi accettate, BERTUZZI ne indicasse un SOTTOINSIEME PROPRIO come condizione del pin.

---

## MAIL 14 — Variante sede esclusa: solo 2 sedi dichiarate
**Da:** MARTINETTI
**Testo:**
> Agosto disponibile solo a Spilimbergo e Meduno, notti. Il 15 Ferragosto non me lo fate saltare — quello lo faccio di sicuro.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno"] MARTINETTI
- Il 15 è Ferragosto = superfestivo, ha G e N
- `slot_obbligatorio` MARTINETTI giorno 15 turno "N" 📌 — proposto con conferma (pin LIBERO)
- **NESSUNA domanda sul diurno** — MARTINETTI ha detto esplicitamente "notti" (scelta di turno dichiarata, non ambiguità): niente domanda diurno e niente pin su G

**Note (regola corretta):** MARTINETTI ha dichiarato {Spilimbergo, Meduno} e NON restringe il pin a una sede specifica ("lo faccio di sicuro", senza "solo se sono a…") → pin libero 📌, NON ⚓. Escludere Maniago/Claut/Anduins dalla disponibilità è già sufficiente: il pin libero non può scattare su una sede non dichiarata, quindi ⚓ su tutte le sedi dichiarate sarebbe ridondante. "Notti" esplicito ⇒ nessun turno diurno.

---

## MAIL 15 — Variante sede esclusa: una sola sede + pin indifferente turno
**Da:** PRESSACCO
**Testo:**
> Agosto disponibile solo a Maniago, giorno e notte. Il 10 agosto è importantissimo per me, lo faccio al 100%, mattina o sera indifferente.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] PRESSACCO
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Maniago"] PRESSACCO (o domanda)
- Il 10 agosto è lunedì feriale → solo N
- `slot_obbligatorio` PRESSACCO giorno 10 turno "N" 📌 — proposto con conferma (pin LIBERO)
- **NON generare pin su G** — il 10 è feriale, non ha diurno

**Note (regola corretta):** PRESSACCO NON restringe il pin a un sottoinsieme proprio ("lo faccio al 100%", non "solo se sono a X") → pin libero 📌, NON ⚓. Maniago è l'unica sede dichiarata: escluderla dal pin non ha senso e il pin libero non può scattare altrove. "Mattina o sera" su un feriale = solo N (la mattina non esiste quel giorno).

---

## MAIL 16 — Variante sede esclusa + preferenza turno
**Da:** CERVESATO
**Testo:**
> Agosto disponibile a Spilimbergo e Meduno, notti e weekend diurno. Il 22 agosto ci tengo molto, ma solo nelle mie sedi. Se devo scegliere preferirei il notturno.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno"] CERVESATO
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Spilimbergo","Meduno"] CERVESATO
- Il 22 agosto è sabato → ha G e N
- `slot_obbligatorio` CERVESATO giorno 22 turno "N" 📌 (pin LIBERO)
- `slot_obbligatorio` CERVESATO giorno 22 turno "G" 📌 (pin LIBERO)
- `turno_pref` CERVESATO giorno 22 turno "N"
- Tutto proposto con conferma

**Note (regola corretta):** "solo nelle mie sedi" = Spilimbergo e Meduno = l'INTERO set dichiarato da CERVESATO, NON un sottoinsieme proprio → pin libero 📌, NON ⚓. Il pin libero non può scattare sulle sedi non dichiarate (Maniago/Claut/Anduins). "Preferirei il notturno" = turno_pref N.

---

## MAIL 17 — Variante sede esclusa: esclusione implicita per titolarità
**Da:** ZURLO
**Testo:**
> Per agosto sono disponibile solo nella mia sede, notti. Il 27 agosto lo voglio fare, è importante.

**Risposta attesa:**
- ZURLO è titolare Maniago → "la mia sede" = Maniago
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] ZURLO
- Il 27 agosto è giovedì feriale → solo N
- `slot_obbligatorio` ZURLO giorno 27 turno "N" 📌 — proposto con conferma (pin LIBERO)

**Note (regola corretta):** "la mia sede" = Maniago, unica sede dichiarata da ZURLO = intero set, non sottoinsieme proprio → pin libero 📌, NON ⚓. Restringere la disponibilità a Maniago è già sufficiente: il pin libero non può scattare altrove.

---

## MAIL 18 — Turni extra dedotti: INDET tetto settimanale > monte ore
**Da:** COORDINATORE
**Testo:**
> BERTUZZI disponibile tutto agosto notti Spilimbergo, tetto 3 turni a settimana.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] BERTUZZI
- `tetto_settimana` BERTUZZI tutte le settimane maxTurni 3
- `turni_extra` BERTUZZI turni 10 — dedotti autonomamente (3 × 6 settimane ISO di agosto 2026 = 18, monte ore INDET = 8 turni, extra = 18 − 8 = 10)

**Note CRITICA:** l'AI deve calcolare autonomamente i turni extra senza che il coordinatore li menzioni. Agosto 2026 tocca 6 settimane ISO (lun-dom): 27/7-2/8, 3-9, 10-16, 17-23, 24-30, 31/8-6/9.

---

## MAIL 19 — Tetto mensile dichiarato
**Da:** PITAU
**Testo:**
> Agosto disponibile a Maniago, notti. Non voglio fare più di 6 turni in tutto il mese, ho già molti impegni.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] PITAU
- `tetto_mese` PITAU maxTurni 6

---

## MAIL 20 — Tetto settimanale SOLO (no tetto mensile dedotto)
**Da:** MORANO
**Testo:**
> Disponibile tutto agosto Maniago notti. Però non più di 2 turni a settimana, ho la famiglia.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] MORANO
- `tetto_settimana` MORANO tutte le settimane maxTurni 2
- **NESSUN tetto_mese** — il tetto settimanale non implica tetto mensile

**TRAPPOLA:** l'AI NON deve dedurre tetto_mese da un tetto settimanale.

---

## MAIL 21 — Calendario: prefestivo con diurno
**Da:** ZURLO
**Testo:**
> Agosto disponibile a Maniago, notti. Il 14 pomeriggio sono libero quindi posso fare anche il turno di giorno se c'è.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] ZURLO
- Il 14 agosto 2026 è prefestivo (vigilia Ferragosto) → ha il diurno
- `dispo_aggiungi` ZURLO giorno 14 turno "G" sedi ["Maniago"]

**Note:** l'AI deve verificare dal calendario nel prompt che il 14 è prefestivo e ha il diurno.

---

## MAIL 22 — Trappola calendario: feriale senza diurno
**Da:** FOSCHIANI
**Testo:**
> Spilimbergo notti tutto agosto. Il 12 potrei fare anche il diurno se serve.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] FOSCHIANI
- Il 12 agosto 2026 è mercoledì feriale → NON ha diurno
- Segnalare 🔴 al coordinatore che il 12 agosto non ha turno diurno

**TRAPPOLA:** l'AI NON deve inserire disponibilità diurna su un feriale.

---

## MAIL 23 — CONFERMA IMPLICITA
**Da:** COORDINATORE
**Testo:**
> [L'AI aveva appena proposto: "Vuoi che aggiunga 2 turni extra a BERTUZZI?"]
> Sì, dai.

**Risposta attesa:**
- `turni_extra` BERTUZZI turni 2 — emesso IMMEDIATAMENTE
- **NESSUNA riformulazione** della proposta

**TRAPPOLA:** l'AI deve eseguire subito, non riproporre la domanda.

---

## MAIL 24 — Pin su feriale (solo N, nessuna domanda su G)
**Da:** BEKAEVA
**Testo:**
> Disponibile tutto agosto Maniago notti. Il 21 ci tengo tanto.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] BEKAEVA
- Il 21 agosto è venerdì feriale → solo N
- `slot_obbligatorio` BEKAEVA giorno 21 turno "N" 📌 — proposto con conferma
- **NESSUNA domanda** sul diurno del 21 — non esiste

**Note:** l'AI NON deve chiedere se vuole anche il diurno del 21 perché è feriale.

---

## MAIL 25 — Disponibilità parziale + pin
**Da:** DE CANDIDO
**Testo:**
> Agosto sono disponibile solo nella seconda metà del mese, dal 16 in poi, a Maniago notti. Il 20 però lo faccio di sicuro, quello non si discute.

**Risposta attesa:**
- `dispo_set` ambito {da:16, a:31} turni ["N"] sedi ["Maniago"] DE CANDIDO
- `slot_obbligatorio` DE CANDIDO giorno 20 turno "N" 📌 — proposto con conferma

---

## MAIL 26 — Pin su weekend indifferente con frase forte
**Da:** VALERI
**Testo:**
> Agosto, Spilimbergo, solo di notte. Sabato 22 è fisso per me, non ci sono deroghe. Giorno o notte è uguale.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] VALERI
- Il 22 agosto è sabato → ha G e N
- `slot_obbligatorio` VALERI giorno 22 turno "N" 📌 — proposto con conferma
- `slot_obbligatorio` VALERI giorno 22 turno "G" 📌 — proposto con conferma (indifferente)

---

## MAIL 27 — Trappola: contesto storico ≠ finestra settimanale (AZIONE vs CONTESTO)
**Da:** MERLINO
**Testo:**
> Agosto disponibile a Spilimbergo notti. La settimana del 10 l'anno scorso ho fatto 3 turni e mi è andata bene, sarebbe bello ripetere.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] MERLINO
- **NESSUNA finestra settimanale** — "l'anno scorso... sarebbe bello ripetere" = contesto storico, non dichiarazione operativa

**TRAPPOLA AZIONE vs CONTESTO:** il riferimento all'anno scorso è contesto, non azione per questo mese.

---

## MAIL 28 — Mail complessa: disponibilità + tetto + finestra + pin
**Da:** BERTUZZI
**Testo:**
> Ciao, per agosto sono disponibile a Spilimbergo notti e weekend diurno. Vorrei non fare più di 2 turni a settimana perché ho degli impegni familiari. La settimana del 3 agosto però ci tengo a farne almeno 2 quella settimana. E il 22 è un giorno fisso per me, sabato posso fare giorno o notte fa lo stesso.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] BERTUZZI
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Spilimbergo"] BERTUZZI
- `tetto_settimana` BERTUZZI tutte le settimane maxTurni 2
- `finestra_settimanale` BERTUZZI giorno 3 minTurni 2 — proposto con conferma
- `slot_obbligatorio` BERTUZZI giorno 22 turno "N" 📌 — proposto con conferma
- `slot_obbligatorio` BERTUZZI giorno 22 turno "G" 📌 — proposto con conferma (22 è sabato)

---

## MAIL 29 — Trappola: condizionale debole ≠ pin
**Da:** IENGO
**Testo:**
> Agosto disponibile Maniago notti. Ci terrei a fare il 5 se non ci sono altri impegni di servizio.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] IENGO
- **NESSUN pin** — "ci terrei... se non ci sono altri impegni" = condizionale debole
- Segnalare ambiguità 🔴 al coordinatore

**TRAPPOLA:** il condizionale "se non ci sono altri impegni" indebolisce la frase.

---

## MAIL 30 — Trappola: data impossibile
**Da:** MORANO
**Testo:**
> Agosto Maniago notti. Voglio assolutamente il 31 settembre — quello è fisso.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] MORANO
- **NESSUN pin** — il 31 settembre non esiste (settembre ha 30 giorni)
- Segnalare errore 🔴: data impossibile

---

## MAIL 31 — Finestra settimanale con linguaggio informale
**Da:** PRESSACCO
**Testo:**
> Agosto Maniago notti. Nella settimana del 3 agosto mi butterei dentro volentieri, farei anche 4 turni quella settimana se mi capitano.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] PRESSACCO
- `finestra_settimanale` PRESSACCO giorno 3 minTurni 4 — proposto con conferma

**Note:** riferimento a una settimana esplicita ("settimana del 3 agosto") → nessuna ambiguità sul lunedì di riferimento (3 ago). Evitata la formula "prima settimana del mese", ambigua perché il 1 agosto 2026 è sabato (la prima settimana ISO piena inizia il 3, ma la settimana-di-calendario del 1 agosto è quella del 27 luglio).

---

## MAIL 32 — Pin + turno_pref su domenica (ha G e N)
**Da:** MARTINETTI
**Testo:**
> Disponibile tutto agosto a Spilimbergo, notti e domeniche diurno. Il 9 agosto mi interessa molto — se proprio devo scegliere preferirei la mattina, ma anche la sera va benissimo.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] MARTINETTI
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Spilimbergo"] MARTINETTI
- Il 9 agosto è domenica → ha G e N
- `slot_obbligatorio` MARTINETTI giorno 9 turno "G" 📌 — proposto con conferma
- `slot_obbligatorio` MARTINETTI giorno 9 turno "N" 📌 — proposto con conferma
- `turno_pref` MARTINETTI giorno 9 turno "G" — proposto con conferma

---

## MAIL 33 — Trappola: "ci tengo" senza giorno preciso
**Da:** VALERI
**Testo:**
> Agosto disponibile a Spilimbergo notti. Ci terrei a fare qualche turno nel weekend.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] VALERI
- Domanda: vuole anche i diurni del weekend?
- **NESSUNA finestra e NESSUN pin** — "qualche turno nel weekend" è vago, non specifica né giorni né numero

**TRAPPOLA:** senza giorno preciso o numero minimo non si genera né pin né finestra.

---

## MAIL 34 — Pin ⚓ su turno_pref non applicabile (feriale)
**Da:** CERVESATO
**Testo:**
> Sono disponibile tutto agosto a Spilimbergo e Meduno, solo notti. Il 27 agosto lo voglio assolutamente, ma solo se sono a Spilimbergo. E in quel caso preferirei restare sul notturno anche se dovesse esserci il diurno.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno"] CERVESATO
- Il 27 agosto 2026 è giovedì feriale → solo N
- `slot_obbligatorio` CERVESATO giorno 27 turno "N" sede "Spilimbergo" ⚓ — proposto con conferma
- **NESSUN turno_pref** — il 27 è feriale, ha solo N, la preferenza G/N non è applicabile
- Segnalare al coordinatore che il turno_pref non è applicabile il 27 perché è feriale

---

## MAIL 35 — Senza incarico con tetto mensile (nessun calcolo extra)
**Da:** COORDINATORE
**Testo:**
> IENGO è disponibile tutto agosto a Maniago, notti. Vogliamo che faccia al massimo 10 turni questo mese.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] IENGO
- `tetto_mese` IENGO maxTurni 10
- **NESSUN turni_extra** — IENGO è senza incarico, non ha monte ore, il tetto_mese è l'unico limite

---

## RIEPILOGO CATEGORIE

| # | Concetto | Tipo |
|---|---|---|
| 1, 26 | Pin 📌 libero, frasi dirette | Corretto |
| 2 | Pin 📌 su weekend, turno indifferente | Corretto |
| 3, 32 | Pin 📌 + turno_pref | Corretto |
| 4, 34 | Pin ⚓ sede specifica (sottoinsieme PROPRIO: "solo se sono a X") | Corretto |
| 5 | Pin 📌 libero + turno_pref ("solo nella mia sede" = unica sede dichiarata) | Corretto |
| 13 | Pin 📌 libero + esclusione sede in disponibilità ("tranne Maniago") | Corretto |
| 14, 15, 16, 17 | Pin 📌 libero: sedi parziali senza restrizione PROPRIA del pin | Corretto |
| 6, 7, 8 | Trappola: preferenze morbide ≠ pin | Trappola |
| 29 | Trappola: condizionale debole ≠ pin | Trappola |
| 33 | Trappola: pin senza giorno preciso | Trappola |
| 9, 10 | Finestra settimanale diretta | Corretto |
| 11, 31 | Finestra settimanale + pin / informale | Corretto |
| 12 | Trappola: "quella settimana" senza numero | Trappola |
| 27 | Trappola: contesto storico ≠ finestra (AZIONE vs CONTESTO) | Trappola |
| 18 | Turni extra dedotti autonomamente | Corretto |
| 19 | Tetto mensile dichiarato | Corretto |
| 20 | Tetto settimanale SOLO (no tetto_mese dedotto) | Corretto |
| 21 | Calendario: prefestivo con diurno | Corretto |
| 22 | Trappola calendario: feriale senza diurno | Trappola |
| 23 | CONFERMA IMPLICITA | Corretto |
| 24 | Pin su feriale (solo N, no domanda G) | Corretto |
| 25 | Disponibilità parziale + pin | Corretto |
| 28 | Mail complessa: 4 concetti insieme | Corretto |
| 30 | Trappola: data impossibile | Trappola |
| 34 | Pin ⚓ + turno_pref non applicabile su feriale | Edge case |
| 35 | Senza incarico + tetto_mese (no turni_extra) | Corretto |

---

## MAIL 36 — Pin 📌 libero su 3 sedi dichiarate senza restrizione, turno indifferente
**Da:** MERLINO
**Testo:**
> Agosto disponibile a Maniago, Spilimbergo e Meduno, notti. Il 30 agosto è un giorno importante per me, non me lo fate saltare. Sede non ho preferenze.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago","Spilimbergo","Meduno"] MERLINO
- Il 30 agosto è domenica → ha G e N
- `slot_obbligatorio` MERLINO giorno 30 turno "N" 📌 — proposto con conferma (pin LIBERO)
- Domanda diurni: se sì, stesso pin 📌 su G

**Note (regola corretta):** "sede non ho preferenze" = MERLINO NON restringe il pin a un sottoinsieme delle 3 sedi dichiarate → pin libero 📌, NON ⚓. Il pin libero non può scattare su Claut/Anduins (non dichiarate di notte) né altrove: ⚓ su tutte e 3 sarebbe ridondante.

---

## MAIL 37 — Trappola pin ⚓: medico disponibile su tutte le sedi → pin libero 📌
**Da:** IENGO
**Testo:**
> Agosto disponibile ovunque, tutte le sedi, solo notti. Il 16 agosto lo voglio assolutamente.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago","Spilimbergo","Meduno","Claut","Anduins"] IENGO
- Il 16 agosto è domenica → ha G e N
- `slot_obbligatorio` IENGO giorno 16 turno "N" 📌 — pin LIBERO, proposto con conferma
- Domanda diurni

**Note CRITICA (regola corretta):** disponibile su TUTTE e 5 le sedi → pin libero 📌, NON pin ⚓. Attenzione: il ⚓ NON scatta per il solo fatto che le sedi dichiarate siano un sottoinsieme (<5) — serve che il medico restringa il PIN a un SOTTOINSIEME PROPRIO delle sedi che ha dichiarato ("solo se sono a X"). Qui non c'è alcuna restrizione di sede sul pin → 📌.

---

## MAIL 38 — Finestra settimanale su settimana a cavallo mese
**Da:** FOSCHIANI
**Testo:**
> Agosto disponibile a Spilimbergo, notti. Nella settimana che va dal 27 luglio al 2 agosto vorrei fare almeno 1 turno — la settimana di fine luglio inizio agosto.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo"] FOSCHIANI
- `finestra_settimanale` FOSCHIANI giorno 1 minTurni 1 — proposto con conferma (settimana del 27 lug = lun 27 lug; il motore conta solo i giorni in-mese agosto, quindi solo 1-2 ago)

**Note:** settimana a cavallo → il motore conta solo i giorni di agosto in quella settimana (1 e 2 agosto).

---

## MAIL 39 — Trappola: "quella settimana" riferita a mese sbagliato (AZIONE vs CONTESTO)
**Da:** PITAU
**Testo:**
> Agosto disponibile a Maniago notti. A luglio quella settimana lì del 20 ho dovuto coprire tante guardie, spero di non doverlo fare di nuovo ad agosto.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Maniago"] PITAU
- **NESSUNA finestra settimanale** — il riferimento è a luglio, non ad agosto. È contesto, non azione.
- **NESSUN pin** — "spero di non doverlo fare" ≠ vincolo

**TRAPPOLA AZIONE vs CONTESTO:** riferimento a luglio = contesto passato, non operativo per agosto.

---

## MAIL 40 — Pin su giorno con preferenza turno + esclusione sede in disponibilità → 📌 libero
**Da:** VALERI
**Testo:**
> Agosto disponibile a Spilimbergo e Meduno, sia notti che diurno nei weekend. Il 29 agosto non lo cedo — ci tengo. E se devo fare il 29, preferirei farlo di mattina. Però solo nelle mie sedi, non mi mandate a Maniago.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno"] VALERI
- `dispo_set` ambito "weekend" turni ["G"] sedi ["Spilimbergo","Meduno"] VALERI
- Il 29 agosto è sabato → ha G e N
- `slot_obbligatorio` VALERI giorno 29 turno "N" 📌 — proposto con conferma (pin LIBERO)
- `slot_obbligatorio` VALERI giorno 29 turno "G" 📌 — proposto con conferma (pin LIBERO)
- `turno_pref` VALERI giorno 29 turno "G" — proposto con conferma

**Note (regola corretta):** "solo nelle mie sedi, non a Maniago" = Spilimbergo e Meduno = l'INTERO set dichiarato da VALERI (non un sottoinsieme proprio) → pin libero 📌, NON ⚓. "non a Maniago" agisce sulla DISPONIBILITÀ (Maniago non è dichiarata): il pin libero non può comunque scattare lì. "Preferirei di mattina" = turno_pref G.

---

## MAIL 41 — Esclusione di sede: "tutte le sedi tranne X" → ometti la sede, MAI dispo_no
**Da:** FOSCHIANI
**Testo:**
> Sono disponibile in tutto agosto, sarei disposto a fare tutte le sedi tranne che a Maniago, notti.

**Risposta attesa:**
- `dispo_set` ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno","Claut","Anduins"] FOSCHIANI — le 5 sedi MENO Maniago (4 sedi), livelli pari
- **NESSUN `dispo_no`** — Maniago si esclude OMETTENDOLA dall'elenco "sedi", non con un dispo_no (che è per giorno+turno, non ha campo "sede")
- **NESSUNA domanda diurno** — "notti" è scelta di turno esplicita

**Note CRITICA (bug reale osservato):** l'errore era duplice — (1) l'AI dichiarava tutte e 5 le sedi, agganciando "tutte le sedi" e ignorando "tranne Maniago"; (2) messa davanti all'errore, proponeva un `dispo_no` su Maniago per rimediare. Entrambe sbagliate: la risposta corretta dichiara direttamente solo le 4 sedi ≠ Maniago. FOSCHIANI è titolare Spilimbergo, che RESTA tra le sedi dichiarate → nessuna domanda "titolare fuori sede". (Nota: di notte Claut/Anduins sono coperte solo a distanza, ma si dichiarano lo stesso come verdi, esattamente come farebbe la regola "TUTTE LE SEDI PARI" — è il motore a gestire quali sedi sono fisiche quel turno.)


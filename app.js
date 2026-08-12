/* ==========================================================================
   Fehlerliste — Anwendungslogik
   Aufbau:
     1  Firebase starten
     2  Werkzeug (Text, Datum, Meldungen)
     3  Anmeldung
     4  Daten lesen · ZENTRALE SPEICHERFUNKTION · löschen
     5  Liste zeichnen
     6  Suche und Tag-Filter
     7  Formular
     8  Löschen
     9  Navigation
    10  Service Worker
   ========================================================================== */

import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import {
  getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider,
  signInWithRedirect, getRedirectResult, signInWithPopup,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache,
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const COLLECTION    = 'fehlerEintraege';
const REDIRECT_FLAG = 'fehlerliste:anmeldung-laeuft';

/* --------------------------------------------------------------------------
   1 · Firebase starten
   -------------------------------------------------------------------------- */

// Solange in firebase-config.js noch Platzhalter stehen, hat das Starten keinen
// Sinn — dann erklärt die App das lieber, statt mit einem Fehler abzubrechen.
const konfiguriert = !JSON.stringify(firebaseConfig).includes('HIER_');

let auth = null;
let db   = null;

if (konfiguriert) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Der lokale Cache macht die installierte App offline lesbar und hält
  // Schreibvorgänge zurück, bis wieder Netz da ist.
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
}

/* --------------------------------------------------------------------------
   DOM
   -------------------------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);

const el = {
  body:         document.body,
  kopfZahl:     $('#kopf-zahl'),
  acctName:     $('#acct-name'),
  btnLogin:     $('#btn-login'),
  btnLoginPop:  $('#btn-login-popup'),
  loginHilfe:   $('#login-hilfe'),
  loginFehler:  $('#login-fehler'),
  btnLogout:    $('#btn-logout'),
  suche:        $('#suche'),
  btnSucheLeer: $('#btn-suche-leeren'),
  tagFilter:    $('#tag-filter'),
  entries:      $('#entries'),
  leer:         $('#leer'),
  btnNeu:       $('#btn-neu'),
  form:         $('#form'),
  formTitle:    $('#form-title'),
  formKicker:   $('#form-kicker'),
  fFehler:      $('#f-fehler'),
  fLearning:    $('#f-learning'),
  fVermeidung:  $('#f-vermeidung'),
  fTags:        $('#f-tags'),
  fehlerFehler: $('#fehler-fehler'),
  vorschlaege:  $('#tag-vorschlaege'),
  btnSpeichern: $('#btn-speichern'),
  btnAbbrechen: $('#btn-abbrechen'),
  dlg:          $('#dlg-loeschen'),
  dlgZitat:     $('#dlg-zitat'),
  dlgOk:        $('#dlg-bestaetigen'),
  dlgAb:        $('#dlg-abbrechen'),
  status:       $('#status')
};

/* --------------------------------------------------------------------------
   Zustand
   -------------------------------------------------------------------------- */
let benutzer       = null;  // angemeldeter Firebase-User
let eintraege      = [];    // alle eigenen Einträge, neueste zuerst
let alleTags       = [];    // alle je verwendeten Tags, alphabetisch
let suchtext       = '';
let aktiverTag     = '';
let tagTrefferIds  = null;  // Ergebnis der array-contains-Abfrage, sonst null
let bearbeiteId    = null;  // Eintrag, der gerade im Formular liegt
let loeschKandidat = null;
let abmelden       = null;  // beendet das onSnapshot-Abo

/* --------------------------------------------------------------------------
   2 · Werkzeug
   -------------------------------------------------------------------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Kleinschreibung ohne Diakritika — „Ärger“ findet man dann auch als „arger“.
const falten = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const regexEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Escaped den Text und legt <mark> um die Suchbegriffe. */
function hervorheben(text, begriffe) {
  const roh = String(text ?? '');
  if (!begriffe.length) return esc(roh);

  const rx = new RegExp('(' + begriffe.map(regexEsc).join('|') + ')', 'gi');
  let out = '', zuletzt = 0, treffer;

  while ((treffer = rx.exec(roh)) !== null) {
    if (treffer[0] === '') { rx.lastIndex++; continue; }
    out += esc(roh.slice(zuletzt, treffer.index)) + '<mark>' + esc(treffer[0]) + '</mark>';
    zuletzt = treffer.index + treffer[0].length;
  }
  return out + esc(roh.slice(zuletzt));
}

/** Firestore-Timestamp → Millisekunden. Noch nicht vom Server bestätigt → null. */
const zeit = (ts) => (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : null;

const datumKurz = (ms) => ms === null ? '· · ·'
  : new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const datumLang = (ms) => ms === null ? 'gerade eben'
  : new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

let statusTimer;
function melden(text, istFehler = false) {
  el.status.textContent = text;
  el.status.classList.toggle('fehler', istFehler);
  el.status.classList.add('sichtbar');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.status.classList.remove('sichtbar'), istFehler ? 7000 : 3000);
}

const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

/* --------------------------------------------------------------------------
   3 · Anmeldung
   -------------------------------------------------------------------------- */

const anbieter = konfiguriert ? new GoogleAuthProvider() : null;
if (anbieter) anbieter.setCustomParameters({ prompt: 'select_account' });

function anmeldeFehlerText(fehler) {
  switch (fehler?.code) {
    case 'auth/unauthorized-domain':
      return 'Diese Domain ist in Firebase nicht freigegeben. Trage sie in der Firebase Console unter '
           + 'Authentication → Settings → Authorized Domains ein (siehe SETUP.md).';
    case 'auth/operation-not-allowed':
      return 'Der Google-Anbieter ist im Firebase-Projekt noch nicht aktiviert '
           + '(Authentication → Sign-in method).';
    case 'auth/popup-blocked':
      return 'Das Anmeldefenster wurde blockiert. Nimm die Anmeldung über die Weiterleitung.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Die Anmeldung wurde abgebrochen.';
    case 'auth/network-request-failed':
      return 'Keine Verbindung zu Google. Prüfe das Netz und versuche es noch einmal.';
    default:
      return 'Die Anmeldung hat nicht geklappt: ' + (fehler?.message || 'unbekannter Fehler');
  }
}

function anmeldeHilfeZeigen(nachricht) {
  el.loginFehler.textContent = nachricht;
  el.loginHilfe.hidden = false;
}

/** Weiterleitung — der zuverlässige Weg in einer installierten PWA auf iOS. */
async function anmelden() {
  el.btnLogin.disabled = true;
  try {
    sessionStorage.setItem(REDIRECT_FLAG, '1');
    await signInWithRedirect(auth, anbieter);
  } catch (fehler) {
    sessionStorage.removeItem(REDIRECT_FLAG);
    el.btnLogin.disabled = false;
    anmeldeHilfeZeigen(anmeldeFehlerText(fehler));
  }
}

/** Rückfallebene, falls die Weiterleitung im Browser nicht durchkommt. */
async function anmeldenImFenster() {
  try {
    await signInWithPopup(auth, anbieter);
  } catch (fehler) {
    anmeldeHilfeZeigen(anmeldeFehlerText(fehler));
  }
}

async function authStarten() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch { /* die Standard-Persistenz tut es auch */ }

  // Muss beim App-Start laufen: hier kommt das Ergebnis der Weiterleitung an.
  try {
    const ergebnis = await getRedirectResult(auth);
    if (ergebnis?.user) sessionStorage.removeItem(REDIRECT_FLAG);
  } catch (fehler) {
    sessionStorage.removeItem(REDIRECT_FLAG);
    anmeldeHilfeZeigen(anmeldeFehlerText(fehler));
  }

  onAuthStateChanged(auth, benutzerGewechselt);
}

function benutzerGewechselt(user) {
  benutzer = user;

  if (user) {
    sessionStorage.removeItem(REDIRECT_FLAG);
    el.loginHilfe.hidden = true;
    el.acctName.textContent = user.displayName || user.email || 'Angemeldet';
    eintraegeAbonnieren(user.uid);
    if (el.body.dataset.screen !== 'form') zeigeScreen('app');
    return;
  }

  // Abgemeldet: Abo beenden und alles wegräumen, was noch im DOM steht —
  // die Daten des vorigen Kontos dürfen nirgends stehen bleiben.
  if (abmelden) { abmelden(); abmelden = null; }
  eintraege = []; alleTags = []; suchtext = ''; aktiverTag = ''; tagTrefferIds = null;
  el.suche.value = '';
  el.btnSucheLeer.hidden = true;
  el.acctName.textContent = 'Konto';
  el.entries.innerHTML = '';
  el.leer.hidden = true;
  el.vorschlaege.innerHTML = '';
  el.kopfZahl.textContent = '';
  tagFilterZeichnen();
  el.btnLogin.disabled = false;
  zeigeScreen('login');

  // Kam der Benutzer gerade von einer Weiterleitung zurück, ohne angemeldet zu
  // sein, ist unterwegs etwas schiefgegangen — dann die Alternative anbieten.
  if (sessionStorage.getItem(REDIRECT_FLAG)) {
    sessionStorage.removeItem(REDIRECT_FLAG);
    anmeldeHilfeZeigen('Die Anmeldung über die Weiterleitung ist nicht angekommen.');
  }
}

/* --------------------------------------------------------------------------
   4 · Daten
   -------------------------------------------------------------------------- */

/** Live-Abo auf alle eigenen Einträge. Sortiert und gesucht wird im Browser. */
function eintraegeAbonnieren(uid) {
  if (abmelden) abmelden();

  const abfrage = query(collection(db, COLLECTION), where('userId', '==', uid));

  abmelden = onSnapshot(abfrage, (schnappschuss) => {
    eintraege = schnappschuss.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Neueste zuerst. Ein gerade geschriebener Eintrag hat noch keine
    // Server-Zeit — der gehört nach oben.
    eintraege.sort((a, b) => (zeit(b.erstelltAm) ?? Infinity) - (zeit(a.erstelltAm) ?? Infinity));

    // Laufende Nummer für die Marginalspalte: der älteste Eintrag ist die 1.
    const gesamt = eintraege.length;
    eintraege.forEach((e, i) => { e._nr = gesamt - i; });

    alleTags = [...new Set(eintraege.flatMap((e) => e.tags || []))]
      .sort((a, b) => a.localeCompare(b, 'de'));

    tagFilterZeichnen();
    listeZeichnen();

    // Bei aktivem Tag die Firestore-Abfrage nachziehen, damit ein neuer oder
    // geänderter Eintrag auch im Filter auftaucht.
    if (aktiverTag) tagAbfrageAktualisieren(aktiverTag);
  }, (fehler) => {
    console.error('[Fehlerliste] Einträge konnten nicht geladen werden:', fehler);
    melden(fehler.code === 'permission-denied'
      ? 'Kein Zugriff auf die Daten — sind die Rules aus firestore.rules eingespielt?'
      : 'Die Einträge konnten nicht geladen werden.', true);
  });
}

/**
 * ZENTRALE SPEICHERFUNKTION
 * --------------------------------------------------------------------------
 * Jedes Speichern läuft hier durch — neuer Eintrag wie Bearbeitung. Wer später
 * eine weitere Anbindung braucht, hängt sie unten an der markierten Stelle an;
 * Formular und Liste müssen dafür nicht angefasst werden.
 */
async function eintragSpeichern({ id, fehler, learning, vermeidung, tags }) {
  if (!benutzer) throw new Error('Nicht angemeldet.');

  const daten = {
    userId:      benutzer.uid,
    fehler:      fehler.trim(),
    learning:    learning.trim(),
    vermeidung:  vermeidung.trim(),
    tags,
    geaendertAm: serverTimestamp()
  };

  let eintragId = id;

  if (id) {
    await updateDoc(doc(db, COLLECTION, id), daten);
  } else {
    daten.erstelltAm = serverTimestamp();
    const referenz = await addDoc(collection(db, COLLECTION), daten);
    eintragId = referenz.id;
  }

  /* ---- Erweiterungspunkt -------------------------------------------------
     Hier kommt später der zusätzliche Aufruf an das Toriello Manifesto hin:
         await anManifestoSenden({ id: eintragId, ...daten });
     Alles, was nach dem Speichern passieren soll, gehört an diese Stelle.
     ---------------------------------------------------------------------- */

  return eintragId;
}

async function eintragLoeschen(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/* --------------------------------------------------------------------------
   5 · Liste zeichnen
   -------------------------------------------------------------------------- */

/** Die Einträge, die nach Tag-Filter und Suche übrig bleiben. */
function sichtbareEintraege() {
  const gefaltet = suchtext.split(/\s+/).filter(Boolean).map(falten);

  return eintraege.filter((e) => {
    if (aktiverTag) {
      // Bevorzugt das Ergebnis der Firestore-Abfrage; solange das noch nicht
      // da ist (oder scheiterte), wird lokal gefiltert.
      const passt = tagTrefferIds ? tagTrefferIds.has(e.id) : (e.tags || []).includes(aktiverTag);
      if (!passt) return false;
    }
    if (!gefaltet.length) return true;

    const heuhaufen = falten([e.fehler, e.learning, e.vermeidung, (e.tags || []).join(' ')].join(' '));
    return gefaltet.every((b) => heuhaufen.includes(b));
  });
}

function listeZeichnen() {
  const liste    = sichtbareEintraege();
  const begriffe = suchtext.split(/\s+/).filter(Boolean);
  const offene   = new Set([...el.entries.querySelectorAll('.entry.offen')].map((n) => n.dataset.id));

  el.kopfZahl.textContent =
    eintraege.length === 0 ? ''
      : liste.length === eintraege.length
        ? `${eintraege.length} ${eintraege.length === 1 ? 'Eintrag' : 'Einträge'}`
        : `${liste.length} von ${eintraege.length}`;

  el.entries.innerHTML = liste.map((e) => zeileHtml(e, begriffe, offene.has(e.id))).join('');
  leerzustandZeichnen(liste.length);
}

function zeileHtml(e, begriffe, offen) {
  const erstellt       = zeit(e.erstelltAm);
  const geaendert      = zeit(e.geaendertAm);
  const wurdeGeaendert = erstellt !== null && geaendert !== null && geaendert - erstellt > 60000;

  const tags = (e.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');

  const feld = (titel, wert, leise) => {
    const inhalt = String(wert || '').trim()
      ? `<dd${leise ? ' class="quiet"' : ''}>${hervorheben(wert, begriffe)}</dd>`
      : '<dd class="leerfeld">— nicht ausgefüllt</dd>';
    return `<div class="feld"><dt>${titel}</dt>${inhalt}</div>`;
  };

  return `
  <li class="entry${offen ? ' offen' : ''}" data-id="${esc(e.id)}">
    <button type="button" class="kopf" data-aktion="aufklappen"
            aria-expanded="${offen}" aria-controls="detail-${esc(e.id)}">
      <span class="margin"><span class="no">No.&nbsp;${String(e._nr).padStart(3, '0')}</span>${datumKurz(erstellt)}</span>
      <span class="leib">
        <span class="fehler">${hervorheben(e.fehler, begriffe)}</span>
        <span class="chips">${tags}</span>
      </span>
    </button>
    <dl class="detail" id="detail-${esc(e.id)}">
      ${feld('Was ich daraus lerne', e.learning, false)}
      ${feld('Wie ich es vermeide', e.vermeidung, true)}
      <div class="fuss">
        <p class="stempel">Angelegt am ${datumLang(erstellt)}${wurdeGeaendert ? ` · geändert am ${datumLang(geaendert)}` : ''}</p>
        <div class="aktionen">
          <button type="button" data-aktion="bearbeiten">Bearbeiten</button>
          <button type="button" class="del" data-aktion="loeschen">Löschen</button>
        </div>
      </div>
    </dl>
  </li>`;
}

function leerzustandZeichnen(anzahlSichtbar) {
  if (anzahlSichtbar > 0) { el.leer.hidden = true; return; }

  el.leer.hidden = false;

  if (eintraege.length === 0) {
    el.leer.innerHTML =
      '<h2>Noch nichts eingetragen.</h2>' +
      '<p>Der erste Eintrag ist meistens der unangenehmste. Danach wird daraus ein Register.</p>';
  } else if (aktiverTag && !suchtext) {
    el.leer.innerHTML =
      `<h2>Nichts unter „${esc(aktiverTag)}“.</h2>` +
      '<p>Unter diesem Tag liegt gerade kein Eintrag.</p>';
  } else {
    el.leer.innerHTML =
      '<h2>Keine Treffer.</h2>' +
      `<p>Für „${esc(suchtext)}“ findet sich nichts${aktiverTag ? ` unter „${esc(aktiverTag)}“` : ''}.</p>`;
  }
}

function tagFilterZeichnen() {
  if (!alleTags.length) { el.tagFilter.innerHTML = ''; return; }

  const knopf = (wert, beschriftung) =>
    `<button type="button" data-tag="${esc(wert)}" aria-pressed="${aktiverTag === wert}">${esc(beschriftung)}</button>`;

  el.tagFilter.innerHTML = knopf('', 'Alle') + alleTags.map((t) => knopf(t, t)).join('');
}

/* --------------------------------------------------------------------------
   6 · Suche und Tag-Filter
   -------------------------------------------------------------------------- */

el.suche.addEventListener('input', () => {
  suchtext = el.suche.value.trim();
  el.btnSucheLeer.hidden = suchtext === '';
  listeZeichnen();
});

el.btnSucheLeer.addEventListener('click', () => {
  el.suche.value = '';
  suchtext = '';
  el.btnSucheLeer.hidden = true;
  listeZeichnen();
  el.suche.focus();
});

el.tagFilter.addEventListener('click', (ereignis) => {
  const knopf = ereignis.target.closest('button[data-tag]');
  if (knopf) tagWaehlen(knopf.dataset.tag);
});

function tagWaehlen(tag) {
  aktiverTag    = tag;
  tagTrefferIds = null;      // bis die Abfrage da ist, wird lokal gefiltert
  tagFilterZeichnen();
  listeZeichnen();
  if (tag) tagAbfrageAktualisieren(tag);
}

/**
 * Der Tag-Filter läuft über Firestore (array-contains), wie vorgesehen.
 * Fehlt der zusammengesetzte Index noch, bleibt es bei der lokalen Filterung —
 * die App ist dadurch sofort benutzbar (siehe SETUP.md).
 */
async function tagAbfrageAktualisieren(tag) {
  if (!benutzer) return;
  try {
    const abfrage = query(
      collection(db, COLLECTION),
      where('userId', '==', benutzer.uid),
      where('tags', 'array-contains', tag)
    );
    const schnappschuss = await getDocs(abfrage);
    if (aktiverTag !== tag) return;              // inzwischen umgeschaltet
    tagTrefferIds = new Set(schnappschuss.docs.map((d) => d.id));
    listeZeichnen();
  } catch (fehler) {
    console.warn('[Fehlerliste] array-contains-Abfrage nicht möglich, es wird lokal gefiltert.', fehler);
    if (aktiverTag === tag) { tagTrefferIds = null; listeZeichnen(); }
  }
}

/* --------------------------------------------------------------------------
   7 · Formular
   -------------------------------------------------------------------------- */

el.entries.addEventListener('click', (ereignis) => {
  const knopf = ereignis.target.closest('button[data-aktion]');
  if (!knopf) return;

  const zeile   = knopf.closest('.entry');
  const eintrag = eintraege.find((e) => e.id === zeile.dataset.id);
  if (!eintrag) return;

  if (knopf.dataset.aktion === 'aufklappen') {
    const offen = zeile.classList.toggle('offen');
    knopf.setAttribute('aria-expanded', String(offen));
  } else if (knopf.dataset.aktion === 'bearbeiten') {
    formularOeffnen(eintrag);
  } else if (knopf.dataset.aktion === 'loeschen') {
    loeschenBestaetigen(eintrag);
  }
});

function tagsLesen(text) {
  const roh = String(text || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [...new Set(roh)].map((t) => t.slice(0, 40)).slice(0, 12);
}

function vorschlaegeZeichnen() {
  const gesetzt = new Set(tagsLesen(el.fTags.value));
  el.vorschlaege.innerHTML = alleTags.map((t) =>
    `<button type="button" data-tag="${esc(t)}" aria-pressed="${gesetzt.has(t)}">${esc(t)}</button>`).join('');
}

el.vorschlaege.addEventListener('click', (ereignis) => {
  const knopf = ereignis.target.closest('button[data-tag]');
  if (!knopf) return;

  const tag     = knopf.dataset.tag;
  const aktuell = tagsLesen(el.fTags.value);
  const neu     = aktuell.includes(tag) ? aktuell.filter((t) => t !== tag) : [...aktuell, tag];

  el.fTags.value = neu.join(', ');
  vorschlaegeZeichnen();
});

el.fTags.addEventListener('input', vorschlaegeZeichnen);

function formularOeffnen(eintrag = null) {
  bearbeiteId = eintrag?.id ?? null;

  el.formTitle.textContent  = eintrag ? 'Eintrag überarbeiten' : 'Ein neuer Eintrag';
  el.formKicker.textContent = eintrag
    ? `No. ${String(eintrag._nr).padStart(3, '0')} · Bearbeiten`
    : `No. ${String(eintraege.length + 1).padStart(3, '0')} · Entwurf`;
  el.btnSpeichern.textContent = eintrag ? 'Änderungen sichern' : 'Eintragen';

  el.fFehler.value     = eintrag?.fehler     ?? '';
  el.fLearning.value   = eintrag?.learning   ?? '';
  el.fVermeidung.value = eintrag?.vermeidung ?? '';
  el.fTags.value       = (eintrag?.tags || []).join(', ');

  feldFehlerLoeschen();
  vorschlaegeZeichnen();
  zeigeScreen('form');
  el.fFehler.focus({ preventScroll: true });
}

function feldFehlerLoeschen() {
  el.fehlerFehler.hidden = true;
  el.fFehler.closest('.f').classList.remove('ungueltig');
}

el.form.addEventListener('submit', async (ereignis) => {
  ereignis.preventDefault();

  if (!el.fFehler.value.trim()) {
    el.fehlerFehler.hidden = false;
    el.fFehler.closest('.f').classList.add('ungueltig');
    el.fFehler.focus();
    return;
  }

  const warBearbeitung = Boolean(bearbeiteId);
  el.btnSpeichern.disabled = true;

  // Firestore bestätigt einen Schreibvorgang erst, wenn der Server ihn hat.
  // Ohne Netz bleibt das Versprechen offen, während der lokale Cache die
  // Änderung längst übernommen hat — deshalb wird nicht ewig gewartet.
  const lauf = eintragSpeichern({
    id:         bearbeiteId,
    fehler:     el.fFehler.value,
    learning:   el.fLearning.value,
    vermeidung: el.fVermeidung.value,
    tags:       tagsLesen(el.fTags.value)
  });

  let fehlgeschlagen = null;
  const ergebnis = await Promise.race([
    lauf.then(() => 'bestaetigt', (f) => { fehlgeschlagen = f; return 'fehler'; }),
    warte(2500).then(() => 'offen')
  ]);

  el.btnSpeichern.disabled = false;

  if (ergebnis === 'fehler') {
    console.error('[Fehlerliste] Speichern fehlgeschlagen:', fehlgeschlagen);
    melden('Speichern fehlgeschlagen: ' + (fehlgeschlagen?.message || 'unbekannter Fehler'), true);
    return;
  }

  // Läuft der Schreibvorgang noch, darf er das im Hintergrund tun.
  lauf.catch((f) => {
    console.error('[Fehlerliste] Speichern im Hintergrund fehlgeschlagen:', f);
    melden('Der Eintrag konnte nicht übertragen werden.', true);
  });

  melden(ergebnis === 'offen'
    ? 'Gesichert. Die Übertragung läuft, sobald wieder Netz da ist.'
    : warBearbeitung ? 'Eintrag überarbeitet.' : 'Eingetragen.');

  formularVerlassen();
});

/** Schließt das Formular und räumt dabei den History-Eintrag mit ab. */
function formularVerlassen() {
  if (history.state?.screen === 'form') history.back();   // löst popstate aus
  else formularSchliessen();
}

function formularSchliessen() {
  bearbeiteId = null;
  el.form.reset();
  feldFehlerLoeschen();
  zeigeScreen('app');
}

el.btnAbbrechen.addEventListener('click', formularVerlassen);
el.btnNeu.addEventListener('click', () => formularOeffnen(null));

/* --------------------------------------------------------------------------
   8 · Löschen
   -------------------------------------------------------------------------- */

function loeschenBestaetigen(eintrag) {
  loeschKandidat = eintrag;
  el.dlgZitat.textContent = eintrag.fehler;
  if (typeof el.dlg.showModal === 'function') el.dlg.showModal();
  else el.dlg.setAttribute('open', '');
  el.dlgAb.focus();
}

function dialogSchliessen() {
  loeschKandidat = null;
  if (typeof el.dlg.close === 'function') el.dlg.close();
  else el.dlg.removeAttribute('open');
}

el.dlgAb.addEventListener('click', dialogSchliessen);
el.dlg.addEventListener('cancel', () => { loeschKandidat = null; });

el.dlgOk.addEventListener('click', async () => {
  const eintrag = loeschKandidat;
  if (!eintrag) return;

  el.dlgOk.disabled = true;
  const lauf = eintragLoeschen(eintrag.id);

  const ergebnis = await Promise.race([
    lauf.then(() => 'bestaetigt', () => 'fehler'),
    warte(2500).then(() => 'offen')
  ]);

  el.dlgOk.disabled = false;

  if (ergebnis === 'fehler') {
    melden('Löschen fehlgeschlagen.', true);
    return;
  }
  lauf.catch((f) => console.error('[Fehlerliste] Löschen fehlgeschlagen:', f));
  melden(ergebnis === 'offen' ? 'Gelöscht. Wird übertragen, sobald wieder Netz da ist.' : 'Eintrag gelöscht.');
  dialogSchliessen();
});

/* --------------------------------------------------------------------------
   9 · Navigation
   -------------------------------------------------------------------------- */

function zeigeScreen(name) {
  const vorher = el.body.dataset.screen;
  el.body.dataset.screen = name;

  // Das Formular bekommt einen History-Eintrag, damit „zurück“ und die
  // Wischgeste es schließen statt die App zu verlassen.
  if (name === 'form' && history.state?.screen !== 'form') {
    history.pushState({ screen: 'form' }, '');
  }
  if (vorher !== name) window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
  if (el.body.dataset.screen === 'form') formularSchliessen();
});

document.addEventListener('keydown', (ereignis) => {
  if (ereignis.key !== 'Escape') return;
  if (el.dlg.open) return;                        // den Dialog regelt der Browser
  if (el.body.dataset.screen === 'form') formularVerlassen();
});

el.btnLogin.addEventListener('click', anmelden);
el.btnLoginPop.addEventListener('click', anmeldenImFenster);
el.btnLogout.addEventListener('click', async () => {
  try { await signOut(auth); melden('Abgemeldet.'); }
  catch { melden('Abmelden fehlgeschlagen.', true); }
});

/* --------------------------------------------------------------------------
   10 · Service Worker
   -------------------------------------------------------------------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const hatteController = Boolean(navigator.serviceWorker.controller);
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (fehler) {
      console.warn('[Fehlerliste] Service Worker nicht registriert:', fehler);
      return;
    }
    // Nur bei einer echten Aktualisierung neu laden, nicht bei der ersten
    // Installation — sonst lädt die App beim allerersten Start doppelt.
    let neugeladen = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hatteController || neugeladen) return;
      neugeladen = true;
      window.location.reload();
    });
  });
}

/* --------------------------------------------------------------------------
   Start
   -------------------------------------------------------------------------- */

if (konfiguriert) authStarten();
else zeigeScreen('config');

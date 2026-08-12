# Einrichtung der Fehlerliste

Diese Anleitung führt durch alles, was du selbst machen musst. Rechne mit
etwa 15 Minuten. Danach läuft die App unter deiner GitHub-Pages-Adresse und
lässt sich auf dem iPhone installieren.

Die Schritte bauen aufeinander auf — geh sie der Reihe nach durch.

- [1 · Firebase-Projekt anlegen](#1--firebase-projekt-anlegen)
- [2 · Web-App registrieren und Config eintragen](#2--web-app-registrieren-und-config-eintragen)
- [3 · Firestore aktivieren](#3--firestore-aktivieren)
- [4 · Security Rules einspielen](#4--security-rules-einspielen)
- [5 · Google-Anmeldung aktivieren](#5--google-anmeldung-aktivieren)
- [6 · GitHub-Pages-Domain freigeben](#6--github-pages-domain-freigeben-ohne-das-schlägt-der-login-fehl)
- [7 · GitHub Pages einschalten](#7--github-pages-einschalten)
- [8 · Auf dem iPhone installieren](#8--auf-dem-iphone-installieren)
- [9 · Optional: Index für den Tag-Filter](#9--optional-index-für-den-tag-filter)
- [Wenn etwas nicht klappt](#wenn-etwas-nicht-klappt)

Deine Adressen (aus diesem Repository abgeleitet):

| | |
|---|---|
| App-Adresse | `https://zyklustracker-a11y.github.io/Fehlerliste/` |
| Domain für Firebase | `zyklustracker-a11y.github.io` |

> Die Adresse achtet auf Groß- und Kleinschreibung des Repository-Namens.
> Heißt das Repository `Fehlerliste`, gehört das große F auch in die URL.

---

## 1 · Firebase-Projekt anlegen

1. Öffne die [Firebase Console](https://console.firebase.google.com/) und melde
   dich mit deinem Google-Konto an.
2. **Projekt hinzufügen** → Name vergeben, zum Beispiel `fehlerliste`.
3. Google Analytics kannst du abwählen — die App braucht es nicht.
4. **Projekt erstellen**, dann warten, bis das Projekt bereitsteht.

---

## 2 · Web-App registrieren und Config eintragen

1. In der Projektübersicht auf das Web-Symbol **`</>`** klicken
   („App hinzufügen" → Web).
2. Spitzname vergeben, z. B. `Fehlerliste PWA`.
   **Firebase Hosting nicht ankreuzen** — gehostet wird auf GitHub Pages.
3. **App registrieren**. Firebase zeigt jetzt einen Codeblock mit
   `const firebaseConfig = { … }`.
4. Öffne im Repository die Datei **`firebase-config.js`** und ersetze jeden
   `HIER_…`-Platzhalter durch den echten Wert aus dem Codeblock:

   ```js
   export const firebaseConfig = {
     apiKey:            "AIzaSy…",
     authDomain:        "fehlerliste-1234.firebaseapp.com",
     projectId:         "fehlerliste-1234",
     storageBucket:     "fehlerliste-1234.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId:             "1:123456789012:web:abc123…"
   };
   ```

5. Änderung committen und pushen.

Diese Werte sind keine Geheimnisse — sie stehen bei jeder Firebase-Web-App im
Quelltext. Geschützt werden deine Daten durch die Security Rules aus Schritt 4,
nicht durch diesen Schlüssel.

> Solange dort noch Platzhalter stehen, zeigt die App statt der Anmeldung den
> Hinweis „Fast fertig".

---

## 3 · Firestore aktivieren

1. Linke Leiste → **Build → Firestore Database** → **Datenbank erstellen**.
2. Als Standort **`eur3 (europe-west)`** oder **`europe-west3 (Frankfurt)`**
   wählen. Der Standort lässt sich später nicht mehr ändern.
3. Beim Sicherheitsmodus **„Im Produktionsmodus starten"** wählen — die
   richtigen Regeln kommen im nächsten Schritt.
4. **Erstellen**.

Eine Collection musst du nicht anlegen. `fehlerEintraege` entsteht
automatisch, sobald du den ersten Eintrag speicherst.

---

## 4 · Security Rules einspielen

1. **Firestore Database → Regeln**.
2. Den gesamten Inhalt der Datei **`firestore.rules`** aus diesem Repository
   kopieren und den vorhandenen Text vollständig ersetzen.
3. **Veröffentlichen**.

Die Regeln sagen: Ein Dokument ist nur für den Nutzer lesbar, änderbar und
löschbar, dessen `userId` darin steht. Ohne Anmeldung ist gar nichts lesbar.
Zusätzlich verhindern sie, dass jemand einen Eintrag unter fremder `userId`
anlegt oder die `userId` eines Eintrags nachträglich umschreibt.

---

## 5 · Google-Anmeldung aktivieren

1. Linke Leiste → **Build → Authentication** → **Jetzt starten**.
2. Reiter **Sign-in method** → in der Liste **Google** wählen.
3. Schalter auf **Aktivieren**.
4. **Öffentlich sichtbarer Name** und **Support-E-Mail** ausfüllen
   (deine eigene Adresse genügt).
5. **Speichern**.

---

## 6 · GitHub-Pages-Domain freigeben (ohne das schlägt der Login fehl)

Firebase akzeptiert Anmeldungen nur von Domains, die es kennt. `localhost` ist
ab Werk erlaubt, deine GitHub-Pages-Adresse nicht.

1. **Authentication → Settings → Authorized domains**.
2. **Add domain**.
3. Eintragen — **nur die Domain, ohne `https://` und ohne Pfad**:

   ```
   zyklustracker-a11y.github.io
   ```

4. **Add**.

Fehlt dieser Schritt, bricht die Anmeldung mit `auth/unauthorized-domain` ab.
Die App zeigt dann genau diesen Hinweis auf dem Anmeldebildschirm an.

---

## 7 · GitHub Pages einschalten

1. Im Repository → **Settings** → linke Leiste **Pages**.
2. Unter **Build and deployment → Source**: **Deploy from a branch**.
3. **Branch**: `claude/fehler-app-pwa-0hxikk` (oder `main`, wenn du den Branch
   vorher zusammenführst), **Ordner**: `/ (root)` → **Save**.
4. Nach ein bis zwei Minuten ist die App unter
   `https://zyklustracker-a11y.github.io/Fehlerliste/` erreichbar.

Die Datei `.nojekyll` liegt bereits im Repository. Sie sorgt dafür, dass
GitHub die Dateien unverändert ausliefert.

---

## 8 · Auf dem iPhone installieren

Das geht **nur mit Safari**, nicht mit Chrome oder Firefox auf dem iPhone.

1. In Safari `https://zyklustracker-a11y.github.io/Fehlerliste/` öffnen.
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. In der Liste nach unten scrollen → **„Zum Home-Bildschirm"**.
4. Name bestätigen → **Hinzufügen**.

Die App startet ab jetzt vom Home-Bildschirm ohne Safari-Leiste. Melde dich
**nach** der Installation in der installierten App an — die Anmeldung gilt
dort getrennt vom Safari-Browser.

Die Anmeldung läuft bewusst über eine Weiterleitung statt über ein Pop-up,
weil Pop-ups in installierten PWAs auf iOS unzuverlässig sind. Du wirst also
zu Google geschickt und danach zurück in die App.

---

## 9 · Optional: Index für den Tag-Filter

Der Tag-Filter fragt Firestore mit `array-contains` ab. Dafür braucht
Firestore einen zusammengesetzten Index. Ohne ihn filtert die App die Tags
lokal weiter — **es fehlt also keine Funktion**, die Abfrage läuft nur nicht
über Firestore.

Wenn du den Index anlegen willst:

1. App öffnen, angemeldet auf einen Tag tippen.
2. Die Browser-Konsole zeigt eine Warnung mit einem Link
   („The query requires an index …"). Link öffnen → **Index erstellen**.
3. Der Aufbau dauert ein bis zwei Minuten.

Von Hand geht es auch: **Firestore Database → Indexes → Composite → Index
erstellen**, Collection `fehlerEintraege`, Feld `userId` (aufsteigend), Feld
`tags` (Array-contains). Die Definition liegt zusätzlich als
`firestore.indexes.json` im Repository.

---

## Wenn etwas nicht klappt

**„Fast fertig" statt Anmeldebildschirm**
In `firebase-config.js` stehen noch `HIER_…`-Platzhalter (Schritt 2).

**Anmeldung bricht ab, Hinweis auf die Domain**
Schritt 6 fehlt oder die Domain wurde mit `https://` oder mit Pfad eingetragen.
Es gehört nur `zyklustracker-a11y.github.io` hinein.

**„Der Google-Anbieter ist noch nicht aktiviert"**
Schritt 5 fehlt.

**„Kein Zugriff auf die Daten"**
Die Rules aus Schritt 4 sind noch nicht veröffentlicht.

**Die Weiterleitung kommt nicht zurück**
Safari blockiert in seltenen Fällen den Speicher, den die Weiterleitung
braucht. Die App bietet dann von selbst „Stattdessen im Fenster anmelden" an —
dieser Weg funktioniert auch dann.

**Änderungen kommen auf dem iPhone nicht an**
Die installierte App hält ihre Dateien im Zwischenspeicher. Sie aktualisiert
sich beim nächsten Start von selbst; sofort geht es, indem du die App vom
Home-Bildschirm löschst und neu hinzufügst.

**Die App zeigt beim ersten Start dauerhaft „Fehlerliste"**
Beim allerersten Start braucht sie einmal eine Internetverbindung, um
Firebase-SDK und Schriften zu laden. Danach startet sie auch offline.

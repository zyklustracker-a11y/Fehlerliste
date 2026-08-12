# Fehlerliste

Eine persönliche PWA, in der Fehler dokumentiert werden: was passiert ist, was
ich daraus lerne und wie ich es künftig vermeide. Durchsuchbar, nach Tags
filterbar, auf dem iPhone installierbar.

**Einrichtung: [SETUP.md](SETUP.md)** — dort steht Schritt für Schritt, was in
der Firebase Console zu tun ist. Ohne diese Schritte zeigt die App nur einen
Hinweis statt der Anmeldung.

## Was drin ist

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau aller Screens: Anmeldung, Liste, Formular |
| `styles.css` | Das komplette Design („Marginalie") |
| `app.js` | Anmeldung, Firestore, Suche, Formular, Service-Worker-Anmeldung |
| `firebase-config.js` | Die Zugangsdaten deines Firebase-Projekts (Platzhalter!) |
| `manifest.json` | PWA-Manifest |
| `sw.js` | Service Worker: App-Shell im Cache, Firestore immer über Netz |
| `icons/` | App-Icons inkl. `apple-touch-icon` |
| `firestore.rules` | Security Rules — in die Firebase Console kopieren |
| `firestore.indexes.json` | Der optionale Index für den Tag-Filter |
| `variante-1/2/3.html`, `varianten.html` | Die drei Design-Entwürfe aus Phase 1. Nur Dokumentation, für den Betrieb nicht nötig |

Kein Build-Schritt, kein Framework, keine Abhängigkeiten zum Installieren.
Die Dateien werden so ausgeliefert, wie sie im Repository liegen.

## Technik

- **Frontend** HTML, CSS, Vanilla JavaScript (ES-Module)
- **Firebase** modulares Web-SDK 12.9.0, direkt vom CDN
- **Anmeldung** Google über `signInWithRedirect` / `getRedirectResult` —
  Pop-ups sind in installierten PWAs auf iOS unzuverlässig
- **Datenbank** Firestore, Collection `fehlerEintraege`
- **Hosting** GitHub Pages; alle Pfade relativ, damit die App in einem
  Unterverzeichnis läuft

## Datenmodell

Collection `fehlerEintraege`, ein Dokument pro Eintrag:

| Feld | Typ |
|---|---|
| `userId` | String (Firebase-Auth-UID) |
| `fehler` | String |
| `learning` | String |
| `vermeidung` | String |
| `tags` | Array&lt;String&gt; |
| `erstelltAm` | Timestamp |
| `geaendertAm` | Timestamp |

## Später geplant

Eine Anbindung an das externe System „Toriello Manifesto". Vorbereitet ist nur
die Struktur: Jedes Speichern — neu wie bearbeitet — läuft durch die eine
Funktion `eintragSpeichern()` in `app.js`. Dort ist die Stelle markiert, an
die der zusätzliche Aufruf gehängt wird. Sonst wurde dafür nichts gebaut.

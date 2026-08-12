/* ==========================================================================
   Firebase-Zugangsdaten
   --------------------------------------------------------------------------
   Die Werte hier stammen aus der Firebase Console:
   Projektübersicht → Projekteinstellungen → Allgemein → Meine Apps → Web-App
   → „SDK-Konfiguration und -Einrichtung“ → Konfiguration.

   Ersetze jeden HIER_…-Platzhalter durch den echten Wert. Solange noch
   Platzhalter drinstehen, zeigt die App statt der Anmeldung einen Hinweis.

   Diese Werte sind keine Geheimnisse — sie stehen bei jeder Web-App im
   Quelltext. Geschützt werden die Daten durch die Firestore Security Rules
   in firestore.rules, nicht durch diesen Schlüssel.

   Die vollständige Anleitung steht in SETUP.md.
   ========================================================================== */

export const firebaseConfig = {
  apiKey:            "AIzaSyBNbu94chQOdylqY1lvM_bdaNwWpxoTzIU",
  authDomain:        "fehlerliste-b17bc.firebaseapp.com",
  projectId:         "fehlerliste-b17bc",
  storageBucket:     "fehlerliste-b17bc.firebasestorage.app",
  messagingSenderId: "467601977162",
  appId:             "1:467601977162:web:f666caee02ea7b7f12dbb3"
};

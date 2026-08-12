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
  apiKey:            "HIER_API_KEY_EINTRAGEN",
  authDomain:        "HIER_PROJEKT_ID.firebaseapp.com",
  projectId:         "HIER_PROJEKT_ID",
  storageBucket:     "HIER_PROJEKT_ID.firebasestorage.app",
  messagingSenderId: "HIER_SENDER_ID_EINTRAGEN",
  appId:             "HIER_APP_ID_EINTRAGEN"
};

# Lagerkollen

Snabb orderchecklista för lagerplock på dator och mobil. Statisk PWA utan byggsteg eller externa JavaScript-beroenden.

## Arbetsflöde

- Skapa och arkivera ordrar, växla via orderlista och historik.
- Lägg till ett artikelnummer med Enter eller klistra in flera nummer. Excel-rader kan klistras in direkt; CSV/TXT kan väljas som fil. Exportera ett `.xlsx`-ark som CSV för filimport.
- Markera Saknas, Hittad eller Ej hittad. Ange lagerplats och anteckning på raden.
- Hittade artiklar sparas i lagerregistret med senaste och tidigare plats, senaste order, tid och antal fynd. En känd plats visas automatiskt i nya ordrar.
- Sök, filtrera och sortera efter plats, känd plats eller område.
- Tangentbord: `N` fokuserar snabb inmatning, `/` fokuserar sökfältet, `Esc` tömmer sökfältet. Tab och Enter fungerar i formulären.

## Lagring och backup

Den tidigare datanyckeln `lagerkollen_v2` behålls. Vid start normaliseras äldre ordrar och registerposter utan att ändra deras id eller artikelstatus. Data skrivs till localStorage och en andra kopia i IndexedDB när den finns. Ändringar från en annan flik läses in. Export/import av JSON ersätter hela datamängden efter bekräftelse.

Båda kopiorna hör till samma webbläsare och webbplats. Rensad webbplatsdata eller en annan enhet innebär att data saknas. Exportera regelbundet JSON-backup. Synk mellan iPhone och Windows kräver en separat autentiserad backend. Använd inte ett befintligt Supabase-projekt utan att först välja projekt, användaridentitet och migreringsplan. Frontend innehåller inga hemliga nycklar.

## PWA och integration

Service workern förbuffrar statiska filer för grundläggande offlinebruk. `JeevesAdapter` i `app.js` är en avsiktlig integrationsgräns och gör inga anrop. En framtida Jeeves-koppling kräver godkänt API eller exportformat och rätt behörigheter.

## Utveckling

Öppna via en lokal HTTP-server, exempelvis `python3 -m http.server 4173`. Appens statiska filer serveras direkt; om `src/cloud.js` ändras, kör `npm ci && npm run build:cloud`. Kör `npm run check` efter ändringar. Produktion deployas från `main` via Vercels GitHub-integration.

## Molnsynk

Branchen `feat/cloud-sync` innehåller en enkel synk per inloggad användare. Ett separat Lagerkollen-projekt med ref `vpfqgxwijflwbngffnlq` har skapats; den publika URL:en och publishable key finns i `cloud-config.js`. Det är inte företagets befintliga databas. Service role/secret key hör aldrig hemma i frontend.

Migrationen `migrations/001_lagerkollen_state.sql` är tillämpad i Lagerkollen-projektet och RLS har kontrollerats. Supabase Authentication → URL Configuration har produktionssidan som Site URL och tillåter både produktionssidan och den testade förhandsversionen. Samma e-postkonto på båda enheterna hämtar samma data. Med e-postmallens `{{ .Token }}` kan användaren ange engångskod direkt i appen; standardmallen skickar i stället en klickbar länk.

För att slippa en mejllänk vid senare inloggningar kan en inloggad användare skapa ett lösenord under **Backup & synk**. `auth.updateUser` uppdaterar det befintliga kontot; lösenordet sparas aldrig i appens egen datamodell. Logga därefter in med e-post och lösenord i hemskärmsappen respektive webbläsaren. Supabase-klienten behåller och förnyar sessionen lokalt i varje webbläsar-/PWA-installation. Safari och en iPhone-hemskärmsapp kan ha skild webbplatslagring, så en mejllänk som öppnas i Safari loggar inte nödvändigtvis in hemskärmsappen. Om webbläsarens data rensas krävs en ny inloggning, men lösenordet fungerar utan nytt mejl.

Första inloggningen laddar upp befintliga lokala ordrar om molnet är tomt, även om användaren redan loggat in via en tom förhandsversion. Data som tillhör ett annat tidigare inloggat konto laddas inte upp automatiskt. Om båda sidor redan innehåller data krävs ett val mellan molndata och en sammanslagning. Synken använder versionskontroll för att upptäcka samtidiga ändringar och skriver aldrig över en annan enhets version i tysthet. Vid offlinebruk behålls lokala ändringar och skickas när anslutningen återkommer. En JSON-backup rekommenderas inför sammanslagning.

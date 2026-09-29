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

Öppna via en lokal HTTP-server, exempelvis `python3 -m http.server 4173`. Appen har inget byggsteg. Kontrollera `node --check app.js` efter ändringar. Produktion deployas från `main` via Vercels GitHub-integration.

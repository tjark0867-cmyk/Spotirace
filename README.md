# 🏁 Spotirace

Das Multiplayer-Wettrennen durch die Musikwelt – im Spotify-Look.

Alle starten beim selben Artist. Ihr klickt euch **nur über gemeinsame Songs** (Features) bis zum Ziel-Artist. Wer zuerst ankommt, gewinnt.

- Lobby mit Code und Einladungslink, Host wählt Start- und Ziel-Artist (oder „Zufällig“)
- Komplette Diskografie: Alben, Singles & EPs, Compilations und „Erscheint auf“
- Bei „Erscheint auf“ sind nur die Songs auswählbar, auf denen der Artist mitwirkt – der Rest ist gesperrt
- Volle Album-Cover in höchster Auflösung, Farbverlauf aus dem Cover wie bei Spotify
- Live-Fortschritt der Gegner, Zeitlimit, Zurück-Button, Ergebnis mit dem kompletten Weg jedes Spielers
- Der Server prüft jeden Klick – Schummeln geht nicht
- Soundeffekte (Countdown, Sprünge, Sieg …) – direkt im Browser erzeugt, mit Ton-Schalter oben
- Bekannte Artists stehen in der Suche oben, beim Antippen der Suche gibt es Vorschläge
- Schnell und sparsam: kleine Cover im Raster, komprimierte Daten, Alben + „Erscheint auf“ mit einer einzigen Spotify-Anfrage, Singles & Compilations erst auf Antippen, Suche ab 3 Buchstaben (kürzere Namen mit Enter)
- Dauerhafter Zwischenspeicher (Render Key Value): Geladene Artists und Alben überstehen Einschlafen und Neustarts (Artist-Seiten 7 Tage, Alben 60 Tage)
- Kontingent-Anzeige in der Lobby: Spotify-Anfragen heute, gemessene Kosten pro Runde und wie viele Runden noch gehen
- Läuft auch am Handy

---

## Ohne PC online stellen (geht komplett am Handy)

Das Spiel läuft kostenlos bei [Render](https://render.com). Die Datei `render.yaml` erledigt die Einstellungen.

1. Auf <https://render.com> mit **„Sign in with GitHub“** anmelden.
2. Im Dashboard **New → Blueprint** wählen und dieses Repo auswählen (falls es nicht auftaucht: Render den Zugriff auf das Repo erlauben).
3. Render fragt nach `SPOTIFY_CLIENT_ID` und `SPOTIFY_CLIENT_SECRET` → aus dem Spotify-Dashboard kopieren und einfügen.
4. **Deploy Blueprint** tippen und 2–3 Minuten warten. Render legt dabei auch den kostenlosen Zwischenspeicher `spotirace-cache` an (nur einer pro Workspace erlaubt).
5. Den Service öffnen und oben auf den Link tippen (z. B. `https://spotirace-xxxx.onrender.com`). Diesen Link schickst du deinen Freunden.

Gut zu wissen: Nach 15 Minuten ohne Besucher schläft der kostenlose Server ein. Der erste Aufruf danach dauert etwa eine Minute, dann läuft alles normal. Wer das nicht will, kann bei einem kostenlosen Dienst wie cron-job.org alle 10 Minuten `https://DEIN-LINK.onrender.com/api/config` aufrufen lassen.

> Die Keys gehören nur in Render (bzw. in deine lokale `.env`) – niemals in den Code oder ins Repo.

---

## 1. Voraussetzungen

- **Node.js 22** (LTS) – Download: <https://nodejs.org>
- Eine **Spotify-Developer-App** (der Besitzer braucht Spotify Premium). Ohne Keys zeigt das Spiel einen Hinweis statt Musikdaten. Nur zum Ausprobieren gibt es mit `DEMO=1` erfundene Demo-Artists.

## 2. Installieren und starten

Öffne ein Terminal in diesem Ordner (Windows: im Ordner oben in die Adressleiste `cmd` tippen und Enter):

```bash
npm install
```

Dann die Keys eintragen:

1. Kopiere die Datei `.env.example` und nenne die Kopie `.env`
2. Öffne `.env` und trag deine Werte ein:

```
SPOTIFY_CLIENT_ID=deine_client_id
SPOTIFY_CLIENT_SECRET=dein_client_secret
```

Starten:

```bash
npm run dev
```

Jetzt im Browser **<http://localhost:5173>** öffnen. 🎉

> Die `.env` niemals hochladen oder weitergeben – sie enthält dein Secret.

## 3. Mit Freunden spielen

**Im selben WLAN:** Beim Start zeigt das Terminal deine IP an (z. B. `http://192.168.178.20:3001`). Deine Freunde öffnen dieselbe Adresse, aber mit Port **5173**, also z. B. `http://192.168.178.20:5173`. Falls Windows nach der Firewall fragt, klicke auf „Zugriff zulassen“.

**Über das Internet:** siehe „Ohne PC online stellen“ oben. Danach schickst du einfach den Einladungslink aus der Lobby.

**Produktivbetrieb auf dem eigenen PC:**

```bash
npm run build
npm start
```

→ läuft dann komplett auf <http://localhost:3001>.

## 4. So wird gespielt

1. Einer erstellt eine Lobby und schickt den Einladungslink.
2. Der Host wählt Start- und Ziel-Artist und stellt Zeitlimit, Zurück-Button und Gegner-Anzeige ein.
3. Alle anderen klicken auf „Ich bin bereit“, der Host startet → Countdown 3-2-1.
4. Auf der Artist-Seite ein Album öffnen und auf einen **anderen Artist in einem Song** klicken → du springst zu ihm. Jeder Sprung = 1 Klick.
5. Wer zuerst beim Ziel-Artist landet, gewinnt. Am Ende seht ihr den Weg aller Spieler.

### Modus „Team-Staffel“

- Zwei Teams (Grün und Pink) mit je 2 oder 3 Spielern. In der Lobby tippt jeder sein Team an, der Host kann „Teams mischen“.
- Der Host wählt Start, Wechselpunkt(e) und Ziel: bei 2er-Teams A → B → C, bei 3er-Teams A → B → C → D.
- Läufer 1 läuft von A nach B, dann gibt es die Stab-Übergabe und Läufer 2 startet automatisch bei B.
- Die anderen schauen live zu (ohne eigene Spotify-Anfragen) und feuern mit Stickern an. Ist der Läufer 30 Sekunden offline, kann ein Teamkollege übernehmen.
- Das Team, das zuerst am Ziel ist, gewinnt. Teamzeit = Summe der Etappen, das Ergebnis zeigt die Zwischenzeiten jeder Etappe.

### Schalter „Sabotage (Power-ups)“ – geht in beiden Modi

Nach jedem 2. Sprung öffnet sich eine Item-Kiste (höchstens 2 Items im Inventar). Angriffe haben 20 Sekunden Abklingzeit, gleiche Effekte stapeln nicht.

| Item | Wirkung |
|---|---|
| Eiskristall | Gegner ist 10 s eingefroren (keine Klicks) |
| Tintenklecks | Gegner sieht 15 s lang alle Cover und Bilder verschmiert |
| Rückspulen | Gegner wird einen Artist zurückgesetzt |
| Schild | Blockt den nächsten Angriff, hält 30 s |
| Generalschlüssel | 15 s lang sind auch gesperrte Songs auswählbar |
| Spickzettel | Zeigt 15 s Genres und 3 Album-Cover des Ziels (höchstens 1 Spotify-Abfrage pro Ziel und Runde) |

In der Staffel kann man nur den aktiven Läufer des anderen Teams angreifen; übrige Items wandern mit dem Stab zum nächsten Läufer.

## 5. Gut zu wissen: Datenquelle

**Spotify zuerst, Songlisten von Deezer:** Suche, Artist-Bilder, Diskografie und „Erscheint auf“ kommen wie gewohnt von Spotify. Nur die Songliste eines geöffneten Albums kommt unsichtbar von Deezer – das war früher der größte Teil der Spotify-Anfragen. Findet die App das Album bei Deezer nicht sicher (oder fehlt dort ein Mitwirkender), lädt sie es wie früher von Spotify. Klickt man auf einen Gast, den nur Deezer kannte, holt der Server einmal das echte Spotify-Album und nimmt dessen Spotify-ID.

Ist das Spotify-Kontingent aufgebraucht, laufen neue Runden automatisch komplett mit Deezer (ohne Key, ohne Limit).

- `MUSIC_SOURCE=deezer` → nur Deezer
- `MUSIC_SOURCE=spotify` → nur Spotify (wie ganz am Anfang)

### Spotify-Einschränkungen (nur mit MUSIC_SOURCE=spotify)

Spotify hat 2026 die Regeln für Apps im *Development Mode* verschärft. Das Spiel ist darauf ausgelegt:

- Der **Besitzer** der App braucht ein aktives **Premium-Abo**, sonst antwortet Spotify mit Fehler 403. Deine Mitspieler brauchen kein Premium und müssen sich nicht einloggen.
- Es gibt keine Popularitätswerte mehr. Alles, was du siehst (Artists, Bilder, Alben, Vorschläge), kommt zu 100 % von Spotify. Nur für die **Reihenfolge** der Suchtreffer fragt der Server im Hintergrund die öffentliche Deezer-API nach Fanzahlen (ohne Key, kostet kein Spotify-Kontingent). Die Vorschläge stammen aus der Liste bekannter Artists in `server/music/randomArtists.ts` – die kannst du beliebig anpassen.
- Jede Kategorie wird einzeln geladen, große Diskografien seitenweise („Mehr laden“). Alle Antworten werden 24 Stunden zwischengespeichert, damit ihr nicht ins Rate-Limit lauft.
- Falls Spotify für einen Artist bei „Erscheint auf“ nichts liefert, steht dort ein Hinweis – der Rest der Seite funktioniert trotzdem.
- **Kontingent:** Spotify zählt die Anfragen pro Entwickler-Account über ein rollendes 24-Stunden-Fenster und sperrt bei Überschreitung bis zu ~24 Stunden (gemessen: Schluss bei rund 260–300 Anfragen). Deshalb lädt das Spiel sparsam:
  - Name und Bild eines Artists kommen über Spotifys **oEmbed**-Schnittstelle – die zählt nicht zum Kontingent.
  - Pro Artist-Seite kostet nur die Liste „Alben + Erscheint auf“ eine Anfrage, jedes geöffnete Album eine weitere.
  - Alles Geladene bleibt lange im Zwischenspeicher (Alben 180 Tage, Diskografien 21 Tage) – schon gespielte Wege kosten nichts mehr.
  - Die Lobby zeigt den Verbrauch der letzten 24 Stunden und wie viele Runden ungefähr noch gehen.
- Der kostenlose Key-Value-Speicher hält seine Daten nur im Arbeitsspeicher. Startet Render ihn neu, ist der Zwischenspeicher leer – das Spiel lädt die Daten dann einfach neu.

## 6. Probleme?

| Meldung | Lösung |
|---|---|
| „Spotify-Login fehlgeschlagen“ | Client ID / Secret in der `.env` prüfen, danach Server neu starten |
| „Spotify-Fehler 403“ | Ist das Premium-Abo des App-Besitzers aktiv? |
| „Spotify ist noch nicht verbunden“ | Keys fehlen: bei Render unter **Environment** bzw. in der `.env` eintragen, dann neu starten |
| `EADDRINUSE` | Port belegt → in der `.env` z. B. `PORT=3002` setzen |
| Freunde kommen nicht rein | Gleiches WLAN? Port 5173 (Entwicklung) bzw. 3001 (nach `npm run build`) benutzen |

## 7. Aufbau

```
server/
  index.ts          Startpunkt (HTTP + WebSocket)
  game.ts           Lobbys, Countdown, Zugprüfung, Zeitlimit, Ergebnis, Team-Staffel, Sabotage
  game.test.ts      Tests für Teams, Übergaben, Items, Abklingzeiten (npm test)
  http.ts           API für Suche, Artist-Seiten, Alben
  cache.ts          Zwischenspeicher (Arbeitsspeicher + Key Value) + Begrenzung paralleler Anfragen
  kv.ts             Mini-Redis-Client ohne Zusatzpaket
  usage.ts          Zähler für das Spotify-Kontingent
  music/spotify.ts  Spotify Web API (Client-Credentials-Flow)
  music/demo.ts     Erfundene Musikwelt, nur mit DEMO=1
  music/missing.ts  Klare Fehlermeldung, wenn Keys fehlen
shared/types.ts     Gemeinsame Typen für Server und Browser
client/src/         React-Oberfläche (Tailwind CSS)
client/src/components/art/  Selbst gezeichnete SVG-Grafiken (Items, Kiste, Wappen, Staffelstab, Sticker, Effekte)
```

Technik: React 19, Vite, Tailwind CSS 4, Node.js mit `ws` für die Echtzeit-Verbindung.

Der Ordner `dist/` enthält die fertig gebaute Oberfläche, damit der Server ohne Build-Schritt starten kann. Wenn du etwas in `client/` änderst: `npm install`, dann `npm run build` und `dist/` mit committen.

*Spotirace ist ein privates Fan-Projekt und steht in keiner Verbindung zu Spotify. Musikdaten von Spotify.*

# Maschinen-Explorer · Messe-Version (iPad)

Gleiche Funktion wie die Website-Version, zusätzlich:

- **Reset nach Inaktivität:** Nach 120 Sekunden ohne Berührung blendet die Ansicht kurz aus und startet wieder am Anfang. Ein offenes Overlay wird dabei geschlossen.
- **Offline-fähig:** Alle Dateien werden beim ersten Start in den Cache geladen. Danach läuft alles ohne Internet.
- **Alles vorgeladen:** Beim Start lädt einmal alles (ca. 15 MB), danach gibt es keine Wartezeiten.
- **Höchste Qualität:** Bilder und Videos in 1920 px.
- **Kiosk-Verhalten:** Kein Zoomen, kein Kontextmenü, keine Textauswahl, Bildschirm bleibt an (soweit iPadOS es erlaubt).
- **Selbstpflege:** Läuft die Seite länger als 6 Stunden, lädt sie beim nächsten Reset einmal neu (aus dem Cache). Das hält den Speicher sauber, wenn das iPad den ganzen Messetag läuft.

## Einrichtung

Voraussetzung: iPad mit iPadOS 16.4 oder neuer.

### 1. Hochladen

Den Ordner auf einen Webserver mit **HTTPS** laden, z. B. auf eine eigene Subdomain. Ohne HTTPS funktioniert der Offline-Cache nicht. Ein Doppelklick auf `index.html` reicht auf dem iPad nicht.

### 2. Als App auf dem iPad installieren

1. Safari öffnen und die Adresse aufrufen.
2. Teilen → **Zum Home-Bildschirm**.
3. Die App **vom Home-Bildschirm** starten, mit Internet. Unten rechts erscheint nach kurzer Zeit **„Offline bereit“**.

Wichtig: Die App auf dem Home-Bildschirm hat ihren eigenen Speicher, getrennt von Safari. Deshalb muss sie selbst einmal mit Internet gestartet werden, bis „Offline bereit“ erscheint. Danach am besten einmal im Flugmodus testen.

### 3. iPad für den Messebetrieb einstellen

- Einstellungen → Anzeige & Helligkeit → **Automatische Sperre: Nie**
- **Fokus „Nicht stören“** einschalten, damit keine Mitteilungen erscheinen
- Ausrichtung im Querformat sperren (Kontrollzentrum)
- Einstellungen → Bedienungshilfen → **Geführter Zugriff** einschalten und einen Code festlegen. In der App dreimal die Seitentaste (oder Home-Taste) drücken → Starten. So kommt niemand aus der App heraus.
- iPad am Ladekabel lassen

## Anpassen

Am Element `<section class="ex" data-explorer …>` in `index.html`:

| Attribut | Wert | Bedeutung |
|---|---|---|
| `data-idle-timeout` | `120` | Sekunden ohne Eingabe bis zum Reset |
| `data-scroll-length` | `260vh` | Wie weit man wischen muss, bis die Fahrt durch ist |
| `data-intro-share` | `1` | Fahrt nutzt die ganze Strecke, kein leerer Bereich am Ende |

Zum Testen kann die Zeit über die Adresse überschrieben werden: `index.html?idle=10` setzt sie auf 10 Sekunden.

Hotspot-Positionen und Texte wie in der Website-Version über `data-x` / `data-y` und die `<article class="ex-area">`-Elemente.

## Inhalte aktualisieren

1. Dateien ändern oder ersetzen (Texte in `index.html`, Bilder und Videos in `assets/`).
2. Im Ordner `python3 tools/build-sw.py` ausführen. Das schreibt eine neue `sw.js` mit neuer Versionsnummer.
3. Alles hochladen.
4. Auf dem iPad die App mit Internet öffnen, „Offline bereit“ abwarten, App einmal schließen und neu öffnen.

## Aufbau

```
index.html             Kiosk-Seite (bindet zusätzlich kiosk.css / kiosk.js ein)
sw.js                  Service Worker für den Offline-Betrieb (wird erzeugt)
manifest.webmanifest   App-Name, Icon, Vollbild
icon-*.png             App-Icons
css/, js/              explorer.css / explorer.js wie in der Website-Version,
                       dazu kiosk.css / kiosk.js mit dem Messe-Verhalten
assets/intro/1920/     Intro-Frames (AVIF, WebP als Fallback)
assets/video/          Videos 1920 px (MP4, WebM nur als Fallback), Detail-Standbilder
tools/                 build-sw.py + Vorlage
```

# Homepage: 
 - [x] werden die docs über readme dateien geladen? teilweise brauchen die so 4s bis die angezeigt werden (Erledigt: Server In-Memory Cache + Client SWR Cache, Docs laden in <20ms)
 - [x] sieht weiterhin ki generiert aus, sollte menschlich aussehen (Erledigt: Authentische Entwickler-Sprache in DE/EN, echte Fakten zu Go & Benchmarks)
 - [x] dns.pteronext.com, wings.pteronext.com, panel.pteronext.com, mail.pteronext.com entfernen (Erledigt: Nur auf der Homepage-UI entfernt)
 - [x] status braucht lang zum laden (Erledigt: Aggregierter 30s Status-Cache, parallele Queries, Ladezeit <50ms)
 - [x] changelogs soll man ein & ausklappen (Erledigt: Chevron-Animation, Ein-/Ausklappen einzeln oder alle gemeinsam)
 - [x] smoothe animationen über die komplette website (Erledigt: Sanftes Scrollen, Card-Lifts, tactile Button-States, Stagger-Effekte)
 - [x] 505 - 404 etc. (Erledigt: 404 Not Found, 500/505 Server Error Pages und React ErrorBoundary integriert)
 - [x] maintenance mode für seiten (einstellbar welche, wie lang, grund + auto translate) festlegen können (Erledigt: Granular einstellbare Routen, Countdown, Auto-Translate DE/EN, Admin-Bypass)
 - [x] Ankündigungen mit smoother animation (Erledigt: Slide-Down/Up, Height-Collapse, Carousel mit Fade-Transitions)
 - [x] Dauert teilweise echt lang zum laden (Erledigt: Granulares Vite Chunk-Splitting, Gzip-Kompression, immutable Caching)
 - [x] Bei Status soll man Dinge bearbeiten können wie die adressen etc. Kategorien (Erledigt: Vollständiges Edit-Modal für Checks & Kategorien im Admin-Panel)

# Panel: 
 - [x] Discord egg ausgewählt, werden dinge von Minecraft geladen (im filemanager) (Erledigt: Servertyp-Erkennung in file_service.go & AppContext, keine Minecraft-Dateien bei Discord-Eggs)
 - [x] Git Auto Deploy ist vorgefüllt (Erledigt: Unkonfiguriert/Leerzustand für neue Server, erst bei expliziter Aktivierung erzeugt)
 - [x] recent deployment history stehen sachen, dabei wurde nur der server erstellt (Erledigt: Leere Historie bei Neuerstellung, Empty-State)
 - [x] Versionen werden nicht korrekt synchronisiert es zeigt 2.8.8 an, dabei ist die neuste version die installiert ist 2.9.0, auch bei Updates prüfen wird das nicht angezeigt (Erledigt: v2.9.0 synchronisiert im Core und UI)
 - [x] Cli command hinzufügen um das Panel zu updaten - es sollen keine datenbanken, server oder sonstiges ersetzt oder verändert werden. (Erledigt: 'pteronext update', 'pteronext -update' & pteronext-update.sh mit automatischem DB-Snapshot und absolutem Server/Daten-Schutz)
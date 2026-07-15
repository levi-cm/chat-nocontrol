> **Authority:** Chat NoControl documentation authority; this file normatively defines the end-user German guide for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.en.md](user-guide.en.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Benutzerhandbuch: Deutsch

## 1. Was das ist

Chat NoControl ist eine lokale Browser-App, mit der du eine private Identität erstellst, einen öffentlichen Kontakt teilst und Text sowie Dateien ver- und entschlüsselst, ohne ein Online-Konto anzulegen.

Die App läuft im Browser. Für die normale Nutzung braucht sie keinen Server.

## 2. Bevor du anfängst

- Wähle einen Benutzernamen, den du anderen Menschen zeigen möchtest. Die App speichert ihn im PPX-Feld `pseudonym`; er ist öffentlich und nicht eindeutig.
- Wenn du 24 Wiederherstellungswörter verwendest, denk daran, dass sie nur auf Englisch sind und dieselbe kryptografische Identität wiederherstellen, aber nicht das ursprüngliche Pseudonym oder die ursprüngliche Erstellungszeit.
- Nutze einen Browser mit aktuellem JavaScript- und Dateisupport.
- Erstelle ein Passwort für den Browser-Tresor, das du nirgendwo sonst verwendest. Es darf nur druckbares ASCII enthalten, innere Leerzeichen nutzen, nicht mit einem Leerzeichen beginnen oder enden und höchstens 256 Bytes lang sein.
- Plane ein, sowohl das private QR-PNG als auch die `.ppxrecovery`-Datei zu speichern und die Wörter abzuschreiben, das Wiederherstellungsblatt auszudrucken oder sein PDF zu speichern.

## 3. Identität erstellen oder importieren

1. Öffne die App.
2. Wähle auf dem ersten Bildschirm `Neue Identität erstellen` oder `Identität importieren`.
3. Für eine neue Identität durchläufst du sieben beschriftete Bildschirme:
   1. Gib einen öffentlichen `Benutzernamen` ein und erzeuge die Identität.
   2. Gib das Passwort für den Browser-Tresor zweimal ein. Es schützt nur die verschlüsselte Browser-Kopie; Wiederherstellung per QR, Datei oder Wörtern benötigt es nicht.
   3. Lade sowohl das private QR-PNG als auch die `.ppxrecovery`-Datei herunter und bestätige für beide die sichere Aufbewahrung.
   4. Schreibe alle 24 englischen Wörter ab, öffne die Druckaktion und lade die private A4-Wiederherstellungs-PDF herunter. Bestätige alle drei Sicherungen einzeln; eine oder zwei Bestätigungen reichen nicht. Auf dem Desktop erscheint die exakt erzeugte PDF eingebettet, auf kleinen Bildschirmen bleiben Wörter und Aktionen ohne gequetschte Vorschau sichtbar. Das Blatt enthält Benutzername, Daten, QR-Code, vollständigen Wiederherstellungscode, Wörter und das exakte Klartext-Passwort des Browser-Tresors. Teile es nie und verwende dieses Passwort nirgendwo sonst.
   5. Übe den Import nach dem Löschen des Browser-Speichers, indem du den gespeicherten QR-Code scannst/hochlädst oder den Wiederherstellungscode einfügst.
   6. Importiere die gespeicherte `.ppxrecovery`-Datei und gib anschließend die vier abgefragten zufälligen Wortpositionen ein. Falsche Antworten kannst du unbegrenzt wiederholen; nach zehn Fehlversuchen wird zusätzlich ein bestätigter Neustart angeboten.
   7. Bestätige, ob die App den verschlüsselten Tresor speichern soll. `Auf diesem Gerät merken` ist empfohlen und vorausgewählt, aber erst mit Weiter wird in IndexedDB geschrieben. Mit `Nur für diese Sitzung` lehnst du das ab.
4. Die zurückhaltende Aktion `Ich weiß, was ich tue` kann nur die beiden Übungsbildschirme überspringen. Downloads und Sicherungsbestätigungen bleiben verpflichtend.
5. Nach dem Wiederherstellungsdokument kann Zurück das Passwort, die Wörter, den Wiederherstellungscode, den QR-Code oder das Dokument nicht erneut anzeigen. Starte neu, wenn du sie nicht richtig gesichert hast.
6. Wenn du eine vorhandene Identität importierst, wähle eine Quelle: einen gesperrten `PPXV`-Tresor, eine unverschlüsselte `PPXR`-Wiederherstellungskarte oder ein `PPXR`-QR-Bild, oder `24 Wiederherstellungswörter`.
7. Wenn du `24 Wiederherstellungswörter` gewählt hast, gib alle 24 englischen Wörter genau so ein, wie sie dastehen.
8. Wenn du `PPXR` gewählt hast, lies zuerst die Warnung, weil das Material unverschlüsselt ist.
9. Wenn du `PPXV` gewählt hast, gib die Tresor-Passphrase ein.
10. Lass die App das Material prüfen, die Identität ableiten und verifizieren, dass sie passt.
11. Wenn du Wiederherstellungswörter benutzt hast, wähle oder gib ein Pseudonym erneut ein, bevor du weitermachst. Es darf anders sein als das ursprüngliche, aber der kryptografische Identitäts-Fingerabdruck bleibt gleich.
12. Die App erstellt dafür einen signierten öffentlichen Kontakt mit demselben Fingerabdruck. `PPXV` und `PPXR` bewahren ihr eingebettetes Pseudonym und ihre Erstellungszeit; beim Wortimport gelten das neue Pseudonym und nur eine neue lokale Importzeit.

Was die Optionen bedeuten:

- `Auf diesem Gerät merken` speichert erst nach ausdrücklicher Bestätigung einen verschlüsselten Identitätstresor in lokalem IndexedDB.
- `Nur für diese Sitzung` speichert nach dem Schließen der App oder nach Sitzungsende nichts.
- Der private QR-Code, `.ppxrecovery`, Wiederherstellungscode, die 24 Wörter und das Wiederherstellungsblatt sind verschiedene Formen derselben Wiederherstellungsbefugnis. Wer eine davon bekommt, kann deine private Identität wiederherstellen.
- Das Passwort auf dem Wiederherstellungsblatt ist davon getrennt: Es entsperrt den verschlüsselten Browser-Tresor, ist aber für QR-, `.ppxrecovery`- oder Wortwiederherstellung nicht nötig.
- Wenn du alle Wiederherstellungskopien und den Zugriff auf den gemerkten Browser-Tresor verlierst, können die Identität und dafür verschlüsselte Nachrichten nie wiederhergestellt werden.
- Öffentliche Kontakte importierst du weiterhin im Bereich `Kontakte`.
- Die laufende Passwortstärkeschätzung ist nur ein Hinweis und keine Sicherheitsgarantie.

## 4. Deinen öffentlichen Kontakt teilen

1. Öffne `Identität`.
2. Suche deinen `Öffentlichen Kontakt`.
3. Teile diesen Kontakt per QR oder Datei. Wähle `Kontakt-QR als PNG speichern`, wenn du ein Bild brauchst.
4. Sag der anderen Person, dass sie den öffentlichen Fingerabdruck über einen vertrauenswürdigen Kanal prüfen soll, wenn Authentizität wichtig ist.

Der öffentliche Kontakt ist zum Teilen gedacht. Andere Leute verschlüsseln damit an dich.

Der angemeldete QR-Code des verschlüsselten privaten Tresors ist zunächst verborgen. Gib das Passwort des Browser-Tresors einmal erneut ein, um ihn anzuzeigen. Dieselbe erfolgreiche Prüfung schaltet `QR des privaten Tresors als PNG speichern` und den Download der `.ppxvault`-Identitätsdatei frei, bis du `Identität` verlässt, die App sperrst oder die App in den Hintergrund wechselst. Halte beide Dateien privat. Die Wiederherstellungsdownloads während der Ersteinrichtung erhalten keine zweite Passwortabfrage.

### Einstellungen und Darstellung

Öffne die Zahnrad-Schaltfläche in der oberen Leiste, um Sprache, Farbschema, Akzentfarbe oder transparente Oberflächeneffekte zu ändern. Als Farbschema stehen `System`, `Hell` und `Dunkel` zur Auswahl. Wenn du transparente Effekte ausschaltest, werden unscharfe Navigationsflächen durch deckende Flächen ersetzt.

## 5. Kontakte hinzufügen

1. Öffne `Kontakte`.
2. Importiere einen öffentlichen Kontakt per QR, QR-Bild oder Datei.
3. Füge optional einen lokalen Spitznamen hinzu.
4. Öffne die Kontaktdetails.
5. Wähle `Kontakt löschen` und bestätige, wenn du den Eintrag entfernen willst.
6. Das entfernt nur den lokalen öffentlichen Kontakt und den Spitznamen. Externe Dateien oder deine Identität werden nicht gelöscht.
7. Du kannst denselben Kontakt später wieder importieren.
8. Suche nach Pseudonym, Spitzname oder Fingerabdruckdetail.

Hilfreiche Hinweise:

- Wenn du denselben Schlüssel noch einmal importierst, wird der Eintrag zusammengeführt.
- Wenn zwei Kontakte dasselbe Pseudonym haben, aber unterschiedliche Schlüssel, behalte beide, bis du weißt, welcher korrekt ist.
- Kontakte bleiben auf diesem Gerät normalerweise erhalten, außer du bist im Modus `Nur Sitzung`.

## 6. Text verschlüsseln

1. Öffne `Verschlüsseln`.
2. Wähle genau einen Empfänger aus.
3. Füge unter `Verschlüsselter Text` bis zu `256 KiB` ein oder tippe den Text ein.
4. Wähle `Lokal verschlüsseln`.
5. Kopiere oder speichere die verschlüsselte Ausgabe.

Normales PPXT ist immer die primäre Ausgabe. Die Erstellung von Nachrichten-QRs
ist standardmäßig ausgeschaltet. Wenn du in den Einstellungen ausdrücklich
`Nachrichten-QR nach Textverschlüsselung anbieten` aktivierst, kann eine
kompakte Nachricht zusätzlich als In-App-QR und/oder Handykamera-Link angeboten
werden. Es gibt keine Vorschau. Passt sie nicht, nutze die normale PPXT-Ausgabe.
Der Empfänger muss deinen öffentlichen Kontakt bereits besitzen.

Tipps:

- Die App verschlüsselt lokal.
- Eine Ausgabe ist für genau einen Empfänger gedacht.
- Nutze das Suchfeld für Kontakte, wenn du viele Einträge hast.
- Die Textkomprimierung arbeitet automatisch und inhaltsunabhängig. Langer,
  wiederholter Text kann deutlich kleiner werden; kurzer oder bereits kompakter
  Text bleibt im kompatiblen unkomprimierten Format. Es gibt keine Einstellung.

## 7. Eine Datei verschlüsseln

1. Öffne `Verschlüsseln`.
2. Wähle genau einen Empfänger aus.
3. Wähle unter `Datei verschlüsseln` eine Datei bis `100 MiB`.
4. Füge optional eine Beschriftung bis `16 KiB` hinzu.
5. Wähle `Datei lokal verschlüsseln`.
6. Der Download der fertigen `.ppxfile` beginnt erst nach Abschluss.

Hinweise:

- Wenn der Vorgang unterbrochen wird, startet die Dateiverschlüsselung von vorne neu.
- `Dateivorgang abbrechen` verwirft Teilausgaben.
- Die App zeigt unterstützte Bilder, Audio- und Videodateien erst nach vollständiger Authentifizierung als Vorschau an.
- Dokumente und nicht unterstützte Medien werden nur als sichere Downloads angeboten.

## 8. Text oder Datei entschlüsseln

1. Öffne `Entschlüsseln`.
2. Füge Text unter `Verschlüsseltes Element` ein und wähle `Lokal entschlüsseln`.
   Du kannst auch einen Nachrichten-QR scannen oder einen Screenshot/ein Bild
   wählen. Gültige Nachrichten-QRs werden standardmäßig sofort entschlüsselt.
   Der Empfang bleibt verfügbar, auch wenn die Erstellung ausgeschaltet ist.
3. Wähle für Dateien unter `Datei entschlüsseln` eine `.ppxfile` und dann `Datei lokal entschlüsseln`.
4. Wenn die Prüfung gelingt, lies den Klartext oder prüfe und lade das Dateiergebnis herunter.
5. Wenn der Absender unbekannt ist, siehst du eine Warnung.
6. Wenn das Element nicht zu deiner aktiven Identität passt, schlägt die App sicher fehl.

Handykamera-Links tragen den Geheimtext nur hinter `#`, entfernen ihn sofort
aus der Adresse und speichern keine ausstehende Nachricht. Bei unbekanntem
Absender muss zuerst dessen öffentlicher Kontakt importiert werden. Bei
Kamerafehlern bleibt der Bild-Upload verfügbar.

Aktualisierte Browser öffnen unkomprimiertes PPXT v1 und komprimiertes PPXT v2.
Fehlt einem Browser die gzip-Unterstützung, aktualisiere ihn oder öffne die
Nachricht in einem anderen aktuellen unterstützten Browser.

Was du erwarten solltest:

- Sichere Fehler sind normal und zeigen standardmäßig keine zusätzlichen Details.
- Du kannst technische Details öffnen, wenn du sie brauchst.
- Nachrichten von unbekannten Absendern können trotzdem entschlüsselt werden, wenn sie kryptografisch gültig sind.
- Du kannst den Absender nach der Entschlüsselung als Kontakt speichern.

## 9. Sperren, löschen und nur Sitzung

1. Öffne `Identität`.
2. Nutze `Jetzt sperren`, wenn du fertig bist.
3. Nutze `Tresor löschen`, wenn du gemerkte private Identitätsdaten entfernen willst.
4. Nutze `Alles löschen` nur, wenn du wirklich alle lokalen Daten entfernen willst.

Das Entsperren eines gemerkten Tresors führt zur letzten entsperrten Seite zurück, die dieser Browser gespeichert hat. Ein eingehender QR-Code führt zuerst zu `Entschlüsseln`; bei einer ungültigen oder fehlenden gespeicherten Seite öffnet sich `Verschlüsseln`. Eine neu erstellte Identität öffnet weiterhin `Verschlüsseln`. Das Löschen des Tresors oder aller lokalen Daten löscht auch die gespeicherte Seite.

Zum Modus `Nur Sitzung`:

- Er ist die Fallback-Variante, wenn Speicher nicht verfügbar ist.
- Nach dem Ende der Sitzung soll nichts bleiben.
- Kontakte und Identitätsdaten werden in diesem Modus nicht dauerhaft gespeichert.

## 10. Offline-Nutzung und Updates

- Nachdem die App einmal erfolgreich geladen wurde, kann sie offline weiterarbeiten, wenn dein Browser die App-Shell und die Assets behält.
- Wenn eine neuere Version bereitsteht, siehst du einen Hinweis.
- Lade die Seite nicht neu, während du verschlüsselst, entschlüsselst oder ein entschlüsseltes Ergebnis offen hast.

## 11. Fehlerbehebung

Wenn etwas fehlschlägt:

- Prüfe, ob du den richtigen Empfänger gewählt hast.
- Prüfe, ob die Datei oder der eingefügte Text vollständig ist.
- Prüfe, ob Speicher verfügbar ist, wenn du Persistenz erwartet hast.
- Prüfe, ob der Absender schon in deinen Kontakten ist.
- Öffne für Kamerascans die ausgegebene HTTPS-Entwicklungs-URL. Reines IP-HTTP darf keinen Kamerazugriff anfordern; Screenshot-/Bildimport bleibt verfügbar.
- Wenn automatisches Kopieren nicht verfügbar ist, markiert die App den vollständigen Text. Nutze den Kopierbefehl des Browsers; die App behauptet keinen Kopiererfolg.
- Nutze den Aufklapper für technische Details nur, wenn du mehr Information brauchst.

Häufige sichere Meldungen:

- `Dieses Element passt nicht zu deiner aktiven Identität oder ist beschädigt.`
- `Das Element wurde entschlüsselt, aber die Absenderprüfung ist fehlgeschlagen.`
- `Speicher ist nicht verfügbar, deshalb wird sich diese Sitzung nicht merken.`
- `Eine neuere Version ist verfügbar.`

## 12. Sicherheitsgrenzen

- Chat NoControl versteckt Inhalt, nicht Metadaten.
- Version 1 hat kein Forward Secrecy.
- Die App legt kein Online-Konto an.
- Sie bietet keine Passwortzurücksetzung an.
- Sie garantiert keine sichere Löschung von Browser-Speicher.
- Sie schützt dich nicht vor einem kompromittierten Gerät, einer bösartigen Erweiterung oder Malware.
- Die private Wiederherstellungskarte und jeder verschlüsselte Tresor müssen sicher aufbewahrt werden.
- Die 24 Wiederherstellungswörter sind privates Wiederherstellungsmaterial und müssen sicher aufbewahrt werden.

## 13. Hilfe

Öffne `Hilfe` oder `Über`, um Folgendes zu lesen:

- Die Sicherheitsgrenzen in einfacher Sprache.
- Informationen zu Quellcode und Build.
- Die Links zum dedizierten Chat-Control-Erklärtext.
- Den lokalen Weg für Issue-Entwürfe.

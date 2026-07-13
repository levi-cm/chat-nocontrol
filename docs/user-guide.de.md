> **Authority:** Chat NoControl documentation authority; this file normatively defines the end-user German guide for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.en.md](user-guide.en.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Benutzerhandbuch: Deutsch

## 1. Was das ist

Chat NoControl ist eine lokale Browser-App, mit der du eine private Identität erstellst, einen öffentlichen Kontakt teilst und Text sowie Dateien ver- und entschlüsselst, ohne ein Online-Konto anzulegen.

Die App läuft im Browser. Für die normale Nutzung braucht sie keinen Server.

## 2. Bevor du anfängst

- Wähle ein Pseudonym, das du anderen Menschen zeigen möchtest.
- Denk daran, dass das Pseudonym öffentlich und nicht eindeutig ist.
- Wenn du 24 Wiederherstellungswörter verwendest, denk daran, dass sie nur auf Englisch sind und dieselbe kryptografische Identität wiederherstellen, aber nicht das ursprüngliche Pseudonym oder die ursprüngliche Erstellungszeit.
- Nutze einen Browser mit aktuellem JavaScript- und Dateisupport.
- Wenn sich die App deine Identität merken soll, entscheide dich für einen verschlüsselten lokalen Tresor.
- Plane ein, die private Wiederherstellungskarte zu exportieren, bevor du fertig bist.

## 3. Identität erstellen oder importieren

1. Öffne die App.
2. Wähle auf dem ersten Bildschirm `Neue Identität erstellen` oder `Identität importieren`.
3. Wenn du eine neue Identität erstellst, gib ein Pseudonym ein, lies die Warnung, dass das Pseudonym öffentlich und kein Geheimnis ist, und wähle `Identität erzeugen`.
4. Exportiere die private Wiederherstellungskarte, wenn du dazu aufgefordert wirst. Die App fordert dich außerdem auf, einige zufällig ausgewählte Positionen der Wiederherstellungswörter zu bestätigen.
5. Wenn du Tastatur- oder Schalterbedienung nutzt, fokussiere die Exportaktion, aktiviere sie, gib `PRIVAT EXPORTIEREN` ein und bestätige.
6. Wenn du eine Identität importierst, wähle eine Quelle: einen gesperrten `PPXV`-Tresor, eine unverschlüsselte `PPXR`-Wiederherstellungskarte oder ein `PPXR`-QR-Bild, oder `24 Wiederherstellungswörter`.
7. Wenn du `24 Wiederherstellungswörter` gewählt hast, gib alle 24 englischen Wörter genau so ein, wie sie dastehen.
8. Wenn du `PPXR` gewählt hast, lies zuerst die Warnung, weil das Material unverschlüsselt ist.
9. Wenn du `PPXV` gewählt hast, gib die Tresor-Passphrase ein.
10. Lass die App das Material prüfen, die Identität ableiten und verifizieren, dass sie passt.
11. Wenn du Wiederherstellungswörter benutzt hast, wähle oder gib ein Pseudonym erneut ein, bevor du weitermachst. Es darf anders sein als das ursprüngliche, aber der kryptografische Identitäts-Fingerabdruck bleibt gleich.
12. Die App erstellt dafür einen signierten öffentlichen Kontakt mit demselben Fingerabdruck. `PPXV` und `PPXR` bewahren ihr eingebettetes Pseudonym und ihre Erstellungszeit; beim Wortimport gelten das neue Pseudonym und nur eine neue lokale Importzeit.
13. Danach entscheidest du, ob sich die App diese Identität auf diesem Gerät merken soll.

Was die Optionen bedeuten:

- Ein `verschlüsselter lokaler Tresor` speichert deine Identität auf diesem Gerät, geschützt durch ein Passwort.
- `Nur für diese Sitzung` speichert nach dem Schließen der App oder nach Sitzungsende nichts.
- Die private Wiederherstellungskarte ist gefährlich. Wer sie bekommt, kann deine private Identität wiederherstellen.
- Die 24 Wiederherstellungswörter sind genauso sensibel wie die private Wiederherstellungskarte. Teile sie nie.
- Öffentliche Kontakte importierst du weiterhin im Bereich `Kontakte`.

## 4. Deinen öffentlichen Kontakt teilen

1. Öffne `Identität`.
2. Suche deinen `Öffentlichen Kontakt`.
3. Teile diesen Kontakt per QR oder Datei.
4. Sag der anderen Person, dass sie den öffentlichen Fingerabdruck über einen vertrauenswürdigen Kanal prüfen soll, wenn Authentizität wichtig ist.

Der öffentliche Kontakt ist zum Teilen gedacht. Andere Leute verschlüsseln damit an dich.

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

Tipps:

- Die App verschlüsselt lokal.
- Eine Ausgabe ist für genau einen Empfänger gedacht.
- Nutze das Suchfeld für Kontakte, wenn du viele Einträge hast.

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
3. Wähle für Dateien unter `Datei entschlüsseln` eine `.ppxfile` und dann `Datei lokal entschlüsseln`.
4. Wenn die Prüfung gelingt, lies den Klartext oder prüfe und lade das Dateiergebnis herunter.
5. Wenn der Absender unbekannt ist, siehst du eine Warnung.
6. Wenn das Element nicht zu deiner aktiven Identität passt, schlägt die App sicher fehl.

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

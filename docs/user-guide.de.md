> **Authority:** Benutzeranleitung für Zielversion `0.2.0-beta.1`.
> **Status:** Beta; unabhängige Prüfung BLOCKED; Geräteprüfungen NOT RUN.
> **Depends on:** [product-spec.md](product-spec.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md)

# Chat-NoControl-Anleitung

## Vor dem Start

Nutze die kanonische Seite <https://levi-cm.github.io/chat-nocontrol/>. Es gibt
kein Konto und keine Server-Wiederherstellung. Zielversion `0.2.0-beta.1` ist
nicht unabhängig geprüft. Keine Hochrisiko-Geheimnisse verwenden, bevor die
Freigabegates bestanden sind.

## Identität erstellen oder wiederherstellen

1. Pseudonym und Tresorpasswort wählen oder nur diese Sitzung verwenden.
2. Wiederherstellungs-PDF, Datei, Code, 24 Wörter und Recovery-QR sichern. Ein
   angebotener PPXV-Tresor-QR ist eine separate passwortgeschützte Sicherung.
3. Jede Form wie einen privaten Schlüssel behandeln. Das Tresorpasswort schützt
   Datei, Code, Wörter, PDF und QR nicht.
4. Wiederherstellung testen, dann Identität aktivieren.

Import akzeptiert V2-Material sowie alte V1-PPXR-, PPXV- und Wortdaten. Private
V1-Daten werden nach V2 migriert. Die alte App ist nicht nötig. Danach neuen
V2-Kontakt erneut teilen.

## Kontakte austauschen

V2-Kontakt als `.ppxcontact`-Datei oder `PPX2:CONTACT:`-Text exportieren.
Datei/Text der anderen Person importieren und Fingerabdruck über einen zweiten
vertrauenswürdigen Kanal vergleichen.

V2 erstellt keinen Kontakt-QR. V1-Kontakte werden nicht gespeichert. Für eine
alte PPXQ-Nachricht den exakten V1-Absenderkontakt nur für die entsperrte
Identitätssitzung bereitstellen. Die App speichert ihn nie dauerhaft, kann ihn
in dieser Sitzung für weitere alte Nachrichten verwenden und löscht ihn beim
Sperren, Identitätswechsel, Alles-Löschen, Neuladen, Tab-Schließen oder
Sitzungsende aus dem Sitzungszustand.

## Text verschlüsseln

1. Gespeicherten V2-Empfänger wählen.
2. Bis zu 256 KiB UTF-8 eingeben.
3. Link und/oder PPXT-Text wählen.
4. Über vorhandenen Kanal senden.

PPXT enthält den Absenderkontakt. Der kürzere PPXM-Link setzt voraus, dass der
Empfänger deinen exakten V2-Kontakt gespeichert hat. V2-Links nutzen `#/m/`.
V2 erstellt keinen Nachrichten-QR.

## Datei verschlüsseln

Eine Datei bis 100 MiB und optionale Beschreibung wählen. Abbruch verwirft den
Vorgang; danach neu starten. Die erzeugte `.ppxfile` versenden.

## Entschlüsseln

Text/Link einfügen oder Datei wählen. Die App prüft Format, Version und Suite.
Unterstützte Altdaten:

- V1-PPXT Format 1 oder altes komprimiertes Format 2;
- V1-PPXF, nach Entschlüsselung nur Download;
- alte `#/m/<BASE64URL>`-Links mit PPXT oder PPXQ;
- V1-PPXQ-Text und alte `#/decrypt/qr/...`-Links mit exaktem Absenderkontakt;
- V1-Recovery/Tresor zur V2-Migration.

Alte Absenderkontakte werden nie gespeichert. Es wird kein V1-Ausgabeobjekt
erzeugt. Beschädigte, falsche, herabgestufte oder gemischte Eingaben schlagen
geschlossen fehl.

## Offline und Updates

Nach einem erfolgreichen Laden funktioniert die App-Hülle offline. Updates
aktivieren sich still: kein Banner und keine Auswahl. Eine Seite mit derselben
Version bleibt offen; eine ältere Seite kann einmal automatisch zu CAT5
navigieren. Unterstützte Nachrichten-Fragmente bleiben lokal, werden im
Arbeitsspeicher erfasst und sofort aus URL und Verlauf entfernt.

## Grenzen

Keine Gruppen, Zustellung, Historie, Synchronisierung, Forward Secrecy,
Ratsche, Anonymität oder sichere Löschgarantie. Ein kompromittiertes Gerät kann
Geheimnisse offenlegen. Unabhängige Prüfung bleibt BLOCKED, echte Geräteprüfung
NOT RUN, bis reale Nachweise vorliegen.

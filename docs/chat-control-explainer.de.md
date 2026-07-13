> **Authority:** Chat NoControl documentation authority; this file is a public explainer for the policy context around Chatkontrolle language and child-safety claims.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [product-spec.md](product-spec.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Chatkontrolle-Erklärung

Zuletzt verifiziert: 2026-07-12.

## 1. Zweck

Dieses Dokument erklärt den politischen Kontext, der oft als "Chatkontrolle" bezeichnet wird. Es ist keine Rechtsberatung und keine Produktanforderung.

Die Position des Projekts ist eng gefasst:

- Kinderschutz und private Kommunikation sind miteinander vereinbar.
- Das Projekt lehnt eine generalisierte Durchsuchung privater Kommunikation ab.
- Das Projekt lehnt Kinderschutz nicht ab.

## 2. Offizielle und umgangssprachliche Begriffe

In den offiziellen EU-Texten geht es meist um Regeln, mit denen sexueller Missbrauch von Kindern online verhindert und bekämpft werden soll.

Der umgangssprachliche Begriff "Chatkontrolle" ist ein Kürzel aus der öffentlichen Debatte. Im Englischen wird oft "chat control" gesagt.

Verwende diese Begriffe nur als Kurzform. Sie sind nicht der formale Titel des Gesetzgebungsverfahrens.

## 3. Aktueller Stand

Stand: 2026-07-12. Der Status ist volatil und muss vor einer Veröffentlichung erneut geprüft werden.

- Der langfristige Vorgang 2022/0155(COD) ist weiterhin in Verhandlung.
- Die legislative-train-Seite des Europäischen Parlaments führt den Vorgang als "tabled" und nennt laufende Trilogverhandlungen; der Eintrag ist mit 20. Juni 2026 datiert.
- Die befristete ePrivacy-Ausnahme ist am 3. April 2026 ausgelaufen, nachdem das Parlament im März 2026 eine Verlängerung abgelehnt hat.
- Die Pressemitteilung des Rates vom 2. Juli 2026 sagt, dass der Rat eine allgemeine Ausrichtung beschlossen hat, um eine vorläufige freiwillige Erkennung bis zum 3. April 2028 wieder einzuführen und das Dossier in die zweite Lesung des Parlaments zu geben.

## 4. Was das bedeutet

Die politische Auseinandersetzung dreht sich nicht darum, ob Kinderschutz wichtig ist. Es geht darum, welche Erkennungspflichten - falls überhaupt - für private Kommunikationsdienste gelten sollen und welche Schutzmechanismen nötig sind.

Die Position des Projekts ist:

- Maßnahmen müssen zielgerichtet und verhältnismäßig sein;
- private Kommunikation wird nicht allein dadurch öffentlich, dass sie über einen Dienst läuft;
- Inhaltsschutz und Kinderschutz schließen sich nicht aus;
- generalisierte Scans sind eine andere politische Entscheidung als Kinderschutz.

## 5. Umfang des Projekts

Die Anwendung ist ein lokales Browser-Werkzeug. Sie kann Inhalte auf dem eigenen Gerät und nach dem Design auch während der vorgesehenen Übertragung schützen, aber sie kann nicht:

- verbergen, dass eine Kommunikation existiert;
- Metadaten verbergen;
- rechtliche Umgehung bieten;
- gesetzliche Zugriffsbeschränkungen aushebeln;
- Immunität gegen Ermittlungen oder Meldepflichten versprechen.

Die App ist nur für lokale Ver- und Entschlüsselung gedacht. Sie ist kein Netzwerk-Relay, kein Nachrichten-Backend und kein System zur Umgehung von Erkennung.

## 6. Sicherheits- und Datenschutzsprache

Nutze klare, nüchterne Sprache:

- Sage "verschlüsselt auf diesem Gerät".
- Sage "legt kein Online-Konto an".
- Sage "verbirgt keine Metadaten".
- Sage "behauptet keine rechtliche Umgehung".

Vermeide Formulierungen wie:

- "nicht auffindbar";
- "standardmäßig anonym";
- "metadatenfrei";
- "gesetzesfest";
- "scanfest".

## 7. Quellen

Die Primärquellen stehen in [references.md](references.md). Die wichtigsten offiziellen Links sind:

- [Legislative Train des Europäischen Parlaments: 2022/0155(COD)](https://www.europarl.europa.eu/legislative-train/carriage/combating-child-sexual-abuse-online/report?sid=10401)
- [Pressemitteilung des Europäischen Parlaments vom 26. März 2026](https://www.europarl.europa.eu/news/en/press-room/20260325IPR39207/)
- [Pressemitteilung des Rates vom 2. Juli 2026](https://www.consilium.europa.eu/en/press/press-releases/2026/07/02/council-moves-to-reinstate-interim-measure-to-combat-child-sexual-abuse-online/)

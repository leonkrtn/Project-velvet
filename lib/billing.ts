// Globaler Billing-Schalter (Gratis-Phase vs. Abo-System).
//
// Solange BILLING_ENABLED === false befindet sich Forevr in der GRATIS-PHASE:
//  - Jeder (Solo-)Account startet kostenlos auf dem Basis-Tarif, inkl. Chat.
//  - Es gibt keine Testphase, kein Ablaufen und keine Tarifauswahl.
//  - Alle Abo-/Preis-Oberflächen sind ausgeblendet (Abo-Seite, Landing-Preise,
//    Trial-Banner, Paywalls).
//  - Der Dienstleister-Marktplatz und alles dahinter (Anfragen, Angebote,
//    Chat) ist voll nutzbar.
//  - Pro-only-Funktionen (Dienstleister direkt einladen, Veranstalter
//    onboarden) bleiben gesperrt und werden NICHT beworben.
//
// Abo-System später aktivieren: In der Umgebung `NEXT_PUBLIC_BILLING_ENABLED=true`
// setzen und neu deployen. Danach greift wieder die vollständige Trial-/Pro-Logik
// (lib/subscription.ts) samt aller Abo-/Preis-Oberflächen — ohne weitere
// Code-Änderungen. Der Chat bleibt bewusst dauerhaft Teil des Basis-Tarifs.
//
// Hinweis: `NEXT_PUBLIC_`, damit der Schalter identisch in Server- und
// Client-Bundles zur Verfügung steht (er wird zur Build-Zeit eingesetzt).
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'

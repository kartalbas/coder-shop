// Issue #58: all shop languages are data. A language is a row (`LanguageConfig`), a text
// is a row (`TranslationEntry`) with German as the required base and every other language
// as a key in the `texts` map — adding a language or a text never changes code. This
// module is the pure decision layer: which language answers a request, which text a key
// has in it, and which keys are missing.

export interface LanguageConfig {
  code: string;
  label: string;
  intlLocale: string;
  position: number;
  active: boolean;
}

export const BASE_LANGUAGE = "de";

// Issue #58 step 2: the proxy writes this cookie whenever a request arrives with a
// language prefix, so the choice is remembered for prefix-free links and the next visit.
export const LANGUAGE_COOKIE = "lang";

// Seed content of the `languages` collection (#61/#64 pattern): the shop answers in the
// four Swiss national languages plus Spanish; formats follow the Swiss locales.
export const DEFAULT_LANGUAGES: LanguageConfig[] = [
  { code: "de", label: "Deutsch", intlLocale: "de-CH", position: 0, active: true },
  { code: "fr", label: "Français", intlLocale: "fr-CH", position: 1, active: true },
  { code: "it", label: "Italiano", intlLocale: "it-CH", position: 2, active: true },
  { code: "rm", label: "Rumantsch", intlLocale: "rm-CH", position: 3, active: true },
  { code: "es", label: "Español", intlLocale: "es", position: 4, active: true },
];

export const TRANSLATION_AREAS = ["shop", "admin", "mail", "invoice", "catalog"] as const;
export type TranslationArea = (typeof TRANSLATION_AREAS)[number];

export interface TranslationEntry {
  key: string;
  area: TranslationArea;
  de: string;
  texts: Record<string, string>;
}

// Seed content of the `translations` collection — the foundation keys proving the
// mechanism end to end; step 2 of #58 extracts every remaining UI text into rows.
export const DEFAULT_TRANSLATIONS: TranslationEntry[] = [
  {
    key: "shop.header.title",
    area: "shop",
    de: "coder-shop",
    texts: { fr: "coder-shop", it: "coder-shop", rm: "coder-shop", es: "coder-shop" },
  },
  {
    key: "shop.action.addToCart",
    area: "shop",
    de: "In den Warenkorb",
    texts: {
      fr: "Ajouter au panier",
      it: "Aggiungi al carrello",
      rm: "Agiuntar al charret",
      es: "Añadir a la cesta",
    },
  },
  {
    key: "shop.cart.title",
    area: "shop",
    de: "Warenkorb",
    texts: { fr: "Panier", it: "Carrello", rm: "Charret", es: "Cesta" },
  },
  // Storefront chrome (#58 step 3 slice): header and footer strings, every one seeded
  // in all five languages — the seed test below fails if a key ships untranslated.
  {
    key: "shop.header.nav.main",
    area: "shop",
    de: "Hauptnavigation",
    texts: {
      fr: "Navigation principale",
      it: "Navigazione principale",
      rm: "Navigaziun principala",
      es: "Navegación principal",
    },
  },
  {
    key: "shop.header.nav.categories",
    area: "shop",
    de: "Kategorien (mobil)",
    texts: {
      fr: "Catégories (mobile)",
      it: "Categorie (mobile)",
      rm: "Categorias (mobil)",
      es: "Categorías (móvil)",
    },
  },
  {
    key: "shop.header.account",
    area: "shop",
    de: "Mein Konto",
    texts: {
      fr: "Mon compte",
      it: "Il mio account",
      rm: "Mes conto",
      es: "Mi cuenta",
    },
  },
  {
    key: "shop.footer.tagline",
    area: "shop",
    de: "Premium-Technik, Schuhe und Kleidung. Alle Preise in CHF inklusive {vat}",
    texts: {
      fr: "Technique premium, chaussures et vêtements. Tous les prix en CHF, {vat} inclus",
      it: "Tecnica premium, scarpe e abbigliamento. Tutti i prezzi in CHF, {vat} inclusa",
      rm: "Tecnica premium, chaussas e vestgadira. Tut ils pretschs en CHF, {vat} inclus",
      es: "Tecnología premium, calzado y ropa. Todos los precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.footer.assortment",
    area: "shop",
    de: "Sortiment",
    texts: { fr: "Assortiment", it: "Assortimento", rm: "Sortiment", es: "Surtido" },
  },
  {
    key: "shop.footer.service",
    area: "shop",
    de: "Service",
    texts: { fr: "Service", it: "Servizio", rm: "Servetsch", es: "Servicio" },
  },
  {
    key: "shop.footer.shipping",
    area: "shop",
    de: "Versand aus der Schweiz",
    texts: {
      fr: "Expédition depuis la Suisse",
      it: "Spedizione dalla Svizzera",
      rm: "Spedition da la Svizra",
      es: "Envío desde Suiza",
    },
  },
  {
    key: "shop.footer.payment",
    area: "shop",
    de: "Zahlung in CHF",
    texts: { fr: "Paiement en CHF", it: "Pagamento in CHF", rm: "Pajament en CHF", es: "Pago en CHF" },
  },
  {
    key: "shop.footer.returns",
    area: "shop",
    de: "14 Tage Rückgaberecht",
    texts: {
      fr: "Droit de retour de 14 jours",
      it: "Diritto di recesso di 14 giorni",
      rm: "Dretg da revista da 14 dis",
      es: "Derecho de devolución de 14 días",
    },
  },
  {
    key: "shop.footer.copyright",
    area: "shop",
    de: "coder-shop — Demo-Shop",
    texts: {
      fr: "coder-shop — boutique de démonstration",
      it: "coder-shop — negozio dimostrativo",
      rm: "coder-shop — shop da demo",
      es: "coder-shop — tienda de demostración",
    },
  },
  // Cart flow (#58 step 3 slice): drawer, page, free-shipping bar and discount field,
  // every one seeded in all five languages; {name}/{amount} are interpolated values.
  {
    key: "shop.cart.emptyPage",
    area: "shop",
    de: "Ihr Warenkorb ist leer",
    texts: {
      fr: "Votre panier est vide",
      it: "Il vostro carrello è vuoto",
      rm: "Voss charret è vid",
      es: "Su cesta está vacía",
    },
  },
  {
    key: "shop.cart.emptyDrawer",
    area: "shop",
    de: "Ihr Warenkorb ist leer.",
    texts: {
      fr: "Votre panier est vide.",
      it: "Il vostro carrello è vuoto.",
      rm: "Voss charret è vid.",
      es: "Su cesta está vacía.",
    },
  },
  {
    key: "shop.action.continueShopping",
    area: "shop",
    de: "Weiter einkaufen",
    texts: {
      fr: "Continuer vos achats",
      it: "Continua gli acquisti",
      rm: "Cuntinuar a comprar",
      es: "Seguir comprando",
    },
  },
  {
    key: "shop.cart.summary",
    area: "shop",
    de: "Zusammenfassung",
    texts: { fr: "Résumé", it: "Riepilogo", rm: "Resum", es: "Resumen" },
  },
  {
    key: "shop.cart.subtotal",
    area: "shop",
    de: "Zwischensumme",
    texts: { fr: "Sous-total", it: "Subtotale", rm: "Subtotal", es: "Subtotal" },
  },
  {
    key: "shop.action.checkout",
    area: "shop",
    de: "Zur Kasse",
    texts: {
      fr: "Passer à la caisse",
      it: "Vai alla cassa",
      rm: "A la cassa",
      es: "Tramitar pedido",
    },
  },
  {
    key: "shop.cart.remove",
    area: "shop",
    de: "Entfernen: {name}",
    texts: {
      fr: "Retirer : {name}",
      it: "Rimuovi: {name}",
      rm: "Eliminar: {name}",
      es: "Quitar: {name}",
    },
  },
  {
    key: "shop.cart.decrease",
    area: "shop",
    de: "Menge verringern: {name}",
    texts: {
      fr: "Diminuer la quantité : {name}",
      it: "Riduci quantità: {name}",
      rm: "Quantitad reducer: {name}",
      es: "Reducir cantidad: {name}",
    },
  },
  {
    key: "shop.cart.increase",
    area: "shop",
    de: "Menge erhöhen: {name}",
    texts: {
      fr: "Augmenter la quantité : {name}",
      it: "Aumenta quantità: {name}",
      rm: "Quantitad augmentar: {name}",
      es: "Aumentar cantidad: {name}",
    },
  },
  {
    key: "shop.cart.freeShipping",
    area: "shop",
    de: "Noch {amount} bis zum kostenlosen Versand",
    texts: {
      fr: "Encore {amount} pour la livraison gratuite",
      it: "Ancora {amount} per la spedizione gratuita",
      rm: "Anc {amount} fin a la spedition gratuita",
      es: "Faltan {amount} para el envío gratuito",
    },
  },
  {
    key: "shop.cart.freeShippingUnlocked",
    area: "shop",
    de: "Kostenloser Versand gesichert",
    texts: {
      fr: "Livraison gratuite garantie",
      it: "Spedizione gratuita garantita",
      rm: "Spedition gratuita segirada",
      es: "Envío gratuito garantizado",
    },
  },
  {
    key: "shop.cart.freeShippingProgress",
    area: "shop",
    de: "Fortschritt bis zum kostenlosen Versand",
    texts: {
      fr: "Progression vers la livraison gratuite",
      it: "Avanzamento verso la spedizione gratuita",
      rm: "Progress vers la spedition gratuita",
      es: "Progreso hacia el envío gratuito",
    },
  },
  {
    key: "shop.discount.code",
    area: "shop",
    de: "Gutscheincode",
    texts: {
      fr: "Code promo",
      it: "Codice sconto",
      rm: "Code da reducziun",
      es: "Código de descuento",
    },
  },
  {
    key: "shop.discount.redeem",
    area: "shop",
    de: "Einlösen",
    texts: {
      fr: "Utiliser",
      it: "Utilizza",
      rm: "Utilisar",
      es: "Canjear",
    },
  },
  {
    key: "shop.cart.emptySubtitle",
    area: "shop",
    de: "Entdecken Sie unser Sortiment an Smartphones, Schuhen und Kleidung.",
    texts: {
      fr: "Découvrez notre assortiment de smartphones, chaussures et vêtements.",
      it: "Scoprite la nostra gamma di smartphone, scarpe e abbigliamento.",
      rm: "Scuvrizzi our assortiment da smartphones, chalzas e vestgadira.",
      es: "Descubra nuestro surtido de smartphones, zapatos y ropa.",
    },
  },
  {
    key: "shop.cart.maxStock",
    area: "shop",
    de: "Maximal {max} an Lager",
    texts: {
      fr: "Maximum {max} en stock",
      it: "Massimo {max} in magazzino",
      rm: "Maximal {max} en magazun",
      es: "Máximo {max} en stock",
    },
  },
  {
    key: "shop.cart.summaryNote",
    area: "shop",
    de: "{shipping} — ab {amount} kostenlos. Preise inkl. {vat}.",
    texts: {
      fr: "{shipping} — offerts dès {amount}. Prix incl. {vat}.",
      it: "{shipping} — gratuiti da {amount}. Prezzi incl. {vat}.",
      rm: "{shipping} — gratuit da {amount}. Preiss incl. {vat}.",
      es: "{shipping} — gratis a partir de {amount}. Precios con {vat}.",
    },
  },
  // Header control labels (#58 step 3): the cart button, theme toggle and instant
  // search sit in the header but were missed when the chrome was extracted.
  {
    key: "shop.header.cart",
    area: "shop",
    de: "Warenkorb, {count} Artikel",
    texts: {
      fr: "Panier, {count} articles",
      it: "Carrello, {count} articoli",
      rm: "Charret, {count} artitgels",
      es: "Cesta, {count} artículos",
    },
  },
  {
    key: "shop.header.theme",
    area: "shop",
    de: "Helles oder dunkles Design aktivieren",
    texts: {
      fr: "Activer le thème clair ou sombre",
      it: "Attiva il tema chiaro o scuro",
      rm: "Activar il design cler u stgir",
      es: "Activar el tema claro u oscuro",
    },
  },
  {
    key: "shop.search.label",
    area: "shop",
    de: "Schnellsuche",
    texts: {
      fr: "Recherche rapide",
      it: "Ricerca rapida",
      rm: "Tschertga sperta",
      es: "Búsqueda rápida",
    },
  },
  {
    key: "shop.search.placeholder",
    area: "shop",
    de: "Suchen… (⌘K)",
    texts: {
      fr: "Rechercher… (⌘K)",
      it: "Cerca… (⌘K)",
      rm: "Tschertgar… (⌘K)",
      es: "Buscar… (⌘K)",
    },
  },
  {
    key: "shop.search.results",
    area: "shop",
    de: "Suchergebnisse",
    texts: {
      fr: "Résultats de recherche",
      it: "Risultati di ricerca",
      rm: "Resultats da tschertga",
      es: "Resultados de búsqueda",
    },
  },
  {
    key: "shop.search.noHits",
    area: "shop",
    de: "Keine Treffer für «{term}»",
    texts: {
      fr: "Aucun résultat pour «{term}»",
      it: "Nessun risultato per «{term}»",
      rm: "Nagins resultats per «{term}»",
      es: "Sin resultados para «{term}»",
    },
  },
  // Checkout flow (#58 step 3 slice): guest banner, step legends, customer fields,
  // payment hints and cards, summary and submit — every one seeded in all five
  // languages; the German bases are byte-identical to the literals they replaced so
  // the existing German specs stay green. {days}/{vat}/{number} are interpolated
  // values; {link} marks where the component renders its account link.
  {
    key: "shop.checkout.guestQuestion",
    area: "shop",
    de: "Sie haben bereits ein Konto?",
    texts: {
      fr: "Vous avez déjà un compte ?",
      it: "Avete già un account?",
      rm: "Avais gia in conto?",
      es: "¿Ya tiene una cuenta?",
    },
  },
  {
    key: "shop.action.login",
    area: "shop",
    de: "Anmelden",
    texts: { fr: "Se connecter", it: "Accedi", rm: "S'annunziar", es: "Iniciar sesión" },
  },
  {
    key: "shop.checkout.or",
    area: "shop",
    de: "oder",
    texts: { fr: "ou", it: "o", rm: "u", es: "o" },
  },
  {
    key: "shop.action.register",
    area: "shop",
    de: "Konto erstellen",
    texts: {
      fr: "Créer un compte",
      it: "Crea un account",
      rm: "Conto crear",
      es: "Crear una cuenta",
    },
  },
  {
    key: "shop.checkout.guestHint",
    area: "shop",
    de: "— oder als Gast bestellen.",
    texts: {
      fr: "— ou commander en tant qu'invité.",
      it: "— oppure ordinate come ospite.",
      rm: "— u ordinar sco giast.",
      es: "— o realice el pedido como invitado.",
    },
  },
  {
    key: "shop.checkout.emptyTitle",
    area: "shop",
    de: "Es gibt nichts zu bezahlen",
    texts: {
      fr: "Il n'y a rien à payer",
      it: "Non c'è nulla da pagare",
      rm: "I dat nagut da pajar",
      es: "No hay nada que pagar",
    },
  },
  {
    key: "shop.checkout.legend.address",
    area: "shop",
    de: "Adresse",
    texts: { fr: "Adresse", it: "Indirizzo", rm: "Indiris", es: "Dirección" },
  },
  {
    key: "shop.checkout.legend.shipping",
    area: "shop",
    de: "Versand",
    texts: { fr: "Livraison", it: "Spedizione", rm: "Spediziun", es: "Envío" },
  },
  {
    key: "shop.checkout.summary.shipping",
    area: "shop",
    de: "Versand",
    texts: { fr: "Livraison", it: "Spedizione", rm: "Spediziun", es: "Envío" },
  },
  {
    key: "shop.checkout.legend.payment",
    area: "shop",
    de: "Zahlung",
    texts: { fr: "Paiement", it: "Pagamento", rm: "Pajament", es: "Pago" },
  },
  {
    key: "shop.checkout.field.name",
    area: "shop",
    de: "Name, Vorname",
    texts: { fr: "Nom, prénom", it: "Cognome, nome", rm: "Num, prenum", es: "Apellido, nombre" },
  },
  {
    key: "shop.checkout.field.email",
    area: "shop",
    de: "E-Mail",
    texts: { fr: "E-Mail", it: "E-mail", rm: "E-mail", es: "Correo electrónico" },
  },
  {
    key: "shop.checkout.field.phone",
    area: "shop",
    de: "Telefon",
    texts: { fr: "Téléphone", it: "Telefono", rm: "Telefon", es: "Teléfono" },
  },
  {
    key: "shop.checkout.field.street",
    area: "shop",
    de: "Strasse, Hausnummer",
    texts: {
      fr: "Rue, numéro",
      it: "Via, numero civico",
      rm: "Via, numer",
      es: "Calle, número",
    },
  },
  {
    key: "shop.checkout.field.postalCode",
    area: "shop",
    de: "PLZ",
    texts: {
      fr: "NPA",
      it: "NAP",
      rm: "Numier postal",
      es: "Código postal",
    },
  },
  {
    key: "shop.checkout.field.city",
    area: "shop",
    de: "Ort",
    texts: { fr: "Localité", it: "Località", rm: "Lieu", es: "Localidad" },
  },
  {
    key: "shop.checkout.free",
    area: "shop",
    de: "Gratis",
    texts: { fr: "Gratuit", it: "Gratis", rm: "Gratuit", es: "Gratis" },
  },
  {
    key: "shop.checkout.paymentHint.invoice",
    area: "shop",
    de: "Zahlbar innert {days} Tagen",
    texts: {
      fr: "Paiable dans les {days} jours",
      it: "Pagabile entro {days} giorni",
      rm: "Pajabel en {days} dis",
      es: "Pagadero en {days} días",
    },
  },
  {
    key: "shop.checkout.paymentHint.pickup",
    area: "shop",
    de: "Bar oder Karte vor Ort",
    texts: {
      fr: "Espèces ou carte sur place",
      it: "Contanti o carta sul posto",
      rm: "En bar u carta sin lieu",
      es: "Efectivo o tarjeta en el lugar",
    },
  },
  {
    key: "shop.checkout.paymentHint.immediate",
    area: "shop",
    de: "Sofort, Demo",
    texts: {
      fr: "Immédiat, démo",
      it: "Immediato, demo",
      rm: "Immediat, demo",
      es: "Inmediato, demo",
    },
  },
  {
    key: "shop.checkout.invoiceNote",
    area: "shop",
    de: "Sie erhalten eine Swiss QR-Rechnung mit Referenz und Zahlungsfrist von {days} Tagen — offen sichtbar unter {link}.",
    texts: {
      fr: "Vous recevrez une facture QR suisse avec référence et délai de paiement de {days} jours — visible sous {link}.",
      it: "Riceverete una fattura QR svizzera con riferimento e termine di pagamento di {days} giorni — visibile sotto {link}.",
      rm: "Vus receivais ina quita QR svizra cun referenza e termin da pajament da {days} dis — visibel sut {link}.",
      es: "Recibirá una factura QR suiza con referencia y plazo de pago de {days} días — visible en {link}.",
    },
  },
  {
    key: "shop.checkout.invoiceLink",
    area: "shop",
    de: "Mein Konto → Rechnungen",
    texts: {
      fr: "Mon compte → Factures",
      it: "Il mio account → Fatture",
      rm: "Mes conto → Quitas",
      es: "Mi cuenta → Facturas",
    },
  },
  {
    key: "shop.checkout.pickupNote",
    area: "shop",
    de: "Sie zahlen erst bei der Abholung — bar oder per Karte. Den Abholcode erhalten Sie mit der Bestellbestätigung.",
    texts: {
      fr: "Vous ne payez qu'au retrait — en espèces ou par carte. Vous recevrez le code de retrait avec la confirmation de commande.",
      it: "Pagherete solo al ritiro — in contanti o con carta. Il codice di ritiro lo riceverete con la conferma d'ordine.",
      rm: "Vus pajais pir a la retratga — en bar u cun carta. Il code da retratga survegnis cun la conferma da l'ordin.",
      es: "Paga solo en la recogida — en efectivo o con tarjeta. El código de recogida lo recibirá con la confirmación del pedido.",
    },
  },
  {
    key: "shop.checkout.demoNotice",
    area: "shop",
    de: "Demo-Zahlung — es wird keine echte Karte belastet.",
    texts: {
      fr: "Paiement de démonstration — aucune vraie carte ne sera débitée.",
      it: "Pagamento demo — non verrà addebitata nessuna carta reale.",
      rm: "Pajament da demo — nagina carta vera vegn chargiada.",
      es: "Pago de demostración: no se cargará ninguna tarjeta real.",
    },
  },
  {
    key: "shop.checkout.card.name",
    area: "shop",
    de: "Karteninhaber",
    texts: {
      fr: "Titulaire de la carte",
      it: "Titolare della carta",
      rm: "Titular da la carta",
      es: "Titular de la tarjeta",
    },
  },
  {
    key: "shop.checkout.card.number",
    area: "shop",
    de: "Kartennummer",
    texts: {
      fr: "Numéro de carte",
      it: "Numero della carta",
      rm: "Numer da la carta",
      es: "Número de tarjeta",
    },
  },
  {
    key: "shop.checkout.card.expiry",
    area: "shop",
    de: "Gültig bis",
    texts: {
      fr: "Valable jusqu'à",
      it: "Valida fino a",
      rm: "Valida fin",
      es: "Válida hasta",
    },
  },
  {
    key: "shop.checkout.card.cvc",
    area: "shop",
    de: "CVC",
    texts: { fr: "CVC", it: "CVC", rm: "CVC", es: "CVC" },
  },
  {
    key: "shop.checkout.summaryTitle",
    area: "shop",
    de: "Bestellübersicht",
    texts: {
      fr: "Récapitulatif de la commande",
      it: "Riepilogo dell'ordine",
      rm: "Resum da l'ordin",
      es: "Resumen del pedido",
    },
  },
  {
    key: "shop.checkout.discount",
    area: "shop",
    de: "Rabatt",
    texts: { fr: "Réduction", it: "Sconto", rm: "Reducziun", es: "Descuento" },
  },
  {
    key: "shop.checkout.total",
    area: "shop",
    de: "Gesamt",
    texts: { fr: "Total", it: "Totale", rm: "Total", es: "Total" },
  },
  {
    key: "shop.checkout.vatNote",
    area: "shop",
    de: "{vat} inbegriffen",
    texts: {
      fr: "{vat} inclus",
      it: "{vat} inclusa",
      rm: "{vat} inclus",
      es: "{vat} incluido",
    },
  },
  {
    key: "shop.checkout.submit",
    area: "shop",
    de: "Jetzt kaufen",
    texts: {
      fr: "Acheter maintenant",
      it: "Acquista ora",
      rm: "Uss comprar",
      es: "Comprar ahora",
    },
  },
  {
    key: "shop.checkout.submitInvoice",
    area: "shop",
    de: "Bestellen",
    texts: { fr: "Commander", it: "Ordina", rm: "Ordinar", es: "Realizar pedido" },
  },
  {
    key: "shop.checkout.agb",
    area: "shop",
    de: "Mit der Bestellung akzeptieren Sie unsere AGB (Demo).",
    texts: {
      fr: "En commandant, vous acceptez nos CGV (démo).",
      it: "Effettuando l'ordine accettate le nostre CGC (demo).",
      rm: "Cun l'ordin acceptais Vus nossas CGC (demo).",
      es: "Al realizar el pedido acepta nuestras condiciones generales (demo).",
    },
  },
  {
    key: "shop.checkout.successTitle",
    area: "shop",
    de: "Bestellung aufgegeben",
    texts: {
      fr: "Commande passée",
      it: "Ordine effettuato",
      rm: "Ordin tramess",
      es: "Pedido realizado",
    },
  },
  {
    key: "shop.checkout.successDescription",
    area: "shop",
    de: "Bestellung {number}",
    texts: {
      fr: "Commande {number}",
      it: "Ordine {number}",
      rm: "Ordin {number}",
      es: "Pedido {number}",
    },
  },
  // Browse flow (#58 step 3 slice): product cards, product page, gallery, stock and
  // incoming-stock copy, reviews, restock alerts, listing, filters, sorting and
  // pagination — every one seeded in all five languages; the German bases are
  // byte-identical to the literals they replaced so the German specs stay green.
  {
    key: "shop.price.from",
    area: "shop",
    de: "ab",
    texts: { fr: "dès", it: "da", rm: "da", es: "desde" },
  },
  {
    key: "shop.card.featured",
    area: "shop",
    de: "Beliebt",
    texts: { fr: "Populaire", it: "Popolare", rm: "Popular", es: "Popular" },
  },
  {
    key: "shop.state.soldOut",
    area: "shop",
    de: "Ausverkauft",
    texts: { fr: "Épuisé", it: "Esaurito", rm: "Vendì", es: "Agotado" },
  },
  // Card toggles and the comparison tray (#58 step 3): the German bases are the former
  // literals — the English `${name} compare` #63 artifact is replaced by real German.
  {
    key: "shop.compare.add",
    area: "shop",
    de: "{name} vergleichen",
    texts: {
      fr: "Comparer {name}",
      it: "Confronta {name}",
      rm: "Cumparegliar {name}",
      es: "Comparar {name}",
    },
  },
  {
    key: "shop.compare.remove",
    area: "shop",
    de: "{name} aus dem Vergleich entfernen",
    texts: {
      fr: "Retirer {name} du comparateur",
      it: "Rimuovi {name} dal confronto",
      rm: "Eliminescha {name} dal cumparegl",
      es: "Quitar {name} de la comparación",
    },
  },
  {
    key: "shop.compare.addShort",
    area: "shop",
    de: "Vergleichen",
    texts: { fr: "Comparer", it: "Confronta", rm: "Cumparegliar", es: "Comparar" },
  },
  {
    key: "shop.compare.removeShort",
    area: "shop",
    de: "Aus dem Vergleich entfernen",
    texts: {
      fr: "Retirer du comparateur",
      it: "Rimuovi dal confronto",
      rm: "Eliminescha dal cumparegl",
      es: "Quitar de la comparación",
    },
  },
  {
    key: "shop.compare.trayCount",
    area: "shop",
    de: "{count} im Vergleich",
    texts: {
      fr: "{count} dans le comparateur",
      it: "{count} nel confronto",
      rm: "{count} en il cumparegl",
      es: "{count} en la comparación",
    },
  },
  {
    key: "shop.compare.action",
    area: "shop",
    de: "Vergleichen",
    texts: { fr: "Comparer", it: "Confronta", rm: "Cumparegliar", es: "Comparar" },
  },
  {
    key: "shop.compare.clear",
    area: "shop",
    de: "Vergleichsliste leeren",
    texts: {
      fr: "Vider la liste de comparaison",
      it: "Svuota la lista di confronto",
      rm: "Svidar la glista da cumparegl",
      es: "Vaciar la lista de comparación",
    },
  },
  {
    key: "shop.wishlist.add",
    area: "shop",
    de: "{name} auf die Wunschliste",
    texts: {
      fr: "Ajouter {name} à la liste de souhaits",
      it: "Aggiungi {name} alla lista dei desideri",
      rm: "Agiuntar {name} sin la glista da desideris",
      es: "Añadir {name} a la lista de deseos",
    },
  },
  {
    key: "shop.wishlist.remove",
    area: "shop",
    de: "{name} von der Wunschliste entfernen",
    texts: {
      fr: "Retirer {name} de la liste de souhaits",
      it: "Rimuovi {name} dalla lista dei desideri",
      rm: "Eliminescha {name} da la glista da desideris",
      es: "Quitar {name} de la lista de deseos",
    },
  },
  {
    key: "shop.wishlist.addShort",
    area: "shop",
    de: "Auf die Wunschliste",
    texts: {
      fr: "Ajouter à la liste de souhaits",
      it: "Aggiungi alla lista dei desideri",
      rm: "Agiuntar sin la glista da desideris",
      es: "Añadir a la lista de deseos",
    },
  },
  {
    key: "shop.wishlist.removeShort",
    area: "shop",
    de: "Von der Wunschliste entfernen",
    texts: {
      fr: "Retirer de la liste de souhaits",
      it: "Rimuovi dalla lista dei desideri",
      rm: "Eliminescha da la glista da desideris",
      es: "Quitar de la lista de deseos",
    },
  },
  {
    key: "shop.product.vatNote",
    area: "shop",
    de: "inkl. {vat}.",
    texts: {
      fr: "{vat} incluse.",
      it: "{vat} inclusa.",
      rm: "{vat} inclus.",
      es: "{vat} incluido.",
    },
  },
  {
    key: "shop.product.incomingTitle",
    area: "shop",
    de: "Ausverkauft — Nachschub ist bestellt",
    texts: {
      fr: "Épuisé — le réapprovisionnement est commandé",
      it: "Esaurito — il riassortimento è ordinato",
      rm: "Vendì — la replenaziun è ordinada",
      es: "Agotado — el reabastecimiento está pedido",
    },
  },
  {
    key: "shop.product.decrease",
    area: "shop",
    de: "Menge verringern",
    texts: {
      fr: "Diminuer la quantité",
      it: "Riduci quantità",
      rm: "Quantitad reducer",
      es: "Reducir cantidad",
    },
  },
  {
    key: "shop.product.increase",
    area: "shop",
    de: "Menge erhöhen",
    texts: {
      fr: "Augmenter la quantité",
      it: "Aumenta quantità",
      rm: "Quantitad augmentar",
      es: "Aumentar cantidad",
    },
  },
  {
    key: "shop.product.selectMissing",
    area: "shop",
    de: "Bitte {options} wählen",
    texts: {
      fr: "Veuillez choisir {options}",
      it: "Selezionate {options}",
      rm: "Per plaschair tscherna {options}",
      es: "Seleccione {options}",
    },
  },
  {
    key: "shop.product.variantInfo",
    area: "shop",
    de: "Variante: {variant} · Gewicht: {weight} · Art.-Nr. {sku}",
    texts: {
      fr: "Variante : {variant} · Poids : {weight} · Réf. {sku}",
      it: "Variante: {variant} · Peso: {weight} · Cod. art. {sku}",
      rm: "Varianta: {variant} · Pais: {weight} · Nr. d'art. {sku}",
      es: "Variante: {variant} · Peso: {weight} · N.º de artículo {sku}",
    },
  },
  // Swiss German: the plural of „das Stück“ stays „Stück“ (issue #28), never „Stücke“.
  {
    key: "shop.stock.low.one",
    area: "shop",
    de: "Nur noch {stock} Stück",
    texts: {
      fr: "Plus que {stock} pièce",
      it: "Solo {stock} pezzo rimasto",
      rm: "Mo {stock} pia",
      es: "Solo queda {stock} unidad",
    },
  },
  {
    key: "shop.stock.low.other",
    area: "shop",
    de: "Nur noch {stock} Stück",
    texts: {
      fr: "Plus que {stock} pièces",
      it: "Solo {stock} pezzi rimasti",
      rm: "Mo {stock} pias",
      es: "Solo quedan {stock} unidades",
    },
  },
  {
    key: "shop.stock.in",
    area: "shop",
    de: "Sofort lieferbar",
    texts: {
      fr: "Livré immédiatement",
      it: "Pronto per la spedizione",
      rm: "Spediziun immediata",
      es: "Disponible inmediatamente",
    },
  },
  {
    key: "shop.product.incoming",
    area: "shop",
    de: "{qty} Stk. bestellt, Ankunft ca. {bucket}",
    texts: {
      fr: "{qty} pc commandées, arrivée approx. {bucket}",
      it: "{qty} pz ordinati, arrivo previsto {bucket}",
      rm: "{qty} pias ordinadas, arranschà circha {bucket}",
      es: "{qty} uds. pedidas, llegada aprox. {bucket}",
    },
  },
  {
    key: "shop.product.arrival.today",
    area: "shop",
    de: "heute",
    texts: { fr: "aujourd'hui", it: "oggi", rm: "oz", es: "hoy" },
  },
  {
    key: "shop.product.arrival.tomorrow",
    area: "shop",
    de: "morgen",
    texts: { fr: "demain", it: "domani", rm: "damaun", es: "mañana" },
  },
  {
    key: "shop.product.arrival.days",
    area: "shop",
    de: "in {days} Tagen",
    texts: {
      fr: "dans {days} jours",
      it: "tra {days} giorni",
      rm: "en {days} dis",
      es: "en {days} días",
    },
  },
  {
    key: "shop.product.arrival.weeks",
    area: "shop",
    de: "in {weeks} Wochen",
    texts: {
      fr: "dans {weeks} semaines",
      it: "tra {weeks} settimane",
      rm: "en {weeks} emnas",
      es: "en {weeks} semanas",
    },
  },
  {
    key: "shop.gallery.previous",
    area: "shop",
    de: "Vorheriges Bild",
    texts: {
      fr: "Image précédente",
      it: "Immagine precedente",
      rm: "Malet precedenta",
      es: "Imagen anterior",
    },
  },
  {
    key: "shop.gallery.next",
    area: "shop",
    de: "Nächstes Bild",
    texts: {
      fr: "Image suivante",
      it: "Immagine successiva",
      rm: "Malet suandanta",
      es: "Imagen siguiente",
    },
  },
  {
    key: "shop.gallery.thumb",
    area: "shop",
    de: "Bild {index} von {total}: {alt}",
    texts: {
      fr: "Image {index} sur {total} : {alt}",
      it: "Immagine {index} di {total}: {alt}",
      rm: "Malet {index} da {total}: {alt}",
      es: "Imagen {index} de {total}: {alt}",
    },
  },
  {
    key: "shop.reviews.title",
    area: "shop",
    de: "Bewertungen",
    texts: { fr: "Avis", it: "Recensioni", rm: "Evaluaziuns", es: "Valoraciones" },
  },
  {
    key: "shop.reviews.count.one",
    area: "shop",
    de: "{count} Bewertung",
    texts: {
      fr: "{count} avis",
      it: "{count} recensione",
      rm: "{count} evaluaziun",
      es: "{count} valoración",
    },
  },
  {
    key: "shop.reviews.count.other",
    area: "shop",
    de: "{count} Bewertungen",
    texts: {
      fr: "{count} avis",
      it: "{count} recensioni",
      rm: "{count} evaluaziuns",
      es: "{count} valoraciones",
    },
  },
  {
    key: "shop.reviews.distributionAria",
    area: "shop",
    de: "{count} von {total} Bewertungen mit {stars} Sternen",
    texts: {
      fr: "{count} avis sur {total} avec {stars} étoiles",
      it: "{count} di {total} recensioni con {stars} stelle",
      rm: "{count} da {total} evaluaziuns cun {stars} stailas",
      es: "{count} de {total} valoraciones con {stars} estrellas",
    },
  },
  {
    key: "shop.reviews.none",
    area: "shop",
    de: "Noch keine Bewertungen — kaufen Sie dieses Produkt und seien Sie die erste Person, die es bewertet.",
    texts: {
      fr: "Aucun avis pour l'instant — achetez ce produit et soyez la première personne à le noter.",
      it: "Ancora nessuna recensione — acquistate questo prodotto e siate i primi a recensirlo.",
      rm: "Nagina evaluaziun fin qua — cumprai quest product e sii l'emprima persuna per valitar el.",
      es: "Aún no hay valoraciones: compre este producto y sea la primera persona en valorarlo.",
    },
  },
  {
    key: "shop.reviews.verified",
    area: "shop",
    de: "Verifizierter Kauf",
    texts: {
      fr: "Achat vérifié",
      it: "Acquisto verificato",
      rm: "Cumpra verifitgada",
      es: "Compra verificada",
    },
  },
  {
    key: "shop.reviews.reply",
    area: "shop",
    de: "Antwort vom coder-shop",
    texts: {
      fr: "Réponse du coder-shop",
      it: "Risposta di coder-shop",
      rm: "Resposta dal coder-shop",
      es: "Respuesta de coder-shop",
    },
  },
  {
    key: "shop.reviews.pending",
    area: "shop",
    de: "Vielen Dank! Ihre Bewertung ist eingereicht und wird in Kürze freigeschaltet.",
    texts: {
      fr: "Merci ! Votre avis a été soumis et sera publié prochainement.",
      it: "Grazie! La vostra recensione è stata inviata e sarà pubblicata a breve.",
      rm: "Grazia! Vossa evaluaziun è entrada e vegn publitgada curt.",
      es: "¡Gracias! Su valoración se ha enviado y se publicará pronto.",
    },
  },
  {
    key: "shop.reviews.done",
    area: "shop",
    de: "Sie haben dieses Produkt bereits bewertet — vielen Dank!",
    texts: {
      fr: "Vous avez déjà noté ce produit — merci !",
      it: "Avete già recensito questo prodotto — grazie!",
      rm: "Avais gia valità quest product — grazia!",
      es: "Ya ha valorado este producto — ¡muchas gracias!",
    },
  },
  {
    key: "shop.reviews.buyersOnly",
    area: "shop",
    de: "Bewertungen können nur Kundinnen und Kunden schreiben, die dieses Produkt gekauft haben.",
    texts: {
      fr: "Seuls les clients ayant acheté ce produit peuvent laisser un avis.",
      it: "Solo i clienti che hanno acquistato questo prodotto possono scrivere una recensione.",
      rm: "Mo clients che han cumprà quest product pon scriver ina evaluaziun.",
      es: "Solo los clientes que han comprado este producto pueden escribir valoraciones.",
    },
  },
  {
    key: "shop.reviews.formTitle",
    area: "shop",
    de: "Produkt bewerten",
    texts: {
      fr: "Noter le produit",
      it: "Recensisci il prodotto",
      rm: "Product valitar",
      es: "Valorar producto",
    },
  },
  {
    key: "shop.reviews.ratingLegend",
    area: "shop",
    de: "Ihre Bewertung",
    texts: {
      fr: "Votre note",
      it: "La vostra valutazione",
      rm: "Vossa evaluaziun",
      es: "Su valoración",
    },
  },
  {
    key: "shop.reviews.starAria",
    area: "shop",
    de: "{star} von 5 Sternen",
    texts: {
      fr: "{star} sur 5 étoiles",
      it: "{star} su 5 stelle",
      rm: "{star} da 5 stailas",
      es: "{star} de 5 estrellas",
    },
  },
  {
    key: "shop.reviews.titlePlaceholder",
    area: "shop",
    de: "Titel (optional)",
    texts: {
      fr: "Titre (facultatif)",
      it: "Titolo (facoltativo)",
      rm: "Titel (opziunal)",
      es: "Título (opcional)",
    },
  },
  {
    key: "shop.reviews.bodyPlaceholder",
    area: "shop",
    de: "Wie zufrieden sind Sie mit {name}?",
    texts: {
      fr: "Quel est votre niveau de satisfaction avec {name} ?",
      it: "Quanto è soddisfatto di {name}?",
      rm: "Co cuntent es Vus cun {name}?",
      es: "¿Qué nivel de satisfacción tiene con {name}?",
    },
  },
  {
    key: "shop.reviews.submit",
    area: "shop",
    de: "Bewertung absenden",
    texts: {
      fr: "Envoyer l'avis",
      it: "Invia recensione",
      rm: "Tramander l'evaluaziun",
      es: "Enviar valoración",
    },
  },
  {
    key: "shop.restock.title",
    area: "shop",
    de: "Benachrichtigen, wenn wieder verfügbar",
    texts: {
      fr: "M'avertir quand le produit sera de nouveau disponible",
      it: "Avvisami quando di nuovo disponibile",
      rm: "Avrisar cur puspè disponibel",
      es: "Avísame cuando esté disponible",
    },
  },
  {
    key: "shop.restock.submit",
    area: "shop",
    de: "Benachrichtigen",
    texts: { fr: "M'avertir", it: "Avvisami", rm: "Avrisar", es: "Avísame" },
  },
  {
    key: "shop.restock.emailAria",
    area: "shop",
    de: "E-Mail für Benachrichtigung zu {name}",
    texts: {
      fr: "E-mail pour l'avertissement concernant {name}",
      it: "E-mail per l'avviso su {name}",
      rm: "E-mail per l'avrisament sin {name}",
      es: "Correo electrónico para el aviso de {name}",
    },
  },
  {
    key: "shop.restock.subscribed",
    area: "shop",
    de: "Benachrichtigung für {email} ist vorgemerkt.",
    texts: {
      fr: "L'avertissement pour {email} est enregistré.",
      it: "L'avviso per {email} è registrato.",
      rm: "L'avrisar per {email} è notà.",
      es: "El aviso para {email} queda registrado.",
    },
  },
  {
    key: "shop.restock.inStockToast",
    area: "shop",
    de: "Der Artikel ist wieder an Lager — viel Freude damit.",
    texts: {
      fr: "L'article est de nouveau en stock — profitez-en !",
      it: "L'articolo è di nuovo disponibile — buon divertimento.",
      rm: "L'artitgel è puspè en magazun — di bun plaschair.",
      es: "El artículo vuelve a estar en stock — que lo disfrute.",
    },
  },
  {
    key: "shop.restock.notifiedToast",
    area: "shop",
    de: "Wir geben Bescheid, sobald der Artikel wieder an Lager ist.",
    texts: {
      fr: "Nous vous préviendrons dès que l'article sera de nouveau en stock.",
      it: "La avviseremo non appena l'articolo sarà di nuovo disponibile.",
      rm: "No avisain, gist cur l'artitgel è puspè en magazun.",
      es: "Le avisaremos en cuanto el artículo vuelva a estar en stock.",
    },
  },
  {
    key: "shop.restock.errorToast",
    area: "shop",
    de: "Die Anmeldung hat nicht funktioniert.",
    texts: {
      fr: "L'inscription n'a pas fonctionné.",
      it: "L'iscrizione non è riuscita.",
      rm: "L'inscripziun n'ha betg funcziunà.",
      es: "El registro no ha funcionado.",
    },
  },
  {
    key: "shop.breadcrumbs.start",
    area: "shop",
    de: "Start",
    texts: { fr: "Accueil", it: "Home", rm: "Start", es: "Inicio" },
  },
  {
    key: "shop.breadcrumbs.aria",
    area: "shop",
    de: "Brotkrumen-Navigation",
    texts: {
      fr: "Navigation fil d'Ariane",
      it: "Navigazione a briciole di pane",
      rm: "Navigaziun cun brum",
      es: "Miga de pan",
    },
  },
  {
    key: "shop.product.description",
    area: "shop",
    de: "Beschreibung",
    texts: { fr: "Description", it: "Descrizione", rm: "Descripziun", es: "Descripción" },
  },
  {
    key: "shop.product.details",
    area: "shop",
    de: "Details & Varianten",
    texts: {
      fr: "Détails et variantes",
      it: "Dettagli e varianti",
      rm: "Detagls e variantas",
      es: "Detalles y variantes",
    },
  },
  {
    key: "shop.product.related",
    area: "shop",
    de: "Ähnliche Produkte",
    texts: {
      fr: "Produits similaires",
      it: "Prodotti simili",
      rm: "Products simils",
      es: "Productos similares",
    },
  },
  {
    key: "shop.recent.title",
    area: "shop",
    de: "Zuletzt angesehen",
    texts: {
      fr: "Récemment consultés",
      it: "Visti di recente",
      rm: "Ultimamain vis",
      es: "Vistos recientemente",
    },
  },
  {
    key: "shop.listing.all",
    area: "shop",
    de: "Alle",
    texts: { fr: "Tous", it: "Tutti", rm: "Tut", es: "Todos" },
  },
  {
    key: "shop.listing.allProducts",
    area: "shop",
    de: "Alle Produkte",
    texts: {
      fr: "Tous les produits",
      it: "Tutti i prodotti",
      rm: "Tut ils products",
      es: "Todos los productos",
    },
  },
  {
    key: "shop.listing.collection",
    area: "shop",
    de: "Kollektion:",
    texts: { fr: "Collection :", it: "Collezione:", rm: "Collezione:", es: "Colección:" },
  },
  {
    key: "shop.listing.removeCollection",
    area: "shop",
    de: "Kollektion {name} entfernen",
    texts: {
      fr: "Retirer la collection {name}",
      it: "Rimuovi la collezione {name}",
      rm: "Eliminescha la collezione {name}",
      es: "Quitar la colección {name}",
    },
  },
  {
    key: "shop.listing.count.one",
    area: "shop",
    de: "{count} Produkt",
    texts: {
      fr: "{count} produit",
      it: "{count} prodotto",
      rm: "{count} product",
      es: "{count} producto",
    },
  },
  {
    key: "shop.listing.count.other",
    area: "shop",
    de: "{count} Produkte",
    texts: {
      fr: "{count} produits",
      it: "{count} prodotti",
      rm: "{count} products",
      es: "{count} productos",
    },
  },
  {
    key: "shop.listing.filter",
    area: "shop",
    de: "Filter",
    texts: { fr: "Filtres", it: "Filtri", rm: "Filtris", es: "Filtros" },
  },
  {
    key: "shop.listing.sort",
    area: "shop",
    de: "Sortierung",
    texts: { fr: "Trier", it: "Ordinamento", rm: "Ordinament", es: "Ordenar" },
  },
  {
    key: "shop.sort.newest",
    area: "shop",
    de: "Neueste",
    texts: {
      fr: "Plus récents",
      it: "Più recenti",
      rm: "Ils pli novs",
      es: "Más recientes",
    },
  },
  {
    key: "shop.sort.priceAsc",
    area: "shop",
    de: "Preis aufsteigend",
    texts: {
      fr: "Prix croissant",
      it: "Prezzo crescente",
      rm: "Pretschs creschents",
      es: "Precio: de menor a mayor",
    },
  },
  {
    key: "shop.sort.priceDesc",
    area: "shop",
    de: "Preis absteigend",
    texts: {
      fr: "Prix décroissant",
      it: "Prezzo decrescente",
      rm: "Pretschs decreschents",
      es: "Precio: de mayor a menor",
    },
  },
  {
    key: "shop.sort.rating",
    area: "shop",
    de: "Beste Bewertungen",
    texts: {
      fr: "Meilleurs avis",
      it: "Recensioni migliori",
      rm: "Las meglras evaluaziuns",
      es: "Mejores valoraciones",
    },
  },
  {
    key: "shop.listing.emptyTitle",
    area: "shop",
    de: "Keine Produkte gefunden",
    texts: {
      fr: "Aucun produit trouvé",
      it: "Nessun prodotto trovato",
      rm: "Nagins products chattads",
      es: "No se han encontrado productos",
    },
  },
  {
    key: "shop.listing.emptyBody",
    area: "shop",
    de: "Für diese Filterkombination gibt es keine Treffer. Versuchen Sie, Filter zu entfernen.",
    texts: {
      fr: "Aucun résultat pour cette combinaison de filtres. Essayez de retirer des filtres.",
      it: "Nessun risultato per questa combinazione di filtri. Provate a rimuovere dei filtri.",
      rm: "Nagins resultats cun questa cumminaziun da filtris. Empruvai da matar dals filtris.",
      es: "No hay resultados para esta combinación de filtros. Pruebe a quitar filtros.",
    },
  },
  {
    key: "shop.listing.resetFilters",
    area: "shop",
    de: "Filter zurücksetzen",
    texts: {
      fr: "Réinitialiser les filtres",
      it: "Reimposta filtri",
      rm: "Filtris restabilisar",
      es: "Restablecer filtros",
    },
  },
  {
    key: "shop.pagination.label",
    area: "shop",
    de: "Seiten",
    texts: { fr: "Pages", it: "Pagine", rm: "Paginas", es: "Páginas" },
  },
  {
    key: "shop.pagination.showing",
    area: "shop",
    de: "Zeige {from}–{to} von {total}",
    texts: {
      fr: "Affichage {from}–{to} sur {total}",
      it: "Mostrati {from}–{to} di {total}",
      rm: "Mussar {from}–{to} da {total}",
      es: "Mostrando {from}–{to} de {total}",
    },
  },
  {
    key: "shop.pagination.previous",
    area: "shop",
    de: "Zurück",
    texts: { fr: "Précédent", it: "Precedente", rm: "Enavos", es: "Anterior" },
  },
  {
    key: "shop.pagination.next",
    area: "shop",
    de: "Weiter",
    texts: { fr: "Suivant", it: "Successivo", rm: "Vinavant", es: "Siguiente" },
  },
  {
    key: "shop.filter.brand",
    area: "shop",
    de: "Marke",
    texts: { fr: "Marque", it: "Marca", rm: "Marca", es: "Marca" },
  },
  {
    key: "shop.filter.groupEu",
    area: "shop",
    de: "{label} (EU)",
    texts: { fr: "{label} (UE)", it: "{label} (UE)", rm: "{label} (UE)", es: "{label} (UE)" },
  },
  {
    key: "shop.filter.groupClothing",
    area: "shop",
    de: "{label} (Kleider)",
    texts: {
      fr: "{label} (vêtements)",
      it: "{label} (abbigliamento)",
      rm: "{label} (vestgadira)",
      es: "{label} (ropa)",
    },
  },
  {
    key: "shop.skip",
    area: "shop",
    de: "Zum Inhalt springen",
    texts: {
      fr: "Aller au contenu",
      it: "Vai al contenuto",
      rm: "Ir al cuntegn",
      es: "Saltar al contenido",
    },
  },
  // Page metadata (#58 step 3): titles and descriptions per page, {placeholders} for
  // the VAT label and the order number.
  {
    key: "shop.meta.products.title",
    area: "shop",
    de: "Alle Produkte",
    texts: { fr: "Tous les produits", it: "Tutti i prodotti", rm: "Tut ils products", es: "Todos los productos" },
  },
  {
    key: "shop.meta.products.description",
    area: "shop",
    de: "Das Sortiment des coder-shop — filterbar nach Marke und den Attributen der Produkte.",
    texts: {
      fr: "L'assortiment de coder-shop — filtrable par marque et par attribut des produits.",
      it: "L'assortimento di coder-shop — filtrabile per marca e attributi dei prodotti.",
      rm: "Il assortment dal coder-shop — filtrabel ten marca ed attributs dals products.",
      es: "El surtido de coder-shop: filtrable por marca y atributos de los productos.",
    },
  },
  {
    key: "shop.meta.cart.title",
    area: "shop",
    de: "Warenkorb",
    texts: { fr: "Panier", it: "Carrello", rm: "Charret", es: "Cesta" },
  },
  {
    key: "shop.meta.cart.description",
    area: "shop",
    de: "Ihr Warenkorb — coder-shop. Preise in CHF inklusive {vat}",
    texts: {
      fr: "Votre panier — coder-shop. Prix en CHF, {vat} comprise",
      it: "Il vostro carrello — coder-shop. Prezzi in CHF, {vat} inclusa",
      rm: "Voss charret — coder-shop. Pretschs en CHF, {vat} inclus",
      es: "Su cesta — coder-shop. Precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.meta.checkout.title",
    area: "shop",
    de: "Kasse",
    texts: { fr: "Caisse", it: "Cassa", rm: "Cassa", es: "Caja" },
  },
  {
    key: "shop.meta.checkout.description",
    area: "shop",
    de: "Adresse, Versand und Zahlung — coder-shop. Preise in CHF inklusive {vat}",
    texts: {
      fr: "Adresse, livraison et paiement — coder-shop. Prix en CHF, {vat} comprise",
      it: "Indirizzo, spedizione e pagamento — coder-shop. Prezzi in CHF, {vat} inclusa",
      rm: "Indiris, spediziun e pajament — coder-shop. Pretschs en CHF, {vat} inclus",
      es: "Dirección, envío y pago — coder-shop. Precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.meta.compare.title",
    area: "shop",
    de: "Produkte vergleichen",
    texts: {
      fr: "Comparer des produits",
      it: "Confrontare prodotti",
      rm: "Comparar products",
      es: "Comparar productos",
    },
  },
  {
    key: "shop.meta.compare.description",
    area: "shop",
    de: "Bis zu vier Produkte Seite an Seite — Preise, Marken und die Attribute des Typs.",
    texts: {
      fr: "Jusqu'à quatre produits côte à côte — prix, marques et attributs du type.",
      it: "Fino a quattro prodotti fianco a fianco — prezzi, marchi e attributi del tipo.",
      rm: "Fin a quatter products in ina rinfatscha — pretschs, marcas ed attributs dal tip.",
      es: "Hasta cuatro productos lado a lado: precios, marcas y atributos del tipo.",
    },
  },
  {
    key: "shop.meta.order.title",
    area: "shop",
    de: "Bestellung {number}",
    texts: { fr: "Commande {number}", it: "Ordine {number}", rm: "Ordin {number}", es: "Pedido {number}" },
  },
  {
    key: "shop.meta.order.description",
    area: "shop",
    de: "Status und Details Ihrer Bestellung {number} — coder-shop.",
    texts: {
      fr: "Statut et détails de votre commande {number} — coder-shop.",
      it: "Stato e dettagli del vostro ordine {number} — coder-shop.",
      rm: "Status e detagls da voss ordin {number} — coder-shop.",
      es: "Estado y detalles de su pedido {number} — coder-shop.",
    },
  },
  // Order confirmation flow (#58 step 3 slice): the customer-visible status labels
  // (`shop.status.<status>`, keys derived from the state-machine statuses) and every
  // text of the confirmation page, the status chain and the access form. The German
  // bases are byte-identical to the literals they replaced; STATUS_LABELS and
  // PICKUP_PAYMENT_TYPE_LABELS stay as the German base for the admin (admin slice).
  {
    key: "shop.status.new",
    area: "shop",
    de: "Neu",
    texts: { fr: "Nouvelle", it: "Nuovo", rm: "Nov", es: "Nueva" },
  },
  {
    key: "shop.status.paid",
    area: "shop",
    de: "Bezahlt",
    texts: { fr: "Payée", it: "Pagato", rm: "Pajà", es: "Pagada" },
  },
  {
    key: "shop.status.picking",
    area: "shop",
    de: "In Kommission",
    texts: {
      fr: "En préparation",
      it: "In preparazione",
      rm: "En preparaziun",
      es: "En preparación",
    },
  },
  {
    key: "shop.status.packed",
    area: "shop",
    de: "Verpackt",
    texts: { fr: "Emballée", it: "Imballato", rm: "Imballà", es: "Embalada" },
  },
  {
    key: "shop.status.shipped",
    area: "shop",
    de: "Versandt",
    texts: { fr: "Expédiée", it: "Spedito", rm: "Tramess", es: "Enviada" },
  },
  {
    key: "shop.status.delivered",
    area: "shop",
    de: "Zugestellt",
    texts: { fr: "Livrée", it: "Consegnato", rm: "Consegnà", es: "Entregada" },
  },
  {
    key: "shop.status.ready",
    area: "shop",
    de: "Bereit zur Abholung",
    texts: {
      fr: "Prête au retrait",
      it: "Pronto per il ritiro",
      rm: "Pront per la retratga",
      es: "Listo para recoger",
    },
  },
  {
    key: "shop.status.picked_up",
    area: "shop",
    de: "Abgeholt",
    texts: { fr: "Retirée", it: "Ritirato", rm: "Retirà", es: "Recogida" },
  },
  {
    key: "shop.status.cancelled",
    area: "shop",
    de: "Storniert",
    texts: { fr: "Annulée", it: "Annullato", rm: "Annullà", es: "Cancelada" },
  },
  {
    key: "shop.order.thanks",
    area: "shop",
    de: "Vielen Dank für Ihre Bestellung!",
    texts: {
      fr: "Merci pour votre commande !",
      it: "Grazie per il vostro ordine!",
      rm: "Grazia per Voss ordin!",
      es: "¡Gracias por su pedido!",
    },
  },
  {
    key: "shop.order.heading",
    area: "shop",
    de: "Bestellung {number}",
    texts: { fr: "Commande {number}", it: "Ordine {number}", rm: "Ordin {number}", es: "Pedido {number}" },
  },
  {
    key: "shop.order.tracking",
    area: "shop",
    de: "Sendungsverfolgung: {number}",
    texts: {
      fr: "Suivi d'envoi : {number}",
      it: "Tracciamento della spedizione: {number}",
      rm: "Trackenzia da la spediziun: {number}",
      es: "Seguimiento del envío: {number}",
    },
  },
  {
    key: "shop.order.parcelWeight",
    area: "shop",
    de: "Paketgewicht {weight}",
    texts: {
      fr: "Poids du colis : {weight}",
      it: "Peso del pacco: {weight}",
      rm: "Pes dal pachet {weight}",
      es: "Peso del paquete: {weight}",
    },
  },
  {
    key: "shop.order.invoice.title",
    area: "shop",
    de: "Zahlung per Rechnung",
    texts: {
      fr: "Paiement sur facture",
      it: "Pagamento su fattura",
      rm: "Pajament sin quita",
      es: "Pago por factura",
    },
  },
  {
    key: "shop.order.invoice.due",
    area: "shop",
    de: "Zahlbar bis {date} · Referenz {reference}",
    texts: {
      fr: "Paiable jusqu'au {date} · Référence {reference}",
      it: "Pagabile entro il {date} · Riferimento {reference}",
      rm: "Pajabel fin il {date} · Referenza {reference}",
      es: "Pagable hasta el {date} · Referencia {reference}",
    },
  },
  {
    key: "shop.order.invoice.open",
    area: "shop",
    de: "Offen: {amount}",
    texts: {
      fr: "Reste dû : {amount}",
      it: "Resto: {amount}",
      rm: "Restant: {amount}",
      es: "Pendiente: {amount}",
    },
  },
  {
    key: "shop.order.invoice.paid",
    area: "shop",
    de: "Rechnung bezahlt — vielen Dank.",
    texts: {
      fr: "Facture payée — merci.",
      it: "Fattura pagata — grazie.",
      rm: "Quita pajada — grazia.",
      es: "Factura pagada — muchas gracias.",
    },
  },
  {
    key: "shop.order.invoice.pdf",
    area: "shop",
    de: "Rechnung als PDF",
    texts: {
      fr: "Facture en PDF",
      it: "Fattura in PDF",
      rm: "Quita en PDF",
      es: "Factura en PDF",
    },
  },
  {
    key: "shop.order.pickup.title",
    area: "shop",
    de: "Abholung im Laden",
    texts: {
      fr: "Retrait en boutique",
      it: "Ritiro in negozio",
      rm: "Retratga en il store",
      es: "Recogida en la tienda",
    },
  },
  {
    key: "shop.order.pickup.pickedUp",
    area: "shop",
    de: "Abgeholt am {datetime}",
    texts: {
      fr: "Retirée le {datetime}",
      it: "Ritirato il {datetime}",
      rm: "Retirà ils {datetime}",
      es: "Recogido el {datetime}",
    },
  },
  {
    key: "shop.order.pickup.paidVia",
    area: "shop",
    de: "bezahlt ({type})",
    texts: { fr: "payée ({type})", it: "pagato ({type})", rm: "pajà ({type})", es: "pagado ({type})" },
  },
  {
    key: "shop.order.pickup.ready",
    area: "shop",
    de: "Bereit zur Abholung — Code und QR-Code an der Kasse zeigen.",
    texts: {
      fr: "Prête au retrait — présentez le code et le QR code à la caisse.",
      it: "Pronto per il ritiro — mostri il codice e il QR code alla cassa.",
      rm: "Pront per la retratga — mussratescha il code ed il code QR a la cassa.",
      es: "Listo para recoger — muestre el código y el código QR en la caja.",
    },
  },
  {
    key: "shop.order.pickup.waiting",
    area: "shop",
    de: "Sie erhalten den Abholcode, sobald die Bestellung bereit liegt.",
    texts: {
      fr: "Vous recevrez le code de retrait dès que la commande sera prête.",
      it: "Riceverà il codice di ritiro quando l'ordine sarà pronto.",
      rm: "Receivais il code da retratga, cura che l'ordin è pront.",
      es: "Recibirá el código de recogida en cuanto el pedido esté listo.",
    },
  },
  {
    key: "shop.order.pickup.code",
    area: "shop",
    de: "Abholcode",
    texts: { fr: "Code de retrait", it: "Codice di ritiro", rm: "Code da retratga", es: "Código de recogida" },
  },
  {
    key: "shop.order.pickup.qrAlt",
    area: "shop",
    de: "QR-Code mit Abholcode {code}",
    texts: {
      fr: "QR code avec le code de retrait {code}",
      it: "QR code con il codice di ritiro {code}",
      rm: "Code QR cun il code da retratga {code}",
      es: "Código QR con el código de recogida {code}",
    },
  },
  {
    key: "shop.order.pickup.payment.cash",
    area: "shop",
    de: "Bar",
    texts: { fr: "Espèces", it: "Contanti", rm: "En bar", es: "Efectivo" },
  },
  {
    key: "shop.order.pickup.payment.card",
    area: "shop",
    de: "Karte",
    texts: { fr: "Carte", it: "Carta", rm: "Carta", es: "Tarjeta" },
  },
  {
    key: "shop.order.paymentReference",
    area: "shop",
    de: "Zahlungsreferenz {reference}",
    texts: {
      fr: "Référence de paiement {reference}",
      it: "Riferimento di pagamento {reference}",
      rm: "Referenza da pajament {reference}",
      es: "Referencia de pago {reference}",
    },
  },
  {
    key: "shop.order.discount",
    area: "shop",
    de: "Rabatt ({code})",
    texts: {
      fr: "Réduction ({code})",
      it: "Sconto ({code})",
      rm: "Reducziun ({code})",
      es: "Descuento ({code})",
    },
  },
  {
    key: "shop.order.addressInvoice",
    area: "shop",
    de: "Rechnungsadresse",
    texts: {
      fr: "Adresse de facturation",
      it: "Indirizzo di fatturazione",
      rm: "Indrizz da quita",
      es: "Dirección de facturación",
    },
  },
  {
    key: "shop.order.addressDelivery",
    area: "shop",
    de: "Lieferadresse",
    texts: {
      fr: "Adresse de livraison",
      it: "Indirizzo di consegna",
      rm: "Indrizz da consegna",
      es: "Dirección de envío",
    },
  },
  {
    key: "shop.order.contact",
    area: "shop",
    de: "Kontakt",
    texts: { fr: "Contact", it: "Contatto", rm: "Contact", es: "Contacto" },
  },
  {
    key: "shop.order.placedAt",
    area: "shop",
    de: "Bestellt am {datetime}",
    texts: {
      fr: "Commandée le {datetime}",
      it: "Ordinato il {datetime}",
      rm: "Ordinà ils {datetime}",
      es: "Pedido el {datetime}",
    },
  },
  {
    key: "shop.order.cancelled.title",
    area: "shop",
    de: "Bestellung storniert",
    texts: {
      fr: "Commande annulée",
      it: "Ordine annullato",
      rm: "Ordin annullà",
      es: "Pedido cancelado",
    },
  },
  {
    key: "shop.order.cancelled.at",
    area: "shop",
    de: "am {datetime}",
    texts: { fr: "le {datetime}", it: "il {datetime}", rm: "ils {datetime}", es: "el {datetime}" },
  },
  {
    key: "shop.order.chain.aria",
    area: "shop",
    de: "Bestellstatus",
    texts: {
      fr: "Statut de la commande",
      it: "Stato dell'ordine",
      rm: "Status da l'ordin",
      es: "Estado del pedido",
    },
  },
  {
    key: "shop.order.access.title",
    area: "shop",
    de: "Bestellung bestätigen",
    texts: {
      fr: "Confirmer la commande",
      it: "Conferma l'ordine",
      rm: "Confirmar l'ordin",
      es: "Confirmar el pedido",
    },
  },
  {
    key: "shop.order.access.text",
    area: "shop",
    de: "Aus Datenschutzgründen zeigen wir die Details zu {number} nur der Käuferin oder dem Käufer. Bitte geben Sie die E-Mail-Adresse ein, mit der Sie bestellt haben.",
    texts: {
      fr: "Pour des raisons de confidentialité, nous n'affichons les détails de {number} qu'à l'acheteuse ou à l'acheteur. Veuillez saisir l'adresse e-mail utilisée pour votre commande.",
      it: "Per motivi di privacy mostriamo i dettagli di {number} solo all'acquirente. Inserisca l'indirizzo e-mail con cui ha effettuato l'ordine.",
      rm: "Per motivs da datas persunalas mussain nus ils detagls da {number} mo a la cumpradra u al cumprader. Per plaschair endateschai l'adressa d'e-mail cun la quala avais ordinà.",
      es: "Por motivos de privacidad, solo mostramos los detalles de {number} a la compradora o al comprador. Introduzca la dirección de correo electrónico con la que realizó el pedido.",
    },
  },
  {
    key: "shop.order.access.email",
    area: "shop",
    de: "E-Mail-Adresse",
    texts: {
      fr: "Adresse e-mail",
      it: "Indirizzo e-mail",
      rm: "Adressa d'e-mail",
      es: "Dirección de correo electrónico",
    },
  },
  {
    key: "shop.order.access.submit",
    area: "shop",
    de: "Bestellung anzeigen",
    texts: {
      fr: "Afficher la commande",
      it: "Mostra l'ordine",
      rm: "Mussistrar l'ordin",
      es: "Ver el pedido",
    },
  },
  // Home page (#58 step 3 slice): hero, category tiles, collection blurbs and the
  // featured rail — every one seeded in all five languages; the German bases are
  // byte-identical to the literals they replaced. The blurb keys derive from the
  // collection rows themselves (`shop.home.blurb.<collection>`), so a new collection
  // is data with the usual visible-missing fallback.
  {
    key: "shop.home.heroBadge",
    area: "shop",
    de: "Neuheiten jede Woche",
    texts: {
      fr: "Nouveautés chaque semaine",
      it: "Novità ogni settimana",
      rm: "Novitads mintga emna",
      es: "Novedades cada semana",
    },
  },
  {
    key: "shop.home.heroTitle",
    area: "shop",
    de: "Technik, Style und Komfort — in der Schweiz zuhause.",
    texts: {
      fr: "Technologie, style et confort — chez vous en Suisse.",
      it: "Tecnica, stile e comfort — a casa vostra in Svizzera.",
      rm: "Tecnica, stil e comfort — a chasa en la Svizra.",
      es: "Tecnología, estilo y comodidad: en casa, en Suiza.",
    },
  },
  {
    key: "shop.home.heroLead",
    area: "shop",
    de: "Faire Preise in CHF, inklusive {vat} und schnellem Versand aus der Schweiz.",
    texts: {
      fr: "Prix équitables en CHF, {vat} comprise et expédition rapide depuis la Suisse.",
      it: "Prezzi equi in CHF, {vat} inclusa e spedizione rapida dalla Svizzera.",
      rm: "Pretschs gists en CHF, {vat} inclus e spedition sperta da la Svizra.",
      es: "Precios justos en CHF, {vat} incluido y envío rápido desde Suiza.",
    },
  },
  {
    key: "shop.home.heroDiscover",
    area: "shop",
    de: "Jetzt entdecken",
    texts: {
      fr: "Découvrir maintenant",
      it: "Scopri ora",
      rm: "Uss scuvrir",
      es: "Descubrir ahora",
    },
  },
  {
    key: "shop.home.categories",
    area: "shop",
    de: "Kategorien",
    texts: { fr: "Catégories", it: "Categorie", rm: "Categorias", es: "Categorías" },
  },
  {
    key: "shop.home.categoryBlurb",
    area: "shop",
    de: "Das komplette Sortiment — frisch für Sie ausgewählt.",
    texts: {
      fr: "L'assortiment complet — fraîchement sélectionné pour vous.",
      it: "L'assortimento completo — selezionato di fresco per voi.",
      rm: "Il komplet assortment — nov tschernì per Vus.",
      es: "El surtido completo: recién seleccionado para usted.",
    },
  },
  {
    key: "shop.home.categoryView",
    area: "shop",
    de: "Ansehen",
    texts: { fr: "Voir", it: "Visualizza", rm: "Vesair", es: "Ver" },
  },
  {
    key: "shop.home.featured",
    area: "shop",
    de: "Beliebte Produkte",
    texts: {
      fr: "Produits populaires",
      it: "Prodotti popolari",
      rm: "Products populars",
      es: "Productos populares",
    },
  },
  {
    key: "shop.home.viewAll",
    area: "shop",
    de: "Alle ansehen",
    texts: { fr: "Tout voir", it: "Vedi tutti", rm: "Vesair tut", es: "Ver todo" },
  },
  {
    key: "shop.home.collectionsAria",
    area: "shop",
    de: "Kuratierte Kollektionen",
    texts: {
      fr: "Collections sélectionnées",
      it: "Collezioni selezionate",
      rm: "Collecziuns tschernidas",
      es: "Colecciones seleccionadas",
    },
  },
  {
    key: "shop.home.blurb.Neuheiten",
    area: "shop",
    de: "Frisch eingetroffen — die neuesten Zugänge im Sortiment.",
    texts: {
      fr: "Tout juste arrivés — les dernières nouveautés de l'assortiment.",
      it: "Appena arrivati — le ultime novità dell'assortimento.",
      rm: "Nov arrivads — las ultimas novitads da l'assortiment.",
      es: "Recién llegados: las últimas novedades del surtido.",
    },
  },
  {
    key: "shop.home.blurb.Bestseller",
    area: "shop",
    de: "Das kaufen unsere Kundinnen und Kunden am häufigsten.",
    texts: {
      fr: "Ce que nos clients achètent le plus souvent.",
      it: "Quello che i nostri clienti comprano più spesso.",
      rm: "Quai che noss clients cumpran il pli savens.",
      es: "Lo que nuestros clientes compran con más frecuencia.",
    },
  },
  {
    key: "shop.home.blurb.Sale",
    area: "shop",
    de: "Reduzierte Angebote, solange der Vorrat reicht.",
    texts: {
      fr: "Offres réduites, dans la limite des stocks disponibles.",
      it: "Offerte scontate, fino a esaurimento scorte.",
      rm: "Offras reducidas, fin a la fin da il stock.",
      es: "Ofertas rebajadas, hasta agotar existencias.",
    },
  },
  // Account and auth area (#58 step 3 slice): the four auth pages, the portal pages and
  // their forms, the password-rule checklist — every one seeded in all five languages;
  // the German bases are byte-identical to the literals they replaced.
  {
    key: "shop.meta.login.title",
    area: "shop",
    de: "Anmelden",
    texts: { fr: "Se connecter", it: "Accedi", rm: "S'annunziar", es: "Iniciar sesión" },
  },
  {
    key: "shop.meta.login.description",
    area: "shop",
    de: "Mit Ihrem Kundenkonto anmelden — coder-shop.",
    texts: {
      fr: "Connectez-vous à votre compte client — coder-shop.",
      it: "Accedete al vostro account cliente — coder-shop.",
      rm: "Annunziai cun Voss conto da client — coder-shop.",
      es: "Inicie sesión en su cuenta de cliente — coder-shop.",
    },
  },
  {
    key: "shop.meta.register.title",
    area: "shop",
    de: "Registrieren",
    texts: { fr: "S'inscrire", it: "Registrati", rm: "Registreschiar", es: "Registrarse" },
  },
  {
    key: "shop.meta.register.description",
    area: "shop",
    de: "Kundenkonto erstellen — coder-shop.",
    texts: {
      fr: "Créer un compte client — coder-shop.",
      it: "Crea un account cliente — coder-shop.",
      rm: "Conto da client crear — coder-shop.",
      es: "Crea una cuenta de cliente — coder-shop.",
    },
  },
  {
    key: "shop.meta.forgot.title",
    area: "shop",
    de: "Passwort vergessen",
    texts: {
      fr: "Mot de passe oublié",
      it: "Password dimenticata",
      rm: "Peraula-clav emblidada",
      es: "He olvidado la contraseña",
    },
  },
  {
    key: "shop.meta.forgot.description",
    area: "shop",
    de: "Link zum Passwort-Zurücksetzen anfordern — coder-shop.",
    texts: {
      fr: "Demander un lien de réinitialisation du mot de passe — coder-shop.",
      it: "Richiedi un link per reimpostare la password — coder-shop.",
      rm: "Domandar in link per resetter la peraula-clav — coder-shop.",
      es: "Solicite un enlace para restablecer la contraseña — coder-shop.",
    },
  },
  {
    key: "shop.meta.reset.title",
    area: "shop",
    de: "Passwort zurücksetzen",
    texts: {
      fr: "Réinitialiser le mot de passe",
      it: "Reimposta la password",
      rm: "Resetter la peraula-clav",
      es: "Restablecer la contraseña",
    },
  },
  {
    key: "shop.meta.reset.description",
    area: "shop",
    de: "Neues Passwort setzen — coder-shop.",
    texts: {
      fr: "Définir un nouveau mot de passe — coder-shop.",
      it: "Imposta una nuova password — coder-shop.",
      rm: "Nov peraula-clav definir — coder-shop.",
      es: "Establezca una nueva contraseña — coder-shop.",
    },
  },
  {
    key: "shop.auth.forgotHint",
    area: "shop",
    de: "Wir senden Ihnen einen Link zum Zurücksetzen — gültig für eine Stunde.",
    texts: {
      fr: "Nous vous envoyons un lien de réinitialisation — valable une heure.",
      it: "Le invieremo un link per il reset — valido per un'ora.",
      rm: "No tramessain in link per resettar — valibel in'ura.",
      es: "Le enviaremos un enlace para restablecerla — válido durante una hora.",
    },
  },
  {
    key: "shop.auth.resetInvalid",
    area: "shop",
    de: "Dieser Link ist ungültig. Bitte fordern Sie über „Passwort vergessen“ einen neuen an.",
    texts: {
      fr: "Ce lien est invalide. Veuillez en demander un nouveau via « Mot de passe oublié ».",
      it: "Questo link non è valido. Richieda un nuovo link tramite «Password dimenticata».",
      rm: "Quest link è nunvalaivel. Domandai per plaschair in nov via „Peraula-clav emblidada“.",
      es: "Este enlace no es válido. Solicite uno nuevo mediante «He olvidado la contraseña».",
    },
  },
  {
    key: "shop.auth.forgotLink",
    area: "shop",
    de: "Vergessen?",
    texts: { fr: "Oublié ?", it: "Dimenticata?", rm: "Emblidà?", es: "¿Olvidada?" },
  },
  {
    key: "shop.auth.noAccount",
    area: "shop",
    de: "Noch kein Konto?",
    texts: {
      fr: "Pas encore de compte ?",
      it: "Non avete ancora un account?",
      rm: "Ancura nagin conto?",
      es: "¿Aún no tiene cuenta?",
    },
  },
  {
    key: "shop.auth.registerLink",
    area: "shop",
    de: "Registrieren",
    texts: { fr: "S'inscrire", it: "Registrati", rm: "Registreschiar", es: "Registrarse" },
  },
  {
    key: "shop.auth.hasAccount",
    area: "shop",
    de: "Bereits ein Konto?",
    texts: {
      fr: "Vous avez déjà un compte ?",
      it: "Avete già un account?",
      rm: "Gia in conto?",
      es: "¿Ya tiene una cuenta?",
    },
  },
  {
    key: "shop.auth.field.password",
    area: "shop",
    de: "Passwort",
    texts: { fr: "Mot de passe", it: "Password", rm: "Peraula-clav", es: "Contraseña" },
  },
  {
    key: "shop.auth.newPassword",
    area: "shop",
    de: "Neues Passwort",
    texts: {
      fr: "Nouveau mot de passe",
      it: "Nuova password",
      rm: "Nov peraula-clav",
      es: "Nueva contraseña",
    },
  },
  {
    key: "shop.auth.requestLink",
    area: "shop",
    de: "Link anfordern",
    texts: {
      fr: "Demander un lien",
      it: "Richiedi il link",
      rm: "Domandar il link",
      es: "Solicitar enlace",
    },
  },
  {
    key: "shop.auth.setPassword",
    area: "shop",
    de: "Passwort setzen",
    texts: {
      fr: "Définir le mot de passe",
      it: "Imposta la password",
      rm: "Peraula-clav definir",
      es: "Establecer contraseña",
    },
  },
  {
    key: "shop.auth.consent",
    area: "shop",
    de: "Ich akzeptiere die AGB und die Datenschutzerklärung (Demo).",
    texts: {
      fr: "J'accepte les CGV et la politique de confidentialité (démo).",
      it: "Accetto le CGC e l'informativa sulla privacy (demo).",
      rm: "Acceptescher las CGC e la decleraziun da protecziun da datas (demo).",
      es: "Acepto las condiciones generales y la política de privacidad (demo).",
    },
  },
  // Password rules (#58 step 3): the checklist texts of the one rule source — the lib
  // keeps key and test, the wording is a row; {min} is MIN_PASSWORD_LENGTH.
  {
    key: "shop.password.rule.longEnough",
    area: "shop",
    de: "mindestens {min} Zeichen",
    texts: {
      fr: "au moins {min} caractères",
      it: "almeno {min} caratteri",
      rm: "almain {min} caracters",
      es: "al menos {min} caracteres",
    },
  },
  {
    key: "shop.password.rule.hasLetter",
    area: "shop",
    de: "ein Buchstabe",
    texts: { fr: "une lettre", it: "una lettera", rm: "in bustab", es: "una letra" },
  },
  {
    key: "shop.password.rule.hasDigit",
    area: "shop",
    de: "eine Zahl",
    texts: { fr: "un chiffre", it: "un numero", rm: "ina cifra", es: "un número" },
  },
  {
    key: "shop.password.met",
    area: "shop",
    de: ", erfüllt",
    texts: { fr: ", rempli", it: ", soddisfatto", rm: ", sodisfà", es: ", cumplida" },
  },
  {
    key: "shop.password.unmet",
    area: "shop",
    de: ", noch nicht erfüllt",
    texts: {
      fr: ", pas encore rempli",
      it: ", non ancora soddisfatto",
      rm: ", anc betg sodisfà",
      es: ", aún no cumplida",
    },
  },
  {
    key: "shop.password.allMet",
    area: "shop",
    de: "Alle Passwort-Anforderungen sind erfüllt.",
    texts: {
      fr: "Toutes les exigences du mot de passe sont remplies.",
      it: "Tutti i requisiti della password sono soddisfatti.",
      rm: "Tut las pretensiuns da la peraula-clav èn sodisfatas.",
      es: "Se cumplen todos los requisitos de la contraseña.",
    },
  },
  {
    key: "shop.password.notAllMet",
    area: "shop",
    de: "Die Passwort-Anforderungen sind noch nicht alle erfüllt.",
    texts: {
      fr: "Les exigences du mot de passe ne sont pas encore toutes remplies.",
      it: "I requisiti della password non sono ancora tutti soddisfatti.",
      rm: "Las pretensiuns da la peraula-clav n'èn anc betg tut sodisfatas.",
      es: "Aún no se cumplen todos los requisitos de la contraseña.",
    },
  },
  {
    key: "shop.account.nav.aria",
    area: "shop",
    de: "Konto-Navigation",
    texts: {
      fr: "Navigation du compte",
      it: "Navigazione dell'account",
      rm: "Navigaziun dal conto",
      es: "Navegación de la cuenta",
    },
  },
  {
    key: "shop.account.nav.overview",
    area: "shop",
    de: "Übersicht",
    texts: {
      fr: "Vue d'ensemble",
      it: "Panoramica",
      rm: "Survesta",
      es: "Resumen",
    },
  },
  {
    key: "shop.account.nav.orders",
    area: "shop",
    de: "Bestellungen",
    texts: { fr: "Commandes", it: "Ordini", rm: "Ordens", es: "Pedidos" },
  },
  {
    key: "shop.account.nav.invoices",
    area: "shop",
    de: "Rechnungen",
    texts: { fr: "Factures", it: "Fatture", rm: "Quitas", es: "Facturas" },
  },
  {
    key: "shop.account.nav.wishlist",
    area: "shop",
    de: "Wunschliste",
    texts: {
      fr: "Liste de souhaits",
      it: "Lista dei desideri",
      rm: "Glista da desideris",
      es: "Lista de deseos",
    },
  },
  {
    key: "shop.account.nav.addresses",
    area: "shop",
    de: "Adressen",
    texts: { fr: "Adresses", it: "Indirizzi", rm: "Indirizzas", es: "Direcciones" },
  },
  {
    key: "shop.account.nav.profile",
    area: "shop",
    de: "Profil",
    texts: { fr: "Profil", it: "Profilo", rm: "Profil", es: "Perfil" },
  },
  {
    key: "shop.action.logout",
    area: "shop",
    de: "Abmelden",
    texts: {
      fr: "Se déconnecter",
      it: "Esci",
      rm: "Sortir",
      es: "Cerrar sesión",
    },
  },
  {
    key: "shop.account.signedInAs",
    area: "shop",
    de: "Angemeldet als",
    texts: {
      fr: "Connecté en tant que",
      it: "Connesso come",
      rm: "Annunzià sco",
      es: "Sesión iniciada como",
    },
  },
  {
    key: "shop.account.noOrders",
    area: "shop",
    de: "Sie haben noch keine Bestellungen in Ihrem Konto.",
    texts: {
      fr: "Vous n'avez encore aucune commande dans votre compte.",
      it: "Non avete ancora ordini nel vostro account.",
      rm: "Vus n'avais anc naginas ordens en Voss conto.",
      es: "Aún no tiene pedidos en su cuenta.",
    },
  },
  {
    key: "shop.account.orderCount.one",
    area: "shop",
    de: "{count} Bestellung in Ihrem Konto.",
    texts: {
      fr: "{count} commande dans votre compte.",
      it: "{count} ordine nel vostro account.",
      rm: "{count} ordin en Voss conto.",
      es: "{count} pedido en su cuenta.",
    },
  },
  {
    key: "shop.account.orderCount.other",
    area: "shop",
    de: "{count} Bestellungen in Ihrem Konto.",
    texts: {
      fr: "{count} commandes dans votre compte.",
      it: "{count} ordini nel vostro account.",
      rm: "{count} ordens en Voss conto.",
      es: "{count} pedidos en su cuenta.",
    },
  },
  {
    key: "shop.account.section.orders.text",
    area: "shop",
    de: "Bestellhistorie mit Status, Sendungsverfolgung und „Erneut bestellen“.",
    texts: {
      fr: "Historique des commandes avec statut, suivi d'envoi et « Commander à nouveau ».",
      it: "Cronologia ordini con stato, tracciamento e «Riordina».",
      rm: "Istorgia dals ordens cun status, tracing e „Puspè ordinar“.",
      es: "Historial de pedidos con estado, seguimiento del envío y «Volver a comprar».",
    },
  },
  {
    key: "shop.account.section.addresses.text",
    area: "shop",
    de: "Liefer- und Rechnungsadressen verwalten.",
    texts: {
      fr: "Gérez vos adresses de livraison et de facturation.",
      it: "Gestite i vostri indirizzi di consegna e di fatturazione.",
      rm: "Administrai Voss indirizzs da furniment e da factura.",
      es: "Gestione sus direcciones de envío y de facturación.",
    },
  },
  {
    key: "shop.account.section.profile.text",
    area: "shop",
    de: "Name, E-Mail und Passwort ändern.",
    texts: {
      fr: "Modifiez nom, e-mail et mot de passe.",
      it: "Modificate nome, e-mail e password.",
      rm: "Midai num, e-mail e peraula-clav.",
      es: "Cambie nombre, correo electrónico y contraseña.",
    },
  },
  {
    key: "shop.meta.account.title",
    area: "shop",
    de: "Mein Konto",
    texts: {
      fr: "Mon compte",
      it: "Il mio account",
      rm: "Mes contos",
      es: "Mi cuenta",
    },
  },
  {
    key: "shop.meta.account.description",
    area: "shop",
    de: "Bestellungen, Adressen und Profil — coder-shop.",
    texts: {
      fr: "Commandes, adresses et profil — coder-shop.",
      it: "Ordini, indirizzi e profilo — coder-shop.",
      rm: "Ordens, indirizzas e profil — coder-shop.",
      es: "Pedidos, direcciones y perfil — coder-shop.",
    },
  },
  {
    key: "shop.meta.accountOrders.title",
    area: "shop",
    de: "Meine Bestellungen",
    texts: {
      fr: "Mes commandes",
      it: "I miei ordini",
      rm: "Mes ordens",
      es: "Mis pedidos",
    },
  },
  {
    key: "shop.meta.accountOrders.description",
    area: "shop",
    de: "Bestellhistorie — coder-shop.",
    texts: {
      fr: "Historique des commandes — coder-shop.",
      it: "Cronologia ordini — coder-shop.",
      rm: "Istorgia dals ordens — coder-shop.",
      es: "Historial de pedidos — coder-shop.",
    },
  },
  {
    key: "shop.account.orders.title",
    area: "shop",
    de: "Bestellhistorie",
    texts: {
      fr: "Historique des commandes",
      it: "Cronologia ordini",
      rm: "Istorgia dals ordens",
      es: "Historial de pedidos",
    },
  },
  {
    key: "shop.account.orders.searchAria",
    area: "shop",
    de: "Bestellungen durchsuchen",
    texts: {
      fr: "Rechercher dans les commandes",
      it: "Cerca negli ordini",
      rm: "Tschertgar en ils ordens",
      es: "Buscar en los pedidos",
    },
  },
  {
    key: "shop.account.orders.searchPlaceholder",
    area: "shop",
    de: "Bestellnummer oder Artikel suchen",
    texts: {
      fr: "Rechercher un numéro de commande ou un article",
      it: "Cerca un numero d'ordine o un articolo",
      rm: "Tschertgar in numer d'ordin u in artitgel",
      es: "Buscar número de pedido o artículo",
    },
  },
  {
    key: "shop.action.search",
    area: "shop",
    de: "Suchen",
    texts: { fr: "Rechercher", it: "Cerca", rm: "Tschertgar", es: "Buscar" },
  },
  {
    key: "shop.account.orders.noMatch",
    area: "shop",
    de: "Keine Bestellung passt zu „{q}“.",
    texts: {
      fr: "Aucune commande ne correspond à « {q} ».",
      it: "Nessun ordine corrisponde a «{q}».",
      rm: "Nagin order correspunda a „{q}“.",
      es: "Ningún pedido coincide con «{q}».",
    },
  },
  {
    key: "shop.account.orders.none",
    area: "shop",
    de: "Noch keine Bestellungen",
    texts: {
      fr: "Aucune commande pour l'instant",
      it: "Ancora nessun ordine",
      rm: "Ancura nagins ordens",
      es: "Aún no hay pedidos",
    },
  },
  {
    key: "shop.account.orders.adjustQuery",
    area: "shop",
    de: "Bitte Suchbegriff anpassen.",
    texts: {
      fr: "Veuillez adapter votre recherche.",
      it: "Modificate il termine di ricerca.",
      rm: "Adattai per plaschair il term da tschertga.",
      es: "Ajuste el término de búsqueda.",
    },
  },
  {
    key: "shop.account.orders.emptyHint",
    area: "shop",
    de: "Sobald Sie etwas bestellen, erscheint es hier.",
    texts: {
      fr: "Dès que vous commanderez quelque chose, il apparaîtra ici.",
      it: "Non appena effettuerete un ordine, apparirà qui.",
      rm: "Cur Vus avais ordinà insatge, cumpara qua.",
      es: "En cuanto haga un pedido, aparecerá aquí.",
    },
  },
  {
    key: "shop.account.orders.shopNow",
    area: "shop",
    de: "Jetzt einkaufen",
    texts: {
      fr: "Acheter maintenant",
      it: "Acquista ora",
      rm: "Uss comprar",
      es: "Comprar ahora",
    },
  },
  {
    key: "shop.account.orders.items.one",
    area: "shop",
    de: "{count} Artikel",
    texts: {
      fr: "{count} article",
      it: "{count} articolo",
      rm: "{count} artitgel",
      es: "{count} artículo",
    },
  },
  {
    key: "shop.account.orders.items.other",
    area: "shop",
    de: "{count} Artikel",
    texts: {
      fr: "{count} articles",
      it: "{count} articoli",
      rm: "{count} artitgels",
      es: "{count} artículos",
    },
  },
  {
    key: "shop.account.orders.shipment",
    area: "shop",
    de: "Sendung {tracking}",
    texts: {
      fr: "Envoi {tracking}",
      it: "Spedizione {tracking}",
      rm: "Spedi {tracking}",
      es: "Envío {tracking}",
    },
  },
  {
    key: "shop.account.orders.pickup",
    area: "shop",
    de: "Abholung, Code {code}",
    texts: {
      fr: "Retrait, code {code}",
      it: "Ritiro, codice {code}",
      rm: "Retratga, code {code}",
      es: "Recogida, código {code}",
    },
  },
  {
    key: "shop.meta.invoices.description",
    area: "shop",
    de: "Offene und bezahlte Rechnungen Ihres Kontos — coder-shop.",
    texts: {
      fr: "Factures ouvertes et payées de votre compte — coder-shop.",
      it: "Fatture aperte e pagate del vostro account — coder-shop.",
      rm: "Quitas avertas e pajadas da Voss conto — coder-shop.",
      es: "Facturas pendientes y pagadas de su cuenta — coder-shop.",
    },
  },
  {
    key: "shop.account.invoices.none",
    area: "shop",
    de: "Keine Rechnungen",
    texts: { fr: "Aucune facture", it: "Nessuna fattura", rm: "Naginas quitas", es: "Sin facturas" },
  },
  {
    key: "shop.account.invoices.emptyHint",
    area: "shop",
    de: "Rechnungen erscheinen hier, sobald Sie per Rechnung bestellen.",
    texts: {
      fr: "Les factures apparaîtront ici dès que vous commanderez sur facture.",
      it: "Le fatture appariranno qui non appena ordinerete con fattura.",
      rm: "Las quitas cumparan qua, cur Vus ordinais cun factura.",
      es: "Las facturas aparecerán aquí en cuanto pida por factura.",
    },
  },
  {
    key: "shop.account.invoices.paidLine",
    area: "shop",
    de: "Bezahlt · Total {total}",
    texts: {
      fr: "Payé · Total {total}",
      it: "Pagata · Totale {total}",
      rm: "Pajà · Total {total}",
      es: "Pagada · Total {total}",
    },
  },
  {
    key: "shop.account.invoices.openLine",
    area: "shop",
    de: "Offen {open} · zahlbar bis {due}",
    texts: {
      fr: "Reste {open} · payable jusqu'au {due}",
      it: "Aperta {open} · pagabile entro {due}",
      rm: "Avert {open} · pajabel fin {due}",
      es: "Pendiente {open} · pagable hasta {due}",
    },
  },
  {
    key: "shop.state.paid",
    area: "shop",
    de: "Bezahlt",
    texts: { fr: "Payé", it: "Pagata", rm: "Pajà", es: "Pagada" },
  },
  {
    key: "shop.state.overdue",
    area: "shop",
    de: "Überfällig",
    texts: { fr: "En retard", it: "Scaduta", rm: "En retard", es: "Vencida" },
  },
  {
    key: "shop.state.open",
    area: "shop",
    de: "Offen",
    texts: { fr: "Ouverte", it: "Aperta", rm: "Avert", es: "Pendiente" },
  },
  {
    key: "shop.meta.wishlist.description",
    area: "shop",
    de: "Gemerkte Produkte — coder-shop.",
    texts: {
      fr: "Produits enregistrés — coder-shop.",
      it: "Prodotti salvati — coder-shop.",
      rm: "Products memorisads — coder-shop.",
      es: "Productos guardados — coder-shop.",
    },
  },
  {
    key: "shop.account.wishlist.empty",
    area: "shop",
    de: "Noch keine gemerkten Produkte. Über das Herz auf einem Produkt merken Sie es sich hier.",
    texts: {
      fr: "Aucun produit enregistré. Utilisez le cœur sur un produit pour le retrouver ici.",
      it: "Ancora nessun prodotto salvato. Usate il cuore su un prodotto per salvarlo qui.",
      rm: "Ancura nagins products memorisads. Cun il cor sin in product memorisais el qua.",
      es: "Aún no hay productos guardados. Use el corazón de un producto para guardarlo aquí.",
    },
  },
  {
    key: "shop.account.wishlist.discover",
    area: "shop",
    de: "Produkte entdecken",
    texts: {
      fr: "Découvrir les produits",
      it: "Scopri i prodotti",
      rm: "Scuvrir ils products",
      es: "Descubrir productos",
    },
  },
  {
    key: "shop.action.remove",
    area: "shop",
    de: "Entfernen",
    texts: { fr: "Retirer", it: "Rimuovi", rm: "Eliminar", es: "Quitar" },
  },
  {
    key: "shop.account.wishlist.removeError",
    area: "shop",
    de: "Das Entfernen hat nicht funktioniert. Bitte erneut versuchen.",
    texts: {
      fr: "Le retrait a échoué. Veuillez réessayer.",
      it: "La rimozione non è riuscita. Riprovate.",
      rm: "L'eliminaziun n'ha betg funcziunà. Empruvai anc ina giada.",
      es: "No se pudo quitar. Inténtelo de nuevo.",
    },
  },
  {
    key: "shop.meta.addresses.title",
    area: "shop",
    de: "Meine Adressen",
    texts: { fr: "Mes adresses", it: "I miei indirizzi", rm: "Mes indirizzas", es: "Mis direcciones" },
  },
  {
    key: "shop.meta.addresses.description",
    area: "shop",
    de: "Liefer- und Rechnungsadressen — coder-shop.",
    texts: {
      fr: "Adresses de livraison et de facturation — coder-shop.",
      it: "Indirizzi di consegna e di fatturazione — coder-shop.",
      rm: "Indirizzs da furniment e da factura — coder-shop.",
      es: "Direcciones de envío y de facturación — coder-shop.",
    },
  },
  {
    key: "shop.account.addresses.title",
    area: "shop",
    de: "Adressbuch",
    texts: {
      fr: "Carnet d'adresses",
      it: "Rubrica indirizzi",
      rm: "Cudesch d'adressas",
      es: "Libreta de direcciones",
    },
  },
  {
    key: "shop.account.address.field.label",
    area: "shop",
    de: "Bezeichnung",
    texts: { fr: "Intitulé", it: "Denominazione", rm: "Denominaziun", es: "Denominación" },
  },
  {
    key: "shop.account.address.field.kind",
    area: "shop",
    de: "Art",
    texts: { fr: "Type", it: "Tipo", rm: "Tip", es: "Tipo" },
  },
  {
    key: "shop.account.address.kind.shipping",
    area: "shop",
    de: "Lieferadresse",
    texts: {
      fr: "Adresse de livraison",
      it: "Indirizzo di consegna",
      rm: "Indirizz da furniment",
      es: "Dirección de envío",
    },
  },
  {
    key: "shop.account.address.kind.billing",
    area: "shop",
    de: "Rechnungsadresse",
    texts: {
      fr: "Adresse de facturation",
      it: "Indirizzo di fatturazione",
      rm: "Indirizz da factura",
      es: "Dirección de facturación",
    },
  },
  {
    key: "shop.account.address.setDefault",
    area: "shop",
    de: "Als Standard setzen",
    texts: {
      fr: "Définir par défaut",
      it: "Imposta come predefinito",
      rm: "Definir standard",
      es: "Establecer como predeterminada",
    },
  },
  {
    key: "shop.action.save",
    area: "shop",
    de: "Speichern",
    texts: { fr: "Enregistrer", it: "Salva", rm: "Memorisar", es: "Guardar" },
  },
  {
    key: "shop.action.cancel",
    area: "shop",
    de: "Abbrechen",
    texts: { fr: "Annuler", it: "Annulla", rm: "Interrumper", es: "Cancelar" },
  },
  {
    key: "shop.account.address.new",
    area: "shop",
    de: "Neue Adresse",
    texts: {
      fr: "Nouvelle adresse",
      it: "Nuovo indirizzo",
      rm: "Nova adressa",
      es: "Nueva dirección",
    },
  },
  {
    key: "shop.account.address.edit",
    area: "shop",
    de: "Adresse bearbeiten",
    texts: {
      fr: "Modifier l'adresse",
      it: "Modifica indirizzo",
      rm: "Midar l'adressa",
      es: "Editar dirección",
    },
  },
  {
    key: "shop.account.address.empty",
    area: "shop",
    de: "Noch keine Adressen gespeichert. In der Kasse können Sie eine Adresse auswählen.",
    texts: {
      fr: "Aucune adresse enregistrée. À la caisse, vous pourrez en sélectionner une.",
      it: "Nessun indirizzo salvato. Alla cassa potrete selezionarne uno.",
      rm: "Ancura naginas adressas memorisadas. A la cassa pos Vus tscherner ina.",
      es: "Aún no hay direcciones guardadas. En la caja podrá seleccionar una.",
    },
  },
  {
    key: "shop.account.address.default",
    area: "shop",
    de: "Standard",
    texts: { fr: "Par défaut", it: "Predefinito", rm: "Standard", es: "Predeterminada" },
  },
  {
    key: "shop.account.address.editAria",
    area: "shop",
    de: "Adresse „{label}“ bearbeiten",
    texts: {
      fr: "Modifier l'adresse « {label} »",
      it: "Modifica l'indirizzo «{label}»",
      rm: "Midar l'adressa „{label}“",
      es: "Editar la dirección «{label}»",
    },
  },
  {
    key: "shop.account.address.deleteAria",
    area: "shop",
    de: "Adresse „{label}“ löschen",
    texts: {
      fr: "Supprimer l'adresse « {label} »",
      it: "Elimina l'indirizzo «{label}»",
      rm: "Stizzar l'adressa „{label}“",
      es: "Eliminar la dirección «{label}»",
    },
  },
  {
    key: "shop.account.address.saved",
    area: "shop",
    de: "Adresse gespeichert.",
    texts: {
      fr: "Adresse enregistrée.",
      it: "Indirizzo salvato.",
      rm: "Adressa memorisada.",
      es: "Dirección guardada.",
    },
  },
  {
    key: "shop.meta.profile.title",
    area: "shop",
    de: "Mein Profil",
    texts: { fr: "Mon profil", it: "Il mio profilo", rm: "Mes profil", es: "Mi perfil" },
  },
  {
    key: "shop.meta.profile.description",
    area: "shop",
    de: "Kontodaten und Passwort — coder-shop.",
    texts: {
      fr: "Données du compte et mot de passe — coder-shop.",
      it: "Dati dell'account e password — coder-shop.",
      rm: "Datas dal conto e peraula-clav — coder-shop.",
      es: "Datos de la cuenta y contraseña — coder-shop.",
    },
  },
  {
    key: "shop.account.profile.accountData",
    area: "shop",
    de: "Kontodaten",
    texts: {
      fr: "Données du compte",
      it: "Dati dell'account",
      rm: "Datas dal conto",
      es: "Datos de la cuenta",
    },
  },
  {
    key: "shop.account.profile.name",
    area: "shop",
    de: "Name",
    texts: { fr: "Nom", it: "Nome", rm: "Num", es: "Nombre" },
  },
  {
    key: "shop.account.profile.emailNote",
    area: "shop",
    de: "Die E-Mail-Adresse ist der Schlüssel zu Ihren Bestellungen — eine Änderung ist in dieser Demo nicht vorgesehen.",
    texts: {
      fr: "L'adresse e-mail est la clé de vos commandes — sa modification n'est pas prévue dans cette démo.",
      it: "L'indirizzo e-mail è la chiave dei vostri ordini — una modifica non è prevista in questa demo.",
      rm: "L'adressa d'e-mail è la clav per Voss ordens — ina midada n'è betg prevista en questa demo.",
      es: "La dirección de correo electrónico es la clave de sus pedidos: cambiarla no está previsto en esta demo.",
    },
  },
  {
    key: "shop.account.changePassword",
    area: "shop",
    de: "Passwort ändern",
    texts: {
      fr: "Modifier le mot de passe",
      it: "Modifica la password",
      rm: "Midar la peraula-clav",
      es: "Cambiar contraseña",
    },
  },
  {
    key: "shop.account.currentPassword",
    area: "shop",
    de: "Aktuelles Passwort",
    texts: {
      fr: "Mot de passe actuel",
      it: "Password attuale",
      rm: "Peraula-clav actuala",
      es: "Contraseña actual",
    },
  },
  {
    key: "shop.account.claim.add",
    area: "shop",
    de: "Bestellung hinzufügen",
    texts: {
      fr: "Ajouter une commande",
      it: "Aggiungi un ordine",
      rm: "Agiuntar in order",
      es: "Añadir pedido",
    },
  },
  {
    key: "shop.account.claim.orderNumber",
    area: "shop",
    de: "Bestellnummer",
    texts: {
      fr: "Numéro de commande",
      it: "Numero d'ordine",
      rm: "Numer da l'ordin",
      es: "Número de pedido",
    },
  },
  {
    key: "shop.account.claim.email",
    area: "shop",
    de: "E-Mail der Bestellung",
    texts: {
      fr: "E-mail de la commande",
      it: "E-mail dell'ordine",
      rm: "E-mail da l'ordin",
      es: "Correo electrónico del pedido",
    },
  },
  {
    key: "shop.action.add",
    area: "shop",
    de: "Hinzufügen",
    texts: { fr: "Ajouter", it: "Aggiungi", rm: "Agiuntar", es: "Añadir" },
  },
  {
    key: "shop.account.claim.added",
    area: "shop",
    de: "Bestellung hinzugefügt",
    texts: {
      fr: "Commande ajoutée",
      it: "Ordine aggiunto",
      rm: "Order agiuntà",
      es: "Pedido añadido",
    },
  },
  {
    key: "shop.account.reorder.action",
    area: "shop",
    de: "Erneut bestellen",
    texts: {
      fr: "Commander à nouveau",
      it: "Riordina",
      rm: "Puspè ordinar",
      es: "Volver a comprar",
    },
  },
  {
    key: "shop.account.reorder.noneAvailable",
    area: "shop",
    de: "Keiner dieser Artikel ist aktuell verfügbar.",
    texts: {
      fr: "Aucun de ces articles n'est actuellement disponible.",
      it: "Nessuno di questi articoli è attualmente disponibile.",
      rm: "Nagin da quests artitgels è actualmain disponibel.",
      es: "Ninguno de estos artículos está disponible actualmente.",
    },
  },
  {
    key: "shop.account.reorder.added.one",
    area: "shop",
    de: "{count} Artikel im Warenkorb",
    texts: {
      fr: "{count} article dans le panier",
      it: "{count} articolo nel carrello",
      rm: "{count} artitgel en il charret",
      es: "{count} artículo en la cesta",
    },
  },
  {
    key: "shop.account.reorder.added.other",
    area: "shop",
    de: "{count} Artikel im Warenkorb",
    texts: {
      fr: "{count} articles dans le panier",
      it: "{count} articoli nel carrello",
      rm: "{count} artitgels en il charret",
      es: "{count} artículos en la cesta",
    },
  },
  {
    key: "shop.account.reorder.skipped.one",
    area: "shop",
    de: "{count} nicht mehr verfügbar.",
    texts: {
      fr: "{count} non disponible.",
      it: "{count} non più disponibile.",
      rm: "{count} betg pli disponibel.",
      es: "{count} ya no disponible.",
    },
  },
  {
    key: "shop.account.reorder.skipped.other",
    area: "shop",
    de: "{count} nicht mehr verfügbar.",
    texts: {
      fr: "{count} non disponibles.",
      it: "{count} non più disponibili.",
      rm: "{count} betg pli disponibels.",
      es: "{count} ya no disponibles.",
    },
  },
  // Issue #58 step 3 (server-messages slice): customer-facing validation and action
  // messages. Every German base is byte-identical to the literal it replaced, so the
  // German specs keep passing untouched; {min}/{max}/{seconds} values come from code.
  {
    key: "shop.validation.field.name",
    area: "shop",
    de: "Bitte Namen angeben",
    texts: {
      fr: "Veuillez indiquer votre nom",
      it: "Indichi il nome",
      rm: "Inditchez il num",
      es: "Indique su nombre",
    },
  },
  {
    key: "shop.validation.field.email",
    area: "shop",
    de: "Bitte gültige E-Mail angeben",
    texts: {
      fr: "Veuillez indiquer un e-mail valide",
      it: "Indichi un'e-mail valida",
      rm: "Inditchez ina adressa e-mail valida",
      es: "Indique un correo electrónico válido",
    },
  },
  {
    key: "shop.validation.field.phone",
    area: "shop",
    de: "Bitte gültige Telefonnummer angeben",
    texts: {
      fr: "Veuillez indiquer un numéro de téléphone valide",
      it: "Indichi un numero di telefono valido",
      rm: "Inditchez in numer da telefon valid",
      es: "Indique un número de teléfono válido",
    },
  },
  {
    key: "shop.validation.field.street",
    area: "shop",
    de: "Bitte Strasse und Hausnummer angeben",
    texts: {
      fr: "Veuillez indiquer la rue et le numéro",
      it: "Indichi via e numero civico",
      rm: "Inditchez via e numer da chasa",
      es: "Indique la calle y el número",
    },
  },
  {
    key: "shop.validation.field.postalCode",
    area: "shop",
    de: "Bitte 4-stellige PLZ angeben",
    texts: {
      fr: "Indiquez un NPA à 4 chiffres",
      it: "Indichi un CAP a 4 cifre",
      rm: "Inditchez in numer postal a 4 cifras",
      es: "Indique un código postal de 4 dígitos",
    },
  },
  {
    key: "shop.validation.field.city",
    area: "shop",
    de: "Bitte Ort angeben",
    texts: {
      fr: "Veuillez indiquer la localité",
      it: "Indichi la località",
      rm: "Inditchez il lieu",
      es: "Indique la localidad",
    },
  },
  {
    key: "shop.validation.field.cartEmpty",
    area: "shop",
    de: "Der Warenkorb ist leer",
    texts: {
      fr: "Le panier est vide",
      it: "Il carrello è vuoto",
      rm: "Il charret è vid",
      es: "La cesta está vacía",
    },
  },
  {
    key: "shop.validation.field.maxQty",
    area: "shop",
    de: "Maximal {max} Stück pro Artikel.",
    texts: {
      fr: "Maximum {max} pièces par article.",
      it: "Massimo {max} pezzi per articolo.",
      rm: "Maximal {max} stucks per artitgel.",
      es: "Máximo {max} unidades por artículo.",
    },
  },
  {
    key: "shop.validation.field.addressLabel",
    area: "shop",
    de: "Bitte Bezeichnung angeben (z. B. Zuhause)",
    texts: {
      fr: "Veuillez indiquer un libellé (p. ex. Domicile)",
      it: "Indichi una denominazione (p. es. Casa)",
      rm: "Inditchez in num (p. ex. Domicil)",
      es: "Indique una denominación (p. ej. Casa)",
    },
  },
  {
    key: "shop.validation.field.addressId",
    area: "shop",
    de: "Ungültige Adresse.",
    texts: {
      fr: "Adresse non valide.",
      it: "Indirizzo non valido.",
      rm: "Adressa nun valida.",
      es: "Dirección no válida.",
    },
  },
  {
    key: "shop.validation.field.consent",
    area: "shop",
    de: "Bitte akzeptieren Sie die AGB, um fortzufahren.",
    texts: {
      fr: "Veuillez accepter les CGV pour continuer.",
      it: "Accetti le CGC per continuare.",
      rm: "Acceptai las CGC per cuntinuar.",
      es: "Acepte las condiciones para continuar.",
    },
  },
  {
    key: "shop.validation.field.loginEmail",
    area: "shop",
    de: "Bitte eine gültige E-Mail eingeben.",
    texts: {
      fr: "Veuillez saisir un e-mail valide.",
      it: "Inserisca un'e-mail valida.",
      rm: "Endatescha ina adressa e-mail valida.",
      es: "Introduzca un correo electrónico válido.",
    },
  },
  {
    key: "shop.validation.field.loginPassword",
    area: "shop",
    de: "Bitte Passwort eingeben.",
    texts: {
      fr: "Veuillez saisir le mot de passe.",
      it: "Inserisca la password.",
      rm: "Endatescha la password.",
      es: "Introduzca la contraseña.",
    },
  },
  {
    key: "shop.validation.field.reviewBody",
    area: "shop",
    de: "Bitte schreiben Sie ein paar Worte.",
    texts: {
      fr: "Veuillez écrire quelques mots.",
      it: "Scriva qualche parola.",
      rm: "Scriva in pèr pleds.",
      es: "Escriba unas palabras.",
    },
  },
  {
    key: "shop.validation.password",
    area: "shop",
    de: "Das Passwort braucht mindestens {min} Zeichen, einen Buchstaben und eine Zahl.",
    texts: {
      fr: "Le mot de passe doit comporter au moins {min} caractères, une lettre et un chiffre.",
      it: "La password deve contenere almeno {min} caratteri, una lettera e un numero.",
      rm: "La password sto almain {min} caracters, in bustab ed ina cifra.",
      es: "La contraseña debe tener al menos {min} caracteres, una letra y un número.",
    },
  },
  {
    key: "shop.validation.password.length",
    area: "shop",
    de: "Das Passwort braucht mindestens {min} Zeichen.",
    texts: {
      fr: "Le mot de passe doit comporter au moins {min} caractères.",
      it: "La password deve contenere almeno {min} caratteri.",
      rm: "La password sto almain {min} caracters.",
      es: "La contraseña debe tener al menos {min} caracteres.",
    },
  },
  {
    key: "shop.validation.password.letterDigit",
    area: "shop",
    de: "Das Passwort braucht mindestens einen Buchstaben und eine Zahl.",
    texts: {
      fr: "Le mot de passe doit comporter au moins une lettre et un chiffre.",
      it: "La password deve contenere almeno una lettera e un numero.",
      rm: "La password sto almain in bustab ed ina cifra.",
      es: "La contraseña debe tener al menos una letra y un número.",
    },
  },
  {
    key: "shop.action.loginRequired",
    area: "shop",
    de: "Bitte zuerst anmelden.",
    texts: {
      fr: "Veuillez d'abord vous connecter.",
      it: "Si prega prima di accedere.",
      rm: "Emprimamain s'annunzia.",
      es: "Inicie sesión primero.",
    },
  },
  {
    key: "shop.action.invalidForm",
    area: "shop",
    de: "Ungültige Formular-Daten.",
    texts: {
      fr: "Données de formulaire non valides.",
      it: "Dati del modulo non validi.",
      rm: "Datas dal formular nun validas.",
      es: "Datos del formulario no válidos.",
    },
  },
  {
    key: "shop.action.discountInvalid",
    area: "shop",
    de: "Dieser Gutscheincode ist ungültig.",
    texts: {
      fr: "Ce code promo est non valide.",
      it: "Questo codice sconto non è valido.",
      rm: "Quest code da reducziun nun è valid.",
      es: "Este código de descuento no es válido.",
    },
  },
  {
    key: "shop.action.reviewLogin",
    area: "shop",
    de: "Bitte melden Sie sich an, um eine Bewertung zu schreiben.",
    texts: {
      fr: "Veuillez vous connecter pour écrire un avis.",
      it: "Acceda per scrivere una recensione.",
      rm: "S'annunzia per scriver ina evaluaziun.",
      es: "Inicie sesión para escribir una reseña.",
    },
  },
  {
    key: "shop.action.orderAccessEmail",
    area: "shop",
    de: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    texts: {
      fr: "Veuillez saisir une adresse e-mail valide.",
      it: "Inserisca un indirizzo e-mail valido.",
      rm: "Endatescha ina adressa e-mail valida.",
      es: "Introduzca una dirección de correo electrónico válida.",
    },
  },
  {
    key: "shop.discount.expired",
    area: "shop",
    de: "Dieser Gutscheincode ist ungültig oder abgelaufen.",
    texts: {
      fr: "Ce code promo est non valide ou expiré.",
      it: "Questo codice sconto non è valido o scaduto.",
      rm: "Quest code da reducziun nun è valid u scadì.",
      es: "Este código de descuento no es válido o ha caducado.",
    },
  },
  {
    key: "shop.discount.minOrder",
    area: "shop",
    de: "Dieser Code gilt erst ab einem Warenkorb von {amount}.",
    texts: {
      fr: "Ce code s'applique à partir d'un panier de {amount}.",
      it: "Questo codice vale da un carrello di {amount}.",
      rm: "Quest code vala dapi in charret da {amount}.",
      es: "Este código se aplica a partir de una cesta de {amount}.",
    },
  },
  {
    key: "shop.discount.exhausted",
    area: "shop",
    de: "Dieser Code ist bereits aufgebraucht.",
    texts: {
      fr: "Ce code est déjà épuisé.",
      it: "Questo codice è già esaurito.",
      rm: "Quest code è gia stà utilisà fin a la fin.",
      es: "Este código ya se ha agotado.",
    },
  },
  {
    key: "shop.discount.usedAlready",
    area: "shop",
    de: "Sie haben diesen Code bereits verwendet.",
    texts: {
      fr: "Vous avez déjà utilisé ce code.",
      it: "Ha già utilizzato questo codice.",
      rm: "Avais gia utilisà quest code.",
      es: "Ya ha utilizado este código.",
    },
  },
  {
    key: "shop.order.accessMismatch",
    area: "shop",
    de: "Bestellung und E-Mail-Adresse stimmen nicht überein.",
    texts: {
      fr: "La commande et l'adresse e-mail ne correspondent pas.",
      it: "L'ordine e l'indirizzo e-mail non corrispondono.",
      rm: "L'ordin e l'adressa e-mail nauschin.",
      es: "El pedido y la dirección de correo electrónico no coinciden.",
    },
  },
  {
    key: "shop.order.accessThrottled",
    area: "shop",
    de: "Zu viele Fehlversuche. Bitte später erneut versuchen.",
    texts: {
      fr: "Trop de tentatives échouées. Veuillez réessayer plus tard.",
      it: "Troppi tentativi falliti. Riprovi più tardi.",
      rm: "Memia blers empruvaments fallids. Empruvai puspè pli tard.",
      es: "Demasiados intentos fallidos. Inténtelo de nuevo más tarde.",
    },
  },
  {
    key: "shop.action.rateLimited",
    area: "shop",
    de: "Zu viele Bestellungen in kurzer Folge. Bitte in {seconds} Sekunden erneut versuchen.",
    texts: {
      fr: "Trop de commandes à la suite. Veuillez réessayer dans {seconds} secondes.",
      it: "Troppi ordini a breve distanza. Riprovi tra {seconds} secondi.",
      rm: "Memia blers ordins in suandar. Empruvai puspè en {seconds} secundas.",
      es: "Demasiados pedidos seguidos. Inténtelo de nuevo en {seconds} segundos.",
    },
  },
  {
    key: "shop.meta.notFound.title",
    area: "shop",
    de: "Seite nicht gefunden",
    texts: {
      fr: "Page introuvable",
      it: "Pagina non trovata",
      rm: "Pagina betg chattada",
      es: "Página no encontrada",
    },
  },
  {
    key: "shop.meta.notFound.description",
    area: "shop",
    de: "Diese Seite existiert nicht — zurück zum Start.",
    texts: {
      fr: "Cette page n'existe pas — retour au démarrage.",
      it: "Questa pagina non esiste — ritorno all'avvio.",
      rm: "Questa pagina n'existia betg — enavos a la pagina initiala.",
      es: "Esta página no existe — volver al inicio.",
    },
  },
  {
    key: "shop.notFound.body",
    area: "shop",
    de: "Diese Seite existiert nicht oder wurde verschoben. Versuchen Sie die Suche oder stöbern Sie im Sortiment.",
    texts: {
      fr: "Cette page n'existe pas ou a été déplacée. Essayez la recherche ou parcourez l'assortiment.",
      it: "Questa pagina non esiste o è stata spostata. Provate la ricerca o sfogliate l'assortimento.",
      rm: "Questa pagina n'existia betg u è vegnida spustada. Empruvai la tschertga u sfugliais l'assortiment.",
      es: "Esta página no existe o se ha movido. Pruebe la búsqueda o explore el surtido.",
    },
  },
  {
    key: "shop.notFound.home",
    area: "shop",
    de: "Zur Startseite",
    texts: {
      fr: "Retour à l'accueil",
      it: "Torna alla home page",
      rm: "Enavos a la pagina initiala",
      es: "Volver al inicio",
    },
  },
  {
    key: "shop.notFound.listing",
    area: "shop",
    de: "Zum Sortiment",
    texts: {
      fr: "Parcourir l'assortiment",
      it: "Sfoglia l'assortimento",
      rm: "Sfuglia l'assortiment",
      es: "Ver el surtido",
    },
  },
  // Customer-facing core refusals (#58 step 3, core-error slice): the German bases are
  // byte-identical to the literals they replace, so the German specs stay green.
  {
    key: "shop.account.error.emailTaken",
    area: "shop",
    de: "Diese E-Mail-Adresse ist bereits registriert.",
    texts: {
      fr: "Cette adresse e-mail est déjà enregistrée.",
      it: "Questo indirizzo e-mail è già registrato.",
      rm: "Questa adressa d'e-mail è gia registrà.",
      es: "Esta dirección de correo electrónico ya está registrada.",
    },
  },
  {
    key: "shop.account.error.registerThrottled",
    area: "shop",
    de: "Zu viele Registrierungen in kurzer Folge. Bitte in {seconds} Sekunden erneut versuchen.",
    texts: {
      fr: "Trop d'inscriptions à courte intervalle. Veuillez réessayer dans {seconds} secondes.",
      it: "Troppe registrazioni di seguito. Riprovi tra {seconds} secondi.",
      rm: "Memias registrazziuns en curta sequenza. Empruvai puspè en {seconds} secundas.",
      es: "Demasiados registros seguidos. Inténtelo de nuevo en {seconds} segundos.",
    },
  },
  {
    key: "shop.account.error.registerBusy",
    area: "shop",
    de: "Zu viele gleichzeitige Registrierungen. Bitte gleich erneut versuchen.",
    texts: {
      fr: "Trop d'inscriptions simultanées. Veuillez réessayer tout de suite.",
      it: "Troppe registrazioni contemporanee. Riprovi a breve.",
      rm: "Memias registrazziuns simultaneous. Empruvai puspè suenter in mument.",
      es: "Demasiados registros simultáneos. Inténtelo de nuevo en un momento.",
    },
  },
  {
    key: "shop.account.error.resetThrottled",
    area: "shop",
    de: "Zu viele Anfragen. Bitte in {seconds} Sekunden erneut versuchen.",
    texts: {
      fr: "Trop de demandes. Veuillez réessayer dans {seconds} secondes.",
      it: "Troppe richieste. Riprovi tra {seconds} secondi.",
      rm: "Memias dumondas. Empruvai puspè en {seconds} secundas.",
      es: "Demasiadas solicitudes. Inténtelo de nuevo en {seconds} segundos.",
    },
  },
  {
    key: "shop.account.error.resetSent",
    area: "shop",
    de: "Falls die Adresse registriert ist, senden wir ihr einen Link zum Passwort-Zurücksetzen.",
    texts: {
      fr: "Si l'adresse est enregistrée, nous lui enverrons un lien pour réinitialiser le mot de passe.",
      it: "Se l'indirizzo è registrato, le invieremo un link per reimpostare la password.",
      rm: "Sche l'adressa è registrà, al tramettain in link per resettar la password.",
      es: "Si la dirección está registrada, le enviaremos un enlace para restablecer la contraseña.",
    },
  },
  {
    key: "shop.account.error.resetLinkInvalid",
    area: "shop",
    de: "Der Link ist ungültig oder abgelaufen.",
    texts: {
      fr: "Le lien est non valide ou expiré.",
      it: "Il link non è valido o è scaduto.",
      rm: "Il link è nun valid u è scadì.",
      es: "El enlace no es válido o ha caducado.",
    },
  },
  {
    key: "shop.account.error.notFound",
    area: "shop",
    de: "Konto nicht gefunden.",
    texts: {
      fr: "Compte introuvable.",
      it: "Account non trovato.",
      rm: "Conto chattà nun.",
      es: "Cuenta no encontrada.",
    },
  },
  {
    key: "shop.account.error.addressNotFound",
    area: "shop",
    de: "Adresse nicht gefunden.",
    texts: {
      fr: "Adresse introuvable.",
      it: "Indirizzo non trovato.",
      rm: "Adressa chattada nun.",
      es: "Dirección no encontrada.",
    },
  },
  {
    key: "shop.account.error.addressLimit",
    area: "shop",
    de: "Maximal {max} Adressen.",
    texts: {
      fr: "Maximum {max} adresses.",
      it: "Massimo {max} indirizzi.",
      rm: "Maximal {max} endirizzas.",
      es: "Máximo {max} direcciones.",
    },
  },
  {
    key: "shop.account.error.orderNotFound",
    area: "shop",
    de: "Bestellung nicht gefunden. Bitte Nummer prüfen.",
    texts: {
      fr: "Commande introuvable. Veuillez vérifier le numéro.",
      it: "Ordine non trovato. Verifichi il numero.",
      rm: "Ordin chattà nun. Per plaschair controllai il numer.",
      es: "Pedido no encontrado. Compruebe el número.",
    },
  },
  {
    key: "shop.account.error.orderClaimed",
    area: "shop",
    de: "Diese Bestellung gehört bereits einem anderen Konto.",
    texts: {
      fr: "Cette commande appartient déjà à un autre compte.",
      it: "Questo ordine appartiene già a un altro account.",
      rm: "Quest ordin tutga gia a in auter conto.",
      es: "Este pedido ya pertenece a otra cuenta.",
    },
  },
  {
    key: "shop.account.error.orderEmailMismatch",
    area: "shop",
    de: "Die E-Mail der Bestellung stimmt nicht mit Ihrem Konto überein.",
    texts: {
      fr: "L'e-mail de la commande ne correspond pas à votre compte.",
      it: "L'e-mail dell'ordine non corrisponde al suo account.",
      rm: "L'e-mail da l'ordin na correspunda betg a Voss conto.",
      es: "El correo electrónico del pedido no coincide con su cuenta.",
    },
  },
  {
    key: "shop.account.claim.success",
    area: "shop",
    de: "Bestellung {number} wurde Ihrem Konto hinzugefügt.",
    texts: {
      fr: "La commande {number} a été ajoutée à votre compte.",
      it: "L'ordine {number} è stato aggiunto al suo account.",
      rm: "L'ordin {number} è vegnì agiuntà a Voss conto.",
      es: "El pedido {number} se ha añadido a su cuenta.",
    },
  },
  {
    key: "shop.account.error.passwordChanged",
    area: "shop",
    de: "Das Passwort wurde geändert. Sie können sich jetzt anmelden.",
    texts: {
      fr: "Le mot de passe a été modifié. Vous pouvez maintenant vous connecter.",
      it: "La password è stata modificata. Ora può accedere.",
      rm: "La password è vegnida midada. Ussa As pudais annunziar.",
      es: "La contraseña se ha modificado. Ya puede iniciar sesión.",
    },
  },
  {
    key: "shop.checkout.error.outOfStock",
    area: "shop",
    de: "Nicht genügend Lager für {sku}. Bitte Menge reduzieren.",
    texts: {
      fr: "Stock insuffisant pour {sku}. Veuillez réduire la quantité.",
      it: "Scorte insufficienti per {sku}. Riduca la quantità.",
      rm: "Memia pauc en magazun per {sku}. Per plaschair reducer la quantitad.",
      es: "Stock insuficiente para {sku}. Reduzca la cantidad.",
    },
  },
  {
    key: "shop.checkout.error.priceChanged",
    area: "shop",
    de: "Ein Preis hat sich geändert. Bitte prüfen Sie die neue Summe und bestätigen Sie erneut.",
    texts: {
      fr: "Un prix a changé. Veuillez vérifier le nouveau total et confirmer à nouveau.",
      it: "Un prezzo è cambiato. Verifichi il nuovo totale e confermi di nuovo.",
      rm: "In pretsch è midà. Per plaschair controllai la nova summa e confermai puspè.",
      es: "Un precio ha cambiado. Compruebe el nuevo total y confirme de nuevo.",
    },
  },
  {
    key: "shop.checkout.error.invoiceGuestOnly",
    area: "shop",
    de: "Rechnung ist nur für registrierte Kunden möglich. Bitte anmelden oder eine andere Zahlungsart wählen.",
    texts: {
      fr: "Le paiement sur facture est réservé aux clients enregistrés. Veuillez vous connecter ou choisir un autre mode de paiement.",
      it: "Il pagamento su fattura è riservato ai clienti registrati. Acceda o scelga un altro metodo di pagamento.",
      rm: "Il pajament sin faktura è mo pussibel per clients registrads. Annunziai Vus u tschernaia in auter modus da pajament.",
      es: "El pago por factura solo está disponible para clientes registrados. Inicie sesión o elija otro método de pago.",
    },
  },
  {
    key: "shop.checkout.error.invoiceCreditExhausted",
    area: "shop",
    de: "Das Kreditlimit für Rechnungszahlung ist erreicht. Bitte eine andere Zahlungsart wählen.",
    texts: {
      fr: "La limite de crédit pour le paiement sur facture est atteinte. Veuillez choisir un autre mode de paiement.",
      it: "Il limite di credito per il pagamento su fattura è raggiunto. Scelga un altro metodo di pagamento.",
      rm: "Il limit da credit per il pajament sin faktura è cuntanschì. Tschernaia in auter modus da pajament.",
      es: "Se ha alcanzado el límite de crédito para el pago por factura. Elija otro método de pago.",
    },
  },
  {
    key: "shop.checkout.error.shippingGone",
    area: "shop",
    de: "Diese Versandart ist nicht mehr verfügbar. Bitte neu laden.",
    texts: {
      fr: "Ce mode d'expédition n'est plus disponible. Veuillez recharger la page.",
      it: "Questo metodo di spedizione non è più disponibile. Ricarichi la pagina.",
      rm: "Quest modus da spediziun n'è pli disponibel. Per plaschair chargiai la pagina da nov.",
      es: "Este método de envío ya no está disponible. Vuelva a cargar la página.",
    },
  },
  {
    key: "shop.checkout.error.paymentGone",
    area: "shop",
    de: "Diese Zahlungsart ist nicht mehr verfügbar. Bitte neu laden.",
    texts: {
      fr: "Ce mode de paiement n'est plus disponible. Veuillez recharger la page.",
      it: "Questo metodo di pagamento non è più disponibile. Ricarichi la pagina.",
      rm: "Quest modus da pajament n'è pli disponibel. Per plaschair chargiai la pagina da nov.",
      es: "Este método de pago ya no está disponible. Vuelva a cargar la página.",
    },
  },
  {
    key: "shop.checkout.error.payAtPickupNeedsPickup",
    area: "shop",
    de: "Bezahlung bei Abholung ist nur mit Abholung im Laden möglich.",
    texts: {
      fr: "Le paiement au retrait n'est possible qu'avec le retrait en magasin.",
      it: "Il pagamento al ritiro è possibile solo con il ritiro in negozio.",
      rm: "Il pajament tar la retratga è mo pussibel cun la retratga en il store.",
      es: "El pago en la recogida solo está disponible con la recogida en tienda.",
    },
  },
  {
    key: "shop.checkout.error.invoiceNeedsDelivery",
    area: "shop",
    de: "Rechnung ist nur bei Lieferung möglich.",
    texts: {
      fr: "Le paiement sur facture n'est possible qu'avec une livraison.",
      it: "Il pagamento su fattura è possibile solo con la consegna.",
      rm: "Il pajament sin faktura è mo pussibel cun la furniziun.",
      es: "El pago por factura solo está disponible con envío a domicilio.",
    },
  },
  {
    key: "shop.checkout.error.inFlight",
    area: "shop",
    de: "Diese Bestellung wird bereits verarbeitet. Bitte prüfen Sie Ihre Bestellungen.",
    texts: {
      fr: "Cette commande est déjà en cours de traitement. Veuillez vérifier vos commandes.",
      it: "Questo ordine è già in elaborazione. Verifichi i suoi ordini.",
      rm: "Quest ordin è gia en tractament. Per plaschair controllai Voss urdins.",
      es: "Este pedido ya se está procesando. Compruebe sus pedidos.",
    },
  },
  {
    key: "shop.checkout.error.failed",
    area: "shop",
    de: "Bestellung konnte nicht erstellt werden. Bitte erneut versuchen.",
    texts: {
      fr: "La commande n'a pas pu être créée. Veuillez réessayer.",
      it: "L'ordine non può essere creato. Riprovi.",
      rm: "L'ordin n'ha pudì vegnir creà. Empruvai puspè.",
      es: "No se pudo crear el pedido. Inténtelo de nuevo.",
    },
  },
  {
    key: "shop.review.error.productNotFound",
    area: "shop",
    de: "Produkt nicht gefunden.",
    texts: {
      fr: "Produit introuvable.",
      it: "Prodotto non trovato.",
      rm: "Product chattà nun.",
      es: "Producto no encontrado.",
    },
  },
  {
    key: "shop.review.error.buyersOnly",
    area: "shop",
    de: "Bewerten können nur Kundinnen und Kunden, die dieses Produkt gekauft haben.",
    texts: {
      fr: "Seules les clientes et les clients ayant acheté ce produit peuvent le noter.",
      it: "Solo le clienti e i clienti che hanno acquistato questo prodotto possono valutarlo.",
      rm: "Mo las clientas ed ils clients che han cumprà quest product al pudais valitar.",
      es: "Solo las clientas y los clientes que hayan comprado este producto pueden valorarlo.",
    },
  },
  {
    key: "shop.review.error.accountNotFound",
    area: "shop",
    de: "Konto nicht gefunden.",
    texts: {
      fr: "Compte introuvable.",
      it: "Account non trovato.",
      rm: "Conto chattà nun.",
      es: "Cuenta no encontrada.",
    },
  },
  {
    key: "shop.review.error.alreadyReviewed",
    area: "shop",
    de: "Sie haben dieses Produkt bereits bewertet.",
    texts: {
      fr: "Vous avez déjà noté ce produit.",
      it: "Ha già valutato questo prodotto.",
      rm: "Avais gia valità quest product.",
      es: "Ya ha valorado este producto.",
    },
  },
  {
    key: "shop.restock.error.notFound",
    area: "shop",
    de: "Artikel nicht gefunden.",
    texts: {
      fr: "Article introuvable.",
      it: "Articolo non trovato.",
      rm: "Artitgel chattà nun.",
      es: "Artículo no encontrado.",
    },
  },
  {
    key: "shop.restock.error.email",
    area: "shop",
    de: "Bitte eine gültige E-Mail-Adresse angeben.",
    texts: {
      fr: "Veuillez indiquer une adresse e-mail valide.",
      it: "Indichi un indirizzo e-mail valido.",
      rm: "Per plaschair inditgai ina adressa d'e-mail valida.",
      es: "Indique una dirección de correo electrónico válida.",
    },
  },
  // Admin chrome, login and auth refusals (#58 admin slice): the prefix-free admin
  // follows the shared `lang` cookie, so every text it shows is a row here —
  // German bases byte-identical to the literals they replaced.
  {
    key: "admin.nav.dashboard",
    area: "admin",
    de: "Dashboard",
    texts: { fr: "Tableau de bord", it: "Cruscotto", rm: "Dashboard", es: "Panel" },
  },
  {
    key: "admin.nav.products",
    area: "admin",
    de: "Produkte",
    texts: { fr: "Produits", it: "Prodotti", rm: "Products", es: "Productos" },
  },
  {
    key: "admin.nav.orders",
    area: "admin",
    de: "Bestellungen",
    texts: { fr: "Commandes", it: "Ordini", rm: "Orders", es: "Pedidos" },
  },
  {
    key: "admin.nav.customers",
    area: "admin",
    de: "Kunden",
    texts: { fr: "Clients", it: "Clienti", rm: "Clients", es: "Clientes" },
  },
  {
    key: "admin.nav.reviews",
    area: "admin",
    de: "Bewertungen",
    texts: { fr: "Avis", it: "Recensioni", rm: "Valitaziuns", es: "Reseñas" },
  },
  {
    key: "admin.nav.discounts",
    area: "admin",
    de: "Aktionen",
    texts: { fr: "Promotions", it: "Promozioni", rm: "Acziuns", es: "Promociones" },
  },
  {
    key: "admin.nav.invoices",
    area: "admin",
    de: "Rechnungen",
    texts: { fr: "Factures", it: "Fatture", rm: "Facturas", es: "Facturas" },
  },
  {
    key: "admin.nav.packing",
    area: "admin",
    de: "Kommissionierung",
    texts: { fr: "Préparation", it: "Preparazione", rm: "Cumposiziun", es: "Preparación" },
  },
  {
    key: "admin.nav.pickup",
    area: "admin",
    de: "Abholung",
    texts: { fr: "Retrait", it: "Ritiro", rm: "Retschavra", es: "Recogida" },
  },
  {
    key: "admin.nav.purchasing",
    area: "admin",
    de: "Einkauf",
    texts: { fr: "Achats", it: "Acquisti", rm: "Cumpra", es: "Compras" },
  },
  {
    key: "admin.nav.stockUnits",
    area: "admin",
    de: "Serienlager",
    texts: { fr: "Stock sériel", it: "Stock seriale", rm: "Stock serial", es: "Stock serial" },
  },
  {
    key: "admin.nav.suppliers",
    area: "admin",
    de: "Lieferanten",
    texts: { fr: "Fournisseurs", it: "Fornitori", rm: "Furniturs", es: "Proveedores" },
  },
  {
    key: "admin.nav.mails",
    area: "admin",
    de: "Mails",
    texts: { fr: "E-mails", it: "E-mail", rm: "E-mails", es: "Correos" },
  },
  {
    key: "admin.nav.catalogTypes",
    area: "admin",
    de: "Katalogtypen",
    texts: { fr: "Types de catalogue", it: "Tipi di catalogo", rm: "Tips da catalog", es: "Tipos de catálogo" },
  },
  {
    key: "admin.nav.translations",
    area: "admin",
    de: "Übersetzungen",
    texts: { fr: "Traductions", it: "Traduzioni", rm: "Translaziuns", es: "Traducciones" },
  },
  {
    key: "admin.nav.settings",
    area: "admin",
    de: "Einstellungen",
    texts: { fr: "Paramètres", it: "Impostazioni", rm: "Parameters", es: "Ajustes" },
  },
  {
    key: "admin.nav.aria",
    area: "admin",
    de: "Admin-Navigation",
    texts: { fr: "Navigation d'administration", it: "Navigazione amministrativa", rm: "Navigaziun d'admin", es: "Navegación de administración" },
  },
  {
    key: "admin.action.logout",
    area: "admin",
    de: "Abmelden",
    texts: { fr: "Déconnexion", it: "Esci", rm: "Sortir", es: "Cerrar sesión" },
  },
  {
    key: "admin.sidebar.commands",
    area: "admin",
    de: "Befehle",
    texts: { fr: "Commandes", it: "Comandi", rm: "Cumandas", es: "Comandos" },
  },
  {
    key: "admin.sidebar.shortcuts",
    area: "admin",
    de: "Kürzel",
    texts: { fr: "Raccourcis", it: "Scorciatoie", rm: "Scursuras", es: "Atajos" },
  },
  {
    key: "admin.mobile.openNav",
    area: "admin",
    de: "Navigation öffnen",
    texts: { fr: "Ouvrir la navigation", it: "Apri la navigazione", rm: "Avrir la navigaziun", es: "Abrir la navegación" },
  },
  {
    key: "admin.language.aria",
    area: "admin",
    de: "Sprache wählen",
    texts: { fr: "Choisir la langue", it: "Scegli la lingua", rm: "Tscherner la lingua", es: "Elegir idioma" },
  },
  {
    key: "admin.language.switchTo",
    area: "admin",
    de: "Zu {language} wechseln",
    texts: {
      fr: "Passer à {language}",
      it: "Passa a {language}",
      rm: "Midar a {language}",
      es: "Cambiar a {language}",
    },
  },
  {
    key: "admin.login.title",
    area: "admin",
    de: "Admin-Anmeldung",
    texts: { fr: "Connexion à l'administration", it: "Accesso amministratore", rm: "Connexiun d'admin", es: "Inicio de sesión de administración" },
  },
  {
    key: "admin.login.description",
    area: "admin",
    de: "Anmeldung für den coder-shop Admin-Bereich.",
    texts: { fr: "Connexion à l'espace d'administration de coder-shop.", it: "Accesso all'area di amministrazione di coder-shop.", rm: "Connexiun per l'area d'admin da coder-shop.", es: "Inicio de sesión del área de administración de coder-shop." },
  },
  {
    key: "admin.login.cardIntro",
    area: "admin",
    de: "Melden Sie sich mit Ihrem Admin-Konto an.",
    texts: { fr: "Connectez-vous avec votre compte d'administrateur.", it: "Accedi con il tuo account amministratore.", rm: "As annunzia cun tes conto d'admin.", es: "Inicia sesión con tu cuenta de administrador." },
  },
  {
    key: "admin.login.email",
    area: "admin",
    de: "E-Mail",
    texts: { fr: "E-Mail", it: "E-mail", rm: "E-mail", es: "Correo electrónico" },
  },
  {
    key: "admin.login.password",
    area: "admin",
    de: "Passwort",
    texts: { fr: "Mot de passe", it: "Password", rm: "Contrasenda", es: "Contraseña" },
  },
  {
    key: "admin.login.submit",
    area: "admin",
    de: "Anmelden",
    texts: { fr: "Se connecter", it: "Accedi", rm: "S'annunziar", es: "Iniciar sesión" },
  },
  {
    key: "admin.login.emailInvalid",
    area: "admin",
    de: "Bitte eine gültige E-Mail eingeben.",
    texts: { fr: "Veuillez saisir une adresse e-mail valide.", it: "Inserisci un indirizzo e-mail valido.", rm: "Per plaschair endatescha in'e-mail valida.", es: "Introduce una dirección de correo electrónico válida." },
  },
  {
    key: "admin.login.passwordRequired",
    area: "admin",
    de: "Bitte Passwort eingeben.",
    texts: { fr: "Veuillez saisir le mot de passe.", it: "Inserisci la password.", rm: "Per plaschair endatescha la contrasenda.", es: "Introduce la contraseña." },
  },
  {
    key: "admin.login.demoHint",
    area: "admin",
    de: "Demo-Zugang: admin@codershop.ch — das Passwort kommt aus dem Seed ({var} bzw. dessen Ausgabe).",
    texts: {
      fr: "Accès démo : admin@codershop.ch — le mot de passe vient du seed ({var} ou sa sortie).",
      it: "Accesso demo: admin@codershop.ch — la password proviene dal seed ({var} o il suo output).",
      rm: "Access demo: admin@codershop.ch — la contrasenda vegn dal seed ({var} resp. sia sortida).",
      es: "Acceso demo: admin@codershop.ch — la contraseña proviene del seed ({var} o su salida).",
    },
  },
  {
    key: "admin.auth.error.wrongCredentials",
    area: "admin",
    de: "E-Mail oder Passwort ist falsch.",
    texts: { fr: "E-mail ou mot de passe incorrect.", it: "E-mail o password errati.", rm: "E-mail u contrasenda è sbagliada.", es: "Correo electrónico o contraseña incorrectos." },
  },
  {
    key: "admin.auth.error.blocked",
    area: "admin",
    de: "Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.",
    texts: { fr: "Votre compte a été bloqué. Veuillez contacter le support.", it: "Il tuo account è stato bloccato. Contatta l'assistenza.", rm: "Tes conto è stà bloccà. Per plaschair contactai il support.", es: "Su cuenta ha sido bloqueada. Ponte en contacto con el soporte." },
  },
  {
    key: "admin.auth.error.throttled",
    area: "admin",
    de: "Zu viele Fehlversuche. Bitte in {seconds} Sekunden erneut versuchen.",
    texts: {
      fr: "Trop de tentatives échouées. Réessayez dans {seconds} secondes.",
      it: "Troppi tentativi falliti. Riprova tra {seconds} secondi.",
      rm: "Memia bleras emprovas fallidas. Emprova da nov en {seconds} secundas.",
      es: "Demasiados intentos fallidos. Inténtalo de nuevo en {seconds} segundos.",
    },
  },
  {
    key: "admin.auth.error.busy",
    area: "admin",
    de: "Zu viele gleichzeitige Anmeldeversuche. Bitte gleich erneut versuchen.",
    texts: { fr: "Trop de connexions simultanées. Réessayez dans un instant.", it: "Troppi tentativi di accesso simultanei. Riprova a breve.", rm: "Memia bleras annunzias simultaneous. Emprova da nov en curt.", es: "Demasiados intentos de inicio de sesión simultáneos. Inténtalo de nuevo en un momento." },
  },
  {
    key: "admin.auth.error.userNotFound",
    area: "admin",
    de: "Benutzer nicht gefunden.",
    texts: { fr: "Utilisateur introuvable.", it: "Utente non trovato.", rm: "Utilisader betg chattà.", es: "Usuario no encontrado." },
  },
  {
    key: "admin.auth.error.currentPasswordWrong",
    area: "admin",
    de: "Das aktuelle Passwort ist falsch.",
    texts: { fr: "Le mot de passe actuel est incorrect.", it: "La password attuale non è corretta.", rm: "La contrasenda actuala è sbagliada.", es: "La contraseña actual es incorrecta." },
  },
  {
    key: "admin.auth.error.passwordTooShort",
    area: "admin",
    de: "Das neue Passwort braucht mindestens {min} Zeichen.",
    texts: {
      fr: "Le nouveau mot de passe doit contenir au moins {min} caractères.",
      it: "La nuova password deve contenere almeno {min} caratteri.",
      rm: "La nova contrasenda basegna almain {min} caracters.",
      es: "La nueva contraseña debe tener al menos {min} caracteres.",
    },
  },
  // Admin orders + packing slice (#58 step 2): every text of the orders list and detail,
  // the packing queue and slip, the label actions and the admin password change, plus
  // the shared order/label refusals of their cores. The German bases are byte-identical
  // to the literals they replace; status labels reuse the shop.status.* rows.
  {
    key: "admin.meta.orders.title",
    area: "admin",
    de: "Bestellungen — Admin",
    texts: { fr: "Commandes — Admin", it: "Ordini — Admin", rm: "Ordres — Admin", es: "Pedidos — Admin" },
  },
  {
    key: "admin.meta.orders.description",
    area: "admin",
    de: "Bestellungen mit Statusfilter und Übergängen.",
    texts: {
      fr: "Commandes avec filtre de statut et transitions.",
      it: "Ordini con filtro di stato e transizioni.",
      rm: "Ordres cun filter da status e transiziuns.",
      es: "Pedidos con filtro de estado y transiciones.",
    },
  },
  {
    key: "admin.meta.packing.title",
    area: "admin",
    de: "Kommissionierung — Admin",
    texts: { fr: "Préparation — Admin", it: "Preparazione — Admin", rm: "Preparaziun — Admin", es: "Preparación — Admin" },
  },
  {
    key: "admin.meta.packing.description",
    area: "admin",
    de: "Offene Picklisten und Pakete.",
    texts: {
      fr: "Listes de préparation et colis en cours.",
      it: "Liste di prelievo e pacchi in corso.",
      rm: "Glistas da preparaziun e pachets averts.",
      es: "Listas de picking y paquetes abiertos.",
    },
  },
  {
    key: "admin.meta.orderDetail.description",
    area: "admin",
    de: "Bestelldetails und Statuswechsel.",
    texts: {
      fr: "Détails de la commande et changements de statut.",
      it: "Dettagli dell'ordine e cambi di stato.",
      rm: "Detagls da l'ordre e midadas da status.",
      es: "Detalles del pedido y cambios de estado.",
    },
  },
  {
    key: "admin.meta.packingSlip.description",
    area: "admin",
    de: "Pickliste und Packzettel zum Drucken.",
    texts: {
      fr: "Liste de préparation et bordereau à imprimer.",
      it: "Lista di prelievo e distinta da stampare.",
      rm: "Glista da preparaziun e bulletin da stampar.",
      es: "Lista de picking y albarán para imprimir.",
    },
  },
  {
    key: "admin.action.all",
    area: "admin",
    de: "Alle",
    texts: { fr: "Toutes", it: "Tutti", rm: "Tut", es: "Todos" },
  },
  {
    key: "admin.action.print",
    area: "admin",
    de: "Drucken",
    texts: { fr: "Imprimer", it: "Stampa", rm: "Stampar", es: "Imprimir" },
  },
  {
    key: "admin.error.invalidRequest",
    area: "admin",
    de: "Ungültige Anfrage.",
    texts: {
      fr: "Requête non valide.",
      it: "Richiesta non valida.",
      rm: "Demanda nun valida.",
      es: "Solicitud no válida.",
    },
  },
  {
    key: "admin.error.orderNotFound",
    area: "admin",
    de: "Bestellung nicht gefunden.",
    texts: {
      fr: "Commande introuvable.",
      it: "Ordine non trovato.",
      rm: "Ordret betg chattà.",
      es: "Pedido no encontrado.",
    },
  },
  {
    key: "admin.orders.title",
    area: "admin",
    de: "Bestellungen",
    texts: { fr: "Commandes", it: "Ordini", rm: "Ordres", es: "Pedidos" },
  },
  {
    key: "admin.orders.statusFilterAria",
    area: "admin",
    de: "Statusfilter",
    texts: { fr: "Filtre de statut", it: "Filtro di stato", rm: "Filter da status", es: "Filtro de estado" },
  },
  {
    key: "admin.orders.empty",
    area: "admin",
    de: "Keine Bestellungen in diesem Status.",
    texts: {
      fr: "Aucune commande dans ce statut.",
      it: "Nessun ordine in questo stato.",
      rm: "Nagins orders en quest status.",
      es: "No hay pedidos en este estado.",
    },
  },
  {
    key: "admin.orders.column.order",
    area: "admin",
    de: "Bestellung",
    texts: { fr: "Commande", it: "Ordine", rm: "Ordre", es: "Pedido" },
  },
  {
    key: "admin.orders.column.date",
    area: "admin",
    de: "Datum",
    texts: { fr: "Date", it: "Data", rm: "Data", es: "Fecha" },
  },
  {
    key: "admin.orders.column.customer",
    area: "admin",
    de: "Kunde",
    texts: { fr: "Client", it: "Cliente", rm: "Client", es: "Cliente" },
  },
  {
    key: "admin.orders.column.items",
    area: "admin",
    de: "Positionen",
    texts: { fr: "Positions", it: "Posizioni", rm: "Posiziuns", es: "Posiciones" },
  },
  {
    key: "admin.orders.column.total",
    area: "admin",
    de: "Total",
    texts: { fr: "Total", it: "Totale", rm: "Total", es: "Total" },
  },
  {
    key: "admin.orders.column.status",
    area: "admin",
    de: "Status",
    texts: { fr: "Statut", it: "Stato", rm: "Status", es: "Estado" },
  },
  {
    key: "admin.orders.cap",
    area: "admin",
    de: "Es werden die neuesten {limit} Bestellungen angezeigt.",
    texts: {
      fr: "Les {limit} dernières commandes sont affichées.",
      it: "Vengono mostrati gli {limit} ordini più recenti.",
      rm: "Ils {limit} ultims ordres vegnan mussads.",
      es: "Se muestran los {limit} pedidos más recientes.",
    },
  },
  {
    key: "admin.orders.heading",
    area: "admin",
    de: "Bestellung {number}",
    texts: { fr: "Commande {number}", it: "Ordine {number}", rm: "Ordre {number}", es: "Pedido {number}" },
  },
  {
    key: "admin.orders.back",
    area: "admin",
    de: "Zurück zur Übersicht",
    texts: {
      fr: "Retour à la vue d'ensemble",
      it: "Torna alla panoramica",
      rm: "Enavos a la survista",
      es: "Volver a la vista general",
    },
  },
  {
    key: "admin.orders.transitions",
    area: "admin",
    de: "Statuswechsel",
    texts: { fr: "Changement de statut", it: "Cambio di stato", rm: "Midada da status", es: "Cambio de estado" },
  },
  {
    key: "admin.orders.shipping",
    area: "admin",
    de: "Versand",
    texts: { fr: "Expédition", it: "Spedizione", rm: "Trasport", es: "Envío" },
  },
  {
    key: "admin.orders.tracking",
    area: "admin",
    de: "Sendungsverfolgung:",
    texts: {
      fr: "Suivi d'envoi :",
      it: "Tracciamento della spedizione:",
      rm: "Trackament da la spediziun:",
      es: "Seguimiento del envío:",
    },
  },
  {
    key: "admin.orders.parcelWeight",
    area: "admin",
    de: "Paketgewicht {weight}",
    texts: {
      fr: "Poids du colis {weight}",
      it: "Peso del pacco {weight}",
      rm: "Pais dal pachet {weight}",
      es: "Peso del paquete {weight}",
    },
  },
  {
    key: "admin.orders.pickupAria",
    area: "admin",
    de: "Abholung",
    texts: { fr: "Retrait", it: "Ritiro", rm: "Retratga", es: "Recogida" },
  },
  {
    key: "admin.orders.pickup.title",
    area: "admin",
    de: "Abholung im Laden",
    texts: {
      fr: "Retrait en magasin",
      it: "Ritiro in negozio",
      rm: "Retratga en il store",
      es: "Recogida en la tienda",
    },
  },
  {
    key: "admin.orders.pickup.code",
    area: "admin",
    de: "Abholcode:",
    texts: { fr: "Code de retrait :", it: "Codice di ritiro:", rm: "Code da retratga:", es: "Código de recogida:" },
  },
  {
    key: "admin.orders.pickup.pickedUpAt",
    area: "admin",
    de: "Abgeholt am {date}",
    texts: {
      fr: "Retirée le {date}",
      it: "Ritirato il {date}",
      rm: "Retirà ils {date}",
      es: "Recogido el {date}",
    },
  },
  {
    key: "admin.orders.pickup.paid",
    area: "admin",
    de: "bezahlt ({type})",
    texts: { fr: "payée ({type})", it: "pagato ({type})", rm: "pajà ({type})", es: "pagado ({type})" },
  },
  {
    key: "admin.orders.pickup.hint",
    area: "admin",
    de: "Bereitstellen und Übergabe laufen über die Abholungs-Queue.",
    texts: {
      fr: "La mise à disposition et la remise se font via la file de retrait.",
      it: "Preparazione e consegna avvengono tramite la coda di ritiro.",
      rm: "Preparaziun e surdada funcziuneschan tras la queue da retratga.",
      es: "La preparación y la entrega se hacen por la cola de recogida.",
    },
  },
  {
    key: "admin.pickup.paymentType.cash",
    area: "admin",
    de: "Bar",
    texts: { fr: "Espèces", it: "Contanti", rm: "Contant", es: "Efectivo" },
  },
  {
    key: "admin.pickup.paymentType.card",
    area: "admin",
    de: "Karte",
    texts: { fr: "Carte", it: "Carta", rm: "Carta", es: "Tarjeta" },
  },
  {
    key: "admin.orders.historyAria",
    area: "admin",
    de: "Statusverlauf",
    texts: { fr: "Historique des statuts", it: "Cronologia degli stati", rm: "Cronologia da status", es: "Historial de estados" },
  },
  {
    key: "admin.orders.history",
    area: "admin",
    de: "Verlauf",
    texts: { fr: "Historique", it: "Cronologia", rm: "Cronologia", es: "Historial" },
  },
  {
    key: "admin.orders.customerAria",
    area: "admin",
    de: "Kunde und Total",
    texts: { fr: "Client et total", it: "Cliente e totale", rm: "Client e total", es: "Cliente y total" },
  },
  {
    key: "admin.orders.openCustomer",
    area: "admin",
    de: "Kundenkonto öffnen",
    texts: {
      fr: "Ouvrir le compte client",
      it: "Apri l'account cliente",
      rm: "Avrir il conto da client",
      es: "Abrir la cuenta de cliente",
    },
  },
  {
    key: "admin.orders.totals.subtotal",
    area: "admin",
    de: "Zwischensumme",
    texts: { fr: "Sous-total", it: "Subtotale", rm: "Subtotal", es: "Subtotal" },
  },
  {
    key: "admin.orders.totals.discount",
    area: "admin",
    de: "Rabatt ({code})",
    texts: { fr: "Remise ({code})", it: "Sconto ({code})", rm: "Sguardan ({code})", es: "Descuento ({code})" },
  },
  {
    key: "admin.orders.totals.free",
    area: "admin",
    de: "Gratis",
    texts: { fr: "Gratuit", it: "Gratis", rm: "Gratuit", es: "Gratis" },
  },
  {
    key: "admin.orders.totals.payment",
    area: "admin",
    de: "Zahlung",
    texts: { fr: "Paiement", it: "Pagamento", rm: "Pajament", es: "Pago" },
  },
  {
    key: "admin.orders.totals.invoice",
    area: "admin",
    de: "Rechnung",
    texts: { fr: "Facture", it: "Fattura", rm: "Factura", es: "Factura" },
  },
  {
    key: "admin.orders.totals.invoiceOpen",
    area: "admin",
    de: "Offen (fällig {date})",
    texts: {
      fr: "Ouverte (échéance {date})",
      it: "Aperto (scadenza {date})",
      rm: "Avert (scadenza {date})",
      es: "Pendiente (vencimiento {date})",
    },
  },
  {
    key: "admin.orders.totals.paid",
    area: "admin",
    de: "bezahlt",
    texts: { fr: "payée", it: "pagato", rm: "pajà", es: "pagado" },
  },
  {
    key: "admin.orders.statusUpdated",
    area: "admin",
    de: "Status aktualisiert.",
    texts: {
      fr: "Statut mis à jour.",
      it: "Stato aggiornato.",
      rm: "Status actualisà.",
      es: "Estado actualizado.",
    },
  },
  {
    key: "admin.orders.noTransitions",
    area: "admin",
    de: "Keine weiteren Übergänge möglich.",
    texts: {
      fr: "Aucune autre transition possible.",
      it: "Nessun'ulteriore transizione possibile.",
      rm: "Naginas ulteriuras transiziuns pussaivlas.",
      es: "No hay más transiciones posibles.",
    },
  },
  {
    key: "admin.orders.cancel",
    area: "admin",
    de: "Stornieren",
    texts: { fr: "Annuler", it: "Annulla", rm: "Annullar", es: "Cancelar" },
  },
  {
    key: "admin.orders.error.illegalTransition",
    area: "admin",
    de: "Dieser Statuswechsel ist nicht erlaubt.",
    texts: {
      fr: "Ce changement de statut n'est pas autorisé.",
      it: "Questo cambio di stato non è consentito.",
      rm: "Questa midada da status n'è betg permeschida.",
      es: "Este cambio de estado no está permitido.",
    },
  },
  {
    key: "admin.orders.error.failed",
    area: "admin",
    de: "Statuswechsel fehlgeschlagen. Bitte erneut versuchen.",
    texts: {
      fr: "Échec du changement de statut. Veuillez réessayer.",
      it: "Cambio di stato non riuscito. Riprovare.",
      rm: "Midada da status fallida. Empruvai anc ina giada.",
      es: "Error al cambiar el estado. Inténtelo de nuevo.",
    },
  },
  {
    key: "admin.orders.error.conflict",
    area: "admin",
    de: "Die Bestellung wurde zwischenzeitlich geändert. Bitte erneut versuchen.",
    texts: {
      fr: "La commande a été modée-temps modifiée entre-temps. Veuillez réessayer.",
      it: "L'ordine è stato modificato nel frattempo. Riprovare.",
      rm: "L'ordre è vegnì midà tranterin. Empruvai anc ina giada.",
      es: "El pedido se ha modificado entretanto. Inténtelo de nuevo.",
    },
  },
  {
    key: "admin.packing.title",
    area: "admin",
    de: "Kommissionierung",
    texts: { fr: "Préparation", it: "Preparazione", rm: "Preparaziun", es: "Preparación" },
  },
  {
    key: "admin.packing.intro",
    area: "admin",
    de: "Bestellungen in Kommission oder verpackt — bereit für Pickliste und Etikett.",
    texts: {
      fr: "Commandes en préparation ou emballées — prêtes pour la liste de préparation et l'étiquette.",
      it: "Ordini in preparazione o imballati — pronti per lista di prelievo ed etichetta.",
      rm: "Ordres en preparaziun u imballads — pronts per glista da preparaziun ed etiquetta.",
      es: "Pedidos en preparación o embalados — listos para la lista de picking y la etiqueta.",
    },
  },
  {
    key: "admin.packing.empty",
    area: "admin",
    de: "Keine offenen Sendungen. Alles versandt.",
    texts: {
      fr: "Aucun envoi en cours. Tout est expédié.",
      it: "Nessuna spedizione in corso. Tutto spedito.",
      rm: "Naginas spediziuns avertas. Tut tramess.",
      es: "No hay envíos abiertos. Todo enviado.",
    },
  },
  {
    key: "admin.packing.back",
    area: "admin",
    de: "Zurück zur Queue",
    texts: {
      fr: "Retour à la file",
      it: "Torna alla coda",
      rm: "Enavos a la queue",
      es: "Volver a la cola",
    },
  },
  {
    key: "admin.packing.slipHeading",
    area: "admin",
    de: "Packzettel {number}",
    texts: {
      fr: "Bordereau {number}",
      it: "Distinta {number}",
      rm: "Bulletin {number}",
      es: "Albarán {number}",
    },
  },
  {
    key: "admin.packing.labelNote",
    area: "admin",
    de: "Etikett erstellbar, sobald die Bestellung als verpackt markiert ist (Bestellung {link}).",
    texts: {
      fr: "Étiquette disponible dès que la commande est marquée comme emballée (commande {link}).",
      it: "Etichetta disponibile non appena l'ordine è segnato come imballato (ordine {link}).",
      rm: "Etiquetta pussaivla cura che l'ordre è marcad sco imballà (ordre {link}).",
      es: "Etiqueta disponible en cuanto el pedido esté marcado como embalado (pedido {link}).",
    },
  },
  {
    key: "admin.packing.openOrder",
    area: "admin",
    de: "öffnen",
    texts: { fr: "ouvrir", it: "aprire", rm: "avrir", es: "abrir" },
  },
  {
    key: "admin.packing.slip.title",
    area: "admin",
    de: "Lieferschein / Packliste",
    texts: {
      fr: "Bon de livraison / liste de colisage",
      it: "Documento di trasporto / lista colli",
      rm: "Bulletin da furniziun / glista da pachets",
      es: "Albarán / lista de bultos",
    },
  },
  {
    key: "admin.packing.slip.article",
    area: "admin",
    de: "Artikel",
    texts: { fr: "Article", it: "Articolo", rm: "Artitgel", es: "Artículo" },
  },
  {
    key: "admin.packing.slip.variant",
    area: "admin",
    de: "Variante",
    texts: { fr: "Variante", it: "Variante", rm: "Varianta", es: "Variante" },
  },
  {
    key: "admin.packing.slip.quantity",
    area: "admin",
    de: "Menge",
    texts: { fr: "Quantité", it: "Quantità", rm: "Quantitad", es: "Cantidad" },
  },
  {
    key: "admin.packing.slip.weight",
    area: "admin",
    de: "Gewicht",
    texts: { fr: "Poids", it: "Peso", rm: "Pais", es: "Peso" },
  },
  {
    key: "admin.packing.slip.totalWeight",
    area: "admin",
    de: "Paketgewicht (inkl. {weight} Verpackung)",
    texts: {
      fr: "Poids du colis (compris {weight} d'emballage)",
      it: "Peso del pacco (inclusi {weight} di imballaggio)",
      rm: "Pais dal pachet (inclus {weight} emballada)",
      es: "Peso del paquete (incl. {weight} de embalaje)",
    },
  },
  {
    key: "admin.label.create",
    area: "admin",
    de: "UPS-Etikett erstellen",
    texts: {
      fr: "Créer l'étiquette UPS",
      it: "Crea etichetta UPS",
      rm: "Creer l'etiquetta UPS",
      es: "Crear etiqueta UPS",
    },
  },
  {
    key: "admin.label.open",
    area: "admin",
    de: "Etikett öffnen",
    texts: { fr: "Ouvrir l'étiquette", it: "Apri etichetta", rm: "Avrir l'etiquetta", es: "Abrir etiqueta" },
  },
  {
    key: "admin.label.created",
    area: "admin",
    de: "Etikett erstellt — Sendung {tracking}",
    texts: {
      fr: "Étiquette créée — envoi {tracking}",
      it: "Etichetta creata — spedizione {tracking}",
      rm: "Etiquetta creada — spediziun {tracking}",
      es: "Etiqueta creada — envío {tracking}",
    },
  },
  {
    key: "admin.label.shipment",
    area: "admin",
    de: "Sendung {tracking}",
    texts: { fr: "Envoi {tracking}", it: "Spedizione {tracking}", rm: "Spediziun {tracking}", es: "Envío {tracking}" },
  },
  {
    key: "admin.label.error.notPacked",
    area: "admin",
    de: "Ein Etikett kann nur für gepackte Bestellungen erstellt werden.",
    texts: {
      fr: "Une étiquette ne peut être créée que pour les commandes emballées.",
      it: "Un'etichetta può essere creata solo per ordini imballati.",
      rm: "In'etiquetta po vegnir creada mo per ordres imballads.",
      es: "Una etiqueta solo se puede crear para pedidos embalados.",
    },
  },
  {
    key: "admin.label.error.storage",
    area: "admin",
    de: "Das Etikett konnte nicht gespeichert werden. Die Bestellung bleibt «gepackt» — bitte erneut versuchen.",
    texts: {
      fr: "L'étiquette n'a pas pu être enregistrée. La commande reste « emballée » — veuillez réessayer.",
      it: "L'etichetta non ha potuto essere salvata. L'ordine resta «imballato» — riprovare.",
      rm: "L'etiquetta n'ha betg pudì vegnir memorisada. L'ordre resta «imballà» — empruvai anc ina giada.",
      es: "No se pudo guardar la etiqueta. El pedido queda «embalado» — inténtelo de nuevo.",
    },
  },
  {
    key: "admin.label.error.conflict",
    area: "admin",
    de: "Etikett konnte nicht gespeichert werden. Bitte erneut versuchen.",
    texts: {
      fr: "L'étiquette n'a pas pu être enregistrée. Veuillez réessayer.",
      it: "Impossibile salvare l'etichetta. Riprovare.",
      rm: "L'etiquetta n'ha betg pudì vegnir memorisada. Empruvai anc ina giada.",
      es: "No se pudo guardar la etiqueta. Inténtelo de nuevo.",
    },
  },
  {
    key: "admin.label.error.missing",
    area: "admin",
    de: "Kein Etikett vorhanden.",
    texts: {
      fr: "Aucune étiquette disponible.",
      it: "Nessuna etichetta disponibile.",
      rm: "Nagina etiquetta existenta.",
      es: "No hay etiqueta disponible.",
    },
  },
  {
    key: "admin.label.error.invalidPath",
    area: "admin",
    de: "Ungültiger Etiketten-Pfad.",
    texts: {
      fr: "Chemin d'étiquette non valide.",
      it: "Percorso dell'etichetta non valido.",
      rm: "Percurs da l'etiquetta nun valid.",
      es: "Ruta de etiqueta no válida.",
    },
  },
  {
    key: "admin.label.error.fileMissing",
    area: "admin",
    de: "Etikettdatei fehlt auf dem Server.",
    texts: {
      fr: "Le fichier d'étiquette est absent du serveur.",
      it: "Il file dell'etichetta manca sul server.",
      rm: "La datoteca da l'etiquetta manca sin il server.",
      es: "Falta el archivo de etiqueta en el servidor.",
    },
  },
  {
    key: "admin.account.currentRequired",
    area: "admin",
    de: "Bitte das aktuelle Passwort eingeben.",
    texts: {
      fr: "Veuillez saisir le mot de passe actuel.",
      it: "Inserire la password attuale.",
      rm: "Endateschai la contrasenda actuala.",
      es: "Introduzca la contraseña actual.",
    },
  },
  {
    key: "admin.account.passwordMismatch",
    area: "admin",
    de: "Die Passwörter stimmen nicht überein.",
    texts: {
      fr: "Les mots de passe ne correspondent pas.",
      it: "Le password non corrispondono.",
      rm: "Las contrasendas n'èn betg identicalas.",
      es: "Las contraseñas no coinciden.",
    },
  },
  {
    key: "admin.account.passwordChanged",
    area: "admin",
    de: "Passwort geändert.",
    texts: {
      fr: "Mot de passe modifié.",
      it: "Password modificata.",
      rm: "Contrasenda midada.",
      rm2: undefined as never,
      es: "Contraseña cambiada.",
    } as Record<string, string>,
  },
];

// Fixed machine-translation repairs (#58 review): the seed is insert-only (#14), so a
// corrected default text would never reach a database seeded before the fix. This list
// names exactly the (key, language) rows whose stored text still equals the flawed
// machine translation — a text an admin has since edited is never touched. Not a
// general update, the same discipline as RETIRED_TRANSLATION_KEYS.
export const TRANSLATION_TEXT_REPAIRS: readonly {
  key: string;
  language: string;
  from: string;
  to: string;
}[] = [
  {
    key: "shop.order.invoice.open",
    language: "it",
    from: "Aperto: {amount}",
    to: "Resto: {amount}",
  },
  {
    key: "shop.order.invoice.open",
    language: "rm",
    from: "Avert: {amount}",
    to: "Restant: {amount}",
  },
  {
    key: "shop.breadcrumbs.aria",
    language: "es",
    from: "Navegación de ruta de navegación",
    to: "Miga de pan",
  },
];

// Code-owned keys renamed by later slices (#58): the seed is insert-only (#14), so a
// rename would leave the old row as dead data in the one table. This fixed list is the
// migration — the seed deletes exactly these keys, nothing else (DECISIONS).
export const RETIRED_TRANSLATION_KEYS: readonly string[] = [
  "shop.listing.countOne",
  "shop.listing.countOther",
  "shop.reviews.countOne",
  "shop.reviews.countOther",
  "shop.stock.low",
  "shop.checkout.shipping",
  "shop.account.orders.items",
  "shop.account.reorder.added",
  "shop.account.reorder.skipped",
];

export function activeLanguages(languages: LanguageConfig[]): LanguageConfig[] {
  return languages
    .filter((language) => language.active)
    .sort((a, b) => a.position - b.position);
}

export function defaultLanguage(languages: LanguageConfig[]): string {
  return activeLanguages(languages)[0]?.code ?? BASE_LANGUAGE;
}

// The Intl locale of a language (#58 step 2b): the row's own `intlLocale` wins, even
// when the row is deactivated (its texts survive, so its formats may still be needed);
// otherwise the first active row, and as a last stand the base language code itself —
// a valid Intl locale that merely formats in the base language.
export function intlLocaleOf(languages: readonly LanguageConfig[], code: string): string {
  return (
    languages.find((language) => language.code === code)?.intlLocale ??
    activeLanguages([...languages])[0]?.intlLocale ??
    BASE_LANGUAGE
  );
}

function normalizeCode(value: string | null | undefined): string | null {
  const code = value?.trim().toLowerCase();
  return code && /^[a-z]{2,3}$/.test(code) ? code : null;
}

// Accept-Language → plain language codes in the client's preference order: q-values
// decide (missing q = 1), region suffixes are stripped (fr-CH → fr), order is stable.
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.split("=")[1]) : 1;
      return { code: normalizeCode(tag?.split("-")[0]), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry): entry is { code: string; q: number; index: number } => entry.code !== null)
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .filter((entry, index, sorted) => sorted.findIndex((other) => other.code === entry.code) === index)
    .map((entry) => entry.code);
}

// Precedence per the #58 design: URL prefix wins, then the remembered choice (cookie),
// then the browser, then the first active language. Values outside the active set are
// ignored at every step — a deactivated language never answers.
export function resolveLanguage(input: {
  pathPrefix?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  languages: LanguageConfig[];
}): string {
  const active = new Set(activeLanguages(input.languages).map((language) => language.code));
  const fromPrefix = normalizeCode(input.pathPrefix);
  if (fromPrefix && active.has(fromPrefix)) return fromPrefix;
  const fromCookie = normalizeCode(input.cookie);
  if (fromCookie && active.has(fromCookie)) return fromCookie;
  for (const code of parseAcceptLanguage(input.acceptLanguage)) {
    if (active.has(code)) return code;
  }
  return defaultLanguage(input.languages);
}

// A missing or blank translation falls back to the German base text — visibly, because
// the translator reports every key that had to fall back.
export function textFor(entry: TranslationEntry, language: string): string {
  if (language === BASE_LANGUAGE) return entry.de;
  const text = entry.texts[language];
  return text && text.trim() ? text : entry.de;
}

export function isTranslated(entry: TranslationEntry, language: string): boolean {
  if (language === BASE_LANGUAGE) return true;
  return Boolean(entry.texts[language]?.trim());
}

// Admin list filter (#58 editor): free text over key, German base and every language
// text, the area, and "missing in language X" — all optional, all combining. The
// missing filter answers the editor's question "what still has to be translated?".
export function filterTranslations(
  entries: readonly TranslationEntry[],
  filter: { q?: string; area?: string; missingFor?: string },
): TranslationEntry[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return entries.filter((entry) => {
    if (filter.area && entry.area !== filter.area) return false;
    if (filter.missingFor && isTranslated(entry, filter.missingFor)) return false;
    if (!q) return true;
    return [entry.key, entry.de, ...Object.values(entry.texts)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

// The whole table resolved into one plain key→text map for a language (#58 step 3):
// serializable, so a server slot can hand it to client components, which read their
// texts by key without ever seeing the German base of another language.
export function labelMap(
  entries: Iterable<TranslationEntry>,
  language: string,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of entries) labels[entry.key] = textFor(entry, language);
  return labels;
}

// Reads one label out of a `labelMap` result; an unknown key answers the key itself —
// visibly missing, exactly like the translator's behaviour.
export function label(labels: Readonly<Record<string, string>>, key: string): string {
  return labels[key] ?? key;
}

// Fills `{name}` placeholders in a translated text (issue #58 step 3) — the texts stay
// whole sentences per language, the values (VAT label, year, counts) come from code.
export function interpolate(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (match: string, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

// Picks the plural form of a text family (#58 step 3): the CLDR category of the count
// in the language's Intl locale selects the suffixed key (`key.one`, `key.two`, …), so
// a language with more categories is served by adding rows, never by code. A missing
// category row falls back to `key.other`; both unknown answers the key itself.
export function plural(
  labels: Readonly<Record<string, string>>,
  count: number,
  key: string,
  intlLocale: string,
): string {
  const category = new Intl.PluralRules(intlLocale).select(count);
  return labels[`${key}.${category}`] ?? label(labels, `${key}.other`);
}

// Splits a translated text around a `{name}` placeholder (#58 step 3) so a component
// can render its own element (a link) inside a whole sentence — the translator places
// `{link}` wherever the word order of the language needs it. Without the placeholder
// the whole text is `before` and nothing follows it.
export function splitOnPlaceholder(
  text: string,
  name: string,
): { before: string; after: string } {
  const placeholder = `{${name}}`;
  const index = text.indexOf(placeholder);
  if (index === -1) return { before: text, after: "" };
  return { before: text.slice(0, index), after: text.slice(index + placeholder.length) };
}

export interface Translator {
  t(key: string): string;
  missingKeys(): string[];
}

// One table load per request, then pure lookups: unknown keys and untranslated keys
// answer German (unknown keys answer the key itself) and land in the missing report —
// the test hook and the admin "missing translations" view read exactly that.
export function createTranslator(entries: Iterable<TranslationEntry>, language: string): Translator {
  const byKey = new Map<string, TranslationEntry>();
  for (const entry of entries) byKey.set(entry.key, entry);
  const missing = new Set<string>();
  return {
    t(key: string): string {
      const entry = byKey.get(key);
      if (!entry) {
        missing.add(key);
        return key;
      }
      if (!isTranslated(entry, language)) missing.add(key);
      return textFor(entry, language);
    },
    missingKeys(): string[] {
      return [...missing].sort();
    },
  };
}

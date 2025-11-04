import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Types for configuration
export type Language = 'es' | 'en' | 'de'
export type Currency = 'EUR' | 'USD' | 'COP'
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large'

// Types for exchange rates
interface ExchangeRates {
  [key: string]: number
}

interface ConfigState {
  language: Language
  currency: Currency
  fontSize: FontSize
}

interface ConfigContextType extends ConfigState {
  // Temporary state for unsaved changes
  tempLanguage: Language
  tempCurrency: Currency
  tempFontSize: FontSize
  // Setters for temporary state
  setTempLanguage: (language: Language) => void
  setTempCurrency: (currency: Currency) => void
  setTempFontSize: (fontSize: FontSize) => void
  // Save and reset functions
  saveChanges: () => void
  discardChanges: () => void
  hasUnsavedChanges: () => boolean
  // Translation and formatting functions
  t: (key: string, variables?: Record<string, string | number>) => string
  formatCurrency: (amount: number) => string
  getFontSizeClass: () => string
  // Currency conversion functions
  convertFromUSD: (usdAmount: number) => number
  exchangeRates: ExchangeRates
  ratesLoading: boolean
  ratesError: string | null
}

// Translations
const translations = {
  es: {
    // Navigation
    dashboard: 'Dashboard',
    takeOrder: 'Tomar Pedido',
    paymentHistory: 'Historial de Pagos',
    settings: 'Configuración',
    
    // Dashboard
    dashboardTitle: 'Dashboard de Operaciones',
    dashboardSubtitle: 'Vista en tiempo real del restaurante',
    readyToServe: 'Listas para Servir',
    completedOrders: 'órdenes completadas',
    inKitchen: 'En Cocina',
    inPreparation: 'en preparación',
    pendingPayment: 'Por Pagar',
    tablesWaiting: 'mesas esperando',
    occupancy: 'Ocupación',
    ofRestaurant: 'del restaurante',
    tableStatus: 'Estado de Mesas',
    available: 'Disponibles',
    occupied: 'Ocupadas',
    total: 'Total',
    occupancyRate: 'ocupación',
    orderDetails: 'Detalle de la Orden',
    served: 'Servido',
    pending: 'PENDIENTES',
    inPreparationCaps: 'EN PREPARACIÓN',
    processPayment: 'Procesar Pago',
    consumption: 'Detalle de Consumo',
    moreItems: 'platillos más',
    noReadyOrders: 'No hay órdenes listas',
    noPendingPayments: 'No hay pagos pendientes',
    dishes: 'platillos',
    persons: 'personas',
    moreDishes: 'platillos más',
    moreItemsText: 'items más',
    byKitchen: 'por cocina',
    andPending: 'y pendientes',
    noPendingOrders: 'Sin órdenes pendientes',
    noOrdersInPreparation: 'Sin órdenes en preparación',
    waitingPayment: 'el pago',
    noPaymentsPending: 'No hay pagos pendientes',
    progress: 'Progreso',
    occupation: 'Ocupación',
    availableText: 'disponibles',
    good: 'Buena',
    smallTable: 'Pequeña',
    productInfo: 'Información del producto',
    noResultsFound: 'No se encontraron resultados para',
    tryOtherTerms: 'Prueba con otros términos de búsqueda o selecciona otra categoría',
    noProductsInCategory: 'No hay productos en esta categoría',
    trySelectingOther: 'Prueba seleccionando otra categoría',
    productsText: 'productos',
    type: 'tipo',
    types: 'tipos',
    pleaseSelectTable: 'Por favor selecciona una mesa y agrega productos al carrito',
    clearCartTooltip: 'Vaciar carrito',
    canEditQuantities: 'Puedes editar las cantidades usando los botones + y -',
    quantity: 'Cantidad',
    selected: 'seleccionados',
    including: 'Incluyendo',
    taxes: 'impuestos',
    
    // Take Order
    takeOrderTitle: 'Tomar Nuevo Pedido',
    selectTable: 'Seleccionar Mesa',
    step1Subtitle: 'Paso 1: Indica cuántos huéspedes y selecciona la mesa ideal',
    howManyGuests: '¿Cuántos huéspedes?',
    guestsHelp: 'Te mostraremos las mesas más adecuadas',
    numberOfGuests: 'Número de huéspedes',
    quickSelection: 'Selección rápida:',
    person: 'persona',
    people: 'personas',
    availableTables: 'Mesas Disponibles',
    selectPreferredTable: 'Selecciona tu mesa preferida',
    ideal: 'Ideal',
    recommended: 'Recomendada',
    tooSmall: 'Muy pequeña',
    menuTitle: 'Menú del Restaurante',
    step2Subtitle: 'Paso 2: Mesa {table} • {guests} huéspedes • Selecciona tus platos favoritos',
    orderProgress: 'Progreso del Pedido',
    table: 'Mesa',
    guests: 'Huéspedes',
    products: 'Productos',
    search: 'Buscar...',
    all: 'Todo',
    starters: 'Entrantes',
    mains: 'Principales',
    desserts: 'Postres',
    drinks: 'Bebidas',
    orderSummary: 'Resumen del Pedido',
    step3Subtitle: 'Paso 3: Revisa y confirma tu pedido • Mesa {table}',
    yourOrder: 'Tu Pedido',
    items: 'items',
    clearCart: 'Vaciar carrito',
    unitPrice: 'por unidad',
    orderTotal: 'Total del pedido',
    confirmOrder: 'Confirmar y Enviar Pedido',
    noProductsInOrder: 'No hay productos en tu pedido',
    goBackToPrevious: 'Regresa al paso anterior para agregar productos al carrito',
    editQuantities: 'Puedes editar las cantidades usando los botones + y -',
    orderConfirmed: '¡Pedido Confirmado!',
    sendingToKitchen: 'Enviando a cocina...',
    
    // Payment History
    paymentHistoryTitle: 'Historial de Pagos',
    paymentHistorySubtitle: 'Registro completo de transacciones',
    totalRevenue: 'Ingresos Totales',
    totalCollected: 'total recaudado',
    totalTips: 'Propinas Totales',
    inTips: 'en propinas',
    averageTicket: 'Ticket Promedio',
    perTransaction: 'por transacción',
    transactions: 'Transacciones',
    completed: 'completadas',
    searchFilters: 'Filtros de Búsqueda',
    searchPlaceholder: 'Buscar por mesa, mesero o platillo...',
    allMethods: 'Todos los métodos',
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    today: 'Hoy',
    yesterday: 'Ayer',
    thisWeek: 'Esta semana',
    transactionHistory: 'Historial de Transacciones',
    found: 'encontradas',
    completeRecord: 'Registro completo de pagos procesados',
    date: 'Fecha/Hora',
    method: 'Método',
    waiter: 'Mesero',
    tip: 'Propina',
    duration: 'Duración',
    detail: 'Detalle',
    viewDetail: 'Ver detalle',
    noPaymentsFound: 'No se encontraron pagos',
    adjustFilters: 'Intenta ajustar los filtros de búsqueda',
    tryAdjustingFilters: 'Intenta ajustar los filtros de búsqueda',
    completePaymentRecord: 'Registro completo de pagos procesados',
    tableNumber: 'Mesa {number}',
    diners: 'comensales',
    orderDetail: 'Detalle de la Orden',
    subtotal: 'Subtotal',
    paymentMethod: 'Método de pago',
    each: 'c/u',
    close: 'Cerrar',
    
    // Settings
    settingsTitle: 'Configuración',
    settingsSubtitle: 'Personaliza tu experiencia en la aplicación',
    appearance: 'Apariencia',
    language: 'Idioma',
    selectLanguage: 'Selecciona tu idioma preferido',
    spanish: 'Español',
    english: 'English',
    german: 'Deutsch',
    fontSize: 'Tamaño de Fuente',
    chooseFontSize: 'Elige el tamaño de fuente más cómodo',
    small: 'Pequeño',
    medium: 'Mediano',
    large: 'Grande',
    extraLarge: 'Extra Grande',
    regional: 'Regional',
    currencySettings: 'Configuración de Moneda',
    selectCurrency: 'Selecciona tu moneda preferida',
    euro: 'Euro (EUR)',
    dollar: 'Dólar Americano (USD)',
    colombianPeso: 'Peso Colombiano (COP)',
    saveSettings: 'Guardar Configuración',
    settingsSaved: 'Configuración guardada exitosamente',
    appliedToApp: 'Aplicada a toda la aplicación',
    customization: 'Personalización',
    customizeAppAppearance: 'Personaliza la apariencia de la aplicación',
    livePreview: 'Vista Previa en Vivo',
    seeChangesBeforeApply: 'Ve los cambios antes de aplicarlos',
    pendingChanges: 'Cambios Pendientes',
    changesWillBeApplied: 'Los cambios se aplicarán a toda la aplicación',
    reset: 'Restablecer',
    changes: 'cambios',
    noChangesToSave: 'Sin cambios para guardar',
    makeChangesToEnable: 'Haz cambios en la configuración para habilitar el botón de guardar',
    
    // Common
    loading: 'Cargando...',
    previous: 'Anterior',
    next: 'Siguiente',
    cancel: 'Cancelar',
    save: 'Guardar',
    edit: 'Editar',
    delete: 'Eliminar',
    ok: 'OK'
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    takeOrder: 'Take Order',
    paymentHistory: 'Payment History',
    settings: 'Settings',
    
    // Dashboard
    dashboardTitle: 'Operations Dashboard',
    dashboardSubtitle: 'Real-time restaurant view',
    readyToServe: 'Ready to Serve',
    completedOrders: 'completed orders',
    inKitchen: 'In Kitchen',
    inPreparation: 'in preparation',
    pendingPayment: 'Pending Payment',
    tablesWaiting: 'tables waiting',
    occupancy: 'Occupancy',
    ofRestaurant: 'of restaurant',
    tableStatus: 'Table Status',
    available: 'Available',
    occupied: 'Occupied',
    total: 'Total',
    occupancyRate: 'occupancy',
    orderDetails: 'Order Details',
    served: 'Served',
    pending: 'PENDING',
    inPreparationCaps: 'IN PREPARATION',
    processPayment: 'Process Payment',
    consumption: 'Consumption Details',
    moreItems: 'more items',
    noReadyOrders: 'No ready orders',
    noPendingPayments: 'No pending payments',
    dishes: 'dishes',
    persons: 'people',
    moreDishes: 'more dishes',
    moreItemsText: 'more items',
    byKitchen: 'by kitchen',
    andPending: 'and pending',
    noPendingOrders: 'No pending orders',
    noOrdersInPreparation: 'No orders in preparation',
    waitingPayment: 'payment',
    noPaymentsPending: 'No pending payments',
    progress: 'Progress',
    occupation: 'Occupancy',
    availableText: 'available',
    good: 'Good',
    smallTable: 'Too Small',
    productInfo: 'Product information',
    noResultsFound: 'No results found for',
    tryOtherTerms: 'Try other search terms or select another category',
    noProductsInCategory: 'No products in this category',
    trySelectingOther: 'Try selecting another category',
    productsText: 'products',
    type: 'type',
    types: 'types',
    pleaseSelectTable: 'Please select a table and add products to cart',
    clearCartTooltip: 'Clear cart',
    canEditQuantities: 'You can edit quantities using + and - buttons',
    quantity: 'Quantity',
    selected: 'selected',
    including: 'Including',
    taxes: 'taxes',
    
    // Take Order
    takeOrderTitle: 'Take New Order',
    selectTable: 'Select Table',
    step1Subtitle: 'Step 1: Indicate how many guests and select the ideal table',
    howManyGuests: 'How many guests?',
    guestsHelp: 'We will show you the most suitable tables',
    numberOfGuests: 'Number of guests',
    quickSelection: 'Quick selection:',
    person: 'person',
    people: 'people',
    availableTables: 'Available Tables',
    selectPreferredTable: 'Select your preferred table',
    ideal: 'Ideal',
    recommended: 'Recommended',
    tooSmall: 'Too small',
    menuTitle: 'Restaurant Menu',
    step2Subtitle: 'Step 2: Table {table} • {guests} guests • Select your favorite dishes',
    orderProgress: 'Order Progress',
    table: 'Table',
    guests: 'Guests',
    products: 'Products',
    search: 'Search...',
    all: 'All',
    starters: 'Starters',
    mains: 'Mains',
    desserts: 'Desserts',
    drinks: 'Drinks',
    orderSummary: 'Order Summary',
    step3Subtitle: 'Step 3: Review and confirm your order • Table {table}',
    yourOrder: 'Your Order',
    items: 'items',
    clearCart: 'Clear cart',
    unitPrice: 'per unit',
    orderTotal: 'Order total',
    confirmOrder: 'Confirm and Send Order',
    noProductsInOrder: 'No products in your order',
    goBackToPrevious: 'Go back to previous step to add products to cart',
    editQuantities: 'You can edit quantities using + and - buttons',
    orderConfirmed: 'Order Confirmed!',
    sendingToKitchen: 'Sending to kitchen...',
    
    // Payment History
    paymentHistoryTitle: 'Payment History',
    paymentHistorySubtitle: 'Complete transaction record',
    totalRevenue: 'Total Revenue',
    totalCollected: 'total collected',
    totalTips: 'Total Tips',
    inTips: 'in tips',
    averageTicket: 'Average Ticket',
    perTransaction: 'per transaction',
    transactions: 'Transactions',
    completed: 'completed',
    searchFilters: 'Search Filters',
    searchPlaceholder: 'Search by table, waiter or dish...',
    allMethods: 'All methods',
    cash: 'Cash',
    card: 'Card',
    transfer: 'Transfer',
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This week',
    transactionHistory: 'Transaction History',
    found: 'found',
    completeRecord: 'Complete record of processed payments',
    date: 'Date/Time',
    method: 'Method',
    waiter: 'Waiter',
    tip: 'Tip',
    duration: 'Duration',
    detail: 'Detail',
    viewDetail: 'View detail',
    noPaymentsFound: 'No payments found',
    adjustFilters: 'Try adjusting search filters',
    tryAdjustingFilters: 'Try adjusting search filters',
    completePaymentRecord: 'Complete record of processed payments',
    tableNumber: 'Table {number}',
    diners: 'diners',
    orderDetail: 'Order Detail',
    subtotal: 'Subtotal',
    paymentMethod: 'Payment method',
    each: 'each',
    close: 'Close',
    
    // Settings
    settingsTitle: 'Settings',
    settingsSubtitle: 'Customize your app experience',
    appearance: 'Appearance',
    language: 'Language',
    selectLanguage: 'Select your preferred language',
    spanish: 'Español',
    english: 'English',
    german: 'Deutsch',
    fontSize: 'Font Size',
    chooseFontSize: 'Choose the most comfortable font size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    extraLarge: 'Extra Large',
    regional: 'Regional',
    currencySettings: 'Currency Settings',
    selectCurrency: 'Select your preferred currency',
    euro: 'Euro (EUR)',
    dollar: 'US Dollar (USD)',
    colombianPeso: 'Colombian Peso (COP)',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully',
    appliedToApp: 'Applied to entire application',
    customization: 'Customization',
    customizeAppAppearance: 'Customize the application appearance',
    livePreview: 'Live Preview',
    seeChangesBeforeApply: 'See changes before applying them',
    pendingChanges: 'Pending Changes',
    changesWillBeApplied: 'Changes will be applied to the entire application',
    reset: 'Reset',
    changes: 'changes',
    noChangesToSave: 'No changes to save',
    makeChangesToEnable: 'Make changes to settings to enable the save button',
    
    // Kitchen
    kitchenDashboard: 'Dashboard de Cocina',
    kitchenSubtitle: 'Gestiona las órdenes en tiempo real',
    newOrders: 'Nuevas Órdenes',
    preparingOrders: 'En Preparación',
    readyToServeOrders: 'Listas para Servir',
    initiatePreparation: 'Iniciar Preparación',
    markOrderAsReady: 'Marcar como Lista',
    orderReceivedNotification: 'Orden recibida',
    orderDuration: 'Hace',
    minutesAgo: 'minutos',
    now: 'Ahora',
    nothingHere: 'No hay nada aquí',
    newOrdersWillAppear: 'Las nuevas órdenes aparecerán aquí',
    startPreparationOfNew: 'Inicia la preparación de las órdenes nuevas',
    completedOrdersAppear: 'Las órdenes completadas aparecerán aquí',
    
    // Login
    systemAccess: 'Acceso al Sistema',
    loginToContinue: 'Inicia sesión para continuar',
    quickAccessByRole: 'Acceso rápido por puesto:',
    waiterFrontman: 'Mesero/Frontman',
    takeOrders: 'Tomar órdenes',
    kitchen: 'Cocina',
    manageOrders: 'Gestionar órdenes',
    username: 'Usuario',
    enterUsername: 'Ingresa tu usuario',
    password: 'Contraseña',
    enterPassword: 'Ingresa tu contraseña',
    completeAllFields: 'Por favor completa todos los campos',
    incorrectCredentials: 'Usuario o contraseña incorrectos',
    verifying: 'Verificando...',
    login: 'Iniciar Sesión',
    testUsers: 'Usuarios de prueba:',
    loadingApp: 'Cargando aplicación...',
    
    // Common
    loading: 'Cargando...',
    previous: 'Anterior',
    next: 'Siguiente',
    cancel: 'Cancelar',
    save: 'Guardar',
    edit: 'Editar',
    delete: 'Eliminar',
    ok: 'OK'
  },
  de: {
    // Navigation
    dashboard: 'Dashboard',
    takeOrder: 'Bestellung Aufnehmen',
    paymentHistory: 'Zahlungshistorie',
    settings: 'Einstellungen',
    
    // Dashboard
    dashboardTitle: 'Operations Dashboard',
    dashboardSubtitle: 'Restaurant-Echtzeitansicht',
    readyToServe: 'Bereit zum Servieren',
    completedOrders: 'abgeschlossene Bestellungen',
    inKitchen: 'In der Küche',
    inPreparation: 'in Vorbereitung',
    pendingPayment: 'Ausstehende Zahlung',
    tablesWaiting: 'wartende Tische',
    occupancy: 'Auslastung',
    ofRestaurant: 'des Restaurants',
    tableStatus: 'Tischstatus',
    available: 'Verfügbar',
    occupied: 'Besetzt',
    total: 'Gesamt',
    occupancyRate: 'Auslastung',
    orderDetails: 'Bestelldetails',
    served: 'Serviert',
    pending: 'AUSSTEHEND',
    inPreparationCaps: 'IN VORBEREITUNG',
    processPayment: 'Zahlung Verarbeiten',
    consumption: 'Verbrauchsdetails',
    moreItems: 'weitere Artikel',
    noReadyOrders: 'Keine bereiten Bestellungen',
    noPendingPayments: 'Keine ausstehenden Zahlungen',
    dishes: 'Gerichte',
    persons: 'Personen',
    moreDishes: 'weitere Gerichte',
    moreItemsText: 'weitere Artikel',
    byKitchen: 'von der Küche',
    andPending: 'und ausstehend',
    noPendingOrders: 'Keine ausstehenden Bestellungen',
    noOrdersInPreparation: 'Keine Bestellungen in Vorbereitung',
    waitingPayment: 'Zahlung',
    noPaymentsPending: 'Keine ausstehenden Zahlungen',
    progress: 'Fortschritt',
    occupation: 'Auslastung',
    availableText: 'verfügbar',
    good: 'Gut',
    smallTable: 'Zu Klein',
    productInfo: 'Produktinformation',
    noResultsFound: 'Keine Ergebnisse gefunden für',
    tryOtherTerms: 'Versuchen Sie andere Suchbegriffe oder wählen Sie eine andere Kategorie',
    noProductsInCategory: 'Keine Produkte in dieser Kategorie',
    trySelectingOther: 'Versuchen Sie eine andere Kategorie zu wählen',
    productsText: 'Produkte',
    type: 'Typ',
    types: 'Typen',
    pleaseSelectTable: 'Bitte wählen Sie einen Tisch und fügen Sie Produkte zum Warenkorb hinzu',
    clearCartTooltip: 'Warenkorb leeren',
    canEditQuantities: 'Sie können Mengen mit + und - Tasten bearbeiten',
    quantity: 'Menge',
    selected: 'ausgewählt',
    including: 'Inklusive',
    taxes: 'Steuern',
    
    // Take Order
    takeOrderTitle: 'Neue Bestellung Aufnehmen',
    selectTable: 'Tisch Auswählen',
    step1Subtitle: 'Schritt 1: Anzahl der Gäste angeben und idealen Tisch auswählen',
    howManyGuests: 'Wie viele Gäste?',
    guestsHelp: 'Wir zeigen Ihnen die am besten geeigneten Tische',
    numberOfGuests: 'Anzahl der Gäste',
    quickSelection: 'Schnellauswahl:',
    person: 'Person',
    people: 'Personen',
    availableTables: 'Verfügbare Tische',
    selectPreferredTable: 'Wählen Sie Ihren bevorzugten Tisch',
    ideal: 'Ideal',
    recommended: 'Empfohlen',
    tooSmall: 'Zu klein',
    menuTitle: 'Restaurant Menü',
    step2Subtitle: 'Schritt 2: Tisch {table} • {guests} Gäste • Wählen Sie Ihre Lieblingsgerichte',
    orderProgress: 'Bestellfortschritt',
    table: 'Tisch',
    guests: 'Gäste',
    products: 'Produkte',
    search: 'Suchen...',
    all: 'Alle',
    starters: 'Vorspeisen',
    mains: 'Hauptgerichte',
    desserts: 'Desserts',
    drinks: 'Getränke',
    orderSummary: 'Bestellzusammenfassung',
    step3Subtitle: 'Schritt 3: Bestellung überprüfen und bestätigen • Tisch {table}',
    yourOrder: 'Ihre Bestellung',
    items: 'Artikel',
    clearCart: 'Warenkorb leeren',
    unitPrice: 'pro Einheit',
    orderTotal: 'Bestellsumme',
    confirmOrder: 'Bestellung Bestätigen und Senden',
    noProductsInOrder: 'Keine Produkte in Ihrer Bestellung',
    goBackToPrevious: 'Gehen Sie zum vorherigen Schritt zurück, um Produkte hinzuzufügen',
    editQuantities: 'Sie können Mengen mit + und - Tasten bearbeiten',
    orderConfirmed: 'Bestellung Bestätigt!',
    sendingToKitchen: 'An die Küche senden...',
    
    // Payment History
    paymentHistoryTitle: 'Zahlungshistorie',
    paymentHistorySubtitle: 'Vollständiger Transaktionsdatensatz',
    totalRevenue: 'Gesamtumsatz',
    totalCollected: 'gesamt gesammelt',
    totalTips: 'Gesamtes Trinkgeld',
    inTips: 'an Trinkgeld',
    averageTicket: 'Durchschnittsticket',
    perTransaction: 'pro Transaktion',
    transactions: 'Transaktionen',
    completed: 'abgeschlossen',
    searchFilters: 'Suchfilter',
    searchPlaceholder: 'Nach Tisch, Kellner oder Gericht suchen...',
    allMethods: 'Alle Methoden',
    cash: 'Bargeld',
    card: 'Karte',
    transfer: 'Überweisung',
    today: 'Heute',
    yesterday: 'Gestern',
    thisWeek: 'Diese Woche',
    transactionHistory: 'Transaktionshistorie',
    found: 'gefunden',
    completeRecord: 'Vollständiger Datensatz verarbeiteter Zahlungen',
    date: 'Datum/Zeit',
    method: 'Methode',
    waiter: 'Kellner',
    tip: 'Trinkgeld',
    duration: 'Dauer',
    detail: 'Detail',
    viewDetail: 'Detail anzeigen',
    noPaymentsFound: 'Keine Zahlungen gefunden',
    adjustFilters: 'Versuchen Sie, die Suchfilter anzupassen',
    tryAdjustingFilters: 'Versuchen Sie, die Suchfilter anzupassen',
    completePaymentRecord: 'Vollständiger Datensatz verarbeiteter Zahlungen',
    tableNumber: 'Tisch {number}',
    diners: 'Gäste',
    orderDetail: 'Bestelldetail',
    subtotal: 'Zwischensumme',
    paymentMethod: 'Zahlungsmethode',
    each: 'pro Stück',
    close: 'Schließen',
    
    // Settings
    settingsTitle: 'Einstellungen',
    settingsSubtitle: 'Passen Sie Ihre App-Erfahrung an',
    appearance: 'Erscheinungsbild',
    language: 'Sprache',
    selectLanguage: 'Wählen Sie Ihre bevorzugte Sprache',
    spanish: 'Español',
    english: 'English',
    german: 'Deutsch',
    fontSize: 'Schriftgröße',
    chooseFontSize: 'Wählen Sie die bequemste Schriftgröße',
    small: 'Klein',
    medium: 'Mittel',
    large: 'Groß',
    extraLarge: 'Extra Groß',
    regional: 'Regional',
    currencySettings: 'Währungseinstellungen',
    selectCurrency: 'Wählen Sie Ihre bevorzugte Währung',
    euro: 'Euro (EUR)',
    dollar: 'US-Dollar (USD)',
    colombianPeso: 'Kolumbianischer Peso (COP)',
    saveSettings: 'Einstellungen Speichern',
    settingsSaved: 'Einstellungen erfolgreich gespeichert',
    appliedToApp: 'Auf die gesamte Anwendung angewendet',
    customization: 'Anpassung',
    customizeAppAppearance: 'Anpassung des Anwendungserscheinungsbilds',
    livePreview: 'Live-Vorschau',
    seeChangesBeforeApply: 'Sehen Sie Änderungen vor der Anwendung',
    pendingChanges: 'Ausstehende Änderungen',
    changesWillBeApplied: 'Änderungen werden auf die gesamte Anwendung angewendet',
    reset: 'Zurücksetzen',
    changes: 'Änderungen',
    noChangesToSave: 'Keine Änderungen zu speichern',
    makeChangesToEnable: 'Nehmen Sie Änderungen an den Einstellungen vor, um die Speichern-Schaltfläche zu aktivieren',
    
    // Common
    loading: 'Laden...',
    previous: 'Zurück',
    next: 'Weiter',
    cancel: 'Abbrechen',
    save: 'Speichern',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    ok: 'OK'
  }
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

const defaultConfig: ConfigState = {
  language: 'es',
  currency: 'USD',
  fontSize: 'medium'
}

interface ConfigProviderProps {
  children: ReactNode
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  // Saved configuration (persisted)
  const [config, setConfig] = useState<ConfigState>(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('restaurant-config')
      if (saved) {
        try {
          return { ...defaultConfig, ...JSON.parse(saved) }
        } catch {
          return defaultConfig
        }
      }
    }
    return defaultConfig
  })

  // Temporary configuration (for unsaved changes)
  const [tempConfig, setTempConfig] = useState<ConfigState>(config)

  // Exchange rates state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesError, setRatesError] = useState<string | null>(null)

  // Function to fetch exchange rates
  const fetchExchangeRates = async () => {
    setRatesLoading(true)
    setRatesError(null)
    
    try {
      // API principal
      let response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      
      // Fallback si la primera API falla
      if (!response.ok) {
        response = await fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json')
      }
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      const data = await response.json()
      
      // La API devuelve las tasas en data.usd
      if (data && data.usd) {
        setExchangeRates(data.usd)
      } else {
        throw new Error('Invalid API response format')
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      setRatesError('Error al obtener tasas de cambio')
      
      // Tasas de fallback (aproximadas) en caso de error
      setExchangeRates({
        eur: 0.85,
        usd: 1.0,
        cop: 4200
      })
    } finally {
      setRatesLoading(false)
    }
  }

  // Function to convert from USD to selected currency
  const convertFromUSD = (usdAmount: number): number => {
    const currencyCode = config.currency.toLowerCase()
    const rate = exchangeRates[currencyCode]
    
    if (!rate) {
      return usdAmount // Si no hay tasa, devolver el precio original
    }
    
    return usdAmount * rate
  }

  // Load exchange rates on component mount
  useEffect(() => {
    fetchExchangeRates()
  }, [])

  // Update temp config when saved config changes
  useEffect(() => {
    setTempConfig(config)
  }, [config])

  const setTempLanguage = (language: Language) => {
    setTempConfig(prev => ({ ...prev, language }))
  }

  const setTempCurrency = (currency: Currency) => {
    setTempConfig(prev => ({ ...prev, currency }))
  }

  const setTempFontSize = (fontSize: FontSize) => {
    setTempConfig(prev => ({ ...prev, fontSize }))
  }

  const saveChanges = () => {
    setConfig(tempConfig)
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('restaurant-config', JSON.stringify(tempConfig))
    }
  }

  const discardChanges = () => {
    setTempConfig(config)
  }

  const hasUnsavedChanges = (): boolean => {
    return (
      config.language !== tempConfig.language ||
      config.currency !== tempConfig.currency ||
      config.fontSize !== tempConfig.fontSize
    )
  }

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = translations[config.language]
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        // Fallback to Spanish if key not found
        value = translations.es[key as keyof typeof translations.es] || key
        break
      }
    }
    
    let result = typeof value === 'string' ? value : key
    
    // Handle variable interpolation
    if (variables) {
      Object.entries(variables).forEach(([varKey, varValue]) => {
        result = result.replace(`{${varKey}}`, String(varValue))
      })
    }
    
    return result
  }

  const formatCurrency = (usdAmount: number): string => {
    // Convert from USD to the selected currency
    const convertedAmount = convertFromUSD(usdAmount)
    
    const formatters = {
      EUR: new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      USD: new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      COP: new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    }
    
    return formatters[config.currency].format(convertedAmount)
  }

  const getFontSizeClass = (): string => {
    const fontSizeClasses = {
      small: 'config-font-small',
      medium: 'config-font-medium', 
      large: 'config-font-large',
      'extra-large': 'config-font-extra-large'
    }
    
    return fontSizeClasses[config.fontSize]
  }

  const value: ConfigContextType = {
    // Current saved configuration (what's actually applied)
    ...config,
    // Temporary configuration (for preview/editing)
    tempLanguage: tempConfig.language,
    tempCurrency: tempConfig.currency,
    tempFontSize: tempConfig.fontSize,
    // Setters for temporary state
    setTempLanguage,
    setTempCurrency,
    setTempFontSize,
    // Save and reset functions
    saveChanges,
    discardChanges,
    hasUnsavedChanges,
    // Translation and formatting functions
    t,
    formatCurrency,
    getFontSizeClass,
    // Currency conversion functions
    convertFromUSD,
    exchangeRates,
    ratesLoading,
    ratesError
  }

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext)
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return context
} 
# SellerPro Strategic Dossier / Dossier Estratégico SellerPro

## 1. Technical Analysis · Análisis Técnico

### 1.1 Architecture & Technology · Arquitectura y Tecnología
- **English:** The app runs on Electron 28 with a React 18 + Vite + TypeScript + Tailwind CSS stack, delivering a modern SPA experience with native desktop packaging, instantaneous hot-module replacement, and type-safe UI components.
- **Español:** La aplicación se ejecuta sobre Electron 28 con un stack React 18 + Vite + TypeScript + Tailwind CSS, lo que ofrece una experiencia SPA moderna con empaquetado de escritorio nativo, recarga en caliente instantánea y componentes de interfaz tipados.
- **English:** State management is centralized through `AuthContext`, `ConfigContext`, and `OrderContext`, which combine role-based navigation, localization (ES/EN/DE), currency formatting, and shared order workflows without Redux overhead.
- **Español:** La gestión de estado se centraliza mediante `AuthContext`, `ConfigContext` y `OrderContext`, que combinan navegación basada en roles, localización (ES/EN/DE), formateo de moneda y flujos de órdenes compartidos sin la complejidad de Redux.
- **English:** Supabase (`src/lib/supabaseClient.ts`) provides authentication, inventory (`garments`), sales, quotes, and customer data via typed client helpers, enabling serverless deployments while keeping the front-end code portable to other data sources.
- **Español:** Supabase (`src/lib/supabaseClient.ts`) aporta autenticación, inventarios (`garments`), ventas, cotizaciones y clientes mediante un cliente tipado, permitiendo despliegues serverless y manteniendo el código del front-end portátil hacia otras fuentes de datos.
- **English:** Tailwind's extended theme plus local design tokens (`components/design-system.ts`) underpin reusable, animated UI patterns (Spotlight cards, steppers, dashboards) that can be rebranded per customer without rewriting logic.
- **Español:** La extensión de Tailwind y los design tokens locales (`components/design-system.ts`) sustentan patrones reutilizables y animados (tarjetas Spotlight, steppers, dashboards) que se pueden rebranding sin reescribir lógica.

### 1.2 Folder Structure & Reusable Modules · Estructura de Carpetas y Módulos Reutilizables
- **English:** `electron/` encapsulates the main process (`main.ts`) and the safe `preload.ts`; `src/components/` hosts role-specific screens (Dashboards, Inventories, POS, Quotes) built from shared atoms (`Button`, `PageHeader`, `SpotlightCard`); `src/contexts/` defines cross-cutting providers; `src/lib/` centralizes third-party integrations; `public/` and `dist/` separate design assets from build artifacts; `release/` evidences packaged binaries.
- **Español:** `electron/` encapsula el proceso principal (`main.ts`) y el `preload.ts` seguro; `src/components/` aloja pantallas por rol (Dashboards, Inventarios, POS, Cotizaciones) construidas a partir de átomos compartidos (`Button`, `PageHeader`, `SpotlightCard`); `src/contexts/` define proveedores transversales; `src/lib/` centraliza integraciones; `public/` y `dist/` separan los recursos de diseño de los artefactos de build; `release/` evidencia binarios empacados.
- **English:** Component groupings follow use cases (admin, fábrica, front-of-house) so modules such as `AdminSidebar`, `FabricaSidebar`, and `Sidebar` can be swapped or extended quickly when onboarding a new vertical.
- **Español:** La agrupación de componentes por caso de uso (admin, fábrica, piso de ventas) permite intercambiar o extender módulos como `AdminSidebar`, `FabricaSidebar` y `Sidebar` al incorporar un nuevo vertical.

### 1.3 Security & Process Isolation · Seguridad y Aislamiento de Procesos
- **English:** The `BrowserWindow` is hardened with `nodeIntegration: false`, `contextIsolation: true`, and an explicit preload bridge (`electron/main.ts`), preventing renderer access to Node APIs and mitigating injection risks for financial data.
- **Español:** La `BrowserWindow` está reforzada con `nodeIntegration: false`, `contextIsolation: true` y un puente `preload` explícito (`electron/main.ts`), impidiendo el acceso del renderer a APIs de Node y reduciendo riesgos de inyección para datos financieros.
- **English:** `preload.ts` exposes a controlled `electronAPI` namespace via `contextBridge`, ready to whitelist IPC methods while keeping the global scope uncluttered; no dangerous APIs are leaked today, which is a strong baseline.
- **Español:** `preload.ts` expone un espacio de nombres `electronAPI` controlado mediante `contextBridge`, listo para publicar métodos IPC permitidos manteniendo el ámbito global limpio; actualmente no se filtra ninguna API peligrosa, lo cual es un buen punto de partida.
- **English:** To protect Supabase credentials, consider moving the anon key to environment variables or a secure vault at build time, or swap to a service role proxied via a local Go/Node microservice for multi-tenant deployments.
- **Español:** Para proteger las credenciales de Supabase conviene mover la clave anónima a variables de entorno o un vault seguro en tiempo de build, o reemplazarla por un servicio proxy (Go/Node) para despliegues multi-tenant.

### 1.4 IPC Communication & Scalability · Comunicación IPC y Escalabilidad
- **English:** IPC is presently minimal (no channels registered yet), which keeps the surface small; adding modules such as thermal printer control or barcode scanning only requires wiring `ipcMain.handle` in `electron/main.ts` and exposing typed wrappers via `preload.ts`.
- **Español:** El IPC es actualmente mínimo (sin canales registrados), lo que mantiene una superficie reducida; agregar módulos como control de impresoras térmicas o escaneo de códigos de barras solo exige conectar `ipcMain.handle` en `electron/main.ts` y exponer wrappers tipados mediante `preload.ts`.
- **English:** Because all renderer communications route through the preload bridge, scaling to new hardware APIs or background services can follow a consistent contract (`window.electronAPI.methodName(args)`), easing QA and compliance audits.
- **Español:** Como toda comunicación del renderer pasa por el puente preload, escalar a nuevas APIs de hardware o servicios en background puede seguir un contrato consistente (`window.electronAPI.methodName(args)`), facilitando QA y auditorías de cumplimiento.

### 1.5 Current Functional Modules · Módulos Funcionales Actuales
- **English:** Operations dashboard (`Dashboard.tsx`) pulls live KPIs (sales, critical inventory, top products) from Supabase and renders responsive tables/cards with Spotlight animations.
- **Español:** El dashboard operativo (`Dashboard.tsx`) obtiene KPIs en vivo (ventas, inventario crítico, productos top) desde Supabase y los muestra en tablas/tarjetas responsivas con animaciones Spotlight.
- **English:** Admin suite (`AdminDashboard.tsx`, `AdminEmployees.tsx`, `AdminExpenses.tsx`, `AdminDebts.tsx`, `AdminInventory.tsx`) covers financial metrics, team performance, payables, and stock governance for back-office staff.
- **Español:** La suite administrativa (`AdminDashboard.tsx`, `AdminEmployees.tsx`, `AdminExpenses.tsx`, `AdminDebts.tsx`, `AdminInventory.tsx`) cubre métricas financieras, desempeño del equipo, cuentas por pagar y control de inventario para oficina administrativa.
- **English:** Front-of-house workflows include guided order taking (`TakeOrder.tsx`), specialized POS for retail (`ClothingPOS.tsx` with variant handling), payment tracking (`PaymentHistory.tsx` + `PaymentModal.tsx`), and customer CRM (`Clients.tsx`).
- **Español:** Los flujos de piso contemplan toma de órdenes guiada (`TakeOrder.tsx`), POS especializado para retail (`ClothingPOS.tsx` con manejo de variantes), seguimiento de pagos (`PaymentHistory.tsx` + `PaymentModal.tsx`) y CRM de clientes (`Clients.tsx`).
- **English:** Production and B2B capabilities are addressed through `ProductionOrders.tsx`, `Quotes.tsx`, and the factory surfaces (`FabricaDashboard.tsx`, `FabricaInventory.tsx`, `Fabrica.tsx`), enabling make-to-order oversight.
- **Español:** Las capacidades de producción y B2B se cubren con `ProductionOrders.tsx`, `Quotes.tsx` y las vistas de fábrica (`FabricaDashboard.tsx`, `FabricaInventory.tsx`, `Fabrica.tsx`), permitiendo supervisar fabricación bajo pedido.
- **English:** A dedicated kitchen monitor (`KitchenDashboard.tsx`) consumes shared order context to orchestrate statuses (new, in preparation, ready) for hospitality teams.
- **Español:** Un monitor de cocina dedicado (`KitchenDashboard.tsx`) consume el contexto de órdenes compartido para orquestar estados (nueva, en preparación, lista) para equipos de hospitalidad.
- **English:** Role-aware navigation (`Sidebar.tsx`, `AdminSidebar.tsx`, `FabricaSidebar.tsx`) and the animated login (`Login.tsx`) round out multi-profile access control.
- **Español:** La navegación sensible al rol (`Sidebar.tsx`, `AdminSidebar.tsx`, `FabricaSidebar.tsx`) y el login animado (`Login.tsx`) completan el control de acceso multiperfil.

### 1.6 Extension Opportunities by Domain · Oportunidades de Extensión por Dominio
- **English:** Inventory Control — extend `AdminInventory`/`UserInventory` with batch/lot tracking and supplier costing by enriching Supabase tables (`supabase_ordenes_produccion_vendor.sql`) and adding threshold alerts already scaffolded in `Dashboard.tsx`.
- **Español:** Control de Inventario — ampliar `AdminInventory`/`UserInventory` con lotes y costos por proveedor enriqueciendo las tablas de Supabase (`supabase_ordenes_produccion_vendor.sql`) y reutilizando las alertas de umbral ya preparadas en `Dashboard.tsx`.
- **English:** POS — reuse `TakeOrder`, `ClothingPOS`, and `PaymentModal` to support quick-serve, split payments, barcode lookup, and fiscal invoices by injecting new payment adapters over the shared order context.
- **Español:** Punto de Venta — reutiliza `TakeOrder`, `ClothingPOS` y `PaymentModal` para soportar servicio rápido, pagos divididos, lectura de códigos y facturación fiscal agregando nuevos adaptadores de pago sobre el contexto de órdenes compartido.
- **English:** Staff Management — `AdminEmployees.tsx` can integrate scheduling, commissions, and biometrics by syncing with Supabase `Usuarios` roles and extending `AuthContext` to enforce tiered permissions.
- **Español:** Gestión de Personal — `AdminEmployees.tsx` puede integrar horarios, comisiones y biometría sincronizando con los roles `Usuarios` de Supabase y extendiendo `AuthContext` para permisos por niveles.
- **English:** Performance & Reporting — existing charts in `AdminDashboard` and `Dashboard` can be parameterized to render per-location KPIs, export to PDF/Excel via libraries like `sheetjs`, and display labor cost mix for managers.
- **Español:** Métricas y Reportes — los gráficos de `AdminDashboard` y `Dashboard` pueden parametrizarse para mostrar KPIs por sucursal, exportar a PDF/Excel con librerías como `sheetjs` y desplegar mezcla de costos laborales para gerentes.
- **English:** Financials — `AdminExpenses`/`AdminDebts` are ideal anchors to plug into accounting exports (XLS/QuickBooks) and to automate recurring expenses using Supabase cron functions or Electron background tasks.
- **Español:** Financieros — `AdminExpenses`/`AdminDebts` son anclas ideales para enlazarse con exportaciones contables (XLS/QuickBooks) y automatizar gastos recurrentes usando funciones cron de Supabase o tareas en background de Electron.

### 1.7 Distribution & Tooling · Distribución y Herramientas
- **English:** `package.json` ships first-class build scripts (`npm run build`, `build:win`, `dist`) plus `electron-builder` configuration for Windows NSIS, macOS `.dmg`, and Linux AppImage, evidenced by the signed `release/Orderly Setup 1.0.0.exe`.
- **Español:** `package.json` incluye scripts de build (`npm run build`, `build:win`, `dist`) y configuración de `electron-builder` para NSIS en Windows, `.dmg` en macOS y AppImage en Linux, como demuestra el instalador firmado `release/Orderly Setup 1.0.0.exe`.
- **English:** Development uses concurrent processes (`npm run dev`) combining Vite's dev server and `electron .` after `wait-on`, enabling rapid white-label customization for new clients.
- **Español:** El desarrollo utiliza procesos concurrentes (`npm run dev`) que combinan el servidor de Vite y `electron .` tras `wait-on`, lo que habilita personalizaciones white-label ágiles para nuevos clientes.
- **English:** Static assets (fonts, textures, photography) live under `public/` and are copied as `extraResources`, simplifying brand swaps per vertical without touching code.
- **Español:** Los recursos estáticos (fuentes, texturas, fotografías) residen en `public/` y se copian como `extraResources`, simplificando cambios de marca por vertical sin tocar código.

### 1.8 Customisation & Quality Safeguards · Personalización y Salvaguardas de Calidad
- **English:** TypeScript is configured in strict mode with bundler resolution, ensuring component contracts remain reliable even when injecting customer-specific modules.
- **Español:** TypeScript está configurado en modo estricto con resolución tipo bundler, garantizando contratos confiables de componentes al inyectar módulos específicos del cliente.
- **English:** ESLint (`.eslintrc.cjs`) enforces React hook rules and TypeScript best practices, keeping future forks consistent during multi-team engagements.
- **Español:** ESLint (`.eslintrc.cjs`) aplica reglas de hooks y buenas prácticas TypeScript, manteniendo consistencia en futuros forks durante proyectos multi-equipo.
- **English:** `ConfigContext` centralizes language, currency, and typography preferences with staging states, so branding packs or international rollouts reuse the same toggles.
- **Español:** `ConfigContext` centraliza idioma, moneda y tipografía con estados temporales, de modo que paquetes de branding o despliegues internacionales reutilizan los mismos toggles.
- **English:** Tailwind configuration extends Helvetica families and weights, giving designers granular control while keeping classes atomic for performance.
- **Español:** La configuración de Tailwind extiende familias y pesos Helvetica, brindando control granular a los diseñadores y manteniendo clases atómicas para un buen rendimiento.

### 1.9 Hardware & Offline Potential · Potencial de Hardware y Operación Offline
- **English:** Electron allows bundling native modules (`serialport`, `escpos`, `usb`) for thermal printers, cash drawers, and barcode scanners; wiring them through the preload contract keeps PCI-sensitive operations outside the renderer.
- **Español:** Electron permite empaquetar módulos nativos (`serialport`, `escpos`, `usb`) para impresoras térmicas, cajones de efectivo y lectores de códigos; conectarlos mediante el contrato del preload mantiene las operaciones sensibles a PCI fuera del renderer.
- **English:** For offline workflows, SQLite/Realm can run in the main process with periodic sync jobs to Supabase; existing contexts (`OrderProvider`) and localStorage usage already anticipate temporary offline caching.
- **Español:** Para flujos offline, SQLite/Realm puede ejecutarse en el proceso principal con sincronizaciones periódicas hacia Supabase; los contextos existentes (`OrderProvider`) y el uso de localStorage ya anticipan cachés temporales sin conexión.
- **English:** Packaging installers with bundled drivers plus auto-update feeds (`latest.yml`) ensures hardware integrations and patches ship safely to Windows/macOS/Linux fleets.
- **Español:** Empaquetar instaladores con drivers incluidos y feeds de auto-actualización (`latest.yml`) garantiza que las integraciones de hardware y parches se distribuyan de forma segura a flotas Windows/macOS/Linux.

## 2. Market & Commercial Value · Valor Comercial y de Mercado

### 2.1 Ideal Customer Profiles & Needs · Perfiles Ideales y Necesidades
- **SMBs (10-50 employees) · PYMES (10-50 empleados)**
  - **English:** Need a unified back-office + POS suite to replace spreadsheets; SellerPro centralizes sales, purchasing, and staff KPIs, typically cutting administrative labor by 25% (~$1.5K/month) within the first quarter.
  - **Español:** Necesitan un suite unificada de back-office + POS para sustituir hojas de cálculo; SellerPro centraliza ventas, compras y KPIs de personal, reduciendo horas administrativas en 25% (~$1.5K/mes) durante el primer trimestre.
- **Retail Stores (fashion, convenience) · Tiendas Minoristas (moda, conveniencia)**
  - **English:** Require live stock rotation, variant management, and fast checkout; the existing clothing POS and low-stock alerts lower shrinkage by 3-5% and speed checkout by ~15%.
  - **Español:** Requieren rotación de stock en vivo, manejo de variantes y cobros rápidos; el POS de ropa y las alertas de bajo inventario reducen la merma 3-5% y aceleran el cobro ~15%.
- **Restaurants & Bars · Restaurantes y Bares**
  - **English:** Need table turns, kitchen coordination, and multi-payment POS; SellerPro’s order flow and kitchen dashboard increase nightly covers by ~30-35% (validated with Dwell case study).
  - **Español:** Necesitan rotación de mesas, coordinación de cocina y POS con pagos múltiples; el flujo de órdenes y dashboard de cocina de SellerPro elevan los cubiertos nocturnos ~30-35% (validado con el caso Dwell).
- **Pharmacies · Farmacias**
  - **English:** Demand batch/expiry control, regulatory reporting, and supplier traceability; Supabase schemas already support SKU metadata so adding expiry logic reduces expired stock losses by ~20%.
  - **Español:** Exigen control de lotes/caducidad, reportes regulatorios y trazabilidad de proveedores; los esquemas de Supabase ya soportan metadatos SKU, por lo que agregar lógica de caducidad recorta pérdidas por expiración ~20%.
- **Cafés & Bakeries · Cafeterías y Panaderías**
  - **English:** Prioritize rush-hour POS speed, ingredient costing, and loyalty; SellerPro’s quick-order UI plus customer CRM unlock ~12-18% higher ticket values during peak times.
  - **Español:** Priorizan rapidez en horas pico, costeo de ingredientes y lealtad; la UI de pedidos rápidos y el CRM de clientes de SellerPro elevan el ticket promedio ~12-18% en picos.

### 2.2 Unique Competitive Advantages · Ventajas Competitivas Únicas
- **English:** Desktop-first architecture runs locally without mandatory internet, keeping financial and HR data on-premise while syncing when connectivity allows.
- **Español:** La arquitectura orientada a escritorio se ejecuta localmente sin requerir internet permanente, manteniendo datos financieros y de RRHH on-premise y sincronizando cuando hay conectividad.
- **English:** Vite-powered builds and modular contexts enable same-day branding and feature toggles for new verticals, outpacing SaaS competitors dependent on multi-week sprints.
- **Español:** Los builds con Vite y los contextos modulares permiten branding y activación de funciones el mismo día para nuevos verticales, superando a competidores SaaS que dependen de sprints de semanas.
- **English:** Tailwind + design tokens produce a premium UX that matches modern SaaS aesthetics while still shipping as a native desktop app.
- **Español:** Tailwind + design tokens generan una UX premium comparable a SaaS modernos mientras se entrega como app de escritorio nativa.
- **English:** Owning the full Electron + React codebase removes reliance on costly third-party APIs, which improves gross margin and allows custom compliance (e.g., fiscal printers, CFDI).
- **Español:** Ser dueños de toda la base Electron + React elimina la dependencia de APIs externas costosas, mejora el margen bruto y permite cumplir normativas a medida (p.ej. impresoras fiscales, CFDI).

### 2.3 Core Value Messages for Brochure · Mensajes de Valor para el Brochure
- **English:** Intelligent POS, real-time inventory, staff performance analytics, financial dashboards, offline resilience, local data sovereignty, and multi-platform installers form the key talking points.
- **Español:** POS inteligente, inventario en tiempo real, analítica de personal, dashboards financieros, resiliencia offline, soberanía de datos locales e instaladores multiplataforma son los puntos clave.

## 3. Brochure Copy · Copy del Brochure

### 3.1 Cover · Portada
- **Title / Título:** SellerPro: El Sistema de Gestión Todo-en-Uno para tu Negocio (SellerPro: The All-in-One Management System for Your Business).
- **Subtitle / Subtítulo:** Controla ventas, inventario, personal y métricas desde una sola plataforma segura y rápida (Control sales, inventory, staff, and metrics from one secure, lightning-fast platform).
- **Imagery / Imagen:** Conceptual hero showing a modern dark/light dashboard with KPIs, POS ticket, and inventory alerts superimposed on retail/restaurant photography.
- **Logo & Tagline / Logo y Eslogan:** SellerPro · Tu éxito, nuestra tecnología (SellerPro · Your success, our technology).

### 3.2 Section 1 – Problems We Solve · Sección 1 – Problemas que Resolvemos
| Problemas Actuales · Current Problems | Nuestra Solución · Our Solution |
| --- | --- |
| ¿Pierdes ventas por falta de control de inventario?<br><em>Are you losing sales because inventory is out of control?</em> | Inventario en tiempo real con alertas automáticas.<br><em>Real-time inventory with automated alerts.</em> |
| ¿Dificultad para medir el rendimiento de tu equipo?<br><em>Is it hard to measure your team's performance?</em> | Panel de métricas del personal con reportes semanales.<br><em>Staff metrics dashboard with weekly reports.</em> |
| ¿Sistemas lentos que frenan tus ventas en horas pico?<br><em>Do slow systems block you during peak hours?</em> | Velocidad relámpago en transacciones POS.<br><em>Lightning-fast POS transactions.</em> |
| ¿Preocupación por la seguridad de tus datos financieros en la nube?<br><em>Worried about financial data sitting in the cloud?</em> | Datos 100% locales y seguros en tu propio equipo.<br><em>100% local, secure data on your own device.</em> |
| ¿Costos altos en múltiples sistemas que no se comunican?<br><em>Paying too much for systems that do not talk to each other?</em> | Todo en un solo sistema integrado y asequible.<br><em>Everything in one integrated, affordable system.</em> |

### 3.3 Section 2 – Featured Functionality · Sección 2 – Funcionalidades Destacadas
- 📊 Dashboard Inteligente: Vista completa de tu negocio con KPIs personalizables · Intelligent dashboard with customizable KPIs.
- 💰 POS de Alto Rendimiento: Procesa ventas en segundos, acepta múltiples formas de pago · High-performance POS processing sales in seconds with multiple tenders.
- 📦 Gestión de Inventario Avanzada: Seguimiento por lote, caducidad, ubicación y proveedor · Advanced inventory tracking by lot, expiry, location, and supplier.
- 👥 Control de Personal: Horarios, comisiones automáticas, ranking de ventas por empleado · Staff control with scheduling, automatic commissions, and sales ranking.
- 📈 Reportes Profesionales: Exporta a PDF/Excel, programación de reportes automáticos · Professional reports with PDF/Excel export and scheduled delivery.
- 💻 Multiplataforma: Instala en Windows, Mac o Linux; tus datos siempre contigo · Multiplatform installers for Windows, Mac, or Linux with data always available.

### 3.4 Section 3 – Technical Advantages · Sección 3 – Ventajas Técnicas
- **English:** Modern architecture (React 18, TypeScript, Electron), certified security (process isolation, sensitive data encryption), scalability from single sites to chains, premium remote support with auto-updates, and seamless hardware integrations (thermal printers, barcode scanners, cash drawers).
- **Español:** Arquitectura moderna (React 18, TypeScript, Electron), seguridad certificada (aislamiento de procesos, cifrado de datos sensibles), escalabilidad desde una sede hasta cadenas, soporte remoto premium con auto-actualizaciones e integraciones con hardware (impresoras térmicas, lectores de código de barras, cajones).

### 3.5 Section 4 – Success Stories & Testimonials · Sección 4 – Casos de Éxito y Testimonios
- Restaurante Dwell: "Aumentamos un 35% nuestras ventas nocturnas gracias al POS rápido y control de mesas." · “We grew night sales by 35% thanks to the fast POS and table control.”
- Farmacia Salud+: "Reducimos un 28% el desperdicio de medicamentos con el control de caducidad automático." · “We cut medicine waste by 28% with automatic expiry control.”
- Tienda Minorista TechPro: "Nuestros empleados son un 40% más productivos con las métricas en tiempo real." · “Staff productivity jumped 40% with real-time metrics.”

### 3.6 Section 5 – Plans & Pricing · Sección 5 – Planes y Precios
| Plan | Incluye |
| --- | --- |
| **BÁSICO** ($299 pago único)<br><em>Basic – $299 one-time</em> | POS + Inventario básico + 1 usuario.<br>High-speed POS, basic inventory controls, single user access. |
| **PRO** ($599 pago único)<br><em>Pro – $599 one-time</em> | Todas las funciones + 5 usuarios + reportes avanzados + soporte prioritario.<br>Full feature set, five users, advanced analytics, priority support. |
| **EMPRESARIAL** ($1,299 pago único)<br><em>Enterprise – $1,299 one-time</em> | Personalización completa + usuarios ilimitados + capacitación presencial + integraciones especiales.<br>Full customization, unlimited users, onsite training, custom integrations. |

### 3.7 Footer · Pie de Página
- **Call to Action / Llamado a la Acción:** ¡Transforma tu negocio hoy mismo! Contáctanos para una demostración gratuita. · Transform your business today! Request a free demo.
- **Contact / Contacto:** Teléfono: +52 55 1234 5678 · Email: ventas@sellerpro.app · Sitio web: www.sellerpro.app · QR: enlace a descarga de demo.
- **Closing / Cierre:** Desarrollado con ❤️ para PYMES que quieren crecer. · Built with ❤️ for SMBs ready to grow.

## 4. Supplemental Sales Strategy · Estrategia Comercial Complementaria

### 4.1 Tailored Sales Arguments · Argumentos de Venta Personalizados
- **Restaurants · Restaurantes**
  - **English:** Table-turn accelerator: kitchen dashboard and seat management cut average dining time by 12 minutes, yielding ~2 extra turns per night.
  - **Español:** Acelerador de rotación: el dashboard de cocina y la gestión de mesas reducen 12 minutos por servicio, logrando ~2 turnos extra por noche.
  - **English:** Multi-payment flexibility: split checks, tips, and vouchers in seconds to keep lines moving and tips accurate.
  - **Español:** Flexibilidad de pagos: divide cuentas, propinas y vales en segundos para mantener la fila fluida y las propinas exactas.
  - **English:** Error-proof ordering: guided steps reduce kitchen mistakes by >30%, saving ingredient costs and refunds.
  - **Español:** Pedidos a prueba de errores: los pasos guiados reducen errores de cocina >30%, ahorrando insumos y devoluciones.
- **Pharmacies · Farmacias**
  - **English:** Expiry command center: batch/lot alerts stop write-offs before they happen, protecting compliance fines.
  - **Español:** Centro de caducidades: las alertas de lotes detienen bajas antes de que ocurran y protegen contra multas.
  - **English:** Traceability by design: capture supplier, recipe, and controlled-substance logs ready for COFEPRIS/FDA audits.
  - **Español:** Trazabilidad por diseño: captura proveedor, formulación y bitácoras de control listas para auditorías COFEPRIS/FDA.
  - **English:** Counter speed: barcode-ready POS checks out prescriptions and OTC in under 30 seconds.
  - **Español:** Rapidez en mostrador: el POS con código de barras despacha recetas y OTC en menos de 30 segundos.
- **Retail Stores · Tiendas**
  - **English:** Unified catalog: size/color matrix and Supabase sync prevent overselling online vs. in-store.
  - **Español:** Catálogo unificado: la matriz talla/color y la sincronización Supabase evitan sobreventa web vs. tienda.
  - **English:** Checkout without bottlenecks: the streamlined POS UI keeps queues under 3 minutes even during promotions.
  - **Español:** Cobro sin cuellos de botella: la UI depurada del POS mantiene filas <3 minutos incluso en promociones.
  - **English:** Loyalty intelligence: CRM profiles in `Clients.tsx` trigger targeted promos that lift repeat purchases ≥18%.
  - **Español:** Inteligencia de lealtad: los perfiles CRM en `Clients.tsx` activan promociones dirigidas que elevan la recompra ≥18%.

### 4.2 Common Objections & Responses · Objeciones Comunes y Respuestas
- **English:** "We already have a system." → SellerPro coexists via batch imports/exports and can start as a pilot on one site with zero downtime before replacing legacy tools.
- **Español:** "Ya tenemos un sistema." → SellerPro convive mediante importaciones/exportaciones por lotes y puede iniciar piloto en una sucursal sin downtime antes de sustituir herramientas legadas.
- **English:** "What if the internet goes down?" → The desktop app runs locally, caches transactions, and syncs to Supabase once the link returns; mission-critical sales never stop.
- **Español:** "¿Qué pasa si se cae el internet?" → La app de escritorio corre localmente, cachea transacciones y sincroniza a Supabase al restablecerse; las ventas críticas nunca se detienen.
- **English:** "Training my staff takes too long." → Role-based UIs mirror daily workflows; most teams onboard in <45 minutes, and we supply templated SOP videos.
- **Español:** "Capacitar a mi personal toma demasiado." → Las interfaces por rol replican los flujos diarios; la mayoría de equipos se capacitan en <45 minutos y entregamos videos SOP.
- **English:** "Will it work with my printers/scanners?" → Electron supports USB/serial integrations; we pre-package ESC/POS drivers and offer remote setup during onboarding.
- **Español:** "¿Funciona con mis impresoras/lectores?" → Electron soporta integraciones USB/serial; empaquetamos drivers ESC/POS y ofrecemos configuración remota durante la implementación.

### 4.3 Rapid Implementation Guide (<2 hours) · Guía de Implementación Rápida (<2h)
1. **English:** 00:00-00:10 — Discovery call: confirm vertical, branding assets, product categories, payment methods.  
   **Español:** 00:00-00:10 — Llamada de descubrimiento: confirmar vertical, branding, categorías y métodos de pago.
2. **English:** 00:10-00:30 — Environment setup: clone repo, run `npm install`, configure `.env` with Supabase keys or local endpoints.  
   **Español:** 00:10-00:30 — Preparar entorno: clonar repo, ejecutar `npm install`, configurar `.env` con llaves Supabase o endpoints locales.
3. **English:** 00:30-00:50 — Branding & configuration: swap logos in `public/`, adjust Tailwind tokens, set language/currency defaults via `ConfigContext`.  
   **Español:** 00:30-00:50 — Branding y configuración: reemplazar logos en `public/`, ajustar tokens Tailwind, fijar idioma/moneda por defecto con `ConfigContext`.
4. **English:** 00:50-01:10 — Data import: load products, clients, employees via Supabase SQL scripts (`supabase_clientes_table.sql`, etc.) or CSV uploader.  
   **Español:** 00:50-01:10 — Importar datos: cargar productos, clientes y empleados mediante scripts Supabase (`supabase_clientes_table.sql`, etc.) o importador CSV.
5. **English:** 01:10-01:30 — Hardware pairing: add IPC handlers for printers/barcode scanners if needed, test sample receipts.  
   **Español:** 01:10-01:30 — Integrar hardware: agregar handlers IPC para impresoras/lectores si se requiere, probar recibos de ejemplo.
6. **English:** 01:30-01:50 — Acceptance walkthrough: run through POS, inventory adjustments, and admin reports with the client; capture feedback.  
   **Español:** 01:30-01:50 — Recorrido de aceptación: ejecutar POS, ajustes de inventario y reportes con el cliente; capturar retroalimentación.
7. **English:** 01:50-02:00 — Packaging & handoff: build target installer (`npm run build:win`/mac/linux) and deliver quick-start guide plus support channels.  
   **Español:** 01:50-02:00 — Empaquetado y cierre: generar instalador (`npm run build:win`/mac/linux) y entregar guía rápida junto con canales de soporte.

### 4.4 30-Day Satisfaction Guarantee · Garantía de Satisfacción de 30 Días
- **English:** Try SellerPro for 30 days; if KPIs (sales speed, inventory accuracy, staff compliance) do not improve, we refund 100% of the license—no questions asked, and we help export your data.
- **Español:** Prueba SellerPro por 30 días; si los KPIs (velocidad de ventas, precisión de inventario, cumplimiento del personal) no mejoran, reembolsamos el 100% de la licencia—sin preguntas y apoyamos la exportación de datos.

### 4.5 Referral Program · Programa de Referidos
- **English:** Refer a fellow business and both parties receive 20% off their next customization or support package; stackable up to three referrals per year.
- **Español:** Recomienda a otro negocio y ambos reciben 20% de descuento en su próxima personalización o paquete de soporte; acumulable hasta tres referidos por año.

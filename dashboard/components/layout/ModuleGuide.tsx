type ModuleGuideProps = {
  whatThisDoes: string;
  whatToTry: string;
  walletHint?: string;
};

function normalizeKey(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function ModuleGuide({ whatThisDoes, whatToTry, walletHint }: ModuleGuideProps) {
  const keyWhat = normalizeKey(whatThisDoes);
  const keyTry = normalizeKey(whatToTry);
  const keyWallet = walletHint ? normalizeKey(walletHint) : "";

  const translatedWhat =
    {
      "This module is the global health dashboard for sync, quality, alerts, and service readiness.":
        "Este modulo es el dashboard global de salud para sincronizacion, calidad, alertas y estado de servicios.",
      "This module exposes AMM and orderbook market activity from the running engine state.":
        "Este modulo muestra actividad de mercado AMM y orderbook desde el estado activo del engine.",
      "This module simulates an OTC lifecycle: RFQ creation, quote submission, acceptance, and settlement.":
        "Este modulo simula un ciclo OTC: creacion de RFQ, envio de cotizacion, aceptacion y liquidacion.",
      "This module manages bridge job queues and approvals between BPVP assets and external networks.":
        "Este modulo gestiona colas de jobs de bridge y aprobaciones entre activos BPVP y redes externas.",
      "This module shows BPVP20 balances and supply, and lets you test transfer/burn actions.":
        "Este modulo muestra balances y supply de BPVP20, y permite probar transferencias y burns.",
      "This module manages BPVP721 assets in-engine: mint, transfer, and metadata updates.":
        "Este modulo gestiona activos BPVP721 en engine: mint, transferencia y actualizacion de metadatos.",
      "This module stores and displays trust scores/ratings for desks or counterparties.":
        "Este modulo guarda y muestra puntajes/calificaciones de confianza para desks o contrapartes.",
      "This module tracks lending pools, APY snapshots, and simulated borrow positions.":
        "Este modulo rastrea pools de lending, snapshots de APY y posiciones simuladas de prestamo.",
      "This module records payment and liquidation settlement confirmations in the engine ledger.":
        "Este modulo registra confirmaciones de liquidacion de pagos y liquidaciones en el ledger del engine.",
      "This module shows your active session, role, and backend integration readiness.":
        "Este modulo muestra tu sesion activa, rol y estado de integracion del backend.",
      "This module provides public system explanations and testing documentation.":
        "Este modulo provee explicaciones publicas del sistema y documentacion de pruebas.",
      "This module powers direct token marketplace activity: listings, matching trades, and settlement-ready records.":
        "Este modulo habilita mercado directo de tokens: listings, matching de trades y registros listos para liquidacion.",
      "This module manages decentralized identities, verifiable credentials, verification checks, and revocation workflow controls.":
        "Este modulo gestiona identidades descentralizadas, credenciales verificables, verificaciones y controles de revocacion."
    }[keyWhat] ?? whatThisDoes;

  const translatedTry =
    {
      "Start here, confirm all core health cards are stable, then move to specific modules (Market, BPVP20, OTC, etc.) for action tests.":
        "Comienza aqui, confirma que las tarjetas principales de salud esten estables y luego pasa a modulos especificos (Mercado, BPVP20, OTC, etc.).",
      "Review liquidity, place small test swaps/orders, and confirm state updates without errors.":
        "Revisa liquidez, ejecuta swaps/ordenes de prueba pequenas y confirma actualizaciones de estado sin errores.",
      "Create one RFQ, submit at least one quote, accept a quote into a trade, then settle that trade.":
        "Crea un RFQ, envia al menos una cotizacion, acepta una cotizacion como trade y luego liquidalo.",
      "Enqueue one test job, move it through approval/submission/confirmation states, and verify it appears in the bridge queue.":
        "Encola un job de prueba, muevelo por aprobacion/envio/confirmacion y verifica que aparezca en la cola de bridge.",
      "Run small transfers between test accounts, then validate updated balances and unchanged total supply expectations.":
        "Ejecuta transferencias pequenas entre cuentas de prueba y valida balances actualizados y expectativas de supply.",
      "Mint one NFT, transfer it to another test account, and update one metadata key to confirm state transitions.":
        "Haz mint de un NFT, transfierelo a otra cuenta de prueba y actualiza una clave de metadatos para confirmar transiciones.",
      "Add a few score updates with different ratings and verify they appear correctly in the score list and history.":
        "Agrega algunas actualizaciones de puntaje con distintas calificaciones y verifica que aparezcan correctamente.",
      "Create one or more borrow positions and confirm pool/position values and APY views update as expected.":
        "Crea una o mas posiciones de prestamo y confirma que valores de pool/posicion y APY se actualicen como se espera.",
      "Submit sample settlement IDs for payment and liquidation and verify they appear in records and raw tails.":
        "Envia IDs de liquidacion de ejemplo para pago y liquidacion y verifica que aparezcan en registros.",
      "Confirm your tester username/role, then use the wallet linking steps below if you need signed wallet identity in tests.":
        "Confirma tu usuario/rol de tester y usa los pasos de vinculacion de wallet si necesitas identidad firmada.",
      "Start with System Synopsis, then review Protocol Spec and execute related checks in product modules.":
        "Empieza con System Synopsis, luego revisa Protocol Spec y ejecuta pruebas relacionadas en los modulos.",
      "Create one listing, execute a partial or full trade, and confirm quantity/status updates in real time.":
        "Crea un listing, ejecuta un trade parcial o total y confirma actualizaciones de cantidad/estado en tiempo real.",
      "Create one DID identity, issue one credential, verify it, and then test revocation governance controls.":
        "Crea una identidad DID, emite una credencial, verificala y luego prueba controles de revocacion."
    }[keyTry] ?? whatToTry;

  const translatedWallet =
    {
      'Wallet linking is optional for UI testing. If needed, link a wallet from "Profile" first.':
        'La vinculacion de wallet es opcional para pruebas UI. Si la necesitas, vincula una wallet desde "Perfil".',
      'Use desk/test identities in forms. Wallet linking is available in "Profile" and not required for basic OTC tests.':
        'Usa identidades desk/test en formularios. La vinculacion de wallet esta disponible en "Perfil" y no es obligatoria para OTC basico.',
      'Bridge forms are operator-style simulation tools. Wallet linking is optional and can be done in "Profile".':
        'Los formularios de bridge son herramientas de simulacion operativa. La vinculacion de wallet es opcional y se hace en "Perfil".',
      'No wallet is required for basic token simulation. For identity-linked tests, connect wallet from "Profile".':
        'No se requiere wallet para simulacion basica de tokens. Para pruebas con identidad, conecta wallet desde "Perfil".',
      'Wallet linking can be used for identity context, but core BPVP721 test actions work with test account strings.':
        'La vinculacion de wallet puede usarse para contexto de identidad, pero las acciones BPVP721 funcionan con cuentas de prueba.',
      'Wallet linking is optional and available in "Profile" if your testing flow needs wallet identity.':
        'La vinculacion de wallet es opcional y esta disponible en "Perfil" si tu flujo de pruebas la necesita.',
      'Wallet linking is not mandatory for lend simulation tests; use "Profile" only if you need wallet-attached sessions.':
        'La vinculacion de wallet no es obligatoria para pruebas de lending; usa "Perfil" solo si necesitas sesion vinculada.',
      'Wallet link is optional. Use "Profile" if your test scenario requires attaching a wallet address to session.':
        'El enlace de wallet es opcional. Usa "Perfil" si tu escenario requiere adjuntar direccion de wallet a la sesion.',
      "Wallet linking exists via API endpoints today. A wallet can be attached to your session after challenge-sign-verify flow.":
        "La vinculacion de wallet existe via endpoints API. Una wallet puede adjuntarse a tu sesion tras el flujo challenge-sign-verify.",
      "Wallet link details are documented in Profile and auth endpoints, not in this docs viewer.":
        "Los detalles de vinculacion de wallet estan documentados en Perfil y endpoints de auth, no en este visor.",
      "For internal tests, use desk/user identifiers. External clients consume the same flow via public marketplace integration APIs.":
        "Para pruebas internas usa identificadores desk/usuario. Clientes externos consumen el mismo flujo via APIs publicas de integracion marketplace.",
      "Use wallet-linked identity from Profile when needed; DID records and credentials remain policy-controlled through admin/risk roles.":
        "Usa identidad vinculada por wallet desde Perfil cuando sea necesario; los registros DID y credenciales permanecen bajo politica admin/risk."
    }[keyWallet] ?? walletHint;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm">
      <p className="text-slate-300">
        <span className="font-semibold text-slate-100 bpvp-i18n-en">What this module does:</span>
        <span className="font-semibold text-slate-100 bpvp-i18n-es">Que hace este modulo:</span>{" "}
        <span className="bpvp-i18n-en">{whatThisDoes}</span>
        <span className="bpvp-i18n-es">{translatedWhat}</span>
      </p>
      <p className="mt-2 text-slate-300">
        <span className="font-semibold text-slate-100 bpvp-i18n-en">What you should do in testnet:</span>
        <span className="font-semibold text-slate-100 bpvp-i18n-es">Que debes hacer en testnet:</span>{" "}
        <span className="bpvp-i18n-en">{whatToTry}</span>
        <span className="bpvp-i18n-es">{translatedTry}</span>
      </p>
      {walletHint ? (
        <p className="mt-2 text-slate-400">
          <span className="font-semibold text-slate-300 bpvp-i18n-en">Wallet note:</span>
          <span className="font-semibold text-slate-300 bpvp-i18n-es">Nota de wallet:</span>{" "}
          <span className="bpvp-i18n-en">{walletHint}</span>
          <span className="bpvp-i18n-es">{translatedWallet}</span>
        </p>
      ) : null}
    </div>
  );
}

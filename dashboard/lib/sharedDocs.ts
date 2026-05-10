/**
 * Paquete público (~8) para cualquier sesión autenticada: libro blanco, sinopsis,
 * descentralización/gobernanza, conflictos, Q&A módulos, UTXO, precios, superficie API.
 * El agente no-admin solo indexa estos archivos.
 */
export const SHARED_DOCS_FILENAMES = [
  "WHITEPAPER_BPVP.md",
  "PROTOCOL_SYNOPSIS_BPVP.md",
  "DECENTRALIZATION_GOVERNANCE_BPVP.md",
  "CONFLICT_RESOLUTION_BPVP.md",
  "MODULE_QA_OVERVIEW_BPVP.md",
  "UTXO_COLLISIONS_AND_ACCOUNTING_BPVP.md",
  "PRICING_BPVP.md",
  "PUBLIC_READ_ONLY_ACCESS.md"
] as const;

export const SHARED_DOCS_FILE_SET = new Set<string>(SHARED_DOCS_FILENAMES);

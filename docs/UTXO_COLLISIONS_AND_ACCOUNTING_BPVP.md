# Colisiones UTXO y contabilidad (notas)

## Contexto Bitcoin

Las transacciones consumen UTXOs explícitos; **no** hay balance “por cuenta” nativo en cadena salvo lo modelado por contratos/off-chain state.

## Colisiones / ambigüedad

- **Doble gasto**: la red rechaza conflictos según reglas de consenso; el índice debe seguir la cadena canónica.
- **Reorgs**: cambios de altura pueden invalidar vistas recientes; el producto expone **lag** y **calidad** como señales operativas.

## BPVP Suite

El motor registra **acciones** y estados de negocio; la correspondencia con UTXOs concretos depende del diseño de cada módulo (metapares bpvp*, envelope OP_RETURN cuando aplique).

## Advertencia

Estas notas son **educativas** para testnet; no sustituyen auditoría de protocolo ni modelado económico.

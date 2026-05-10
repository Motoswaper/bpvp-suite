# BPVP Suite — Libro blanco (resumen ejecutivo)

## Propósito

BPVP Suite es una capa operativa Bitcoin-native para ejecución de mercado, identidad verificable, confianza, préstamos y liquidación con trazabilidad auditable sobre Bitcoin L1.

## Alcance

- **Bitcoin-native**: eventos canónicos y políticas de admisión alineadas con el modelo UTXO y la verificación en tiempo de indexación.
- **Modular**: mercado (AMM/orderbook), OTC, DID, trust, lending, settlement — cada módulo expone acciones de motor con políticas de rol.
- **Testnet-first**: el entorno público de validación prioriza seguridad operativa y límites explícitos frente a custodia productiva.

## Principios de diseño

1. Separación entre **superficie pública de solo lectura** y **acciones privilegiadas** (sesión, roles, step-up donde aplique).
2. **No promesa de rendimiento**: métricas y KPI son para control operativo y calidad de sincronización, no asesoramiento financiero.
3. **Extensibilidad por versión de esquema** de eventos en cadena / motor sin romper compatibilidad sin política explícita.

## Lecturas relacionadas

- `PROTOCOL_SYNOPSIS_BPVP.md` — sinopsis técnica del protocolo de eventos.
- `PUBLIC_READ_ONLY_ACCESS.md` — límites de APIs públicas sin cuenta.

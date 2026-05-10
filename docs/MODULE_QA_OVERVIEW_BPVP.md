# Q&A por módulo (visión general)

## Market / AMM / Orderbook

- **Qué prueba**: swaps/órdenes pequeñas, liquidez simulada, actualización de estado sin errores.
- **Riesgos típicos**: parámetros de pool, tokens de prueba, límites de tamaño en testnet.

## OTC

- **Flujo**: RFQ → cotización → trade → settlement marcado en motor.
- **Identidades**: usar cuentas desk/test del motor; wallet opcional desde Profile.

## DID / credenciales

- Creación de identidad, emisión, verificación y revocación — **gobernanza** restringida a roles admin/política.

## Trust / Lend / Settle

- Trust: puntajes y historial simulado.
- Lend: pools y posiciones de prueba.
- Settle: registros de liquidación/pago para auditoría de flujo.

## Puente / wallet

- Integraciones dependen del modo bridge habilitado en el entorno; no asumir disponibilidad en todos los despliegues testnet.

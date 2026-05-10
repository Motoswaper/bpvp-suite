# Descentralización y gobernanza — dilemas de centralización

## Dilema operativo

En sistemas DeFi sobre Bitcoin coexisten:

- **Descentralización fuerte en verificación**: nodos, indexación y pruebas criptográficas pueden distribuirse.
- **Centralización operativa inevitable en la práctica**: despliegues, claves de servicio, políticas de incidentes y roles admin concentran capacidad de cambio.

BPVP Suite documenta explícitamente esa tensión para **no confundir** “descentralización de lectura” con “ausencia de control operativo”.

## Qué centraliza el producto (testnet)

- Políticas de **rol** (viewer / trader / admin) y límites de API.
- **Runbooks** y gates de release (material admin separado del paquete público de lectura).
- Configuración de **puentes / watchers / motor** en el entorno desplegado.

## Camino de endurecimiento

1. Separación de secretos y rotación documentada (políticas audit-only donde aplique).
2. Step-up para acciones sensibles en panel admin.
3. Superficie pública acotada (`PUBLIC_READ_ONLY_ACCESS.md`).

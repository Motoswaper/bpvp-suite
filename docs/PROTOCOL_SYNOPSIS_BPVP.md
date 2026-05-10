# Sinopsis del protocolo BPVP

## Visión general

El protocolo de capa BPVP describe cómo los **eventos de motor** (órdenes, swaps, actualizaciones de trust, liquidaciones, etc.) se representan, validan y persisten de forma **determinista** respecto al estado del índice y del motor.

## Envelope y admisión

- Los productores emiten acciones tipadas por **módulo** y **tipo** con payload JSON validado.
- El índice / motor rechazan versiones de esquema no soportadas, módulos desconocidos y payloads incompletos.
- La superficie pública documentada en `PUBLIC_READ_ONLY_ACCESS.md` **no** sustituye una revisión de políticas internas de despliegue.

## Módulos canónicos (referencia)

Los nombres canónicos de módulos en producto incluyen metapares tipo **bpvp20** / **bpvp721** y subsistemas market / OTC / DID / trust / lend / settle según despliegue.

## Profundidad

Para el formato de sobre OP_RETURN / envelope JSON en cadena (cuando aplique al diseño AXE/BPVP enlazado), consultar el spec técnico del monorepo hermano y las políticas de versión activas en tu entorno.

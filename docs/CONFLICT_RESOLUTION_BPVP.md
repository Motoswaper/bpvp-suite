# Resolución de conflictos y disputas (marco)

## Objetivo

Definir un marco **no vinculante** para priorizar evidencia y reduce ambigüedad cuando hay:

- divergencias de estado entre índice / motor / watcher,
- órdenes o trades con datos contradictorios en testnet,
- disputas de identidad DID / credenciales revocadas.

## Orden sugerido de evidencia

1. **Registro append-only** del motor e historial de acciones auditables.
2. **Alturas y checkpoints** del índice frente al objetivo de cadena (lag, calidad).
3. **Credenciales verificables** y estado de revocación en rutas DID públicas cuando aplique.
4. **Intervención manual admin** solo con política de incidente y trazabilidad (ver docs solo-admin de IR si están habilitadas).

## Testnet

En testnet no hay arbitraje legal ni custodia productiva; este marco es para **coordinación técnica** y ensayo de procedimientos.

# Instrucciones para continuar el proyecto

## Prioridad de fuentes

- La investigación del equipo en MD será la referencia prioritaria de intención una vez recibida y cotejada.
- El anteproyecto y plan académico definen el marco entregado; confirmar con Enfermería lo que esos documentos dejan pendiente.
- El código y las migraciones describen el comportamiento actual, no necesariamente el comportamiento deseado.
- El usuario retiró `PLAN_TRABAJO/` y `docs/` de este checkout y conserva esos documentos fuera del repositorio. No recrearlos ni versionarlos sin solicitud explícita.
- Registrar en `DECISIONES.md` las discrepancias que afecten decisiones técnicas; los detalles de seguimiento siguen en la copia externa del usuario.

## Calidad de implementación

- Mantener TypeScript estricto, tipos útiles y límites claros entre rutas, UI, dominio y persistencia.
- Validar entradas en servidor; la validación del navegador mejora la experiencia, pero no concede permisos.
- Autorizar cada operación sobre el recurso solicitado en servidor y reforzar con RLS. Nunca confiar solo en rutas ocultas, botones ni identificadores difíciles de adivinar.
- Diseñar operaciones de inventario y despacho para mantener consistencia bajo concurrencia y preservar el historial.
- Minimizar datos personales en consultas, errores, registros y capturas. Usar datos ficticios o anonimizados.
- Usar migraciones nuevas para cambios de base de datos; no reescribir una migración aplicada sin acordarlo y evaluar impacto.
- Mantener la interfaz alineada con los wireframes y decisiones visuales existentes. Cambios de patrón visual requieren una decisión registrada.
- Escribir comentarios solo cuando aclaren una razón o una limitación que el código no comunique. Usar voz directa de desarrollo; evitar relleno, promesas no verificables y explicaciones que repitan la implementación.
- No declarar terminado un criterio sin evidencia reproducible. No afirmar que se ejecutaron verificaciones que no se ejecutaron.

## Cierre obligatorio de cada bloque

Añadir una entrada a `BITACORA/AAAA-MM-DD.md`, registrar decisiones duraderas y dejar `SIGUIENTE_PASO.md` con una acción concreta. El plan y su porcentaje viven fuera de este checkout; no inventar métricas ni recrear esas carpetas. Anotar comandos/verificaciones y su salida resumida. Conservar el trabajo previo y evitar cambios de alcance silenciosos.

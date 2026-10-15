# Siguiente paso

1. Publicar los commits revisados en `main` para activar Vercel.
2. Cuando termine el despliegue, comprobar la URL de Vercel, `/login`, sesión, recuperación de contraseña y conexión con Supabase usando cuentas y datos de prueba.
3. Actualizar la copia externa de la guía de endpoints con la URL, commit y resultado del smoke test; el usuario conserva esa documentación fuera del repositorio.
4. Continuar la validación de reglas pendientes con Enfermería antes de usar datos institucionales.

## Límites de esta revisión

- El usuario conserva fuera del checkout `PLAN_TRABAJO/` y `docs/`; no recrear ni subir esas carpetas sin solicitud explícita.
- El Compose predeterminado levanta la aplicación web; Supabase permanece externo. El primer uso requiere `.env.docker`, que está ignorado por Git.
- La suite de desarrollo conserva una alerta alta de `braces` sin versión corregida publicada según el advisory consultado. Las dependencias de producción no reportan vulnerabilidades.
- No ejecutar `db reset --linked` ni usar datos reales para verificaciones.

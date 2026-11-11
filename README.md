# JobTrack Pro

JobTrack Pro es una aplicación para organizar postulaciones laborales, notas y recordatorios. Este proyecto vive en su propia carpeta y usa su propia base de datos D1; no depende de Ryds Stock, Agenda Fácil ni de sus datos.

## Funcionalidades

- Demo pública con datos ficticios y cambios temporales en el navegador.
- Registro e inicio de sesión para cuentas privadas.
- Solicitudes separadas por usuario, protegidas en la API.
- Búsqueda, filtros y resumen por estado.
- Crear, editar y eliminar postulaciones.
- Notas con fecha y hora, y recordatorios que se pueden completar.
- Diseño adaptable a móvil y escritorio.

La demo no se conecta a la base de datos. Cada cuenta privada solo puede leer y modificar sus propios registros.

## Desarrollo local

1. Instala dependencias: `npm install`.
2. Inicializa la base local:

   ```powershell
   npx wrangler d1 migrations apply jobtrack-pro --local
   ```

3. Inicia el sitio:

   ```powershell
   npm run dev
   ```

El entorno local usa la base de datos local de Wrangler. La configuración actual no apunta a ninguna D1 de producción.

## Publicación en Cloudflare

Cada recurso de producción debe pertenecer únicamente a JobTrack Pro:

1. Crea una D1 nueva: `npx wrangler d1 create jobtrack-pro`.
2. Copia el identificador que devuelve Wrangler en `database_id` de `wrangler.toml`.
3. Aplica el esquema remoto: `npx wrangler d1 migrations apply jobtrack-pro --remote`.
4. Crea el proyecto Pages si aún no existe: `npx wrangler pages project create jobtrack-pro --production-branch main`.
5. Publica el sitio: `npx wrangler pages deploy public --project-name=jobtrack-pro --branch=main`.

No conectes ni reutilices bases D1 de Agenda Fácil o Ryds Stock.

## Pruebas

Ejecuta `npm test`.

## Seguridad y alcance

- Las contraseñas se derivan con PBKDF2 (100.000 iteraciones, máximo soportado por Cloudflare Workers) y una sal única por cuenta; nunca se guardan en texto plano.
- Las sesiones se generan aleatoriamente, expiran y se almacenan en la base como hash.
- Las rutas de escritura requieren sesión y validan el origen de la solicitud.
- El registro limita la creación de cuentas por dirección IP.
- No se incluye restablecimiento de contraseña ni verificación de correo en esta versión.
- La demo muestra únicamente datos inventados; no introduzcas datos personales allí.
- Las cuentas son para la demostración del proyecto; revisa estas limitaciones antes de usarlo con información laboral sensible.

# Sistema de Logging

## Descripción

El sistema de logging registra automáticamente todos los eventos, errores y solicitudes de la aplicación en archivos de log organizados por fecha.

## Estructura

```
Backend/
├── logs/
│   ├── 2026-05-11.log
│   ├── 2026-05-12.log
│   └── ...
├── logger.js          # Módulo principal de logging
└── server.js          # Integración del logger
```

## Características

- **Archivos diarios**: Se crea automáticamente un archivo de log por cada día (formato: `YYYY-MM-DD.log`)
- **Niveles de log**: INFO, WARN, ERROR, DEBUG, REQUEST
- **Timestamps ISO**: Cada entrada incluye el tiempo exacto en formato ISO 8601
- **Información contextual**: Los errors incluyen stack traces cuando aplica
- **Logging de requests**: Registra automáticamente todos los requests HTTP con método, ruta, código de estado y duración

## Niveles de Log

### INFO
Eventos normales de la aplicación
```javascript
logger.info('Autenticación exitosa', { email: 'user@example.com' });
```

### WARN
Advertencias que no detienen la ejecución
```javascript
logger.warn('Intento de autenticación fallido', { email });
```

### ERROR
Errores que requieren atención
```javascript
logger.error('Error en endpoint de reportes', error);
```

### DEBUG
Información de depuración (solo se registra si `DEBUG_MODE=true`)
```javascript
logger.debug('Valores de debug', { variable1, variable2 });
```

### REQUEST
Solicitudes HTTP automáticas
```
[2026-05-11T14:30:45.123Z] [REQUEST] GET /api/reports - Status: 200 - 45ms
```

## Variables de Entorno

```env
DEBUG_MODE=false          # Activar logs de DEBUG
JASPER_STARTER_PATH=/path/to/jasperstarter  # Path de JasperStarter
```

## Ejemplos de Archivos de Log

### Nombre del archivo
```
2026-05-11.log
```

### Contenido
```
[2026-05-11T14:30:45.123Z] [INFO] Servidor iniciado
--------------------------------------------------------------------------------
[2026-05-11T14:30:48.567Z] [REQUEST] GET /api/dashboard-data - Status: 200 - 12ms
--------------------------------------------------------------------------------
[2026-05-11T14:31:20.891Z] [INFO] Autenticación exitosa
{
  "email": "user@example.com"
}
--------------------------------------------------------------------------------
[2026-05-11T14:32:15.234Z] [ERROR] Error en endpoint de reportes
{
  "message": "ENOENT: no such file or directory",
  "stack": "Error: ENOENT: no such file or directory...",
  "errno": -2,
  "syscall": "open"
}
--------------------------------------------------------------------------------
```

## Integración Automática

El logger se integra automáticamente en:

1. **Middleware de requests**: Todos los requests HTTP son registrados
2. **Rutas de autenticación**: Login exitosos y fallidos
3. **Rutas de reportes**: Generación de reportes
4. **Rutas de currículum**: Obtención de datos
5. **Errores globales**: Todos los errores no capturados

## Cómo Usar el Logger

### En archivos del backend

```javascript
const logger = require('./logger');

// En una ruta o función
try {
  // código
  logger.info('Operación exitosa', { id: 123 });
} catch (err) {
  logger.error('Error en la operación', err);
}
```

## Mantenimiento

- Los archivos se crean automáticamente en `Backend/logs/`
- Cada día se crea un nuevo archivo
- Recomendado: Limpiar logs antiguos periódicamente
- Tamaño típico por día: 500KB - 2MB (según uso)

## Script para Limpiar Logs Antiguos

```bash
# Limpiar logs con más de 30 días
find Backend/logs -name "*.log" -mtime +30 -delete
```

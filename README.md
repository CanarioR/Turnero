# Sistema de Turnos

Sistema de gestión de turnos en tiempo real para puntos de atención. Permite generar tickets, llamar turnos desde múltiples cajas y mostrar el estado en una pantalla central.

## Tecnologías

- **Node.js** + **Express** — servidor HTTP
- **Socket.io** — comunicación en tiempo real (WebSockets)

## Interfaces

| Interfaz | URL | Descripción |
|---|---|---|
| Generador | `/generator.html` | Genera tickets e imprime el comprobante |
| Pantalla | `/display.html` | Muestra turnos en atención y próximos |
| Punto de Venta | `/pos.html?id=N` | Llama al siguiente turno (una por caja) |

## Requisitos

- Node.js 18 o superior
- npm

## Instalación local

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/turnero.git
cd turnero

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor arranca en el puerto `3000` por defecto. Abre `http://localhost:3000/display.html` para verificar.

## Despliegue en IIS (Windows Server)

### Prerrequisitos en el servidor

1. [Node.js x64](https://nodejs.org) (LTS)
2. [iisnode](https://github.com/azure/iisnode/releases) — `iisnode-full-v0.2.26-x64.msi`
3. [URL Rewrite para IIS](https://www.iis.net/downloads/microsoft/url-rewrite)
4. Módulo **WebSocket Protocol** habilitado en IIS

### Pasos

```powershell
# 1. Copiar archivos al servidor (excluir node_modules)
$dest = "C:\inetpub\wwwroot\LocalAppServices\turnero"
New-Item -ItemType Directory -Path $dest
Copy-Item ".\*" $dest -Recurse -Exclude "node_modules"

# 2. Instalar dependencias en el servidor
cd $dest
npm install --omit=dev

# 3. Crear Application Pool sin .NET
New-WebAppPool -Name "Turnero"
Set-ItemProperty "IIS:\AppPools\Turnero" managedRuntimeVersion ""

# 4. Registrar como aplicación en IIS
# (también se puede hacer desde IIS Manager → Add Application)

# 5. Dar permisos
icacls $dest /grant "IIS AppPool\Turnero:(OI)(CI)RW" /T
```

En IIS Manager: clic derecho en el sitio padre → **Add Application** → alias `turnero`, App Pool `Turnero`, ruta física al destino.

### Logs de error

```
C:\inetpub\wwwroot\LocalAppServices\turnero\iisnode\
```

## Estructura del proyecto

```
turnero/
├── server.js           # Backend principal
├── package.json
├── web.config          # Configuración para IIS + iisnode
└── public/
    ├── generator.html  # Generador de tickets
    ├── pos.html        # Punto de venta
    └── display.html    # Pantalla de turnos
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |

## Uso

### Generador de tickets
Dispositivo en recepción. El cliente presiona el botón para obtener su número. Se abre automáticamente una ventana de impresión con el ticket (requiere permitir pop-ups en el navegador).

### Punto de venta (`pos.html?id=1`)
Un dispositivo por caja. Muestra el turno actualmente en atención y el botón **Siguiente** para llamar al próximo. Incluye contador de turnos atendidos en la sesión.

### Pantalla de turnos
Pantalla visible para los clientes. Muestra:
- **En atención**: hasta 4 cajas activas con su turno actual (color por caja)
- **Próximos**: los 4 siguientes en cola

Al llamar un turno emite un **beep** y un **anuncio por voz** (tocar la pantalla una vez para activar el audio por política del navegador).

### Reset del sistema
Desde el generador, el botón **Resetear sistema** limpia todos los turnos y reinicia el contador.

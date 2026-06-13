# SafePlace

SafePlace es un sistema de monitoreo preventivo de biodatos para entornos de alta exigencia. A través del uso de wearables (como el Garmin Forerunner 265), se recopilan mediciones biométricas como la frecuencia cardíaca y el nivel de actividad de los trabajadores. Estas métricas se transmiten vía Bluetooth Low Energy (BLE) a un Gateway (Raspberry Pi), que luego las envía al Backend REST para su evaluación mediante reglas operativas. Si se detectan anomalías (ej: frecuencia cardíaca elevada, inactividad prolongada), el sistema genera alertas en tiempo real que son visualizadas en un Frontend Web (React) por los supervisores operativos y el área de seguridad e higiene.

## Componentes Principales

*   **Frontend Web (apps/web):** Aplicación React SPA para el dashboard operativo, gestión de alertas, trabajadores, dispositivos y configuración.
*   **Backend API (services/backend-api):** API REST en Node.js + Express que centraliza la lógica de negocio, validación de mediciones, reglas operativas, autenticación y persistencia.
*   **Gateway BLE (services/gateway-ble):** Servicio en Node.js que corre en Raspberry Pi. Se encarga de descubrir y leer datos del wearable Garmin vía BLE y retransmitirlos al backend.
*   **Base de Datos (database):** PostgreSQL para la persistencia relacional de trabajadores, mediciones, alertas y usuarios.

## Cómo ejecutar el entorno local

1.  **Clonar el repositorio.**
2.  **Configurar variables de entorno:** Copiar el archivo `.env.example` a `.env` y ajustar los valores según sea necesario.
    ```bash
    cp .env.example .env
    ```
3.  **Levantar los servicios con Docker Compose:**
    ```bash
    docker-compose up -d --build
    ```
    Esto levantará la base de datos PostgreSQL, el Backend API y el Frontend Web. (Nota: El Gateway BLE se incluye comentado en el compose, ya que su ejecución ideal es en una Raspberry Pi real con hardware BLE, pero puede descomentarse para pruebas locales si se cuenta con el hardware).
4.  **Acceder a las aplicaciones:**
    *   Frontend: `http://localhost:3000`
    *   Backend API: `http://localhost:8000`
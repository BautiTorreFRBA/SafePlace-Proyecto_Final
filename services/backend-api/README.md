# SafePlace - Backend API

API REST construida con Node.js y Express. Concentra la lógica de negocio y persistencia de datos de SafePlace.

## Arquitectura

Organizado en capas (Routes -> Controllers -> Services -> Repositories) para mantener el código desacoplado y mantenible.

- **Rutas:** Endpoints REST
- **Controladores:** Manejo de requests/responses HTTP
- **Servicios:** Lógica de negocio (Ingesta, Reglas, Alertas)
- **Repositorios:** Acceso a base de datos PostgreSQL

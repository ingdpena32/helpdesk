"""Escribe README.md en UTF-8 (evita UTF-16 que muestra NUL en VS Code)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT = r"""# Helpdesk — Gestión de tickets

Monorepo de **helpdesk/tickets** con **React + TypeScript** (Vite) y **API REST en Python estándar** (`http.server`, sin Flask, FastAPI ni Django), persistencia en **PostgreSQL**.

> **Codificación:** este `README.md` debe estar en **UTF-8**. Si lo guardas como **UTF-16** (“Unicode” en el Bloc de notas de Windows), en VS Code verás bloques “NUL” entre letras: vuelve a UTF-8 con *Reopen with Encoding* / *Save with Encoding*.

## Estructura del repositorio

| Ruta | Rol |
|------|-----|
| `frontend/` | SPA: login, dashboards por rol, tickets, agentes (admin), ajustes. React Query + React Router + Tailwind. |
| `backend/` | Servidor HTTP en `localhost:8000`, capas **controller → service → repository**. |

## Requisitos previos

- **Node.js** 20+ y npm
- **Python** 3.10+
- **PostgreSQL** (p. ej. administrado con PgAdmin4)
- Base de datos creada (ej. `helpdesk`)

## Base de datos

Ejecuta en **orden** sobre tu base (PgAdmin4 o `psql`):

1. `backend/app/database/migrations.sql` — tabla **`users`** e insert de prueba.
2. `backend/app/database/tickets.sql` — tabla **`tickets`**, índices, datos de ejemplo.

**Login de prueba**

| Campo | Valor |
|--------|--------|
| Usuario / email | `admin@test.com` |
| Contraseña | `123456` |

En la BD, las **prioridades** de ticket son **`low` \| `medium` \| `high`**. Las **categorías** válidas son texto fijo: `ERP`, `Infraestructura`, `Soporte técnico`, `Bases de datos`, `Desarrollo`.

## Backend

### Instalación

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Variables de entorno (`backend/.env`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=helpdesk
DB_USER=postgres
DB_PASSWORD=tu_contraseña
```

### Arranque

```bash
cd backend
python main.py
```

API por defecto: **http://127.0.0.1:8000**

### Capas (`backend/app/`)

- `main.py` — `HTTPServer`, JSON, query string, CORS básico.
- `router.py` — rutas y normalización de path (incl. `/api/tickets`).
- `controllers/` — entrada/salida HTTP.
- `services/` — validaciones y reglas (auth, tickets).
- `repositories/` — SQL con `psycopg2`.
- `models/` — entidades (`User`, `Ticket`).
- `database/` — `db.py` + scripts SQL.

### API (resumen)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/`, `/health` | Comprobación del servicio. |
| POST | `/api/auth/login/` o `/auth/login` | Cuerpo: `user_name` (o `email`) + `password`. Respuesta: `access`, `refresh`, `user`. |
| GET | `/api/tickets/` | Listado paginado: `count`, `next`, `previous`, `results`. Query: `status`, `priority`, `category`, `assigned_to`, `page`, `page_size`. |
| POST | `/api/tickets/` | Crear: `title`, `description`, `created_by`, `priority`, `category`. |

El cliente envía **`Authorization: Bearer`** en rutas autenticadas; el validado estricto del token en todas las rutas puede ampliarse según necesidad de producción.

**Pendiente en backend:** `POST /api/auth/refresh/` (el front intenta refrescar el access); si no existe, ante 401 puede tocar volver a iniciar sesión.

## Frontend

### Instalación y desarrollo

```bash
cd frontend
npm install
npm run dev
```

Vite suele usar **http://localhost:5173**. El proxy reenvía **`/api`** a **http://127.0.0.1:8000** (`frontend/vite.config.ts`; mismo criterio en `preview`).

### Variable `VITE_API_BASE_URL` (opcional)

- Sin definir: peticiones relativas a `/api/...` y el proxy llega al Python.
- Con valor: usar **origen sin** `/api` final, p. ej. `http://127.0.0.1:8000` (evita URLs del tipo `/api/api/...`).

### Funciones destacadas

- Sesión en `localStorage` (`access`, `refresh`, `user`).
- Rutas protegidas y por rol (admin / agente).
- Listado de tickets con filtros.
- Sidebar **Nuevo ticket**: modal de creación; al guardar se refresca el listado (React Query) y se navega a `/tickets`.

### Build

```bash
cd frontend
npm run build
npm run preview
```

## Flujo recomendado en local

1. PostgreSQL arriba + SQL ejecutados (`migrations.sql` → `tickets.sql`).
2. `cd backend && python main.py`
3. `cd frontend && npm run dev`
4. Navegador → URL de Vite → login con `admin@test.com` / `123456`.

## Solución de problemas (breve)

- **404 en `/api/tickets`:** confirma que el proceso en `:8000` es este backend (reinicia tras cambios) y que no duplicas `/api` en `VITE_API_BASE_URL`.
- **Errores de conexión a BD:** revisa `backend/.env` y que la base exista.
- Tras actualizar dependencias Python: `pip install -r requirements.txt`.
- **README con “NUL” entre letras:** el archivo está en UTF-16; ábrelo como UTF-8 o guárdalo de nuevo en **UTF-8** (en Cursor: barra de estado o *Save with Encoding*).

## Licencia

Proyecto de ejemplo / evolución; define licencia y políticas de despliegue según tu entorno.
"""

if __name__ == "__main__":
    (ROOT / "README.md").write_text(TEXT, encoding="utf-8", newline="\n")
    print("OK:", ROOT / "README.md")

# NexusDesk — Gestión de tickets

Monorepo de **helpdesk/tickets** con **React + TypeScript** (Vite), **API REST en Flask** (Python 3.10+), persistencia en **PostgreSQL** y opcionalmente **Ollama** para clasificación automática de tickets creados por correo.

> **Codificación:** este `README.md` debe estar en **UTF-8**. Si lo guardas como **UTF-16** (“Unicode” en el Bloc de notas de Windows), en VS Code verás bloques “NUL” entre letras: vuelve a UTF-8 con *Reopen with Encoding* / *Save with Encoding*.

## Estructura del repositorio

| Ruta | Rol |
|------|-----|
| `frontend/` | SPA: login, dashboards por rol, tickets, agentes (admin), ajustes. React Query + React Router + Tailwind. |
| `backend/` | API Flask en `127.0.0.1:8000`, capas **controller → service → repository**, correo (IMAP/worker) e integración **Ollama**. |

## Requisitos previos

- **Node.js** 20+ y npm
- **Python** 3.10+
- **PostgreSQL** (p. ej. PgAdmin 4 o `psql`)
- Base de datos creada (ej. `helpdesk`)
- *(Opcional, clasificación IA)* **[Ollama](https://ollama.com/)** en local (`ollama serve`) con el modelo definido en `OLLAMA_MODEL` (recomendado: `phi4-mini` u otro modelo ligero en CPU)

## Base de datos

### Instalación desde cero

Puedes aplicar el esquema completo actual en una base vacía:

- `backend/app/database/schema.sql`

Incluye tablas de usuarios, sesiones, tickets, comentarios, adjuntos, ingestión de correo, notificaciones, auditoría y **campos de clasificación IA** (`ai_status`, `ai_motivo`, categorías y prioridad ampliadas).

### Bases ya existentes (migraciones incrementales)

Si partes de un dump o de migraciones antiguas, ejecuta en **orden** los scripts que falten bajo `backend/app/database/` (numerados `1_…`, `2_…`, …). Para la **clasificación con Ollama** hace falta como mínimo:

- `backend/app/database/11_ticket_ai_ollama.sql` — columnas IA, ampliación de `category` y `priority` (incluye `critical`).

### Login de prueba

| Campo | Valor |
|--------|--------|
| Usuario / email | `admin@test.com` |
| Contraseña | `123456` |

### Tickets: prioridades y categorías (API / BD)

- **Prioridades:** `low`, `medium`, `high`, `critical` (en formularios en español: baja / media / alta / crítica).
- **Categorías (departamento / área):** además de las históricas (`ERP`, `Infraestructura`, `Soporte técnico`, `Bases de datos`, `Desarrollo`), el sistema admite **`Soporte TI`**, **`Redes`**, **`RRHH`**, **`Contabilidad`**, **`Compras`** y **`Sin clasificar`** (p. ej. fallback de la IA).

## Backend

### Instalación

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

En Windows PowerShell, si `activate` falla, usa: `.\.venv\Scripts\Activate.ps1`

### Variables de entorno (`backend/.env`)

**Base de datos**

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=helpdesk
DB_USER=postgres
DB_PASSWORD=tu_contraseña
```

**Ollama (clasificación automática de tickets por correo)**

| Variable | Descripción | Valor por defecto (si falta en `.env`) |
|----------|-------------|----------------------------------------|
| `OLLAMA_URL` | URL base del servicio Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo en `/api/generate` (sin `:tag` usa el tag por defecto de Ollama) | `phi4-mini` |
| `OLLAMA_TIMEOUT` | Timeout de lectura HTTP hacia Ollama (s); máximo **45** s | `45` |
| `OLLAMA_BODY_MAX_CHARS` | Máximo de caracteres del cuerpo del correo en el prompt | `4000` |
| `OLLAMA_CONNECT_TIMEOUT` | *(Opcional)* Timeout de conexión TCP (s) | `5` |
| `OLLAMA_TEMPERATURE` | *(Opcional)* Temperatura del modelo | `0` |
| `OLLAMA_NUM_PREDICT` | *(Opcional)* Tope de tokens generados (`num_predict`) | `256` |

**Correo (opcional)** — ver `backend/app/email/config.py` y comentarios en los SQL de ingestión (`7_email_ingestion.sql`, etc.): usuario IMAP, `EMAIL_WORKER_*`, dominios permitidos, etc.

### Arranque de la API

```bash
cd backend
python main.py
```

API por defecto: **http://127.0.0.1:8000**

### Worker de correo (ingesta → tickets)

Los correos entrantes se procesan con un worker separado (cola `ingestion_events`):

```bash
cd backend
python -m app.email.worker
```

Tras crear un **ticket nuevo** desde un correo, la API programa en **segundo plano** (hilo) la llamada a Ollama: el ticket queda con `ai_status = "Procesando IA"` y se actualiza a `Clasificado` o `Error` (con fallback seguro si la IA falla o devuelve datos inválidos).

### Capas (`backend/app/`)

- `main.py` (en la raíz `backend/`) — arranque del servidor Flask.
- `app/main.py` — fábrica Flask, CORS, dispatch JSON.
- `router.py` — rutas y normalización de path (`/api/...`).
- `controllers/` — adaptación HTTP.
- `services/` — reglas de negocio, auth, tickets, **`ai_service`** (Ollama), **`ticket_ai_classification`** (hilo + persistencia).
- `repositories/` — SQL con `psycopg2`.
- `models/` — entidades (`User`, `Ticket`, …).
- `database/` — `db.py` + scripts SQL y `schema.sql`.
- `email/` — IMAP, normalización MIME, **worker** de ingestión.

### API (resumen)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/`, `/health` | Comprobación del servicio. |
| POST | `/api/auth/login` o `/auth/login` | Cuerpo: `user_name` (o `email`) + `password`. Respuesta: `access`, `refresh`, `user`. |
| POST | `/api/auth/refresh` o `/auth/refresh` | Renovar access con `refresh` en el cuerpo. |
| GET | `/api/tickets` | Listado paginado: `count`, `next`, `previous`, `results`. Query: `status`, `priority`, `category`, `assigned_to`, `page`, `page_size`. |
| POST | `/api/tickets` | Crear: `title`, `description`, `priority`, `category` (el creador lo toma del token). |
| GET / PATCH / DELETE | `/api/tickets/{id}` | Detalle, actualización parcial, borrado lógico (admin). |
| POST | `/api/test-ollama` | **Prueba de clasificación IA** (agente/admin). Cuerpo: `{"subject":"...","body":"..."}`. La respuesta incluye `ollama_model`, duraciones (`ollama_request_seconds`, `ollama_server_duration_seconds`, `ollama_total_seconds`), `used_fallback`, `approx_prompt_tokens`, `cleaned_json` y `raw_model_json`. |

En rutas autenticadas el cliente envía **`Authorization: Bearer <access>`**.

Los tickets devueltos por la API pueden incluir **`ai_status`** (`Sin IA`, `Procesando IA`, `Clasificado`, `Error`) y **`ai_motivo`** (texto breve de la clasificación).

## Frontend

### Instalación y desarrollo

```bash
cd frontend
npm install
npm run dev
```

Vite suele usar **http://localhost:5173**. El proxy reenvía **`/api`** a **http://127.0.0.1:8000** (`frontend/vite.config.ts`; mismo criterio en `preview`).

### Variable `VITE_API_BASE_URL` (opcional)

- Sin definir: peticiones relativas a `/api/...` y el proxy llega al backend.
- Con valor: usar **origen sin** `/api` final, p. ej. `http://127.0.0.1:8000` (evita URLs del tipo `/api/api/...`).

### Funciones destacadas

- Sesión en `localStorage` (`access`, `refresh`, `user`).
- Rutas protegidas y por rol (admin / agente).
- Listado de tickets con filtros; detalle con **estado de clasificación IA** y motivo; refetch periódico mientras `ai_status` sea `Procesando IA`.
- Sidebar **Nuevo ticket**: modal de creación; al guardar se refresca el listado (React Query).

### Build

```bash
cd frontend
npm run build
npm run preview
```

## Flujo recomendado en local

1. PostgreSQL arriba + esquema aplicado (`schema.sql` o migraciones, incl. **`11_ticket_ai_ollama.sql`** si la BD es antigua).
2. *(Opcional IA)* `ollama serve` y `ollama pull phi4-mini` (o el modelo indicado en `OLLAMA_MODEL`).
3. `cd backend && pip install -r requirements.txt && python main.py`
4. *(Correo + IA)* en otra terminal: `cd backend && python -m app.email.worker`
5. `cd frontend && npm run dev`
6. Navegador → URL de Vite → login con `admin@test.com` / `123456`.

### Probar Ollama sin correo

Con la API y un token válido (agente o admin), por ejemplo con **Git Bash** o Linux/macOS:

```bash
curl -s -X POST http://127.0.0.1:8000/api/test-ollama \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS" \
  -d '{"subject":"Asunto","body":"Cuerpo del mensaje"}'
```

En **PowerShell** puedes usar `Invoke-RestMethod` con `-Headers` y `-Body` (JSON en comillas simples externas) o pegar el `curl` en una sola línea escapando las comillas dobles del JSON.

## Solución de problemas (breve)

- **404 en `/api/tickets`:** confirma que el proceso en `:8000` es este backend y que no duplicas `/api` en `VITE_API_BASE_URL`.
- **Errores de conexión a BD:** revisa `backend/.env` y que la base exista; aplica migraciones pendientes.
- **Clasificación IA siempre en fallback / `Error`:** comprueba que Ollama esté en marcha, que exista el modelo (`ollama list`) y `OLLAMA_URL` / `OLLAMA_MODEL` en `.env`.
- **Columna `ai_status` no existe:** ejecuta `11_ticket_ai_ollama.sql`.
- Tras actualizar dependencias Python: `pip install -r requirements.txt`.
- **README con “NUL” entre letras:** el archivo está en UTF-16; guárdalo de nuevo en **UTF-8** (en Cursor: barra de estado o *Save with Encoding*).

## Licencia

Proyecto de ejemplo / evolución; define licencia y políticas de despliegue según tu entorno.

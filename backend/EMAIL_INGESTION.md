# Correo entrante → tickets (IMAP + worker)

## Arquitectura

```
Gmail (u otro IMAP)
        ↓
  app/email/imap_poller.py   ← UNSEEN, RFC822, base64 en JSONB
        ↓
  ingestion_events (staging)
        ↓
  app/email/worker.py        ← parse MIME, dominios, adjuntos, tickets/comentarios
        ↓
  PostgreSQL + API + React
```

1. **IMAP** (`python -m app.email.imap_poller`): conexión SSL, buzón configurable (por defecto `INBOX`), búsqueda `UNSEEN`, descarga el mensaje completo (`BODY.PEEK[]`), guarda en `ingestion_events` un payload `{"source":"imap","raw_mime_b64":"..."}` y marca el correo como **\\Seen** tras persistir (o si ya estaba procesado / duplicado por `Message-ID`).
2. **Worker** (`python -m app.email.worker`): igual que antes — lee `pending` / `failed` con reintentos, decodifica `raw_mime_b64`, enriquece con `enrich_from_raw_mime`, resuelve hilo por **In-Reply-To** y por cabecera **References**, aplica dominios MIME y de remitente, crea **ticket** o **comentario**, guarda adjuntos bajo `ATTACHMENTS_STORAGE_DIR`.
3. **API** existente: `GET /api/tickets/{id}` con adjuntos; `GET /api/attachments/{id}` (Bearer).

Ya **no** existe el endpoint HTTP `POST /api/email/inbound` (webhook Mailgun/SendGrid). La única entrada oficial es IMAP.

## Base de datos

1. Migraciones previas (usuarios, tickets, …).
2. `backend/app/database/7_email_ingestion.sql` (tabla `ingestion_events`, columnas de correo en tickets/comentarios, adjuntos).

## Variables de entorno (`backend/.env`)

### IMAP (obligatorio para ingesta)

| Variable | Descripción |
|----------|-------------|
| `EMAIL_USER` | Cuenta de correo (p. ej. Gmail). |
| `EMAIL_PASSWORD` | Contraseña de aplicación o token (Gmail: *App password*). |
| `IMAP_SERVER` | Por defecto `imap.gmail.com`. |
| `IMAP_PORT` | Por defecto `993`. |
| `IMAP_MAILBOX` | Buzón IMAP (por defecto `INBOX`). |
| `EMAIL_IMAP_POLL_SECONDS` | Intervalo entre ciclos del poller (por defecto `60`). |
| `EMAIL_IMAP_SOCKET_TIMEOUT_SECONDS` | Timeout del socket IMAP en segundos (por defecto `120`). |
| `EMAIL_IMAP_MAX_RETRIES_PER_CYCLE` | Reintentos con nueva conexión si falla el ciclo (por defecto `5`). |
| `EMAIL_IMAP_RETRY_BACKOFF_BASE` | Segundos iniciales de espera entre reintentos (por defecto `2`). |
| `EMAIL_IMAP_RETRY_BACKOFF_MAX` | Tope de backoff entre reintentos (por defecto `60`). |

### Worker y adjuntos (igual que antes)

| Variable | Descripción |
|----------|-------------|
| `INBOUND_MAX_PAYLOAD_BYTES` | Tope del JSON en BD (mensaje en base64); por defecto ~12 MiB. |
| `INBOUND_ALLOWED_DOMAINS` | Dominios permitidos del remitente (vacío = todos). |
| `INBOUND_ALLOWED_MIME_PREFIXES` | Prefijos MIME permitidos para adjuntos. |
| `INBOUND_MAX_ATTACHMENT_BYTES` | Tamaño máximo por adjunto. |
| `ATTACHMENTS_STORAGE_DIR` | Carpeta de ficheros (por defecto `backend/data/attachments`). |
| `INBOUND_SYSTEM_USER_EMAIL` | Usuario sistema (`inbound@system.local` tras la migración 7). |
| `EMAIL_WORKER_POLL_SECONDS` / `EMAIL_WORKER_BATCH_SIZE` / `EMAIL_WORKER_MAX_RETRIES` | Worker. |

## Ejecutar en local (tres procesos)

**Terminal 1 — API Flask**

```bash
cd backend
python main.py
```

**Terminal 2 — Worker de correo**

```bash
cd backend
python -m app.email.worker
```

**Terminal 3 — Ingesta IMAP**

```bash
cd backend
python -m app.email.imap_poller
```

**Terminal 4 — Frontend (opcional)**

```bash
cd frontend
npm run dev
```

Sin `EMAIL_USER` / `EMAIL_PASSWORD`, el poller imprime aviso y no conecta (no falla el resto del sistema).

## Gmail (académico)

1. Cuenta Google → Seguridad → **Verificación en dos pasos** activada.
2. Crear **contraseña de aplicaciones** para “Correo” / “Otro” y pegarla en `EMAIL_PASSWORD`.
3. `EMAIL_USER` = dirección completa; `IMAP_SERVER=imap.gmail.com`, `IMAP_PORT=993`.

## Idempotencia y duplicados

- **Message-ID** en cabecera MIME: se usa como `message_id` en staging y el worker evita duplicar tickets/comentarios.
- Índice único en `ingestion_events(message_id)` y comprobación de `completed` antes de insertar desde IMAP.
- **References**: si falta `In-Reply-To`, el worker intenta enlazar el hilo con IDs de `References` (de atrás hacia delante).

## Errores habituales

| Síntoma | Causa probable |
|---------|------------------|
| Worker: usuario sistema no existe | No se ejecutó `7_email_ingestion.sql`. |
| IMAP login falla | Credenciales o “acceso IMAP” deshabilitado en el proveedor. |
| Comentario: In-Reply-To sin ticket | El Message-ID referenciado no está en `tickets.email_message_id` ni en `ticket_comments.message_id`. |
| Mensaje muy grande | Supera `INBOUND_MAX_PAYLOAD_BYTES` en base64; el poller lo marca leído y no lo encola. |

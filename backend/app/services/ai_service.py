"""
Clasificación de tickets vía Ollama (HTTP).

Configuración vía variables de entorno (ver README): OLLAMA_URL, OLLAMA_MODEL,
OLLAMA_TIMEOUT, OLLAMA_BODY_MAX_CHARS; opcionales: OLLAMA_CONNECT_TIMEOUT,
OLLAMA_TEMPERATURE, OLLAMA_NUM_PREDICT.

Expone `clasificar_ticket` con timeouts acotados, validación de JSON, limpieza de
respuesta y fallback seguro (compatible con modelos pequeños tipo phi4-mini en CPU).
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

# Departamentos permitidos (respuesta del modelo en español, exactos).
VALID_DEPARTMENTS: frozenset[str] = frozenset(
    {
        "Soporte Técnico",
        "ERP",
        "Infraestructura",
        "Inteligencia Artificial",
        "Desarrollo",
        "Base de datos",
        "Sin clasificar",
    }
)

# Prioridades permitidas en la respuesta JSON (etiquetas en español).
VALID_PRIORITIES_LABEL: frozenset[str] = frozenset({"Baja", "Media", "Alta", "Crítica"})

FALLBACK_DEPARTMENT = "Sin clasificar"
FALLBACK_PRIORITY_LABEL = "Media"

# Mapeo a columnas de BD (`tickets.priority`).
_PRIORITY_LABEL_TO_DB: dict[str, str] = {
    "Baja": "low",
    "Media": "medium",
    "Alta": "high",
    "Crítica": "critical",
}

# Valores por defecto alineados con hardware limitado / modelos ligeros (phi4-mini).
_DEFAULT_OLLAMA_URL = "http://localhost:11434"
_DEFAULT_OLLAMA_MODEL = "phi4-mini"
_DEFAULT_TIMEOUT_SEC = 45.0
_DEFAULT_BODY_MAX_CHARS = 4000
_MAX_TIMEOUT_SEC = 45.0
_MIN_TIMEOUT_SEC = 2.0
_MIN_BODY_CHARS = 400
_MAX_BODY_CHARS = 32000

_INJECTION_MARKERS = (
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "system:",
    "assistant:",
    "user:",
    "you are now",
    "override",
    "```",
)

# Prompt: listas fijas (orden estable, texto mínimo).
_DEPTS_PROMPT = ", ".join(sorted(VALID_DEPARTMENTS))
_PRIOS_PROMPT = ", ".join(sorted(VALID_PRIORITIES_LABEL))


def ollama_base_url() -> str:
    raw = os.getenv("OLLAMA_URL")
    if raw is None or not str(raw).strip():
        return _DEFAULT_OLLAMA_URL.rstrip("/")
    return str(raw).strip().rstrip("/")


def ollama_model() -> str:
    raw = os.getenv("OLLAMA_MODEL")
    if raw is None or not str(raw).strip():
        return _DEFAULT_OLLAMA_MODEL
    return str(raw).strip()


def ollama_timeout_seconds() -> float:
    raw = os.getenv("OLLAMA_TIMEOUT")
    if raw is None or not str(raw).strip():
        v = _DEFAULT_TIMEOUT_SEC
    else:
        try:
            v = float(str(raw).strip())
        except ValueError:
            v = _DEFAULT_TIMEOUT_SEC
    return max(_MIN_TIMEOUT_SEC, min(v, _MAX_TIMEOUT_SEC))


def ollama_connect_timeout_seconds() -> float:
    raw = os.getenv("OLLAMA_CONNECT_TIMEOUT")
    if raw is None or not str(raw).strip():
        return 5.0
    try:
        v = float(str(raw).strip())
    except ValueError:
        return 5.0
    return max(1.0, min(v, 30.0))


def ollama_body_max_chars() -> int:
    raw = os.getenv("OLLAMA_BODY_MAX_CHARS")
    if raw is None or not str(raw).strip():
        return _DEFAULT_BODY_MAX_CHARS
    try:
        n = int(str(raw).strip())
    except ValueError:
        return _DEFAULT_BODY_MAX_CHARS
    return max(_MIN_BODY_CHARS, min(n, _MAX_BODY_CHARS))


def ollama_temperature() -> float:
    raw = os.getenv("OLLAMA_TEMPERATURE")
    if raw is None or not str(raw).strip():
        return 0.0
    try:
        t = float(str(raw).strip())
    except ValueError:
        return 0.0
    return max(0.0, min(t, 2.0))


def ollama_num_predict() -> int:
    raw = os.getenv("OLLAMA_NUM_PREDICT")
    if raw is None or not str(raw).strip():
        return 256
    try:
        n = int(str(raw).strip())
    except ValueError:
        return 256
    return max(32, min(n, 2048))


def _approx_tokens_from_text(text: str) -> int:
    """Heurística orientativa (~4 caracteres por token en español/JSON)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def _strip_control_chars(text: str) -> str:
    return "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)


def sanitize_for_prompt(subject: str, body: str) -> tuple[str, str]:
    """
    Recorta longitud, quita caracteres de control y atenúa patrones típicos
    de instrucciones adversas (heurística simple).
    """
    sub = _strip_control_chars((subject or "").strip())[:280]
    raw_body = _strip_control_chars((body or "").strip())
    max_len = ollama_body_max_chars()
    if len(raw_body) > max_len:
        raw_body = raw_body[:max_len] + "\n[… truncado …]"

    lowered = raw_body.lower()
    for marker in _INJECTION_MARKERS:
        if marker in lowered:
            raw_body = re.sub(re.escape(marker), "[filtrado]", raw_body, flags=re.IGNORECASE)
            lowered = raw_body.lower()

    return sub, raw_body


def _build_prompt(subject: str, body: str) -> str:
    return (
        "Salida: un solo objeto JSON. Sin markdown. Sin texto antes ni después.\n"
        'Claves exactas: "departamento","prioridad","motivo".\n'
        f"- departamento: una de [{_DEPTS_PROMPT}].\n"
        f"- prioridad: una de [{_PRIOS_PROMPT}].\n"
        "- motivo: español, máximo 180 caracteres, criterio breve.\n"
        "Si hay duda: "
        f'departamento "{FALLBACK_DEPARTMENT}", prioridad "{FALLBACK_PRIORITY_LABEL}".\n'
        f"Asunto: {subject}\n"
        f"Cuerpo:\n{body}"
    )


def _normalize_model_response(raw: str) -> str:
    s = (raw or "").strip()
    if s.startswith("\ufeff"):
        s = s.lstrip("\ufeff")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", s, re.IGNORECASE)
    if fence:
        s = fence.group(1).strip()
    s = s.replace("\r\n", "\n").strip()
    i = s.find("{")
    if i > 0:
        s = s[i:]
    return s.strip()


def _balanced_brace_object(text: str) -> str | None:
    """Extrae el primer subcadena {…} con llaves equilibradas (tolerancia a ruido final)."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = _normalize_model_response(raw)
    if not text:
        return None

    candidates: list[str] = []
    if text:
        candidates.append(text)
    balanced = _balanced_brace_object(text)
    if balanced and balanced not in candidates:
        candidates.insert(0, balanced)

    for cand in candidates:
        cand = cand.strip()
        if not cand:
            continue
        try:
            data = json.loads(cand)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        idx = cand.find("{")
        while idx != -1:
            try:
                obj, _end = json.JSONDecoder().raw_decode(cand, idx)
            except json.JSONDecodeError:
                idx = cand.find("{", idx + 1)
                continue
            if isinstance(obj, dict):
                return obj
            idx = cand.find("{", idx + 1)

    loose = text.rfind("}")
    tight = text.find("{")
    if tight != -1 and loose != -1 and loose > tight:
        slice_ = text[tight : loose + 1]
        try:
            data = json.loads(slice_)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    return None


def _ns_to_seconds(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value) / 1_000_000_000.0
    except (TypeError, ValueError):
        return None


def _call_ollama_generate(prompt: str) -> tuple[str, dict[str, Any]]:
    """
    POST /api/generate. Devuelve (texto del modelo, diagnósticos).
    """
    url = f"{ollama_base_url()}/api/generate"
    read_timeout = ollama_timeout_seconds()
    connect_timeout = ollama_connect_timeout_seconds()
    model = ollama_model()
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": ollama_temperature(),
            "num_predict": ollama_num_predict(),
            "top_k": 20,
            "top_p": 0.85,
        },
    }
    approx_in = _approx_tokens_from_text(prompt)
    t_wall0 = time.perf_counter()
    logger.info(
        "Ollama: POST /api/generate model=%s read_timeout=%ss connect_timeout=%ss approx_prompt_tokens≈%s",
        model,
        read_timeout,
        connect_timeout,
        approx_in,
    )
    resp = requests.post(
        url,
        json=payload,
        timeout=(connect_timeout, read_timeout),
    )
    wall_s = time.perf_counter() - t_wall0
    resp.raise_for_status()
    outer = resp.json()
    if not isinstance(outer, dict):
        raise ValueError("Respuesta Ollama no es objeto JSON")
    inner = outer.get("response")
    if not isinstance(inner, str):
        raise ValueError("Campo 'response' ausente o no es texto")

    server_total_s = _ns_to_seconds(outer.get("total_duration"))
    prompt_eval = outer.get("prompt_eval_count")
    eval_count = outer.get("eval_count")

    diag: dict[str, Any] = {
        "request_wall_seconds": wall_s,
        "server_total_seconds": server_total_s,
        "prompt_eval_count": int(prompt_eval) if isinstance(prompt_eval, int) else None,
        "completion_eval_count": int(eval_count) if isinstance(eval_count, int) else None,
        "response_chars": len(inner),
    }
    logger.info(
        "Ollama: respuesta model=%s wall=%.2fs server_total=%s prompt_eval=%s completion_eval=%s chars=%s",
        model,
        wall_s,
        f"{server_total_s:.2f}s" if server_total_s is not None else "n/a",
        prompt_eval,
        eval_count,
        len(inner),
    )
    return inner, diag


def fallback_result(
    motivo: str,
    *,
    ollama_request_seconds: float | None = None,
    ollama_server_duration_seconds: float | None = None,
    ollama_total_seconds: float | None = None,
    approx_prompt_tokens: int | None = None,
) -> dict[str, Any]:
    """Resultado normalizado cuando la IA no puede clasificar de forma fiable."""
    prio_label = FALLBACK_PRIORITY_LABEL
    final_json = {
        "departamento": FALLBACK_DEPARTMENT,
        "prioridad": prio_label,
        "prioridad_db": _PRIORITY_LABEL_TO_DB[prio_label],
        "motivo": motivo,
    }
    return {
        "departamento": FALLBACK_DEPARTMENT,
        "prioridad_label": prio_label,
        "prioridad_db": _PRIORITY_LABEL_TO_DB[prio_label],
        "motivo": motivo,
        "used_fallback": True,
        "raw_model_json": None,
        "final_classification_json": final_json,
        "ollama_request_seconds": ollama_request_seconds,
        "ollama_server_duration_seconds": ollama_server_duration_seconds,
        "ollama_total_seconds": ollama_total_seconds,
        "approx_prompt_tokens": approx_prompt_tokens,
    }


def clasificar_ticket(subject: str, body: str) -> dict[str, Any]:
    """
    Llama a Ollama y devuelve dict con claves canónicas para el dominio, más metadatos
    de tiempo y `final_classification_json` (salida limpia aplicable al ticket).

    Claves principales:
    - departamento, prioridad_label, prioridad_db, motivo
    - used_fallback, raw_model_json
    - final_classification_json
    - ollama_request_seconds, ollama_server_duration_seconds, ollama_total_seconds
    - approx_prompt_tokens
    """
    t0 = time.perf_counter()
    sub_s, body_s = sanitize_for_prompt(subject, body)
    prompt = _build_prompt(sub_s, body_s)
    approx_prompt_tokens = _approx_tokens_from_text(prompt)

    raw_response_text = ""
    parsed: dict[str, Any] | None = None
    used_fallback = False
    request_s: float | None = None
    server_s: float | None = None

    try:
        raw_response_text, diag = _call_ollama_generate(prompt)
        request_s = float(diag.get("request_wall_seconds") or 0.0)
        server_s = diag.get("server_total_seconds")
        if isinstance(server_s, (int, float)):
            server_s = float(server_s)
        else:
            server_s = None

        parsed = _extract_json_object(raw_response_text)
        if parsed is None:
            logger.warning(
                "Ollama: JSON inválido o no parseable model=%s recorte=%r",
                ollama_model(),
                (raw_response_text or "")[:400],
            )
            used_fallback = True
    except requests.exceptions.Timeout:
        logger.error(
            "Ollama: timeout model=%s tras read_timeout=%ss",
            ollama_model(),
            ollama_timeout_seconds(),
        )
        used_fallback = True
    except requests.exceptions.RequestException as e:
        logger.error("Ollama: error HTTP/red model=%s: %s", ollama_model(), e)
        used_fallback = True
    except Exception as e:
        logger.exception("Ollama: error inesperado model=%s: %s", ollama_model(), e)
        used_fallback = True

    total_s = time.perf_counter() - t0

    if parsed is None:
        out = fallback_result(
            "Clasificación automática no disponible o respuesta inválida; valores por defecto.",
            ollama_request_seconds=request_s,
            ollama_server_duration_seconds=server_s,
            ollama_total_seconds=total_s,
            approx_prompt_tokens=approx_prompt_tokens,
        )
        logger.info(
            "Ollama: clasificación terminada model=%s fallback=ON total=%.2fs request=%s",
            ollama_model(),
            total_s,
            f"{request_s:.2f}s" if request_s is not None else "n/a",
        )
        return out

    dept = parsed.get("departamento")
    prio = parsed.get("prioridad")
    motivo = parsed.get("motivo")

    dept_ok = isinstance(dept, str) and dept.strip() in VALID_DEPARTMENTS
    prio_ok = isinstance(prio, str) and prio.strip() in VALID_PRIORITIES_LABEL

    if not dept_ok or not prio_ok:
        logger.warning(
            "Ollama: valores fuera de catálogo model=%s dept=%r prio=%r",
            ollama_model(),
            dept,
            prio,
        )
        used_fallback = True
        dept_final = FALLBACK_DEPARTMENT
        prio_label_final = FALLBACK_PRIORITY_LABEL
    else:
        dept_final = dept.strip()
        prio_label_final = prio.strip()

    prio_db = _PRIORITY_LABEL_TO_DB.get(prio_label_final, "medium")

    motivo_str = (str(motivo).strip() if motivo is not None else "")[:2000]
    if not motivo_str:
        motivo_str = "Sin motivo devuelto por el modelo."
        if not used_fallback and dept_ok and prio_ok:
            used_fallback = True

    final_json = {
        "departamento": dept_final,
        "prioridad": prio_label_final,
        "prioridad_db": prio_db,
        "motivo": motivo_str,
    }

    logger.info(
        "Ollama: clasificación terminada model=%s fallback=%s total=%.2fs request=%s server=%s",
        ollama_model(),
        used_fallback,
        total_s,
        f"{request_s:.2f}s" if request_s is not None else "n/a",
        f"{server_s:.2f}s" if server_s is not None else "n/a",
    )

    return {
        "departamento": dept_final,
        "prioridad_label": prio_label_final,
        "prioridad_db": prio_db,
        "motivo": motivo_str,
        "used_fallback": used_fallback,
        "raw_model_json": parsed,
        "final_classification_json": final_json,
        "ollama_request_seconds": request_s,
        "ollama_server_duration_seconds": server_s,
        "ollama_total_seconds": total_s,
        "approx_prompt_tokens": approx_prompt_tokens,
    }

"""
Mango OS — Daily Meta KPIs sync
================================
Corre todos los días a las 6am UTC. Para cada cliente con meta_ad_account_id,
trae los KPIs del día anterior desde la Marketing API y los guarda en Supabase.

Variables de entorno requeridas (vienen de GitHub Secrets):
- META_ACCESS_TOKEN: System User token de Meta
- SUPABASE_URL: URL del proyecto Supabase
- SUPABASE_SERVICE_KEY: service_role key de Supabase (NO la anon)
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
import urllib.request
import urllib.parse
import urllib.error

META_TOKEN = os.environ["META_ACCESS_TOKEN"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
META_API_VERSION = "v21.0"


def http_request(url, method="GET", headers=None, data=None):
    """HTTP helper minimal (sin dependencias externas)."""
    headers = headers or {}
    if data is not None and not isinstance(data, (bytes, str)):
        data = json.dumps(data).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")
    elif isinstance(data, str):
        data = data.encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"raw": body}


def supabase_get(table, select="*", filters=None):
    """SELECT en Supabase via REST."""
    qs = {"select": select}
    if filters:
        qs.update(filters)
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(qs)}"
    status, data = http_request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    if status >= 400:
        raise RuntimeError(f"Supabase GET {table} fallo: {status} {data}")
    return data


def supabase_upsert(table, rows, on_conflict):
    """UPSERT en Supabase via REST."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    status, data = http_request(
        url,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        data=rows,
    )
    if status >= 400:
        raise RuntimeError(f"Supabase UPSERT {table} fallo: {status} {data}")
    return data


def get_meta_insights(ad_account_id, since, until):
    """
    Trae insights de Meta para una ad account entre dos fechas (inclusive).
    Devuelve una lista de dicts, uno por día, con las métricas que necesitamos.
    """
    fields = ",".join([
        "spend", "impressions", "reach", "clicks", "ctr", "cpm", "cpc",
        "frequency", "actions", "action_values", "purchase_roas",
    ])
    params = {
        "fields": fields,
        "level": "account",
        "time_increment": "1",
        "time_range": json.dumps({"since": since, "until": until}),
        "access_token": META_TOKEN,
    }
    url = f"https://graph.facebook.com/{META_API_VERSION}/{ad_account_id}/insights?{urllib.parse.urlencode(params)}"
    status, data = http_request(url)
    if status >= 400:
        print(f"  ⚠️  Meta API error para {ad_account_id}: {status} {data}", file=sys.stderr)
        return []
    return data.get("data", []) if data else []


def parse_action(actions, action_type):
    """Busca un action_type específico en la lista de actions de Meta."""
    if not actions:
        return 0
    for a in actions:
        if a.get("action_type") == action_type:
            try:
                return float(a.get("value", 0))
            except (ValueError, TypeError):
                return 0
    return 0


def build_kpi_row(cliente_id, day_data):
    """Convierte un día de insights de Meta al formato de la tabla kpis_diarios."""
    actions = day_data.get("actions") or []
    action_values = day_data.get("action_values") or []
    purchase_roas = day_data.get("purchase_roas") or []

    # Conversions y purchases (estandar en Meta)
    purchases = parse_action(actions, "purchase") or parse_action(actions, "omni_purchase")
    leads = (
        parse_action(actions, "lead")
        or parse_action(actions, "onsite_conversion.lead_grouped")
        or parse_action(actions, "offsite_conversion.fb_pixel_lead")
    )
    conversions = purchases + leads

    spend = float(day_data.get("spend") or 0)
    cpa = (spend / conversions) if conversions else 0
    cpl = (spend / leads) if leads else 0

    roas = 0
    if purchase_roas:
        try:
            roas = float(purchase_roas[0].get("value") or 0)
        except (ValueError, TypeError, IndexError):
            roas = 0

    return {
        "cliente_id": cliente_id,
        "fecha": day_data.get("date_start"),
        "spend": spend,
        "impressions": int(day_data.get("impressions") or 0),
        "reach": int(day_data.get("reach") or 0),
        "clicks": int(day_data.get("clicks") or 0),
        "ctr": float(day_data.get("ctr") or 0),
        "cpm": float(day_data.get("cpm") or 0),
        "cpc": float(day_data.get("cpc") or 0),
        "frequency": float(day_data.get("frequency") or 0),
        "conversions": int(conversions),
        "purchases": int(purchases),
        "leads": int(leads),
        "cpa": cpa,
        "cpl": cpl,
        "roas": roas,
        "raw_data": day_data,
    }


def main():
    # Determinar rango de fechas: últimos 30 días (incluye ayer). Cubre delays,
    # da data inmediata el primer run, y permite comparativas mensuales.
    # UPSERT por (cliente_id, fecha) hace que reejecutar no duplique nada.
    today = datetime.now(timezone.utc).date()
    until = today - timedelta(days=1)   # ayer
    since = today - timedelta(days=30)  # hace 30 días

    print(f"📅 Sincronizando KPIs desde {since} hasta {until}")

    # 1. Traer clientes con ad account configurado
    clientes = supabase_get(
        "clientes",
        select="id,nombre,meta_ad_account_id",
        filters={"meta_ad_account_id": "not.is.null"},
    )
    if not clientes:
        print("⚠️  No hay clientes con meta_ad_account_id configurado. Saliendo.")
        return

    print(f"🏷️  {len(clientes)} clientes a procesar")

    # 2. Para cada cliente, traer insights y armar las filas
    all_rows = []
    for c in clientes:
        cliente_id = c["id"]
        ad_account = c["meta_ad_account_id"]
        nombre = c["nombre"]

        if not ad_account:
            continue

        print(f"  → {nombre} ({ad_account})")
        days = get_meta_insights(ad_account, str(since), str(until))
        if not days:
            print(f"    sin data (cuenta inactiva o sin spend en el período)")
            continue

        for day in days:
            row = build_kpi_row(cliente_id, day)
            all_rows.append(row)
        print(f"    ✓ {len(days)} días")

    # 3. Upsert a Supabase en batch
    if all_rows:
        print(f"💾 Guardando {len(all_rows)} filas en Supabase...")
        supabase_upsert("kpis_diarios", all_rows, on_conflict="cliente_id,fecha")
        print("✅ Sincronización completa.")
    else:
        print("⚠️  No se generaron filas para guardar.")


if __name__ == "__main__":
    main()

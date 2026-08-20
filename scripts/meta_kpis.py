"""
Mango OS — Daily Meta KPIs sync
================================
Corre todos los días a las 9am UTC. Para cada cliente con meta_ad_account_id:
1. Trae KPIs diarios de los últimos 30 días → tabla kpis_diarios
2. Trae top 3 creativos del mes en curso → campo top_creativos del cliente
3. Trae rankings de calidad/engagement/conversion → mismo registro diario

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
    qs = {"select": select}
    if filters:
        qs.update(filters)
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(qs)}"
    status, data = http_request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    if status >= 400:
        raise RuntimeError(f"Supabase GET {table} fallo: {status} {data}")
    return data


def supabase_upsert(table, rows, on_conflict):
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    status, data = http_request(url, method="POST", headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }, data=rows)
    if status >= 400:
        raise RuntimeError(f"Supabase UPSERT {table} fallo: {status} {data}")
    return data


def supabase_update(table, row_id_field, row_id, patch):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{row_id_field}=eq.{urllib.parse.quote(str(row_id))}"
    status, data = http_request(url, method="PATCH", headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "return=minimal",
    }, data=patch)
    if status >= 400:
        raise RuntimeError(f"Supabase UPDATE {table} fallo: {status} {data}")
    return data


# ── Insights diarios por cuenta ─────────────────────────────────────────────
INSIGHTS_FIELDS = ",".join([
    "spend", "impressions", "reach", "clicks", "ctr", "cpm", "cpc",
    "frequency", "actions", "action_values", "purchase_roas",
    "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
    "video_3_sec_watched_actions", "video_10_sec_watched_actions",
    "video_play_actions",
])


def get_account_insights(ad_account_id, since, until, time_increment="1"):
    """Insights agregados a nivel cuenta. time_increment='1' = un row por día."""
    params = {
        "fields": INSIGHTS_FIELDS,
        "level": "account",
        "time_increment": time_increment,
        "time_range": json.dumps({"since": since, "until": until}),
        "access_token": META_TOKEN,
    }
    url = f"https://graph.facebook.com/{META_API_VERSION}/{ad_account_id}/insights?{urllib.parse.urlencode(params)}"
    status, data = http_request(url)
    if status >= 400:
        print(f"  ⚠️  Meta API error para {ad_account_id}: {status} {data}", file=sys.stderr)
        return []
    return data.get("data", []) if data else []


# ── Top creativos del mes ───────────────────────────────────────────────────
def get_top_ads(ad_account_id, since, until, limit=3):
    """Trae las ads del período ordenadas por spend desc, con thumbnail."""
    fields = ",".join([
        "ad_id", "ad_name", "spend", "impressions", "clicks", "ctr",
        "actions", "purchase_roas",
    ])
    params = {
        "fields": fields,
        "level": "ad",
        "time_range": json.dumps({"since": since, "until": until}),
        "limit": "100",  # traemos hasta 100 y ordenamos en código
        "access_token": META_TOKEN,
    }
    url = f"https://graph.facebook.com/{META_API_VERSION}/{ad_account_id}/insights?{urllib.parse.urlencode(params)}"
    status, data = http_request(url)
    if status >= 400 or not data:
        return []
    ads = data.get("data", [])
    # Ordenar por spend desc
    ads.sort(key=lambda a: float(a.get("spend") or 0), reverse=True)
    top = ads[:limit]

    # Para cada top, traer thumbnail desde el endpoint de ad
    enriched = []
    for ad in top:
        ad_id = ad.get("ad_id")
        thumb = None
        if ad_id:
            thumb_url = f"https://graph.facebook.com/{META_API_VERSION}/{ad_id}?fields=creative{{thumbnail_url}}&access_token={META_TOKEN}"
            s, d = http_request(thumb_url)
            if s < 400 and d:
                thumb = (d.get("creative") or {}).get("thumbnail_url")
        purchases = parse_action(ad.get("actions") or [], "purchase") or parse_action(ad.get("actions") or [], "omni_purchase")
        leads = (
            parse_action(ad.get("actions") or [], "lead")
            or parse_action(ad.get("actions") or [], "onsite_conversion.lead_grouped")
            or parse_action(ad.get("actions") or [], "offsite_conversion.fb_pixel_lead")
        )
        roas = 0
        proas = ad.get("purchase_roas") or []
        if proas:
            try:
                roas = float(proas[0].get("value") or 0)
            except (ValueError, TypeError, IndexError):
                roas = 0
        enriched.append({
            "ad_id": ad_id,
            "name": ad.get("ad_name") or "(sin nombre)",
            "thumbnail": thumb,
            "spend": float(ad.get("spend") or 0),
            "impressions": int(ad.get("impressions") or 0),
            "clicks": int(ad.get("clicks") or 0),
            "ctr": float(ad.get("ctr") or 0),
            "purchases": int(purchases),
            "leads": int(leads),
            "roas": roas,
        })
    return enriched


def parse_action(actions, action_type):
    if not actions:
        return 0
    for a in actions:
        if a.get("action_type") == action_type:
            try:
                return float(a.get("value", 0))
            except (ValueError, TypeError):
                return 0
    return 0


def parse_video_views(actions, kind):
    """kind = '3sec' | '10sec' | 'play' — devuelve total."""
    if not actions:
        return 0
    mapping = {
        "3sec": "video_view",  # algunos accounts mandan 'video_view' en lugar de 3_sec
        "play": "video_play",
    }
    # video_3_sec_watched_actions y video_10_sec_watched_actions son arrays con action_type=video_view
    total = 0
    for a in actions:
        try:
            total += float(a.get("value", 0))
        except (ValueError, TypeError):
            pass
    return int(total)


def build_kpi_row(cliente_id, day_data):
    actions = day_data.get("actions") or []
    purchase_roas = day_data.get("purchase_roas") or []

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

    v3 = parse_video_views(day_data.get("video_3_sec_watched_actions") or [], "3sec")
    v10 = parse_video_views(day_data.get("video_10_sec_watched_actions") or [], "10sec")
    vplay = parse_video_views(day_data.get("video_play_actions") or [], "play")

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
        "quality_ranking": day_data.get("quality_ranking"),
        "engagement_rate_ranking": day_data.get("engagement_rate_ranking"),
        "conversion_rate_ranking": day_data.get("conversion_rate_ranking"),
        "video_views_3s": v3,
        "video_views_10s": v10,
        "video_views_total": vplay,
        "raw_data": day_data,
    }


def main():
    today = datetime.now(timezone.utc).date()
    until = today - timedelta(days=1)
    since = today - timedelta(days=30)

    # Para top creativos: mes calendario actual
    month_start = today.replace(day=1)
    month_until = until  # ayer

    print(f"📅 Sincronizando KPIs diarios desde {since} hasta {until}")
    print(f"🏆 Top creativos: desde {month_start} hasta {month_until}")

    clientes = supabase_get(
        "clientes",
        select="id,nombre,meta_ad_account_id",
        filters={"meta_ad_account_id": "not.is.null"},
    )
    if not clientes:
        print("⚠️  No hay clientes con meta_ad_account_id. Saliendo.")
        return

    print(f"🏷️  {len(clientes)} clientes a procesar")

    all_rows = []
    for c in clientes:
        cliente_id = c["id"]
        ad_account = c["meta_ad_account_id"]
        nombre = c["nombre"]
        if not ad_account:
            continue

        print(f"  → {nombre} ({ad_account})")

        # 1. KPIs diarios
        days = get_account_insights(ad_account, str(since), str(until), time_increment="1")
        if days:
            for day in days:
                all_rows.append(build_kpi_row(cliente_id, day))
            print(f"    ✓ {len(days)} días de KPIs")
        else:
            print(f"    sin actividad reciente")

        # 2. Top creativos del mes calendario
        try:
            top = get_top_ads(ad_account, str(month_start), str(month_until), limit=3)
            if top:
                supabase_update("clientes", "id", cliente_id, {"top_creativos": top})
                print(f"    ✓ {len(top)} top creativos del mes")
            else:
                supabase_update("clientes", "id", cliente_id, {"top_creativos": []})
        except Exception as e:
            print(f"    ⚠️  Error trayendo top creativos: {e}", file=sys.stderr)

    if all_rows:
        print(f"💾 Guardando {len(all_rows)} filas en kpis_diarios...")
        supabase_upsert("kpis_diarios", all_rows, on_conflict="cliente_id,fecha")
        print("✅ Sincronización completa.")
    else:
        print("⚠️  Sin filas de KPIs para guardar.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch a 2001-2025 daily climate record from NASA POWER and write data/climate/<region>.json.

Standard library only. Examples:
    python3 data-pipeline/fetch_climate.py --region barind
    python3 data-pipeline/fetch_climate.py --region all
    python3 data-pipeline/fetch_climate.py --region haor --probe     # only test IMERG_PRECTOT

Source: NASA POWER Daily API (https://power.larc.nasa.gov), community AG.
Output schema: docs/SPEC.md, "Data contract" (columnar, one array per line).
"""
import argparse, datetime as dt, json, sys, time, urllib.parse, urllib.request
from pathlib import Path

API = "https://power.larc.nasa.gov/api/temporal/daily/point"
FARM_PARAMS = ["PRECTOTCORR", "T2M_MAX", "T2M_MIN", "GWETROOT", "GWETTOP", "ALLSKY_SFC_SW_DWN"]
IMERG = "IMERG_PRECTOT"
FILL = -999.0
HERE = Path(__file__).resolve().parent
RETRIES = 3
PAUSE = 5.0
SOURCE = "NASA POWER Daily API, community AG"
PARAM_MAP = {"rainFarm": "PRECTOTCORR", "tmax": "T2M_MAX", "tmin": "T2M_MIN",
             "soil": "GWETROOT", "soilTop": "GWETTOP", "rad": "ALLSKY_SFC_SW_DWN"}


def log(msg):
    print(msg, file=sys.stderr)


# ---------------------------------------------------------------- pure functions

def clean(v, default=0.0):
    """-999 (POWER fill) or None becomes `default`; anything else a float."""
    return default if v is None or v <= FILL + 1 else float(v)


def is_missing(v):
    return v is None or v <= FILL + 1


def parse_date(s):
    if isinstance(s, dt.date):
        return s
    s = str(s)
    return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def iter_dates(start, end):
    """Yield every date from start to end inclusive. Accepts 'YYYYMMDD' or date objects."""
    d, e = parse_date(start), parse_date(end)
    while d <= e:
        yield d
        d += dt.timedelta(days=1)


def chunk_ranges(start, end, years=5):
    """Split [start, end] into consecutive ranges of at most `years` calendar years."""
    s, e = parse_date(start), parse_date(end)
    out = []
    y = s.year
    while y <= e.year:
        a = max(s, dt.date(y, 1, 1))
        b = min(e, dt.date(y + years - 1, 12, 31))
        out.append((a.strftime("%Y%m%d"), b.strftime("%Y%m%d")))
        y += years
    return out


def to_columns(farm_params, up_rain, start, end):
    """Turn POWER {param: {YYYYMMDD: value}} dicts into columnar arrays.

    farm_params: dict of parameter -> {date key: value}. Needs the six FARM_PARAMS,
                 and optionally IMERG_PRECTOT (-> rainImerg).
    up_rain:     {date key: value} for the upstream point, or None to copy rainFarm.
    Returns (columns, fills). Every date from start to end gets a value; a date absent
    from the response counts as missing, exactly like a -999 value.
    """
    cols = {k: [] for k in ("rainFarm", "rainUp", "tmax", "tmin", "soil", "soilTop", "rad")}
    has_imerg = IMERG in farm_params
    if has_imerg:
        cols["rainImerg"] = []
    fills = 0
    prev_rad = None
    P = farm_params
    for d in iter_dates(start, end):
        k = d.strftime("%Y%m%d")
        raw = {name: P[par].get(k) for name, par in PARAM_MAP.items()}
        for name, v in raw.items():
            if is_missing(v):
                fills += 1
        cols["rainFarm"].append(round(clean(raw["rainFarm"]), 1))
        cols["tmax"].append(round(clean(raw["tmax"], 30.0), 1))
        cols["tmin"].append(round(clean(raw["tmin"], 21.0), 1))
        cols["soil"].append(round(clean(raw["soil"], 0.5), 3))
        cols["soilTop"].append(round(clean(raw["soilTop"], 0.5), 3))
        if is_missing(raw["rad"]):
            rad = prev_rad if prev_rad is not None else 15.0
        else:
            rad = float(raw["rad"])
        prev_rad = rad
        cols["rad"].append(round(rad, 2))
        if up_rain is None:
            cols["rainUp"].append(cols["rainFarm"][-1])
        else:
            v = up_rain.get(k)
            if is_missing(v):
                fills += 1
            cols["rainUp"].append(round(clean(v), 1))
        if has_imerg:
            v = P[IMERG].get(k)
            if is_missing(v):
                fills += 1
            cols["rainImerg"].append(round(clean(v), 1))
    return cols, fills


def build_output(region, reg, start, end, farm_params, up_rain, fetched=None):
    s, e = parse_date(start), parse_date(end)
    cols, fills = to_columns(farm_params, up_rain, s, e)
    n = (e - s).days + 1
    for k, arr in cols.items():
        assert len(arr) == n, f"{k}: length {len(arr)} != n {n}"
    params = dict(PARAM_MAP)
    if "rainImerg" in cols:
        params["rainImerg"] = IMERG
    up = reg["upstream"]
    out = {
        "id": f"{region}-climate", "region": region, "sample": False, "source": SOURCE,
        "parameters": params,
        "points": {"farm": {"lat": reg["farm"]["lat"], "lon": reg["farm"]["lon"]},
                   "upstream": {"lat": up["lat"], "lon": up["lon"]}},
        "start": s.isoformat(), "n": n,
        "fetched": (fetched or dt.date.today()).isoformat(),
        "missing_values_filled": fills,
    }
    out.update(cols)
    return out


def serialize(out):
    """Compact JSON, one top-level key (so one array) per line."""
    sep = (",", ":")
    lines = [json.dumps(k) + ":" + json.dumps(v, separators=sep) for k, v in out.items()]
    return "{\n" + ",\n".join(lines) + "\n}\n"


# ---------------------------------------------------------------- network

def request(lat, lon, params, start, end, timeout=180):
    """One POWER request. Returns {param: {YYYYMMDD: value}}. Raises on any failure."""
    q = urllib.parse.urlencode({
        "parameters": ",".join(params), "community": "AG",
        "latitude": lat, "longitude": lon, "start": start, "end": end, "format": "JSON",
    })
    url = f"{API}?{q}"
    log(f"GET {url}")
    with urllib.request.urlopen(url, timeout=timeout) as r:
        body = json.load(r)
    p = body.get("properties", {}).get("parameter")
    if not p:
        raise RuntimeError(f"unexpected response: {json.dumps(body)[:300]}")
    return p


def with_retries(fn, what, retries=RETRIES, pause=PAUSE):
    last = None
    for i in range(1, retries + 1):
        try:
            return fn()
        except Exception as ex:  # HTTPError, URLError, timeout, bad JSON
            last = ex
            log(f"  {what}: attempt {i}/{retries} failed: {ex}")
            if i < retries:
                time.sleep(pause)
    raise last


def fetch_series(lat, lon, params, start, end, requester=request, pause=PAUSE):
    """Fetch the full range; on failure fall back to 5-year chunks and stitch."""
    try:
        p = with_retries(lambda: requester(lat, lon, params, start, end), "full range", pause=pause)
        missing = [k for k in params if k not in p]
        if missing:
            raise RuntimeError(f"POWER did not return {missing}")
        return p
    except Exception as ex:
        log(f"Long request failed ({ex}); falling back to 5-year chunks")
    merged = {k: {} for k in params}
    for a, b in chunk_ranges(start, end):
        p = with_retries(lambda: requester(lat, lon, params, a, b), f"chunk {a}-{b}", pause=pause)
        for k in params:
            if k not in p:
                raise RuntimeError(f"POWER did not return {k} for {a}-{b}")
            merged[k].update(p[k])
    return merged


def probe_imerg(lat, lon, requester=request):
    """Request 3 days of IMERG_PRECTOT alone. Returns True only if real values come back.
    Never raises."""
    try:
        p = requester(lat, lon, [IMERG], "20200101", "20200103")
        vals = p.get(IMERG)
        if vals and any(not is_missing(v) for v in vals.values()):
            log(f"IMERG_PRECTOT available from POWER daily API (sample: {dict(list(vals.items())[:3])})")
            return True
        log("IMERG_PRECTOT not available from POWER daily API (parameter omitted or all fill values)")
    except Exception as ex:
        log(f"IMERG_PRECTOT not available from POWER daily API (error: {ex})")
    return False


def run_region(name, reg, a):
    farm_pt, up_pt = reg["farm"], reg["upstream"]
    imerg = probe_imerg(farm_pt["lat"], farm_pt["lon"])
    if a.probe:
        return
    params = FARM_PARAMS + ([IMERG] if imerg else [])
    try:
        farm = fetch_series(farm_pt["lat"], farm_pt["lon"], params, a.start, a.end)
    except Exception as ex:
        if not imerg:
            raise
        log(f"Farm request with IMERG failed ({ex}); retrying without IMERG")
        imerg = False
        farm = fetch_series(farm_pt["lat"], farm_pt["lon"], FARM_PARAMS, a.start, a.end)
    if (up_pt["lat"], up_pt["lon"]) == (farm_pt["lat"], farm_pt["lon"]):
        up = None
    else:
        up = fetch_series(up_pt["lat"], up_pt["lon"], ["PRECTOTCORR"], a.start, a.end)["PRECTOTCORR"]
    out = build_output(name, reg, a.start, a.end, farm, up)
    d = Path(a.out_dir)
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{name}.json"
    path.write_text(serialize(out), encoding="utf-8", newline="\n")
    years = f"{parse_date(a.start).year}-{parse_date(a.end).year}"
    print(f"{name}: years {years}, n={out['n']}, fills={out['missing_values_filled']}, "
          f"IMERG={'yes' if 'rainImerg' in out else 'no'}, {path.stat().st_size / 1e6:.2f} MB -> {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--region", default="barind", help="haor | barind | coast | all")
    ap.add_argument("--start", default="20010101")
    ap.add_argument("--end", default="20251231")
    ap.add_argument("--out-dir", default="data/climate")
    ap.add_argument("--probe", action="store_true", help="only test whether POWER serves IMERG_PRECTOT")
    a = ap.parse_args()
    regions = json.loads((HERE / "regions.json").read_text())
    names = list(regions) if a.region == "all" else [a.region]
    for n in names:
        if n not in regions:
            sys.exit(f"Unknown region {n!r}. Choose from {list(regions)} or 'all'.")
    for n in names:
        run_region(n, regions[n], a)


if __name__ == "__main__":
    main()

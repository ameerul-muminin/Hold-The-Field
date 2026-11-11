#!/usr/bin/env python3
"""Fetch MODIS MOD13Q1 250 m 16-day NDVI at each region's farm point and write data/ndvi/<region>.json.

Standard library only. Examples:
    python3 data-pipeline/fetch_ndvi.py --region barind
    python3 data-pipeline/fetch_ndvi.py --region all

Source: ORNL DAAC MODIS/VIIRS Land Product Subsets REST API (https://modis.ornl.gov/rst/api/v1/).
The endpoint structure was NOT verified when this was written, so the code prints the top-level
keys and one subset entry on the first response and exits with a clear message if the shape differs.
"""
import argparse, datetime as dt, json, sys, time, urllib.parse, urllib.request
from pathlib import Path

BASE = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
BAND = "250m_16_days_NDVI"
BATCH = 10
MISSING_RAW = -3000          # raw values <= this are fill / no-data
DEFAULT_SCALE = 0.0001
RETRIES = 3
PAUSE = 0.3
RETRY_PAUSE = 5.0
HERE = Path(__file__).resolve().parent
_printed = {"subset": False}


def log(msg):
    print(msg, file=sys.stderr)


def get_json(url, retries=RETRIES):
    last = None
    for i in range(1, retries + 1):
        try:
            log(f"GET {url}")
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                body = json.load(r)
            time.sleep(PAUSE)
            return body
        except Exception as ex:
            last = ex
            log(f"  attempt {i}/{retries} failed: {ex}")
            if i < retries:
                time.sleep(RETRY_PAUSE)
    sys.exit(f"Request failed after {retries} attempts: {last}\nURL: {url}")


def modis_to_iso(md):
    """'A2001049' -> '2001-02-18'."""
    return (dt.date(int(md[1:5]), 1, 1) + dt.timedelta(days=int(md[5:8]) - 1)).isoformat()


def parse_dates(body):
    """Return [(modis_date, iso_date)] from the /dates response, or exit with a message."""
    items = body.get("dates") if isinstance(body, dict) else None
    if not isinstance(items, list) or not items:
        sys.exit("Unexpected /dates response (expected a non-empty 'dates' list). "
                 f"Top-level keys: {list(body) if isinstance(body, dict) else type(body).__name__}")
    out = []
    for it in items:
        md = it.get("modis_date") if isinstance(it, dict) else None
        if not md or not str(md).startswith("A") or len(md) < 8:
            sys.exit(f"Unexpected /dates entry (no 'modis_date' like A2001049): {it!r}")
        out.append((md, it.get("calendar_date") or modis_to_iso(md)))
    return sorted(out, key=lambda t: t[0])


def parse_subset(body):
    """Return ([(iso_date, ndvi or None)], skipped_count) from a /subset response."""
    if not isinstance(body, dict) or not isinstance(body.get("subset"), list):
        sys.exit("Unexpected /subset response (expected a 'subset' list). "
                 f"Top-level keys: {list(body) if isinstance(body, dict) else type(body).__name__}")
    try:
        scale = float(body.get("scale", DEFAULT_SCALE))
    except (TypeError, ValueError):
        scale = DEFAULT_SCALE
    out, skipped = [], 0
    for e in body["subset"]:
        data = e.get("data") if isinstance(e, dict) else None
        if not isinstance(data, list) or not data:
            sys.exit(f"Unexpected subset entry (no 'data' list): {json.dumps(e)[:300]}")
        date = e.get("calendar_date") or (modis_to_iso(e["modis_date"]) if e.get("modis_date") else None)
        if not date:
            sys.exit(f"Subset entry has neither calendar_date nor modis_date: {json.dumps(e)[:300]}")
        raw = data[0]
        if raw is None or raw <= MISSING_RAW:
            skipped += 1
            continue
        out.append((date, round(raw * scale, 3)))
    return out, skipped


def fetch_region(name, reg, y0, y1):
    lat, lon = reg["farm"]["lat"], reg["farm"]["lon"]
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon})
    dates = parse_dates(get_json(f"{BASE}/dates?{q}"))
    dates = [d for d in dates if y0 <= int(d[0][1:5]) <= y1]
    if not dates:
        sys.exit(f"No composite dates between {y0} and {y1} for {name}.")
    series, skipped = [], 0
    for i in range(0, len(dates), BATCH):
        b = dates[i:i + BATCH]
        q = urllib.parse.urlencode({
            "latitude": lat, "longitude": lon, "startDate": b[0][0], "endDate": b[-1][0],
            "kmAboveBelow": 0, "kmLeftRight": 0, "band": BAND})
        body = get_json(f"{BASE}/subset?{q}")
        if not _printed["subset"]:
            _printed["subset"] = True
            log(f"First subset response top-level keys: {list(body) if isinstance(body, dict) else type(body)}")
            sub = body.get("subset") if isinstance(body, dict) else None
            log(f"First subset entry: {json.dumps(sub[0])[:600] if sub else 'NONE'}")
            log(f"scale in response: {body.get('scale') if isinstance(body, dict) else None} (default {DEFAULT_SCALE})")
        pts, sk = parse_subset(body)
        series += pts
        skipped += sk
        log(f"  {name}: {min(i + BATCH, len(dates))}/{len(dates)} composites")
    series = sorted(set(series))
    return {"id": f"{name}-ndvi", "product": "MOD13Q1", "point": {"lat": lat, "lon": lon},
            "fetched": dt.date.today().isoformat(),
            "source": "ORNL DAAC MODIS/VIIRS Land Product Subsets, MOD13Q1 250m_16_days_NDVI",
            "series": [{"date": d, "ndvi": v} for d, v in series]}, skipped, len(dates)


def serialize(out):
    sep = (",", ":")
    head = ",\n".join(json.dumps(k) + ":" + json.dumps(v, separators=sep) for k, v in out.items() if k != "series")
    rows = ",\n".join(json.dumps(r, separators=sep) for r in out["series"])
    return "{\n" + head + ',\n"series":[\n' + rows + "\n]\n}\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--region", default="barind", help="barind | haor | coast | all")
    ap.add_argument("--start-year", type=int, default=2001)
    ap.add_argument("--end-year", type=int, default=2025)
    ap.add_argument("--out-dir", default="data/ndvi")
    a = ap.parse_args()
    regions = json.loads((HERE / "regions.json").read_text())
    names = list(regions) if a.region == "all" else [a.region]
    for n in names:
        if n not in regions:
            sys.exit(f"Unknown region {n!r}. Choose from {list(regions)} or 'all'.")
    d = Path(a.out_dir)
    d.mkdir(parents=True, exist_ok=True)
    for n in names:
        out, skipped, total = fetch_region(n, regions[n], a.start_year, a.end_year)
        path = d / f"{n}.json"
        path.write_text(serialize(out), encoding="utf-8", newline="\n")
        print(f"{n}: {len(out['series'])} composites kept of {total}, {skipped} missing skipped, "
              f"{path.stat().st_size / 1e3:.0f} KB -> {path}")


if __name__ == "__main__":
    main()

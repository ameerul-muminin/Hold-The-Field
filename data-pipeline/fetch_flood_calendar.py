#!/usr/bin/env python3
"""Build the haor flood calendar from many years of NASA POWER daily rain in the hills upstream.

For every year it records the first spring day (from 1 March) on which the 3-day upstream rain total reached the
game scout's WATCH and FLOOD WARNING levels (src/sim/config.js: watchMm, warningMm). The web app's "My field today"
screen turns this into "in N of the last Y years, warning-level rain came before your harvest date".

Standard library only. Example:
    python3 data-pipeline/fetch_flood_calendar.py --out data/haor-flood-calendar.json

Source: NASA POWER Daily API (https://power.larc.nasa.gov), community AG, parameter PRECTOTCORR.
"""
import argparse, datetime as dt, json, sys, urllib.parse, urllib.request
from pathlib import Path

API = "https://power.larc.nasa.gov/api/temporal/daily/point"
HERE = Path(__file__).resolve().parent
WATCH_MM, WARNING_MM = 100, 150      # keep in step with watchMm / warningMm in src/sim/config.js


def fetch(lat, lon, start, end):
    q = urllib.parse.urlencode({
        "parameters": "PRECTOTCORR", "community": "AG",
        "latitude": lat, "longitude": lon, "start": start, "end": end, "format": "JSON",
    })
    url = f"{API}?{q}"
    print(f"GET {url}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=180) as r:
        body = json.load(r)
    p = body.get("properties", {}).get("parameter", {}).get("PRECTOTCORR")
    if not p:
        sys.exit(f"Unexpected response: {json.dumps(body)[:500]}")
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--first", type=int, default=2001)
    ap.add_argument("--last", type=int, default=dt.date.today().year - 1)
    ap.add_argument("--out", default="data/haor-flood-calendar.json")
    a = ap.parse_args()

    reg = json.loads((HERE / "regions.json").read_text())["haor"]
    up = reg["upstream"]
    rain = fetch(up["lat"], up["lon"], f"{a.first}0101", f"{a.last}0630")

    years, gaps = [], 0
    for y in range(a.first, a.last + 1):
        day = dt.date(y, 2, 26)          # start early so 1 March already has a full 3-day window
        window = []
        first_watch = first_warning = None
        peak, peak_date = 0.0, None
        while day <= dt.date(y, 5, 31):
            v = rain.get(day.strftime("%Y%m%d"))
            if v is None or v <= -998:
                gaps += 1
                v = 0.0
            window = (window + [v])[-3:]
            if day >= dt.date(y, 3, 1):
                s = sum(window)
                if s > peak:
                    peak, peak_date = s, day
                if first_watch is None and s >= WATCH_MM:
                    first_watch = day.isoformat()
                if first_warning is None and s >= WARNING_MM:
                    first_warning = day.isoformat()
            day += dt.timedelta(days=1)
        years.append({"year": y, "firstWatch": first_watch, "firstWarning": first_warning,
                      "peak3dayMm": round(peak, 1), "peakDate": peak_date.isoformat() if peak_date else None})

    out = {
        "id": Path(a.out).stem,
        "region": "haor",
        "source": "NASA POWER Daily API, community AG (PRECTOTCORR)",
        "point": {"lat": up["lat"], "lon": up["lon"], "name": up["name"]},
        "window": "1 March to 31 May, 3-day rain totals",
        "thresholdsMm": {"watch": WATCH_MM, "warning": WARNING_MM},
        "missing_values_filled": gaps,
        "fetched": dt.date.today().isoformat(),
        "years": years,
    }
    Path(a.out).write_text(json.dumps(out, indent=1) + "\n")
    warned = sum(1 for y in years if y["firstWarning"])
    print(f"Wrote {a.out}: {len(years)} years, {warned} with warning-level rain, {gaps} missing values", file=sys.stderr)


if __name__ == "__main__":
    main()

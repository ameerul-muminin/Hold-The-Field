## Climate record and NDVI (Rotation Lab)

Run from the repo root (needs network; standard library only):

```
python3 data-pipeline/fetch_climate.py --region all
python3 data-pipeline/fetch_ndvi.py --region all
```

Unit tests for the climate fetcher (no network): `python3 data-pipeline/test_fetch_climate.py`.

**`data/climate/<region>.json`** - daily NASA POWER record 2001-01-01 to 2025-12-31 (9131 days),
columnar, one array per line: `rainFarm`, `rainUp`, `tmax`, `tmin`, `soil` (GWETROOT), `soilTop`
(GWETTOP), `rad`, plus `rainImerg` only if POWER serves `IMERG_PRECTOT`. Missing values (-999) are
filled and counted in `missing_values_filled`. Schema: `docs/SPEC.md`, "Data contract".

**`data/ndvi/<region>.json`** - NOT BUILT: no NDVI file has been downloaded and no code reads one, so no MODIS data is
used or claimed anywhere. The fetcher below is unrun. Planned content: MODIS MOD13Q1 250 m 16-day NDVI at the farm point from the ORNL DAAC
subset API: `series` of `{date, ndvi}`; missing composites are skipped and counted in the console summary.

Expected run time: climate about 1-3 minutes per region (more if it falls back to 5-year chunks);
NDVI about 600 composites per region in batches of 10, so roughly 1-3 minutes per region with the 0.3 s pause.

**After the first run:** the IMERG probe result (look for "IMERG_PRECTOT available / not available from
POWER daily API" in the console) must be copied into `docs/DATA.md`. The NDVI endpoint was not verified
beforehand; check the "First subset response" lines printed to stderr.

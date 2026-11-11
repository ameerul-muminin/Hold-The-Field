# Validation: what the Rotation Lab gets right, and what it does not

Status: 11 Nov 2026. Written by the AI lead from the code's own output; the team's research lead must review it.

## 1. Backtest: haor flash floods

The model replays long-duration boro (BRRI dhan29, transplanted 5 January, 118 days in the field) against NASA POWER
daily rain for 2001-2025. It is NOT told which years flooded. The flood rule is the one already calibrated on the
2017 season (`docs/DATA.md`): three-day rain at the upstream point in the Meghalaya hills feeds a one-bucket water level.

| | Years the crop is lost |
|---|---|
| Long-duration boro (existing practice) | 2004, 2010, 2016, 2017, 2022 |
| Short-duration boro (BRRI dhan28, 98 days in the field) | 2017 |

Check against documented flash floods that damaged boro in the north-east haor:

| Year | Documented? | Source |
|---|---|---|
| 2017 | Yes | https://www.banglajol.info/index.php/JESNR/article/view/52007 |
| 2022 | Yes (Sunamganj, from 1 April) | https://www.thedailystar.net/environment/climate-crisis/natural-disaster/news/flash-flood-horror-haor-3001551 |
| 2004 | Not yet verified by us | add a source or mark as a model-only result |
| 2010 | Not yet verified by us | add a source or mark as a model-only result |
| 2016 | Not yet verified by us | add a source or mark as a model-only result |

Also to check: documented flood years the model MISSES. None is known to us yet; that is not the same as none existing.

Caveat: the flood thresholds were fitted to 2017, so 2017 is not an independent test. The other four years are.

## 2. Barind and coast

No crop is "lost" in any year in these regions because the model has no flood, salinity or crop-failure rule there;
yields only fall with water shortage and heat. Treat the Barind and coast results as a comparison of water demand,
bare-field time and soil traits, not as a risk forecast. A documented drought year to test against: 2006
(north-west output down 25-30%, https://pmc.ncbi.nlm.nih.gov/articles/PMC9712418). In the model 2006 is among the
three worst years for Mustard - Boro - T. Aman and for the coast's existing rotation, and not for the others.

## 3. Known weaknesses

- Yield response to water shortage (Ky) is unsourced for rice and mustard; a default of 1.0 is used and shown as a gap.
- Winter crops (lentil, mustard, sunflower) are treated as fully rainfed, with a 100 mm root-zone store unless the
  farmer picks a soil. Lentil scores low as a result; real lentil is grown on residual moisture and may do better.
- Hargreaves reference evapotranspiration tends to overestimate in humid monsoon months.
- Rice water demand ignores puddling and percolation, so irrigation figures for boro are too low in absolute terms.
  Use them to compare rotations, not as a pumping requirement.
- Soil store capacities by soil type (clay 140, loam 110, sandy 60 mm) are placeholders with no source yet.
- The soil health figure is built from rotation traits (legume, crop families, bare days, root depth). It is an
  indicator, never a measurement; residue, fodder, erosion cover and organic matter have no sourced values yet.
- One NASA POWER cell is about 50 km wide. No field-scale data is used.
- GPM IMERG: NASA POWER's daily API did not return `IMERG_PRECTOT` on 11 Nov 2026, so no GPM data is used or claimed.
- MODIS NDVI: fetcher written (`data-pipeline/fetch_ndvi.py`) but no data downloaded yet, so none is used or claimed.

## 4. Field test (to do, Thursday 12 Nov)

3 to 5 farmers or one extension officer use `lab.html` on a phone. Record in `docs/FIELD_TEST.md`: what they tapped
first, what they could not understand, whether the result matched their experience, what they would change.

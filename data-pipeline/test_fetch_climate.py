import datetime as dt, json, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_climate as fc


def fake_params(days, with_imerg=False):
    """days: list of 'YYYYMMDD' keys present in the fake response."""
    p = {k: {} for k in fc.FARM_PARAMS + ([fc.IMERG] if with_imerg else [])}
    for i, k in enumerate(days):
        p["PRECTOTCORR"][k] = 1.26 + i
        p["T2M_MAX"][k] = 35.04
        p["T2M_MIN"][k] = 22.06
        p["GWETROOT"][k] = 0.41234
        p["GWETTOP"][k] = 0.3
        p["ALLSKY_SFC_SW_DWN"][k] = 18.567
        if with_imerg:
            p[fc.IMERG][k] = 2.0
    return p


class Pure(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(fc.clean(-999), 0.0)
        self.assertEqual(fc.clean(None, 30.0), 30.0)
        self.assertEqual(fc.clean(-999.0, 0.5), 0.5)
        self.assertEqual(fc.clean(3.2), 3.2)
        self.assertEqual(fc.clean(0), 0.0)

    def test_iter_dates(self):
        d = list(fc.iter_dates("20200228", "20200302"))
        self.assertEqual(len(d), 4)  # leap year
        self.assertEqual(d[1], dt.date(2020, 2, 29))
        self.assertEqual(len(list(fc.iter_dates("20010101", "20251231"))), 9131)

    def test_chunks(self):
        c = fc.chunk_ranges("20010101", "20251231")
        self.assertEqual(c[0], ("20010101", "20051231"))
        self.assertEqual(c[-1], ("20210101", "20251231"))
        self.assertEqual(len(c), 5)

    def test_to_columns_fills_and_missing_day(self):
        keys = ["20200101", "20200102", "20200104"]  # 0103 missing entirely
        p = fake_params(keys)
        p["PRECTOTCORR"]["20200102"] = -999
        p["ALLSKY_SFC_SW_DWN"]["20200102"] = -999
        p["T2M_MAX"]["20200104"] = -999
        cols, fills = fc.to_columns(p, None, "20200101", "20200104")
        for k, arr in cols.items():
            self.assertEqual(len(arr), 4, k)
        self.assertEqual(cols["rainFarm"][:2], [1.3, 0.0])
        self.assertEqual(cols["rainFarm"][2], 0.0)          # missing day
        self.assertEqual(cols["tmax"], [35.0, 35.0, 30.0, 30.0])
        self.assertEqual(cols["tmin"][2], 21.0)
        self.assertEqual(cols["soil"][2], 0.5)
        self.assertEqual(cols["rad"], [18.57, 18.57, 18.57, 18.57])  # carried
        self.assertEqual(cols["rainUp"], cols["rainFarm"])
        # day2: rain+rad = 2; day3: all six; day4: tmax = 1
        self.assertEqual(fills, 2 + 6 + 1)

    def test_rad_default_first_day(self):
        p = fake_params(["20200101"])
        p["ALLSKY_SFC_SW_DWN"]["20200101"] = -999
        cols, _ = fc.to_columns(p, None, "20200101", "20200101")
        self.assertEqual(cols["rad"], [15.0])

    def test_upstream_and_imerg(self):
        keys = ["20200101", "20200102"]
        p = fake_params(keys, with_imerg=True)
        up = {"20200101": 50.55, "20200102": -999}
        cols, fills = fc.to_columns(p, up, "20200101", "20200102")
        self.assertEqual(cols["rainUp"][1], 0.0)
        self.assertEqual(cols["rainImerg"], [2.0, 2.0])
        self.assertEqual(fills, 1)

    def test_build_and_serialize(self):
        keys = [d.strftime("%Y%m%d") for d in fc.iter_dates("20200101", "20200110")]
        reg = {"farm": {"lat": 1.5, "lon": 2.5}, "upstream": {"lat": 1.5, "lon": 2.5, "name": "x"}}
        out = fc.build_output("barind", reg, "20200101", "20200110", fake_params(keys), None,
                              fetched=dt.date(2026, 11, 11))
        self.assertEqual(out["n"], 10)
        self.assertEqual(out["id"], "barind-climate")
        self.assertNotIn("rainImerg", out["parameters"])
        self.assertEqual(out["start"], "2020-01-01")
        txt = fc.serialize(out)
        back = json.loads(txt)
        self.assertEqual(back["rad"], out["rad"])
        self.assertEqual(back["points"]["upstream"], {"lat": 1.5, "lon": 2.5})
        self.assertEqual(txt.count("\n"), len(out) + 2)
        self.assertNotIn("\r", txt)


class Network(unittest.TestCase):
    def test_fallback_to_chunks(self):
        calls = []

        def requester(lat, lon, params, start, end):
            calls.append((start, end))
            if (start, end) == ("20010101", "20101231"):
                raise TimeoutError("boom")
            keys = [d.strftime("%Y%m%d") for d in fc.iter_dates(start, end)]
            return fake_params(keys)

        p = fc.fetch_series(1, 2, fc.FARM_PARAMS, "20010101", "20101231", requester, pause=0)
        self.assertEqual(calls.count(("20010101", "20101231")), 3)  # 3 retries
        self.assertIn(("20010101", "20051231"), calls)
        self.assertEqual(len(p["PRECTOTCORR"]), 3652)
        cols, fills = fc.to_columns(p, None, "20010101", "20101231")
        self.assertEqual(fills, 0)

    def test_probe_never_raises(self):
        def boom(*a):
            raise OSError("422")
        self.assertFalse(fc.probe_imerg(1, 2, boom))
        self.assertFalse(fc.probe_imerg(1, 2, lambda *a: {"PRECTOTCORR": {}}))
        self.assertFalse(fc.probe_imerg(1, 2, lambda *a: {fc.IMERG: {"20200101": -999}}))
        self.assertTrue(fc.probe_imerg(1, 2, lambda *a: {fc.IMERG: {"20200101": 1.2}}))


if __name__ == "__main__":
    unittest.main()

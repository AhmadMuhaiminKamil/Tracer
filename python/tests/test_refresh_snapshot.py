import json
import tempfile
import unittest
from pathlib import Path

from insideriq import build_brief, detect_clusters, is_genuine_transaction
from refresh_snapshot import extract_fundamentals, rebuild_from_cache


class RefreshSnapshotTests(unittest.TestCase):
    def test_extracts_latest_ratios_and_price_ranges(self):
        report = {
            "company_name": "PT Test",
            "overview": {
                "sector": "Healthcare",
                "sub_sector": "Hospitals",
                "market_cap": 1000,
                "last_close_price": 90,
                "latest_close_date": "2026-09-15",
                "all_time_price": {
                    "52_w_low": {"2026-01-01": 50},
                    "52_w_high": {"2026-02-01": 100},
                    "all_time_high": {"2025-01-01": 120},
                },
            },
            "valuation": {"historical_valuation": [{"year": 2026, "pe": 12, "pb": 2}]},
            "financials": {
                "historical_financial_ratio": [{"year": "2025", "profitability": {"roe": 0.1}, "leverage": {"debt_to_equity_ratio": 0.4}}],
                "yoy_quarter_revenue_growth": 0.2,
                "yoy_quarter_earnings_growth": -0.1,
            },
        }
        got = extract_fundamentals(report)
        self.assertEqual(got["company_name"], "PT Test")
        self.assertEqual(got["pe"], 12)
        self.assertEqual(got["roe"], 0.1)
        self.assertEqual(got["ratio_year"], "2025")
        self.assertEqual(got["valuation_year"], 2026)
        self.assertNotIn("roe_ttm", got)
        self.assertEqual(got["low_52w"], 50)
        self.assertEqual(got["high_ath"], 120)

    def test_rebuild_uses_cache_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rows = [
                {"symbol": "TEST.JK", "timestamp": "2026-09-01T00:00:00", "transaction_type": "buy", "holder_name": "A", "transaction_value": 10, "body": "buy", "tags": [], "source": "x"},
                {"symbol": "TEST.JK", "timestamp": "2026-09-02T00:00:00", "transaction_type": "buy", "holder_name": "B", "transaction_value": 20, "body": "buy", "tags": [], "source": "y"},
            ]
            (root / "reports").mkdir()
            (root / "filings.json").write_text(json.dumps(rows))
            report = {"company_name": "PT Test", "overview": {"all_time_price": {}}, "valuation": {}, "financials": {}}
            (root / "reports" / "TEST.json").write_text(json.dumps(report))
            snapshot = rebuild_from_cache(root / "filings.json", root / "reports")
            self.assertEqual(snapshot["payload"]["clusters"][0]["fundamentals"]["company_name"], "PT Test")
            self.assertIn("bukan rekomendasi", snapshot["payload"]["clusters"][0]["summary"])
            self.assertNotEqual(snapshot["source_updated_at"], "2026-09-02T00:00:00Z")
            self.assertEqual(snapshot["latest_filing_timestamp"], "2026-09-02T00:00:00")
            self.assertEqual(snapshot["filing_timezone"], "unspecified by upstream")


if __name__ == "__main__":
    unittest.main()

import tempfile
import unittest
from pathlib import Path

from insideriq import build_brief, detect_clusters, is_genuine_transaction, save_signal


class InsiderIQTests(unittest.TestCase):
    def test_filters_non_informative_filings(self):
        self.assertFalse(is_genuine_transaction({"body": "Perolehan saham melalui program ESOP", "tags": []}))
        self.assertFalse(is_genuine_transaction({"body": "Transaksi pasar", "tags": ["placement"]}))
        self.assertFalse(is_genuine_transaction({"body": "Bought via repurchase-agreement", "tags": ["repurchase-agreement"]}))
        self.assertTrue(is_genuine_transaction({"body": "Pembelian saham melalui pasar reguler", "tags": ["insider-trading"]}))
        # live-data regression: these words appear in genuine purchases
        self.assertTrue(is_genuine_transaction({"body": "buy part of portfolio rebalancing", "tags": ["investment"]}))
        self.assertTrue(is_genuine_transaction({"body": "settlement of dividend payable acknowledgment", "tags": ["investment"]}))

    def test_cluster_requires_two_unique_holders_in_same_direction(self):
        filings = [
            {"symbol": "ABCD.JK", "timestamp": "2026-09-01T09:00:00", "transaction_type": "buy", "holder_name": "Direktur A", "transaction_value": 1_000_000_000, "body": "Pasar reguler", "tags": []},
            {"symbol": "ABCD.JK", "timestamp": "2026-09-05T09:00:00", "transaction_type": "buy", "holder_name": "Direktur A", "transaction_value": 500_000_000, "body": "Pasar reguler", "tags": []},
            {"symbol": "ABCD.JK", "timestamp": "2026-09-08T09:00:00", "transaction_type": "buy", "holder_name": "Komisaris B", "transaction_value": 2_000_000_000, "body": "Pasar reguler", "tags": []},
            {"symbol": "WXYZ.JK", "timestamp": "2026-09-02T09:00:00", "transaction_type": "sell", "holder_name": "Direktur C", "transaction_value": 10, "body": "Pasar reguler", "tags": []},
        ]
        clusters = detect_clusters(filings, window_days=30, min_participants=2)
        self.assertEqual(len(clusters), 1)
        self.assertEqual(clusters[0]["symbol"], "ABCD.JK")
        self.assertEqual(clusters[0]["participants"], 2)
        self.assertEqual(clusters[0]["total_value"], 3_500_000_000)
        self.assertEqual(clusters[0]["direction"], "accumulation")

    def test_build_brief_is_informative_not_a_recommendation(self):
        cluster = {"symbol": "ABCD.JK", "participants": 2, "total_value": 3_500_000_000, "direction": "accumulation", "transactions": []}
        brief = build_brief(cluster, {"company_name": "PT Contoh", "roe": 0.18, "ratio_year": "2025"}, {"last_close": 900, "low_52w": 800, "high_52w": 1600})
        self.assertIn("2 pihak", brief)
        self.assertIn("bukan rekomendasi", brief.lower())
        self.assertNotIn("beli saham", brief.lower())

    def test_save_signal_deduplicates_same_cluster(self):
        cluster = {"symbol": "ABCD.JK", "direction": "accumulation", "participants": 2, "total_value": 100, "window_start": "2026-09-01", "window_end": "2026-09-08"}
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "signals.db"
            self.assertTrue(save_signal(db, cluster, "ringkasan"))
            self.assertFalse(save_signal(db, cluster, "ringkasan"))


if __name__ == "__main__":
    unittest.main()

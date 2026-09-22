import unittest
from insideriq import detect_clusters


class ReviewFlagsTests(unittest.TestCase):
    def rows(self, names, body="Pembelian pasar reguler"):
        return [
            dict(
                symbol="TEST.JK",
                holder_name=name,
                body=body,
                tags=["investment"],
                timestamp="2026-09-01",
                transaction_type="buy",
                transaction_value=10,
            )
            for name in names
        ]

    def test_dividend_settlement_is_not_market_accumulation(self):
        result = detect_clusters(self.rows(["A", "B"], "settlement of dividend payable acknowledgment"))
        self.assertEqual(result[0]["economic_classification"], "non_market_settlement")
        self.assertTrue(result[0]["review_notes"])

    def test_spacing_alias_needs_review(self):
        result = detect_clusters(self.rows(["Tri Hartono", "Trihartono"]))
        self.assertIn("identitas", " ".join(result[0]["review_notes"]))


if __name__ == "__main__":
    unittest.main()

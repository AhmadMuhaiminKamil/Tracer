import json
import tempfile
import unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch

from monitor import changes, refresh, refresh_reports


class MonitorTests(unittest.TestCase):
    def test_default_dry_run_never_fetches(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch('monitor.date') as clock, patch("monitor.fetch_page", side_effect=AssertionError("network")):
                clock.today.return_value = date(2026, 9, 15)
                result = refresh(Path(folder), pages=2, confirmed=0, run_cap=5)
            self.assertEqual(result["mode"], "dry_run")
            self.assertEqual(result["maximum_credits"], 2)

    def test_budget_and_cached_responses(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            page = {"results": [], "pagination": {"has_next": False}}
            with patch("monitor.fetch_page", return_value=page) as fetch:
                refresh(root, pages=1, confirmed=1, run_cap=1)
                self.assertEqual(fetch.call_count, 1)
                refresh(root, pages=1, confirmed=1, run_cap=1)
                self.assertEqual(fetch.call_count, 1)
                with self.assertRaises(RuntimeError):
                    refresh(root, pages=2, confirmed=2, run_cap=1)
            self.assertEqual(json.loads((root / "budget.json").read_text())["reserved"], 1)

    def test_report_budget_and_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch('monitor.fetch_report', side_effect=AssertionError('network')):
                self.assertEqual(refresh_reports(root, root/'reports', ['HEAL'], 0)['maximum_credits'], 3)
            report = {'symbol':'HEAL.JK','overview':{},'valuation':{},'financials':{}}
            with patch('monitor.fetch_report', return_value=report) as request:
                refresh_reports(root, root/'reports', ['HEAL'], 3)
                self.assertEqual(request.call_count, 1)
                self.assertEqual(refresh_reports(root, root/'reports', ['HEAL'], 0)['maximum_credits'], 0)
            self.assertEqual(json.loads((root/'budget.json').read_text())['reserved'], 3)

    def test_alert_changes_and_removed(self):
        before = {"HEAL.JK": "a"}
        now = {"HEAL.JK": "b", "BUKA.JK": "c"}
        self.assertEqual(len(changes(before, now)), 2)
        self.assertEqual(len(changes(now, {})), 2)

    def test_publish_preserves_existing_enrichment_and_marks_missing(self):
        from monitor import publish_cached
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); reports = root / 'reports'; reports.mkdir()
            rows = []
            for symbol in ('HEAL.JK', 'NEWX.JK'):
                for holder in ('A', 'B'):
                    rows.append({'symbol':symbol,'holder_name':holder,'body':'buy','tags':['investment'],'timestamp':'2026-09-15','transaction_type':'buy','transaction_value':10,'source':symbol+holder})
            (root/'filings.json').write_text(json.dumps(rows))
            (root/'coverage.json').write_text(json.dumps({'partial':False,'captured_at':'2026-09-15T00:00:00Z'}))
            (reports/'HEAL.json').write_text(json.dumps({'company_name':'Hermina','overview':{'all_time_price':{}},'valuation':{},'financials':{}}))
            target = root/'latest.json'
            value = publish_cached(root,reports,target)
            by_symbol={c['symbol']:c for c in value['payload']['clusters']}
            self.assertEqual(by_symbol['HEAL.JK']['fundamentals']['company_name'],'Hermina')
            self.assertIsNone(by_symbol['NEWX.JK']['fundamentals']['company_name'])
            self.assertFalse(value['payload']['partial'])


if __name__ == "__main__":
    unittest.main()

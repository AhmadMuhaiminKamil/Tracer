import unittest
from pathlib import Path

try:
    from streamlit.testing.v1 import AppTest
except ImportError:
    AppTest = None


@unittest.skipIf(AppTest is None, "streamlit belum terpasang")
class StreamlitAppTests(unittest.TestCase):
    def test_app_renders_scan_and_disclaimer(self):
        app = AppTest.from_file(str(Path(__file__).parents[1] / "app.py"))
        app.run(timeout=15)
        self.assertFalse(app.exception)
        self.assertEqual(app.title[0].value, "InsiderIQ")
        rendered = " ".join(element.value for element in [*app.markdown, *app.caption, *app.warning])
        self.assertIn("ABCD.JK", rendered)
        self.assertIn("bukan financial advice", rendered.lower())
        self.assertEqual(app.selectbox[0].options, ["ABCD.JK", "WXYZ.JK"])
        app.selectbox[0].set_value("WXYZ.JK").run(timeout=15)
        self.assertIn("PT Wahana XYZ", " ".join(item.value for item in app.markdown))


if __name__ == "__main__":
    unittest.main()

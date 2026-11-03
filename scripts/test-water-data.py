# /// script
# requires-python = ">=3.10"
# dependencies = ["beautifulsoup4==4.14.3", "requests==2.32.5"]
# ///
"""uv run scripts/test-water-data.py — parser regression tests, no network."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('fetch', Path(__file__).with_name('fetch-tirol-water.py'))
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)

FIXTURE = '''<table id="tblRootAnlage"><tr><td>Name:</td><td>System A<a name="T123"></a></td></tr></table>
<table id="tblRootAnlageType"><tr><td>Typ:</td><td>Sportanlage - Schneeanlage</td></tr></table>
<table id="root_tblAttr"><tr><td>Ausmaß Schneifläche</td><td></td><td>47,9</td><td>ha</td><td></td></tr></table>
<table id="tblSubAnlage"><tr><td>Name:</td><td>Reservoir A<a name="T456"></a></td></tr></table>
<table id="tblSubAnlageType"><tr><td>Typ:</td><td>Speicher, Teiche ua. - Beschneiungsteich</td></tr></table>
<table id="tblSubAnlageParentName"><tr><td>Teil von:</td><td>System A</td></tr></table>
<table id="tblSubAnlageKoord"><tr><td>Koordinaten:</td><td>Rechtswert: 45.904,96 Hochwert: 198.016,61</td></tr></table>
<table id="child_tblAttr"><tr><td>genutztes Volumen [m³], Speicher, Teich</td><td></td><td>416.500</td><td>m³</td><td></td></tr></table>'''

class ReportParserTests(unittest.TestCase):
    def test_coordinates_and_units(self):
        root, child = fetch.parse_report(FIXTURE, 'Imst')
        self.assertEqual((child['rw'], child['hw']), (45904.96, 198016.61))
        self.assertEqual(child['attributes']['genutztes Volumen [m³], Speicher, Teich'], '416.500 m³')
        self.assertEqual(root['attributes']['Ausmaß Schneifläche'], '47,9 ha')

    def test_parent_by_exact_name(self):
        self.assertEqual(fetch.parse_report(FIXTURE, 'Imst')[1]['parent'], 'T123')

    def test_unknown_parent_is_not_invented(self):
        report = FIXTURE.replace('<td>System A</td>', '<td>Unlisted system</td>')
        self.assertNotIn('parent', fetch.parse_report(report, 'Imst')[1])

    def test_missing_coordinates_stay_missing(self):
        report = FIXTURE.replace('Rechtswert: 45.904,96 Hochwert: 198.016,61', '')
        self.assertNotIn('rw', fetch.parse_report(report, 'Imst')[1])

    def test_no_personal_address_extraction(self):
        report = FIXTURE + '<table id="tblSubAnlageBerechtigter"><tr><td>Private street address</td></tr></table>'
        self.assertNotIn('Private street address', str(fetch.parse_report(report, 'Imst')))

    def test_unrecognized_report_fails(self):
        with self.assertRaises(ValueError):
            fetch.parse_report('<html>service unavailable</html>', 'Imst')

    def test_form_omits_empty_select_and_other_submit_buttons(self):
        from bs4 import BeautifulSoup
        page = BeautifulSoup('<form><select name="empty"></select><select name="district"><option value="T1">Imst</option></select><input type="hidden" name="state" value="safe"><input type="submit" name="reset" value="reset"></form>', 'html.parser')
        self.assertEqual(fetch.form(page), {'state': 'safe', 'district': 'T1'})

if __name__ == '__main__':
    unittest.main()

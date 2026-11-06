#!/usr/bin/env python3
"""Dependency-free regressions for the expanded Vintage atlas and original PoC."""
import hashlib
import json
import unittest
from pathlib import Path
from vintage_dates import date_envelope

ROOT=Path(__file__).resolve().parents[1]
ENTRY=ROOT/'maps/06-vintage-wrecks'
D=ENTRY/'data'
def read(name):return json.loads((D/name).read_text())
DATA=read('ships.geojson'); FS=DATA['features']; BY_ID={f['properties']['id']:f for f in FS}

class VintageTests(unittest.TestCase):
    def test_counts_and_no_duplicate_ids(self):
        self.assertEqual(len(FS),341);self.assertEqual(len(BY_ID),341)
        self.assertEqual(sum(f['properties']['featured'] for f in FS),14)
        self.assertEqual(sum(f['properties']['sourceCategory']=='emodnet' for f in FS),320)
        self.assertEqual(sum(f['properties']['sourceCategory']=='later' for f in FS),7)
        self.assertEqual(sum(f['properties']['dateStart'] is None for f in FS),49)
        self.assertNotIn('emodnet:8903',BY_ID)
        self.assertEqual(BY_ID['Q2884899']['properties']['vesselCount'],2)
        self.assertEqual(BY_ID['Q831457']['properties']['vesselCount'],5)

    def test_emodnet_completeness_and_licence(self):
        raw=read('emodnet-source.geojson');p=read('emodnet-provenance.json')
        self.assertEqual(raw['numberMatched'],321);self.assertEqual(raw['numberReturned'],321)
        self.assertEqual(len(raw['features']),321)
        self.assertEqual(p['license'],'CC BY 4.0');self.assertIn('AND-International',p['credit'])
        source={f['properties']['source_id']:f for f in raw['features']}
        for f in FS:
            q=f['properties']
            if q['sourceCategory']!='emodnet':continue
            original=source[q['sourceId']]
            self.assertEqual(q['sourceDating'],original['properties']['dating'])
            self.assertEqual(f['geometry']['coordinates'],[round(v,2) for v in original['geometry']['coordinates']])
            self.assertEqual(q['license'],'CC BY 4.0')

    def test_reviewed_coordinates_trace_exact_claim_and_revision(self):
        raw=read('ancient-wikidata-source.json')['entities']
        for f in FS:
            p=f['properties']
            if not p['featured']:continue
            e=raw[p['coordinateEntity']]
            c=next(c for c in e['claims']['P625'] if c['id']==p['coordinateClaim'])['mainsnak']['datavalue']['value']
            self.assertEqual(f['geometry']['coordinates'],[round(c['longitude'],2),round(c['latitude'],2)])
            self.assertEqual(p['coordinateRevision'],e['lastrevid'])
            self.assertTrue(p['historySource'].startswith('https://'))

    def test_discovery_sites_not_museums(self):
        self.assertEqual(BY_ID['Q832395']['properties']['coordinateEntity'],'Q352332')
        self.assertEqual(BY_ID['Q640851']['properties']['coordinateEntity'],'Q11972326')
        self.assertEqual(BY_ID['Q18412197']['properties']['coordinateEntity'],'Q165414')
        self.assertEqual(BY_ID['Q778065']['geometry']['coordinates'],[11.0,59.28])
        for id in ['Q832395','Q640851','Q778065']:
            self.assertLess(BY_ID[id]['geometry']['coordinates'][1],59.5) # Not Oslo museum, ~59.9N.
        self.assertNotIn('Q11981212',BY_ID) # Klåstad museum coordinate rejected.

    def test_types_dates_and_no_invented_nationality(self):
        northern=[f['properties'] for f in FS if f['properties']['region']=='north']
        self.assertEqual(len(northern),6)
        self.assertEqual(sum(p['kind']=='burial' for p in northern),4)
        self.assertEqual(sum(p['kind']=='deliberate' for p in northern),2)
        self.assertEqual(BY_ID['Q832395']['properties']['dateStart'],834)
        self.assertEqual(BY_ID['Q778065']['properties']['dateLabel'],'c. 910 CE')
        self.assertEqual(BY_ID['Q573852']['properties']['culture'],'other')
        self.assertEqual(BY_ID['Q2616711']['properties']['culture'],'roman')
        for f in FS:
            p=f['properties'];a,b=p['dateStart'],p['dateEnd']
            self.assertEqual(a is None,b is None)
            if a is not None:self.assertLessEqual(a,b);self.assertNotEqual(a,0);self.assertNotEqual(b,0)

    def test_century_and_era_parser(self):
        examples={'C 1st BC':(-100,-1),'C2nd-1st BC':(-200,-1),
          'late C2nd- first half 1st BC':(-200,-1),'C1st BC-AD':(-100,100),
          'C1stBC-1stAD':(-100,100),'C2nd BC-5th AD':(-200,500),
          'C1st-2nd AD':(1,200),'C18th-C17th BC':(-1800,-1601),
          'AD 200-250':(200,250),'AD200-250':(200,250),'C 13th AD':(1201,1300)}
        for value,expected in examples.items():
            with self.subTest(value=value):self.assertEqual(date_envelope(value),expected)
        for value in ['n/a','Roman','Roman ??','C12th-13th','late C6th- early 5th','second half C15th','AD 0']:
            with self.subTest(value=value):self.assertIsNone(date_envelope(value))

    def test_legacy_preserved(self):
        old=read('wrecks.geojson');raw=read('wikidata-source.json')['entities']
        self.assertEqual([f['properties']['year'] for f in old['features']],[1588,1690,1691,1707,1744,1859,1898])
        for f in old['features']:
            e=raw[f['properties']['id']];c=e['claims']['P625'][0]['mainsnak']['datavalue']['value']
            self.assertEqual(f['geometry']['coordinates'],[c['longitude'],c['latitude']])
        self.assertTrue(BY_ID['Q1721414']['properties']['disputedLocation'])
        self.assertIn('1.8 km',BY_ID['Q1721414']['properties']['locationNote'])

    def test_coverage_and_coastline(self):
        land=read('land.geojson')
        self.assertEqual(land['properties']['license'],'Public domain')
        self.assertEqual(land['properties']['clipBounds'],[-26,26,47,73])
        self.assertLess((D/'land.geojson').stat().st_size,900000)
        for f in FS:
            lon,lat=f['geometry']['coordinates'];self.assertTrue(-26<=lon<=43 and 27<=lat<=71)

    def test_distribution_hashes_and_no_excel(self):
        for name,expected in read('snapshot.json')['sha256'].items():
            self.assertEqual(hashlib.sha256((D/name).read_bytes()).hexdigest(),expected,name)
        self.assertFalse(list(ENTRY.rglob('*.xlsx')))
        self.assertIn('not bundled',' '.join(read('snapshot.json')['exclusions']))

    def test_nemi_is_two_inland_vessels_with_use_dates(self):
        p=BY_ID['Q1190639']['properties']
        self.assertEqual(p['vesselCount'],2)
        self.assertEqual(p['waterbody'],'lake')
        self.assertEqual(p['coordinateEntity'],'Q648679')
        self.assertEqual(BY_ID['Q1190639']['geometry']['coordinates'],[12.7,41.71])
        self.assertEqual((p['dateStart'],p['dateEnd']),(37,41))
        self.assertIn('not an established sinking date',p['dateBasis'])
        self.assertIn('lake',p['context'])

    def test_licensed_local_images_for_every_highlight(self):
        images=read('photos.json')['images'];source=read('commons-images.json')['files']
        self.assertEqual(len(images),14)
        self.assertEqual({p['id'] for p in images},{f['properties']['id'] for f in FS if f['properties']['featured']})
        for p in images:
            self.assertTrue(p['src'].startswith('photos/Q'))
            self.assertTrue(p['source'].startswith('https://commons.wikimedia.org/wiki/File:'))
            self.assertTrue(p['licenseUrl'].startswith('https://creativecommons.org/'))
            self.assertEqual(p['license'],source[p['file']]['imageinfo'][0]['extmetadata']['LicenseShortName']['value'])
            self.assertTrue(p['author'] and p['alt'] and p['caption'] and p['kind'])
            self.assertLessEqual(p['width'],960);self.assertLessEqual(p['height'],640)
            image=ENTRY/p['src']
            self.assertEqual(hashlib.sha256(image.read_bytes()).hexdigest(),p['sha256'])
            self.assertLess(image.stat().st_size,400000)
        nemi=next(p for p in images if p['id']=='Q1190639')
        self.assertEqual(nemi['file'],'Nemi-Schiff.jpg')
        self.assertNotIn('Nemi Ship Hull 1930.jpg',source)
        self.assertIn('sepia(1)',(ENTRY/'style.css').read_text())

    def test_local_accessible_shell(self):
        html=(ENTRY/'index.html').read_text();js=(ENTRY/'app.js').read_text()
        for text in ['role="group"','not for navigation','No','CC BY 4.0','data/ships.geojson']:
            self.assertIn(text,html)
        self.assertIn("['Enter',' ']",js);self.assertIn("document.createElement('button')",js)
        self.assertNotIn("fetch('http",js)
        self.assertTrue((ROOT/'assets/vendor/d3/LICENSE').exists())

if __name__=='__main__':unittest.main()

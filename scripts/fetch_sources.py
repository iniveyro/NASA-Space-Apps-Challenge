"""Download the original NASA source files into data/raw/.
Usage: python scripts/fetch_sources.py   (set NASA_API_KEY for DONKI; free key at api.nasa.gov)"""
import os, urllib.request, urllib.parse, json
RAW = 'data/raw'
def get(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as r, open(path, 'wb') as f: f.write(r.read())
    print('ok', path)
# 1) NASA OSDR - Inspiration4 clinical panels
OSDR = 'https://osdr.nasa.gov/geode-py/ws/studies/{}/download?source=datamanager&file={}'
for osd, fn in [('OSD-569', 'LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv'),
                ('OSD-575', 'LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv'),
                ('OSD-575', 'LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv')]:
    get(OSDR.format(osd, fn), f'{RAW}/osdr/{osd}_{fn}')
# 2) JPL Horizons - Mars seen from Earth: range (20), one-way light time (21), solar elongation (23)
q = {'format': 'text', 'COMMAND': "'499'", 'CENTER': "'500@399'", 'EPHEM_TYPE': "'OBSERVER'",
     'START_TIME': "'2026-11-14'", 'STOP_TIME': "'2029-06-12'", 'STEP_SIZE': "'1 d'",
     'QUANTITIES': "'20,21,23'", 'CSV_FORMAT': "'YES'", 'OBJ_DATA': "'NO'"}
get('https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(q), f'{RAW}/horizons/horizons_mars_geocentric_2026-2029.txt')
# 3) NASA DONKI - May 2024 solar storm (flares, solar energetic particles, CMEs)
key = os.environ.get('NASA_API_KEY', 'DEMO_KEY')
for t in ['FLR', 'SEP', 'CME']:
    get(f'https://api.nasa.gov/DONKI/{t}?startDate=2024-05-01&endDate=2024-05-31&api_key={key}', f'{RAW}/donki/donki_{t}_2024-05.json')

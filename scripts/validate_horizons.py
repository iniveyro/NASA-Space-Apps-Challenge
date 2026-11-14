"""Compare the team-computed timeline with JPL Horizons (surface phase, days 211-732)."""
import json, datetime
txt = open('data/raw/horizons/horizons_mars_geocentric_2026-2029.txt').read()
rows = txt.split('$$SOE')[1].split('$$EOE')[0].strip().split('\n')
H = {}
for l in rows:
    p = [x.strip() for x in l.split(',')]
    d = datetime.datetime.strptime(p[0], '%Y-%b-%d %H:%M').date().isoformat()
    H[d] = dict(range_au=float(p[3]), lt_min=float(p[5]), elong_deg=float(p[6]))
T = json.load(open('data/processed/mission_timeline.json'))
diff = [abs(r['delay_oneway_min'] - H[r['date']]['lt_min']) * 60 for r in T if 211 <= r['day'] <= 732]
print(f'Surface phase: max |delay difference| = {max(diff):.2f} s over {len(diff)} days')
hb = [d for d, v in H.items() if v['elong_deg'] < 2]
tb = [r['date'] for r in T if r['comm'] == 'blackout']
print('Blackout Horizons:', hb[0], '->', hb[-1], f'({len(hb)} d) | team:', tb[0], '->', tb[-1], f'({len(tb)} d)')
m = max(H.items(), key=lambda kv: kv[1]['lt_min']); print('Max one-way delay (Horizons):', m[0], round(m[1]['lt_min'], 2), 'min')

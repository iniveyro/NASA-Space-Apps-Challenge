"""Simulated daily crew health series for the UMBRAL demo (no hardware).
x[t] = baseline + sigma * N(0,1) + event(t); fixed seed so the demo is repeatable.
Baselines marked ASSUMED are team choices; glucose baseline = mean of the three Inspiration4 pre-flight samples (L-92, L-44, L-3) CMP, NASA OSDR OSD-575.
Activity minutes, SpO2 and RR intervals use their own generator (seed 2027) so the original series keep their values.
RR intervals: N_BEATS beats per day, mean 60000/HR ms, sd RMSSD/sqrt(2) (successive differences of iid beats).
Output: data/processed/crew_daily.csv, data/processed/crew_events.csv"""
import csv, json, math, random
random.seed(2026)
VIT = random.Random(2027)   # activity, SpO2 + RR intervals, independent of the original series
T = json.load(open('data/processed/mission_timeline.json'))
# Inspiration4 pre-flight glucose (mg/dL): mean of L-92, L-44, L-3 per crew C001-C004
cmp = list(csv.DictReader(open('data/raw/osdr/OSD-575_LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv', encoding='utf-8-sig')))
pre = {}
for r in cmp:
    if '_L-' in r['Sample Name']: pre.setdefault(r['Sample Name'][:4], []).append(float(r['glucose_value_milligram_per_deciliter']))
glu = {k: round(sum(v) / len(v), 1) for k, v in pre.items()}
CREW = {  # hr bpm, sbp/dbp mmHg, temp C, sleep h, rmssd ms, prior dose mSv  (ASSUMED unless noted)
 'Ines':  dict(src='C001', hr=58, sbp=118, dbp=76, temp=36.6, sleep=6.1, rmssd=45, prior=150),
 'Kanji': dict(src='C002', hr=48, sbp=120, dbp=76, temp=36.5, sleep=6.1, rmssd=70, prior=0),   # hr 48 from plot
 'Malik': dict(src='C003', hr=62, sbp=120, dbp=78, temp=36.6, sleep=6.1, rmssd=45, prior=0),
 'Sofia': dict(src='C004', hr=64, sbp=116, dbp=74, temp=36.7, sleep=6.1, rmssd=50, prior=0),   # 116/74 from plot
}
SIG = dict(hr=3, sbp=5, dbp=4, temp=0.15, sleep=0.5, rmssd=6, glu=5, mood=0.4)   # ASSUMED day-to-day variation
EVA_STORM = {'Ines', 'Sofia'}   # on the surface walk during the 2028-03-20 storm (plot)
STORM_MGY = 8.1                 # MSL RAD, 2024-05-20 event (NASA/JPL 2024)
SPO2 = dict(Ines=98, Kanji=97, Malik=98, Sofia=98)   # ASSUMED resting point-reading baselines (%)
SPO2_SIG = 0.6                  # ASSUMED day-to-day variation
ACTIVITY = dict(Ines=45, Kanji=40, Malik=35, Sofia=50)   # ASSUMED logged exercise minutes per day
ACTIVITY_SIG = 10               # ASSUMED day-to-day variation (min)
REST_DAY_P = 0.12               # ASSUMED chance of a day with no logged exercise
N_BEATS = 30                    # RR window per day; the stress index needs at least 20 beats
SPO2_EVENT = dict(crew='Ines', day=518, value=89)   # surface EVA after the solar storm (authored scenario)
daily, events = [], []
for name, c in CREW.items():
    dose = c['prior']
    for r in T:
        d = r['day']
        n = lambda k: random.gauss(0, SIG[k])
        x = dict(hr=c['hr']+n('hr'), sbp=c['sbp']+n('sbp'), dbp=c['dbp']+n('dbp'), temp=c['temp']+n('temp'),
                 sleep=c['sleep']+n('sleep'), rmssd=c['rmssd']+n('rmssd'), glu=glu[c['src']]+n('glu'), mood=4+n('mood'))
        ev = ''
        if name == 'Kanji' and 120 <= d <= 122:          # viral reactivation scenario
            x.update(hr=78+n('hr')/3, temp=c['temp']+0.6, rmssd=c['rmssd']*0.6, sleep=5.0, mood=3.0); ev = 'viral_reactivation'
        if d == 493:                                       # solar storm night: nobody sleeps well
            x.update(sleep=4.0+n('sleep')/2, mood=3.0); ev = 'solar_storm'
            add = STORM_MGY if name in EVA_STORM else STORM_MGY/2   # ASSUMED: habitat refuge halves the dose
            dose += add   # protons, Q ~ 1 -> mGy ~ mSv (approximation)
            events.append(dict(day=d, date=r['date'], crew=name, event='solar_storm', detail=f'event dose {add:.1f} mSv ({"EVA" if name in EVA_STORM else "refuge"})'))
        hr, rmssd = round(x['hr']), round(x['rmssd'])
        on_eva = name == SPO2_EVENT['crew'] and d == SPO2_EVENT['day']
        resting = not on_eva and (VIT.random() < REST_DAY_P or ev == 'viral_reactivation' or (d == 493 and name not in EVA_STORM))
        activity = 0 if resting else max(5, round(ACTIVITY[name] + VIT.gauss(0, ACTIVITY_SIG)))
        spo2 = min(100, max(95, round(SPO2[name] + VIT.gauss(0, SPO2_SIG))))
        rr_sd = max(rmssd, 5) / math.sqrt(2)
        rr = [round(60000 / hr + VIT.gauss(0, rr_sd)) for _ in range(N_BEATS)]
        if on_eva:   # O2 saturation drop during an EVA
            events.append(dict(day=d, date=r['date'], crew=name, event='spo2_alert',
                               detail=f"SpO2 point reading {spo2} -> {SPO2_EVENT['value']} % during surface EVA"))
            spo2 = SPO2_EVENT['value']; ev = 'spo2_alert'
        dose += 1.84 if r['phase'] in ('transit_out', 'transit_return') else (0.64 if r['phase'] in ('surface', 'mars_arrival') else (1.84 if r['phase'] == 'mars_departure' else 0))
        daily.append(dict(day=d, date=r['date'], crew=name, hr_rest_bpm=hr, sbp_mmHg=round(x['sbp']), dbp_mmHg=round(x['dbp']),
                          temp_C=round(x['temp'], 1), sleep_h=round(max(x['sleep'], 2), 1), hrv_rmssd_ms=rmssd,
                          glucose_mg_dL=round(x['glu']), spo2_pct=spo2, activity_min=activity, mood_1to5=min(5, max(1, round(x['mood']))), dose_cum_mSv=round(dose, 1),
                          comm=r['comm'], event=ev, rr_ms=' '.join(map(str, rr))))
        if name == 'Kanji' and d == 120:
            events.append(dict(day=d, date=r['date'], crew=name, event='viral_reactivation', detail='rest HR 48->78, T +0.6 C, low HRV, 5 h sleep (days 120-122)'))
# Orthostatic test on arrival (day 211): supine vs 3 min standing
for name, (sup, sta, dhr) in {'Ines': ('118/76', '112/74', 14), 'Kanji': ('120/76', '114/74', 12),
                              'Malik': ('120/78', '113/75', 16), 'Sofia': ('116/74', '94/68', 38)}.items():
    events.append(dict(day=211, date='2027-06-12', crew=name, event='orthostatic_test',
                       detail=f'supine {sup} -> standing {sta} mmHg, HR +{dhr} bpm' + (' -> meets OH criterion' if name == 'Sofia' else '')))
for fn, rows in [('crew_daily.csv', daily), ('crew_events.csv', sorted(events, key=lambda e: (e['day'], e['crew'])))]:
    with open('data/processed/' + fn, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(len(daily), 'daily rows,', len(events), 'events; glucose baselines', glu)

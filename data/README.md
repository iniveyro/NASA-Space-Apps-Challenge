# AstroHealth · UMBRAL mission data

NASA Space Apps Challenge 2026. This repository holds the data behind AstroHealth, an astronaut health self-monitoring tool. The tool is demonstrated on UMBRAL, a fictional crewed Mars mission that runs from 14 Nov 2026 to 12 Jun 2029 (942 days).

The demo is fully simulated and uses no hardware. Mission geometry comes from planetary ephemerides, verified against JPL Horizons. Crew health series are simulated and calibrated with data from previous missions.

## Structure

```
data/README.md     This file
data/raw/          Original NASA files, unmodified
  osdr/            Inspiration4 clinical panels (NASA OSDR OSD-569, OSD-575)
  horizons/        Mars seen from Earth, daily 2026-11-14..2029-06-12 (JPL Horizons)
  donki/           May 2024 solar storm (NASA DONKI), filled by scripts/fetch_sources.py
data/processed/    Team-generated, used by the app
  mission_timeline.csv/.json   942 days: distances, light delay, link status, sol, Ls, dose
  mission_positions.csv        942 days: heliocentric positions of Earth, Mars and the spacecraft (AU)
  crew_daily.csv               4 crew x 942 days: HR, BP, temperature, sleep, HRV, glucose, SpO2, activity, mood, dose, RR intervals
  crew_events.csv              Scenario events (day 120, 211, 493, 518)
scripts/           Python that rebuilds everything from data/raw
```

## Rebuild

```bash
pip install astropy numpy
python scripts/fetch_sources.py      # download raw files (set NASA_API_KEY for DONKI)
python scripts/mission_timeline.py   # mission geometry -> data/processed/mission_timeline.*
python scripts/mission_positions.py  # 3D vectors behind that geometry -> data/processed/mission_positions.csv
python scripts/simulate_crew.py      # crew series -> data/processed/crew_*.csv
python scripts/validate_horizons.py  # compare with JPL Horizons
```

## Validation

During the surface phase (days 211 to 732):

- The one-way signal delay agrees with JPL Horizons within 0.34 s.
- The solar-conjunction blackout falls on 13–29 Mar 2028 in both, 17 days.
- The maximum delay is 20.06 min on 12 May 2028 in both.

## Key fields

| File | Field | Unit | Meaning |
|---|---|---|---|
| mission_timeline | `delay_oneway_min` | min | Spacecraft–Earth distance divided by c |
| mission_timeline | `comm` | — | `blackout` when the Sun–Earth–spacecraft angle is below 2° (NASA ASCEND 2022) |
| mission_timeline | `dose_cum_mSv` | mSv | 1.84 mSv/d in cruise, 0.64 mSv/d on the surface (MSL RAD) |
| mission_positions | `earth_*_au`, `mars_*_au`, `ship_*_au` | AU | Heliocentric ecliptic J2000 vectors (x to the vernal equinox, z to the ecliptic north). Distances and the Sun–Earth–spacecraft angle rebuilt from them match mission_timeline within 0.01 million km and 0.02° |
| crew_daily | `hr_rest_bpm`, `sbp_mmHg`, `dbp_mmHg`, `temp_C`, `sleep_h`, `hrv_rmssd_ms`, `glucose_mg_dL`, `mood_1to5` | — | Simulated: baseline + sigma·N(0,1) + event, seed 2026 |
| crew_daily | `spo2_pct` | % | Simulated point reading: baseline + 0.6·N(0,1), clamped to 95–100; own generator (seed 2027) so the series above keep their values |
| crew_daily | `activity_min` | min | Logged exercise minutes; 0 on rest days (12 % of days), during Kanji's illness, and for the refuge crew on the storm day |
| crew_daily | `rr_ms` | ms | 30 space-separated RR intervals: mean 60000/HR, sd RMSSD/√2. The app computes the Baevsky stress index from them on the server |

## Assumptions (team choices)

- **From the plot:** Kanji's resting HR baseline of 48 bpm and Sofía's blood pressure of 116/74.
- **Team choices:** the other baselines, all day-to-day sigmas, and Inés's prior dose of 150 mSv.
- **Glucose baselines:** the mean of the three pre-flight samples of each Inspiration4 crew member (C001 to C004), with no assumption added.
- **SpO₂ alert:** on day 518 (14 Apr 2028), Inés's point reading drops to 89 % during a surface EVA, after the solar storm.
- **Activity and SpO₂ baselines:** team choices (`ACTIVITY`, `SPO2` in `scripts/simulate_crew.py`).
- **Storm dose:** walkers receive the 8.1 mGy measured by RAD on 20 May 2024; crew in the refuge receive half. We count 1 mGy ≈ 1 mSv for protons.

## Sources

- JPL Horizons (NASA/JPL)
- NASA OSDR: OSD-569 and OSD-575 (Inspiration4)
- NASA DONKI
- MSL RAD: Zeitlin et al. 2013; Hassler et al. 2014; NASA/JPL 2024
- NASA ASCEND 2022 (McBrayer, Chai, Judd)
- astropy

The full list of 29 references is in the team's technical note (submitted separately).

Crew members and the mission are fictional. AstroHealth flags deviations; it does not diagnose.

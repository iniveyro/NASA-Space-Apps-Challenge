import numpy as np
from astropy.time import Time
import astropy.units as u
from astropy.coordinates import get_body_barycentric, solar_system_ephemeris
C_KM_S = 299792.458
AU_KM = 149597870.7
solar_system_ephemeris.set('builtin')
t0 = Time('2026-10-01'); t1 = Time('2030-01-01')
days = np.arange(0, int((t1 - t0).jd) + 1, 1.0)
ts = t0 + days * u.day
sun = get_body_barycentric('sun', ts).xyz.to(u.km).value
ear = get_body_barycentric('earth', ts).xyz.to(u.km).value
mar = get_body_barycentric('mars', ts).xyz.to(u.km).value
# heliocentric (equatorial ICRS; longitudes in that frame are fine for phase differences approx, use ecliptic rotation)
eps = np.deg2rad(23.43928)
R = np.array([[1,0,0],[0,np.cos(eps),np.sin(eps)],[0,-np.sin(eps),np.cos(eps)]])
eh = R @ (ear - sun); mh = R @ (mar - sun)
lon_e = np.degrees(np.arctan2(eh[1], eh[0])) % 360
lon_m = np.degrees(np.arctan2(mh[1], mh[0])) % 360
phase = (lon_m - lon_e + 540) % 360 - 180   # Mars minus Earth, in (-180,180]
em = mar - ear
dist = np.linalg.norm(em, axis=0)
lt_min = dist / C_KM_S / 60
# solar elongation of Mars as seen from Earth (angle Sun-Earth-Mars)
es = sun - ear
cosang = np.sum(es*em, axis=0) / (np.linalg.norm(es, axis=0)*dist)
elong = np.degrees(np.arccos(np.clip(cosang, -1, 1)))
def d(i): return ts[i].iso[:10]
# Hohmann launch: phase ~ +44.3 deg (Mars leads Earth) in late 2026
target = 44.3
i_launch = None
for i in range(len(days)-1):
    if ts[i] < Time('2027-06-01') and (phase[i]-target)*(phase[i+1]-target) <= 0:
        i_launch = i; break
print('Hohmann launch (phase 44.3):', d(i_launch), 'phase', round(phase[i_launch],1))
i_arr = i_launch + 259
print('Hohmann arrival (+259 d):', d(i_arr), 'Earth-Mars dist AU', round(dist[i_arr]/AU_KM,3), 'one-way delay min', round(lt_min[i_arr],1))
# return departure: phase +75.3 after arrival
i_dep = None
for i in range(i_arr, len(days)-1):
    if (phase[i]-75.3)*(phase[i+1]-75.3) <= 0:
        i_dep = i; break
print('Hohmann Mars departure (phase 75.3):', d(i_dep), 'stay days', i_dep - i_arr, 'delay min', round(lt_min[i_dep],1))
print('Earth return (+259 d):', d(i_dep+259), 'total mission days', i_dep + 259 - i_launch)
# conjunctions and oppositions
for i in range(1, len(days)-1):
    if elong[i] < elong[i-1] and elong[i] <= elong[i+1] and elong[i] < 10:
        blk2 = [d(j) for j in range(len(days)) if abs(j-i) < 60 and elong[j] < 2.0]
        blk3 = [d(j) for j in range(len(days)) if abs(j-i) < 60 and elong[j] < 3.0]
        print('Solar conjunction:', d(i), 'min elong', round(elong[i],2), 'delay min', round(lt_min[i],1),
              '| <2deg:', blk2[0], '->', blk2[-1], f'({len(blk2)} d)', '| <3deg:', blk3[0], '->', blk3[-1], f'({len(blk3)} d)')
    if dist[i] < dist[i-1] and dist[i] <= dist[i+1]:
        print('Closest approach:', d(i), 'dist AU', round(dist[i]/AU_KM,3), 'delay min', round(lt_min[i],2))
print('Max one-way delay in window:', round(lt_min.max(),1), 'min on', d(int(lt_min.argmax())))
print('Min one-way delay in window:', round(lt_min.min(),2), 'min on', d(int(lt_min.argmin())))
# sample of delays at monthly steps for the narrative
for date in ['2026-11-14','2027-01-01','2027-02-20','2027-05-01','2027-08-01','2027-10-01','2028-01-01','2028-02-01','2028-03-01','2028-06-01','2028-10-01','2029-01-01','2029-06-01']:
    i = int((Time(date) - t0).jd)
    print(date, 'Earth-Mars', round(dist[i]/AU_KM,3), 'AU', '| one-way', round(lt_min[i],1), 'min | elong', round(elong[i],1), 'deg | phase', round(phase[i],1))

"""UMBRAL daily heliocentric positions for the 3D mission view.
Same ephemeris, Lambert legs and Kepler propagation as mission_timeline.py; this script only adds the
vectors behind the distances. Frame: heliocentric ecliptic J2000 (x to the vernal equinox, z to the
ecliptic north pole), in astronomical units.
Requires: pip install astropy numpy. Output: data/processed/mission_positions.csv (942 rows).
Self-check: Earth-spacecraft and Mars-spacecraft distances and the Sun-Earth-spacecraft angle rebuilt
from these vectors must match mission_timeline.csv."""
import csv, warnings
import numpy as np
warnings.filterwarnings('ignore')
from astropy.time import Time
import astropy.units as u
from astropy.coordinates import get_body_barycentric_posvel, solar_system_ephemeris
solar_system_ephemeris.set('builtin')
MU=1.32712440018e11; AU=149597870.7
EPS=np.deg2rad(23.4392911)   # mean obliquity of the ecliptic at J2000
ROT=np.array([[1,0,0],[0,np.cos(EPS),np.sin(EPS)],[0,-np.sin(EPS),np.cos(EPS)]])   # equatorial (ICRS) -> ecliptic
def helio(body,t):
    p,v=get_body_barycentric_posvel(body,t); ps,vs=get_body_barycentric_posvel('sun',t)
    return (p.xyz-ps.xyz).to(u.km).value, (v.xyz-vs.xyz).to(u.km/u.s).value
def stumpff(z):
    if z>1e-8: s=np.sqrt(z); return (1-np.cos(s))/z, (s-np.sin(s))/s**3
    if z<-1e-8: s=np.sqrt(-z); return (np.cosh(s)-1)/(-z), (np.sinh(s)-s)/s**3
    return 0.5, 1/6
def lambert(r1,r2,tof):
    R1=np.linalg.norm(r1); R2=np.linalg.norm(r2)
    cr=np.cross(r1,r2); dth=np.arccos(np.dot(r1,r2)/(R1*R2))
    if cr[2]<0: dth=2*np.pi-dth  # prograde
    A=np.sin(dth)*np.sqrt(R1*R2/(1-np.cos(dth)))
    def F(z):
        Cz,Sz=stumpff(z); y=R1+R2+A*(z*Sz-1)/np.sqrt(Cz)
        if y<0: return None,None
        x=np.sqrt(y/Cz); return (x**3*Sz+A*np.sqrt(y))/np.sqrt(MU)-tof, y
    lo,hi=-4*np.pi**2+1e-6, 4*np.pi**2-1e-6
    while F(lo)[0] is None: lo+=0.1
    for _ in range(200):
        mid=(lo+hi)/2; f,_=F(mid)
        if f is None or f>0: hi=mid
        else: lo=mid
    z=(lo+hi)/2; Cz,Sz=stumpff(z); y=R1+R2+A*(z*Sz-1)/np.sqrt(Cz)
    f=1-y/R1; g=A*np.sqrt(y/MU)
    return (r2-f*r1)/g
def kepler_prop(r0,v0,dt):
    R0=np.linalg.norm(r0); V0=np.linalg.norm(v0); vr0=np.dot(r0,v0)/R0
    alpha=2/R0-V0**2/MU; x=np.sqrt(MU)*abs(alpha)*dt
    for _ in range(100):
        z=alpha*x*x; Cz,Sz=stumpff(z)
        F=R0*vr0/np.sqrt(MU)*x*x*Cz+(1-alpha*R0)*x**3*Sz+R0*x-np.sqrt(MU)*dt
        dF=R0*vr0/np.sqrt(MU)*x*(1-alpha*x*x*Sz)+(1-alpha*R0)*x*x*Cz+R0
        dx=F/dF; x-=dx
        if abs(dx)<1e-8: break
    z=alpha*x*x; Cz,Sz=stumpff(z)
    return (1-x*x/R0*Cz)*r0+(dt-x**3/np.sqrt(MU)*Sz)*v0
launch=Time('2026-11-14'); tof=210
arr=launch+tof*u.day; dep=Time('2028-11-14'); ret=dep+tof*u.day
rE=helio('earth',launch)[0]; v1=lambert(rE,helio('mars',arr)[0],tof*86400)
rM2=helio('mars',dep)[0]; w1=lambert(rM2,helio('earth',ret)[0],tof*86400)
def craft(d):
    t=launch+d*u.day
    if d<=tof: return kepler_prop(rE,v1,d*86400),t
    if t<dep: return helio('mars',t)[0],t
    return kepler_prop(rM2,w1,(t-dep).jd*86400),t
ref=list(csv.DictReader(open('data/processed/mission_timeline.csv')))
rows=[]; worst=dict(earth=0.0,mars=0.0,angle=0.0)
for d in range(0,942):
    rc,t=craft(d)
    rEt=helio('earth',t)[0]; rMt=helio('mars',t)[0]
    e,m,s=(ROT@rEt)/AU,(ROT@rMt)/AU,(ROT@rc)/AU
    rows.append([d+1,t.iso[:10]]+[f'{v:.5f}' for v in (*e,*m,*s)])
    # Self-check against the timeline, using the rounded values that are written to the file.
    e,m,s=(np.array([float(v) for v in rows[-1][2+3*k:5+3*k]]) for k in range(3))
    de=np.linalg.norm(s-e)*AU/1e6; dm=np.linalg.norm(s-m)*AU/1e6
    worst['earth']=max(worst['earth'],abs(de-float(ref[d]['dist_earth_mkm'])))
    worst['mars']=max(worst['mars'],abs(dm-float(ref[d]['dist_mars_mkm'])))
    if de>10:
        ang=np.degrees(np.arccos(np.clip(np.dot(-e,s-e)/(np.linalg.norm(e)*np.linalg.norm(s-e)),-1,1)))
        worst['angle']=max(worst['angle'],abs(ang-float(ref[d]['solar_elong_deg'])))
with open('data/processed/mission_positions.csv','w',newline='') as f:
    w=csv.writer(f)
    w.writerow(['day','date']+[f'{b}_{a}_au' for b in ('earth','mars','ship') for a in 'xyz'])
    w.writerows(rows)
print(len(rows),'rows; max difference vs mission_timeline.csv:',
      'Earth distance %.3f Mkm, Mars distance %.3f Mkm, Sun-Earth-spacecraft angle %.3f deg'%(worst['earth'],worst['mars'],worst['angle']))
assert worst['earth']<0.01 and worst['mars']<0.01 and worst['angle']<0.02, 'positions disagree with mission_timeline.csv'

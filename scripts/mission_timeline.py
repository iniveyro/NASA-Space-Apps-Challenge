"""UMBRAL mission timeline generator: daily distances, light delay, solar elongation, Mars sol/Ls and cumulative dose.
Requires: pip install astropy numpy. Output: mission_timeline.csv / .json (942 rows)."""
import numpy as np, warnings, json
warnings.filterwarnings('ignore')
from astropy.time import Time
import astropy.units as u
from astropy.coordinates import get_body_barycentric, get_body_barycentric_posvel, solar_system_ephemeris
solar_system_ephemeris.set('builtin')
MU=1.32712440018e11; C=299792.458; AU=149597870.7
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
    # ensure y>0 at lo
    while F(lo)[0] is None: lo+=0.1
    for _ in range(200):
        mid=(lo+hi)/2; f,_=F(mid)
        if f is None or f>0: hi=mid
        else: lo=mid
    z=(lo+hi)/2; Cz,Sz=stumpff(z); y=R1+R2+A*(z*Sz-1)/np.sqrt(Cz)
    f=1-y/R1; g=A*np.sqrt(y/MU); gd=1-y/R2
    v1=(r2-f*r1)/g; v2=(gd*r2-r1)/g
    return v1,v2
def kepler_prop(r0,v0,dt):
    # universal variable propagation
    R0=np.linalg.norm(r0); V0=np.linalg.norm(v0); vr0=np.dot(r0,v0)/R0
    alpha=2/R0-V0**2/MU; x=np.sqrt(MU)*abs(alpha)*dt
    for _ in range(100):
        z=alpha*x*x; Cz,Sz=stumpff(z)
        F=R0*vr0/np.sqrt(MU)*x*x*Cz+(1-alpha*R0)*x**3*Sz+R0*x-np.sqrt(MU)*dt
        dF=R0*vr0/np.sqrt(MU)*x*(1-alpha*x*x*Sz)+(1-alpha*R0)*x*x*Cz+R0
        dx=F/dF; x-=dx
        if abs(dx)<1e-8: break
    z=alpha*x*x; Cz,Sz=stumpff(z)
    f=1-x*x/R0*Cz; g=dt-x**3/np.sqrt(MU)*Sz
    return f*r0+g*v0
launch=Time('2026-11-14'); tof=210
arr=launch+tof*u.day; dep=Time('2028-11-14'); ret=dep+tof*u.day
out={}
rE,vE=helio('earth',launch); rM,vM=helio('mars',arr)
v1,v2=lambert(rE,rM,tof*86400)
print('Outbound v_inf dep %.2f km/s, arr %.2f km/s'%(np.linalg.norm(v1-vE), np.linalg.norm(v2-vM)))
rM2,vM2=helio('mars',dep); rE2,vE2=helio('earth',ret)
w1,w2=lambert(rM2,rE2,tof*86400)
print('Return v_inf dep %.2f km/s, arr %.2f km/s'%(np.linalg.norm(w1-vM2), np.linalg.norm(w2-vE2)))
total=int((ret-launch).jd)
def craft(d):
    t=launch+d*u.day
    if d<=tof: return kepler_prop(rE,v1,d*86400),t
    if t<dep: return helio('mars',t)[0],t
    return kepler_prop(rM2,w1,(t-dep).jd*86400),t
def Ls(t):
    jd=t.jd; dt=jd-2451545.0  # approx TT ~ UTC
    M=np.radians(19.3871+0.52402073*dt); a=270.3871+0.524038496*dt
    pbs=0
    for A,tau,phi in [(0.0071,2.2353,49.409),(0.0057,2.7543,168.173),(0.0039,1.1177,191.837),(0.0037,15.7866,21.736),(0.0021,2.1354,15.704),(0.0020,2.4694,95.528),(0.0018,32.8493,49.095)]:
        pbs+=A*np.cos(np.radians(0.985626*dt/tau+phi))
    eoc=(10.691+3e-7*dt)*np.sin(M)+0.623*np.sin(2*M)+0.050*np.sin(3*M)+0.005*np.sin(4*M)+0.0005*np.sin(5*M)+pbs
    return (a+eoc)%360
import csv
rows=[]; dose=0.0
SOL=88775.244
for d in range(0,942):
    day=d+1
    rc,t=craft(d)
    rEt=helio('earth',t)[0]; rMt=helio('mars',t)[0]
    de=np.linalg.norm(rc-rEt); dm=np.linalg.norm(rc-rMt)
    los=rc-rEt; ce=np.dot(-rEt,los)/(np.linalg.norm(rEt)*np.linalg.norm(los)) if de>1e3 else 1.0
    el=float(np.degrees(np.arccos(np.clip(ce,-1,1)))) if de>1e3 else 180.0
    if day<=210: ph='transit_out'; g=0.0; rate=1.84
    elif day<=731: ph='surface'; g=0.38; rate=0.64
    elif day<=941: ph='transit_return'; g=0.0; rate=1.84
    else: ph='landed'; g=1.0; rate=0.0
    if day==211: ph='mars_arrival'
    if day==732: ph='mars_departure'
    sol = round((t.jd-arr.jd)*86400/SOL,1) if 211<=day<=732 else None
    lm=np.degrees(np.arctan2(rMt[1],rMt[0])); lE=np.degrees(np.arctan2(rEt[1],rEt[0]))
    rows.append(dict(day=day,date=t.iso[:10],phase=ph,dist_earth_mkm=round(de/1e6,2),dist_mars_mkm=round(dm/1e6,2),
        delay_oneway_min=round(de/C/60,2),delay_roundtrip_min=round(2*de/C/60,2),solar_elong_deg=round(el,2),
        comm='blackout' if (el<2 and de>1e7) else 'link',mars_sol=sol,mars_Ls_deg=round(float(Ls(t)),1),
        gravity_g=g,dose_cum_mSv=round(dose,1)))
    dose+=rate
import json,os
out='data/processed/'
json.dump(rows,open(out+'mission_timeline.json','w'),indent=0)
with open(out+'mission_timeline.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
bl=[r for r in rows if r['comm']=='blackout']; print('blackout',bl[0]['date'],bl[-1]['date'],len(bl))
print(rows[-1]); print(rows[210]); print(max(rows,key=lambda r:r['delay_oneway_min'])['date'])
mn=min(rows[400:600],key=lambda r:r['solar_elong_deg']); print('min elong',mn['date'],mn['solar_elong_deg'])
lm=np.degrees(np.arctan2(rM2[1],rM2[0])); lE=np.degrees(np.arctan2(rE2[1],rE2[0]))
rd=helio('earth',dep)[0]; print('return phase', (lm-np.degrees(np.arctan2(rd[1],rd[0]))+540)%360-180)
print('C3',np.linalg.norm(v1-vE)**2, 'ret C3', np.linalg.norm(w1-vM2)**2)

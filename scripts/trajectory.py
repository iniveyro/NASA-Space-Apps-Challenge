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
series=[]
total=int((ret-launch).jd)
for d in range(0,total+1):
    t=launch+d*u.day
    rEt,_=helio('earth',t)
    if d<=tof: rc=kepler_prop(rE,v1,d*86400)
    elif t<dep: rc,_=helio('mars',t)
    else: rc=kepler_prop(rM2,w1,(t-dep).jd*86400)
    dist=np.linalg.norm(rc-rEt)
    # elongation of craft from Sun as seen from Earth
    rS=-rEt; vec=rc-rEt
    el=np.degrees(np.arccos(np.dot(rS,vec)/(np.linalg.norm(rS)*np.linalg.norm(vec))))
    series.append((t.iso[:10], d+1, dist/C/60, el))
def show(day):
    s=series[day-1]; print('Day %d %s delay %.2f min elong %.1f'%(s[1],s[0],s[2],s[3]))
for day in [1,2,3,7,14,30,60,90,120,150,180,211,300,400,486,487,500,543,600,700,732,800,850,900,942]:
    if day<=len(series): show(day)
# thresholds
for th in [1/60,1,5,10]:
    for s in series:
        if s[2]>=th: print('delay first >= %.3f min on day %d (%s)'%(th,s[1],s[0])); break
blk=[s for s in series if s[3]<2.0]
print('blackout (<2 deg):', blk[0][0], blk[-1][0], len(blk), 'days, days', blk[0][1], '-', blk[-1][1])
print('max delay %.2f on %s'%max((s[2],s[0]) for s in series))
json.dump([{'date':s[0],'day':s[1],'delay_min':round(s[2],3),'elong_deg':round(s[3],2)} for s in series], open('/tmp/claude-0/-home-user/78cbc790-50ef-5ab7-8fb2-e3cc5cffd271/scratchpad/calc/delay_series.json','w'))

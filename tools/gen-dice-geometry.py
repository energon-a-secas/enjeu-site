import math, itertools, json
phi=(1+5**0.5)/2
def nz(a):
    l=math.sqrt(sum(x*x for x in a)); return tuple(x/l for x in a)
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def Rx(t):
    t=math.radians(t);c,s=math.cos(t),math.sin(t);return [[1,0,0],[0,c,-s],[0,s,c]]
def Ry(t):
    t=math.radians(t);c,s=math.cos(t),math.sin(t);return [[c,0,s],[0,1,0],[-s,0,c]]
def mm(A,B): return [[sum(A[i][k]*B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mv(A,v): return tuple(sum(A[i][k]*v[k] for k in range(3)) for i in range(3))
def Tr(A): return [[A[j][i] for j in range(3)] for i in range(3)]
def rot_to_y(a):
    a=nz(a); y=(0,1,0)
    v=(a[1]*y[2]-a[2]*y[1],a[2]*y[0]-a[0]*y[2],a[0]*y[1]-a[1]*y[0]); c=dot(a,y)
    if abs(c+1)<1e-12: return [[1,0,0],[0,-1,0],[0,0,-1]]
    K=[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]; K2=mm(K,K)
    return [[(1 if i==j else 0)+K[i][j]+K2[i][j]/(1+c) for j in range(3)] for i in range(3)]
def hull_faces(V,tol=1e-6):
    out={}
    for tri in itertools.combinations(range(len(V)),3):
        p,q,r=[V[i] for i in tri]
        u=sub(q,p); w=sub(r,p)
        n=(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])
        L=math.sqrt(sum(x*x for x in n))
        if L<1e-9: continue
        n=tuple(x/L for x in n); d=dot(n,p)
        if d<0: n=tuple(-x for x in n); d=-d
        if any(dot(n,v)>d+tol for v in V): continue
        out[tuple(sorted(i for i,v in enumerate(V) if abs(dot(n,v)-d)<tol))]=(n,d)
    return [(list(k),*v) for k,v in out.items()]

def analyse(V,axis):
    R=rot_to_y(axis); V=[mv(R,tuple(map(float,v))) for v in V]
    fs=hull_faces(V); rows=[]
    for idx,n,d in fs:
        pts=[V[i] for i in idx]
        C=tuple(sum(p[i] for p in pts)/len(pts) for i in range(3))
        r=math.sqrt(sum(x*x for x in C))
        b=math.degrees(math.asin(max(-1,min(1,-n[1]))))
        a=math.degrees(math.atan2(n[0],n[2]))%360
        M=mm(Ry(a),Rx(b)); loc=[mv(Tr(M),sub(p,C)) for p in pts]
        assert max(abs(q[2]) for q in loc)<1e-6
        ang=sorted(((math.degrees(math.atan2(q[0],-q[1]))%360), q) for q in loc)
        # start the cycle at the vertex farthest from the centroid, so a
        # non-symmetric face (the d10 kite) gets the SAME polygon on every face
        far=max(range(len(ang)), key=lambda i: math.hypot(ang[i][1][0],ang[i][1][1]))
        ang=ang[far:]+ang[:far]
        c=ang[0][0]
        Rz=[[math.cos(math.radians(-c)),-math.sin(math.radians(-c))],
            [math.sin(math.radians(-c)), math.cos(math.radians(-c))]]
        poly=[(Rz[0][0]*q[0]+Rz[0][1]*q[1], Rz[1][0]*q[0]+Rz[1][1]*q[1]) for _,q in ang]
        rows.append(dict(a=round(a,4),b=round(b,4),c=round(c,4),r=r,poly=poly))
    rows.sort(key=lambda x:(round(x['b'],3),x['a']))
    return rows

cube=[(x,y,z) for x in(1,-1) for y in(1,-1) for z in(1,-1)]
ico=sorted({(0,s1,s2*phi) for s1 in(1,-1) for s2 in(1,-1)}|{(s1,s2*phi,0) for s1 in(1,-1) for s2 in(1,-1)}|{(s1*phi,0,s2) for s1 in(1,-1) for s2 in(1,-1)})
dod=cube+[v for s1 in(1,-1) for s2 in(1,-1) for v in ((0,s1/phi,s2*phi),(s1/phi,s2*phi,0),(s1*phi,0,s2/phi))]
c36=math.cos(math.radians(36)); h=0.10557; cc=h*(1+c36)/(1-c36)
d10v=[(0,0,cc),(0,0,-cc)]
for k in range(5):
    t=math.radians(72*k);   d10v.append((math.cos(t),math.sin(t),h))
    t2=math.radians(72*k+36); d10v.append((math.cos(t2),math.sin(t2),-h))
SOLIDS={'d4':([(1,1,1),(1,-1,-1),(-1,1,-1),(-1,-1,1)],(1,1,1)),
        'd6':(cube,(0,1,0)),
        'd8':([(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)],(1,1,1)),
        'd10':(d10v,(0,0,1)),
        'd12':(dod,(0,1/phi,phi)),
        'd20':(ico,(0,1,phi))}
out={}
for k,(V,ax) in SOLIDS.items():
    rows=analyse(V,ax)
    # normalise so max vertex radius in-plane == 0.5 (fits a 1x1 box)
    m=max(math.hypot(*p) for r in rows for p in r['poly'])
    circ=max(math.dist(v,(0,0,0)) for v in [mv(rot_to_y(ax),tuple(map(float,vv))) for vv in V])
    for r in rows:
        r['poly']=[(round(0.5+x/(2*m),5), round(0.5+y/(2*m),5)) for x,y in r['poly']]
        r['rz']=round(r['r']/(2*m),5)   # translateZ as a multiple of the box width
        r['circ']=round(circ/(2*m),5)   # circumradius, also in box widths
        del r['r']
    out[k]=rows
json.dump(out,open('solids.json','w'),indent=0)
for k,rows in out.items():
    cs=sorted({r['c'] for r in rows}); poly=rows[0]['poly']
    print(f"{k}: {len(rows)} faces, translateZ = {rows[0]['rz']} x box-width, in-plane rotations {cs}")
    print(f"     clip-path: polygon({', '.join(f'{x*100:.2f}% {y*100:.2f}%' for x,y in poly)})")

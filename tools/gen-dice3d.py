#!/usr/bin/env python3
"""Regenerate css/dice3d.css from tools/dice-solids.json.

The geometry (per-face rotY / rotX / in-plane rotation / inradius, one entry
per face of each solid) is derived from first principles by
tools/gen-dice-geometry.py; this script only formats it as CSS. Every face was
verified to land with its composed normal exactly at +Z (60 of 60) before the
table was committed. Run from the repo root:

    python3 tools/gen-dice3d.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
solids = json.loads((ROOT / "tools" / "dice-solids.json").read_text())

# Circumradius equalisation: --w per solid so every die reads the same size.
W = {"d4": 1.886, "d6": 1.633, "d8": 1.633, "d10": 1.941, "d12": 1.214, "d20": 1.214}

# Flat-shade by rotateX band, light above, deep below. This is what turns a
# polygon outline into a die.
TIERS = ["#fffdf8", "#f6efdd", "#ece2c8", "#ddcfae"]

out = []
out.append("""/* ── 3D dice (generated: tools/gen-dice3d.py from tools/dice-solids.json) ──
   Real CSS polyhedra. Each face is a clipped <b> pushed to the solid's
   inradius; [data-face="N"] sets the landing angles as custom properties, so
   showing the right number is a pure attribute set (that IS the
   reduced-motion path), and the throw keyframes spin whole extra turns onto
   the same angles: rotateX(x) is rotateX(x+360k), so the tumble cannot land
   anywhere but the engine's number. EVERY keyframe uses the identical
   function list (rotateX rotateY translate3d scale): CSS Transforms 1 falls
   back to matrix slerp the moment the lists differ, which silently deletes
   the spins. Do not put filter or opacity below 1 on .die-tilt or .die3d:
   CSS Transforms 2 flattens preserve-3d under either. */
.die-stage { display: grid; place-items: center; min-height: 96px; perspective: 700px; position: relative; }
/* The landing shadow lives OUTSIDE the 3D chain (a filter or opacity inside
   .die-tilt would flatten the solid, per CSS Transforms 2), squashing wide as
   the die settles. */
.die-stage::after {
  content: ""; position: absolute; left: 50%; bottom: 6px; width: 64px; height: 12px;
  transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(closest-side, rgba(80, 66, 34, 0.28), transparent);
  pointer-events: none;
}
.die-stage.has-rolled::after { animation: die-shadow 640ms var(--ease-out); }
@keyframes die-shadow {
  0%   { transform: translateX(-50%) scaleX(0.35); opacity: 0.15; }
  74%  { transform: translateX(-50%) scaleX(1.18); opacity: 1; }
  100% { transform: translateX(-50%) scaleX(1); opacity: 1; }
}
.die-tilt { transform-style: preserve-3d; transform: rotateX(-14deg) rotateY(16deg); }
.die3d {
  position: relative; width: var(--w); height: var(--w);
  transform-style: preserve-3d;
  transform: rotateX(calc(var(--lx, 0) * 1deg)) rotateY(calc(var(--ly, 0) * 1deg));
  --die-size: 60px;
}
.die3d > b {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: var(--face-a, #fffdf8); color: var(--text-primary);
  backface-visibility: hidden;
  font-weight: 900; font-size: calc(var(--w) * 0.3);
  font-variant-numeric: tabular-nums;
}
/* One spin per axis, 640ms: two-plus-three turns at 900ms read as a blender,
   and the modal opens on a beat the player chose, so the throw should answer
   quickly. The overshoot settles the die into the shadow. */
.die3d.is-thrown { animation: die3d-throw 640ms var(--ease-out); }
@keyframes die3d-throw {
  0%   { transform: rotateX(calc((var(--lx, 0) - 360) * 1deg)) rotateY(calc((var(--ly, 0) - 720) * 1deg)) translate3d(0, -44px, 0) scale(0.6); }
  74%  { transform: rotateX(calc((var(--lx, 0) - 90) * 1deg)) rotateY(calc((var(--ly, 0) - 160) * 1deg)) translate3d(0, 6px, 0) scale(1.07); }
  100% { transform: rotateX(calc(var(--lx, 0) * 1deg)) rotateY(calc(var(--ly, 0) * 1deg)) translate3d(0, 0, 0) scale(1); }
}
/* Staggered companions for 2d6 / 3d6: same throw, offset so they patter. */
.die3d.die3d--b { animation-delay: 80ms; animation-duration: 700ms; }
.die3d.die3d--c { animation-delay: 160ms; animation-duration: 760ms; }
.die-stage .duo { display: flex; gap: 18px; align-items: center; transform-style: preserve-3d; }
""")

for die, faces in solids.items():
    w = W[die]
    out.append(f".die--{die} {{ --w: calc(var(--die-size) * {w}); }}")
    poly = faces[0]["poly"]
    if die != "d6":
        pts = ", ".join(f"{x*100:.2f}% {y*100:.2f}%" for x, y in poly)
        out.append(f".die--{die} > b {{ clip-path: polygon({pts}); }}")
    bands = sorted({round(f["b"], 3) for f in faces})
    for i, f in enumerate(faces, 1):
        out.append(
            f".die--{die} > b:nth-child({i}) {{ transform:"
            f" rotateY({f['a']:.4f}deg) rotateX({f['b']:.4f}deg)"
            f" translateZ(calc(var(--w) * {f['rz']:.5f})) rotateZ({f['c']:.4f}deg); }}"
        )
    for i, f in enumerate(faces, 1):
        tier = TIERS[min(bands.index(round(f["b"], 3)) * len(TIERS) // max(1, len(bands)), len(TIERS) - 1)]
        out.append(f".die--{die} > b:nth-child({i}) {{ --face-a: {tier}; }}")
    for i, f in enumerate(faces, 1):
        out.append(f'.die--{die}[data-face="{i}"] {{ --lx: {-f["b"]:.4f}; --ly: {-f["a"]:.4f}; }}')

dest = ROOT / "css" / "dice3d.css"
dest.write_text("\n".join(out) + "\n")
print(f"wrote {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)")

import json, re, random, sys
s = open("/home/claude/inbox/tpio/site/index.html").read()
defs = s[s.find('<svg class="sprite"'):]
defs = defs[:defs.find("</svg>") + 6].replace('class="sprite"', 'width="0" height="0" style="position:absolute"')
emb = open("/tmp/cross/emblem.html").read()
geo = emb[emb.find("<svg"):emb.rfind("</svg>") + 6]
geo_inner = geo[geo.find(">") + 1:-6]
F = json.load(open("faces.json"))

W, H, OX = 1560, 880, 230          # canvas; the 1100x880 emblem sits at x = OX
random.seed(7)

def bars(x0, x1, cy, side):
    """waveform of dots along the signal line, tallest near the node"""
    out = []
    xs = range(int(x0), int(x1), 9)
    for x in xs:
        t = (x - x0) / (x1 - x0)
        near = t if side == "left" else 1 - t
        amp = (10 + 120 * near ** 1.6) * (0.45 + 0.55 * random.random())
        n = max(1, int(amp / 9))
        for k in range(-n, n + 1):
            y = cy + k * 9
            op = 0.75 * (1 - abs(k) / (n + 1)) * (0.35 + 0.65 * near)
            out.append(f'<circle cx="{x}" cy="{y:.1f}" r="1.7" fill="#dfe6f5" opacity="{op:.2f}"/>')
    return "".join(out)

def face(kind, x, y, h, flip=False):
    f = F[kind]; k = h / f["h"]
    tr = f'translate({x},{y}) scale({k})' + (f' translate({f["w"]},0) scale(-1,1)' if flip else "")
    if kind == "human":
        body = f'<path d="{f["d"]}" fill="url(#gFace)"/>'
    else:
        dots = "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" opacity="{o}"/>' for cx, cy, r, o in f["dots"])
        body = f'<g fill="#e4ebf7">{dots}<path d="{f["d"]}"/></g>'
    return f'<g transform="{tr}">{body}</g>'

fh = 600
hw = F["human"]["w"] * fh / F["human"]["h"]
aw = F["ai"]["w"] * fh / F["ai"]["h"]
fy = 418 - fh * 0.47
art = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
  <radialGradient id="bgGlow" cx="50%" cy="47%" r="62%"><stop offset="0" stop-color="#14234a"/><stop offset=".55" stop-color="#0c1630"/><stop offset="1" stop-color="#080f22"/></radialGradient>
  <linearGradient id="gFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3bb7c" stop-opacity=".35"/><stop offset=".25" stop-color="#e3bb7c"/><stop offset="1" stop-color="#c89244"/></linearGradient>
  <linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff" stop-opacity="1"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#bgGlow)"/>
<g opacity=".9">{bars(OX + 30, OX + 175, 418, "left")}{bars(OX + 925, OX + 1070, 418, "right")}</g>
<g transform="translate({OX},0)">
  <image href="vitruvian.webp" x="0" y="0" width="1100" height="880" opacity=".82"/>
  {geo_inner}
</g>
{face("human", 52, fy, fh)}
{face("ai", W - 52 - aw, fy, fh)}
</svg>'''
art = art.replace("var(--c-green)", "#43a047").replace("var(--c-red)", "#d64036").replace("var(--c-amber)", "#f2b01e").replace("var(--c-blue)", "#3f72d8")
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#080f22}}svg{{display:block}}</style></head>
<body>{defs}{art}</body></html>'''
open("enquire-art.html", "w").write(html)
print("ok", len(html))

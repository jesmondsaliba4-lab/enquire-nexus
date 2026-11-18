"""Vectorise the two logo faces so they stay sharp at any size.
human: the gold profile line -> smoothed outline path; ai: the dotted face -> circles (+ outline for merged dots)."""
import cv2, numpy as np, json
from PIL import Image

def alpha(path):
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
    return im[..., 3] / 255.0, im[..., :3]

def contour_paths(mask, scale, eps=0.6):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if cv2.contourArea(c) < 4 * scale * scale: continue
        c = cv2.approxPolyDP(c, eps, True)[:, 0, :] / scale
        out.append("M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in c) + " Z")
    return " ".join(out)

def human(path):
    a, _ = alpha(path)
    k = 8
    big = cv2.resize(a, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), k * 0.55)
    mask = (big > 0.42).astype(np.uint8) * 255
    return {"w": a.shape[1], "h": a.shape[0], "d": contour_paths(mask, k, eps=1.2)}

def ai(path):
    a, _ = alpha(path)
    m = (a > 0.35).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    dots, blobs = [], np.zeros_like(m)
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 1: continue
        w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        if area <= 14 and max(w, h) <= 5:
            # weight the radius by the dot's actual opacity so faint dots stay faint
            op = float(a[lab == i].mean())
            dots.append((round(cent[i][0], 2), round(cent[i][1], 2), round(max(0.45, (area / np.pi) ** .5), 2), round(min(1, op * 1.15), 2)))
        else:
            blobs[lab == i] = 1
    k = 8
    big = cv2.resize(blobs.astype(np.float32) * a, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), k * 0.45)
    mask = (big > 0.4).astype(np.uint8) * 255
    return {"w": a.shape[1], "h": a.shape[0], "dots": dots, "d": contour_paths(mask, k, eps=1.0)}

H = human("/home/claude/medallion/face-human.png")
A = ai("/home/claude/medallion/face-ai.png")
json.dump({"human": H, "ai": A}, open("faces.json", "w"))
print("human path chars", len(H["d"]), "| ai dots", len(A["dots"]), "ai blob chars", len(A["d"]))

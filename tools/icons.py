"""Enquire edition icons: one 24 px line set, stroke 1.6, round caps, currentColor."""
import math, os, subprocess, sys

def bloom():
    petal = "M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z"
    return "".join(f'<path d="{petal}" transform="rotate({a} 12 12)"/>' for a in (0, 72, 144, 216, 288)) + '<circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'

ICONS = {
    "all": ("All of Enquire", "enquire.nexus",
            '<path d="M10.6 11l-.9 9h4.6l-.9-9"/><path d="M8 20h8"/><rect x="10.2" y="7.6" width="3.6" height="3.4" rx=".7"/>'
            '<path d="M12 5.4v2.2"/><path d="M8.6 8.4 4 7.2M8.6 10.2 4 11.4M15.4 8.4 20 7.2M15.4 10.2 20 11.4"/>'),
    "news": ("News", "enquire.news",
             '<path d="M4 5.5h11.5v12.8A1.7 1.7 0 0 0 17.2 20H5.7A1.7 1.7 0 0 1 4 18.3z"/>'
             '<path d="M15.5 9H20v9.3a1.7 1.7 0 0 1-3.4 0"/><path d="M7 9h5.5M7 12h5.5M7 15h3.5"/>'),
    "observer": ("Malta Observer", "enquire.observer",
                 '<path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3.1"/>'
                 '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
    "thinkpeople": ("ThinkPeople Nexus", "enquire.thinkpeople.io",
                    '<path d="M4.2 4.6Q9.4 6.6 10.9 10.8M19.8 4.6Q14.6 6.6 13.1 10.8M4.2 19.4Q9.4 17.4 10.9 13.2M19.8 19.4Q14.6 17.4 13.1 13.2"/>'
                    '<circle cx="12" cy="12" r="1.4"/>'),
    "shaiping": ("SHaiPING Malta", "enquire.shaipingmalta.eu",
                 '<path d="M12 20v-7.2"/><path d="M12 12.8c0-3.7 2.6-5.9 6.6-5.9 0 3.7-2.6 5.9-6.6 5.9z"/>'
                 '<path d="M12 15.2c0-3-2.2-4.7-5.6-4.7 0 3 2.2 4.7 5.6 4.7z"/><path d="M6.5 20h11"/>'),
    "leonardo": ("Leonardo 2050", "enquire.leonardo2050.com",
                 '<circle cx="12" cy="11.6" r="8.4"/><circle cx="12" cy="6.5" r="1.1"/><path d="M12 7.6v5.4"/>'
                 '<path d="M5 9.7h14" stroke-width="1.3"/><path d="M5.9 6.9 12 9.1l6.1-2.2" stroke-width="1.3"/>'
                 '<path d="M12 13l-1 6.9M12 13l1 6.9" stroke-width="1.3"/><path d="M12 13 7.9 18.7M12 13l4.1 5.7" stroke-width="1.3"/>'),
    "wellbeing": ("Wellbeing", "enquire.thinkpeople.you", bloom()),
    "rooms": ("Members' rooms", "enquire.nexus · sign in",
              '<circle cx="7.6" cy="12" r="3.6"/><path d="M11.2 12H20.5M17.5 12v2.8M20.5 12v2.2"/>'),
}

def svg(key, colour="currentColor", size=24):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke="{colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="{colour}">{ICONS[key][2]}</svg>')

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for k in ICONS:
        open(f"{out}/enquire-icon-{k}.svg", "w").write(svg(k) + "\n")
    # a preview sheet: each icon in its pin, plus plain at 24 px on paper
    cells = []
    for i, k in enumerate(ICONS):
        x = 20 + i * 110
        inner = ICONS[k][2]
        cells.append(f'<circle cx="{x + 40}" cy="60" r="32" fill="#0a1226" stroke="#5cc8ec" stroke-width="2"/>'
                     f'<g transform="translate({x + 40 - 19.2},{60 - 19.2}) scale(1.6)" fill="none" stroke="#5cc8ec" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="#5cc8ec">{inner}</g>'
                     f'<g transform="translate({x + 28},{120})" fill="none" stroke="#0a1d3d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="#0a1d3d">{inner}</g>')
    sheet = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{40 + 110 * len(ICONS)}" height="170"><rect width="100%" height="110" fill="#0a1226"/>'
             f'<rect y="110" width="100%" height="60" fill="#efe7d4"/>{"".join(cells)}</svg>')
    open("/tmp/icons-sheet.svg", "w").write(sheet)
    subprocess.run(["rsvg-convert", "-z", "2", "-o", "/tmp/icons-sheet.png", "/tmp/icons-sheet.svg"], check=True)
    print("ok")

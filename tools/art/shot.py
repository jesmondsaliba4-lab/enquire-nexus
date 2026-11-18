import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    pg = b.new_page(viewport={"width": 1560, "height": 880}, device_scale_factor=float(sys.argv[2]) if len(sys.argv) > 2 else 2)
    pg.goto("file:///home/claude/enquire-art/enquire-art.html"); pg.wait_for_timeout(600)
    pg.screenshot(path=sys.argv[1]); b.close()

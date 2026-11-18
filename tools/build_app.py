"""Write public/app.js from tools/app.template.js, inlining the edition icons from tools/icons.py."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from icons import ICONS
icons = {k: v[2] for k, v in ICONS.items()}
src = open(os.path.join(here, "app.template.js")).read().replace("__ICONS__", json.dumps(icons))
open(os.path.join(here, "..", "public", "app.js"), "w").write(src)
print("public/app.js written,", len(src), "bytes")

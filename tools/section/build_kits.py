"""Hand-over kits for the sites whose live copies live in other chats.
Each kit: the section, instructions for the chat that maintains the site, and (where the site's security
policy needs it) self-hosted picture files and a separate stylesheet."""
import os, re, shutil, zipfile
from build_section import SITES, CSS, section

ART = "/home/claude/enquire-nexus/public/assets"
OUT = "kits"
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)

KITS = {
    "leonardo2050.com": {"footer": '<footer class="site-footer site-footer--nexus">', "strict": False,
                         "how": "This site is the Cloudflare Worker `leonardo2050-site` (custom domains leonardo2050.com and www.leonardo2050.com)."},
    "shaipingmalta.eu": {"footer": '<footer class="site-footer">', "strict": False,
                         "how": "This site is the Cloudflare Pages project `shaipingmaltapublicsite` (shaipingmalta.eu, www.shaipingmalta.eu)."},
    "thinkpeoplenexus.com": {"footer": '<footer class="b-footer">', "strict": True,
                             "how": "This site is the Cloudflare Pages project `thinkpeoplenexus` (thinkpeoplenexus.com)."},
}

def strict_section(site):
    """Same section, but no inline <style> and self-hosted pictures, for a site whose policy allows only its own files."""
    s = section(site)
    s = re.sub(r"<style>.*?</style>\n", "", s, flags=re.S)
    s = s.replace("https://enquire.nexus/assets/enquire-art-", "/assets/enquire/enquire-art-")
    return s

for site, k in KITS.items():
    url, edition, _ = SITES[site]
    d = os.path.join(OUT, f"enquire-section-kit-{site}")
    os.makedirs(d)
    if k["strict"]:
        open(f"{d}/enquire-section.html", "w").write(strict_section(site))
        os.makedirs(f"{d}/assets/enquire")
        open(f"{d}/assets/enquire/enquire-section.css", "w").write("/* Enquire section · from enquire.nexus */\n" + CSS.strip() + "\n")
        for w in (960, 1560, 2400):
            shutil.copy(f"{ART}/enquire-art-{w}.webp", f"{d}/assets/enquire/")
        note = ("\n**This site has a strict security policy** (`style-src 'self'; img-src 'self' data:; form-action 'self'`). "
                "Under it the standard section would lose its styles and picture, and the ask box could not send the question on. "
                "That is why this kit carries its own stylesheet and pictures, and why steps 3 to 5 are needed.\n")
        steps = [
            "Work on the site's **current live source** (the version you last deployed), not an older copy.",
            "Paste the whole of `enquire-section.html` into the home page, directly above that `<footer …>` line. Do not change anything else on the page.",
            "Copy the folder `assets/enquire/` from this kit into the site, so it is served at `/assets/enquire/…` (one stylesheet and three picture sizes). The section already points to these paths.",
            "Link the stylesheet in the home page's `<head>`, next to the other stylesheet links: `<link rel=\"stylesheet\" href=\"/assets/enquire/enquire-section.css\">`",
            f"Wherever the site sets its Content-Security-Policy (most likely its `_headers` file), change `form-action 'self'` to `form-action 'self' {url.rstrip('/')}`. Change nothing else in the policy.",
        ]
    else:
        open(f"{d}/enquire-section.html", "w").write(section(site))
        note = "\nThe section is self-contained: its own styles, the picture loaded from enquire.nexus, no script. No other file changes are needed.\n"
        steps = [
            "Work on the site's **current live source** (the version you last deployed), not an older copy.",
            "Paste the whole of `enquire-section.html` into the home page, directly above that `<footer …>` line. Do not change anything else on the page.",
        ]
    steps += [
        "Deploy the site the way you normally do.",
        f"Check the live home page: the section appears just above the footer with the picture showing, and typing a question and pressing **Enquire** opens {url} with the answer.",
    ]
    step_text = "\n".join(f"{i}. {t}" for i, t in enumerate(steps, 1))
    readme = f"""# Add the Enquire section to {site}

**For the chat that maintains {site}.** {k['how']}
The owner (Jes) has approved this change: one new section on the **home page only**, placed **immediately before**
the footer, which currently starts with:

    {k['footer']}
{note}
## Steps

{step_text}

## What the section does

A picture (a human face and an AI face looking towards the Vitruvian figure and the ThinkPeople X),
the line "Bring the question. Follow it to its sources.", and an ask box. The ask box is a plain HTML form
(method GET, field `q`) that opens the question on **{url}**, the {edition} edition of Enquire, which answers it on arrival.
No script, no cookies, nothing stored on {site}.
"""
    open(f"{d}/README.md", "w").write(readme)
    z = f"{OUT}/enquire-section-kit-{site}.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(d):
            for f in files:
                p = os.path.join(root, f); zf.write(p, os.path.relpath(p, OUT))
    print(z, os.path.getsize(z))

# Add the Enquire section to leonardo2050.com

**For the chat that maintains leonardo2050.com.** This site is the Cloudflare Worker `leonardo2050-site` (custom domains leonardo2050.com and www.leonardo2050.com).
The owner (Jes) has approved this change: one new section on the **home page only**, placed **immediately before**
the footer, which currently starts with:

    <footer class="site-footer site-footer--nexus">

The section is self-contained: its own styles, the picture loaded from enquire.nexus, no script. No other file changes are needed.

## Steps

1. Work on the site's **current live source** (the version you last deployed), not an older copy.
2. Paste the whole of `enquire-section.html` into the home page, directly above that `<footer …>` line. Do not change anything else on the page.
3. Deploy the site the way you normally do.
4. Check the live home page: the section appears just above the footer with the picture showing, and typing a question and pressing **Enquire** opens https://enquire.leonardo2050.com/ with the answer.

## What the section does

A picture (a human face and an AI face looking towards the Vitruvian figure and the ThinkPeople X),
the line "Bring the question. Follow it to its sources.", and an ask box. The ask box is a plain HTML form
(method GET, field `q`) that opens the question on **https://enquire.leonardo2050.com/**, the Leonardo 2050 edition of Enquire, which answers it on arrival.
No script, no cookies, nothing stored on leonardo2050.com.

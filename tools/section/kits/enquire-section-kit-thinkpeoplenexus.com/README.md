# Add the Enquire section to thinkpeoplenexus.com

**For the chat that maintains thinkpeoplenexus.com.** This site is the Cloudflare Pages project `thinkpeoplenexus` (thinkpeoplenexus.com).
The owner (Jes) has approved this change: one new section on the **home page only**, placed **immediately before**
the footer, which currently starts with:

    <footer class="b-footer">

**This site has a strict security policy** (`style-src 'self'; img-src 'self' data:; form-action 'self'`). Under it the standard section would lose its styles and picture, and the ask box could not send the question on. That is why this kit carries its own stylesheet and pictures, and why steps 3 to 5 are needed.

## Steps

1. Work on the site's **current live source** (the version you last deployed), not an older copy.
2. Paste the whole of `enquire-section.html` into the home page, directly above that `<footer …>` line. Do not change anything else on the page.
3. Copy the folder `assets/enquire/` from this kit into the site, so it is served at `/assets/enquire/…` (one stylesheet and three picture sizes). The section already points to these paths.
4. Link the stylesheet in the home page's `<head>`, next to the other stylesheet links: `<link rel="stylesheet" href="/assets/enquire/enquire-section.css">`
5. Wherever the site sets its Content-Security-Policy (most likely its `_headers` file), change `form-action 'self'` to `form-action 'self' https://enquire.thinkpeople.io`. Change nothing else in the policy.
6. Deploy the site the way you normally do.
7. Check the live home page: the section appears just above the footer with the picture showing, and typing a question and pressing **Enquire** opens https://enquire.thinkpeople.io/ with the answer.

## What the section does

A picture (a human face and an AI face looking towards the Vitruvian figure and the ThinkPeople X),
the line "Bring the question. Follow it to its sources.", and an ask box. The ask box is a plain HTML form
(method GET, field `q`) that opens the question on **https://enquire.thinkpeople.io/**, the ThinkPeople Nexus edition of Enquire, which answers it on arrival.
No script, no cookies, nothing stored on thinkpeoplenexus.com.

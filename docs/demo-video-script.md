# UsagePass demo video (target 2:50, hard limit 3:00)

Record at 1440×900 in a clean browser window, sandbox only. Before recording:

- Open https://usagepass.onrender.com once and wait ~1 minute (the free Render instance sleeps).
- Have a sandbox **personal** buyer account signed in to sandbox.paypal.com in the same browser, so checkout is one click.
- Have the Spring launch poster request page open in a second tab, with the recut example ready.

Voiceover is written to be read slowly; each block is about the length of its time slot.

| Time | Screen | Voiceover |
|---|---|---|
| 0:00–0:20 | Home page: “License collaborative creative work in minutes.” Slow scroll over the work cards. | “A poster isn’t made by one person. This one has an illustrator, an animator and a voice artist. When a brand wants to use it in ads, today that’s an email thread, a guessed price, and someone splitting the money by hand. UsagePass turns it into a license every contributor has agreed to, paid through PayPal.” |
| 0:20–0:40 | Open **Spring launch poster → View terms**. Point at the rate card, the never-list, then the contributors block (Ines’s own terms). | “The team sets a rate card. Each contributor owns a part of the work, approved this version of the terms, and can add their own limits. Ines, the voice artist, says: no political ads with my voice, and no recut of my voiceover.” |
| 0:40–1:05 | **Request a license**. Type or pick: “Paid ads on Instagram and TikTok in Canada and the US for three months, and recut it down to 15 seconds.” Press **Get the quote**. | “A brand just writes what it wants, like an email. Gemini reads the sentence into a structured request: platforms, paid media, run length, countries, edits. It has to quote the brand’s own words for each line, and it never sets a price.” |
| 1:05–1:35 | Quote page: highlighted evidence, then the conflict block with Option A and Option B. | “Here it found a conflict: ‘recut it down to 15 seconds’ runs into Ines’s term. Instead of a dead end, the engine prices the ways through from the rate card. Option A keeps her voiceover and drops the recut, three people paid. Option B removes the voiceover and re-splits the money between the other two.” |
| 1:35–1:55 | Click **Option B**. Show the “You chose…” notice, Ines struck out, and the **Before you pay** card: “Rights approved by 2/2 contributors on this license.” | “The brand picks one. The quote is re-priced from the same reading, so nothing drifts. Before paying, they see exactly what is licensed, what isn’t, and that every contributor on this license approved these terms.” |
| 1:55–2:20 | **Pay with PayPal** → sandbox checkout → approve → back on the license page, plates snap into register, ACTIVE stamp. | “One PayPal checkout, with a separate purchase unit for each contributor, so each of them is paid straight into their own account. The license only turns active when PayPal confirms the capture with a signature-verified webhook.” |
| 2:20–2:40 | License page: ledger with each contributor’s PayPal capture ID and the fee row; history of webhook events; **Download the license record**. | “Each contributor’s payment has its own PayPal capture ID. The history shows every event PayPal sent. And the license downloads as a structured, auditable record built from creator-approved terms. A refund from PayPal revokes it.” |
| 2:40–2:52 | Press **Explain this screen**, step through two marks. | “Every screen explains itself: which PayPal API or AI step sits under each part.” |
| 2:52–3:00 | Back to the home page title. | “UsagePass turns collaborative consent into a payable license.” |

## Fallbacks

- If Gemini is slow, the quote still arrives from the backup model; if the API is down the page says “Offline reader”. Don’t cut that out, it’s honest.
- If checkout fails on camera, use **Licenses → LIC-20261108-72CR9X**, a real recorded sandbox payment with capture IDs.
- Upload to YouTube as Unlisted or Public, title “UsagePass — PayPal AI Hackathon demo”, and paste the link into Devpost.

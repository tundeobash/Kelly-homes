# Decisions

Product and technical decisions for Kelly Spaces, newest first. Each entry says
what was decided, why, and what would make us revisit it. The full review lives
in the "Kelly Spaces Baseline Review" doc.

## 2026-10-24 — Daily design limit and closed sign-up (Phase A)

**Decision:** each user gets 10 AI designs per rolling 24 hours, and sign-up is
closed by default.

- Every design attempt that reaches the image service is recorded in the
  `DesignGeneration` table and counts. Attempts that never reach it, or that it
  rejects with an HTTP error, do not count.
- `DAILY_DESIGN_LIMIT` changes the limit. `SIGNUP_ALLOWED_EMAILS` (comma
  separated) lets invited people sign up; `SIGNUPS_OPEN=true` opens sign-up.
- **Why:** each design costs about $0.06, and before this anyone could sign up
  and generate without limit.
- **Revisit when:** pricing is decided in Phase D (credit packs or subscription).

## 2026-10-24 — Image generation method: OpenAI gpt-image-2.5-sunburst (Gate 2)

**Decision:** designs are made with one OpenAI image edit
(`gpt-image-2.5-sunburst`, `/v1/images/edits`, `size=auto`) guided by a
keep-the-room instruction, a fitted-fixtures rule and a style card per style.
The old Stability two-pass method stays only as a fallback
(`IMAGE_PROVIDER=stability`, or no OpenAI key).

**Scores** (same rooms and styles for every method; 1–5, higher is better):

| Method | Room kept | Realism | Style match | Time per image | Cost per image | Output size |
| --- | --- | --- | --- | --- | --- | --- |
| OpenAI gpt-image-2.5-sunburst | 5 | 5 | 5 | 26–33 s (bake-off), 41–63 s in the app | about $0.06 | proportions kept |
| Stability Structure Control | 1 | 5 | 5 | 11–13 s | $0.05 | proportions kept |
| Previous two-pass method (Stability SD3 + inpaint) | 3 | 3 | 1 | about 45 s | about $0.12 | 1,216 × 832, proportions drift |
| Gemini image model | not tested | | | | about $0.05 | |

**Evidence**

- Bake-off 1: 3 test rooms (bedroom, living room, dining room) × 2 styles each.
  OpenAI kept panelling, ceiling detail, blinds, doorway, window frames and
  floors in all 6. Stability Structure Control replaced walls, windows and
  doors every time.
- Bake-off 2: 5 real phone photos of an empty Gulf apartment × 2 styles = 10
  designs, all with OpenAI. Architecture kept in all 10 (corridor and doors,
  windows, sliding balcony door, air-con vents, kitchen cabinets, entrance door,
  fire extinguisher, electrical panel). One slip: Modern Arabic re-clad the
  kitchen counter front, so the fitted-fixtures rule was added.
- In the app: Contemporary Majlis and Japandi on the laptop, Modern Arabic and
  Japandi on the Vercel preview. Structure kept in all 4; 50 s end to end in
  the cloud.
- Result against the Phase B bar ("at least 8 of 10 test rooms keep walls,
  windows and doors"): 8 of 8 rooms tested.
- Bake-off spend: about $0.62. Scripts: `scripts/bakeoff/` on the local
  `experiment/bakeoff` branch; photos and results in the git-ignored
  `bakeoff/` folder on the development Mac.

**Scope note:** the roadmap planned 3–4 methods × 10 rooms × 3 styles. We
tested 2 methods (plus the old one) on 8 rooms because the gap was decisive:
the alternative failed the most important criterion (keeping the room) every
time.

**Revisit when:**
- Gemini can be tested (needs billing on the Google AI Studio key; about $0.30
  with `node scripts/bakeoff/run.mjs --only=gemini-image`). It is the planned
  second provider, since image models keep being retired.
- OpenAI changes the model, price or terms, or real users report rooms being
  changed.

**Known follow-ups (Phase B):** keep doors, balcony access and walkways clear;
replace the existing ceiling light at the same point; results shift about 1–2%
against the photo (matters for a before/after slider); waits of about 50 s need
a proper loading state; send JPEG instead of a 2.3 MB PNG.

## 2026-10-23 — Separate test database

**Decision:** the laptop and Vercel preview copies use a Neon `dev` branch;
only production uses the live `main` branch.

- **Why:** before this, every copy of the app wrote to the live database.

## 2026-10-23 — Launch market: the GCC

**Decision:** launch in the Gulf first. Gulf styles (Modern Arabic,
Contemporary Majlis, Warm Modern Luxury) were added to the style list.

## 2026-10-28 — Must include, and a Living + dining room type

**Decision:** people can name up to 3 pieces a design must include (dining
table, desk, TV unit, armchair, storage, bookshelf, floor seating). A new
"Living + dining" room type always gets a dining table.

- **Why:** tester Gianluca's living room design dropped his dining table. The
  cause was the living-room layout, which has no dining area.
- **How it works:** the picks go into the image instruction (choose compact
  versions rather than leave one out). The Gemini check is asked whether each
  piece is visible. The result shows "Included as you asked", or "We couldn't
  fit the … this time" with Try again. A missing piece does not stop the design
  being saved.
- **Cap of 3:** Ayo, 28 Oct, to keep small rooms believable. No sofa bed: a
  picture cannot show that it folds out.
- **Next:** a photo of a piece you love (item 4), after the 28 Oct fidelity test
  passed (6 of 6 pieces recognisably the same).

## 2026-10-29 — Pieces you love

**Decision:** people can add a photo of one piece they like (in a shop, at a
friend's home, a screenshot) and either build a new design around it or add it
to a design they already have. Under the piece, "Get a quote from a local maker"
sends us the piece and the design (hand-run maker pilot).

- **Why:** Ayo's idea, 28 Oct; the fidelity test passed (6 of 6 pieces
  recognisably the same, the room kept in 12 of 12 renders).
- **How it works:** the person taps the piece; Gemini names it, describes it and
  finds its box. Only the cropped piece is stored (Vercel Blob), listed on the
  room for reuse and deleted with the room. The piece goes to OpenAI as a second
  image. Adding to an existing design edits that design and tells the model to
  change nothing else. The check is asked whether the piece is visible.
- **Ayo's choices, 28 Oct:** both modes; keep the piece photos with the room;
  include the maker quote link (email until a WhatsApp number is set in
  lib/landing.ts).
- **Limits:** one piece per design. Modular pieces may take the old piece's
  layout; sizes are a guess unless a width is given.

## 2026-10-29 — "Get a quote" on every design

**Decision:** every design has "Get a quote": for the whole room, or for chosen
pieces (the piece you love and the must-haves, plus anything typed). It opens
one message to us, by WhatsApp when a number is set in lib/landing.ts, else
email. The sheet promises "We'll reply within 2 working days" (Ayo, 29 Oct).

- **Why:** getting the room done is the product; asking on every design shows
  how many people want that (Phase D demand signal). Counted as quote_opened,
  quote_room_sent and quote_pieces_sent.
- Replaces the separate "Get a quote from a local maker" link under a piece,
  which now opens the same sheet with that piece ticked.

## 2026-10-29 — Budget bands, Change a piece, and the wide-photo tip

Items 5 to 7 of the 28 Oct build list, sketched and agreed with Ayo on 29 Oct.

**Budget (item 5).** A "Budget" row on the style step and on the result:
Affordable, Mid-range, Premium or Not sure yet, with AED bands per kind of room
(lib/design/budget.ts). It is kept on the room (lastAiSettings.budget) and goes
into quote requests.

- **Ayo's choices:** show AED figures; the budget does not change the design
  picture ("people might not be able to note the change in materials from the
  image design"), so there are no cheaper or premium re-renders.
- **Bands (AED, incl. VAT; furniture, rugs, lighting, curtains, decor; not
  delivery or fitting):** living room up to 12,000 / 12,000–30,000 / 30,000+;
  living + dining 18,000 / 50,000; bedroom 10,000 / 30,000; dining room 8,000 /
  25,000; office 6,000 / 20,000. Kitchen and Other: priced in the quote.
- **Basis:** a typical basket per room priced at IKEA UAE, 2XL Home (regular
  prices) and BoConcept UAE on 29 Oct 2026. Living and dining room baskets are
  50–70% checked store prices; bedroom and office are mostly estimates and
  should be checked before matching relies on them.

**Change a piece (item 7).** On any design: dots on the pieces Gemini finds
(cached on the design as detectedPieces), then Swap (quick changes, a piece you
love, or a description), Move (tap the new spot) or Remove (with a confirm).
Each change is a new design made from the one on show; the slider then compares
"Previous" and "New", and "What changed" says what was done.

- **How it works:** the image model gets the design, the same design with the
  piece outlined in red (and a red dot for a move), and for a swap with a piece
  the person loves, that piece's photo. The instruction says to change only that
  piece and to draw no marks. The check is asked whether the piece (or the new
  piece) is visible; only an empty result is refused, so removing the sofa is
  allowed. Counted as change_opened, piece_swapped, piece_moved, piece_removed.
- **Ayo's choices:** dots rather than tap-anywhere; Remove as well as Swap and
  Move. Exact products, maker options and labelled sponsored picks fit into Swap
  later.

**Wide-photo tip (item 6).** Add a room shows the same room at 1× and 0.5× and
three tips, with "Take a photo" (opens the camera) and "Choose from your
photos". A tip, not a rule (Ayo: "the idea is to capture as much of the room as
possible"; his 0.5× photos worked). The example is the empty flat already shown
on the landing page.

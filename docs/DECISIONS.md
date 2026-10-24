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

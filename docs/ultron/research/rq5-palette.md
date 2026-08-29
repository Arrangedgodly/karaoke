# RQ-5 — Dark console palette, WCAG-AA verified

Question: concrete AA-passing palette for the console re-skin. Blocks VIS-1.
Status: **committed recommendation**. Researcher: subagent, 2026-08-27;
**every ratio below computed** with the WCAG 2.x relative-luminance formula
(small text 4.5:1; non-text 3:1 per 1.4.11).

## Token set (implementation source of truth for VIS-1)

**Neutrals — warm charcoal brushed steel (warm locked: all neutrals H30–37°,
R>B 4–6 pts, S 8–10%)**

| Token | Hex | Notes (ratio vs body/panel/card) |
|---|---|---|
| `bg-body` | `#1B1917` | chassis ground |
| `bg-panel` | `#292623` | faceplate inset (1.17 step vs body — decorative) |
| `bg-card` | `#322E29` | module cards (1.12/1.30 — decorative) |
| `hairline` | `#4C463E` | seams only, decorative 1.45–1.88 |
| `line-strong` | `#857C6E` | meaningful outlines/bezels **3.28–4.26 vs all** (3:1 PASS) |

**Text**

| Token | Hex | Ratios vs body/panel/card |
|---|---|---|
| `text-primary` | `#EDE8DE` | 14.36 / 12.32 / 11.04 |
| `text-muted` (11–12px labels OK) | `#A79F92` | 6.69 / 5.74 / 5.14 |

**Amber signal accent** · `accent #F0A83C` (text 8.66/7.43/6.65; non-text
≥6.65) · `accent-hover #FFC06B` · `accent-active #D18A20` (4.73 on card) ·
`on-accent #241A08` ink (8.46–10.60 on all amber fills).

**Safety red — split role (mandatory, not stylistic)**: `red-edge #E5484D`
for ring/halo/large glyphs (3.44–4.48 non-text PASS); `red-fill #C93A32`
solid fill with white text (5.08 PASS). Never swap: white on `#E5484D` =
3.91 FAILS; `#C93A32` as edge = 2.65 FAILS.

**Focus**: `focus-ring #FFB640` (7.71–10.03 both neutrals) ·
`focus-ring-on-accent #241A08` (amber-on-amber = 1.16 unusable).

**Family edges** (chips carry 2-letter silkscreen initials in `#241A08`,
7.06–9.82 — redundant encoding; all ≥3:1 vs card with ≥1.7 headroom):
Gain brass `#D9C37A` · Compressor `#8CC079` · EQ `#82A9DE` · Delay
`#B18FDE` · Reverb `#6FC2C8` · Limiter `#DE8FB0`.

**Status/meter**: `status-live #7BD389` (assign LIVE to **amber** per brief;
green = success/ready only, de-conflicts compressor green) ·
`status-error #FF806E` · meter stops `#5CC06E` / `#F0A83C` / `#F05A45`
(4.01–6.65 vs panel/card).

## Anti-neon rationale (design-brief discipline)

Lightness zoning, not desaturation-as-style: grounds L 10–18% S 8–10% (warm
charcoal, never blue-black); accents in a narrow L 58–72% band (backlit lamp
glass); only amber (S86) and red (S75) reach high saturation, capped L~59 —
backlit panels, not lasers; family accents S 36–58 (enamel/chip caps); the
two lightest values reserved for transient states and 8px dots. Reserved
hues (36°, 358°) vs family hues (46–335° spread) — no cyan-magenta terminal
signature.

## Honest failures + adopted fixes

1. White small text on bright red fails → split-role red (above).
2. Hairline can't be both subtle and 3:1 → decorative-only; interactive
   boundaries use `line-strong`/family stripes/focus rings.
3. Amber-on-amber focus → dark ring variant on amber-filled controls.
4. `accent-active` margin thin (4.73) → prefer label-amber or ink-on-fill
   for pressed states.

## Risks

High confidence (all arithmetic exact). Medium: 1.12–1.30 layer separation —
1× visual check; fallback `bg-card #34302A` pre-verified passing. Medium-low:
amber↔brass proximity (de-conflicted by chroma/role/initials; fallback Gain
`#DEC88A` pre-verified). Low: green collisions (context-separated).

## Plan consequences

VIS-1 adopts this table verbatim as `:root` tokens; QA-4 re-verifies on the
rendered surface; meter zones in VIS-5 use the three meter stops.

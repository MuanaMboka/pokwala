# Photo credits and licence notes

All photography in `assets/photos/` is from [Pexels](https://www.pexels.com) under the
[Pexels Licence](https://www.pexels.com/license/).

**What the licence allows:** free commercial and non-commercial use, no permission needed,
no attribution required. Attribution is appreciated and is recorded here as good practice.

**What it does not allow:** selling unmodified copies of the photos, compiling them to build
a competing stock service, or using identifiable people in a way that implies endorsement of
a product or that portrays them offensively. Using them inside a website template that is
sold as a template is fine, because the value sold is the template, not the photograph.

> **Before a client site goes live:** replace these with real photos of that client's own
> crew, van and work. Stock imagery is scaffolding. See `PHOTO-SHOT-LIST.md`.

> **The three review portraits need replacing first.** A stock face beside a named quote —
> "Daniel R., Ottawa, ON" — reads as a fabricated testimonial, and the Pexels licence does
> not cover implying that the person endorses the business. Swap in real customers who have
> given permission, or drop the portraits and keep the names.

## Files

Landscape photos are saved at three widths for `srcset`; avatars at one.

| Base filename | Widths | Subject | Photographer | Source |
|---|---|---|---|---|
| `hero-pipe-repair` | 480 / 1024 / 1920 | Plumber in blue workwear fitting a radiator pipe | Sergei Starostin | [pexels.com/photo/…29226620](https://www.pexels.com/photo/professional-plumber-installing-a-radiator-pipe-29226620/) |
| `service-van` | 480 / 1024 / 1600 | Technician in hi-vis with a tool crate beside a white van | Rene Terp | [pexels.com/photo/…13821194](https://www.pexels.com/photo/smiling-man-in-workwear-holding-tools-13821194/) |
| `pipes` | 480 / 1024 / 1600 | Grey pipework run across an exterior wall | Bùi Hoàng Long | [pexels.com/photo/…12142829](https://www.pexels.com/photo/plastic-pipes-on-wall-12142829/) |
| `avatar-daniel` | 160 | Bearded man, white shirt | Nishant Aneja | [pexels.com/photo/…7397453](https://www.pexels.com/photo/close-up-shot-of-a-bearded-man-7397453/) |
| `avatar-sarah` | 160 | Smiling woman, short blonde hair | Татьяна Танатова | [pexels.com/photo/…3936894](https://www.pexels.com/photo/selective-focus-photo-of-woman-smiling-3936894/) |
| `avatar-james` | 160 | Man in a red shirt and dark blazer | John Stephenson | [pexels.com/photo/…5308640](https://www.pexels.com/photo/close-up-of-bearded-man-5308640/) |

## Why these three

The hero, van and pipe shots were picked as a set, not individually. All three carry cool
blue-grey mid-tones, which is what lets `--ink` and `--brand` sit on top of them without a
colour fight — the same reasoning as the auto-repair template's warm tungsten set, inverted
for a trade that sells clean water rather than mechanical work.

The hero shot in particular is framed with its subject right of centre and its darkest
values on the left, which is exactly where the hero scrim needs something to hold on to.
Any replacement should keep that property or the headline will need its own backing plate.

Rejected candidates, so the next vertical does not re-litigate this:

- Workshop repairman with a red machine behind him — the red fought `--brand` directly.
- Bright, white-walled faucet studio shots — no dark values anywhere for the scrim.
- Rows of parked delivery vans — reads as logistics, not as a plumber who comes to you.

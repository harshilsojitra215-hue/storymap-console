# Notes

## Where the five hours are hypothesised to go

The challenge asks how five hours of content-creation work becomes thirty minutes. This prototype
takes a position on that, and the position is falsifiable — which is the point of the measurement
panel.

The hypothesis: **most of the five hours is not spent producing content. It is spent in a
check-and-fix loop**, and the loop is at its worst around the map camera.

Writing the German text for a chapter takes as long as writing takes. Translating it takes as long
as translating takes. Neither is where an editor loses an afternoon. The afternoon goes to the
part where a person types five numbers that describe a camera, cannot evaluate them without
rendering them, saves, opens the page, discovers the shot is framed wrong or tilted so far that a
tower block covers the tunnel portal, and goes back. Each pass through that loop costs a page
load, a scroll back to the right chapter, and the loss of whatever map position they were looking
at. Repeat per chapter, per revision, per stakeholder comment.

Two things follow, and the prototype implements both:

1. **Remove the reload.** If the preview is live and persistent, the check stops being a trip. It
   becomes something that has already happened by the time you look up.
2. **Stop typing the numbers at all.** The camera is the one field where a person's hands are
   better than their arithmetic. Let them fly the map to the shot they want and take the numbers
   off it. That is "Use this view", and it is the single change most likely to matter.

The rest of the five hours is a long tail of small errors caught late: a missing alt text found
during an accessibility review, an English field nobody filled, coordinates entered the wrong way
round and only noticed because the map looked empty. Individually trivial, collectively expensive,
because each is found long after the moment it was cheap to fix. Catching them at the keystroke is
worth more than catching them well.

### Why the measurement panel counts what it counts

Edits per field is the useful signal. A field that gets edited eleven times in one session is a
field whose value cannot be judged from the form, and that is exactly the definition of the
problem worth fixing. Counting it turns "we think the camera is the painful part" into something
that can be checked against real editors, and it produces the error taxonomy by observation
instead of by guessing.

The panel deliberately does **not** show a time-saved figure. Producing one would require timing
real editors doing real work before and after, and this prototype has done neither. A number
invented for a slide is worse than an empty space where a number should be, because it cannot be
defended when someone asks how it was derived.

## The next three steps

**1. Bind it to the real CMS.** Replace the local JSON with the actual content model over GraphQL:
load chapters, write them back, handle drafts and published states. This is the least interesting
step technically and the most important practically, because until edits persist, none of this is
a tool — it is a demonstration. The state in `app/page.tsx` is already shaped like a chapter
record, so the change is mostly a data layer, not a rewrite.

**2. Telemetry from the running preview.** Right now the console tells the preview what to do and
the preview says nothing back. It should. The preview knows things the form cannot: that a tile
request failed, that an image is missing, that the camera ended up somewhere with no rendered
data, that a layer referenced in a chapter does not exist in the style. A channel from the preview
back into the checker turns findings from "what the form can prove" into "what actually happened
when we rendered it" — which is a much larger and more useful class of error.

**3. Then, and only then, a language model over the rule set.** The rules in `lib/rules.ts` catch
what is checkable. They cannot catch a chapter whose text describes the eastern portal while the
camera points west, a translation that says something different from the German, or a caption that
does not match its image. Those need judgement, and that is what a model is for.

The order matters. The rule set is what gives a model something to be accurate *against*: a fixed
taxonomy of known errors, a corpus of real findings, and a measurable hit rate. Starting with the
model instead would produce something that sounds knowledgeable and cannot be evaluated. The
challenge asks for ≥80% of common configuration errors caught — you cannot claim a percentage
without first writing down what the denominator is. `lib/rules.ts` is the beginning of that
denominator.

## Things I would change with more than a day

- Edits are not persisted at all, so a reload loses everything. Even `localStorage` would make it
  feel like a tool rather than a toy.
- There is no undo. A misplaced "Use this view" overwrites the previous camera with no way back.
- The rules are hard-coded rather than configurable per project. Real projects are not all in
  Germany, and the bounding box should come from the project, not from a constant.
- No tests. The rules in `lib/rules.ts` are pure functions of one chapter and would be
  straightforward to cover properly — that is the first place tests should go.
- The chapter list has no reordering, and a real story is an ordered sequence.

# Study Notes — Project Spec

A plain-text-first semantic study editor for DRBU coursework. Single-file HTML, vanilla JS, no build step.

---

## Context

Building a custom note-taking app for DRBU coursework. Primary use case: paste source text from PDF readings (Lotus Sutra, Heidegger, Abhidhamma, etc.) and weave personal commentary, glosses, and conceptual tags into the text. Secondary use case (later phase): draw causal-relation diagrams to summarize Buddhist and philosophical schemas (12 nidānas, paṭṭhāna's 24 paccayas, Heideggerian existential structures, etc.).

This is **not** OneNote. It is **not** a WYSIWYG editor. It is a **plain-text-first semantic study editor** where the typed syntax IS the document, with hybrid styling (visible while editing the active line, rendered when away).

## Stack constraints (NON-NEGOTIABLE)

- **Single-file HTML.** One `index.html` containing all CSS + JS. Possibly a small companion file or two if genuinely needed (e.g. themes), but no bundler, no npm, no build step.
- **Vanilla JS.** No React, no Tiptap, no Slate, no framework. `contenteditable` + custom rendering logic.
- **Static hosting.** Will deploy to GitHub Pages or Cloudflare Pages alongside other projects (Academic Planner, Flashcards app, Agroforest).
- **Free forever, no recurring costs, no maintenance burden.**
- **No login, no Supabase, no cloud sync** in v1. localStorage only + manual export.

## Workflow constraint

Claude Code commits after **each numbered item** in the phased plan, not at the end. Wait for review before proceeding to the next item.

---

# Comment grammar

This is the heart of the project. The user provided these actual usage samples:

```
#Analogy
child -> man -> runs away from father, gone for 20-50 years -> increasingly impoverished
father's treasury overflowing with riches and assets
"He profited through lending and his trade with other countries was also great"

4. Faith and Understanding
chief sravakas:
heard prediction -> filled w/wonder & ecstatic joy [moistened, electrified #elemental] -> homage -> rapt attention -> bow, veneration -> gaze at Buddha's face

#Buddha: I pour down the rain of the Dharma,
Fulfilling the world,
#Sentient beings:
And the sentient beings
Practice the Dharma of one flavor
According to their capacities.

#small trees #irreversible bodhisattvas
The heirs of the buddhas
Who concentrate on the path of the Buddha,
[turn their mind to the buddha way]
Who always cultivate compassion within themselves
And know definitely [for sure] without a doubt
That they will become buddhas,
```

And earlier:

```
#skillful means
wanting to get his son back, the wealthy man employed
skillful means and secretly dispatched two attendants of wretched and humble appearance
-he will be paid double
```

## Tag scope (parser rule)

A `#tag` opens a styling span that runs from the character after the tag name until the **first** of these terminators is reached:

- the next `#tag` on the same line/segment
- a line break
- a paragraph break (blank line)
- a `]` (end of a bracket span)
- the start of any other comment-tag construct (e.g. `--`, future tag prefixes — list will grow as new types are invented)

The tag's name is the run of word characters and spaces immediately following `#`, terminated by the same set of boundaries. Whitespace inside a tag name is allowed (`#small trees` is one tag, name = `"small trees"`).

This is a single, uniform rule. There is no special "block tag" parsing — section grouping happens at the renderer level (see "Standalone-tag-line render convention" below).

Tag names are **arbitrary user-defined**, not from a fixed list (`#Analogy`, `#Buddha`, `#elemental`, `#small trees`, `#skillful means`, `#irreversible bodhisattvas`, etc.).

## Brackets

`[...]` creates a **bracket span**. The bracket span is its own context.

- A `#tag` inside a bracket cannot escape the `]`. The tag's span terminates at `]` even if no other terminator was reached.
- The bracket's outer style applies to the whole bracket contents. A tag inside the bracket adds its own chip and may restyle its trailing content within the bracket, but the bracket's structural style (e.g. muted gray gloss) remains the dominant outer context.
- Nested brackets are not supported in v1. A `[` inside an already-open bracket is treated as a literal `[`.

## Gloss lines

A line beginning with `-` (followed by space) is the user's own annotation on the preceding source text. Example: `-he will be paid double`. It gets a distinct style from source text. `-` (and future `--`, etc.) is a structural line-prefix that establishes the line's outer context.

## Standalone-tag-line render convention

Parser rule alone does not give `#Analogy` (alone on a line) any influence over the lines below it. To match real usage where `#Analogy` reads as a section label, the **renderer** layers a convention on top:

A line whose entire content (after trim) is one or more `#tags` and nothing else is classified as a **section header line**. The renderer:

- Renders the tag(s) as styled chips/labels.
- Applies a section-grouping visual to the lines that follow — by default, a left border or subtle background tint colored from the *first* tag on the section header line.
- The grouping ends at: the next blank line, the next section header line, or end of document.

Lines with multiple tags *and* content (`#small trees #irreversible bodhisattvas\nThe heirs of the buddhas...`) are **not** section headers — they're tagged content lines, and the tags act as classifiers on that line only. The lines below are plain content.

This is purely a render-time concern. The parser does not need to know about section grouping; it just labels each line with a `lineType` that includes `"section-header"` when applicable.

## Arrows (`->`, `<-`, `<->`)

`->`, `<-`, `<->` are converted to styled arrow elements **on space keypress** following the arrow sequence (or on punctuation/EOL after the sequence — be liberal).

- Until the user presses space, the literal characters stay as typed. The user sees `->` while still constructing it.
- The rendered arrow is treated as **atomic**: backspace adjacent to or inside the rendered arrow deletes the entire arrow as a single unit, not character by character.
- The arrow is stored in the raw document text as the literal `->` / `<-` / `<->` — the conversion is a render concern, not a storage concern. Re-parsing a saved document re-renders arrows correctly with no extra metadata.

Implementation: render arrows as `<span class="arrow" data-arrow="->">→</span>` or similar; on backspace, detect whether the cursor is adjacent to such a span and remove the whole span (corresponds to removing the 2 or 3 source characters from the line's raw text).

## Quoted text

Skipped in v1. Revisit in Phase 6 polish.

## What we are NOT building (explicitly scoped out)

- ❌ `##subcomment` — only `#tag` exists, with arbitrary names
- ❌ Toolbar-driven hidden tag insertion — syntax is visible, typed, and IS the document
- ❌ Drag-and-drop blocks, freeform canvas, OneNote-style floating containers
- ❌ Mermaid diagrams — deferred to later phase
- ❌ Chart/spreadsheet insertion — was a placeholder term in the original brief, not actually needed
- ❌ Cloud sync, login, Supabase, Google Drive — deferred
- ❌ Collaborative editing
- ❌ React, TypeScript, Tiptap, Slate, build pipeline

---

# Display mode: hybrid editing

This is the **key UX decision**.

- When the cursor is on a line, that line shows **raw syntax** (`#Analogy` visibly with the `#`).
- When the cursor leaves a line, that line **renders styled** (`#Analogy` becomes a styled label, the `#` is visually de-emphasized or hidden, depending on tag style).
- Implementation: track active line in `contenteditable`; apply `.editing` class to active line that disables transformations; non-editing lines get full styling pass.
- Re-rendering only happens on line-blur, not on every keystroke — performance-friendly.

---

# Context-sensitive typography

**Bold and italic are not just bold and italic.** Their *appearance* changes based on which comment context they sit inside.

A theme defines a **style table** where each comment context (plain text, inside `#Buddha`, inside `#Analogy`, inside `[brackets]`, inside `-` gloss line, etc.) has its own rendering for:

- bold weight + color
- italic slant + color (or replacement, e.g. italic in `#Buddha` could be small-caps instead)
- regular text color
- background tint of the line/region
- font family override (optional)

Example mental model — a theme might define:

| Context             | Bold style              | Italic style            | Text color  |
|---------------------|-------------------------|-------------------------|-------------|
| Plain text          | bold black              | italic black            | #1a1a1a     |
| Inside `#Analogy`   | bold deep amber         | italic amber, smallcaps | #6b4a1a     |
| Inside `#Buddha`    | bold gold, slight shadow| italic gold             | #8a6914     |
| Inside `[brackets]` | bold muted gray         | italic muted gray       | #6a6a6a     |
| `-gloss` line       | bold blue               | italic blue             | #3a5a8a     |

User emphasis: **"bold and italics need to not just to bold and italics, but to have different styles/colors. they are compoundedly different in every comment type."**

## Style composition (gloss + tag, etc.)

Bold/italic rendering walks the segment tree and resolves styles from outermost to innermost: line context → tag context → leaf bold/italic. **For any given style property** (color, weight, font, etc.), the innermost defined value wins. Undefined properties at an inner level fall through to the outer level.

Example: in `-#question this seems wrong`, the line is `gloss` context (e.g. blue text), `#question` chip renders, and "this seems wrong" picks up `#question`'s color *if* the theme defines one for `#question`; otherwise it stays gloss-blue.

## Tag color assignment

Themes define an explicit **style table** for known tags plus a `defaultTagPalette` array of N styles (suggest N=8).

When the renderer encounters a tag with no explicit theme entry, it assigns the tag a palette slot. Assignments are **persisted per-document** in the saved JSON:

```json
{
  "title": "...",
  "theme": "paper",
  "tagAssignments": {
    "#elemental": 3,
    "#metaphor": 0,
    "#small trees": 5
  },
  "lines": [...]
}
```

New tags get the next free palette slot (slots taken by other tags in the same document are skipped); when all N slots are used, wrap around.

If the user later adds an explicit theme entry for a tag, the explicit entry wins on render. The palette assignment stays in the JSON but is ignored — harmless, and survives the user removing the theme entry.

---

# Document model

Each line has:

- `raw`: the user-typed string (source of truth, persisted).
- `lineType` (derived, not persisted): one of `"section-header"`, `"tagged-content"`, `"gloss"`, `"plain"`, `"empty"`.
- `tags` (derived): list of `{ name, startCol, endCol }` for tags appearing on the line.
- `segments` (derived): a tree of segments produced by the parser, capturing bracket spans, tag spans, gloss-line wrapping, bold/italic runs, and arrow positions.

Persistence stores `raw` lines + document-level metadata (`title`, `theme`, `tagAssignments`, `created`, `modified`). Everything else is re-derived on load. The syntax IS the structure — there is no separate AST in storage.

---

# Saving (v1 — minimal)

- Continuous **localStorage** autosave (debounced ~500ms after typing stops).
- **Ctrl+S** triggers a download of `{document_title}.json`.
- **Import** button to load a JSON file back.
- That's it for v1. Backup ring / file system access / cloud is later.

---

# Themes

- Theme is a JS object defining the style table described above.
- Initial v1: ship with 2-3 themes (one light, one dark, one paper/sepia).
- Theme switcher: single button cycles through, or dropdown.
- Themes are extensible — adding a new theme = adding a new object to a themes array.

---

# `contenteditable` strategy (Phase 3)

The editor is a single `contenteditable="true"` div containing one `<div data-line-id="...">` per line.

- **On keystroke (`input` event):** Maintain line tracking and the `.editing` class on the active line. Do **not** parse, do **not** re-render. Cheap.
- **On line blur:** Read the active line's `textContent`, strip all injected markup, re-parse, re-render that one line. Update the persisted `raw` for that line.
- **On `beforeinput`:** Intercept where supported to prevent browsers from injecting unwanted markup (especially on Enter and on paste).
- **On paste:** Always paste as plain text (`event.preventDefault()` + `clipboardData.getData('text/plain')` then insert). Never accept HTML paste.
- **`MutationObserver` safety net:** Watch for stray injected nodes (browsers sometimes wrap selections in `<span style="...">` on bold/italic key combos). Normalize by reading `textContent` of the affected line and replacing its DOM with the re-rendered version.
- **Enter:** Creates a new sibling `<div data-line-id="...">` after the current line. New line gets `.editing`. Cursor moves to start of new line.
- **Backspace at line-start:** Merge with previous line — append the current line's `raw` to the previous line's `raw`, remove the current div, set cursor at the join point, re-render the merged line on blur.
- **Bullet/number list:** When a line starts with `* ` or `1. ` (matched after blur), render with a list marker. Storage stays as raw text. No nesting in v1.

This will not be friction-free across browsers. Plan for Phase 3 to take longer than the other phases — `contenteditable` quirks are where most of the time goes.

---

# Phased build plan

**Workflow reminder: commit after each numbered item, not at the end. Wait for review before proceeding.**

## Phase 1 — Document model + parser (NO UI yet)

1. Define line-types and tag-extraction logic in pure JS functions.
2. Write a parser: input = raw line string → output = `{ lineType, tags: [...], segments: [...] }`.
3. Write `tests.html` (single-file, vanilla, no build step) that imports the parser and runs assertions against the test fixtures below. Open in browser → green/red. Acceptance criterion for Phase 1: all fixtures pass.

## Phase 2 — Render layer

1. Build `renderLine(parsedLine, theme, isEditing)` → returns DOM.
2. Implement `->` / `<-` / `<->` arrow rendering as styled `<span class="arrow">` elements.
3. Implement bracket gloss rendering.
4. Implement `#tag` rendering (chip + line styling).
5. Implement `-` gloss line rendering.
6. Implement context-sensitive bold/italic by walking parsed segments and applying theme rules.
7. Implement section-header render convention (left border / tint on lines following a standalone-tag line).

## Phase 3 — `contenteditable` editor + hybrid display

1. Wire up `contenteditable` div, one `<div>` per line.
2. Track active line; apply `.editing` class to it (raw syntax visible).
3. On blur of a line, re-parse + re-render that line only.
4. Handle Enter (creates new line, simple line break behavior — no prose-paragraph indent).
5. Handle backspace at line start (merge with previous line).
6. Handle arrow conversion on space, with atomic backspace.
7. Handle bullet/number lists (`* ` or `1. ` at line start) — basic, not nested in v1.
8. Plain-text paste handler.
9. `MutationObserver` safety net for browser-injected markup.

## Phase 4 — Persistence

1. localStorage autosave (debounced ~500ms).
2. Load from localStorage on page load.
3. Ctrl+S → download JSON.
4. Import JSON button.
5. Document title field.

## Phase 5 — Themes

1. Build theme object schema.
2. Ship 2-3 starting themes (light, dark, paper/sepia).
3. Theme switcher button.

## Phase 6 — Polish + Tier 1 formatting tools

1. Toolbar for bold/italic/color (Cmd+B, Cmd+I shortcuts; toolbar buttons too).
2. Diacritic helper (a small palette for Sanskrit/Pali characters: ā ī ū ṛ ṝ ḷ ṃ ḥ ñ ṭ ḍ ṇ ś ṣ — and capitalized versions).
3. Quick-insert palette for arrows and academic notation (⇒ ⇔ — • ¶ §).
4. Tag autocomplete (suggest existing tags from current document).
5. Optional: quoted-text styling.

## DEFERRED (later phases, do not build now)

- Mermaid-style schema/diagram blocks (the causal-relation diagrams for nidānas etc.)
- File System Access API for silent file writes
- Backup ring (FIFO 25 versions)
- Google Drive sync
- Supabase sync
- Export to Markdown / HTML / PDF
- Mobile layout

---

# Phase 1 test fixtures

These are the minimum set Phase 1 must pass. Embed them in `tests.html` as assertions.

```
INPUT:  #Analogy
EXPECT: lineType="section-header", tags=[{name:"Analogy"}], segments=[]

INPUT:  #Buddha: I pour down the rain of the Dharma,
EXPECT: lineType="tagged-content",
        tags=[{name:"Buddha"}],
        segments=[
          {type:"tag-span", tag:"Buddha", text:": I pour down the rain of the Dharma,"}
        ]

INPUT:  [moistened, electrified #elemental]
EXPECT: lineType="plain",
        segments=[
          {type:"bracket", children:[
            {type:"text", text:"moistened, electrified "},
            {type:"tag-span", tag:"elemental", text:""}
          ]}
        ]

INPUT:  #small trees #irreversible bodhisattvas
EXPECT: lineType="tagged-content",
        tags=[{name:"small trees"}, {name:"irreversible bodhisattvas"}],
        segments=[
          {type:"tag-span", tag:"small trees", text:" "},
          {type:"tag-span", tag:"irreversible bodhisattvas", text:""}
        ]

INPUT:  -he will be paid double
EXPECT: lineType="gloss",
        segments=[{type:"text", text:"he will be paid double"}]

INPUT:  child -> man -> runs away from father
EXPECT: lineType="plain",
        segments=[
          {type:"text", text:"child "},
          {type:"arrow", dir:"right"},
          {type:"text", text:" man "},
          {type:"arrow", dir:"right"},
          {type:"text", text:" runs away from father"}
        ]

INPUT:  And know definitely [for sure] without a doubt
EXPECT: lineType="plain",
        segments=[
          {type:"text", text:"And know definitely "},
          {type:"bracket", children:[{type:"text", text:"for sure"}]},
          {type:"text", text:" without a doubt"}
        ]
```

---

# Repo

- This repo: `arlov-commits/texteditor`.
- Single `index.html` at root + a `themes/` folder if themes get large + this `SPEC.md` + `README.md`.
- GitHub Pages or Cloudflare Pages deployment when ready.

# First task for Claude Code

Read this entire spec, then start with **Phase 1, item 1**: define the line-types and tag-extraction logic in pure JS functions. Commit after that single item. Wait for review before proceeding to item 2.

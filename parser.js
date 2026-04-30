// Phase 1, item 1: line-type classification + tag extraction.
// Pure functions, no DOM, no side effects. Loaded as a plain script
// (exposes `Parser` global) and also usable via CommonJS for tests if needed.

(function (root) {
  'use strict';

  // Characters that terminate a #tag name (besides end-of-string).
  // Newlines are not expected here — callers pass a single line.
  // `#` starts another tag, `]` closes a bracket span, `[` opens one.
  // Future comment-construct prefixes (e.g. `--`) will be added here.
  function isTagNameChar(ch) {
    if (ch === undefined) return false;
    if (ch === '#' || ch === '[' || ch === ']') return false;
    if (ch === '\n' || ch === '\r') return false;
    // Word chars and spaces are allowed inside a tag name.
    // Anything else (punctuation like `:`, `,`, `.`) ends the name.
    return /[\w ]/.test(ch);
  }

  // Extract tags from a single line's raw string.
  // Returns [{ name, startCol, endCol }] where startCol points at the `#`
  // and endCol is the index just past the last char of the tag name.
  // Trailing spaces are stripped from the name (so `#small trees ` → "small trees").
  function extractTags(raw) {
    if (typeof raw !== 'string') return [];
    const tags = [];
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '#') {
        const start = i;
        let j = i + 1;
        while (j < raw.length && isTagNameChar(raw[j])) j++;
        const rawName = raw.slice(i + 1, j);
        const name = rawName.replace(/\s+$/, '');
        if (name.length > 0) {
          tags.push({ name, startCol: start, endCol: i + 1 + name.length });
        }
        // Advance past the scanned name region. If the name had trailing
        // spaces that were trimmed, the scanner still consumed them — that's
        // fine; they belong to the tag's "trailing whitespace", not the next
        // token.
        i = j;
        continue;
      }
      i++;
    }
    return tags;
  }

  // Replace bracket spans with spaces of equal length so that bracket-interior
  // tags don't influence top-level line classification, while column offsets
  // of top-level tokens are preserved. Nested brackets aren't supported in v1
  // (a `[` inside an open bracket is literal), so a single left-to-right scan
  // is correct.
  function maskBrackets(raw) {
    let out = '';
    let inBracket = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (!inBracket && ch === '[') {
        inBracket = true;
        out += ' ';
      } else if (inBracket && ch === ']') {
        inBracket = false;
        out += ' ';
      } else if (inBracket) {
        out += ' ';
      } else {
        out += ch;
      }
    }
    return out;
  }

  // Classify a single raw line.
  // Returns one of: "empty", "gloss", "section-header", "tagged-content", "plain".
  // - empty:           whitespace-only
  // - gloss:           starts with `- ` (dash + space) — user annotation line
  // - section-header:  trimmed content is exactly one top-level #tag, nothing else
  // - tagged-content:  has at least one top-level #tag (and is not a section-header)
  // - plain:           anything else (including lines whose only tags are inside [ ])
  function classifyLine(raw) {
    if (typeof raw !== 'string') return 'empty';
    if (raw.trim().length === 0) return 'empty';

    // Gloss line: `-` followed by a space. (`--` and other prefixes will be
    // added as separate line types later; not in scope for item 1.)
    if (/^- /.test(raw)) return 'gloss';

    const masked = maskBrackets(raw);
    const topLevelTags = extractTags(masked);
    if (topLevelTags.length === 0) return 'plain';

    // Section-header rule (per Phase 1 fixtures): exactly one top-level tag,
    // and the trimmed line is just that one `#tagname`. Multiple bare tags
    // act as classifiers → tagged-content, not a header.
    if (topLevelTags.length === 1) {
      const t = topLevelTags[0];
      if (masked.trim() === '#' + t.name) return 'section-header';
    }
    return 'tagged-content';
  }

  const api = { classifyLine, extractTags };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Parser = api;
  }
})(typeof self !== 'undefined' ? self : this);

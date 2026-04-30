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

    // Gloss line: `-` at start, but not the start of an arrow (`->`).
    // Both `- foo` and `-foo` are gloss (per Phase 1 fixtures).
    if (/^-(?!>)/.test(raw)) return 'gloss';

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

  // Parse a single raw line into { lineType, tags, segments }.
  //
  // Segment shapes:
  //   { type: "text",      text: string }
  //   { type: "arrow",     dir: "left" | "right" | "both" }
  //   { type: "bracket",   children: Segment[] }
  //   { type: "tag-span",  tag: string, text: string }
  //
  // tag-span carries flat trailing text (not children) — matches fixtures.
  // The renderer can decide later whether to recognize arrows inside it.
  function parseLine(raw) {
    if (typeof raw !== 'string') raw = '';
    const lineType = classifyLine(raw);
    const tags = extractTags(raw);

    if (lineType === 'empty') return { lineType, tags: [], segments: [] };
    if (lineType === 'section-header') return { lineType, tags, segments: [] };

    let body = raw;
    if (lineType === 'gloss') {
      // Consume the `-` prefix and at most one following space.
      body = raw.replace(/^-( )?/, '');
    }
    return { lineType, tags, segments: parseSegments(body, false) };
  }

  // Walk `text` left-to-right, emitting segments. When `inBracket` is true,
  // `]` ends the current scope (the caller resumes after it).
  function parseSegments(text, inBracket) {
    const out = [];
    let buf = '';
    let i = 0;

    function flush() {
      if (buf.length > 0) {
        out.push({ type: 'text', text: buf });
        buf = '';
      }
    }

    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1];
      const next2 = text[i + 2];

      // Bracket open — only at top level (nested brackets not supported in v1).
      if (ch === '[' && !inBracket) {
        flush();
        let j = i + 1;
        while (j < text.length && text[j] !== ']') j++;
        const inner = text.slice(i + 1, j);
        out.push({ type: 'bracket', children: parseSegments(inner, true) });
        i = j < text.length ? j + 1 : j;
        continue;
      }

      // Arrows — try longest match first.
      if (ch === '<' && next === '-' && next2 === '>') {
        flush();
        out.push({ type: 'arrow', dir: 'both' });
        i += 3;
        continue;
      }
      if (ch === '-' && next === '>') {
        flush();
        out.push({ type: 'arrow', dir: 'right' });
        i += 2;
        continue;
      }
      if (ch === '<' && next === '-') {
        flush();
        out.push({ type: 'arrow', dir: 'left' });
        i += 2;
        continue;
      }

      // Tag-span open.
      if (ch === '#') {
        let j = i + 1;
        while (j < text.length && isTagNameChar(text[j])) j++;
        const rawName = text.slice(i + 1, j);
        const name = rawName.replace(/\s+$/, '');
        if (name.length > 0) {
          flush();
          // Span text runs from just after the trimmed tag name to the next
          // terminator: `#`, `[`, or (when inBracket) `]`. End-of-string also
          // terminates. Trailing whitespace eaten by the name scan still
          // belongs to the tag-span's text — restore it via spanStart.
          const spanStart = j - (rawName.length - name.length);
          let k = j;
          while (k < text.length) {
            const c = text[k];
            if (c === '#' || c === '[') break;
            if (c === ']' && inBracket) break;
            k++;
          }
          out.push({ type: 'tag-span', tag: name, text: text.slice(spanStart, k) });
          i = k;
          continue;
        }
        // Bare `#` not followed by a name char — literal.
      }

      buf += ch;
      i++;
    }

    flush();
    return out;
  }

  const api = { classifyLine, extractTags, parseLine };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Parser = api;
  }
})(typeof self !== 'undefined' ? self : this);

// Phase 2 renderer. Pure DOM construction — no parsing here, no event
// handling. Input is a parsed line from parser.js plus a theme + editing flag.
//
// renderLine returns a single block element (a <div data-line-id> when an id
// is supplied, otherwise a plain <div>). Item 1 covers the skeleton + plain
// text segments. Subsequent Phase 2 items extend it: arrows, brackets, tags,
// gloss line, bold/italic, section-header convention.

(function (root) {
  'use strict';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderSegments(segments) {
    const frag = document.createDocumentFragment();
    for (const seg of segments) {
      frag.appendChild(renderSegment(seg));
    }
    return frag;
  }

  const ARROW_GLYPH = { right: '→', left: '←', both: '↔' };
  const ARROW_SOURCE = { right: '->', left: '<-', both: '<->' };

  function renderSegment(seg) {
    switch (seg.type) {
      case 'text':
        return document.createTextNode(seg.text);
      case 'arrow': {
        const span = el('span', 'arrow', ARROW_GLYPH[seg.dir] || '→');
        span.setAttribute('data-arrow', ARROW_SOURCE[seg.dir] || '->');
        // Atomic delete is a Phase 3 concern; mark the node as a unit now so
        // selection-aware code can treat it as one when we get there.
        span.contentEditable = 'false';
        return span;
      }
      case 'bracket': {
        // Bracket span: muted "gloss" wrapper with literal [ and ]
        // delimiters de-emphasized. Children render with the bracket as
        // their outer context.
        const wrap = el('span', 'bracket');
        wrap.appendChild(el('span', 'bracket-delim', '['));
        wrap.appendChild(renderSegments(seg.children));
        wrap.appendChild(el('span', 'bracket-delim', ']'));
        return wrap;
      }
      case 'tag-span':
        return el('span', 'seg-' + seg.type, segmentToFallbackText(seg));
      default:
        return document.createTextNode('');
    }
  }

  function segmentToFallbackText(seg) {
    if (seg.type === 'text') return seg.text;
    if (seg.type === 'arrow') {
      return seg.dir === 'right' ? '->' : seg.dir === 'left' ? '<-' : '<->';
    }
    if (seg.type === 'bracket') {
      let inner = '';
      for (const c of seg.children) inner += segmentToFallbackText(c);
      return '[' + inner + ']';
    }
    if (seg.type === 'tag-span') return '#' + seg.tag + (seg.text || '');
    return '';
  }

  // theme is reserved for later items; isEditing toggles raw-vs-rendered
  // display per the hybrid-editing UX (active line shows raw syntax).
  function renderLine(parsedLine, theme, isEditing) {
    const line = el('div', 'line line-' + parsedLine.lineType);
    if (isEditing) line.classList.add('editing');

    if (isEditing) {
      // In editing mode the line just shows its raw text — re-render on blur.
      line.textContent = parsedLine.raw != null ? parsedLine.raw : '';
      return line;
    }

    if (parsedLine.lineType === 'empty') {
      // Preserve vertical whitespace.
      line.innerHTML = '&nbsp;';
      return line;
    }

    // Section-header convention is wired up in a later Phase 2 item; for now
    // render the tag names as plain text chips placeholder.
    if (parsedLine.lineType === 'section-header') {
      for (const t of parsedLine.tags) {
        line.appendChild(el('span', 'seg-tag-span', '#' + t.name));
      }
      return line;
    }

    line.appendChild(renderSegments(parsedLine.segments));
    return line;
  }

  const api = { renderLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Renderer = api;
})(typeof self !== 'undefined' ? self : this);

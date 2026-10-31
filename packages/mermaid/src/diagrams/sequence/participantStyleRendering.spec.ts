/**
 * Rendering of the participant styling syntax (`classDef`, `class`, `style` and `:::`): a styled
 * participant's classes become CSS classes on its shapes and its `classDef`/inline styles apply to
 * them, on the top and bottom boxes alike, for boxes and for stick figures. An inline `style` wins
 * over a class, and a diagram that uses none of it draws exactly as it did before.
 */
import { select } from 'd3';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import defaultConfig from '../../defaultConfig.js';
import mermaid from '../../mermaid.js';
import themes from '../../themes/index.js';
// @ts-ignore: JISON doesn't support types
import parser from './parser/sequenceDiagram.jison';
import { SequenceDB } from './sequenceDb.js';
import svgDraw from './svgDraw.js';

const originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 60, height: 65 }) as DOMRect,
  });
  Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
    configurable: true,
    value: () => 50,
  });
});

afterAll(() => {
  if (originalGetBBox) {
    Object.defineProperty(SVGElement.prototype, 'getBBox', originalGetBBox);
  } else {
    Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
  }
  Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength');
});

const confFor = (theme = 'default') => ({
  ...defaultConfig.sequence,
  look: 'classic',
  theme,
  themeVariables: themes[theme as keyof typeof themes].getThemeVariables(),
  sequence: defaultConfig.sequence,
});

/** Parses `text` and draws its first participant, top box then bottom box, into a fresh svg. */
const draw = async (text: string, theme = 'default') => {
  document.body.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const db = new SequenceDB();
  parser.yy = db;
  parser.parse(text);
  const [actor] = [...db.getActors().values()];
  Object.assign(actor, { x: 0, y: 0, starty: 100, stopy: 400, width: 150, height: 65 });
  const svg = select(document.querySelector<SVGSVGElement>('svg')!);
  const diagObj = { db };
  const conf = confFor(theme);
  await svgDraw.drawActor(svg, actor, conf, false, 'id', diagObj, new Map([[actor.name, 0]]));
  await svgDraw.drawActor(svg, actor, conf, true, 'id', diagObj, new Map([[actor.name, 0]]));
  return document.querySelector('svg')!.innerHTML;
};

const styleOf = (element: Element, property: string) =>
  (element as SVGElement).style.getPropertyValue(property);

const priorityOf = (element: Element, property: string) =>
  (element as SVGElement).style.getPropertyPriority(property);

beforeEach(() => {
  document.body.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
});

describe('participant styling when rendering', () => {
  describe('participant boxes', () => {
    it('gives the top and bottom box the class and the classDef fill and stroke', async () => {
      await draw(`sequenceDiagram
      classDef warning fill:#f96,stroke:#333
      participant A:::warning`);

      const rects = [...document.querySelectorAll('rect.actor')];
      expect(rects).toHaveLength(2);
      expect(rects.filter((r) => r.classList.contains('actor-top'))).toHaveLength(1);
      expect(rects.filter((r) => r.classList.contains('actor-bottom'))).toHaveLength(1);
      for (const rect of rects) {
        expect(rect.classList.contains('warning')).toBe(true);
        expect(rect.classList.contains('actor')).toBe(true);
        expect(styleOf(rect, 'fill')).toBe('#f96');
        expect(styleOf(rect, 'stroke')).toBe('#333');
        expect(priorityOf(rect, 'fill')).toBe('important');
      }
    });

    it('applies every class given with multiple classes, later classes winning', async () => {
      await draw(`sequenceDiagram
      classDef a fill:#111,stroke:#222
      classDef b fill:#333
      participant A
      class A a
      class A b`);

      for (const rect of document.querySelectorAll('rect.actor')) {
        expect(rect.classList.contains('a')).toBe(true);
        expect(rect.classList.contains('b')).toBe(true);
        expect(styleOf(rect, 'fill')).toBe('#333');
        expect(styleOf(rect, 'stroke')).toBe('#222');
      }
    });

    it('lets an inline style override the class, whatever order they were written in', async () => {
      await draw(`sequenceDiagram
      participant A
      style A fill:#00f,stroke-width:4px
      classDef warning fill:#f96,stroke:#333
      class A warning`);

      for (const rect of document.querySelectorAll('rect.actor')) {
        expect(styleOf(rect, 'fill')).toBe('#00f');
        expect(styleOf(rect, 'stroke')).toBe('#333');
        expect(styleOf(rect, 'stroke-width')).toBe('4px');
      }
    });

    it('applies an inline style to a participant with no class', async () => {
      await draw(`sequenceDiagram
      participant A
      style A fill:#0f0,stroke:#f00`);

      for (const rect of document.querySelectorAll('rect.actor')) {
        expect(styleOf(rect, 'fill')).toBe('#0f0');
        expect(styleOf(rect, 'stroke')).toBe('#f00');
        expect(rect.getAttribute('class')).toBe(
          rect.classList.contains('actor-top') ? 'actor actor-top' : 'actor actor-bottom'
        );
      }
    });

    it('wins over the colours of a colour theme', async () => {
      await draw(
        `sequenceDiagram
      classDef warning fill:#f96,stroke:#333
      participant A:::warning`,
        'redux-color'
      );

      for (const rect of document.querySelectorAll('rect.actor')) {
        expect(styleOf(rect, 'fill')).toBe('#f96');
        expect(styleOf(rect, 'stroke')).toBe('#333');
      }
    });

    it('colours the label with a classDef color', async () => {
      await draw(`sequenceDiagram
      classDef dark fill:#000,color:#fff
      participant A:::dark`);

      const texts = [...document.querySelectorAll('text.actor')];
      expect(texts).toHaveLength(2);
      for (const text of texts) {
        expect(styleOf(text, 'fill')).toBe('#fff');
        expect(styleOf(text.querySelector('tspan')!, 'fill')).toBe('#fff');
      }
    });

    it('ignores a class that has no classDef', async () => {
      await draw(`sequenceDiagram
      participant A:::undefinedClass`);

      for (const rect of document.querySelectorAll('rect.actor')) {
        expect(rect.classList.contains('undefinedClass')).toBe(true);
        expect(styleOf(rect, 'fill')).toBe('');
      }
    });
  });

  describe('actor figures', () => {
    it('styles the top and bottom figure and gives them the class', async () => {
      await draw(`sequenceDiagram
      classDef warning fill:#f96,stroke:#333
      actor A:::warning`);

      const figures = [...document.querySelectorAll('g.actor-man')];
      expect(figures).toHaveLength(2);
      for (const figure of figures) {
        expect(figure.classList.contains('warning')).toBe(true);
        expect(styleOf(figure, 'fill')).toBe('#f96');
        expect(styleOf(figure, 'stroke')).toBe('#333');
        const head = figure.querySelector('circle')!;
        expect(styleOf(head, 'fill')).toBe('#f96');
        expect(styleOf(head, 'stroke')).toBe('#333');
      }
    });

    it('lets an inline style override the class', async () => {
      await draw(`sequenceDiagram
      classDef warning fill:#f96,stroke:#333
      actor A:::warning
      style A stroke:#00f`);

      for (const figure of document.querySelectorAll('g.actor-man')) {
        const head = figure.querySelector('circle')!;
        expect(styleOf(head, 'fill')).toBe('#f96');
        expect(styleOf(head, 'stroke')).toBe('#00f');
      }
    });
  });

  describe.each(['boundary', 'control', 'entity', 'database', 'collections', 'queue'])(
    '%s participants',
    (type) => {
      it('carry the class and the classDef styles on top and bottom', async () => {
        await draw(`sequenceDiagram
        classDef warning fill:#f96,stroke:#333
        participant A@{ "type": "${type}" }:::warning`);

        const styled = [...document.querySelectorAll('.warning')];
        expect(styled.length).toBeGreaterThanOrEqual(2);
        expect(styled.some((el) => el.classList.contains('actor-top'))).toBe(true);
        expect(styled.some((el) => el.classList.contains('actor-bottom'))).toBe(true);
        expect(
          [...document.querySelectorAll('[style]')].filter(
            (el) => styleOf(el, 'fill') === '#f96' && styleOf(el, 'stroke') === '#333'
          ).length
        ).toBeGreaterThanOrEqual(2);
      });
    }
  );

  describe('unstyled diagrams', () => {
    /** The lifeline counter is module-wide, so ids differ between draws of the same diagram. */
    const withoutCounters = (svg: string) =>
      svg.replace(/(actor-man-torso|actor-man-arms|actor|root-)\d+/g, '$1#');

    const declaration = (type: string) =>
      type === 'participant' || type === 'actor'
        ? `${type} A`
        : `participant A@{ "type": "${type}" }`;

    it.each([
      'participant',
      'actor',
      'boundary',
      'control',
      'entity',
      'database',
      'collections',
      'queue',
    ])('render a %s the same when a classDef is defined but never assigned', async (type) => {
      const plain = await draw(`sequenceDiagram
        ${declaration(type)}`);
      const withUnusedClass = await draw(`sequenceDiagram
        classDef warning fill:#f96,stroke:#333
        ${declaration(type)}`);

      expect(withoutCounters(withUnusedClass)).toBe(withoutCounters(plain));
      expect(plain).not.toContain('important');
      expect(plain).not.toContain('#f96');
    });

    it('adds no classes or inline styles to a plain participant', async () => {
      await draw(`sequenceDiagram
      participant A`);

      const top = document.querySelector('rect.actor-top')!;
      expect(top.getAttribute('class')).toBe('actor actor-top');
      expect(top.getAttribute('style')).toBeNull();
    });
  });

  describe('a whole diagram', () => {
    it('renders styled participants and actors through the full renderer', async () => {
      const { svg } = await mermaid.render(
        'styled-sequence',
        `sequenceDiagram
        classDef warning fill:#f96,stroke:#333
        participant A:::warning
        actor B:::warning
        participant C
        style C fill:#0f0
        A->>B: hello
        B->>C: hi`
      );
      const container = document.createElement('div');
      container.innerHTML = svg;

      const boxes = (name: string) =>
        [...container.querySelectorAll('rect.actor')].filter(
          (r) => r.getAttribute('name') === name
        );
      expect(boxes('A')).toHaveLength(2);
      for (const rect of boxes('A')) {
        expect(rect.classList.contains('warning')).toBe(true);
        expect(styleOf(rect, 'fill')).toBe('#f96');
        expect(styleOf(rect, 'stroke')).toBe('#333');
      }

      const figures = [...container.querySelectorAll('g.actor-man')].filter(
        (g) => g.getAttribute('name') === 'B'
      );
      expect(figures).toHaveLength(2);
      for (const figure of figures) {
        expect(figure.classList.contains('warning')).toBe(true);
        expect(styleOf(figure.querySelector('circle')!, 'fill')).toBe('#f96');
      }

      expect(boxes('C')).toHaveLength(2);
      for (const rect of boxes('C')) {
        expect(styleOf(rect, 'fill')).toBe('#0f0');
        expect(rect.classList.contains('warning')).toBe(false);
      }
    });
  });
});

/**
 * Tests for the flowchart-style participant styling syntax in sequence diagrams:
 * `classDef`, `class`, `style` and the `:::` shorthand on participant and actor declarations.
 */
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore: JISON doesn't support types
import parser from './parser/sequenceDiagram.jison';
import { SequenceDB } from './sequenceDb.js';

const parse = (text: string): SequenceDB => {
  const db = new SequenceDB();
  parser.yy = db;
  parser.parse(text);
  return db;
};

describe('sequence diagram participant styling', () => {
  beforeEach(() => {
    parser.yy = new SequenceDB();
  });

  describe('classDef', () => {
    it('stores a class definition', () => {
      const db = parse(`sequenceDiagram
      classDef warning fill:#f96,stroke:#333,stroke-width:4px
      participant A`);

      expect(db.getClasses().get('warning')).toEqual({
        id: 'warning',
        styles: ['fill:#f96', 'stroke:#333', 'stroke-width:4px'],
        textStyles: [],
      });
    });

    it('defines several classes at once with comma-separated names', () => {
      const db = parse(`sequenceDiagram
      classDef a,b fill:#f96
      participant A`);

      expect(db.getClasses().get('a')?.styles).toEqual(['fill:#f96']);
      expect(db.getClasses().get('b')?.styles).toEqual(['fill:#f96']);
    });

    it('keeps text colour declarations as text styles, like flowcharts', () => {
      const db = parse(`sequenceDiagram
      classDef dark fill:#000,color:#fff
      participant A`);

      expect(db.getClasses().get('dark')).toEqual({
        id: 'dark',
        styles: ['fill:#000', 'color:#fff'],
        textStyles: ['color:#fff'],
      });
    });

    it('accumulates declarations when a class is defined twice', () => {
      const db = parse(`sequenceDiagram
      classDef a fill:#f96
      classDef a stroke:#333
      participant A`);

      expect(db.getClasses().get('a')?.styles).toEqual(['fill:#f96', 'stroke:#333']);
    });

    it('keeps commas inside parentheses and honours escaped commas', () => {
      const db = parse(`sequenceDiagram
      classDef a fill:rgb(255,0,0),stroke:#333
      classDef b stroke-dasharray:1\\,2
      participant A`);

      expect(db.getClasses().get('a')?.styles).toEqual(['fill:rgb(255,0,0)', 'stroke:#333']);
      expect(db.getClasses().get('b')?.styles).toEqual(['stroke-dasharray:1,2']);
    });

    it('allows several statements separated by semicolons', () => {
      const db = parse(`sequenceDiagram
      classDef a fill:#f96; classDef b fill:#9f6; participant A`);

      expect(db.getClasses().get('a')?.styles).toEqual(['fill:#f96']);
      expect(db.getClasses().get('b')?.styles).toEqual(['fill:#9f6']);
      expect(db.getActor('A')).toBeDefined();
    });

    it('works inside a loop block', () => {
      const db = parse(`sequenceDiagram
      participant A
      loop every day
        classDef a fill:#f96
        A->>A: ping
      end`);

      expect(db.getClasses().get('a')?.styles).toEqual(['fill:#f96']);
      expect(db.getMessages().length).toBeGreaterThan(0);
    });
  });

  describe('class', () => {
    it('assigns a class to a participant', () => {
      const db = parse(`sequenceDiagram
      participant A
      class A warning`);

      expect(db.getActor('A').classes).toEqual(['warning']);
    });

    it('assigns a class to several comma-separated participants', () => {
      const db = parse(`sequenceDiagram
      participant A
      actor B
      participant C
      class A,B warning`);

      expect(db.getActor('A').classes).toEqual(['warning']);
      expect(db.getActor('B').classes).toEqual(['warning']);
      expect(db.getActor('C').classes).toEqual([]);
    });

    it('supports assigning several classes to one participant', () => {
      const db = parse(`sequenceDiagram
      participant A
      class A one
      class A two
      class A one`);

      expect(db.getActor('A').classes).toEqual(['one', 'two']);
    });

    it('applies to participants that are declared later', () => {
      const db = parse(`sequenceDiagram
      class A warning
      participant A as Alice`);

      expect(db.getActor('A').classes).toEqual(['warning']);
      expect(db.getActor('A').description).toBe('Alice');
    });

    it('does not create participants that are never declared', () => {
      const db = parse(`sequenceDiagram
      participant A
      class Missing warning`);

      expect(db.getActorKeys()).toEqual(['A']);
    });

    it('works for participants created from messages', () => {
      const db = parse(`sequenceDiagram
      A->>B: hi
      class A,B warning`);

      expect(db.getActor('A').classes).toEqual(['warning']);
      expect(db.getActor('B').classes).toEqual(['warning']);
    });
  });

  describe('style', () => {
    it('stores inline styles on the participant', () => {
      const db = parse(`sequenceDiagram
      participant A
      style A fill:#f9f,stroke:#333,stroke-width:4px`);

      expect(db.getActor('A').styles).toEqual(['fill:#f9f', 'stroke:#333', 'stroke-width:4px']);
    });

    it('accumulates styles from several statements', () => {
      const db = parse(`sequenceDiagram
      actor A
      style A fill:#f9f
      style A stroke:#333`);

      expect(db.getActor('A').styles).toEqual(['fill:#f9f', 'stroke:#333']);
    });

    it('accepts comma-separated participant ids', () => {
      const db = parse(`sequenceDiagram
      participant A
      participant B
      style A,B fill:#f9f`);

      expect(db.getActor('A').styles).toEqual(['fill:#f9f']);
      expect(db.getActor('B').styles).toEqual(['fill:#f9f']);
    });

    it('applies to participants that are declared later', () => {
      const db = parse(`sequenceDiagram
      style A fill:#f9f
      participant A`);

      expect(db.getActor('A').styles).toEqual(['fill:#f9f']);
    });
  });

  describe('::: shorthand', () => {
    it('assigns a class on a participant declaration', () => {
      const db = parse(`sequenceDiagram
      participant A:::warning`);

      expect(db.getActor('A')).toMatchObject({ classes: ['warning'], type: 'participant' });
    });

    it('assigns a class on an actor declaration', () => {
      const db = parse(`sequenceDiagram
      actor A:::warning`);

      expect(db.getActor('A')).toMatchObject({ classes: ['warning'], type: 'actor' });
    });

    it('works together with an alias', () => {
      const db = parse(`sequenceDiagram
      participant A:::warning as Alice
      actor B:::danger as Bob`);

      expect(db.getActor('A')).toMatchObject({ classes: ['warning'], description: 'Alice' });
      expect(db.getActor('B')).toMatchObject({
        classes: ['danger'],
        description: 'Bob',
        type: 'actor',
      });
    });

    it('works together with a type configuration', () => {
      const db = parse(`sequenceDiagram
      participant A@{ "type": "database" }:::warning
      participant B@{ "type": "queue" }:::warning as Jobs`);

      expect(db.getActor('A')).toMatchObject({ classes: ['warning'], type: 'database' });
      expect(db.getActor('B')).toMatchObject({
        classes: ['warning'],
        type: 'queue',
        description: 'Jobs',
      });
    });

    it('combines with class statements to give several classes', () => {
      const db = parse(`sequenceDiagram
      participant A:::one
      class A two`);

      expect(db.getActor('A').classes).toEqual(['one', 'two']);
    });

    it('works with create and with trailing comments or spaces', () => {
      const db = parse(`sequenceDiagram
      participant A
      create participant B:::warning # a comment
      A->>B: hello
      create actor C:::danger
      A->>C: hello`);

      expect(db.getActor('B').classes).toEqual(['warning']);
      expect(db.getActor('C').classes).toEqual(['danger']);
    });

    it('supports participant ids with spaces', () => {
      const db = parse(`sequenceDiagram
      participant Alice Smith:::warning`);

      expect(db.getActor('Alice Smith').classes).toEqual(['warning']);
    });

    it('keeps the classes when a participant is declared again with an alias', () => {
      const db = parse(`sequenceDiagram
      participant A:::warning
      participant A as Alice`);

      expect(db.getActor('A')).toMatchObject({ classes: ['warning'], description: 'Alice' });
    });
  });

  describe('combined styling', () => {
    it('supports the flowchart definition of a class used by several participants', () => {
      const db = parse(`sequenceDiagram
      classDef warning fill:#f96,stroke:#333
      participant A:::warning
      actor B
      class B warning
      style B stroke:#f00
      A->>B: hi`);

      expect(db.getClasses().get('warning')?.styles).toEqual(['fill:#f96', 'stroke:#333']);
      expect(db.getActor('A').classes).toEqual(['warning']);
      expect(db.getActor('B').classes).toEqual(['warning']);
      expect(db.getActor('B').styles).toEqual(['stroke:#f00']);
      expect(db.getMessages()).toHaveLength(1);
    });

    it('resets the styling when the database is cleared', () => {
      const db = parse(`sequenceDiagram
      classDef warning fill:#f96
      class A warning
      style A fill:#f9f
      participant B`);
      db.clear();

      expect(db.getClasses().size).toBe(0);
      parser.parse(`sequenceDiagram
      participant A`);
      expect(db.getActor('A')).toMatchObject({ classes: [], styles: [] });
    });

    it('gives unstyled participants empty class and style lists', () => {
      const db = parse(`sequenceDiagram
      participant A
      actor B
      A->>B: hi`);

      expect(db.getActor('A')).toMatchObject({ classes: [], styles: [] });
      expect(db.getActor('B')).toMatchObject({ classes: [], styles: [] });
      expect(db.getClasses().size).toBe(0);
    });
  });

  describe('participants named like the keywords', () => {
    it.each([
      'class->>style: hi',
      'class A->>style B: hi',
      'style A->>classDef B: hi',
      'classDef->>class: hi',
      'class A ->> B: fill:red',
      'Class->>Style: hi',
      'classifier->>styles: hi',
    ])('still lexes %s as a message', (line) => {
      const db = parse(`sequenceDiagram
      ${line}`);

      expect(db.getMessages()).toHaveLength(1);
      expect(db.getClasses().size).toBe(0);
      for (const key of db.getActorKeys()) {
        expect(db.getActor(key)).toMatchObject({ classes: [], styles: [] });
      }
    });

    it('still parses participants whose names start with the keywords', () => {
      const db = parse(`sequenceDiagram
      participant class
      participant style
      participant classDef
      actor Styles as The styles
      class->>style: hi`);

      expect(db.getActorKeys()).toEqual(['class', 'style', 'classDef', 'Styles']);
      expect(db.getMessages()).toHaveLength(1);
    });
  });
});

// @flow
import {
  isEqual,
  getCorners,
  expandByPosition,
  offsetByPosition,
  expandBySpacing,
} from '../../../src/state/spacing';
import type { Position, Spacing } from '../../../src/types';

const spacing1: Spacing = {
  top: 8,
  right: 16,
  bottom: 23,
  left: 5,
};

const spacing2: Spacing = {
  top: 3,
  right: 10,
  bottom: 14,
  left: 9,
};

describe('spacing', () => {
  describe('expandByPosition', () => {
    it('should increase the size of the spacing', () => {
      const spacing: Spacing = {
        top: 0,
        right: 10,
        bottom: 10,
        left: 0,
      };
      const position = {
        x: 5,
        y: 5,
      };
      const expected = {
        top: -5,
        right: 15,
        bottom: 15,
        left: -5,
      };

      expect(expandByPosition(spacing, position)).toEqual(expected);
    });
  });

  describe('expandBySpacing', () => {
    it('should increase the size of a spacing by the size of another', () => {
      const spacing: Spacing = {
        top: 10,
        right: 20,
        bottom: 20,
        left: 10,
      };
      const expected: Spacing = {
        top: 0,
        right: 40,
        bottom: 40,
        left: 0,
      };

      expect(expandBySpacing(spacing, spacing)).toEqual(expected);
    });
  });

  describe('isEqual', () => {
    it('should return true when two spacings are the same', () => {
      expect(isEqual(spacing1, spacing1)).toBe(true);
    });

    it('should return true when two spacings share the same values', () => {
      const copy = { ...spacing1 };
      expect(isEqual(spacing1, copy)).toBe(true);
    });

    it('should return value when two spacings have different values', () => {
      expect(isEqual(spacing1, spacing2)).toBe(false);
    });
  });

  describe('offsetByPosition', () => {
    it('should add x/y values to top/right/bottom/left dimensions', () => {
      const offsetPosition: Position = {
        x: 10,
        y: 5,
      };
      const expected: Spacing = {
        top: 13,
        right: 26,
        bottom: 28,
        left: 15,
      };
      expect(offsetByPosition(spacing1, offsetPosition)).toEqual(expected);
    });
  });

  describe('getCorners', () => {
    it('should return the corners of a spacing box in the order TL, TR, BL, BR', () => {
      const spacing: Spacing = {
        top: 1,
        right: 2,
        bottom: 3,
        left: 4,
      };
      const expected = [
        { x: 4, y: 1 },
        { x: 2, y: 1 },
        { x: 4, y: 3 },
        { x: 2, y: 3 },
      ];
      expect(getCorners(spacing)).toEqual(expected);
    });
  });
});

// @flow
import getBestCrossAxisDroppable from '../../../../src/state/move-cross-axis/get-best-cross-axis-droppable';
import { getDroppableDimension } from '../../../../src/state/dimension';
import getClientRect from '../../../../src/state/get-client-rect';
import { add } from '../../../../src/state/position';
import { horizontal, vertical } from '../../../../src/state/axis';
import type {
  Axis,
  Position,
  DroppableDimension,
  DroppableDimensionMap,
} from '../../../../src/types';

describe('get best cross axis droppable', () => {
  describe('on the vertical axis', () => {
    const axis: Axis = vertical;

    it('should return the first droppable on the cross axis when moving forward', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const forward = getDroppableDimension({
        id: 'forward',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 30,
          right: 40,
          bottom: 10,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [forward.id]: forward,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(forward);
    });

    it('should return the first droppable on the cross axis when moving backward', () => {
      const behind = getDroppableDimension({
        id: 'behind',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 30,
          right: 40,
          bottom: 10,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [behind.id]: behind,
        [source.id]: source,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        // moving backwards
        isMovingForward: false,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(behind);
    });

    it('should exclude options that are not in the desired direction', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const behind = getDroppableDimension({
        id: 'behind',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 10,
          bottom: 10,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [behind.id]: behind,
        [source.id]: source,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });
      expect(result).toBe(null);

      // checking that it would have been returned if was moving in the other direction
      const result2: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: false,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });
      expect(result2).toBe(behind);
    });

    it('should exclude options that are not enabled', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const disabled = getDroppableDimension({
        id: 'disabled',
        isEnabled: false,
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 30,
          right: 40,
          bottom: 10,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [disabled.id]: disabled,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(null);
    });

    it('should exclude options that do not overlap on the main axis', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const noOverlap = getDroppableDimension({
        id: 'noOverlap',
        direction: axis.direction,
        clientRect: getClientRect({
          // top is below where the source ended
          top: 11,
          left: 30,
          right: 40,
          bottom: 20,
        }),
      });

      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [noOverlap.id]: noOverlap,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(null);
    });

    describe('more than one option share the same crossAxisStart value', () => {
      // this happens when two lists sit on top of one another
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 20,
          bottom: 100,
        }),
      });
      const sibling1 = getDroppableDimension({
        id: 'sibling1',
        direction: axis.direction,
        clientRect: getClientRect({
          // not the same top value as source
          top: 20,
          // shares the left edge with the source
          left: 20,
          right: 40,
          bottom: 40,
        }),
      });
      const sibling2 = getDroppableDimension({
        id: 'sibling2',
        direction: axis.direction,
        clientRect: getClientRect({
          // shares the bottom edge with sibling1
          top: 40,
          // shares the left edge with the source
          left: 20,
          right: 40,
          bottom: 60,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [sibling1.id]: sibling1,
        [sibling2.id]: sibling2,
      };

      it('should return a droppable where the center position (axis.line) of the draggable draggable sits within the size of a droppable', () => {
        // sitting inside source - but within the size of sibling2 on the main axis
        const center: Position = {
          y: 50,
          x: 10,
        };

        const result: ?DroppableDimension = getBestCrossAxisDroppable({
          isMovingForward: true,
          pageCenter: center,
          source,
          droppables,
        });

        expect(result).toBe(sibling2);
      });

      describe('center point is not contained within a droppable', () => {
        it('should return the droppable that has the closest corner', () => {
          // Choosing a point that is above the first sibling
          const center: Position = {
            // above sibling 1
            y: 10,
            x: 10,
          };

          const result: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center,
            source,
            droppables,
          });

          expect(result).toBe(sibling1);
        });

        it('should choose the droppable that is furthest back (closest to {x: 0, y: 0} on the screen) in the event of a tie', () => {
          // Choosing a point that is above the first sibling
          const center: Position = {
            // this line is shared between sibling1 and sibling2
            y: 40,
            x: 10,
          };

          const result: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center,
            source,
            droppables,
          });

          expect(result).toBe(sibling1);

          // checking that center position was selected correctly
          const center2: Position = add(center, { x: 0, y: 1 });
          const result2: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center2,
            source,
            droppables,
          });
          expect(result2).toBe(sibling2);
        });
      });
    });
  });

  describe('on the horizontal axis', () => {
    const axis: Axis = horizontal;

    it('should return the first droppable on the cross axis when moving forward', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 20,
          bottom: 20,
        }),
      });
      const forward = getDroppableDimension({
        id: 'forward',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 20,
          left: 0,
          right: 20,
          bottom: 30,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [forward.id]: forward,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(forward);
    });

    it('should return the first droppable on the cross axis when moving backward', () => {
      const behind = getDroppableDimension({
        id: 'behind',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 20,
          bottom: 10,
        }),
      });
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 10,
          left: 0,
          right: 20,
          bottom: 20,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [behind.id]: behind,
        [source.id]: source,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        // moving backwards
        isMovingForward: false,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(behind);
    });

    it('should exclude options that are not in the desired direction', () => {
      const behind = getDroppableDimension({
        id: 'behind',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 20,
          bottom: 10,
        }),
      });
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 10,
          left: 0,
          right: 20,
          bottom: 20,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [behind.id]: behind,
        [source.id]: source,
      };

      // now moving in the other direction
      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });
      expect(result).toBe(null);

      // Ensuring that normally it would be returned if moving in the right direction
      const result2: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: false,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });
      expect(result2).toBe(behind);
    });

    it('should exclude options that are not enabled', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 20,
          right: 30,
          bottom: 10,
        }),
      });
      const disabled = getDroppableDimension({
        id: 'disabled',
        isEnabled: false,
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 30,
          right: 40,
          bottom: 10,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [disabled.id]: disabled,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(null);
    });

    it('should exclude options that do not overlap on the main axis', () => {
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 20,
          bottom: 10,
        }),
      });
      const noOverlap = getDroppableDimension({
        id: 'noOverlap',
        direction: axis.direction,
        clientRect: getClientRect({
          // comes after the source
          top: 10,
          // but its left value is > the rigt of the source
          left: 30,
          right: 40,
          bottom: 20,
        }),
      });

      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [noOverlap.id]: noOverlap,
      };

      const result: ?DroppableDimension = getBestCrossAxisDroppable({
        isMovingForward: true,
        pageCenter: source.page.withMargin.center,
        source,
        droppables,
      });

      expect(result).toBe(null);
    });

    describe('more than one option share the same crossAxisStart value', () => {
      // this happens when two lists sit side by side
      const source = getDroppableDimension({
        id: 'source',
        direction: axis.direction,
        clientRect: getClientRect({
          top: 0,
          left: 0,
          right: 100,
          bottom: 10,
        }),
      });
      const sibling1 = getDroppableDimension({
        id: 'sibling1',
        direction: axis.direction,
        clientRect: getClientRect({
          // shares an edge with the source
          top: 10,
          // shares the left edge with the source
          left: 20,
          right: 40,
          bottom: 20,
        }),
      });
      const sibling2 = getDroppableDimension({
        id: 'sibling2',
        direction: axis.direction,
        clientRect: getClientRect({
          // shares an edge with the source
          top: 10,
          // shares the left edge with the source
          left: 40,
          right: 60,
          bottom: 20,
        }),
      });
      const droppables: DroppableDimensionMap = {
        [source.id]: source,
        [sibling1.id]: sibling1,
        [sibling2.id]: sibling2,
      };

      it('should return a droppable where the center position (axis.line) of the draggable draggable sits within the size of a droppable', () => {
        // sitting inside source - but within the size of sibling2 on the main axis
        const center: Position = {
          y: 5,
          x: 50,
        };

        const result: ?DroppableDimension = getBestCrossAxisDroppable({
          isMovingForward: true,
          pageCenter: center,
          source,
          droppables,
        });

        expect(result).toBe(sibling2);
      });

      describe('center point is not contained within a droppable', () => {
        it('should return the droppable that has the closest corner', () => {
          // Choosing a point that is before the first sibling
          const center: Position = {
            // above sibling 1
            y: 5,
            // before the left value of sibling 1
            x: 10,
          };

          const result: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center,
            source,
            droppables,
          });

          expect(result).toBe(sibling1);
        });

        it('should choose the droppable that is furthest back (closest to {x: 0, y: 0} on the screen) in the event of a tie', () => {
          // Choosing a point that is above the first sibling
          const center: Position = {
            y: 5,
            // this line is shared between sibling1 and sibling2
            x: 40,
          };

          const result: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center,
            source,
            droppables,
          });

          expect(result).toBe(sibling1);

          // checking that center point is correct

          const center2: Position = add(center, { y: 0, x: 1 });
          const result2: ?DroppableDimension = getBestCrossAxisDroppable({
            isMovingForward: true,
            pageCenter: center2,
            source,
            droppables,
          });

          expect(result2).toBe(sibling2);
        });
      });
    });
  });
});

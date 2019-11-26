// @flow
import type { Position } from 'css-box-model';
import type {
  Axis,
  DragImpact,
  DisplacedBy,
  DroppableDimensionMap,
} from '../../../../../src/types';
import { vertical, horizontal } from '../../../../../src/state/axis';
import { getPreset, enableCombining } from '../../../../util/dimension';
import getDragImpact from '../../../../../src/state/get-drag-impact';
import getDisplacedBy from '../../../../../src/state/get-displaced-by';
import { patch, subtract, add } from '../../../../../src/state/position';
import getLiftEffect from '../../../../../src/state/get-lift-effect';
import afterPoint from '../../../../util/after-point';
import beforePoint from '../../../../util/before-point';
import { getForcedDisplacement } from '../../../../util/impact';
import { getThreshold } from './util';
import { getCenterForEndEdge } from '../util/get-edge-from-center';

[vertical /* , horizontal */].forEach((axis: Axis) => {
  describe(`on ${axis.direction} axis`, () => {
    const preset = getPreset(axis);
    const { afterCritical } = getLiftEffect({
      draggable: preset.inHome1,
      home: preset.home,
      draggables: preset.draggables,
      viewport: preset.viewport,
    });
    const withCombineEnabled: DroppableDimensionMap = enableCombining(
      preset.droppables,
    );
    // will be over a foreign list for these tests
    const crossAxisCenter: number =
      preset.foreign.page.borderBox.center[axis.crossAxisLine];

    const displacedBy: DisplacedBy = getDisplacedBy(
      axis,
      preset.inHome1.displaceBy,
    );

    const whenEnteredForeign: DragImpact = {
      displaced: getForcedDisplacement({
        visible: [
          { dimension: preset.inForeign3, shouldAnimate: true },
          { dimension: preset.inForeign4, shouldAnimate: true },
        ],
      }),
      displacedBy,
      at: {
        type: 'REORDER',
        // in position of inForeign3
        destination: {
          index: preset.inForeign3.descriptor.index,
          droppableId: preset.inForeign3.descriptor.droppableId,
        },
      },
    };

    // moving onto a displaced inForeign3
    describe('combining with displaced item', () => {
      const combineWithDisplacedInForeign3: DragImpact = {
        displaced: getForcedDisplacement({
          // inForeign3 is still displaced - we are just merging with it
          visible: [
            { dimension: preset.inForeign3 },
            { dimension: preset.inForeign4 },
          ],
        }),
        displacedBy,
        at: {
          type: 'COMBINE',
          // now merging with inForeign3
          combine: {
            draggableId: preset.inForeign3.descriptor.id,
            droppableId: preset.inForeign3.descriptor.droppableId,
          },
        },
      };

      describe('item is displaced forward', () => {
        const threshold: Position = getThreshold(axis, preset.inHome3);
        const startOfInForeign3: Position = patch(
          axis.line,
          preset.inForeign3.page.borderBox[axis.start],
          crossAxisCenter,
        );
        const endOfInForeign3: Position = patch(
          axis.line,
          preset.inForeign3.page.borderBox[axis.end],
          crossAxisCenter,
        );
        const displacedStartOfInForeign3: Position = add(
          startOfInForeign3,
          displacedBy.point,
        );
        const displacedEndOfInForeign3: Position = add(
          endOfInForeign3,
          displacedBy.point,
        );
        const combineStart: Position = add(
          displacedStartOfInForeign3,
          threshold,
        );
        const combineEnd: Position = subtract(
          displacedEndOfInForeign3,
          threshold,
        );

        const endOnCombineStart: Position = getCenterForEndEdge({
          endEdgeOn: combineStart,
          dragging: preset.inHome1.page.borderBox,
          axis,
        });

        it.only('should combine when moving forward past the displaced start threshold', () => {
          // it should not merge on the threshold
          {
            const impact: DragImpact = getDragImpact({
              pageBorderBoxCenter: endOnCombineStart,
              draggable: preset.inHome1,
              draggables: preset.draggables,
              droppables: withCombineEnabled,
              previousImpact: whenEnteredForeign,
              viewport: preset.viewport,
              afterCritical,
            });
            expect(impact).toEqual(whenEnteredForeign);
          }
          // it should merge with the item when it goes onto the displaced start
          {
            const impact: DragImpact = getDragImpact({
              pageBorderBoxCenter: afterPoint(endOnCombineStart, axis),
              draggable: preset.inHome1,
              draggables: preset.draggables,
              droppables: withCombineEnabled,
              previousImpact: whenEnteredForeign,
              viewport: preset.viewport,
              afterCritical,
            });
            expect(impact).toEqual(combineWithDisplacedInForeign3);
          }
        });

        it('should no longer merge when moving out of the first 2/3 of the target', () => {
          // merge when still in on two thirds
          {
            const impact: DragImpact = getDragImpact({
              pageBorderBoxCenter: onDisplacedTwoThirdsOfInForeign3,
              draggable: preset.inHome1,
              draggables: preset.draggables,
              droppables: withCombineEnabled,
              previousImpact: whenEnteredForeign,
              viewport: preset.viewport,
              afterCritical,
            });
            expect(impact).toEqual(combineWithDisplacedInForeign3);
          }
          {
            const impact: DragImpact = getDragImpact({
              pageBorderBoxCenter: afterPoint(
                onDisplacedTwoThirdsOfInForeign3,
                axis,
              ),
              draggable: preset.inHome1,
              draggables: preset.draggables,
              droppables: withCombineEnabled,
              previousImpact: whenEnteredForeign,
              viewport: preset.viewport,
              afterCritical,
            });

            const expected: DragImpact = {
              displaced: getForcedDisplacement({
                visible: [{ dimension: preset.inForeign4 }],
              }),
              displacedBy,
              at: {
                type: 'REORDER',
                // now in spot of inForeign4
                destination: {
                  index: preset.inForeign4.descriptor.index,
                  droppableId: preset.inForeign4.descriptor.droppableId,
                },
              },
            };
            expect(impact).toEqual(expected);
          }
        });
      });
    });

    // moving onto a non-displaced inForeign2
    describe('combining with non-displaced item', () => {
      const endOfInForeign2: Position = patch(
        axis.line,
        preset.inForeign2.page.borderBox[axis.end],
        crossAxisCenter,
      );
      const onOneThirdOfInForeign2: Position = subtract(
        endOfInForeign2,
        patch(axis.line, preset.inForeign2.page.borderBox[axis.size] * 0.666),
      );
      const combineWithInForeign2: DragImpact = {
        displaced: getForcedDisplacement({
          visible: [
            { dimension: preset.inForeign3 },
            { dimension: preset.inForeign4 },
          ],
        }),
        displacedBy,
        // now merging with inForeign2
        at: {
          type: 'COMBINE',
          combine: {
            draggableId: preset.inForeign2.descriptor.id,
            droppableId: preset.inForeign2.descriptor.droppableId,
          },
        },
      };

      it('should combine with an item when moving backwards onto the end edge', () => {
        // before is not far enough
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: afterPoint(endOfInForeign2, axis),
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: whenEnteredForeign,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(whenEnteredForeign);
        }
        // on edge is enough
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: endOfInForeign2,
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: whenEnteredForeign,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(combineWithInForeign2);
        }
      });

      it('should stop combining when going back 2/3 of the size', () => {
        // on top 1/3 line is good
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: onOneThirdOfInForeign2,
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: whenEnteredForeign,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(combineWithInForeign2);
        }
        // past 1/3 top line is too far
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: beforePoint(onOneThirdOfInForeign2, axis),
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: whenEnteredForeign,
            viewport: preset.viewport,
            afterCritical,
          });

          const expected: DragImpact = {
            displaced: getForcedDisplacement({
              visible: [
                { dimension: preset.inForeign2 },
                { dimension: preset.inForeign3 },
                { dimension: preset.inForeign4 },
              ],
            }),
            displacedBy,
            at: {
              type: 'REORDER',
              destination: {
                index: preset.inForeign2.descriptor.index,
                droppableId: preset.inForeign2.descriptor.droppableId,
              },
            },
          };
          expect(impact).toEqual(expected);
        }
      });

      it('should continue to combine when forward movements are made after entering the bottom 2/3', () => {
        const initial: DragImpact = getDragImpact({
          pageBorderBoxCenter: endOfInForeign2,
          draggable: preset.inHome1,
          draggables: preset.draggables,
          droppables: withCombineEnabled,
          previousImpact: whenEnteredForeign,
          viewport: preset.viewport,
          afterCritical,
        });
        expect(initial).toEqual(combineWithInForeign2);
        // forward movement on bottom edge
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: endOfInForeign2,
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: initial,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(combineWithInForeign2);
        }
        // forward on 1/3 edge
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: onOneThirdOfInForeign2,
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: initial,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(combineWithInForeign2);
        }
        // forward in the grouping range
        {
          const impact: DragImpact = getDragImpact({
            pageBorderBoxCenter: afterPoint(onOneThirdOfInForeign2, axis),
            draggable: preset.inHome1,
            draggables: preset.draggables,
            droppables: withCombineEnabled,
            previousImpact: initial,
            viewport: preset.viewport,
            afterCritical,
          });
          expect(impact).toEqual(combineWithInForeign2);
        }
      });
    });
  });
});

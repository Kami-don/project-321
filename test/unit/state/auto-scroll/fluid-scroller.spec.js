// @flow
import {
  getRect,
  createBox,
  type Spacing,
  type BoxModel,
  type Position,
} from 'css-box-model';
import type {
  Axis,
  DraggableDimension,
  DroppableDimension,
  DragImpact,
  DraggingState,
  Viewport,
} from '../../../../src/types';
import type { PixelThresholds } from '../../../../src/state/auto-scroller/fluid-scroller';
import { add, patch, subtract } from '../../../../src/state/position';
import scrollViewport from '../../../../src/state/scroll-viewport';
import { createViewport } from '../../../utils/viewport';
import noImpact from '../../../../src/state/no-impact';
import { vertical, horizontal } from '../../../../src/state/axis';
import fluidScroller, {
  getPixelThresholds,
  config,
  type FluidScroller,
} from '../../../../src/state/auto-scroller/fluid-scroller';
import getStatePreset from '../../../utils/get-simple-state-preset';
import {
  getDraggableDimension,
  getDroppableDimension,
  getPreset,
  addDraggable,
  addDroppable,
  getFrame,
} from '../../../utils/dimension';
import { expandByPosition } from '../../../../src/state/spacing';
import scrollDroppable from '../../../../src/state/droppable/scroll-droppable';

const origin: Position = { x: 0, y: 0 };

const windowScrollSize = {
  scrollHeight: 2000,
  scrollWidth: 1600,
};
const scrollableViewport: Viewport = createViewport({
  frame: getRect({
    top: 0,
    left: 0,
    right: 800,
    bottom: 1000,
  }),
  scrollHeight: windowScrollSize.scrollHeight,
  scrollWidth: windowScrollSize.scrollWidth,
  scroll: origin,
});

const unscrollableViewport: Viewport = createViewport({
  frame: getRect({
    top: 0,
    left: 0,
    right: 800,
    bottom: 1000,
  }),
  scrollHeight: 1000,
  scrollWidth: 800,
  scroll: origin,
});

describe('fluid auto scrolling', () => {
  let fluidScroll: FluidScroller;
  let mocks;

  beforeEach(() => {
    mocks = {
      scrollWindow: jest.fn(),
      scrollDroppable: jest.fn(),
    };
    fluidScroll = fluidScroller(mocks);
  });

  afterEach(() => {
    requestAnimationFrame.reset();
  });

  [vertical, horizontal].forEach((axis: Axis) => {
    describe(`on the ${axis.direction} axis`, () => {
      const preset = getPreset(axis);
      const state = getStatePreset(axis);
      const scrollableScrollSize = {
        scrollWidth: 800,
        scrollHeight: 800,
      };
      const frameClient: BoxModel = createBox({
        borderBox: {
          top: 0,
          left: 0,
          right: 600,
          bottom: 600,
        },
      });

      const scrollable: DroppableDimension = getDroppableDimension({
        // stealing the home descriptor
        descriptor: preset.home.descriptor,
        direction: axis.direction,
        borderBox: {
          top: 0,
          left: 0,
          // bigger than the frame
          right: scrollableScrollSize.scrollWidth,
          bottom: scrollableScrollSize.scrollHeight,
        },
        closest: {
          borderBox: frameClient.borderBox,
          scrollSize: {
            scrollWidth: scrollableScrollSize.scrollWidth,
            scrollHeight: scrollableScrollSize.scrollHeight,
          },
          scroll: origin,
          shouldClipSubject: true,
        },
      });

      type DragToArgs = {|
        selection: Position,
        viewport: Viewport,
        impact?: DragImpact,
      |};

      const dragTo = ({
        selection,
        viewport,
        // seeding that we are over the home droppable
        impact,
      }: DragToArgs): DraggingState => {
        const base: DraggingState = state.dragging(
          preset.inHome1.descriptor.id,
          selection,
          viewport,
        );

        return {
          ...base,
          impact: impact || base.impact,
        };
      };

      describe('window scrolling', () => {
        const thresholds: PixelThresholds = getPixelThresholds(
          scrollableViewport.frame,
          axis,
        );
        const crossAxisThresholds: PixelThresholds = getPixelThresholds(
          scrollableViewport.frame,
          axis === vertical ? horizontal : vertical,
        );

        describe('moving forward to end of window', () => {
          const onStartBoundary: Position = patch(
            axis.line,
            // to the boundary is not enough to start
            scrollableViewport.frame[axis.size] - thresholds.startFrom,
            scrollableViewport.frame.center[axis.crossAxisLine],
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            scrollableViewport.frame[axis.size] - thresholds.maxSpeedAt,
            scrollableViewport.frame.center[axis.crossAxisLine],
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              dragTo({
                selection: onStartBoundary,
                viewport: scrollableViewport,
              }),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = add(onStartBoundary, patch(axis.line, 1));

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrollableViewport,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalled();
            // moving forwards
            const request: Position = mocks.scrollWindow.mock.calls[0][0];
            expect(request[axis.line]).toBeGreaterThan(0);
          });

          it('should throttle multiple scrolls into a single animation frame', () => {
            const target1: Position = add(onStartBoundary, patch(axis.line, 1));
            const target2: Position = add(onStartBoundary, patch(axis.line, 3));

            fluidScroll(
              dragTo({
                selection: target1,
                viewport: scrollableViewport,
              }),
            );
            fluidScroll(
              dragTo({
                selection: target2,
                viewport: scrollableViewport,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);

            // verification
            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);

            // not testing value called as we are not exposing getRequired scroll
          });

          it('should get faster the closer to the max speed point', () => {
            const target1: Position = add(onStartBoundary, patch(axis.line, 1));
            const target2: Position = add(onStartBoundary, patch(axis.line, 2));

            fluidScroll(
              dragTo({
                selection: target1,
                viewport: scrollableViewport,
              }),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);
            const scroll1: Position = (mocks.scrollWindow.mock
              .calls[0][0]: any);

            fluidScroll(
              dragTo({
                selection: target2,
                viewport: scrollableViewport,
              }),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(2);
            const scroll2: Position = (mocks.scrollWindow.mock
              .calls[1][0]: any);

            expect(scroll1[axis.line]).toBeLessThan(scroll2[axis.line]);

            // validation
            expect(scroll1[axis.crossAxisLine]).toBe(0);
            expect(scroll2[axis.crossAxisLine]).toBe(0);
          });

          it('should have the top speed at the max speed point', () => {
            const expected: Position = patch(axis.line, config.maxScrollSpeed);

            fluidScroll(
              dragTo({
                selection: onMaxBoundary,
                viewport: scrollableViewport,
              }),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollWindow).toHaveBeenCalledWith(expected);
          });

          it('should have the top speed when moving beyond the max speed point', () => {
            const target: Position = add(onMaxBoundary, patch(axis.line, 1));
            const expected: Position = patch(axis.line, config.maxScrollSpeed);

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrollableViewport,
              }),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollWindow).toHaveBeenCalledWith(expected);
          });

          it('should not scroll if the item is too big', () => {
            const expanded: Spacing = expandByPosition(
              scrollableViewport.frame,
              { x: 1, y: 1 },
            );
            const tooBig: DraggableDimension = getDraggableDimension({
              descriptor: preset.inHome1.descriptor,
              borderBox: expanded,
            });
            const selection: Position = onMaxBoundary;
            const custom: DraggingState = addDraggable(
              state.dragging(
                preset.inHome1.descriptor.id,
                selection,
                scrollableViewport,
              ),
              tooBig,
            );

            fluidScroll(custom);

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should not scroll if the window cannot scroll', () => {
            const target: Position = onMaxBoundary;

            fluidScroll(
              dragTo({
                selection: target,
                viewport: unscrollableViewport,
              }),
            );

            requestAnimationFrame.step();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });
        });

        describe('moving backwards towards the start of window', () => {
          const windowScroll: Position = patch(axis.line, 10);
          const scrolledViewport: Viewport = scrollViewport(
            scrollableViewport,
            windowScroll,
          );

          const onStartBoundary: Position = patch(
            axis.line,
            // at the boundary is not enough to start
            windowScroll[axis.line] + thresholds.startFrom,
            scrolledViewport.frame.center[axis.crossAxisLine],
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            windowScroll[axis.line] + thresholds.maxSpeedAt,
            scrolledViewport.frame.center[axis.crossAxisLine],
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              dragTo({
                selection: onStartBoundary,
                viewport: scrolledViewport,
              }),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrolledViewport,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalled();
            // moving backwards
            const request: Position = mocks.scrollWindow.mock.calls[0][0];
            expect(request[axis.line]).toBeLessThan(0);
          });

          it('should throttle multiple scrolls into a single animation frame', () => {
            const target1: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );
            const target2: Position = subtract(
              onStartBoundary,
              patch(axis.line, 2),
            );

            fluidScroll(
              dragTo({
                selection: target1,
                viewport: scrolledViewport,
              }),
            );
            fluidScroll(
              dragTo({
                selection: target2,
                viewport: scrolledViewport,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);

            // verification
            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);

            // not testing value called as we are not exposing getRequired scroll
          });

          it('should get faster the closer to the max speed point', () => {
            const target1: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );
            const target2: Position = subtract(
              onStartBoundary,
              patch(axis.line, 2),
            );

            fluidScroll(
              dragTo({
                selection: target1,
                viewport: scrolledViewport,
              }),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(1);
            const scroll1: Position = (mocks.scrollWindow.mock
              .calls[0][0]: any);

            fluidScroll(
              dragTo({
                selection: target2,
                viewport: scrolledViewport,
              }),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalledTimes(2);
            const scroll2: Position = (mocks.scrollWindow.mock
              .calls[1][0]: any);

            // moving backwards so a smaller value is bigger
            expect(scroll1[axis.line]).toBeGreaterThan(scroll2[axis.line]);
            // or put another way:
            expect(Math.abs(scroll1[axis.line])).toBeLessThan(
              Math.abs(scroll2[axis.line]),
            );

            // validation
            expect(scroll1[axis.crossAxisLine]).toBe(0);
            expect(scroll2[axis.crossAxisLine]).toBe(0);
          });

          it('should have the top speed at the max speed point', () => {
            const target: Position = onMaxBoundary;
            const expected: Position = patch(axis.line, -config.maxScrollSpeed);

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrolledViewport,
              }),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollWindow).toHaveBeenCalledWith(expected);
          });

          it('should have the top speed when moving beyond the max speed point', () => {
            const target: Position = subtract(
              onMaxBoundary,
              patch(axis.line, 1),
            );
            const expected: Position = patch(axis.line, -config.maxScrollSpeed);

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrolledViewport,
              }),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollWindow).toHaveBeenCalledWith(expected);
          });

          it('should not scroll if the item is too big', () => {
            const expanded: Spacing = expandByPosition(
              scrollableViewport.frame,
              { x: 1, y: 1 },
            );
            const tooBig: DraggableDimension = getDraggableDimension({
              descriptor: preset.inHome1.descriptor,
              borderBox: expanded,
            });
            const selection: Position = onMaxBoundary;
            const custom: DraggingState = addDraggable(
              state.dragging(
                preset.inHome1.descriptor.id,
                selection,
                scrollableViewport,
              ),
              tooBig,
            );

            fluidScroll(custom);

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should not scroll if the window cannot scroll', () => {
            const target: Position = onMaxBoundary;

            fluidScroll(
              dragTo({
                selection: target,
                viewport: unscrollableViewport,
              }),
            );

            requestAnimationFrame.step();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });
        });

        // just some light tests to ensure that cross axis moving also works
        describe('moving forward on the cross axis', () => {
          const onStartBoundary: Position = patch(
            axis.line,
            scrollableViewport.frame.center[axis.line],
            // to the boundary is not enough to start
            scrollableViewport.frame[axis.crossAxisSize] -
              crossAxisThresholds.startFrom,
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              dragTo({
                selection: onStartBoundary,
                viewport: scrollableViewport,
              }),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = add(
              onStartBoundary,
              patch(axis.crossAxisLine, 1),
            );

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrollableViewport,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalled();
            // moving forwards
            const request: Position = mocks.scrollWindow.mock.calls[0][0];
            expect(request[axis.crossAxisLine]).toBeGreaterThan(0);
          });
        });

        // just some light tests to ensure that cross axis moving also works
        describe('moving backward on the cross axis', () => {
          const windowScroll: Position = patch(axis.crossAxisLine, 10);
          const scrolled: Viewport = scrollViewport(
            scrollableViewport,
            windowScroll,
          );

          const onStartBoundary: Position = patch(
            axis.line,
            scrolled.frame.center[axis.line],
            // to the boundary is not enough to start
            windowScroll[axis.crossAxisLine] + crossAxisThresholds.startFrom,
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              dragTo({
                selection: onStartBoundary,
                viewport: scrolled,
              }),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollWindow).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = subtract(
              onStartBoundary,
              patch(axis.crossAxisLine, 1),
            );

            fluidScroll(
              dragTo({
                selection: target,
                viewport: scrolled,
              }),
            );

            expect(mocks.scrollWindow).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollWindow).toHaveBeenCalled();
            // moving backwards
            const request: Position = mocks.scrollWindow.mock.calls[0][0];
            expect(request[axis.crossAxisLine]).toBeLessThan(0);
          });
        });

        describe('big draggable', () => {
          const onMaxBoundaryOfBoth: Position = patch(
            axis.line,
            scrollableViewport.frame[axis.size] - thresholds.maxSpeedAt,
            scrollableViewport.frame[axis.crossAxisSize] -
              crossAxisThresholds.maxSpeedAt,
          );

          describe('bigger on the main axis', () => {
            it('should not allow scrolling on the main axis, but allow scrolling on the cross axis', () => {
              const expanded: Spacing = expandByPosition(
                scrollableViewport.frame,
                patch(axis.line, 1),
              );
              const tooBigOnMainAxis: DraggableDimension = getDraggableDimension(
                {
                  descriptor: preset.inHome1.descriptor,
                  borderBox: expanded,
                },
              );

              const selection: Position = onMaxBoundaryOfBoth;
              const custom: DraggingState = addDraggable(
                state.dragging(
                  preset.inHome1.descriptor.id,
                  selection,
                  scrollableViewport,
                ),
                tooBigOnMainAxis,
              );

              fluidScroll(custom);

              requestAnimationFrame.step();
              expect(mocks.scrollWindow).toHaveBeenCalledWith(
                // scroll ocurred on the cross axis, but not on the main axis
                patch(axis.crossAxisLine, config.maxScrollSpeed),
              );
            });
          });

          describe('bigger on the cross axis', () => {
            it('should not allow scrolling on the cross axis, but allow scrolling on the main axis', () => {
              const expanded: Spacing = expandByPosition(
                scrollableViewport.frame,
                patch(axis.crossAxisLine, 1),
              );
              const tooBigOnCrossAxis: DraggableDimension = getDraggableDimension(
                {
                  descriptor: preset.inHome1.descriptor,
                  borderBox: expanded,
                },
              );

              const selection: Position = onMaxBoundaryOfBoth;
              const custom: DraggingState = addDraggable(
                state.dragging(
                  preset.inHome1.descriptor.id,
                  selection,
                  scrollableViewport,
                ),
                tooBigOnCrossAxis,
              );

              fluidScroll(custom);

              requestAnimationFrame.step();
              expect(mocks.scrollWindow).toHaveBeenCalledWith(
                // scroll ocurred on the main axis, but not on the cross axis
                patch(axis.line, config.maxScrollSpeed),
              );
            });
          });

          describe('bigger on both axis', () => {
            it('should not allow scrolling on any axis', () => {
              const expanded: Spacing = expandByPosition(
                scrollableViewport.frame,
                patch(axis.line, 1, 1),
              );
              const tooBig: DraggableDimension = getDraggableDimension({
                descriptor: preset.inHome1.descriptor,
                borderBox: expanded,
              });

              const selection: Position = onMaxBoundaryOfBoth;
              const custom: DraggingState = addDraggable(
                state.dragging(
                  preset.inHome1.descriptor.id,
                  selection,
                  scrollableViewport,
                ),
                tooBig,
              );

              fluidScroll(custom);

              requestAnimationFrame.step();
              expect(mocks.scrollWindow).not.toHaveBeenCalled();
            });
          });
        });
      });

      describe('droppable scrolling', () => {
        const thresholds: PixelThresholds = getPixelThresholds(
          frameClient.borderBox,
          axis,
        );
        const crossAxisThresholds: PixelThresholds = getPixelThresholds(
          frameClient.borderBox,
          axis === vertical ? horizontal : vertical,
        );
        const maxScrollSpeed: Position = patch(
          axis.line,
          config.maxScrollSpeed,
        );

        describe('moving forward to end of droppable', () => {
          const onStartBoundary: Position = patch(
            axis.line,
            // to the boundary is not enough to start
            frameClient.borderBox[axis.size] - thresholds.startFrom,
            frameClient.borderBox.center[axis.crossAxisLine],
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            frameClient.borderBox[axis.size] - thresholds.maxSpeedAt,
            frameClient.borderBox.center[axis.crossAxisLine],
          );
          const onEndOfFrame: Position = patch(
            axis.line,
            frameClient.borderBox[axis.size],
            frameClient.borderBox.center[axis.crossAxisLine],
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              addDroppable(
                dragTo({
                  selection: onStartBoundary,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = add(onStartBoundary, patch(axis.line, 1));

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalled();
            // moving forwards
            const [id, offset] = mocks.scrollDroppable.mock.calls[0];

            expect(id).toBe(scrollable.descriptor.id);
            expect(offset[axis.line]).toBeGreaterThan(0);
            expect(offset[axis.crossAxisLine]).toBe(0);
          });

          it('should throttle multiple scrolls into a single animation frame', () => {
            const target1: Position = add(onStartBoundary, patch(axis.line, 1));
            const target2: Position = add(onStartBoundary, patch(axis.line, 2));

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target1,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target2,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);

            // verification
            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);

            // not testing value called as we are not exposing getRequired scroll
          });

          it('should get faster the closer to the max speed point', () => {
            const target1: Position = add(onStartBoundary, patch(axis.line, 1));
            const target2: Position = add(onStartBoundary, patch(axis.line, 2));

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target1,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);
            const scroll1: Position = mocks.scrollDroppable.mock.calls[0][1];

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target2,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(2);
            const scroll2: Position = mocks.scrollDroppable.mock.calls[1][1];

            expect(scroll1[axis.line]).toBeLessThan(scroll2[axis.line]);

            // validation
            expect(scroll1[axis.crossAxisLine]).toBe(0);
            expect(scroll2[axis.crossAxisLine]).toBe(0);
          });

          it('should have the top speed at the max speed point', () => {
            const expected: Position = patch(axis.line, config.maxScrollSpeed);

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: onMaxBoundary,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).toHaveBeenCalledWith(
              scrollable.descriptor.id,
              expected,
            );
          });

          it('should have the top speed when moving beyond the max speed point', () => {
            const target: Position = add(onMaxBoundary, patch(axis.line, 1));
            const expected: Position = patch(axis.line, config.maxScrollSpeed);

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).toHaveBeenCalledWith(
              scrollable.descriptor.id,
              expected,
            );
          });

          it('should allow scrolling to the end of the droppable', () => {
            const target: Position = onEndOfFrame;
            // scrolling to max scroll point
            const maxChange: Position = getFrame(scrollable).scroll.max;
            const scrolled: DroppableDimension = scrollDroppable(
              scrollable,
              maxChange,
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.flush();

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          describe('big draggable', () => {
            const onMaxBoundaryOfBoth: Position = patch(
              axis.line,
              frameClient.borderBox[axis.size] - thresholds.maxSpeedAt,
              frameClient.borderBox[axis.crossAxisSize] -
                crossAxisThresholds.maxSpeedAt,
            );

            describe('bigger on the main axis', () => {
              it('should not allow scrolling on the main axis, but allow scrolling on the cross axis', () => {
                const expanded: Spacing = expandByPosition(
                  frameClient.borderBox,
                  patch(axis.line, 1),
                );
                const tooBigOnMainAxis: DraggableDimension = getDraggableDimension(
                  {
                    descriptor: preset.inHome1.descriptor,
                    borderBox: expanded,
                  },
                );

                const selection: Position = onMaxBoundaryOfBoth;
                const custom: DraggingState = addDroppable(
                  addDraggable(
                    state.dragging(
                      preset.inHome1.descriptor.id,
                      selection,
                      unscrollableViewport,
                    ),
                    tooBigOnMainAxis,
                  ),
                  scrollable,
                );

                fluidScroll(custom);

                requestAnimationFrame.flush();
                expect(mocks.scrollDroppable).toHaveBeenCalledWith(
                  scrollable.descriptor.id,
                  // scroll ocurred on the cross axis, but not on the main axis
                  patch(axis.crossAxisLine, config.maxScrollSpeed),
                );
              });
            });

            describe('bigger on the cross axis', () => {
              it('should not allow scrolling on the cross axis, but allow scrolling on the main axis', () => {
                const expanded: Spacing = expandByPosition(
                  frameClient.borderBox,
                  patch(axis.crossAxisLine, 1),
                );
                const tooBigOnCrossAxis: DraggableDimension = getDraggableDimension(
                  {
                    descriptor: preset.inHome1.descriptor,
                    borderBox: expanded,
                  },
                );

                const selection: Position = onMaxBoundaryOfBoth;
                const custom: DraggingState = addDroppable(
                  addDraggable(
                    state.dragging(
                      preset.inHome1.descriptor.id,
                      selection,
                      unscrollableViewport,
                    ),
                    tooBigOnCrossAxis,
                  ),
                  scrollable,
                );

                fluidScroll(custom);

                requestAnimationFrame.flush();
                expect(mocks.scrollDroppable).toHaveBeenCalledWith(
                  scrollable.descriptor.id,
                  // scroll ocurred on the main axis, but not on the cross axis
                  patch(axis.line, config.maxScrollSpeed),
                );
              });
            });

            describe('bigger on both axis', () => {
              it('should not allow scrolling on the cross axis, but allow scrolling on the main axis', () => {
                const expanded: Spacing = expandByPosition(
                  frameClient.borderBox,
                  patch(axis.line, 1, 1),
                );
                const tooBig: DraggableDimension = getDraggableDimension({
                  descriptor: preset.inHome1.descriptor,
                  borderBox: expanded,
                });

                const selection: Position = onMaxBoundaryOfBoth;
                const custom: DraggingState = addDroppable(
                  addDraggable(
                    state.dragging(
                      preset.inHome1.descriptor.id,
                      selection,
                      unscrollableViewport,
                    ),
                    tooBig,
                  ),
                  scrollable,
                );

                fluidScroll(custom);

                requestAnimationFrame.step();
                expect(mocks.scrollDroppable).not.toHaveBeenCalled();
              });
            });
          });

          it('should not scroll if the droppable if moving past the end of the frame', () => {
            const target: Position = add(onEndOfFrame, patch(axis.line, 1));
            // scrolling to max scroll point
            const maxChange: Position = getFrame(scrollable).scroll.max;
            const scrolled: DroppableDimension = scrollDroppable(
              scrollable,
              maxChange,
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.flush();

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });
        });

        describe('moving backward to the start of droppable', () => {
          const droppableScroll: Position = patch(axis.line, 10);
          const scrolled: DroppableDimension = scrollDroppable(
            scrollable,
            droppableScroll,
          );

          const onStartBoundary: Position = patch(
            axis.line,
            // to the boundary is not enough to start
            frameClient.borderBox[axis.start] + thresholds.startFrom,
            frameClient.borderBox.center[axis.crossAxisLine],
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            frameClient.borderBox[axis.start] + thresholds.maxSpeedAt,
            frameClient.borderBox.center[axis.crossAxisLine],
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              addDroppable(
                dragTo({
                  selection: onStartBoundary,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            // going backwards
            const target: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalled();
            const [id, offset] = mocks.scrollDroppable.mock.calls[0];

            // validation
            expect(id).toBe(scrollable.descriptor.id);
            // moving backwards
            expect(offset[axis.line]).toBeLessThan(0);
            expect(offset[axis.crossAxisLine]).toBe(0);
          });

          it('should throttle multiple scrolls into a single animation frame', () => {
            const target1: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );
            const target2: Position = subtract(
              onStartBoundary,
              patch(axis.line, 2),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target1,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target2,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);

            // verification
            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);

            // not testing value called as we are not exposing getRequired scroll
          });

          it('should get faster the closer to the max speed point', () => {
            const target1: Position = subtract(
              onStartBoundary,
              patch(axis.line, 1),
            );
            const target2: Position = subtract(
              onStartBoundary,
              patch(axis.line, 2),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target1,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(1);
            const scroll1: Position = mocks.scrollDroppable.mock.calls[0][1];

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target2,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalledTimes(2);
            const scroll2: Position = mocks.scrollDroppable.mock.calls[1][1];

            // moving backwards
            expect(scroll1[axis.line]).toBeGreaterThan(scroll2[axis.line]);

            // validation
            expect(scroll1[axis.crossAxisLine]).toBe(0);
            expect(scroll2[axis.crossAxisLine]).toBe(0);
          });

          it('should have the top speed at the max speed point', () => {
            const expected: Position = patch(axis.line, -config.maxScrollSpeed);

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: onMaxBoundary,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).toHaveBeenCalledWith(
              scrollable.descriptor.id,
              expected,
            );
          });

          it('should have the top speed when moving beyond the max speed point', () => {
            const target: Position = subtract(
              onMaxBoundary,
              patch(axis.line, 1),
            );
            const expected: Position = patch(axis.line, -config.maxScrollSpeed);

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).toHaveBeenCalledWith(
              scrollable.descriptor.id,
              expected,
            );
          });

          it('should not scroll if the item is too big', () => {
            const expanded: Spacing = expandByPosition(frameClient.borderBox, {
              x: 1,
              y: 1,
            });
            const tooBig: DraggableDimension = getDraggableDimension({
              descriptor: preset.inHome1.descriptor,
              borderBox: expanded,
            });
            const selection: Position = onMaxBoundary;
            const custom: DraggingState = addDroppable(
              addDraggable(
                state.dragging(
                  preset.inHome1.descriptor.id,
                  selection,
                  unscrollableViewport,
                ),
                tooBig,
              ),
              scrolled,
            );

            fluidScroll(custom);

            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          it('should not scroll if the droppable is unable to be scrolled', () => {
            const target: Position = onMaxBoundary;
            if (!scrollable.frame) {
              throw new Error('Invalid test setup');
            }
            // scrolling to max scroll point

            fluidScroll(
              // scrollable cannot be scrolled backwards
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrollable,
              ),
            );
            requestAnimationFrame.flush();

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });
        });

        // just some light tests to ensure that cross axis moving also works
        describe('moving forward on the cross axis', () => {
          const droppableScroll: Position = patch(axis.crossAxisLine, 10);
          const scrolled: DroppableDimension = scrollDroppable(
            scrollable,
            droppableScroll,
          );

          const onStartBoundary: Position = patch(
            axis.line,
            frameClient.borderBox.center[axis.line],
            // to the boundary is not enough to start
            frameClient.borderBox[axis.crossAxisSize] -
              crossAxisThresholds.startFrom,
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              dragTo({
                selection: onStartBoundary,
                viewport: unscrollableViewport,
              }),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = add(
              onStartBoundary,
              patch(axis.crossAxisLine, 1),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalled();
            // moving forwards
            const [id, scroll] = mocks.scrollDroppable.mock.calls[0];

            expect(id).toBe(scrolled.descriptor.id);
            expect(scroll[axis.crossAxisLine]).toBeGreaterThan(0);
          });
        });

        // just some light tests to ensure that cross axis moving also works
        describe('moving backward on the cross axis', () => {
          const droppableScroll: Position = patch(axis.crossAxisLine, 10);
          const scrolled: DroppableDimension = scrollDroppable(
            scrollable,
            droppableScroll,
          );

          const onStartBoundary: Position = patch(
            axis.line,
            frameClient.borderBox.center[axis.line],
            // to the boundary is not enough to start
            frameClient.borderBox[axis.crossAxisStart] +
              crossAxisThresholds.startFrom,
          );

          it('should not scroll if not past the start threshold', () => {
            fluidScroll(
              addDroppable(
                dragTo({
                  selection: onStartBoundary,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            requestAnimationFrame.flush();
            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });

          it('should scroll if moving beyond the start threshold', () => {
            const target: Position = subtract(
              onStartBoundary,
              patch(axis.crossAxisLine, 1),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();

            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalled();
            // moving backwards
            const [, offset] = mocks.scrollDroppable.mock.calls[0];
            expect(offset[axis.crossAxisLine]).toBeLessThan(0);
          });
        });

        describe('over frame but not a subject', () => {
          const customFrameClient: BoxModel = createBox({
            borderBox: {
              top: 0,
              left: 0,
              right: 5000,
              bottom: 5000,
            },
          });

          const withSmallSubject: DroppableDimension = getDroppableDimension({
            // stealing the home descriptor
            descriptor: preset.home.descriptor,
            direction: axis.direction,
            borderBox: {
              top: 0,
              left: 0,
              right: 100,
              bottom: 100,
            },
            closest: {
              borderBox: customFrameClient.borderBox,
              scrollSize: {
                scrollWidth: 10000,
                scrollHeight: 10000,
              },
              scroll: origin,
              shouldClipSubject: true,
            },
          });

          const endOfSubject: Position = patch(axis.line, 100);
          const endOfFrame: Position = patch(
            axis.line,
            // on the end
            5000,
            // half way
            2500,
          );

          it('should scroll a frame if it is being dragged over, even if not over the subject', () => {
            const scrolled: DroppableDimension = scrollDroppable(
              withSmallSubject,
              // scrolling the whole client away
              endOfSubject,
            );
            // subject no longer visible
            expect(scrolled.subject.active).toBe(null);
            const custom: DraggingState = {
              ...addDroppable(
                dragTo({
                  selection: endOfFrame,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
              // being super clear that we are not currently over any droppable
              impact: noImpact,
            };

            fluidScroll(custom);
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).toHaveBeenCalledWith(
              scrolled.descriptor.id,
              maxScrollSpeed,
            );
          });

          it('should not scroll the frame if not over the frame', () => {
            const scrolled: DroppableDimension = scrollDroppable(
              withSmallSubject,
              // scrolling the whole client away
              endOfSubject,
            );
            // subject no longer visible
            expect(scrolled.subject.active).toBe(null);
            const target: Position = add(endOfFrame, patch(axis.line, 1));
            const custom: DraggingState = {
              ...addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
              // being super clear that we are not currently over any droppable
              impact: noImpact,
            };

            fluidScroll(custom);
            requestAnimationFrame.step();

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
          });
        });

        // This can happen when there is a scrollbar on the cross axis
        describe('moving backwards when current scroll is greater than max', () => {
          const droppableScroll: Position = add(
            getFrame(scrollable).scroll.max,
            patch(axis.line, 10),
          );
          const scrolled: DroppableDimension = scrollDroppable(
            scrollable,
            droppableScroll,
          );
          const onStartBoundary: Position = patch(
            axis.line,
            // to the boundary is not enough to start
            frameClient.borderBox[axis.start] + thresholds.startFrom,
            frameClient.borderBox.center[axis.crossAxisLine],
          );

          it('should have a current scroll greater than the current scroll (validation)', () => {
            expect(getFrame(scrolled).scroll.max[axis.line]).toBeLessThan(
              getFrame(scrolled).scroll.current[axis.line],
            );
          });

          it('should allow scrolling backwards - even if still above the max scroll', () => {
            // going backwards
            const target: Position = subtract(
              onStartBoundary,
              // scrolling less than the excess so it is still above the max
              patch(axis.line, 1),
            );

            fluidScroll(
              addDroppable(
                dragTo({
                  selection: target,
                  viewport: unscrollableViewport,
                }),
                scrolled,
              ),
            );

            expect(mocks.scrollDroppable).not.toHaveBeenCalled();
            // only called after a frame
            requestAnimationFrame.step();
            expect(mocks.scrollDroppable).toHaveBeenCalled();
            const [id, offset] = mocks.scrollDroppable.mock.calls[0];

            expect(id).toBe(scrollable.descriptor.id);
            // moving backwards
            expect(offset[axis.line]).toBeLessThan(0);
            expect(offset[axis.crossAxisLine]).toBe(0);
          });
        });
      });

      describe('window scrolling before droppable scrolling', () => {
        const custom: DroppableDimension = getDroppableDimension({
          descriptor: {
            id: 'scrollable that is similiar to the viewport',
            type: 'TYPE',
          },
          borderBox: {
            top: 0,
            left: 0,
            // bigger than the frame
            right: windowScrollSize.scrollWidth,
            bottom: windowScrollSize.scrollHeight,
          },
          closest: {
            borderBox: scrollableViewport.frame,
            scrollSize: {
              scrollWidth: windowScrollSize.scrollWidth,
              scrollHeight: windowScrollSize.scrollHeight,
            },
            scroll: origin,
            shouldClipSubject: true,
          },
        });
        const thresholds: PixelThresholds = getPixelThresholds(
          scrollableViewport.frame,
          axis,
        );

        it('should scroll the window only if both the window and droppable can be scrolled', () => {
          const onMaxBoundary: Position = patch(
            axis.line,
            scrollableViewport.frame[axis.size] - thresholds.maxSpeedAt,
            scrollableViewport.frame.center[axis.crossAxisLine],
          );

          fluidScroll(
            addDroppable(
              dragTo({
                selection: onMaxBoundary,
                viewport: scrollableViewport,
              }),
              custom,
            ),
          );
          requestAnimationFrame.step();

          expect(mocks.scrollWindow).toHaveBeenCalled();
          expect(mocks.scrollDroppable).not.toHaveBeenCalled();
        });
      });

      describe('cancel', () => {
        it('should cancel any pending window scroll', () => {
          const thresholds: PixelThresholds = getPixelThresholds(
            scrollableViewport.frame,
            axis,
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            scrollableViewport.frame[axis.size] - thresholds.maxSpeedAt,
            scrollableViewport.frame.center[axis.crossAxisLine],
          );

          fluidScroll(
            dragTo({
              selection: onMaxBoundary,
              viewport: scrollableViewport,
            }),
          );

          // frame not cleared
          expect(mocks.scrollWindow).not.toHaveBeenCalled();

          fluidScroll.cancel();
          requestAnimationFrame.flush();

          expect(mocks.scrollWindow).not.toHaveBeenCalled();
        });

        it('should cancel any pending droppable scroll', () => {
          const thresholds: PixelThresholds = getPixelThresholds(
            frameClient.borderBox,
            axis,
          );
          const onMaxBoundary: Position = patch(
            axis.line,
            frameClient.borderBox[axis.size] - thresholds.maxSpeedAt,
            frameClient.borderBox.center[axis.crossAxisLine],
          );
          const drag: DraggingState = addDroppable(
            dragTo({
              selection: onMaxBoundary,
              viewport: scrollableViewport,
            }),
            scrollable,
          );

          fluidScroll(drag);

          // frame not cleared
          expect(mocks.scrollDroppable).not.toHaveBeenCalled();

          // should cancel the next frame
          fluidScroll.cancel();
          requestAnimationFrame.flush();

          expect(mocks.scrollDroppable).not.toHaveBeenCalled();
        });
      });
    });
  });
});

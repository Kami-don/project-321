// @flow
import invariant from 'tiny-invariant';
import middleware from '../../../../src/state/middleware/drop';
import createStore from './util/create-store';
import getHomeLocation from '../../../../src/state/get-home-location';
import { add, patch } from '../../../../src/state/position';
import { getPreset, makeScrollable } from '../../../utils/dimension';
import passThrough from './util/pass-through-middleware';
import {
  clean,
  drop,
  prepare,
  initialPublish,
  animateDrop,
  dropPending,
  move,
  completeDrop,
  updateDroppableScroll,
  moveByWindowScroll,
  type InitialPublishArgs,
  type DropAnimateAction,
  collectionStarting,
} from '../../../../src/state/action-creators';
import {
  initialPublishArgs,
  getDragStart,
  critical,
} from '../../../utils/preset-action-args';
import noImpact, { noMovement } from '../../../../src/state/no-impact';
import { vertical } from '../../../../src/state/axis';
import type {
  State,
  DropResult,
  PendingDrop,
  DraggableLocation,
  DropReason,
  DroppableDimension,
  Axis,
} from '../../../../src/types';
import type { Store } from '../../../../src/state/store-types';

const axis: Axis = vertical;
const preset = getPreset(vertical);

it('should throw an error if a drop action occurs while not in a phase where you can drop', () => {
  const store: Store = createStore(middleware);

  // idle (it is okay to perform a defensive drop here)
  // this can happen during an exception flow
  expect(() => {
    store.dispatch(drop({ reason: 'DROP' }));
  }).not.toThrow();

  // drop animating
  store.dispatch(clean());
  store.dispatch(prepare());
  store.dispatch(initialPublish(initialPublishArgs));
  expect(store.getState().phase).toBe('DRAGGING');

  // moving a little bit so that a drop animation will be needed
  store.dispatch(
    move({
      client: add(initialPublishArgs.client.selection, { x: 1, y: 1 }),
      shouldAnimate: true,
    }),
  );

  store.dispatch(drop({ reason: 'DROP' }));
  expect(store.getState().phase).toBe('DROP_ANIMATING');

  expect(() => store.dispatch(drop({ reason: 'DROP' }))).toThrow();
});

it('should dispatch a DROP_PENDING action if COLLECTING', () => {
  const mock = jest.fn();
  const store: Store = createStore(passThrough(mock), middleware);

  store.dispatch(prepare());
  store.dispatch(initialPublish(initialPublishArgs));
  expect(store.getState().phase).toBe('DRAGGING');
  store.dispatch(collectionStarting());

  // now in the bulk collecting phase
  expect(store.getState().phase).toBe('COLLECTING');
  mock.mockReset();

  // drop
  store.dispatch(drop({ reason: 'DROP' }));

  expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
  expect(mock).toHaveBeenCalledWith(dropPending({ reason: 'DROP' }));
  expect(mock).toHaveBeenCalledTimes(2);
  expect(store.getState().phase).toBe('DROP_PENDING');
});

it('should reset the state if a drop occurs while the application is preparing', () => {
  const mock = jest.fn();
  const store: Store = createStore(passThrough(mock), middleware);

  store.dispatch(prepare());
  expect(store.getState().phase).toBe('PREPARING');

  store.dispatch(drop({ reason: 'DROP' }));
  expect(store.getState().phase).toBe('IDLE');
  expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
  expect(mock).toHaveBeenCalledWith(clean());
});

it('should throw if a drop action is fired and there is DROP_PENDING and it is waiting for a publish', () => {
  const mock = jest.fn();
  const store: Store = createStore(passThrough(mock), middleware);

  store.dispatch(prepare());
  store.dispatch(initialPublish(initialPublishArgs));
  store.dispatch(collectionStarting());

  // now in the bulk collecting phase
  expect(store.getState().phase).toBe('COLLECTING');
  mock.mockReset();

  // drop moving to drop pending
  store.dispatch(drop({ reason: 'DROP' }));
  expect(mock).toHaveBeenCalledWith(dropPending({ reason: 'DROP' }));

  const state: State = store.getState();
  invariant(state.phase === 'DROP_PENDING', 'invalid phase');

  expect(state.isWaiting).toBe(true);

  // Drop action being fired (should not happen?)

  expect(() => store.dispatch(drop({ reason: 'DROP' }))).toThrow(
    'A DROP action occurred while DROP_PENDING and still waiting',
  );
});

describe('no drop animation required', () => {
  const reasons: DropReason[] = ['DROP', 'CANCEL'];

  reasons.forEach((reason: DropReason) => {
    describe(`with drop reason: ${reason}`, () => {
      it('should fire a complete drop action is no drop animation is required', () => {
        const mock = jest.fn();
        const store: Store = createStore(passThrough(mock), middleware);

        store.dispatch(clean());
        store.dispatch(prepare());
        store.dispatch(initialPublish(initialPublishArgs));
        expect(store.getState().phase).toBe('DRAGGING');

        // no movement yet
        mock.mockReset();
        store.dispatch(drop({ reason }));

        const destination: ?DraggableLocation = (() => {
          // destination is cleared when cancelling
          if (reason === 'CANCEL') {
            return null;
          }

          return getDragStart().source;
        })();

        const result: DropResult = {
          ...getDragStart(),
          destination,
          reason,
        };
        expect(mock).toHaveBeenCalledWith(drop({ reason }));
        expect(mock).toHaveBeenCalledWith(completeDrop(result));
        expect(mock).toHaveBeenCalledTimes(2);

        // reset to initial phase
        expect(store.getState().phase).toBe('IDLE');
      });
    });
  });
});

describe('drop animation required', () => {
  describe('reason: CANCEL', () => {
    it('should animate back to the origin', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      store.dispatch(prepare());
      store.dispatch(initialPublish(initialPublishArgs));
      expect(store.getState().phase).toBe('DRAGGING');

      // moving a little bit so that a drop animation will be needed
      store.dispatch(
        move({
          client: add(initialPublishArgs.client.selection, { x: 1, y: 1 }),
          shouldAnimate: true,
        }),
      );

      mock.mockReset();
      store.dispatch(drop({ reason: 'CANCEL' }));

      const pending: PendingDrop = {
        newHomeOffset: { x: 0, y: 0 },
        impact: noImpact,
        result: {
          ...getDragStart(),
          // destination cleared
          destination: null,
          reason: 'CANCEL',
        },
      };
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'CANCEL' }));
      expect(mock).toHaveBeenCalledWith(animateDrop(pending));
      expect(mock).toHaveBeenCalledTimes(2);
      expect(store.getState().phase).toBe('DROP_ANIMATING');
    });

    it('should account for any change in scroll in the home droppable', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      const scrollableHome: DroppableDimension = makeScrollable(preset.home);

      const customArgs: InitialPublishArgs = {
        ...initialPublishArgs,
        dimensions: {
          ...initialPublishArgs.dimensions,
          droppables: {
            [scrollableHome.descriptor.id]: scrollableHome,
          },
        },
      };

      // getting into a drag
      store.dispatch(clean());
      store.dispatch(prepare());
      store.dispatch(initialPublish(customArgs));
      expect(store.getState().phase).toBe('DRAGGING');

      // doing a small scroll
      store.dispatch(
        updateDroppableScroll({
          id: customArgs.critical.droppable.id,
          offset: { x: 1, y: 1 },
        }),
      );

      // dropping
      mock.mockReset();
      store.dispatch(drop({ reason: 'CANCEL' }));
      const pending: PendingDrop = {
        // what we need to do to get back to the origin
        newHomeOffset: { x: -1, y: -1 },
        impact: {
          movement: noMovement,
          direction: null,
          destination: null,
        },
        result: {
          ...getDragStart(customArgs.critical),
          destination: null,
          reason: 'CANCEL',
        },
      };
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'CANCEL' }));
      expect(mock).toHaveBeenCalledWith(animateDrop(pending));
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('should not account for scrolling in the droppable the draggable is over if it is not the home', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      const scrollableForeign: DroppableDimension = makeScrollable(
        preset.foreign,
      );
      const customInitial: InitialPublishArgs = {
        ...initialPublishArgs,
        dimensions: {
          ...initialPublishArgs.dimensions,
          droppables: {
            ...initialPublishArgs.dimensions.droppables,
            [scrollableForeign.descriptor.id]: scrollableForeign,
          },
        },
      };

      // getting into a drag
      store.dispatch(clean());
      store.dispatch(prepare());
      store.dispatch(initialPublish(customInitial));
      expect(store.getState().phase).toBe('DRAGGING');

      // moving over the foreign droppable
      store.dispatch(
        move({
          client: scrollableForeign.client.borderBox.center,
          shouldAnimate: false,
        }),
      );
      const state: State = store.getState();
      invariant(state.phase === 'DRAGGING', 'Invalid phase');
      invariant(
        state.impact.destination,
        'Expected to be over foreign droppable',
      );
      expect(state.impact.destination.droppableId).toBe(
        scrollableForeign.descriptor.id,
      );

      // doing a small scroll on foreign
      store.dispatch(
        updateDroppableScroll({
          id: scrollableForeign.descriptor.id,
          offset: { x: 1, y: 1 },
        }),
      );

      // dropping
      mock.mockReset();
      store.dispatch(drop({ reason: 'CANCEL' }));
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'CANCEL' }));
      // Just checking the offset rather than the whole shape
      // Expecting return to origin as the scroll has not changed
      const action: DropAnimateAction = (mock.mock.calls[1][0]: any);
      expect(action.type).toEqual('DROP_ANIMATE');
      expect(action.payload.newHomeOffset).toEqual({ x: 0, y: 0 });
      expect(mock).toHaveBeenCalledTimes(2);
    });
  });

  describe('reason: DROP', () => {
    it('should account for any change in scroll in the home droppable if not dragging over anything', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      const scrollableHome: DroppableDimension = makeScrollable(preset.home);
      const customArgs: InitialPublishArgs = {
        ...initialPublishArgs,
        dimensions: {
          ...initialPublishArgs.dimensions,
          droppables: {
            [scrollableHome.descriptor.id]: scrollableHome,
          },
        },
      };

      // getting into a drag
      store.dispatch(prepare());
      store.dispatch(initialPublish(customArgs));
      expect(store.getState().phase).toBe('DRAGGING');

      // move after the end of the home droppable
      store.dispatch(
        move({
          client: {
            x: preset.home.client.marginBox.center.x,
            y: preset.home.client.marginBox.bottom + 1,
          },
          shouldAnimate: false,
        }),
      );

      // assert we are not over the home droppable
      const state: State = store.getState();
      invariant(state.phase === 'DRAGGING');
      invariant(!state.impact.destination, 'Should have no destination');

      // scroll the home droppable
      store.dispatch(
        updateDroppableScroll({
          id: customArgs.critical.droppable.id,
          offset: { x: 1, y: 1 },
        }),
      );

      // drop
      mock.mockReset();
      store.dispatch(drop({ reason: 'DROP' }));
      const pending: PendingDrop = {
        // what we need to do to get back to the origin
        newHomeOffset: { x: -1, y: -1 },
        impact: {
          movement: noMovement,
          direction: null,
          destination: null,
        },
        result: {
          ...getDragStart(customArgs.critical),
          destination: null,
          reason: 'DROP',
        },
      };
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
      expect(mock).toHaveBeenCalledWith(animateDrop(pending));
      expect(mock).toHaveBeenCalledTimes(2);
    });

    // Could also add a test to check this is true for foreign droppables - but it has proven
    // very difficult to setup that test correctly
    it('should account for any change in scroll in the droppable being dropped into', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      const scrollableHome: DroppableDimension = makeScrollable(preset.home);
      const customArgs: InitialPublishArgs = {
        ...initialPublishArgs,
        dimensions: {
          ...initialPublishArgs.dimensions,
          droppables: {
            [scrollableHome.descriptor.id]: scrollableHome,
          },
        },
      };

      // getting into a drag
      store.dispatch(prepare());
      store.dispatch(initialPublish(customArgs));
      expect(store.getState().phase).toBe('DRAGGING');

      // moving to the top of the foreign droppable
      store.dispatch(
        move({
          client: { x: 1, y: 1 },
          shouldAnimate: false,
        }),
      );
      const state: State = store.getState();
      invariant(state.phase === 'DRAGGING', 'Invalid phase');
      invariant(state.impact.destination, 'Expected to be over home droppable');
      expect(state.impact.destination.droppableId).toBe(
        scrollableHome.descriptor.id,
      );

      // scroll the foreign droppable
      store.dispatch(
        updateDroppableScroll({
          id: scrollableHome.descriptor.id,
          offset: { x: 1, y: 1 },
        }),
      );

      // drop
      mock.mockReset();
      store.dispatch(drop({ reason: 'DROP' }));
      const pending: PendingDrop = {
        // what we need to do to get back to the origin
        newHomeOffset: { x: -1, y: -1 },
        impact: {
          movement: {
            displaced: [],
            amount: patch(
              axis.line,
              preset.inHome1.client.marginBox[axis.size],
            ),
            isBeyondStartPosition: false,
          },
          direction: preset.home.axis.direction,
          destination: getHomeLocation(customArgs.critical),
        },
        result: {
          ...getDragStart(customArgs.critical),
          destination: getHomeLocation(customArgs.critical),
          reason: 'DROP',
        },
      };
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
      expect(mock).toHaveBeenCalledWith(animateDrop(pending));
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('should account for any change in scroll in the window', () => {
      const mock = jest.fn();
      const store: Store = createStore(passThrough(mock), middleware);

      // getting into a drag
      store.dispatch(clean());
      store.dispatch(prepare());
      store.dispatch(initialPublish(initialPublishArgs));
      expect(store.getState().phase).toBe('DRAGGING');

      // scroll the window
      store.dispatch(
        moveByWindowScroll({
          scroll: add(preset.windowScroll, { x: 1, y: 1 }),
        }),
      );

      // drop
      mock.mockReset();
      store.dispatch(drop({ reason: 'DROP' }));
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
      const pending: PendingDrop = {
        // what we need to do to get back to the origin
        newHomeOffset: { x: -1, y: -1 },
        impact: {
          movement: {
            displaced: [],
            amount: patch(
              axis.line,
              preset.inHome1.client.marginBox[axis.size],
            ),
            isBeyondStartPosition: true,
          },
          direction: preset.home.axis.direction,
          destination: getHomeLocation(critical),
        },
        result: {
          ...getDragStart(),
          destination: getHomeLocation(critical),
          reason: 'DROP',
        },
      };
      expect(mock).toHaveBeenCalledWith(drop({ reason: 'DROP' }));
      expect(mock).toHaveBeenCalledWith(animateDrop(pending));
      expect(mock).toHaveBeenCalledTimes(2);
    });
  });
});

// @flow
import invariant from 'tiny-invariant';
import { withScroll, type Position, type BoxModel } from 'css-box-model';
import type {
  DroppableDimension,
  CollectingState,
  Published,
  DraggingState,
  DropPendingState,
  ScrollSize,
  Scrollable,
} from '../../../../../src/types';
import {
  getPreset,
  makeScrollable,
  addDroppable,
  getFrame,
} from '../../../../utils/dimension';
import getStatePreset from '../../../../utils/get-simple-state-preset';
import scrollDroppable from '../../../../../src/state/droppable/scroll-droppable';
import getDroppable from '../../../../../src/state/droppable/get-droppable';
import publish from '../../../../../src/state/publish-while-dragging';
import { empty, adjustBox } from '../util';

const preset = getPreset();
const state = getStatePreset();

it('should adjust the current droppable scroll in response to a change', () => {
  // sometimes the scroll of a droppable is impacted by the adding or removing of droppables
  // we need to ensure that the droppable has the correct current scroll and diffs based on the insertion

  const originalScroll: Position = { x: 0, y: 20 };
  const currentScroll: Position = { x: 0, y: 5 };

  // Dragging inHome2 and inHome1 is removed
  const scrollableHome: DroppableDimension = makeScrollable(
    preset.home,
    originalScroll.y,
  );
  const beforeRemoval: DroppableDimension = scrollDroppable(
    scrollableHome,
    originalScroll,
  );
  const afterRemoval: DroppableDimension = scrollDroppable(
    scrollableHome,
    currentScroll,
  );

  // $FlowFixMe - wrong type
  const original: CollectingState = addDroppable(
    // $FlowFixMe - wrong type
    state.collecting(preset.inHome2.descriptor.id),
    beforeRemoval,
  );

  const published: Published = {
    ...empty,
    removals: [preset.inHome1.descriptor.id],
    modified: [afterRemoval],
  };

  const result: DraggingState | DropPendingState = publish({
    state: original,
    published,
  });

  invariant(result.phase === 'DRAGGING');

  const updated: DroppableDimension =
    result.dimensions.droppables[preset.home.descriptor.id];
  // current scroll set to the
  expect(getFrame(updated).scroll.current).toEqual(currentScroll);
});

it('should adjust for a new scroll size', () => {
  const scrollableHome: DroppableDimension = makeScrollable(preset.home, 0);
  const scrollable: Scrollable = getFrame(scrollableHome);
  const increase: Position = {
    x: 10,
    y: 20,
  };
  const increased: ScrollSize = {
    scrollHeight: scrollable.scrollSize.scrollHeight + increase.y,
    scrollWidth: scrollable.scrollSize.scrollWidth + increase.x,
  };
  const client: BoxModel = adjustBox(scrollableHome.client, increase);
  const withIncreased: DroppableDimension = getDroppable({
    descriptor: scrollableHome.descriptor,
    isEnabled: scrollableHome.isEnabled,
    direction: scrollableHome.axis.direction,
    isCombineEnabled: scrollableHome.isCombineEnabled,
    isFixedOnPage: scrollableHome.isFixedOnPage,
    client,
    page: withScroll(client, preset.windowScroll),
    closest: {
      client: scrollable.frameClient,
      page: withScroll(scrollable.frameClient, preset.windowScroll),
      scrollSize: increased,
      scroll: scrollable.scroll.initial,
      shouldClipSubject: scrollable.shouldClipSubject,
    },
  });

  const published: Published = {
    ...empty,
    removals: [preset.inHome2.descriptor.id],
    modified: [withIncreased],
  };

  // $FlowFixMe - wrong type
  const original: CollectingState = addDroppable(
    // $FlowFixMe - wrong type
    state.collecting(),
    scrollableHome,
  );

  const result: DraggingState | DropPendingState = publish({
    state: original,
    published,
  });

  invariant(result.phase === 'DRAGGING');

  const updated: DroppableDimension =
    result.dimensions.droppables[preset.home.descriptor.id];
  // current scroll set to the
  expect(getFrame(updated).scrollSize).toEqual(increased);
});

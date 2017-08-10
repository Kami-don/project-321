// @flow
import memoizeOne from 'memoize-one';
import type { TypeId,
  Action,
  State,
  DraggableDimension,
  DroppableDimension,
  DroppableId,
  DimensionState,
  DragImpact,
  DragState,
  DropResult,
  CurrentDrag,
  InitialDrag,
  PendingDrop,
  Phase,
  DraggableLocation,
  CurrentDragLocation,
  Position,
  WithinDroppable,
} from '../types';
import { add, subtract, negate } from './position';
import getDragImpact from './get-drag-impact';
import getDiffToJumpToNextIndex from './get-diff-to-jump-to-next-index';
import getDroppableOver from './get-droppable-over';

const noDimensions: DimensionState = {
  request: null,
  draggable: {},
  droppable: {},
};

const origin: Position = { x: 0, y: 0 };

const clean = memoizeOne((phase: ?Phase): State => {
  const state: State = {
    // flow was not good with having a default arg on an optional type
    phase: phase || 'IDLE',
    drag: null,
    drop: null,
    dimension: noDimensions,
  };

  return state;
});

type MoveArgs = {|
  state: State,
  clientSelection: Position,
  pageSelection: Position,
  shouldAnimate?: boolean,
  windowScroll?: Position
|}

const move = ({
  state,
  clientSelection,
  pageSelection,
  shouldAnimate = false,
  windowScroll,
}: MoveArgs): State => {
  if (state.phase !== 'DRAGGING') {
    console.error('cannot move while not dragging');
    return clean();
  }

  if (state.drag == null) {
    console.error('cannot move if there is no drag information');
    return clean();
  }

  const previous: CurrentDrag = state.drag.current;
  const initial: InitialDrag = state.drag.initial;
  const droppable: DroppableDimension = state.dimension.droppable[initial.source.droppableId];

  const client: CurrentDragLocation = (() => {
    const offset: Position = subtract(clientSelection, initial.client.selection);
    const center: Position = add(offset, initial.client.center);

    const result: CurrentDragLocation = {
      selection: clientSelection,
      offset,
      center,
    };
    return result;
  })();

  const page: CurrentDragLocation = (() => {
    const offset: Position = subtract(pageSelection, initial.page.selection);
    const center: Position = add(offset, initial.page.center);

    const result: CurrentDragLocation = {
      selection: pageSelection,
      offset,
      center,
    };
    return result;
  })();

  const scrollDiff: Position = subtract(droppable.scroll.initial, droppable.scroll.current);

  const withinDroppable: WithinDroppable = {
    center: add(page.center, negate(scrollDiff)),
  };

  const currentWindowScroll: Position = windowScroll || previous.windowScroll;

  const current: CurrentDrag = {
    id: previous.id,
    type: previous.type,
    client,
    page,
    withinDroppable,
    shouldAnimate,
    windowScroll: currentWindowScroll,
  };

  const impact: DragImpact = getDragImpact({
    page: page.selection,
    withinDroppable,
    draggableId: current.id,
    draggables: state.dimension.draggable,
    droppables: state.dimension.droppable,
  });

  const drag: DragState = {
    initial,
    impact,
    current,
  };

  return {
    ...state,
    drag,
  };
};

export default (state: State = clean('IDLE'), action: Action): State => {
  if (action.type === 'BEGIN_LIFT') {
    if (state.phase !== 'IDLE') {
      console.error('trying to start a lift while another is occurring');
      return state;
    }
    return clean('COLLECTING_DIMENSIONS');
  }

  if (action.type === 'REQUEST_DIMENSIONS') {
    if (state.phase !== 'COLLECTING_DIMENSIONS') {
      console.error('trying to collect dimensions at the wrong time');
      return state;
    }

    const typeId: TypeId = action.payload;

    return {
      phase: 'COLLECTING_DIMENSIONS',
      drag: null,
      drop: null,
      dimension: {
        request: typeId,
        draggable: {},
        droppable: {},
      },
    };
  }

  if (action.type === 'PUBLISH_DRAGGABLE_DIMENSION') {
    const dimension: DraggableDimension = action.payload;

    if (state.phase !== 'COLLECTING_DIMENSIONS') {
      console.warn('dimension rejected as no longer requesting dimensions', dimension);
      return state;
    }

    if (state.dimension.draggable[dimension.id]) {
      console.error(`dimension already exists for ${dimension.id}`);
      return state;
    }

    return {
      ...state,
      dimension: {
        request: state.dimension.request,
        droppable: state.dimension.droppable,
        draggable: {
          ...state.dimension.draggable,
          [dimension.id]: dimension,
        },
      },
    };
  }

  if (action.type === 'PUBLISH_DROPPABLE_DIMENSION') {
    const dimension: DroppableDimension = action.payload;

    if (state.phase !== 'COLLECTING_DIMENSIONS') {
      console.warn('dimension rejected as no longer requesting dimensions', dimension);
      return state;
    }

    if (state.dimension.droppable[dimension.id]) {
      console.error(`dimension already exists for ${dimension.id}`);
      return state;
    }

    return {
      ...state,
      dimension: {
        request: state.dimension.request,
        draggable: state.dimension.draggable,
        droppable: {
          ...state.dimension.droppable,
          [dimension.id]: dimension,
        },
      },
    };
  }

  if (action.type === 'COMPLETE_LIFT') {
    if (state.phase !== 'COLLECTING_DIMENSIONS') {
      console.error('trying complete lift without collecting dimensions');
      return state;
    }

    const { id, type, client, page, windowScroll } = action.payload;

    // no scroll diff yet so withinDroppable is just the center position
    const withinDroppable: WithinDroppable = {
      center: page.center,
    };

    const impact: DragImpact = getDragImpact({
      page: page.selection,
      withinDroppable,
      draggableId: id,
      draggables: state.dimension.draggable,
      droppables: state.dimension.droppable,
    });

    const source: ?DraggableLocation = impact.destination;

    if (!source) {
      console.error('lifting a draggable that is not inside a droppable');
      return clean();
    }

    const initial: InitialDrag = {
      source,
      client,
      page,
      windowScroll,
      withinDroppable,
    };

    const current: CurrentDrag = {
      id,
      type,
      client: {
        selection: client.selection,
        center: client.center,
        offset: origin,
      },
      page: {
        selection: page.selection,
        center: page.center,
        offset: origin,
      },
      withinDroppable,
      windowScroll,
      shouldAnimate: false,
    };

    return {
      ...state,
      phase: 'DRAGGING',
      drag: {
        initial,
        current,
        impact,
      },
    };
  }

  if (action.type === 'UPDATE_DROPPABLE_DIMENSION_SCROLL') {
    if (state.phase !== 'DRAGGING') {
      console.error('cannot update a droppable dimensions scroll when not dragging');
      return clean();
    }

    if (state.drag == null) {
      console.error('invalid store state');
      return clean();
    }

    const { id, offset } = action.payload;

    const target: ?DroppableDimension = state.dimension.droppable[id];

    if (!target) {
      console.error('cannot update a droppable that is not inside of the state', id);
      return clean();
    }

    // TODO: do not break an existing dimension.
    // Rather, have a different structure to store the scroll
    // $ExpectError - flow does not like spread
    const dimension: DroppableDimension = {
      ...target,
      scroll: {
        initial: target.scroll.initial,
        current: offset,
      },
    };

    const withUpdatedDimension: State = {
      ...state,
      dimension: {
        request: state.dimension.request,
        draggable: state.dimension.draggable,
        droppable: {
          ...state.dimension.droppable,
          [id]: dimension,
        },
      },
    };

    const { client, page } = state.drag.current;

    return move({
      state: withUpdatedDimension,
      clientSelection: client.selection,
      pageSelection: page.selection,
    });
  }

  if (action.type === 'MOVE') {
    const { client, page, windowScroll } = action.payload;
    return move({
      state,
      clientSelection: client,
      pageSelection: page,
      windowScroll,
    });
  }

  if (action.type === 'MOVE_BY_WINDOW_SCROLL') {
    const { windowScroll } = action.payload;

    if (!state.drag) {
      console.error('cannot move with window scrolling if no current drag');
      return clean();
    }

    const initial: InitialDrag = state.drag.initial;
    const current: CurrentDrag = state.drag.current;
    const client: Position = current.client.selection;

    // diff between the previous scroll position and the initial
    const previousDiff: Position = subtract(
      current.windowScroll,
      initial.windowScroll,
    );
    // diff between the current scroll position and the initial
    const currentDiff: Position = subtract(
      windowScroll,
      initial.windowScroll,
    );
    // diff required to move from previous diff to new diff
    const diff: Position = subtract(currentDiff, previousDiff);
    // move the page coordinate by that amount
    const page: Position = add(current.page.selection, diff);

    return move({
      state,
      clientSelection: client,
      pageSelection: page,
      windowScroll,
    });
  }

  if (action.type === 'MOVE_FORWARD' || action.type === 'MOVE_BACKWARD') {
    if (state.phase !== 'DRAGGING') {
      console.error('cannot move while not dragging', action);
      return clean();
    }

    if (!state.drag) {
      console.error('cannot move if there is no drag information');
      return clean();
    }

    const existing: DragState = state.drag;

    if (!existing.impact.destination) {
      console.warn('cannot move forward when there is not previous location');
      return state;
    }

    const isMovingForward: boolean = action.type === 'MOVE_FORWARD';

    const diff: ?Position = getDiffToJumpToNextIndex({
      isMovingForward,
      draggableId: existing.current.id,
      location: existing.impact.destination,
      draggables: state.dimension.draggable,
      droppables: state.dimension.droppable,
    });

    // cannot move anyway (at the beginning or end of a list)
    if (!diff) {
      return state;
    }

    const page: Position = add(existing.current.page.selection, diff);
    const client: Position = add(existing.current.client.selection, diff);

    // current limitation: cannot go beyond visible border of list
    const droppableId: ?DroppableId = getDroppableOver(
      page, state.dimension.droppable,
    );

    if (!droppableId) {
      // eslint-disable-next-line no-console
      console.info('currently not supporting moving a draggable outside the visibility bounds of a droppable');
      return state;
    }

    return move({
      state,
      clientSelection: client,
      pageSelection: page,
      shouldAnimate: true,
    });
  }

  if (action.type === 'DROP_ANIMATE') {
    const { newHomeOffset, result } = action.payload;

    if (state.phase !== 'DRAGGING') {
      console.error('cannot animate drop while not dragging', action);
      return state;
    }

    if (!state.drag) {
      console.error('cannot animate drop - invalid drag state');
      return clean();
    }

    const pending: PendingDrop = {
      newHomeOffset,
      result,
      last: state.drag,
    };

    return {
      phase: 'DROP_ANIMATING',
      drag: null,
      drop: {
        pending,
        result: null,
      },
      dimension: state.dimension,
    };
  }

  if (action.type === 'DROP_COMPLETE') {
    const result: DropResult = action.payload;

    return {
      phase: 'DROP_COMPLETE',
      drag: null,
      drop: {
        pending: null,
        result,
      },
      dimension: noDimensions,
    };
  }

  if (action.type === 'CANCEL') {
    return clean();
  }

  return state;
};

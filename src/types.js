// @flow
import type { Store as ReduxStore, Dispatch as ReduxDispatch } from 'redux';
import type { Action as ActionCreators } from './state/action-creators';

export type Id = string;
export type DraggableId = Id;
export type DroppableId = Id;
export type TypeId = Id;
export type ZIndex = number | string;

export type DroppableDescriptor = {|
  id: DroppableId,
  type: TypeId,
|}

export type DraggableDescriptor = {|
  id: DraggableId,
  droppableId: DroppableId,
  index: number,
|}

export type Position = {|
  x: number,
  y: number,
|};

// Kept as a loose type so that functions can
// accept Spacing and receive an Area or a Spacing
export type Spacing = {
  top: number,
  right: number,
  bottom: number,
  left: number,
}

export type Area = {|
  top: number,
  right: number,
  bottom: number,
  left: number,
  // additions to Spacing
  width: number,
  height: number,
  center: Position,
|}

export type Direction = 'horizontal' | 'vertical';

export type VerticalAxis = {|
  direction: 'vertical',
  line: 'y',
  start: 'top',
  end: 'bottom',
  size: 'height',
  crossAxisLine: 'x',
  crossAxisStart: 'left',
  crossAxisEnd: 'right',
  crossAxisSize: 'width',
|}

export type HorizontalAxis = {|
  direction: 'horizontal',
  line: 'x',
  start: 'left',
  end: 'right',
  size: 'width',
  crossAxisLine: 'y',
  crossAxisStart: 'top',
  crossAxisEnd: 'bottom',
  crossAxisSize: 'height',
|}

export type Axis = VerticalAxis | HorizontalAxis

export type Placeholder = {|
  // We apply the margin separately to maintain margin collapsing
  // behavior of the original element
  borderBox: Area,
  margin: Spacing,
  tagName: string,
  display: string,
|}

export type DraggableDimension = {|
  descriptor: DraggableDescriptor,
  // the placeholder for the draggable
  placeholder: Placeholder,
  // relative to the viewport when the drag started
  client: {|
    marginBox: Area,
    borderBox: Area,
  |},
  // relative to the whole page
  page: {|
    marginBox: Area,
    borderBox: Area,
  |},
|}

export type ClosestScrollable = {|
  // This is the window through which the droppable is observed
  // It does not change during a drag
  frame: Area,
  // Whether or not we should clip the subject by the frame
  // Is controlled by the ignoreContainerClipping prop
  shouldClipSubject: boolean,
  scroll: {|
    initial: Position,
    current: Position,
    // the maximum allowable scroll for the frame
    max: Position,
    diff: {|
      value: Position,
      // The actual displacement as a result of a scroll is in the opposite
      // direction to the scroll itself. When scrolling down items are displaced
      // upwards. This value is the negated version of the 'value'
      displacement: Position,
    |}
  |}
|}

export type DroppableDimensionViewport = {|
  // will be null if there is no closest scrollable
  closestScrollable: ?ClosestScrollable,
  subject: Area,
  // this is the subject through the viewport of the frame (if applicable)
  // it also takes into account any changes to the viewport scroll
  // clipped area will be null if it is completely outside of the frame and frame clipping is on
  clipped: ?Area,
|}

/*
# The CSS box model
> https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Box_Model/Introduction_to_the_CSS_box_model

------------------------------------
|              MARGIN              |  (marginBox)
|  ------------------------------  |
|  |           BORDER           |  |  (borderBox)
|  |  ------------------------  |  |
|  |  |       PADDING        |  |  |  (paddingBox) - not used by anything really
|  |  |  ------------------  |  |  |
|  |  |  |    CONTENT     |  |  |  |  (contentBox)
|  |  |  |                |  |  |  |
|  |  |  |                |  |  |  |
|  |  |  |                |  |  |  |
|  |  |  ------------------  |  |  |
|  |  |                      |  |  |
|  |  ------------------------  |  |
|  |                            |  |
|  ------------------------------  |
|                                  |
|----------------------------------|

Example (https://codepen.io/alexreardon/pen/oqRBEq)
- width: 100px;
- padding: 10px;
- border: 5px;

## box-sizing: content-box;

Any 'width' property is set on the contextBox and padding and border is adding on top

So the borderBox width would be 130px (border: 5px * 2 + padding: 10px * 2 + content 100px)

## box-sizing: border-box;

Any 'width' property is set on the borderBox

So the borderBox width would be 100px and the contentBox would be 70px
100 - (border: 5px * 2 + padding: 10px * 2)

## Element.getBoundingClientRect()

This always returns the borderBox sizes, regardless of box-sizing.
- for content-box with would be 130px
- for border-box it would be 100px
*/

export type BoxModel = {|
  // the borderBox with margin added (outer)
  marginBox: Area,
  // the element inclusive of padding and border
  borderBox: Area,
  // the element without margin or padding or border (inner)
  contentBox: Area,
|}

export type DroppableDimension = {|
  descriptor: DroppableDescriptor,
  axis: Axis,
  isEnabled: boolean,
  // relative to the current viewport
  client: BoxModel,
  // relative to the whole page
  page: BoxModel,
  // The container of the droppable
  viewport: DroppableDimensionViewport,
|}
export type DraggableLocation = {|
  droppableId: DroppableId,
  index: number
|};

export type DraggableDimensionMap = { [key: DraggableId]: DraggableDimension };
export type DroppableDimensionMap = { [key: DroppableId]: DroppableDimension };

export type Displacement = {|
  draggableId: DraggableId,
  isVisible: boolean,
  shouldAnimate: boolean,
|}

export type DragMovement = {|
  // The draggables that need to move in response to a drag.
  // Ordered by closest draggable to the *current* location of the dragging item
  displaced: Displacement[],
  amount: Position,
  // is moving forward relative to the starting position
  // TODO: rename to 'shouldDisplaceForward'?
  isBeyondStartPosition: boolean,
|}

export type DragImpact = {|
  movement: DragMovement,
  // the direction of the Droppable you are over
  direction: ?Direction,
  destination: ?DraggableLocation,
|}

export type InitialDragPositions = {|
  // where the user initially selected
  selection: Position,
  // the current center of the item
  center: Position,
|}

// When dragging with a pointer such as a mouse or touch input we want to automatically
// scroll user the under input when we get near the bottom of a Droppable or the window.
// When Dragging with a keyboard we want to jump as required
export type AutoScrollMode = 'FLUID' | 'JUMP';

export type Viewport = {|
  scroll: Position,
  maxScroll: Position,
  subject: Area,
|}

export type InitialDrag = {|
  descriptor: DraggableDescriptor,
  autoScrollMode: AutoScrollMode,
  // relative to the viewport when the drag started
  client: InitialDragPositions,
  // viewport + window scroll (position relative to 0, 0)
  page: InitialDragPositions,
  // Storing viewport directly to support movement during a window scroll.
  // Value required for comparison with current scroll
  viewport: Viewport,
|}

export type CurrentDragPositions = {|
  ...InitialDragPositions,
  // how far the item has moved from its original position
  offset: Position,
|}

export type CurrentDrag = {|
  // viewport
  client: CurrentDragPositions,
  // viewport + scroll
  page: CurrentDragPositions,
  // whether or not draggable movements should be animated
  shouldAnimate: boolean,
  // We do not want to calculate drag impacts until we have completed
  // the first bulk publish. Otherwise the onDragUpdate hook will
  // be called with incorrect indexes.
  // Before the first bulk publish the calculations will return incorrect indexes.
  hasCompletedFirstBulkPublish: boolean,
  viewport: Viewport
|}

// published when a drag starts
export type DragStart = {|
  draggableId: DraggableId,
  type: TypeId,
  source: DraggableLocation,
|}

export type DragUpdate = {|
  ...DragStart,
  // may not have any destination (drag to nowhere)
  destination: ?DraggableLocation,
|}

export type DropReason = 'DROP' | 'CANCEL';

// published when a drag finishes
export type DropResult = {|
  ...DragUpdate,
  reason: DropReason,
|}

export type DragState = {|
  initial: InitialDrag,
  current: CurrentDrag,
  impact: DragImpact,
  // if we need to jump the scroll (keyboard dragging)
  scrollJumpRequest: ?Position,
|}

export type PendingDrop = {|
  newHomeOffset: Position,
  impact: DragImpact,
  result: DropResult,
|}

export type Phase =
  // The application rest state
  'IDLE' |

  // When a drag starts we need to flush any existing animations
  // that might be occurring. While this flush is occurring we
  // are in this phase
  'PREPARING' |

  // After the animations have been flushed we need to collect the
  // dimensions of all of the Draggable and Droppable components.
  // At this point a drag has not started yet and the onDragStart
  // hook has not fired.
  'COLLECTING_INITIAL_DIMENSIONS' |

  // A drag is active. The onDragStart hook has been fired
  'DRAGGING' |

  // An optional phase for animating the drop / cancel if it is needed
  'DROP_ANIMATING' |

  // The final state of a drop / cancel.
  // This will result in the onDragEnd hook being fired
  'DROP_COMPLETE';

export type ScrollOptions = {|
  shouldPublishImmediately: boolean,
|}

export type LiftRequest = {|
  draggableId: DraggableId,
  scrollOptions: ScrollOptions,
|}

export type DimensionState = {|
  // using the draggable id rather than the descriptor as the descriptor
  // may change as a result of the initial flush. This means that the lift
  // descriptor may not be the same as the actual descriptor. To avoid
  // confusion the request is just an id which is looked up
  // in the dimension-marshal post-flush
  request: ?LiftRequest,
  draggable: DraggableDimensionMap,
  droppable: DroppableDimensionMap,
|};

export type DropState = {|
  pending: ?PendingDrop,
  result: ?DropResult,
|}

export type State = {|
  phase: Phase,
  dimension: DimensionState,
  // null if not dragging
  drag: ?DragState,

  // available when dropping or cancelling
  drop: ?DropState,
|};

export type Action = ActionCreators;
export type Dispatch = ReduxDispatch<Action>;
export type Store = ReduxStore<State, Action, Dispatch>;

export type Announce = (message: string) => void;

export type HookProvided = {|
  announce: Announce,
|}

export type OnDragStartHook = (start: DragStart, provided: HookProvided) => void;
export type OnDragUpdateHook = (update: DragUpdate, provided: HookProvided) => void;
export type OnDragEndHook = (result: DropResult, provided: HookProvided) => void;

export type Hooks = {|
  onDragStart?: OnDragStartHook,
  onDragUpdate?: OnDragUpdateHook,
  // always required
  onDragEnd: OnDragEndHook,
|}


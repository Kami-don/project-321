// @flow
import type {
  DragMovement,
  DraggableDimension,
  DroppableDimension,
  DragImpact,
  Axis,
  Position,
  Displacement,
  Area,
} from '../../types';
import { patch } from '../position';
import getDisplacement from '../get-displacement';
import getViewport from '../../window/get-viewport';
import withDroppableScroll from '../with-droppable-scroll';

type Args = {|
  pageCenter: Position,
  draggable: DraggableDimension,
  destination: DroppableDimension,
  insideDestination: DraggableDimension[],
  previousImpact: DragImpact,
|}

export default ({
  pageCenter,
  draggable,
  destination,
  insideDestination,
  previousImpact,
}: Args): DragImpact => {
  const axis: Axis = destination.axis;
  const viewport: Area = getViewport();

  // We need to know what point to use to compare to the other
  // draggables in the list.
  // To do this we need to consider any displacement caused by
  // a change in scroll in the droppable we are currently over.

  const currentCenter: Position = withDroppableScroll(destination, pageCenter);

  const displaced: Displacement[] = insideDestination
    .filter((child: DraggableDimension): boolean => {
      // Items will be displaced forward if they sit ahead of the dragging item
      const threshold: number = child.page.withoutMargin[axis.end];
      return threshold > currentCenter[axis.line];
    })
    .map((dimension: DraggableDimension): Displacement => getDisplacement({
      draggable: dimension,
      destination,
      previousImpact,
      viewport,
    }));

  const newIndex: number = insideDestination.length - displaced.length;

  const movement: DragMovement = {
    amount: patch(axis.line, draggable.page.withMargin[axis.size]),
    displaced,
    isBeyondStartPosition: false,
  };

  const impact: DragImpact = {
    movement,
    direction: axis.direction,
    destination: {
      droppableId: destination.descriptor.id,
      index: newIndex,
    },
  };

  return impact;
};

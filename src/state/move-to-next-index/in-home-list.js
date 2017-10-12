// @flow
import memoizeOne from 'memoize-one';
import getDraggablesInsideDroppable from '../get-draggables-inside-droppable';
import { isPointWithinDroppable } from '../is-within-visible-bounds-of-droppable';
import { patch } from '../position';
import moveToEdge from '../move-to-edge';
import type { Edge } from '../move-to-edge';
import type { Args, Result } from './move-to-next-index-types';
import type {
  DraggableLocation,
  DraggableDimension,
  Position,
  DraggableId,
  Axis,
  DragImpact,
} from '../../types';

const getIndex = memoizeOne(
  (draggables: DraggableDimension[],
    target: DraggableDimension
  ): number => draggables.indexOf(target)
);

export default ({
  isMovingForward,
  draggableId,
  impact,
  droppable,
  draggables,
}: Args): ?Result => {
  if (!impact.destination) {
    console.error('cannot move to next index when there is not previous destination');
    return null;
  }

  const location: DraggableLocation = impact.destination;
  const draggable: DraggableDimension = draggables[draggableId];
  const axis: Axis = droppable.axis;

  const insideDroppable: DraggableDimension[] = getDraggablesInsideDroppable(
    droppable,
    draggables,
  );

  const startIndex: number = getIndex(insideDroppable, draggable);
  const currentIndex: number = location.index;
  const proposedIndex = isMovingForward ? currentIndex + 1 : currentIndex - 1;

  if (startIndex === -1) {
    console.error('could not find draggable inside current droppable');
    return null;
  }

  // cannot move forward beyond the last item
  if (proposedIndex > insideDroppable.length - 1) {
    return null;
  }

  // cannot move before the first item
  if (proposedIndex < 0) {
    return null;
  }

  const destination: DraggableDimension = insideDroppable[proposedIndex];
  const isMovingTowardStart = (isMovingForward && proposedIndex <= startIndex) ||
    (!isMovingForward && proposedIndex >= startIndex);

  const edge: Edge = (() => {
    // is moving away from the start
    if (!isMovingTowardStart) {
      return isMovingForward ? 'end' : 'start';
    }
    // is moving back towards the start
    return isMovingForward ? 'start' : 'end';
  })();

  const newCenter: Position = moveToEdge({
    source: draggable.page.withoutMargin,
    sourceEdge: edge,
    destination: destination.page.withoutMargin,
    destinationEdge: edge,
    destinationAxis: droppable.axis,
  });

  // Currently not supporting moving a draggable outside the visibility bounds of a droppable
  const isVisible: boolean = isPointWithinDroppable(droppable)(newCenter);

  if (!isVisible) {
    return null;
  }

  // Calculate DragImpact

  // List is sorted where the items closest to where the draggable is currently go first
  const moved: DraggableId[] = isMovingTowardStart ?
    // remove the most recently impacted
    impact.movement.draggables.slice(1, impact.movement.draggables.length) :
    // add the destination as the most recently impacted
    [destination.id, ...impact.movement.draggables];

  const newImpact: DragImpact = {
    movement: {
      draggables: moved,
      // The amount of movement will always be the size of the dragging item
      amount: patch(axis.line, draggable.page.withMargin[axis.size]),
      isBeyondStartPosition: proposedIndex > startIndex,
    },
    destination: {
      droppableId: droppable.id,
      index: proposedIndex,
    },
    direction: droppable.axis.direction,
  };

  const result: Result = {
    pageCenter: newCenter,
    impact: newImpact,
  };

  return result;
};

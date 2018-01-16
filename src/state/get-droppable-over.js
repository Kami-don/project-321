// @flow
import memoizeOne from 'memoize-one';
import getArea from './get-area';
import getDraggablesInsideDroppable from './get-draggables-inside-droppable';
import isPositionInFrame from './visibility/is-position-in-frame';
import { patch } from './position';
import { addPosition } from './spacing';
import { clip } from './dimension';
import type {
  DraggableDimension,
  DraggableDimensionMap,
  DroppableDimension,
  DroppableDimensionMap,
  DroppableId,
  Position,
  Area,
} from '../types';

const getRequiredGrowth = memoizeOne((
  draggable: DraggableDimension,
  draggables: DraggableDimensionMap,
  droppable: DroppableDimension,
): ?Position => {
  // We can't always simply add the placeholder size to the droppable size.
  // If a droppable has a min-height there will be scenarios where it has
  // some items in it, but not enough to completely fill its size.
  // In this case - when the droppable already contains excess space - we
  // don't need to add the full placeholder size.

  const getResult = (existingSpace: number): ?Position => {
    // this is the space required for a placeholder
    const requiredSpace: number = draggable.page.withMargin[droppable.axis.size];

    if (requiredSpace <= existingSpace) {
      return null;
    }
    const requiredGrowth: Position = patch(droppable.axis.line, requiredSpace - existingSpace);

    return requiredGrowth;
  };

  const dimensions: DraggableDimension[] = getDraggablesInsideDroppable(droppable, draggables);

  // Droppable is empty
  if (!dimensions.length) {
    const existingSpace: number = droppable.page.withMargin[droppable.axis.size];
    return getResult(existingSpace);
  }

  // Droppable has items in it

  const endOfDraggables: number =
    dimensions[dimensions.length - 1].page.withMargin[droppable.axis.end];
  const endOfDroppable: number = droppable.page.withMargin[droppable.axis.end];
  const existingSpace: number = endOfDroppable - endOfDraggables;

  return getResult(existingSpace);
});

type GetBufferedDroppableArgs = {
  draggable: DraggableDimension,
  draggables: DraggableDimensionMap,
  droppable: DroppableDimension,
  previousDroppableOverId: ?DroppableId,
};

const getWithGrowth = memoizeOne(
  (area: Area, growth: Position): Area => getArea(addPosition(area, growth))
);

const getClippedAreaWithPlaceholder = ({
  draggable,
  draggables,
  droppable,
  previousDroppableOverId,
}: GetBufferedDroppableArgs): ?Area => {
  const isHome: boolean = draggable.descriptor.droppableId === droppable.descriptor.id;
  const wasOver: boolean = Boolean(
    previousDroppableOverId &&
    previousDroppableOverId === droppable.descriptor.id
  );
  const subject: Area = droppable.viewport.subject;
  const frame: Area = droppable.viewport.frame;
  const clipped: ?Area = droppable.viewport.clipped;

  // clipped area is totally hidden behind frame
  if (!clipped) {
    return clipped;
  }

  // We only include the placeholder size if it's a
  // foreign list and is currently being hovered over
  if (isHome || !wasOver) {
    return clipped;
  }

  const requiredGrowth: ?Position = getRequiredGrowth(draggable, draggables, droppable);

  if (!requiredGrowth) {
    return clipped;
  }

  const isClippedByFrame: boolean = subject[droppable.axis.size] !== frame[droppable.axis.size];

  const subjectWithGrowth = getWithGrowth(clipped, requiredGrowth);

  if (!isClippedByFrame) {
    return subjectWithGrowth;
  }

  // We need to clip the new subject by the frame which does not change
  // This will allow the user to continue to scroll into the placeholder
  return clip(frame, subjectWithGrowth);
};

type Args = {|
  target: Position,
  draggable: DraggableDimension,
  draggables: DraggableDimensionMap,
  droppables: DroppableDimensionMap,
  previousDroppableOverId: ?DroppableId,
|};

export default ({
  target,
  draggable,
  draggables,
  droppables,
  previousDroppableOverId,
}: Args): ?DroppableId => {
  const maybe: ?DroppableDimension =
    Object.keys(droppables)
      .map((id: DroppableId): DroppableDimension => droppables[id])
      // only want enabled droppables
      .filter((droppable: DroppableDimension) => droppable.isEnabled)
      .find((droppable: DroppableDimension): boolean => {
        // If previously dragging over a droppable we give it a
        // bit of room on the subsequent drags so that user and move
        // items in the space that the placeholder takes up
        const withPlaceholder: ?Area = getClippedAreaWithPlaceholder({
          draggable, draggables, droppable, previousDroppableOverId,
        });

        if (!withPlaceholder) {
          return false;
        }

        // Not checking to see if visible in viewport
        // as the target might be off screen if dragging a large draggable
        // Not adjusting target for droppable scroll as we are just checking
        // if it is over the droppable - not its internal impact
        return isPositionInFrame(withPlaceholder)(target);
      });

  return maybe ? maybe.descriptor.id : null;
};

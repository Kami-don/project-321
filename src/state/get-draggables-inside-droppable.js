// @flow
import memoizeOne from 'memoize-one';
import type { DraggableDimension, DroppableDimension, DraggableDimensionMap, Id } from '../types';

export default memoizeOne(
  (droppableDimension: DroppableDimension,
    draggableDimensions: DraggableDimensionMap,
  ): DraggableDimension[] =>
    Object.keys(draggableDimensions)
      .map((key: Id): DraggableDimension => draggableDimensions[key])
      .filter((dimension: DraggableDimension): boolean =>
        dimension.droppableId === droppableDimension.id,
      )
      // Dimensions are not guarenteed to be ordered in the same order as keys
      // So we need to sort them so they are in the correct order
      .sort((a: DraggableDimension, b: DraggableDimension): number =>
        a.page.withoutMargin.center.y -
        b.page.withoutMargin.center.y,
      ),
);

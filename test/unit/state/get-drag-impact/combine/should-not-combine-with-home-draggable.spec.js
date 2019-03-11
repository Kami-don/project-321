// @flow
import type {
  Axis,
  DragImpact,
  DroppableDimensionMap,
} from '../../../../../src/types';
import { horizontal, vertical } from '../../../../../src/state/axis';
import getDragImpact from '../../../../../src/state/get-drag-impact';
import getHomeOnLift from '../../../../../src/state/get-home-on-lift';
import { forward } from '../../../../../src/state/user-direction/user-direction-preset';
import { enableCombining, getPreset } from '../../../../utils/dimension';

[vertical, horizontal].forEach((axis: Axis) => {
  describe(`on ${axis.direction} axis`, () => {
    const preset = getPreset(axis);

    it('should not allow combining with the dragging item', () => {
      const { onLift, impact: homeImpact } = getHomeOnLift({
        draggable: preset.inHome1,
        home: preset.home,
        draggables: preset.draggables,
        viewport: preset.viewport,
      });
      const withCombineEnabled: DroppableDimensionMap = enableCombining(
        preset.droppables,
      );

      // from the home impact

      const impact: DragImpact = getDragImpact({
        pageBorderBoxCenter: preset.inHome1.page.borderBox.center,
        draggable: preset.inHome1,
        draggables: preset.draggables,
        droppables: withCombineEnabled,
        previousImpact: homeImpact,
        viewport: preset.viewport,
        userDirection: forward,
        onLift,
      });
      expect(impact).toEqual(homeImpact);
    });
  });
});

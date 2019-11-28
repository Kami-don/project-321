// @flow
import type { Position } from 'css-box-model';
import type { Axis } from '../../src/types';
import { subtract, patch } from '../../src/state/position';

export default (axis: Axis, point: Position): Position =>
  subtract(point, patch(axis.line, 1));

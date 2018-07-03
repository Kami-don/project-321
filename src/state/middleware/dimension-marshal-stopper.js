// @flow
import type { Action } from '../store-types';
import type { DimensionMarshal } from '../dimension-marshal/dimension-marshal-types';

export default (getMarshal: () => DimensionMarshal) => () => (
  next: Action => mixed,
) => (action: Action): mixed => {
  // Not stopping a collection on a 'DROP' as we want that collection to continue
  if (
    action.type === 'DROP_COMPLETE' ||
    action.type === 'CLEAN' ||
    action.type === 'DROP_ANIMATE'
  ) {
    const marshal: DimensionMarshal = getMarshal();
    marshal.stopPublishing();
  }

  next(action);
};

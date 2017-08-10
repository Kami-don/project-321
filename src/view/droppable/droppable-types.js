// @flow
/* eslint-disable import/no-extraneous-dependencies */
// $ExpectError - not added to project deps
import type { HasDefaultProp } from 'babel-plugin-react-flow-props-to-prop-types';
/* eslint-enable */
import type { DroppableId, TypeId, ReactElement, HTMLElement } from '../../types';

export type Provided = {|
  innerRef: (HTMLElement) => void,
|}

export type StateSnapshot = {|
  isDraggingOver: boolean,
|}

export type MapProps = {|
  isDraggingOver: boolean,
|}

export type OwnProps = {|
  droppableId: DroppableId,
  isDropDisabled: HasDefaultProp<boolean>,
  type: HasDefaultProp<TypeId>,
  children: (Provided, StateSnapshot) => ?ReactElement
|};

export type DefaultProps = {|
  isDropDisabled: boolean,
  type: TypeId
|}

export type Props = OwnProps & MapProps;

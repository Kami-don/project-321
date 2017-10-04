// @flow
import { vertical, horizontal } from './axis';
import getClientRect from './get-client-rect';
import { add, isEqual } from './spacing';
import type {
  DroppableId,
  DraggableId,
  Position,
  DraggableDimension,
  DroppableDimension,
  Direction,
  DimensionFragment,
  Spacing,
  ClientRect,
} from '../types';

const origin: Position = { x: 0, y: 0 };

export const noSpacing: Spacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const getWithPosition = (clientRect: ClientRect, point: Position): ClientRect => {
  const { top, right, bottom, left } = clientRect;
  return getClientRect({
    top: top + point.y,
    left: left + point.x,
    bottom: bottom + point.y,
    right: right + point.x,
  });
};

const getWithSpacing = (clientRect: ClientRect, spacing: Spacing): ClientRect => {
  const { top, right, bottom, left } = clientRect;
  return getClientRect({
    top: top - spacing.top,
    left: left - spacing.left,
    bottom: bottom + spacing.bottom,
    right: right + spacing.right,
  });
};

export const getFragment = (
  initial: ClientRect | DimensionFragment,
  point?: Position = origin,
): DimensionFragment => {
  const rect: ClientRect = getClientRect({
    top: initial.top + point.y,
    left: initial.left + point.x,
    bottom: initial.bottom + point.y,
    right: initial.right + point.x,
  });

  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    center: {
      x: (rect.right + rect.left) / 2,
      y: (rect.bottom + rect.top) / 2,
    },
  };
};

type GetDraggableArgs = {|
  id: DraggableId,
  droppableId: DroppableId,
  clientRect: ClientRect,
  margin?: Spacing,
  windowScroll?: Position,
|};

export const getDraggableDimension = ({
  id,
  droppableId,
  clientRect,
  margin = noSpacing,
  windowScroll = origin,
}: GetDraggableArgs): DraggableDimension => {
  const withScroll = getWithPosition(clientRect, windowScroll);

  const dimension: DraggableDimension = {
    id,
    droppableId,
    // on the viewport
    client: {
      withoutMargin: getFragment(clientRect),
      withMargin: getFragment(getWithSpacing(clientRect, margin)),
    },
    // with scroll
    page: {
      withoutMargin: getFragment(withScroll),
      withMargin: getFragment(getWithSpacing(withScroll, margin)),
    },
  };

  return dimension;
};

type GetDroppableArgs = {|
  id: DroppableId,
  clientRect: ClientRect,
  containerRect?: ClientRect,
  direction?: Direction,
  margin?: Spacing,
  padding?: Spacing,
  windowScroll?: Position,
  scroll ?: Position,
  // Whether or not the droppable is currently enabled (can change at during a drag)
  // defaults to true
  isEnabled?: boolean,
|}

export const getDroppableDimension = ({
  id,
  clientRect,
  containerRect,
  direction = 'vertical',
  margin = noSpacing,
  padding = noSpacing,
  windowScroll = origin,
  scroll = origin,
  isEnabled = true,
}: GetDroppableArgs): DroppableDimension => {
  const withMargin = getWithSpacing(clientRect, margin);
  const withWindowScroll = getWithPosition(clientRect, windowScroll);
  // If no containerRect is provided, or if the clientRect matches the containerRect, this
  // droppable is its own container. In this case we include its margin in the container bounds.
  // Otherwise, the container is a scrollable parent. In this case we don't care about margins
  // in the container bounds.
  const containerRectWithWindowScroll: ClientRect =
    !containerRect || isEqual(containerRect, clientRect)
      ? getWithPosition(withMargin, windowScroll)
      : getWithPosition(containerRect, windowScroll);

  const dimension: DroppableDimension = {
    id,
    isEnabled,
    axis: direction === 'vertical' ? vertical : horizontal,
    client: {
      withoutMargin: getFragment(clientRect),
      withMargin: getFragment(withMargin),
      withMarginAndPadding: getFragment(getWithSpacing(withMargin, padding)),
    },
    page: {
      withoutMargin: getFragment(withWindowScroll),
      withMargin: getFragment(getWithSpacing(withWindowScroll, margin)),
      withMarginAndPadding: getFragment(getWithSpacing(withWindowScroll, add(margin, padding))),
    },
    container: {
      scroll: {
        initial: scroll,
        // when we start the current scroll is the initial scroll
        current: scroll,
      },
      bounds: getFragment(containerRectWithWindowScroll),
    },
  };

  return dimension;
};

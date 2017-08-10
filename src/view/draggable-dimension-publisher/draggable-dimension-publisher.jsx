// @flow
import { Component } from 'react';
import invariant from 'invariant';
import getWindowScrollPosition from '../get-window-scroll-position';
import { getDraggableDimension } from '../../state/dimension';
// eslint-disable-next-line no-duplicate-imports
import type { Margin } from '../../state/dimension';
import type { DraggableDimension } from '../../types';
import type { Props } from './draggable-dimension-publisher-types';

export default class DraggableDimensionPublisher extends Component {
  /* eslint-disable react/sort-comp */
  props: Props;

  getDimension = (): DraggableDimension => {
    const {
      draggableId,
      droppableId,
      targetRef,
    } = this.props;

    invariant(targetRef, 'DraggableDimensionPublisher cannot calculate a dimension when not attached to the DOM');

    const style = window.getComputedStyle(targetRef);

    const margin: Margin = {
      top: parseInt(style.marginTop, 10),
      right: parseInt(style.marginRight, 10),
      bottom: parseInt(style.marginBottom, 10),
      left: parseInt(style.marginLeft, 10),
    };

    const dimension: DraggableDimension = getDraggableDimension({
      id: draggableId,
      droppableId,
      clientRect: targetRef.getBoundingClientRect(),
      margin,
      windowScroll: getWindowScrollPosition(),
    });

    return dimension;
  }

  /* eslint-enable react/sort-comp */

  // TODO: componentDidUpdate?
  componentWillReceiveProps(nextProps: Props) {
    // Because the dimension publisher wraps children - it might render even when its props do
    // not change. We need to ensure that it does not publish when it should not.
    const shouldPublish = !this.props.shouldPublish && nextProps.shouldPublish;

    if (shouldPublish) {
      this.props.publish(this.getDimension());
    }
  }

  render() {
    return this.props.children;
  }
}

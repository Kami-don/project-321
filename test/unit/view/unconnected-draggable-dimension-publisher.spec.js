// @flow
import React, { Component } from 'react';
import { mount } from 'enzyme';
import DraggableDimensionPublisher from '../../../src/view/draggable-dimension-publisher/draggable-dimension-publisher';
import { getDraggableDimension } from '../../../src/state/dimension';
// eslint-disable-next-line no-duplicate-imports
import type { ClientRect, Margin } from '../../../src/state/dimension';
import getClientRect from '../../utils/get-client-rect';
import setWindowScroll from '../../utils/set-window-scroll';
import type {
  Position,
  DraggableId,
  DroppableId,
  DraggableDimension,
  HTMLElement,
} from '../../../src/types';

const draggableId: DraggableId = 'drag-1';
const droppableId: DroppableId = 'drop-1';
const dimension: DraggableDimension = getDraggableDimension({
  id: draggableId,
  droppableId,
  clientRect: getClientRect({
    top: 0,
    right: 100,
    bottom: 100,
    left: 0,
  }),
});

const noComputedMargin = {
  marginTop: '0',
  marginRight: '0',
  marginBottom: '0',
  marginLeft: '0',
};

class Item extends Component {
  /* eslint-disable react/sort-comp */
  props: {
    publish: (dimension: DraggableDimension) => void,
    shouldPublish?: boolean,
  }

  state: {|
    ref: ?HTMLElement
  |}

  state = {
    ref: null,
  }

  setRef = (ref: ?HTMLElement) => {
    this.setState({
      ref,
    });
  }

  render() {
    return (
      // $ExpectError - for an unknown reason flow is having a hard time with this
      <DraggableDimensionPublisher
        draggableId={draggableId}
        droppableId={droppableId}
        type="TYPE"
        targetRef={this.state.ref}
        shouldPublish={Boolean(this.props.shouldPublish)}
        publish={this.props.publish}
      >
        <div ref={this.setRef}>hi</div>
      </DraggableDimensionPublisher>
    );
  }
}

describe('DraggableDimensionPublisher', () => {
  afterEach(() => {
    // clean up any stubs
    if (Element.prototype.getBoundingClientRect.mockRestore) {
      Element.prototype.getBoundingClientRect.mockRestore();
    }
    if (window.getComputedStyle.mockRestore) {
      window.getComputedStyle.mockRestore();
    }
  });

  it('should not publish if not asked to', () => {
    const publish = jest.fn();
    const wrapper = mount(<Item publish={publish} />);

    wrapper.setProps({
      shouldPublish: false,
    });

    expect(publish).not.toHaveBeenCalled();
  });

  it('should publish the dimensions of the target', () => {
    const publish = jest.fn();
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      top: dimension.page.withoutMargin.top,
      bottom: dimension.page.withoutMargin.bottom,
      left: dimension.page.withoutMargin.left,
      right: dimension.page.withoutMargin.right,
      height: dimension.page.withoutMargin.height,
      width: dimension.page.withoutMargin.width,
    }));
    jest.spyOn(window, 'getComputedStyle').mockImplementation(() => noComputedMargin);

    const wrapper = mount(<Item publish={publish} />);
    wrapper.setProps({
      shouldPublish: true,
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toBeCalledWith(dimension);
  });

  it('should consider any margins when calculating dimensions', () => {
    const margin: Margin = {
      top: 10,
      right: 30,
      bottom: 40,
      left: 50,
    };
    const publish = jest.fn();
    const expected: DraggableDimension = getDraggableDimension({
      id: draggableId,
      droppableId,
      clientRect: getClientRect({
        top: 0,
        right: 100,
        bottom: 100,
        left: 0,
      }),
      margin,
    });
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      top: dimension.page.withoutMargin.top,
      bottom: dimension.page.withoutMargin.bottom,
      left: dimension.page.withoutMargin.left,
      right: dimension.page.withoutMargin.right,
      height: dimension.page.withoutMargin.height,
      width: dimension.page.withoutMargin.width,
    }));
    jest.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      marginTop: `${margin.top}`,
      marginRight: `${margin.right}`,
      marginBottom: `${margin.bottom}`,
      marginLeft: `${margin.left}`,
    }));

    const wrapper = mount(<Item publish={publish} />);
    wrapper.setProps({
      shouldPublish: true,
    });

    expect(publish).toBeCalledWith(expected);
  });

  it('should consider the window scroll when calculating dimensions', () => {
    const publish = jest.fn();
    const originalScroll: Position = {
      x: window.pageXOffset,
      y: window.pageYOffset,
    };
    const windowScroll: Position = {
      x: 100,
      y: 200,
    };
    const clientRect: ClientRect = getClientRect({
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
    });
    const expected: DraggableDimension = getDraggableDimension({
      id: draggableId,
      droppableId,
      clientRect,
      windowScroll,
    });
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => clientRect);
    jest.spyOn(window, 'getComputedStyle').mockImplementation(() => noComputedMargin);
    setWindowScroll(windowScroll);

    const wrapper = mount(<Item publish={publish} />);
    wrapper.setProps({
      shouldPublish: true,
    });

    expect(publish).toHaveBeenCalledWith(expected);

    setWindowScroll(originalScroll);
  });

  it('should not publish unless it is freshly required to do so', () => {
    const publish = jest.fn();
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      top: dimension.page.withMargin.top,
      bottom: dimension.page.withMargin.bottom,
      left: dimension.page.withMargin.left,
      right: dimension.page.withMargin.right,
      height: dimension.page.withMargin.height,
      width: dimension.page.withMargin.width,
    }));

    // initial publish
    const wrapper = mount(<Item publish={publish} />);
    wrapper.setProps({
      shouldPublish: true,
    });
    expect(publish).toHaveBeenCalledTimes(1);

    // should not publish if the props have not changed
    wrapper.update();
    expect(publish).toHaveBeenCalledTimes(1);

    // should publish when freshly required to do so
    wrapper.setProps({
      shouldPublish: false,
      publish,
    });
    wrapper.setProps({
      shouldPublish: true,
      publish,
    });
    expect(publish).toHaveBeenCalledTimes(2);
  });
});

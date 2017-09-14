// @flow
import { Component } from 'react';
import invariant from 'invariant';
import memoizeOne from 'memoize-one';
import rafSchedule from 'raf-schd';
// Using keyCode's for consistent event pattern matching between
// React synthetic events as well as raw browser events.
import * as keyCodes from '../key-codes';
import type { Position } from '../../types';
import type {
  Props,
  DragTypes,
  Provided,
  MouseForceChangedEvent,
} from './drag-handle-types';

const noop = (): void => { };
const getFalse: () => boolean = () => false;

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const primaryButton = 0;

// The amount of pixels that need to move before we consider the movement
// a drag rather than a click.
export const sloppyClickThreshold: number = 5;

type State = {
  draggingWith: ?DragTypes,
  pending: ?Position,
};

type ExecuteBasedOnDirection = {|
  vertical: () => void,
  horizontal: () => void,
|}

export default class DragHandle extends Component {
  /* eslint-disable react/sort-comp */

  props: Props
  state: State

  state: State = {
    draggingWith: null,
    pending: null,
  };

  preventClick: boolean

  ifDragging = (fn: Function) => {
    if (this.state.draggingWith) {
      fn();
    }
  }

  // There is a case where if this is fired between
  // two different drags with the same x,y then the second
  // drag will not fire a move. This will only effect the
  // first frame. It was decided that this is better than
  // needing to clear the memoization cache between drags
  // given that it is a huge edge case.
  memoizedMove = memoizeOne((x: number, y: number) => {
    const point: Position = { x, y };
    this.props.callbacks.onMove(point);
  });

  // scheduled functions
  scheduleMove = rafSchedule((point: Position) => {
    this.ifDragging(() => this.memoizedMove(point.x, point.y));
  });

  scheduleMoveForward = rafSchedule(() => {
    this.ifDragging(this.props.callbacks.onMoveForward);
  })

  scheduleMoveBackward = rafSchedule(() => {
    this.ifDragging(this.props.callbacks.onMoveBackward);
  });

  scheduleCrossAxisMoveForward = rafSchedule(() => {
    this.ifDragging(this.props.callbacks.onCrossAxisMoveForward);
  })

  scheduleCrossAxisMoveBackward = rafSchedule(() => {
    this.ifDragging(this.props.callbacks.onCrossAxisMoveBackward);
  });

  scheduleWindowScrollMove = rafSchedule(() => {
    this.ifDragging(this.props.callbacks.onWindowScroll);
  });
  /* eslint-enable react/sort-comp */

  componentWillUnmount() {
    if (!this.state.draggingWith) {
      return;
    }
    this.preventClick = false;
    this.unbindWindowEvents();
    this.props.callbacks.onCancel();
  }

  // TODO: there is a scenario where events will not be unbound:
  // - listeners are bound
  // - drag is cancelled during the COLLECTING_DIMENSION phase
  // FIX: need to know when a drag is cancelled / cleaned during the
  // COLLECTING_DIMENSIONS phase.
  componentWillReceiveProps(nextProps: Props) {
    // if the application cancels a drag we need to unbind the handlers
    const isDragStopping: boolean = (this.props.isDragging && !nextProps.isDragging);
    if (isDragStopping && this.state.draggingWith) {
      this.stopDragging();
      return;
    }

    if (nextProps.isEnabled) {
      return;
    }

    // dragging is *not* enabled

    // if a drag is pending - clear it
    if (this.state.pending) {
      this.stopPendingMouseDrag();
      return;
    }

    // need to cancel a current drag
    if (this.state.draggingWith) {
      this.stopDragging(() => this.props.callbacks.onCancel());
    }
  }

  onWindowResize = () => {
    if (this.state.pending) {
      this.stopPendingMouseDrag();
      return;
    }

    if (!this.state.draggingWith) {
      return;
    }

    this.stopDragging(() => this.props.callbacks.onCancel());
  }

  onWindowScroll = () => {
    const { draggingWith } = this.state;

    if (!draggingWith) {
      return;
    }

    if (draggingWith === 'MOUSE') {
      this.scheduleWindowScrollMove();
      return;
    }

    if (draggingWith === 'KEYBOARD') {
      // currently not supporting window scrolling with a keyboard
      this.stopDragging(() => this.props.callbacks.onCancel());
    }
  }

  onWindowMouseMove = (event: MouseEvent) => {
    const { draggingWith, pending } = this.state;
    if (draggingWith === 'KEYBOARD') {
      return;
    }

    // Mouse dragging

    const { button, clientX, clientY } = event;
    if (button !== primaryButton) {
      return;
    }

    const point: Position = {
      x: clientX,
      y: clientY,
    };

    if (!pending) {
      this.scheduleMove(point);
      return;
    }

    // not yet dragging
    const shouldStartDrag = Math.abs(pending.x - point.x) >= sloppyClickThreshold ||
                            Math.abs(pending.y - point.y) >= sloppyClickThreshold;

    if (shouldStartDrag) {
      this.startDragging('MOUSE', () => this.props.callbacks.onLift(point));
    }
  };

  onWindowMouseUp = () => {
    // Did not move far enough for it to actually be a drag
    if (this.state.pending) {
      // not blocking the default event - letting it pass through
      this.stopPendingMouseDrag();
      return;
    }

    if (!this.state.draggingWith) {
      console.error('should not be listening to mouse up events when nothing is dragging');
      return;
    }

    if (this.state.draggingWith !== 'MOUSE') {
      return;
    }

    // Allowing any event.button type to drop. Otherwise you
    // might not get a corresponding mouseup with a mousedown.
    // We could do a`cancel` if the button is not the primary.
    this.stopDragging(() => this.props.callbacks.onDrop());
  };

  onWindowMouseDown = () => {
    // this can happen during a drag when the user clicks a button
    // other than the primary mouse button
    this.stopDragging(() => this.props.callbacks.onCancel());
  }

  onMouseDown = (event: MouseEvent) => {
    if (this.state.draggingWith === 'KEYBOARD') {
      // allowing any type of mouse down to cancel
      this.stopDragging(() => this.props.callbacks.onCancel());
      return;
    }

    if (!this.props.canLift) {
      return;
    }

    const { button, clientX, clientY } = event;

    if (button !== primaryButton) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    const point: Position = {
      x: clientX,
      y: clientY,
    };

    this.startPendingMouseDrag(point);
  };

  executeBasedOnDirection = (fns: ExecuteBasedOnDirection) => {
    if (!this.props.direction) {
      console.error('cannot move based on direction when none is provided');
      this.stopDragging(() => this.props.callbacks.onCancel());
      return;
    }

    // eslint-disable-next-line no-unused-expressions
    this.props.direction === 'vertical' ? fns.vertical() : fns.horizontal();
  }

  // window keyboard events are bound during a keyboard drag
  // or after the user presses the mouse down
  onWindowKeydown = (event: KeyboardEvent): void => {
    const isMouseDragPending: boolean = Boolean(this.state.pending);

    if (isMouseDragPending) {
      if (event.keyCode === keyCodes.escape) {
        event.preventDefault();
        this.stopPendingMouseDrag();
      }
      return;
    }

    if (!this.state.draggingWith) {
      console.error('should not be listening to window mouse up if nothing is dragging');
      this.stopDragging(() => this.props.callbacks.onCancel());
      return;
    }

    // Dragging with either a keyboard or mouse

    // Blocking standard submission action
    if (event.keyCode === keyCodes.enter) {
      event.preventDefault();
      return;
    }

    // Preventing tabbing or submitting
    if (event.keyCode === keyCodes.tab) {
      event.preventDefault();
      return;
    }

    if (event.keyCode === keyCodes.escape) {
      event.preventDefault();
      this.stopDragging(() => this.props.callbacks.onCancel());
      return;
    }

    if (this.state.draggingWith === 'MOUSE') {
      // Want to block scrolling the page with the space bar
      if (event.keyCode === keyCodes.space) {
        event.preventDefault();
      }
      return;
    }

    // Only keyboard dragging
    if (!this.props.direction) {
      console.error('cannot handle keyboard event if direction is not provided');
      this.stopDragging(() => this.props.callbacks.onCancel());
      return;
    }

    // at this point we do not know what the direction is
    if (event.keyCode === keyCodes.space) {
      event.preventDefault();
      this.stopDragging(() => this.props.callbacks.onDrop());
      return;
    }

    if (event.keyCode === keyCodes.arrowDown) {
      event.preventDefault();
      this.executeBasedOnDirection({
        vertical: this.scheduleMoveForward,
        horizontal: this.scheduleCrossAxisMoveForward,
      });
      return;
    }

    if (event.keyCode === keyCodes.arrowUp) {
      event.preventDefault();
      this.executeBasedOnDirection({
        vertical: this.scheduleMoveBackward,
        horizontal: this.scheduleCrossAxisMoveBackward,
      });
      return;
    }

    if (event.keyCode === keyCodes.arrowRight) {
      event.preventDefault();
      this.executeBasedOnDirection({
        vertical: this.scheduleCrossAxisMoveForward,
        horizontal: this.scheduleMoveForward,
      });
      return;
    }

    if (event.keyCode === keyCodes.arrowLeft) {
      event.preventDefault();
      this.executeBasedOnDirection({
        vertical: this.scheduleCrossAxisMoveBackward,
        horizontal: this.scheduleMoveBackward,
      });
    }
  }

  // the on element keydown is only for lifting - otherwise using the window keydown
  onKeyDown = (event: KeyboardEvent): void => {
    if (!this.props.isEnabled ||
      this.state.pending ||
      this.state.draggingWith ||
      !this.props.canLift) {
      return;
    }

    // At this point we will not have a direction provided
    if (event.keyCode === keyCodes.space) {
      event.preventDefault();
      // stopping the event from bubbling up to the window event handler
      event.stopPropagation();
      this.startDragging('KEYBOARD', () => this.props.callbacks.onKeyLift());
    }
  }

  onClick = (event: MouseEvent): void => {
    if (!this.preventClick) {
      return;
    }
    this.preventClick = false;
    event.preventDefault();
  }

  startPendingMouseDrag = (point: Position) => {
    if (this.state.draggingWith) {
      console.error('cannot start a pending mouse drag when already dragging');
      return;
    }

    if (this.state.pending) {
      console.error('cannot start a pending mouse drag when there is already a pending position');
      return;
    }

    // need to bind the window events
    this.bindWindowEvents();

    const state: State = {
      draggingWith: null,
      pending: point,
    };

    this.setState(state);
  }

  startDragging = (type: DragTypes, done?: () => void = noop) => {
    if (this.state.draggingWith) {
      console.error('cannot start dragging when already dragging');
      return;
    }

    if (type === 'MOUSE' && !this.state.pending) {
      console.error('cannot start mouse drag when there is not a pending position');
      return;
    }

    // keyboard events already bound for mouse dragging
    if (type === 'KEYBOARD') {
      this.bindWindowEvents();
    }

    const state: State = {
      draggingWith: type,
      pending: null,
    };
    this.setState(state, done);
  }

  stopPendingMouseDrag = (done?: () => void = noop) => {
    invariant(this.state.pending, 'cannot stop pending drag when there is none');

    // we need to allow the click event to get through
    this.preventClick = false;

    this.unbindWindowEvents();
    this.setState({
      draggingWith: null,
      pending: null,
    }, done);
  }

  stopDragging = (done?: () => void = noop) => {
    if (!this.state.draggingWith) {
      console.error('cannot stop dragging when not dragging');
      return;
    }

    this.unbindWindowEvents();

    if (this.state.draggingWith === 'MOUSE') {
    // Need to block any click actions
      this.preventClick = true;
    }

    const state: State = {
      draggingWith: null,
      pending: null,
    };
    this.setState(state, done);
  }

  // Need to opt out of dragging if the user is a force press
  // Only for safari which has decided to introduce its own custom way of doing things
  // https://developer.apple.com/library/content/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html
  mouseForceChanged = (event: MouseForceChangedEvent) => {
    if (event.webkitForce == null || MouseEvent.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN == null) {
      console.error('handling a mouse force changed event when it is not supported');
      return;
    }

    const forcePressThreshold: number = (MouseEvent.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN : any);

    // not a force press
    if (event.webkitForce < forcePressThreshold) {
      return;
    }

    // is a force press
    // if we are dragging - kill the drag

    if (this.state.pending) {
      this.stopPendingMouseDrag();
      return;
    }

    // This case should not happen as it looks like force press is not
    // possible while moving the mouse. However, this is being super defensive.
    if (this.state.draggingWith) {
      this.stopDragging(() => this.props.callbacks.onCancel());
    }
  }

  unbindWindowEvents = () => {
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    window.removeEventListener('mousedown', this.onWindowMouseDown);
    window.removeEventListener('keydown', this.onWindowKeydown);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('scroll', this.onWindowScroll);
    window.removeEventListener('webkitmouseforcechanged', this.mouseForceChanged);
  }

  bindWindowEvents = () => {
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('mousedown', this.onWindowMouseDown);
    window.addEventListener('keydown', this.onWindowKeydown);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    window.addEventListener('webkitmouseforcechanged', this.mouseForceChanged);
  }

  getProvided = memoizeOne((isEnabled: boolean, isDragging: boolean): ?Provided => {
    if (!isEnabled) {
      return null;
    }

    const provided: Provided = {
      onMouseDown: this.onMouseDown,
      onKeyDown: this.onKeyDown,
      onClick: this.onClick,
      tabIndex: 0,
      'aria-grabbed': isDragging,
      draggable: false,
      onDragStart: getFalse,
      onDrop: getFalse,
    };

    return provided;
  })

  render() {
    const { children, isEnabled } = this.props;
    const { draggingWith } = this.state;
    const isDragging: boolean = Boolean(draggingWith);

    return children(this.getProvided(isEnabled, isDragging));
  }
}

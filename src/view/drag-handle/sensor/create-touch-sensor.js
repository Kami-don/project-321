// @flow
/* eslint-disable no-use-before-define */
import stopEvent from '../util/stop-event';
import createScheduler from '../util/create-scheduler';
import isSloppyClickThresholdExceeded from '../util/is-sloppy-click-threshold-exceeded';
import getWindowFromRef from '../../get-window-from-ref';
import type {
  Position,
  HTMLElement,
} from '../../../types';
import type {
  Callbacks,
  Props,
} from '../drag-handle-types';
import type { TouchSensor } from './sensor-types';

type State = {
  isDragging: boolean,
  hasMoved: boolean,
  preventClick: boolean,
  longPressTimerId: ?number,
  pending: ?Position,
}

type TouchWithForce = Touch & {
  force: number
}

export const timeForLongPress: number = 200;
export const forcePressThreshold: number = 0.15;

const noop = (): void => { };

const initial: State = {
  isDragging: false,
  pending: null,
  hasMoved: false,
  preventClick: false,
  longPressTimerId: null,
};

export default (callbacks: Callbacks, getDraggableRef: () => ?HTMLElement): TouchSensor => {
  let state: State = initial;

  const setState = (partial: Object): void => {
    state = {
      ...state,
      ...partial,
    };
  };
  const isDragging = (): boolean => state.isDragging;
  const isCapturing = (): boolean =>
    Boolean(state.pending || state.isDragging || state.longPressTimerId);
  const schedule = createScheduler(callbacks, isDragging);

  const startDragging = () => {
    // Drag can start from either a timeout or user movement
    // so we need to clear the timeout
    if (state.longPressTimerId) {
      clearTimeout(state.longPressTimerId);
    }

    const pending: ?Position = state.pending;

    if (!state.pending) {
      console.error('cannot start a touch drag without a pending position');
      kill();
      return;
    }

    setState({
      isDragging: true,
      // has not moved from original position yet
      hasMoved: false,
      // no longer relevant
      pending: null,
      longPressTimerId: null,
    });

    callbacks.onLift({
      client: pending,
      // not allowing container scrolling for touch movements at this stage
      isScrollAllowed: false,
    });
  };
  const stopDragging = (fn?: Function = noop) => {
    unbindWindowEvents();
    setState({
      ...initial,
      preventClick: true,
    });
    fn();
  };

  const startPendingDrag = (event: TouchEvent) => {
    const touch: Touch = event.touches[0];
    const { clientX, clientY } = touch;
    const point: Position = {
      x: clientX,
      y: clientY,
    };

    const longPressTimerId: number = setTimeout(startDragging, timeForLongPress);

    setState({
      longPressTimerId,
      pending: point,
      isDragging: false,
      hasMoved: false,
    });
    bindWindowEvents();
  };

  const stopPendingDrag = () => {
    clearTimeout(state.longPressTimerId);
    unbindWindowEvents();

    setState(initial);
  };

  const kill = (fn?: Function = noop) => {
    if (state.pending) {
      stopPendingDrag();
      return;
    }
    stopDragging(fn);
  };

  const cancel = () => {
    kill(callbacks.onCancel);
  };

  const windowBindings = {
    touchmove: (event: TouchEvent) => {
      const { clientX, clientY } = event.touches[0];

      const point: Position = {
        x: clientX,
        y: clientY,
      };

      // event already stopped in onTouchMove but being cautious
      stopEvent(event);

      // record that a movement has occurred
      if (!state.hasMoved) {
        setState({
          hasMoved: true,
        });
      }

      if (state.pending) {
        if (!isSloppyClickThresholdExceeded(state.pending, point)) {
          return;
        }

        // User is probably attempting to scroll. However, because we have opted
        // out of native scrolling the best option is to start a drag rather than
        // end the pending drag and do nothing.
        // More information: https://github.com/atlassian/react-beautiful-dnd/issues/11#issuecomment-343288990

        startDragging();
        return;
      }

      // already dragging
      schedule.move(point);
    },
    touchend: (event: TouchEvent) => {
      if (state.pending) {
        stopPendingDrag();
        // not stopping the event as this can be registered as a tap
        return;
      }

      // already dragging
      stopDragging(callbacks.onDrop);
      stopEvent(event);
    },
    touchcancel: () => {
      if (state.pending) {
        stopPendingDrag();
        return;
      }
      cancel();
    },
    // This should never happen - but just being super safe
    touchstart: cancel,
    // If the orientation of the device changes - kill the drag
    // https://davidwalsh.name/orientation-change
    orientationchange: cancel,
    // some devices fire resize if the orientation changes
    resize: cancel,
    // A window scroll will cancel a pending or current drag.
    // This should not happen as we are calling preventDefault in touchmove,
    // but just being extra safe
    scroll: cancel,
    // Long press can bring up a context menu
    // need to opt out of this behavior
    contextmenu: stopEvent,
    // On some devices it is possible to have a touch interface with a keyboard.
    // On any keyboard event we cancel a touch drag
    keydown: cancel,
    // Need to opt out of dragging if the user is a force press
    // Only for safari which has decided to introduce its own custom way of doing things
    // https://developer.apple.com/library/content/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html
    touchforcechange: (event: TouchEvent) => {
      // force push action will no longer fire after a touchmove
      if (state.hasMoved) {
        return;
      }

      const touch: TouchWithForce = (event.touches[0] : any);

      if (touch.force >= forcePressThreshold) {
        cancel();
      }
    },
  };

  const eventKeys = Object.keys(windowBindings);

  const bindWindowEvents = () => {
    const win: HTMLElement = getWindowFromRef(getDraggableRef());

    eventKeys.forEach((eventKey: string) => {
      const fn: Function = windowBindings[eventKey];

      if (eventKey === 'touchmove') {
        // opting out of passive touchmove (default) so as to prevent scrolling while moving
        // Not worried about performance as effect of move is throttled in requestAnimationFrame
        win.addEventListener(eventKey, fn, { passive: false });
        return;
      }

      win.addEventListener(eventKey, fn);
    });
  };

  const unbindWindowEvents = () => {
    const win: HTMLElement = getWindowFromRef(getDraggableRef());

    eventKeys.forEach((eventKey: string) =>
      win.removeEventListener(eventKey, windowBindings[eventKey]));
  };

  // entry point
  const onTouchStart = (event: TouchEvent, props: Props) => {
    if (!props.canLift) {
      return;
    }

    if (isCapturing()) {
      console.error('should not be able to perform a touch start while a drag or pending drag is occurring');
      cancel();
      return;
    }

    // Not stopping the event as we want to allow force press and other events to occur
    // Scrolling is stopped by onTouchMove

    startPendingDrag(event);
  };

  const onTouchMove = (event: TouchEvent) => {
    // Need to call preventDefault() on the *first* touchmove
    // in order to prevent native scrolling from occurring.
    // Adding the global event handler for touchmove misses the first event
    // https://twitter.com/alexandereardon/status/927671336435990528

    if (isCapturing()) {
      event.preventDefault();
    }

    // Not calling stopPropigation as we want the events to bubble to the global event handler
  };

  const onClick = (event: MouseEvent) => {
    if (!state.preventClick) {
      return;
    }

    stopEvent(event);
    setState(initial);
  };

  const sensor: TouchSensor = {
    onTouchStart,
    onTouchMove,
    onClick,
    kill,
    isCapturing,
    isDragging,
  };

  return sensor;
};

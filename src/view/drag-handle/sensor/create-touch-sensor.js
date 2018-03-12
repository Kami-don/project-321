// @flow
/* eslint-disable no-use-before-define */
import createScheduler from '../util/create-scheduler';
import getWindowFromRef from '../../get-window-from-ref';
import createPostDragEventPreventer, { type EventPreventer } from '../util/create-post-drag-event-preventer';
import createEventMarshal, { type EventMarshal } from '../util/create-event-marshal';
import { bindEvents, unbindEvents } from '../util/bind-events';
import * as keyCodes from '../../key-codes';
import type { EventBinding } from '../util/event-types';
import type {
  Position,
} from '../../../types';
import type { TouchSensor, CreateSensorArgs } from './sensor-types';

type State = {
  isDragging: boolean,
  hasMoved: boolean,
  longPressTimerId: ?number,
  pending: ?Position,
}

type TouchWithForce = Touch & {
  force: number
}

export const timeForLongPress: number = 150;
export const forcePressThreshold: number = 0.15;
const touchStartMarshal: EventMarshal = createEventMarshal();

const noop = (): void => { };

const initial: State = {
  isDragging: false,
  pending: null,
  hasMoved: false,
  longPressTimerId: null,
};

export default ({
  callbacks,
  getDraggableRef,
  canStartCapturing,
}: CreateSensorArgs): TouchSensor => {
  let state: State = initial;

  const getWindow = (): HTMLElement => getWindowFromRef(getDraggableRef());
  const setState = (partial: Object): void => {
    state = {
      ...state,
      ...partial,
    };
  };
  const isDragging = (): boolean => state.isDragging;
  const isCapturing = (): boolean =>
    Boolean(state.pending || state.isDragging || state.longPressTimerId);
  const schedule = createScheduler(callbacks);
  const postDragEventPreventer: EventPreventer = createPostDragEventPreventer(getWindow);

  const startDragging = () => {
    const pending: ?Position = state.pending;

    if (!pending) {
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
      autoScrollMode: 'FLUID',
    });
  };
  const stopDragging = (fn?: Function = noop) => {
    schedule.cancel();
    touchStartMarshal.reset();
    unbindWindowEvents();
    postDragEventPreventer.preventNext();
    setState(initial);
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
    schedule.cancel();
    touchStartMarshal.reset();
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

  const unmount = () => {
    kill();
    postDragEventPreventer.abort();
  };

  const cancel = () => {
    kill(callbacks.onCancel);
  };

  const windowBindings: EventBinding[] = [
    {
      eventName: 'touchmove',
      // opting out of passive touchmove (default) so as to prevent scrolling while moving
      // Not worried about performance as effect of move is throttled in requestAnimationFrame
      options: { passive: false },
      fn: (event: TouchEvent) => {
        // Drag has not yet started and we are waiting for a long press.
        if (!state.isDragging) {
          stopPendingDrag();
          return;
        }

        // At this point we are dragging

        if (!state.hasMoved) {
          setState({
            hasMoved: true,
          });
        }

        const { clientX, clientY } = event.touches[0];

        const point: Position = {
          x: clientX,
          y: clientY,
        };

        // already dragging
        event.preventDefault();
        schedule.move(point);
      },
    },
    {
      eventName: 'touchend',
      fn: (event: TouchEvent) => {
        // drag had not started yet - do not prevent the default action
        if (!state.isDragging) {
          stopPendingDrag();
          return;
        }

        // already dragging - this event is directly ending a drag
        event.preventDefault();
        stopDragging(callbacks.onDrop);
      },
    },
    {
      eventName: 'touchcancel',
      fn: (event: TouchEvent) => {
        // drag had not started yet - do not prevent the default action
        if (!state.isDragging) {
          stopPendingDrag();
          return;
        }

        // already dragging - this event is directly ending a drag
        event.preventDefault();
        stopDragging(callbacks.onCancel);
      },
    },
    // another touch start should not happen without a
    // touchend or touchcancel. However, just being super safe
    {
      eventName: 'touchstart',
      fn: cancel,
    },
    // If the orientation of the device changes - kill the drag
    // https://davidwalsh.name/orientation-change
    {
      eventName: 'orientationchange',
      fn: cancel,
    },
    // some devices fire resize if the orientation changes
    {
      eventName: 'resize',
      fn: cancel,
    },
    // For scroll events we are okay with eventual consistency.
    // Passive scroll listeners is the default behavior for mobile
    // but we are being really clear here
    {
      eventName: 'scroll',
      options: { passive: true },
      fn: () => {
        // stop a pending drag
        if (state.pending) {
          stopPendingDrag();
          return;
        }
        schedule.windowScrollMove();
      },
    },
    // Long press can bring up a context menu
    // need to opt out of this behavior
    {
      eventName: 'contextmenu',
      fn: (event: Event) => {
        // always opting out of context menu events
        event.preventDefault();
      },
    },
    // On some devices it is possible to have a touch interface with a keyboard.
    // On any keyboard event we cancel a touch drag
    {
      eventName: 'keydown',
      fn: (event: KeyboardEvent) => {
        if (!state.isDragging) {
          cancel();
          return;
        }

        // direct cancel: we are preventing the default action
        // indirect cancel: we are not preventing the default action

        // escape is a direct cancel
        if (event.keyCode === keyCodes.escape) {
          event.preventDefault();
        }
        cancel();
      },
    },
    // Need to opt out of dragging if the user is a force press
    // Only for safari which has decided to introduce its own custom way of doing things
    // https://developer.apple.com/library/content/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html
    {
      eventName: 'touchforcechange',
      fn: (event: TouchEvent) => {
        // A force push action will no longer fire after a touchmove
        if (state.hasMoved) {
          // This is being super safe. While this situation should not occur we
          // are still expressing that we want to opt out of force pressing
          event.preventDefault();
          return;
        }

        // A drag could be pending or has already started but no movement has occurred

        const touch: TouchWithForce = (event.touches[0] : any);

        if (touch.force >= forcePressThreshold) {
          // this is an indirect cancel so we do not preventDefault
          // we also want to allow the force press to occur
          cancel();
        }
      },
    },
  ];

  const bindWindowEvents = () => {
    bindEvents(getWindow(), windowBindings, { capture: true });
  };

  const unbindWindowEvents = () => {
    unbindEvents(getWindow(), windowBindings, { capture: true });
  };

  // entry point
  const onTouchStart = (event: TouchEvent) => {
    if (touchStartMarshal.isHandled()) {
      return;
    }

    if (!canStartCapturing(event)) {
      return;
    }

    if (isCapturing()) {
      console.error('should not be able to perform a touch start while a drag or pending drag is occurring');
      cancel();
      return;
    }

    // We need to stop parents from responding to this event - which may cause a double lift
    // We also need to NOT call event.preventDefault() so as to maintain as much standard
    // browser interactions as possible.
    touchStartMarshal.handle();

    startPendingDrag(event);
  };

  // a touch move can happen very quickly - before the window handlers are bound
  // so we need to also add some logic here to ensure that a pending drag is cancelled if needed
  const onTouchMove = () => {
    if (state.pending) {
      stopPendingDrag();
    }
  };

  const sensor: TouchSensor = {
    onTouchStart,
    onTouchMove,
    kill,
    isCapturing,
    isDragging,
    unmount,
  };

  return sensor;
};

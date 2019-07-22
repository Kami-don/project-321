// @flow
import type { Position } from 'css-box-model';
import { useRef } from 'react';
import invariant from 'tiny-invariant';
import { useMemo, useCallback } from 'use-memo-one';
import type { EventBinding } from '../util/event-types';
import createEventMarshal, {
  type EventMarshal,
} from '../util/create-event-marshal';
import type { Callbacks } from '../drag-handle-types';
import { bindEvents, unbindEvents } from '../util/bind-events';
import createScheduler from '../util/create-scheduler';
import * as keyCodes from '../../key-codes';
import supportedPageVisibilityEventName from '../util/supported-page-visibility-event-name';
import createPostDragEventPreventer, {
  type EventPreventer,
} from '../util/create-post-drag-event-preventer';
import useLayoutEffect from '../../use-isomorphic-layout-effect';

export type Args = {|
  callbacks: Callbacks,
  getDraggableRef: () => ?HTMLElement,
  getWindow: () => HTMLElement,
  canStartCapturing: (event: Event) => boolean,
  getShouldRespectForcePress: () => boolean,
  onCaptureStart: (abort: () => void) => void,
  onCaptureEnd: () => void,
|};
export type OnTouchStart = (event: TouchEvent) => void;

type PendingDrag = {|
  longPressTimerId: TimeoutID,
  point: Position,
|};

type TouchWithForce = Touch & {
  force: number,
};

// Decreased from 150 as a work around for an issue for forcepress on iOS
// https://github.com/atlassian/react-beautiful-dnd/issues/1401
export const timeForLongPress: number = 120;
export const forcePressThreshold: number = 0.15;
const touchStartMarshal: EventMarshal = createEventMarshal();
const noop = (): void => {};

export default function useTouchSensor(args: Args): OnTouchStart {
  const {
    callbacks,
    getWindow,
    canStartCapturing,
    getShouldRespectForcePress,
    onCaptureStart,
    onCaptureEnd,
  } = args;
  const pendingRef = useRef<?PendingDrag>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const unbindWindowEventsRef = useRef<() => void>(noop);
  const getIsCapturing = useCallback(
    () => Boolean(pendingRef.current || isDraggingRef.current),
    [],
  );
  const postDragClickPreventer: EventPreventer = useMemo(
    () => createPostDragEventPreventer(getWindow),
    [getWindow],
  );

  const schedule = useMemo(() => {
    invariant(
      !getIsCapturing(),
      'Should not recreate scheduler while capturing',
    );
    return createScheduler(callbacks);
  }, [callbacks, getIsCapturing]);

  const stop = useCallback(() => {
    if (!getIsCapturing()) {
      return;
    }

    schedule.cancel();
    unbindWindowEventsRef.current();
    touchStartMarshal.reset();
    hasMovedRef.current = false;
    onCaptureEnd();

    // if dragging - prevent the next click
    if (isDraggingRef.current) {
      postDragClickPreventer.preventNext();
      isDraggingRef.current = false;
      return;
    }

    const pending: ?PendingDrag = pendingRef.current;
    invariant(pending, 'Expected a pending drag');

    clearTimeout(pending.longPressTimerId);
    pendingRef.current = null;
  }, [getIsCapturing, onCaptureEnd, postDragClickPreventer, schedule]);

  const cancel = useCallback(() => {
    const wasDragging: boolean = isDraggingRef.current;
    stop();

    if (wasDragging) {
      callbacks.onCancel();
    }
  }, [callbacks, stop]);

  const windowBindings: EventBinding[] = useMemo(() => {
    invariant(
      !getIsCapturing(),
      'Should not recreate window bindings while capturing',
    );

    const bindings: EventBinding[] = [
      {
        eventName: 'touchmove',
        // Opting out of passive touchmove (default) so as to prevent scrolling while moving
        // Not worried about performance as effect of move is throttled in requestAnimationFrame
        // Using `capture: false` due to a recent horrible firefox bug: https://twitter.com/alexandereardon/status/1125904207184187393
        options: { passive: false, capture: false },
        fn: (event: TouchEvent) => {
          // Drag has not yet started and we are waiting for a long press.
          if (!isDraggingRef.current) {
            stop();
            return;
          }

          // At this point we are dragging

          if (!hasMovedRef.current) {
            hasMovedRef.current = true;
          }

          const touch: ?Touch = event.touches[0];

          if (!touch) {
            return;
          }

          const point: Position = {
            x: touch.clientX,
            y: touch.clientY,
          };

          // We need to prevent the default event in order to block native scrolling
          // Also because we are using it as part of a drag we prevent the default action
          // as a sign that we are using the event
          event.preventDefault();
          schedule.move(point);
        },
      },
      {
        eventName: 'touchend',
        fn: (event: TouchEvent) => {
          // drag had not started yet - do not prevent the default action
          if (!isDraggingRef.current) {
            stop();
            return;
          }

          // already dragging - this event is directly ending a drag
          event.preventDefault();
          stop();
          callbacks.onDrop();
        },
      },
      {
        eventName: 'touchcancel',
        fn: (event: TouchEvent) => {
          // drag had not started yet - do not prevent the default action
          if (!isDraggingRef.current) {
            stop();
            return;
          }

          // already dragging - this event is directly ending a drag
          event.preventDefault();
          cancel();
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
      // ## Passive: true
      // For scroll events we are okay with eventual consistency.
      // Passive scroll listeners is the default behavior for mobile
      // but we are being really clear here
      // ## Capture: false
      // Scroll events on elements do not bubble, but they go through the capture phase
      // https://twitter.com/alexandereardon/status/985994224867819520
      // Using capture: false here as we want to avoid intercepting droppable scroll requests
      {
        eventName: 'scroll',
        options: { passive: true, capture: false },
        fn: () => {
          // stop a pending drag
          if (pendingRef.current) {
            stop();
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
          if (!isDraggingRef.current) {
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
      // Only for webkit which has decided to introduce its own custom way of doing things
      // https://developer.apple.com/library/content/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html
      // NOTE: this function is back-ported from the `virtual` branch
      {
        eventName: 'touchforcechange',
        fn: (event: TouchEvent) => {
          const touch: TouchWithForce = (event.touches[0]: any);
          const isForcePress: boolean = touch.force >= forcePressThreshold;

          if (!isForcePress) {
            return;
          }

          const shouldRespect: boolean = getShouldRespectForcePress();

          if (pendingRef.current) {
            if (shouldRespect) {
              cancel();
            }
            // If not respecting we just let the event go through
            // It will not have an impact on the browser until
            // there has been a sufficient time ellapsed
            return;
          }

          // DRAGGING

          if (shouldRespect) {
            if (hasMovedRef.current) {
              // After the user has moved we do not allow the dragging item to be force pressed
              // This prevents strange behaviour such as a link preview opening mid drag
              event.preventDefault();
              return;
            }
            // indirect cancel
            cancel();
            return;
          }
          // not respecting during a drag
          event.preventDefault();
        },
      },
      // Cancel on page visibility change
      {
        eventName: supportedPageVisibilityEventName,
        fn: cancel,
      },
    ];
    return bindings;
  }, [
    callbacks,
    cancel,
    getIsCapturing,
    getShouldRespectForcePress,
    schedule,
    stop,
  ]);

  const bindWindowEvents = useCallback(() => {
    const win: HTMLElement = getWindow();
    const options = { capture: true };

    // setting up our unbind before we bind
    unbindWindowEventsRef.current = () =>
      unbindEvents(win, windowBindings, options);

    bindEvents(win, windowBindings, options);
  }, [getWindow, windowBindings]);

  const startDragging = useCallback(() => {
    const pending: ?PendingDrag = pendingRef.current;
    invariant(pending, 'Cannot start a drag without a pending drag');

    isDraggingRef.current = true;
    pendingRef.current = null;
    hasMovedRef.current = false;

    callbacks.onLift({
      clientSelection: pending.point,
      movementMode: 'FLUID',
    });
  }, [callbacks]);

  const startPendingDrag = useCallback(
    (event: TouchEvent) => {
      invariant(!pendingRef.current, 'Expected there to be no pending drag');
      const touch: Touch = event.touches[0];
      const { clientX, clientY } = touch;
      const point: Position = {
        x: clientX,
        y: clientY,
      };
      const longPressTimerId: TimeoutID = setTimeout(
        startDragging,
        timeForLongPress,
      );

      const pending: PendingDrag = {
        point,
        longPressTimerId,
      };

      pendingRef.current = pending;
      onCaptureStart(stop);
      bindWindowEvents();
    },
    [bindWindowEvents, onCaptureStart, startDragging, stop],
  );

  const onTouchStart = (event: TouchEvent) => {
    if (touchStartMarshal.isHandled()) {
      return;
    }

    invariant(
      !getIsCapturing(),
      'Should not be able to perform a touch start while a drag or pending drag is occurring',
    );

    // We do not need to prevent the event on a dropping draggable as
    // the touchstart event will not fire due to pointer-events: none
    // https://codesandbox.io/s/oxo0o775rz
    if (!canStartCapturing(event)) {
      return;
    }

    // We need to stop parents from responding to this event - which may cause a double lift
    // We also need to NOT call event.preventDefault() so as to maintain as much standard
    // browser interactions as possible.
    // This includes navigation on anchors which we want to preserve
    touchStartMarshal.handle();
    startPendingDrag(event);
  };

  // This is needed for safari
  // Simply adding a non capture, non passive 'touchmove' listener.
  // This forces event.preventDefault() in dynamically added
  // touchmove event handlers to actually work
  // https://github.com/atlassian/react-beautiful-dnd/issues/1374
  useLayoutEffect(function webkitHack() {
    const unbind = bindEvents(window, [
      {
        eventName: 'touchmove',
        fn: noop,
        options: { capture: false, passive: false },
      },
    ]);

    return unbind;
  }, []);

  return onTouchStart;
}

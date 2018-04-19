// @flow
import { Component } from 'react';
import PropTypes from 'prop-types';
import memoizeOne from 'memoize-one';
import invariant from 'tiny-invariant';
import getWindowFromRef from '../get-window-from-ref';
import getDragHandleRef from './util/get-drag-handle-ref';
import type {
  Props,
  DragHandleProps,
} from './drag-handle-types';
import type {
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
  CreateSensorArgs,
} from './sensor/sensor-types';
import type {
  DraggableId,
} from '../../types';
import { styleContextKey, canLiftContextKey } from '../context-keys';
import focusRetainer from './util/focus-retainer';
import shouldAllowDraggingFromTarget from './util/should-allow-dragging-from-target';
import createMouseSensor from './sensor/create-mouse-sensor';
import createKeyboardSensor from './sensor/create-keyboard-sensor';
import createTouchSensor from './sensor/create-touch-sensor';

const preventHtml5Dnd = (event: DragEvent) => {
  event.preventDefault();
};

type Sensor = MouseSensor | KeyboardSensor | TouchSensor;

export default class DragHandle extends Component<Props> {
  /* eslint-disable react/sort-comp */
  mouseSensor: MouseSensor;
  keyboardSensor: KeyboardSensor;
  touchSensor: TouchSensor;
  sensors: Sensor[];
  styleContext: string;
  canLift: (id: DraggableId) => boolean;
  isFocused: boolean = false;
  lastDraggableRef: ?HTMLElement;

  // Need to declare contextTypes without flow
  // https://github.com/brigand/babel-plugin-flow-react-proptypes/issues/22
  static contextTypes = {
    [styleContextKey]: PropTypes.string.isRequired,
    [canLiftContextKey]: PropTypes.func.isRequired,
  }

  constructor(props: Props, context: Object) {
    super(props, context);

    const getWindow = (): HTMLElement => getWindowFromRef(this.props.getDraggableRef());

    const args: CreateSensorArgs = {
      callbacks: this.props.callbacks,
      getDraggableRef: this.props.getDraggableRef,
      getWindow,
      canStartCapturing: this.canStartCapturing,
    };

    this.mouseSensor = createMouseSensor(args);
    this.keyboardSensor = createKeyboardSensor(args);
    this.touchSensor = createTouchSensor(args);
    this.sensors = [
      this.mouseSensor,
      this.keyboardSensor,
      this.touchSensor,
    ];
    this.styleContext = context[styleContextKey];

    // The canLift function is read directly off the context
    // and will communicate with the store. This is done to avoid
    // needing to query a property from the store and re-render this component
    // with that value. By putting it as a function on the context we are able
    // to avoid re-rendering to pass this information while still allowing
    // drag-handles to obtain this state if they need it.
    this.canLift = context[canLiftContextKey];
  }

  componentDidMount() {
    const draggableRef: ?HTMLElement = this.props.getDraggableRef();

    // storing a reference for later
    this.lastDraggableRef = draggableRef;

    if (!draggableRef) {
      console.error('Cannot get draggable ref from drag handle');
      return;
    }

    // drag handle ref will not be available when not enabled
    if (!this.props.isEnabled) {
      return;
    }

    const dragHandleRef: ?HTMLElement = getDragHandleRef(draggableRef);
    invariant(dragHandleRef, 'DragHandle could not find drag handle element');

    focusRetainer.tryRestoreFocus(this.props.draggableId, dragHandleRef);
  }

  componentDidUpdate(prevProps: Props) {
    const ref: ?HTMLElement = this.props.getDraggableRef();
    if (ref !== this.lastDraggableRef) {
      this.lastDraggableRef = ref;

      // After a ref change we might need to manually force focus onto the ref.
      // When moving something into or out of a portal the element looses focus
      // https://github.com/facebook/react/issues/12454

      // No need to focus
      if (!ref || !this.isFocused) {
        return;
      }

      // No drag handle ref will be available to focus on
      if (!this.props.isEnabled) {
        return;
      }

      const dragHandleRef: ?HTMLElement = getDragHandleRef(ref);
      invariant(dragHandleRef, 'DragHandle could not find drag handle element');

      dragHandleRef.focus();
    }

    const isCapturing: boolean = this.isAnySensorCapturing();

    if (!isCapturing) {
      return;
    }

    const isDragStopping: boolean = (prevProps.isDragging && !this.props.isDragging);

    // if the application cancels a drag we need to unbind the handlers
    if (isDragStopping) {
      this.sensors.forEach((sensor: Sensor) => {
        if (sensor.isCapturing()) {
          sensor.kill();
          // not firing any cancel event as the drag is already over
        }
      });
      return;
    }

    // dragging disabled mid drag
    if (!this.props.isEnabled) {
      this.sensors.forEach((sensor: Sensor) => {
        if (sensor.isCapturing()) {
          const wasDragging: boolean = sensor.isDragging();

          // stop listening
          sensor.kill();

          // we need to cancel the drag if it was dragging
          if (wasDragging) {
            this.props.callbacks.onCancel();
          }
        }
      });
    }
  }

  componentWillUnmount() {
    this.sensors.forEach((sensor: Sensor) => {
      // kill the current drag and fire a cancel event if
      const wasDragging = sensor.isDragging();

      sensor.unmount();
      // cancel if drag was occurring
      if (wasDragging) {
        this.props.callbacks.onCancel();
      }
    });

    const shouldRetainFocus: boolean = (() => {
      if (!this.props.isEnabled) {
        return false;
      }

      // not already focused
      if (!this.isFocused) {
        return false;
      }

      // a drag is finishing
      return (this.props.isDragging || this.props.isDropAnimating);
    })();

    if (shouldRetainFocus) {
      focusRetainer.retain(this.props.draggableId);
    }
  }

  onFocus = () => {
    this.isFocused = true;
  }

  onBlur = () => {
    this.isFocused = false;
  }

  onKeyDown = (event: KeyboardEvent) => {
    // let the mouse sensor deal with it
    if (this.mouseSensor.isCapturing()) {
      return;
    }

    this.keyboardSensor.onKeyDown(event, this.props);
  }

  onMouseDown = (event: MouseEvent) => {
    // let the other sensors deal with it
    if (this.keyboardSensor.isCapturing() || this.mouseSensor.isCapturing()) {
      return;
    }

    this.mouseSensor.onMouseDown(event);
  }

  onTouchStart = (event: TouchEvent) => {
    // let the keyboard sensor deal with it
    if (this.mouseSensor.isCapturing() || this.keyboardSensor.isCapturing()) {
      console.error('mouse or keyboard already listening when attempting to touch drag');
      return;
    }

    this.touchSensor.onTouchStart(event);
  }

  canStartCapturing = (event: Event) => {
    // this might be before a drag has started - isolated to this element
    if (this.isAnySensorCapturing()) {
      return false;
    }

    // this will check if anything else in the system is dragging
    if (!this.canLift(this.props.draggableId)) {
      return false;
    }

    // check if we are dragging an interactive element
    return shouldAllowDraggingFromTarget(event, this.props);
  }

  isAnySensorCapturing = (): boolean =>
    this.sensors.some((sensor: Sensor) => sensor.isCapturing())

  getProvided = memoizeOne((isEnabled: boolean): ?DragHandleProps => {
    if (!isEnabled) {
      return null;
    }

    const provided: DragHandleProps = {
      onMouseDown: this.onMouseDown,
      onKeyDown: this.onKeyDown,
      onTouchStart: this.onTouchStart,
      onFocus: this.onFocus,
      onBlur: this.onBlur,
      tabIndex: 0,
      'data-react-beautiful-dnd-drag-handle': this.styleContext,
      // English default. Consumers are welcome to add their own start instruction
      'aria-roledescription': 'Draggable item. Press space bar to lift',
      draggable: false,
      onDragStart: preventHtml5Dnd,
    };

    return provided;
  })

  render() {
    const { children, isEnabled } = this.props;

    return children(this.getProvided(isEnabled));
  }
}

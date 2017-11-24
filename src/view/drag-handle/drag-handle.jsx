// @flow
import { Component } from 'react';
import memoizeOne from 'memoize-one';
import type {
  Props,
  Provided,
} from './drag-handle-types';
import type {
  Sensor,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
} from './sensor/sensor-types';
import createMouseSensor from './sensor/create-mouse-sensor';
import createKeyboardSensor from './sensor/create-keyboard-sensor';
import createTouchSensor from './sensor/create-touch-sensor';

const getFalse: () => boolean = () => false;

export default class DragHandle extends Component<Props> {
  /* eslint-disable react/sort-comp */
  mouseSensor: MouseSensor = createMouseSensor(
    this.props.callbacks,
    this.props.getDraggableRef
  );
  keyboardSensor: KeyboardSensor = createKeyboardSensor(
    this.props.callbacks,
    this.props.getDraggableRef
  );
  touchSensor: TouchSensor = createTouchSensor(
    this.props.callbacks,
    this.props.getDraggableRef
  );
  sensors: Sensor[] = [
    this.mouseSensor,
    this.keyboardSensor,
    this.touchSensor,
  ];

  componentWillUnmount() {
    this.sensors.forEach((sensor: Sensor) => {
      // kill the current drag and fire a cancel event if
      const wasCapturing = sensor.isCapturing();
      const wasDragging = sensor.isDragging();

      // stop capturing
      if (wasCapturing) {
        sensor.kill();
      }
      // cancel if drag was occurring
      if (wasDragging) {
        this.props.callbacks.onCancel();
      }
    });
  }

  componentWillReceiveProps(nextProps: Props) {
    const isCapturing: boolean = this.isAnySensorCapturing();

    if (!isCapturing) {
      return;
    }

    const isDragStopping: boolean = (this.props.isDragging && !nextProps.isDragging);

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
    if (!nextProps.isEnabled) {
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

    this.mouseSensor.onMouseDown(event, this.props);
  }

  onTouchStart = (event: TouchEvent) => {
    // let the keyboard sensor deal with it
    if (this.mouseSensor.isCapturing() || this.keyboardSensor.isCapturing()) {
      console.error('mouse or keyboard already listening when attempting to touch drag');
      return;
    }

    this.touchSensor.onTouchStart(event, this.props);
  }

  onTouchMove = (event: TouchEvent) => {
    this.touchSensor.onTouchMove(event);
  }

  onClick = (event: MouseEvent) => {
    // The mouse or touch sensor may want to block the click
    this.mouseSensor.onClick(event);
    this.touchSensor.onClick(event);
  }

  isAnySensorDragging = () =>
    this.sensors.some((sensor: Sensor) => sensor.isDragging())

  isAnySensorCapturing = () =>
    this.sensors.some((sensor: Sensor) => sensor.isCapturing())

  getProvided = memoizeOne((isEnabled: boolean, isDragging: boolean): ?Provided => {
    if (!isEnabled) {
      return null;
    }

    const provided: Provided = {
      onMouseDown: this.onMouseDown,
      onKeyDown: this.onKeyDown,
      onTouchStart: this.onTouchStart,
      onTouchMove: this.onTouchMove,
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

    return children(this.getProvided(isEnabled, this.isAnySensorDragging()));
  }
}

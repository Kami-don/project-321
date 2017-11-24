// @flow
import type { Props, Callbacks } from '../drag-handle-types';

export type Sensor = {
  // force stop and do not fire any events
  kill: () => void,
  // Is the sensor currently recording a drag
  isDragging: () => boolean,
  // Is the sensor listening for events.
  // This can happen before a drag starts
  isCapturing: () => boolean,
}

export type CreateSensorArgs = {|
  callbacks: Callbacks,
  getDraggableRef: () => ?HTMLElement
|}

export type MouseSensor = Sensor & {
  onMouseDown: (event: MouseEvent, props: Props) => void,
  onClick: (event: MouseEvent) => void,
}

export type KeyboardSensor = Sensor & {
  onKeyDown: (event: KeyboardEvent, props: Props) => void,
}

export type TouchSensor = Sensor & {
  onTouchStart: (event: TouchEvent, props: Props) => void,
  onTouchMove: (event: TouchEvent) => void,
  onClick: (event: MouseEvent) => void,
}

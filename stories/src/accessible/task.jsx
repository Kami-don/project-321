// @flow
import React, { Component, type Node } from 'react';
import ReactDOM from 'react-dom';
import memoizeOne from 'memoize-one';
import invariant from 'tiny-invariant';
import styled from 'react-emotion';
import { Draggable } from '../../../src';
import type { DraggableProvided, DraggableStateSnapshot } from '../../../src';
import type { Task as TaskType } from '../types';
import { colors, grid, borderRadius } from '../constants';

type Props = {|
  task: TaskType,
  index: number,
|};

const Container = styled('div')`
  border-bottom: 1px solid #ccc;
  background: ${colors.white};
  padding: ${grid}px;
  margin-bottom: ${grid}px;
  border-radius: ${borderRadius}px;
  font-size: 18px;
  ${({ isDragging }) =>
    isDragging ? 'box-shadow: 1px 1px 1px grey; background: lightblue' : ''};
`;

const getPortal = memoizeOne(
  (): HTMLElement => {
    invariant(document);
    const body: ?HTMLBodyElement = document.body;
    invariant(body);
    const el: HTMLElement = document.createElement('div');
    el.className = 'rbd-portal';
    body.appendChild(el);
    return el;
  },
);

export default class Task extends Component<Props> {
  render() {
    const task: TaskType = this.props.task;
    const index: number = this.props.index;

    return (
      <Draggable draggableId={task.id} index={index}>
        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
          const child: Node = (
            <Container
              innerRef={provided.innerRef}
              isDragging={snapshot.isDragging}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              aria-roledescription="Draggable task. Press space bar to lift"
            >
              {this.props.task.content}
            </Container>
          );

          if (!snapshot.isDragging) {
            return child;
          }

          return ReactDOM.createPortal(child, getPortal());
        }}
      </Draggable>
    );
  }
}

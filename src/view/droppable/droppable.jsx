// @flow
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import type { Props, Provided, StateSnapshot } from './droppable-types';
import type { DroppableId, TypeId } from '../../types';
import DroppableDimensionPublisher from '../droppable-dimension-publisher';
import Placeholder from '../placeholder';
import throwIfRefIsInvalid from '../throw-if-invalid-inner-ref';
import {
  droppableIdKey,
  droppableTypeKey,
  styleContextKey,
} from '../context-keys';

type Context = {
  [string]: DroppableId | TypeId,
};

export default class Droppable extends Component<Props> {
  /* eslint-disable react/sort-comp */
  styleContext: string;
  ref: ?HTMLElement = null;
  isPlaceholderMounted: boolean = false;

  // Need to declare childContextTypes without flow
  static contextTypes = {
    [styleContextKey]: PropTypes.string.isRequired,
  };

  constructor(props: Props, context: Object) {
    super(props, context);

    this.styleContext = context[styleContextKey];
  }

  // Need to declare childContextTypes without flow
  // https://github.com/brigand/babel-plugin-flow-react-proptypes/issues/22
  static childContextTypes = {
    [droppableIdKey]: PropTypes.string.isRequired,
    [droppableTypeKey]: PropTypes.string.isRequired,
  };

  getChildContext(): Context {
    const value: Context = {
      [droppableIdKey]: this.props.droppableId,
      [droppableTypeKey]: this.props.type,
    };
    return value;
  }

  componentDidMount() {
    throwIfRefIsInvalid(this.ref);
    this.warnIfPlaceholderNotMounted();
  }

  componentDidUpdate() {
    this.warnIfPlaceholderNotMounted();
  }

  warnIfPlaceholderNotMounted() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (!this.props.placeholder) {
      return;
    }

    if (this.isPlaceholderMounted) {
      return;
    }

    console.warn(`
      Droppable setup issue: DroppableProvided > placeholder could not be found.
      Please be sure to add the {provided.placeholder} Node as a child of your Droppable

      More information: https://github.com/atlassian/react-beautiful-dnd#1-provided-droppableprovided
    `);
  }

  /* eslint-enable */

  onPlaceholderMount = () => {
    this.isPlaceholderMounted = true;
  };

  onPlaceholderUnmount = () => {
    this.isPlaceholderMounted = false;
  };

  // React calls ref callback twice for every render
  // https://github.com/facebook/react/pull/8333/files
  setRef = (ref: ?HTMLElement) => {
    // TODO: need to clear this.state.ref on unmount
    if (ref === null) {
      return;
    }

    if (ref === this.ref) {
      return;
    }

    this.ref = ref;
    throwIfRefIsInvalid(ref);
  };

  getDroppableRef = (): ?HTMLElement => this.ref;

  getPlaceholder() {
    if (!this.props.placeholder) {
      return null;
    }

    return (
      <Placeholder
        placeholder={this.props.placeholder}
        onMount={this.onPlaceholderMount}
        onUnmount={this.onPlaceholderUnmount}
      />
    );
  }

  render() {
    const {
      children,
      direction,
      droppableId,
      ignoreContainerClipping,
      isDraggingOver,
      isDropDisabled,
      draggingOverWith,
      type,
    } = this.props;
    const provided: Provided = {
      innerRef: this.setRef,
      placeholder: this.getPlaceholder(),
      droppableProps: {
        'data-react-beautiful-dnd-droppable': this.styleContext,
      },
    };
    const snapshot: StateSnapshot = {
      isDraggingOver,
      draggingOverWith,
    };

    return (
      <DroppableDimensionPublisher
        droppableId={droppableId}
        type={type}
        direction={direction}
        ignoreContainerClipping={ignoreContainerClipping}
        isDropDisabled={isDropDisabled}
        getDroppableRef={this.getDroppableRef}
      >
        {children(provided, snapshot)}
      </DroppableDimensionPublisher>
    );
  }
}

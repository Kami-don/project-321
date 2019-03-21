// @flow
import React, { type Node } from 'react';
import PropTypes from 'prop-types';
import DroppableDimensionPublisher from '../droppable-dimension-publisher';
import type { Props, Provided } from './droppable-types';
import type { DroppableId, TypeId } from '../../types';
import Placeholder from '../placeholder';
import throwIfRefIsInvalid from '../throw-if-invalid-inner-ref';
import {
  droppableIdKey,
  droppableTypeKey,
  styleKey,
  isMovementAllowedKey,
} from '../context-keys';
import { warning } from '../../dev-warning';
import checkOwnProps from './check-own-props';
import AnimateInOut, {
  type AnimateProvided,
} from '../animate-in-out/animate-in-out';
import getMaxWindowScroll from '../window/get-max-window-scroll';

type Context = {
  [string]: DroppableId | TypeId,
};

export default class Droppable extends React.Component<Props> {
  /* eslint-disable react/sort-comp */
  styleContext: string;
  ref: ?HTMLElement = null;
  placeholderRef: ?HTMLElement = null;

  // Need to declare childContextTypes without flow
  static contextTypes = {
    [styleKey]: PropTypes.string.isRequired,
    [isMovementAllowedKey]: PropTypes.func.isRequired,
  };

  constructor(props: Props, context: Object) {
    super(props, context);

    this.styleContext = context[styleKey];

    // a little run time check to avoid an easy to catch setup issues
    if (process.env.NODE_ENV !== 'production') {
      checkOwnProps(props);
    }
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

  componentWillUnmount() {
    // allowing garbage collection
    this.ref = null;
    this.placeholderRef = null;
  }

  warnIfPlaceholderNotMounted() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (!this.props.placeholder) {
      return;
    }

    if (this.placeholderRef) {
      return;
    }

    warning(`
      Droppable setup issue [droppableId: "${this.props.droppableId}"]:
      DroppableProvided > placeholder could not be found.

      Please be sure to add the {provided.placeholder} React Node as a child of your Droppable.
      More information: https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/api/droppable.md
    `);
  }

  /* eslint-enable */

  setPlaceholderRef = (ref: ?HTMLElement) => {
    this.placeholderRef = ref;
  };

  getPlaceholderRef = () => this.placeholderRef;

  // React calls ref callback twice for every render
  // https://github.com/facebook/react/pull/8333/files
  setRef = (ref: ?HTMLElement) => {
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

  onPlaceholderTransitionEnd = () => {
    const isMovementAllowed: boolean = this.context[isMovementAllowedKey]();
    // A placeholder change can impact the window's max scroll
    if (isMovementAllowed) {
      this.props.updateViewportMaxScroll({ maxScroll: getMaxWindowScroll() });
    }
  };

  getPlaceholder(): Node {
    // Placeholder > onClose / onTransitionEnd
    // might not fire in the case of very fast toggling
    return (
      <AnimateInOut
        on={this.props.placeholder}
        shouldAnimate={this.props.shouldAnimatePlaceholder}
      >
        {({ onClose, data, animate }: AnimateProvided) => (
          <Placeholder
            placeholder={(data: any)}
            onClose={onClose}
            innerRef={this.setPlaceholderRef}
            animate={animate}
            onTransitionEnd={this.onPlaceholderTransitionEnd}
          />
        )}
      </AnimateInOut>
    );
  }

  render() {
    const {
      // ownProps
      children,
      direction,
      type,
      droppableId,
      isDropDisabled,
      isCombineEnabled,
      ignoreContainerClipping,
      // mapProps
      snapshot,
    } = this.props;
    const provided: Provided = {
      innerRef: this.setRef,
      placeholder: this.getPlaceholder(),
      droppableProps: {
        'data-react-beautiful-dnd-droppable': this.styleContext,
      },
    };

    return (
      <DroppableDimensionPublisher
        droppableId={droppableId}
        type={type}
        direction={direction}
        ignoreContainerClipping={ignoreContainerClipping}
        isDropDisabled={isDropDisabled}
        isCombineEnabled={isCombineEnabled}
        getDroppableRef={this.getDroppableRef}
        getPlaceholderRef={this.getPlaceholderRef}
      >
        {children(provided, snapshot)}
      </DroppableDimensionPublisher>
    );
  }
}

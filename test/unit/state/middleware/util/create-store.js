// @flow
import { createStore, applyMiddleware } from 'redux';
import reducer from '../../../../../src/state/reducer';
import type { Store } from '../../../../../src/state/store-types';

export default (...middleware: mixed[]): Store =>
  createStore(reducer, applyMiddleware(...middleware));

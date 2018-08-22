// @flow
import { keyframes } from 'react-emotion';

const movement: number = 6;

const minorRotation = keyframes`
  0% {
    transform: rotate(0deg);
  }

  25% {
    transform: rotate(${movement}deg);
  }

  50% {
    transform: rotate(0deg);
  }

  75% {
    transform: rotate(-${movement}deg);
  }

  100% {
    transform: rotate(0deg);
  }
`;

// eslint-disable-next-line import/prefer-default-export
export const shake = `${minorRotation} 0.4s linear infinite`;

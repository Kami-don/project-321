// @flow
import React from 'react';
import styled from 'styled-components';
import HeartIcon from 'react-icons/lib/go/heart';
import { grid } from '../../../layouts/constants';

const LoveContainer = styled.div`
  display: flex;
  align-items: center;
`;

const Love = styled(HeartIcon)`
  color: red;
  margin-left: ${grid}px;
`;

export default () => <LoveContainer>Quotes that I <Love title="love" role="img" /></LoveContainer>;

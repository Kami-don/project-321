// @flow
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { borderRadius, colors, grid } from '../constants';
import type { Quote } from '../types';
import type { DraggableProvided } from '../../../src/';

type Props = {
  quote: Quote,
  isDragging: boolean,
  provided: DraggableProvided,
  autoFocus?: boolean,
}

type HTMLElement = any;

const Container = styled.a`
border-radius: ${borderRadius}px;
border: 1px solid grey;
background-color: ${({ isDragging }) => (isDragging ? colors.green : colors.white)};

/* cursor: grabbing is handled by app */
cursor: grab;
box-shadow: ${({ isDragging }) => (isDragging ? `2px 2px 1px ${colors.shadow}` : 'none')};
padding: ${grid}px;
min-height: 40px;
margin-bottom: ${grid}px;
user-select: none;
transition: background-color 0.1s ease;

/* anchor overrides */
color: ${colors.black};

&:hover {
  color: ${colors.black};
  text-decoration: none;
}
&:focus {
  outline: 2px solid ${colors.purple};
  box-shadow: none;
}

/* flexbox */
display: flex;
align-items: center;
`;

const Avatar = styled.img`
width: 40px;
height: 40px;
border-radius: 50%;
margin-right: ${grid}px;
flex-shrink: 0;
flex-grow: 0;
`;

const Content = styled.div`
/* flex child */
flex-grow: 1;

/* Needed to wrap text in ie11 */
/* https://stackoverflow.com/questions/35111090/why-ie11-doesnt-wrap-the-text-in-flexbox */
flex-basis: 100%

/* flex parent */
display: flex;
flex-direction: column;
`;

const BlockQuote = styled.div`
&::before {
  content: open-quote;
}

&::after {
  content: close-quote;
}
`;

const Footer = styled.div`
display: flex;
margin-top: ${grid}px;
`;

const QuoteId = styled.small`
flex-grow: 0;
margin: 0;
`;

const Attribution = styled.small`
margin: 0;
margin-left: ${grid}px;
text-align: right;
flex-grow: 1;
`;

export default class QuoteItem extends Component {
  // eslint-disable-next-line react/sort-comp
  props: Props

  componentDidMount() {
    if (!this.props.autoFocus) {
      return;
    }

    // eslint-disable-next-line react/no-find-dom-node
    const node: HTMLElement = ReactDOM.findDOMNode(this);
    node.focus();
  }

  render() {
    const { quote, isDragging, provided } = this.props;

    return (
      <Container
        href={quote.author.url}
        isDragging={isDragging}
        innerRef={provided.innerRef}
        style={provided.draggableStyle}
        {...provided.dragHandleProps}
      >
        <Avatar src={quote.author.avatarUrl} alt={quote.author.name} />
        <Content>
          <BlockQuote>{quote.content}</BlockQuote>
          <Footer>
            <QuoteId>(id: {quote.id})</QuoteId>
            <Attribution>{quote.author.name}</Attribution>
          </Footer>
        </Content>
      </Container>
    );
  }
}


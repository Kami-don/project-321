// @flow
import React from 'react';
import Link from 'gatsby-link';

type ExampleEdge = {
  node: {
    path: string,
  },
};

type ExampleData = {
  allSitePage: {
    edges: [ExampleEdge],
  },
};

const PrivateExamplesList = ({ data }: { data: ExampleData }) => (
  <div>
    <h1>Internal Examples</h1>
    <h2>These examples are for development and not documentation</h2>
    <ul>
      {data.allSitePage.edges.map(({ node }) => (
        <ul key={node.path}>
          <Link to={node.path} href={node.path}>
            {node.path.replace('/private/', '').replace(/\/$/, '')}
          </Link>
        </ul>
      ))}
    </ul>
  </div>
);

export default PrivateExamplesList;

/* eslint-disable no-undef */
// $FlowFixMe
export const query = graphql`
  query privateExampleList {
    allSitePage(filter: { path: { regex: "/^/private/.+/" } }) {
      edges {
        node {
          path
        }
      }
    }
  }
`;

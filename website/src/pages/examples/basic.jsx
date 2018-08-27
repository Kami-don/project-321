// @flow
import React from 'react';
import Example from '../../examples/basic';
import Layout from '../../components/layouts/example';

export default ({
  location,
}: {
  location: {
    pathname: string,
  },
}) => (
  <Layout location={location} examplePath="website/src/examples/basic.jsx">
    <Example />
  </Layout>
);

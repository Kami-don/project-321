// @flow
import React, { type Node } from 'react';
import Codesandboxer from 'react-codesandboxer';
import styled from 'react-emotion';
import pkg from '../../../package.json';
import { grid } from '../constants';

// USEFUL INFO: Codesandboxer pulls info in from github, which means that whatever
// branch is specified on this file will be pulled from, and you will need to push
// if you want to see changes you have made reflected on codesandbox.

const gitInfo = {
  account: 'atlassian',
  repository: 'react-beautiful-dnd',
  host: 'github',
  // this branch variable is the thing to change to repoint codesandboxer.
  // if it is pointing away from master, it should not be merged into master.
  branch: 'master',
};

const importReplacements = [
  ['src', 'react-beautiful-dnd'],
  ['src/', 'react-beautiful-dnd'],
];

const ActionLink = styled('button')`
  border: 2px solid grey;
  margin: 0 ${grid}px;
  padding: ${grid * 1}px ${grid * 2}px;
  border-radius: 2px;
  color: red;
  font-size: 1.1rem;
  font-weight: bold;
  user-select: none;
  box-sizing: border-box;

  /* shared border styles */
  border-width: 4px;
  border-style: solid;

  /* used to align the text next to the icon */
  display: inline-block;
  margin-left: auto;

  :hover {
    cursor: pointer;
    text-decoration: none;
    color: red;
  }
  background-color: red;
  border-color: red;

  :hover,
  :active {
    background-color: red;
  }
`;

const Title = styled('h2')`
  display: inline-block;
`;

const Wrapper = styled('div')`
  display: flex;
  margin-bottom: 20px;
`;

type Props = {
  children: Node,
  path: string,
  title: string,
};

const ExampleWrapper = ({ children, path, title }: Props) => (
  <div>
    <Wrapper>
      <Title>{title}</Title>
      <Codesandboxer
        gitInfo={gitInfo}
        examplePath={path}
        allowJSX
        pkgJSON={pkg}
        dependencies={{
          [pkg.name]: pkg.version,
        }}
        importReplacements={importReplacements}
      >
        {({ isDeploying }) => (
          <ActionLink>
            {isDeploying ? 'Deploying...' : 'Deploy to CSB'}
          </ActionLink>
        )}
      </Codesandboxer>
    </Wrapper>
    {children}
  </div>
);

export default ExampleWrapper;

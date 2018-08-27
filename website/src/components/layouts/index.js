// @flow
import React, { type Node } from 'react';
import { StaticQuery, graphql } from 'gatsby';
import PageWrapper from '../page-wrapper';
import CommonPage from '../common-page';
import type { SidebarData } from '../types';

type Props = {
  children: Node,
};

const PageTemplate = ({ children }: Props) => (
  <StaticQuery
    query={graphql`
      query sidebarInfo {
        examples: allSitePage(filter: { path: { regex: "/^/examples/.+/" } }) {
          edges {
            node {
              path
            }
          }
        }
        docs: allMarkdownRemark(sort: { fields: [fields___dir], order: ASC }) {
          edges {
            node {
              fields {
                slug
                title
                dir
              }
            }
          }
        }
        site: site {
          siteMetadata {
            isDevelopment
          }
        }
      }
    `}
    render={(data: SidebarData) => (
      <CommonPage>
        <PageWrapper
          examples={data.examples}
          docs={data.docs}
          internal={data.internal}
        >
          {children}
        </PageWrapper>
      </CommonPage>
    )}
  />
);

export default PageTemplate;

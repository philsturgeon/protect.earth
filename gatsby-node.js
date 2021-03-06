const path = require(`path`);
const fs = require('fs');
const { createFilePath } = require(`gatsby-source-filesystem`);
const titleCase = require('title-case').titleCase;

const includes = require('lodash').includes;
const union = require('lodash').union;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;
  const typeDefs = `
    type AirtableData implements Node {
      image: String
    }
  `;
  createTypes(typeDefs);
};

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions;
  if (node.internal.type === `MarkdownRemark`) {
    const slug = createFilePath({ node, getNode, basePath: `pages` });
    createNodeField({
      node,
      name: `slug`,
      value: slug,
    });
  }
};

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  const categoriesQuery = await graphql(`
    query {
      allMarkdownRemark {
        edges {
          node {
            frontmatter {
              title
              intro
              image {
                twitterCard: childImageSharp {
                  fixed(quality: 100) {
                    src
                  }
                }
                banner: childImageSharp {
                  fixed(quality: 100, width: 1600) {
                    src
                  }
                }
              }
            }
            fields {
              slug
            }
            html
          }
        }
      }
    }
  `);

  const linksQuery = await graphql(`
    query {
      allAirtable(filter: { data: { status: { eq: "Completed" } } }) {
        nodes {
          data {
            categories
            countries
            description
            featured
            tags
            title
            url
            image
          }
        }
      }
    }
  `);

  const links = linksQuery.data.allAirtable.nodes.map((node) => node.data);

  await asyncForEach(
    categoriesQuery.data.allMarkdownRemark.edges,
    async ({ node }) => {
      const {
        frontmatter,
        fields: { slug },
        html,
      } = node;

      const sanitizedSlug = slug.replace(/^\/|\/$/g, '');
      const linksForThisCategory = links.filter((link) =>
        includes(link.categories, sanitizedSlug)
      );

      createPage({
        path: slug,
        component: path.resolve(`./src/templates/category.jsx`),
        context: {
          category: frontmatter,
          html,
          links: linksForThisCategory,
          slug,
        },
      });
    }
  );

  let allTags = [];

  links.forEach((link) => {
    allTags = union(allTags, link.tags);
  });

  await asyncForEach(allTags, async (tag) => {
    const sanitizedTag = tag.replace(/^\/|\/$/g, '');
    const linksForTag = links.filter((link) =>
      includes(link.tags, sanitizedTag)
    );

    // The tag name with the dashes replaced with spaces and the first letter in each word capitalised.
    const humanReadableTag = titleCase(tag);

    createPage({
      path: `/tags/${tag}`,
      component: path.resolve(`./src/templates/tag.jsx`),
      context: { tag: humanReadableTag, links: linksForTag },
    });
  });
};

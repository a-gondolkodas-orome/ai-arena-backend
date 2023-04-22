module.exports = {
  extends: [
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "@loopback/eslint-config",
  ],
  rules: {
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "variableLike", filter: "__typename", format: null },
    ],
    "@typescript-eslint/restrict-template-expressions": "off",
    // removes the "not null" from graphql types, like @field(() => [String!])
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
  },
};

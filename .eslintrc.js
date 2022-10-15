module.exports = {
  extends: ["@loopback/eslint-config", "prettier"],
  rules: {
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "variableLike", filter: "__typename", format: null },
    ],
  },
};

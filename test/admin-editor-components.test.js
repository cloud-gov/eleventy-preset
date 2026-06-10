import assert from "node:assert/strict";
import test from "node:test";
import { removeDefaultEditorComponents } from "../src/admin/editor-components.js";

test("admin entry removes Decap's default code block editor component", () => {
  const components = new Map([
    ["image", { id: "image" }],
    ["code-block", { id: "code-block" }],
    ["uswds-accordion", { id: "uswds-accordion" }],
  ]);
  const CMS = {
    getEditorComponents() {
      return {
        has: (componentId) => components.has(componentId),
        delete: (componentId) => {
          const filteredComponents = new Map(components);

          filteredComponents.delete(componentId);

          return filteredComponents;
        },
      };
    },
  };

  removeDefaultEditorComponents(CMS);

  const filteredComponents = CMS.getEditorComponents();

  assert.equal(filteredComponents.has("code-block"), false);
  assert.equal(filteredComponents.has("image"), true);
  assert.equal(filteredComponents.has("uswds-accordion"), true);
  assert.equal(components.has("code-block"), true);
});

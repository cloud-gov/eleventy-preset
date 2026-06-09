import { registerUswdsAccordionEditorComponent } from "./admin/uswds-accordion-editor-component.js";
import { registerUswdsCardGroupEditorComponent } from "./admin/uswds-card-group-editor-component.js";

if (typeof window !== "undefined") {
  window.CMS_MANUAL_INIT = true;
}

const cmsReadyPromise = import("decap-cms").then((module) => {
  const CMS = module.default ?? module;

  registerUswdsAccordionEditorComponent(CMS);
  registerUswdsCardGroupEditorComponent(CMS);

  return CMS;
});

const CMS = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") {
        return undefined;
      }

      return (...args) =>
        cmsReadyPromise.then((cms) => {
          const value = cms[prop];

          if (typeof value !== "function") {
            return value;
          }

          return value.apply(cms, args);
        });
    },
  },
);

export default CMS;

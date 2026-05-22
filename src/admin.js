if (typeof window !== "undefined") {
  window.CMS_MANUAL_INIT = true;
}

const cmsPromise = import("decap-cms").then((module) => module.default ?? module);

const CMS = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") {
        return undefined;
      }

      return (...args) =>
        cmsPromise.then((cms) => {
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

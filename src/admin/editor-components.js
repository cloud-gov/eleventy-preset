const DISABLED_EDITOR_COMPONENT_IDS = new Set(["code-block"]);

export function removeDefaultEditorComponents(CMS) {
  if (!CMS || typeof CMS.getEditorComponents !== "function") {
    return;
  }

  const getEditorComponents = CMS.getEditorComponents.bind(CMS);

  CMS.getEditorComponents = () => {
    let editorComponents = getEditorComponents();

    for (const componentId of DISABLED_EDITOR_COMPONENT_IDS) {
      if (editorComponents?.has?.(componentId)) {
        const nextEditorComponents = editorComponents.delete(componentId);

        if (
          nextEditorComponents &&
          typeof nextEditorComponents.has === "function"
        ) {
          editorComponents = nextEditorComponents;
        }
      }
    }

    return editorComponents;
  };
}

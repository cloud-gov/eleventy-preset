import markdownIt from "markdown-it";
import {
  buildAccordionBlock,
  parseAccordionBlock,
  renderUswdsAccordion,
  USWDS_ACCORDION_COMPONENT_ID,
  USWDS_ACCORDION_LABEL,
  USWDS_ACCORDION_PATTERN,
} from "../uswds-accordion.js";

const previewMarkdown = markdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

const fields = [
  {
    label: "Bordered",
    name: "bordered",
    widget: "boolean",
    default: false,
    required: false,
  },
  {
    label: "Allow multiple open items",
    name: "allow_multiple",
    widget: "boolean",
    default: false,
    required: false,
  },
  {
    label: "Items",
    name: "items",
    widget: "list",
    summary: "{{fields.title}}",
    default: [
      {
        title: "First item",
        content: "",
        open: false,
      },
    ],
    fields: [
      {
        label: "Title",
        name: "title",
        widget: "string",
      },
      {
        label: "Content",
        name: "content",
        widget: "markdown",
        editor_components: [],
      },
      {
        label: "Open by default",
        name: "open",
        widget: "boolean",
        default: false,
        required: false,
      },
    ],
  },
];

export function registerUswdsAccordionEditorComponent(CMS) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    return;
  }

  CMS.registerEditorComponent({
    id: USWDS_ACCORDION_COMPONENT_ID,
    label: USWDS_ACCORDION_LABEL,
    fields,
    pattern: USWDS_ACCORDION_PATTERN,
    fromBlock: (match) => parseAccordionBlock(match),
    toBlock: (data) => buildAccordionBlock(data),
    toPreview: (data) =>
      renderUswdsAccordion(data, previewMarkdown, {
        accordionIndex: 1,
      }),
  });
}

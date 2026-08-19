import markdownIt from "markdown-it";
import {
  buildCardGroupBlock,
  parseCardGroupBlock,
  renderUswdsCardGroup,
  USWDS_CARD_GROUP_COMPONENT_ID,
  USWDS_CARD_GROUP_LABEL,
  USWDS_CARD_GROUP_PATTERN,
} from "../uswds-card-group.js";

const previewMarkdown = markdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

const actionFields = [
  {
    label: "Label",
    name: "label",
    widget: "string",
    required: false,
  },
  {
    label: "Href",
    name: "href",
    widget: "string",
    required: false,
  },
];

const fields = [
  {
    label: "CSS classes",
    name: "classes",
    widget: "string",
    required: false,
    default: "tablet:grid-col-6 desktop:grid-col-4",
    hint: "Applied to every card in addition to usa-card. When set, these replace the default responsive width classes.",
  },
  {
    label: "Cards",
    name: "cards",
    widget: "list",
    summary: "{{fields.heading}}",
    default: [{}],
    fields: [
      {
        label: "Heading",
        name: "heading",
        widget: "string",
        required: false,
      },
      {
        label: "Content",
        name: "content",
        widget: "markdown",
        required: false,
        editor_components: [],
      },
      {
        label: "Image",
        name: "image",
        widget: "object",
        required: false,
        collapsed: true,
        fields: [
          {
            label: "Source",
            name: "src",
            widget: "string",
            required: false,
          },
          {
            label: "Alt text",
            name: "alt",
            widget: "string",
            required: false,
          },
        ],
      },
      {
        label: "Button",
        name: "button",
        widget: "object",
        required: false,
        collapsed: true,
        fields: actionFields,
      },
      {
        label: "Secondary link",
        name: "link",
        widget: "object",
        required: false,
        collapsed: true,
        fields: actionFields,
      },
    ],
  },
];

export function registerUswdsCardGroupEditorComponent(CMS) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    return;
  }

  CMS.registerEditorComponent({
    id: USWDS_CARD_GROUP_COMPONENT_ID,
    label: USWDS_CARD_GROUP_LABEL,
    fields,
    pattern: USWDS_CARD_GROUP_PATTERN,
    fromBlock: (match) => parseCardGroupBlock(match),
    toBlock: (data) => buildCardGroupBlock(data),
    toPreview: (data) => renderUswdsCardGroup(data, previewMarkdown),
  });
}

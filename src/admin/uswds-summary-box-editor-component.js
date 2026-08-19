import markdownIt from "markdown-it";
import {
  buildSummaryBoxBlock,
  parseSummaryBoxBlock,
  renderUswdsSummaryBox,
  USWDS_SUMMARY_BOX_COMPONENT_ID,
  USWDS_SUMMARY_BOX_LABEL,
  USWDS_SUMMARY_BOX_PATTERN,
} from "../uswds-summary-box.js";

const previewMarkdown = markdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

const fields = [
  {
    label: "Heading",
    name: "heading",
    widget: "string",
    default: "Key information",
  },
  {
    label: "Heading level",
    name: "heading_level",
    widget: "select",
    options: [
      { label: "Heading 2", value: 2 },
      { label: "Heading 3", value: 3 },
      { label: "Heading 4", value: 4 },
      { label: "Heading 5", value: 5 },
      { label: "Heading 6", value: 6 },
    ],
    default: 2,
  },
  {
    label: "Content",
    name: "content",
    widget: "markdown",
    default: "",
    editor_components: [],
  },
];

export function registerUswdsSummaryBoxEditorComponent(CMS) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    return;
  }

  CMS.registerEditorComponent({
    id: USWDS_SUMMARY_BOX_COMPONENT_ID,
    label: USWDS_SUMMARY_BOX_LABEL,
    fields,
    pattern: USWDS_SUMMARY_BOX_PATTERN,
    fromBlock: (match) => parseSummaryBoxBlock(match),
    toBlock: (data) => buildSummaryBoxBlock(data),
    toPreview: (data) =>
      renderUswdsSummaryBox(data, previewMarkdown, {
        summaryBoxIndex: 1,
      }),
  });
}

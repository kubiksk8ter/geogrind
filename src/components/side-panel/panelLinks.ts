import {
  AUTHOR_LINKEDIN_URL,
  OPERATOR_CONTACT,
  REPOSITORY_URL,
} from "@/config";
import { GitHubMark, LinkedInMark } from "../icons/brandMarks";
import { MailIcon } from "../icons/linkIcons";
import type { PanelLinkDefinition } from "./panelTypes";

/** The icon links of the panel footer, in this order. */
export const PANEL_LINKS: readonly PanelLinkDefinition[] = [
  {
    id: "github",
    href: REPOSITORY_URL,
    Mark: GitHubMark,
    markClassName: "size-6",
  },
  {
    id: "linkedin",
    href: AUTHOR_LINKEDIN_URL,
    Mark: LinkedInMark,
    // A filled square looks larger than the round GitHub mark of the same width.
    markClassName: "size-5",
  },
  {
    id: "email",
    // No subject or text is pre-filled.
    href: `mailto:${OPERATOR_CONTACT}`,
    Mark: MailIcon,
    markClassName: "size-6",
  },
];

import { FlaskConical } from "lucide-react";
import ContentPagesView from "./ContentPagesView";

export default function ResearchPagesView(props) {
  return (
    <ContentPagesView
      title="Research"
      eyebrow="Research Publications"
      description="Manage the research listing, publications, and research detail pages."
      emptyLabel="No research pages match the current filters."
      icon={FlaskConical}
      {...props}
    />
  );
}

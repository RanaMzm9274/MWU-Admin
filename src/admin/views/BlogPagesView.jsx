import { MessageSquare } from "lucide-react";
import ContentPagesView from "./ContentPagesView";

export default function BlogPagesView(props) {
  return (
    <ContentPagesView
      title="Blog Pages"
      eyebrow="Blog and News Pages"
      description="Review imported blog listing and article pages separately from standard website pages."
      emptyLabel="No blog pages match the current filters."
      icon={MessageSquare}
      {...props}
    />
  );
}

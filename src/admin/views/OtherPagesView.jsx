import { FileText } from "lucide-react";
import ContentPagesView from "./ContentPagesView";

export default function OtherPagesView(props) {
  return (
    <ContentPagesView
      title="Other Website Pages"
      eyebrow="General Content Pages"
      description="Review standard website pages that are not programs, blogs, or events."
      emptyLabel="No general website pages match the current filters."
      icon={FileText}
      {...props}
    />
  );
}

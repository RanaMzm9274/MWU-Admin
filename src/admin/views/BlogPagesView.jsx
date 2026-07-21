import { MessageSquare } from "lucide-react";
import ContentPagesView from "./ContentPagesView";

export default function BlogPagesView(props) {
  return (
    <ContentPagesView
      title="News"
      eyebrow="University News"
      description="Manage the news listing and individual news article pages."
      emptyLabel="No news pages match the current filters."
      icon={MessageSquare}
      {...props}
    />
  );
}

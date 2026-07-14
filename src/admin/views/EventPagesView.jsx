import { CalendarDays } from "lucide-react";
import ContentPagesView from "./ContentPagesView";

export default function EventPagesView(props) {
  return (
    <ContentPagesView
      title="Event Pages"
      eyebrow="Event Listing and Detail Pages"
      description="Review imported event listing and event detail pages separately from standard website pages."
      emptyLabel="No event pages match the current filters."
      icon={CalendarDays}
      {...props}
    />
  );
}

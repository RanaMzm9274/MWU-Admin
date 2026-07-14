import { UserPlus } from "lucide-react";
import { StatusPill } from "../components/Common";

export default function CrmView() {
  const leads = [
    {
      name: "Abdi Student",
      source: "Admission Apply",
      interest: "MSc in Public Health",
      status: "New"
    },
    {
      name: "Hana Applicant",
      source: "Program Page",
      interest: "Computer Science",
      status: "Contacted"
    },
    {
      name: "Community Partner",
      source: "Contact Form",
      interest: "Research Partnership",
      status: "Qualified"
    }
  ];

  return (
    <section className="panel crm-view">
      <div className="panel-head">
        <div>
          <span className="eyebrow">CRM Leads</span>
          <h2>Website Enquiries</h2>
        </div>
        <button className="primary-button" type="button">
          <UserPlus size={17} />
          <span>Add Lead</span>
        </button>
      </div>
      <div className="lead-table">
        <div className="lead-row head">
          <span>Name</span>
          <span>Source</span>
          <span>Interest</span>
          <span>Status</span>
        </div>
        {leads.map((lead) => (
          <div className="lead-row" key={lead.name}>
            <strong>{lead.name}</strong>
            <span>{lead.source}</span>
            <span>{lead.interest}</span>
            <StatusPill status={lead.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

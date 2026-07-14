import { CheckItem } from "../components/Common";

export default function SettingsView({ logoSrc }) {
  return (
    <section className="settings-grid">
      <div className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Brand</span>
            <h2>Website Identity</h2>
          </div>
        </div>
        <div className="brand-preview">
          <img src={logoSrc} alt="Madda Walabu University" />
          <div className="swatches">
            <span style={{ background: "#081933" }} />
            <span style={{ background: "#1a4b96" }} />
            <span style={{ background: "#d6a128" }} />
            <span style={{ background: "#0b6b3a" }} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Publishing Rules</span>
            <h2>Approval Flow</h2>
          </div>
        </div>
        <div className="settings-list">
          <CheckItem done label="Draft pages require editor review" />
          <CheckItem done label="Published pages keep JSON export history" />
          <CheckItem done label="Scheduled pages show in the queue" />
          <CheckItem done={false} label="Backend sync endpoint not connected" />
        </div>
      </div>
    </section>
  );
}

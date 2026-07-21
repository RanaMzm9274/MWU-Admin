import { useEffect, useRef, useState } from "react";
import {
  ArchiveRestore,
  CheckCircle2,
  Download,
  FileDown,
  Mail,
  Save,
  Send,
  ShieldCheck,
  Plus,
  Copy,
  Trash2,
  Upload
} from "lucide-react";
import { CheckItem } from "../components/Common";
import { apiUrl, getAuthHeaders, readApiError } from "../runtime/portalRuntime";

const defaultSettings = {
  forms: {
    adminEmail: "",
    successMessage: "Thank you. Your submission has been received.",
    saveEntries: true,
    emailNotifications: true,
    autoReply: false,
    spamProtection: true,
    requireConsent: true,
    maxUploadMb: 10
  },
  smtp: {
    enabled: false,
    host: "",
    port: "587",
    encryption: "tls",
    username: "",
    password: "",
    fromEmail: "",
    fromName: "Madda Walabu University"
  }
};

function loadSettings() {
  return {
    forms: { ...defaultSettings.forms },
    smtp: { ...defaultSettings.smtp }
  };
}

export default function SettingsView({ logoSrc, adminToken, requestDangerConfirmation }) {
  const [settings, setSettings] = useState(loadSettings);
  const [backups, setBackups] = useState([]);
  const [forms, setForms] = useState([]);
  const [formDraft, setFormDraft] = useState({ name: "", shortcode: "", recipientEmail: "", fields: "name,email,message", subject: "New {{form_name}} submission", htmlBody: "<h2>New submission</h2><p>{{all_fields}}</p>", active: true });
  const [notice, setNotice] = useState("");
  const [operation, setOperation] = useState(null);
  const importRef = useRef(null);

  const authHeaders = (json = false) => ({ ...getAuthHeaders(adminToken), ...(json ? { "Content-Type": "application/json" } : {}) });
  const updateProgress = (label, progress) => setOperation({ label, progress });
  const finishProgress = (label) => {
    setOperation({ label, progress: 100 });
    window.setTimeout(() => setOperation(null), 1200);
  };
  const loadServerSettings = async () => {
    try {
      const [settingsResponse, backupsResponse, formsResponse] = await Promise.all([
        fetch(apiUrl("/admin/settings"), { headers: authHeaders() }),
        fetch(apiUrl(`/admin/backups?refresh=${Date.now()}`), { headers: authHeaders(), cache: "no-store" }),
        fetch(apiUrl("/admin/forms"), { headers: authHeaders() })
      ]);
      if (!settingsResponse.ok) throw new Error(await readApiError(settingsResponse, "Could not load settings."));
      if (!backupsResponse.ok) throw new Error(await readApiError(backupsResponse, "Could not load saved backups."));
      if (!formsResponse.ok) throw new Error(await readApiError(formsResponse, "Could not load forms."));
      const remote = await settingsResponse.json();
      setSettings((current) => ({ forms: { ...current.forms, ...(remote.forms || {}) }, smtp: { ...current.smtp, ...(remote.smtp || {}), password: "" } }));
      setBackups((await backupsResponse.json()).backups || []);
      setForms((await formsResponse.json()).forms || []);
    } catch (error) { setNotice(error.message); }
  };

  useEffect(() => { loadServerSettings(); }, [adminToken]);

  const updateGroup = (group, key, value) => {
    setSettings((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const saveSettings = async () => {
    try {
      const [formsResponse, smtpResponse] = await Promise.all([
        fetch(apiUrl("/admin/settings/forms"), { method: "PUT", headers: authHeaders(true), body: JSON.stringify(settings.forms) }),
        fetch(apiUrl("/admin/settings/smtp"), { method: "PUT", headers: authHeaders(true), body: JSON.stringify(settings.smtp) })
      ]);
      if (!formsResponse.ok) throw new Error(await readApiError(formsResponse, "Form settings could not be saved."));
      if (!smtpResponse.ok) throw new Error(await readApiError(smtpResponse, "SMTP could not be verified."));
      const smtpResult = await smtpResponse.json();
      setSettings((current) => ({ ...current, smtp: { ...current.smtp, ...smtpResult.smtp, password: "" } }));
      setNotice(smtpResult.message || "Settings saved and email delivery activated.");
    } catch (error) { setNotice(error.message); }
  };

  const createBackup = async () => {
    updateProgress("Preparing database backup…", 12);
    try {
      const responsePromise = fetch(apiUrl("/admin/backups"), { method: "POST", headers: authHeaders(true), body: "{}" });
      window.setTimeout(() => setOperation((current) => current?.progress < 45 ? { label: "Collecting database records…", progress: 45 } : current), 350);
      const response = await responsePromise;
      if (!response.ok) throw new Error(await readApiError(response, "Backup failed."));
      const createdBackup = await response.json();
      setBackups((current) => [createdBackup, ...current.filter((backup) => backup.id !== createdBackup.id)]);
      updateProgress("Saving backup record…", 82);
      await loadServerSettings();
      setNotice("Database backup created successfully.");
      finishProgress("Backup completed");
    } catch (error) { setOperation(null); setNotice(error.message); }
  };

  const restoreBackup = async (backup) => {
    const confirmed = await requestDangerConfirmation({
      title: "Restore this backup?",
      message: "The selected version will replace the current portal database, settings, styles, and managed website files.",
      details: [
        `Backup: ${backup.name}`,
        `Created: ${new Date(backup.created_at).toLocaleString()}`,
        `Version: ${backup.backup_version || 1}`
      ],
      verificationText: backup.name,
      continueLabel: "Review Restore",
      finalLabel: "Restore Backup"
    });
    if (!confirmed) return;
    updateProgress("Validating backup…", 10);
    try {
      const responsePromise = fetch(apiUrl(`/admin/backups/${backup.id}/restore`), { method: "POST", headers: authHeaders(true), body: "{}" });
      window.setTimeout(() => setOperation((current) => current?.progress < 38 ? { label: "Restoring database tables…", progress: 38 } : current), 300);
      window.setTimeout(() => setOperation((current) => current?.progress < 72 ? { label: "Applying restored settings…", progress: 72 } : current), 900);
      const response = await responsePromise;
      if (!response.ok) throw new Error(await readApiError(response, "Restore failed."));
      finishProgress("Restore completed");
      setNotice("Database backup restored. Reloading the portal…");
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) { setOperation(null); setNotice(error.message); }
  };

  const exportBackup = async (backup) => {
    const response = await fetch(apiUrl(`/admin/backups/${backup.id}/export`), { headers: authHeaders() });
    if (!response.ok) return setNotice(await readApiError(response, "Export failed."));
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
    link.href = url; link.download = `${backup.name || "mwu-backup"}.${backup.backup_format === "zip" ? "zip" : "json"}`; link.click(); URL.revokeObjectURL(url);
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    try {
      updateProgress("Reading backup file…", 12);
      updateProgress("Uploading backup to database…", 42);
      const isZip = file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip");
      const response = isZip
        ? await fetch(apiUrl("/admin/backups/import"), { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/zip", "X-Backup-Name": file.name.replace(/\.zip$/i, "") }, body: file })
        : await fetch(apiUrl("/admin/backups/import"), { method: "POST", headers: authHeaders(true), body: JSON.stringify({ name: file.name.replace(/\.json$/i, ""), backup: JSON.parse(await file.text()) }) });
      if (!response.ok) throw new Error(await readApiError(response, "Import failed."));
      updateProgress("Indexing imported backup…", 82);
      await loadServerSettings(); setNotice("Backup imported into the database. It is now available to restore.");
      finishProgress("Import completed");
    } catch (error) { setOperation(null); setNotice(error.message || "Import failed. Select a valid MWU database backup JSON file."); }
  };

  const deleteBackup = async (backup) => {
    const verificationText = `DELETE ${backup.id}`;
    const confirmed = await requestDangerConfirmation({
      title: "Delete this backup permanently?",
      message: "This removes the selected recovery point from the database. It cannot be restored after deletion.",
      details: [
        `Backup: ${backup.name}`,
        `Created: ${new Date(backup.created_at).toLocaleString()}`,
        `Size: ${Math.max(1, Math.round(Number(backup.size_bytes || 0) / 1024))} KB`
      ],
      verificationText,
      continueLabel: "Review Deletion",
      finalLabel: "Delete Backup"
    });
    if (!confirmed) return;
    const response = await fetch(apiUrl(`/admin/backups/${backup.id}`), { method: "DELETE", headers: authHeaders(true), body: JSON.stringify({ confirmation: verificationText }) });
    if (!response.ok) return setNotice(await readApiError(response, "Backup deletion failed."));
    setBackups((current) => current.filter((item) => item.id !== backup.id));
    setNotice("Backup permanently deleted from the database.");
  };

  const createForm = async () => {
    if (!settings.smtp.verified) return setNotice("SMTP not configured. Save and verify SMTP before activating a form.");
    const payload = { ...formDraft, fields: formDraft.fields.split(",").map((name) => ({ name: name.trim(), type: name.trim().toLowerCase().includes("email") ? "email" : "text", required: true })).filter((field) => field.name) };
    const response = await fetch(apiUrl("/admin/forms"), { method: "POST", headers: authHeaders(true), body: JSON.stringify(payload) });
    if (!response.ok) return setNotice(await readApiError(response, "Form could not be created."));
    const result = await response.json(); await loadServerSettings();
    setNotice(`Form created. Add ${result.shortcode} to any page.`);
  };

  const testSmtp = () => {
    const smtp = settings.smtp;
    if (!smtp.enabled) return setNotice("Enable SMTP before testing the configuration.");
    if (!smtp.host || !smtp.port || !smtp.fromEmail) return setNotice("Enter SMTP host, port, and sender email first.");
    if (!/^\S+@\S+\.\S+$/.test(smtp.fromEmail)) return setNotice("Enter a valid sender email address.");
    saveSettings();
  };

  return (
    <section className="settings-page">
      <div className="settings-heading">
        <div><span className="eyebrow">Portal Configuration</span><h2>Settings</h2><p>Manage forms, email delivery, and recoverable portal backups.</p></div>
        <button className="primary-button" type="button" onClick={saveSettings}><Save size={17} /><span>Save Settings</span></button>
      </div>

      {notice && <div className="settings-notice" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}
      {operation && <div className="operation-progress" role="status" aria-live="polite"><div className="operation-progress-head"><strong>{operation.label}</strong><span>{operation.progress}%</span></div><div className="operation-progress-track"><i style={{ width: `${operation.progress}%` }} /></div></div>}

      <div className="settings-grid settings-grid-wide">
        <div className="panel settings-card">
          <div className="panel-head compact"><div><span className="eyebrow">Forms</span><h2>Form Settings</h2><p>WordPress-style defaults for every public website form.</p></div><ShieldCheck size={22} /></div>
          <div className="settings-form">
            <label className="field"><span>Form notification email</span><input type="email" value={settings.forms.adminEmail} placeholder="forms@mwu.edu.et" onChange={(e) => updateGroup("forms", "adminEmail", e.target.value)} /></label>
            <label className="field field-full"><span>Default success message</span><textarea rows="3" value={settings.forms.successMessage} onChange={(e) => updateGroup("forms", "successMessage", e.target.value)} /></label>
            <label className="field"><span>Maximum upload size (MB)</span><input type="number" min="1" max="100" value={settings.forms.maxUploadMb} onChange={(e) => updateGroup("forms", "maxUploadMb", Number(e.target.value))} /></label>
            <div className="settings-toggles field-full">
              {[
                ["saveEntries", "Save form entries"], ["emailNotifications", "Email administrator"],
                ["autoReply", "Send visitor auto-reply"], ["spamProtection", "Enable spam protection"],
                ["requireConsent", "Require privacy consent"]
              ].map(([key, label]) => <label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={settings.forms[key]} onChange={(e) => updateGroup("forms", key, e.target.checked)} /></label>)}
            </div>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="panel-head compact"><div><span className="eyebrow">Email Delivery</span><h2>SMTP Settings</h2><p>Configure authenticated email for form notifications and activation emails.</p></div><Mail size={22} /></div>
          <div className="settings-form">
            <label className="toggle-row field-full smtp-enable"><span><strong>Enable SMTP {settings.smtp.verified ? "· Verified" : "· Not verified"}</strong><small>Route activation and form email through this mail server.</small></span><input type="checkbox" checked={settings.smtp.enabled} onChange={(e) => updateGroup("smtp", "enabled", e.target.checked)} /></label>
            <label className="field"><span>SMTP host</span><input value={settings.smtp.host} placeholder="smtp.example.com" onChange={(e) => updateGroup("smtp", "host", e.target.value)} /></label>
            <label className="field"><span>Port</span><input inputMode="numeric" value={settings.smtp.port} onChange={(e) => updateGroup("smtp", "port", e.target.value)} /></label>
            <label className="field"><span>Encryption</span><select value={settings.smtp.encryption} onChange={(e) => updateGroup("smtp", "encryption", e.target.value)}><option value="tls">TLS</option><option value="ssl">SSL</option><option value="none">None</option></select></label>
            <label className="field"><span>Username</span><input autoComplete="off" value={settings.smtp.username} onChange={(e) => updateGroup("smtp", "username", e.target.value)} /></label>
            <label className="field"><span>Password / app password</span><input type="password" autoComplete="new-password" value={settings.smtp.password} onChange={(e) => updateGroup("smtp", "password", e.target.value)} /></label>
            <label className="field"><span>From email</span><input type="email" value={settings.smtp.fromEmail} placeholder="noreply@mwu.edu.et" onChange={(e) => updateGroup("smtp", "fromEmail", e.target.value)} /></label>
            <label className="field field-full"><span>From name</span><input value={settings.smtp.fromName} onChange={(e) => updateGroup("smtp", "fromName", e.target.value)} /></label>
            <div className="settings-actions field-full"><button className="ghost-button" type="button" onClick={testSmtp}><Send size={16} /><span>Validate SMTP</span></button></div>
          </div>
        </div>

        <div className="panel settings-card settings-backup-card">
          <div className="panel-head compact"><div><span className="eyebrow">Forms & Templates</span><h2>Form Builder</h2><p>Create SMTP-connected forms and embed them on a page with a shortcode.</p></div><Plus size={22} /></div>
          {!settings.smtp.verified && <div className="form-smtp-error">SMTP not configured. Forms cannot be activated until SMTP settings are saved and verified.</div>}
          <div className="settings-form form-builder-fields">
            <label className="field"><span>Form name</span><input value={formDraft.name} placeholder="Contact form" onChange={(e) => setFormDraft((current) => ({ ...current, name: e.target.value }))} /></label>
            <label className="field"><span>Shortcode ID</span><input value={formDraft.shortcode} placeholder="contact-us" onChange={(e) => setFormDraft((current) => ({ ...current, shortcode: e.target.value }))} /></label>
            <label className="field"><span>Recipient email</span><input type="email" value={formDraft.recipientEmail} placeholder="office@mwu.edu.et" onChange={(e) => setFormDraft((current) => ({ ...current, recipientEmail: e.target.value }))} /></label>
            <label className="field"><span>Fields (comma separated)</span><input value={formDraft.fields} onChange={(e) => setFormDraft((current) => ({ ...current, fields: e.target.value }))} /></label>
            <label className="field field-full"><span>Email subject template</span><input value={formDraft.subject} onChange={(e) => setFormDraft((current) => ({ ...current, subject: e.target.value }))} /></label>
            <label className="field field-full"><span>Email HTML template</span><textarea className="code-template" rows="7" value={formDraft.htmlBody} onChange={(e) => setFormDraft((current) => ({ ...current, htmlBody: e.target.value }))} /><small>Template variables: {"{{form_name}}"}, {"{{all_fields}}"}, and any field name such as {"{{email}}"}.</small></label>
            <div className="settings-actions field-full"><button className="primary-button" type="button" disabled={!settings.smtp.verified} onClick={createForm}><Plus size={16} /><span>Create & Activate Form</span></button></div>
          </div>
          <div className="created-forms-list">
            {forms.map((form) => <div className="backup-row" key={form.id}><div><strong>{form.name}</strong><code>[mwu_form id="{form.shortcode}"]</code><span>{form.recipient_email} · {form.active ? "Active" : "Inactive"}</span></div><button className="icon-button" type="button" title="Copy shortcode" onClick={() => { navigator.clipboard.writeText(`[mwu_form id="${form.shortcode}"]`); setNotice("Shortcode copied."); }}><Copy size={16} /></button></div>)}
          </div>
        </div>

        <div className="panel settings-card settings-backup-card database-backups-card">
          <div className="panel-head compact"><div><span className="eyebrow">Recovery</span><h2>Full Backup & Restore</h2><p>Versioned snapshots include database content, users, settings, styles, generated pages, navigation partials, forms, and site data files.</p></div><ArchiveRestore size={22} /></div>
          <div className="backup-toolbar">
            <button className="primary-button" type="button" onClick={createBackup}><Download size={16} /><span>Take Backup</span></button>
            <button className="ghost-button" type="button" onClick={() => importRef.current?.click()}><Upload size={16} /><span>Import to Database</span></button>
            <input ref={importRef} hidden type="file" accept="application/zip,.zip,application/json,.json" onChange={importBackup} />
            <span className="backup-storage-label">Stored securely in the database</span>
          </div>
          <div className="backup-list">
            {backups.length === 0 && <div className="backup-empty"><ArchiveRestore size={25} /><strong>No saved backups yet</strong><span>Take a backup before major website changes.</span></div>}
            {backups.map((backup, index) => (
              <div className="backup-row" key={backup.id || index}>
                <div><strong>{backup.name}</strong><span>{new Date(backup.created_at).toLocaleString()} · {Math.max(1, Math.round(Number(backup.size_bytes || 0) / 1024))} KB · {String(backup.backup_format || "json").toUpperCase()} · Version {backup.backup_version || 1} · {Number(backup.file_count || 0)} files</span></div>
                <div className="backup-row-actions"><button className="ghost-button" type="button" title="Export backup" onClick={() => exportBackup(backup)}><FileDown size={16} /><span>Export</span></button><button className="ghost-button" type="button" onClick={() => restoreBackup(backup)}><ArchiveRestore size={16} /><span>Restore</span></button><button className="danger-button" type="button" onClick={() => deleteBackup(backup)}><Trash2 size={16} /><span>Delete</span></button></div>
              </div>
            ))}
          </div>
          <p className="backup-security-note">Deletion is protected by your authenticated session and a two-step typed confirmation.</p>
        </div>

        <div className="panel settings-card settings-summary-card">
          <div className="panel-head compact"><div><span className="eyebrow">System</span><h2>Website Identity & Rules</h2></div></div>
          <div className="brand-preview"><img src={logoSrc} alt="Madda Walabu University" /><div className="swatches"><span style={{ background: "#081933" }} /><span style={{ background: "#1a4b96" }} /><span style={{ background: "#d6a128" }} /><span style={{ background: "#0b6b3a" }} /></div></div>
          <div className="settings-list"><CheckItem done label="Draft pages require editor review" /><CheckItem done label="Published pages keep export history" /><CheckItem done label="Scheduled pages show in the queue" /></div>
        </div>
      </div>
    </section>
  );
}

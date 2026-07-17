import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Mail, Save, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Field, StatusPill } from "../components/Common";

export default function UserManagementView({
  users,
  activeAdmin,
  accessModules,
  rolePresets,
  onSaveUser,
  onDeleteUser,
  onSendInvite,
  onSetNotice
}) {
  const defaultRole = rolePresets[1] || rolePresets[0];
  const createBlankUser = () => ({
    id: "",
    name: "",
    email: "",
    role: defaultRole?.id || "content-manager",
    status: "Active",
    department: "",
    access: defaultRole?.access || {},
    temporaryPassword: "",
    sendInvite: true
  });

  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const [draftUser, setDraftUser] = useState(() => users[0] || createBlankUser());
  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!users.length) {
      return;
    }
    if (selectedUserId) {
      const freshUser = users.find((user) => String(user.id) === String(selectedUserId));
      if (freshUser) {
        setDraftUser((current) => ({ ...freshUser, temporaryPassword: current.temporaryPassword || "", sendInvite: current.sendInvite ?? true }));
      }
      return;
    }
    setSelectedUserId(users[0].id);
    setDraftUser({ ...users[0], temporaryPassword: "", sendInvite: true });
  }, [selectedUserId, users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name, user.email, user.role, user.department, user.status]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, users]);

  const activeModules = accessModules.filter((module) => draftUser.access?.[module.id]);
  const activeUsers = users.filter((user) => user.status === "Active");

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    setDraftUser({ ...user, access: { ...(user.access || {}) }, temporaryPassword: "", sendInvite: true });
  };

  const startNewUser = () => {
    setSelectedUserId("");
    setDraftUser(createBlankUser());
  };

  const updateDraft = (field, value) => {
    setDraftUser((current) => ({ ...current, [field]: value }));
  };

  const applyRolePreset = (roleId) => {
    const preset = rolePresets.find((role) => role.id === roleId) || defaultRole;
    setDraftUser((current) => ({
      ...current,
      role: preset?.id || roleId,
      access: { ...(preset?.access || {}) }
    }));
  };

  const toggleModule = (moduleId) => {
    setDraftUser((current) => ({
      ...current,
      access: {
        ...(current.access || {}),
        [moduleId]: !current.access?.[moduleId]
      }
    }));
  };

  const submitUser = async (event) => {
    event.preventDefault();
    if (!draftUser.name.trim() || !draftUser.email.trim()) {
      onSetNotice("User name and email are required.");
      return;
    }

    setSaving(true);
    try {
      const savedUser = await onSaveUser(draftUser);
      setSelectedUserId(savedUser.id);
      setDraftUser({ ...savedUser, temporaryPassword: "", sendInvite: true });
    } catch (error) {
      onSetNotice(error.message || "User save failed.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedUser = async () => {
    if (!selectedUserId) return;
    setDeleting(true);
    try {
      await onDeleteUser(selectedUserId);
      const remaining = users.filter((user) => user.id !== selectedUserId);
      const nextUser = remaining[0] || createBlankUser();
      setSelectedUserId(nextUser.id || "");
      setDraftUser({ ...nextUser, temporaryPassword: "", sendInvite: true });
    } catch (error) {
      onSetNotice(error.message || "User delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const sendInvite = async () => {
    if (!selectedUserId) {
      onSetNotice("Save the user before sending an invite.");
      return;
    }
    setSendingInvite(true);
    try {
      const savedUser = await onSendInvite(selectedUserId);
      setDraftUser({ ...savedUser, temporaryPassword: "", sendInvite: true });
    } catch (error) {
      onSetNotice(error.message || "Invite email failed.");
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <section className="admin-view user-management-view">
      <div className="view-header">
        <div>
          <span className="eyebrow">Access Control</span>
          <h2>User Management</h2>
          <p>Create portal users, assign role presets, and choose the admin modules each person can open.</p>
        </div>
        <div className="user-management-summary">
          <div>
            <Users size={19} />
            <strong>{users.length}</strong>
            <span>Total Users</span>
          </div>
          <div>
            <CheckCircle2 size={19} />
            <strong>{activeUsers.length}</strong>
            <span>Active</span>
          </div>
          <div>
            <ShieldCheck size={19} />
            <strong>{activeModules.length}</strong>
            <span>Current Access</span>
          </div>
        </div>
      </div>

      <div className="view-content user-management-grid">
        <section className="panel user-list-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Users</span>
              <h2>Portal Accounts</h2>
            </div>
            <button className="primary-button" type="button" onClick={startNewUser}>
              <UserPlus size={16} />
              <span>Add User</span>
            </button>
          </div>

          <div className="user-list-toolbar">
            <label className="search-field no-margin">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
            </label>
          </div>

          <div className="user-list">
            {filteredUsers.map((user) => {
              const moduleCount = accessModules.filter((module) => user.access?.[module.id]).length;
              return (
                <button
                  className={selectedUserId === user.id ? "user-row active" : "user-row"}
                  type="button"
                  key={user.id}
                  onClick={() => selectUser(user)}
                >
                  <span className="user-avatar">{getInitials(user.name || user.email)}</span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </span>
                  <span className="user-row-meta">
                    <StatusPill status={user.status} />
                    <small>{moduleCount} modules</small>
                  </span>
                </button>
              );
            })}

            {!filteredUsers.length && (
              <div className="empty-state">
                <Users size={24} />
                <strong>No users found</strong>
                <span>Adjust the search or create a new portal user.</span>
              </div>
            )}
          </div>
        </section>

        <form className="panel user-editor-panel" onSubmit={submitUser}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Personalized Access</span>
              <h2>{selectedUserId ? "Edit User" : "New User"}</h2>
            </div>
            <div className="header-actions">
              {selectedUserId && selectedUserId !== activeAdmin?.id && (
                <button className="danger-button" type="button" onClick={deleteSelectedUser} disabled={deleting || saving}>
                  <Trash2 size={16} />
                  <span>{deleting ? "Deleting..." : "Delete"}</span>
                </button>
              )}
              {selectedUserId && (
                <button className="ghost-button" type="button" onClick={sendInvite} disabled={sendingInvite || saving}>
                  <Mail size={16} />
                  <span>{sendingInvite ? "Sending..." : "Send Invite"}</span>
                </button>
              )}
              <button className="primary-button" type="submit" disabled={saving || deleting}>
                <Save size={16} />
                <span>{saving ? "Saving..." : "Save User"}</span>
              </button>
            </div>
          </div>

          <div className="user-editor-body">
            <div className="field-grid">
              <Field label="Full Name">
                <input value={draftUser.name} onChange={(event) => updateDraft("name", event.target.value)} required />
              </Field>
              <Field label="Email">
                <input type="email" value={draftUser.email} onChange={(event) => updateDraft("email", event.target.value)} required />
              </Field>
              <Field label="Department">
                <input value={draftUser.department} onChange={(event) => updateDraft("department", event.target.value)} placeholder="Content Office" />
              </Field>
              <Field label="Status">
                <select value={draftUser.status} onChange={(event) => updateDraft("status", event.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Invited">Invited</option>
                </select>
              </Field>
              <Field label="Role Preset">
                <select value={draftUser.role} onChange={(event) => applyRolePreset(event.target.value)}>
                  {rolePresets.map((role) => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Login Password">
                <div className="password-field-row">
                  <input
                    type="text"
                    value={draftUser.temporaryPassword || ""}
                    onChange={(event) => updateDraft("temporaryPassword", event.target.value)}
                    placeholder={selectedUserId ? "Leave blank to keep current password" : "Auto-generated if blank"}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Generate password"
                    onClick={() => updateDraft("temporaryPassword", generatePassword())}
                  >
                    <KeyRound size={16} />
                  </button>
                </div>
              </Field>
              <Field label="Invite Email">
                <label className="readonly-field">
                  <input
                    type="checkbox"
                    checked={Boolean(draftUser.sendInvite)}
                    onChange={(event) => updateDraft("sendInvite", event.target.checked)}
                  />
                  <KeyRound size={16} />
                  <span>Email login details after saving</span>
                </label>
              </Field>
            </div>

            <section className="permission-panel">
              <div className="permission-panel-head">
                <div>
                  <span className="eyebrow">Module Permissions</span>
                  <h3>Portal Access</h3>
                </div>
                <small>{activeModules.length} of {accessModules.length} enabled</small>
              </div>

              <div className="permission-grid">
                {accessModules.map((module) => (
                  <label className="permission-tile" key={module.id}>
                    <input
                      type="checkbox"
                      checked={Boolean(draftUser.access?.[module.id])}
                      onChange={() => toggleModule(module.id)}
                    />
                    <span>
                      <strong>{module.label}</strong>
                      <small>{module.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </form>
      </div>
    </section>
  );
}

const getInitials = (value = "") => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
};

const generatePassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const values = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  isPaid: boolean;
  accessDenied: boolean;
  createdAt: string;
};

type EditableUser = Pick<AdminUser, "name" | "email" | "isPaid" | "accessDenied">;

type State = { id: number; name: string; abbreviation: string };

function editableUser(user: AdminUser): EditableUser {
  return {
    name: user.name,
    email: user.email,
    isPaid: user.isPaid,
    accessDenied: user.accessDenied,
  };
}

export default function Admin() {
  const { user, apiFetch } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [savedUsers, setSavedUsers] = useState<Record<number, EditableUser>>({});
  const [savedUserIds, setSavedUserIds] = useState<number[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stateId, setStateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, statesResponse] = await Promise.all([
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/states"),
      ]);
      const usersData = await usersResponse.json();
      const statesData = await statesResponse.json();
      if (!usersResponse.ok || !statesResponse.ok) {
        throw new Error(usersData.error ?? statesData.error ?? "Unable to load admin data");
      }
      setUsers(usersData.users);
      setSavedUsers(Object.fromEntries(
        usersData.users.map((entry: AdminUser) => [entry.id, editableUser(entry)]),
      ));
      setSavedUserIds([]);
      setStates(statesData.states);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.isAdmin) void loadData();
  }, [user?.isAdmin]);

  function updateUser(id: number, patch: Partial<AdminUser>) {
    setUsers((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
    setSavedUserIds((current) => current.filter((savedId) => savedId !== id));
  }

  function hasUnsavedChanges(entry: AdminUser): boolean {
    const saved = savedUsers[entry.id];
    return !saved || Object.entries(saved).some(
      ([key, value]) => entry[key as keyof EditableUser] !== value,
    );
  }

  async function saveUser(entry: AdminUser) {
    setSavingUserId(entry.id);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`/api/admin/users/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entry.name,
          email: entry.email,
          isPaid: entry.isPaid,
          accessDenied: entry.accessDenied,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update user");
      setUsers((current) => current.map((item) => item.id === entry.id ? data.user : item));
      setSavedUsers((current) => ({ ...current, [entry.id]: editableUser(data.user) }));
      setSavedUserIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);
      setMessage(`Updated ${data.user.email}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update user");
    } finally {
      setSavingUserId(null);
    }
  }

  async function uploadTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !stateId || !name.trim()) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const query = new URLSearchParams({ stateId, name: name.trim() });
      if (description.trim()) query.set("description", description.trim());
      const response = await apiFetch(`/api/admin/trails/gpx?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/gpx+xml" },
        body: await file.text(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create trail");
      setMessage(`Created trail: ${data.trail.name}`);
      setName("");
      setDescription("");
      setFile(null);
      const input = document.getElementById("gpx-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to create trail");
    } finally {
      setUploading(false);
    }
  }

  if (!user?.isAdmin) {
    return (
      <section className="panel admin-panel">
        <p className="eyebrow">Restricted</p>
        <h1>Administrator access required</h1>
        <Link to="/">Return to trails</Link>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <p className="eyebrow">Administration</p>
      <h1>Admin</h1>
      {error && <p className="preference-notification error" role="alert">{error}</p>}
      {message && <p className="preference-notification" role="status">{message}</p>}

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Users</h2>
          <span>{users.length}</span>
        </div>
        {loading ? <p>Loading users...</p> : (
          <div className="admin-table-wrap">
            <table className="admin-user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Paid</th>
                  <th>Access denied</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.id}>
                    <td><input aria-label={`Name for ${entry.email}`} value={entry.name} disabled={savingUserId === entry.id} onChange={(event) => updateUser(entry.id, { name: event.target.value })} /></td>
                    <td><input aria-label={`Email for ${entry.email}`} type="email" value={entry.email} disabled={savingUserId === entry.id} onChange={(event) => updateUser(entry.id, { email: event.target.value })} /></td>
                    <td><input aria-label={`Paid status for ${entry.email}`} type="checkbox" checked={entry.isPaid} disabled={savingUserId === entry.id} onChange={(event) => updateUser(entry.id, { isPaid: event.target.checked })} /></td>
                    <td><input aria-label={`Access denied status for ${entry.email}`} type="checkbox" checked={entry.accessDenied} disabled={savingUserId === entry.id} onChange={(event) => updateUser(entry.id, { accessDenied: event.target.checked })} /></td>
                    <td className="admin-user-actions">
                      <button type="button" onClick={() => void saveUser(entry)} disabled={savingUserId === entry.id || !hasUnsavedChanges(entry)}>{savingUserId === entry.id ? "Saving..." : "Save"}</button>
                      {savedUserIds.includes(entry.id) && <span className="admin-user-saved" role="status">Saved</span>}
                    </td>
                  </tr>
                ))}
                {!users.length && <tr><td colSpan={5}>No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><h2>Create trail from GPX</h2></div>
        <form className="composer admin-gpx-form" onSubmit={uploadTrack}>
          <label className="floating-field">
            <input placeholder=" " value={name} required pattern=".*\S.*" title="Enter a name with at least one non-space character" onChange={(event) => setName(event.target.value)} />
            <span>Trail name</span>
          </label>
          <label className="floating-field">
            <input placeholder=" " value={description} onChange={(event) => setDescription(event.target.value)} />
            <span>Description (optional)</span>
          </label>
          <label className="floating-field">
            <select required value={stateId} onChange={(event) => setStateId(event.target.value)}>
              <option value="">Choose state</option>
              {states.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
            <span>State</span>
          </label>
          <label className="admin-file-field" htmlFor="gpx-file">
            <span>GPX track</span>
            <input id="gpx-file" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={!file || !stateId || !name.trim() || uploading}>{uploading ? "Creating trail..." : "Upload GPX and create trail"}</button>
        </form>
      </section>
    </section>
  );
}
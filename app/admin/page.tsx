"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

interface Facility {
  id: string;
  name: string;
  region: string;
  prefecture: string;
  address: string;
  description: string;
  copy?: string;
  url: string;
  thumbnail?: string;
  tags: string[];
  lat: number;
  lng: number;
  access: {
    train: string;
    bus: string;
    car: string;
    rank: string;
  };
  verified?: boolean;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Check if already authenticated
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("adminAuth");
      if (auth === "1") {
        setIsAuthenticated(true);
        loadFacilities();
      }
    }
  }, []);

  const handleLogin = () => {
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!correctPassword) {
      setError("Admin password not configured");
      return;
    }
    if (password === correctPassword) {
      sessionStorage.setItem("adminAuth", "1");
      setIsAuthenticated(true);
      setPassword("");
      setError("");
      loadFacilities();
    } else {
      setError("Incorrect password");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    setFacilities([]);
    setSaveMessage("");
  };

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://api.github.com/repos/" +
          process.env.NEXT_PUBLIC_GITHUB_REPO +
          "/contents/app/data/facilities.json",
        {
          headers: {
            Authorization: `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch facilities");
      }
      const data = await response.json();
      const decodedContent = Buffer.from(data.content, "base64").toString();
      const facilitiesData = JSON.parse(decodedContent);
      setFacilities(facilitiesData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load facilities"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveFacilities = async (updatedFacilities: Facility[]) => {
    setIsSaving(true);
    setSaveMessage("");
    try {
      const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
      const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;

      // 1. Get current SHA
      const getRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/app/data/facilities.json`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (!getRes.ok) throw new Error("Failed to get current file");
      const fileData = await getRes.json();

      // 2. PUT updated content
      const newContent = JSON.stringify(updatedFacilities, null, 2);
      const encodedContent = Buffer.from(newContent).toString("base64");

      const putRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/app/data/facilities.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "chore(admin): update facilities.json via admin dashboard",
            content: encodedContent,
            sha: fileData.sha,
            branch: "main",
          }),
        }
      );

      if (!putRes.ok) throw new Error("Failed to save to GitHub");

      setFacilities(updatedFacilities);
      setSaveMessage(
        "✓ Saved and deployed! GitHub Actions will update the site in ~1 minute."
      );
      setTimeout(() => setSaveMessage(""), 5000);
      setShowEditModal(false);
      setEditingFacility(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditFacility = (facility: Facility) => {
    setEditingFacility({ ...facility });
    setShowEditModal(true);
  };

  const handleAddFacility = () => {
    const newId = `jomon-facility-${Date.now()}`;
    setEditingFacility({
      id: newId,
      name: "",
      region: "Tohoku",
      prefecture: "",
      address: "",
      description: "",
      copy: "",
      url: "",
      tags: [],
      lat: 0,
      lng: 0,
      access: {
        train: "",
        bus: "",
        car: "",
        rank: "C",
      },
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingFacility) return;

    // Validation
    if (!editingFacility.name.trim()) {
      setError("Name is required");
      return;
    }
    if (editingFacility.description.length < 200) {
      setError(
        `Description must be at least 200 characters (current: ${editingFacility.description.length})`
      );
      return;
    }

    const updated = facilities.map((f) =>
      f.id === editingFacility.id ? editingFacility : f
    );

    // If it's a new facility
    if (!facilities.find((f) => f.id === editingFacility.id)) {
      updated.push(editingFacility);
    }

    saveFacilities(updated);
  };

  const handleDeleteFacility = (id: string) => {
    if (!confirm("Are you sure you want to delete this facility?")) return;
    const updated = facilities.filter((f) => f.id !== id);
    saveFacilities(updated);
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h1>JOMON PORTAL — Admin</h1>
          <p className={styles.subtitle}>Management Dashboard</p>
          {error && <div className={styles.errorAlert}>{error}</div>}
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            className={styles.passwordInput}
            autoFocus
          />
          <button
            onClick={handleLogin}
            className={styles.loginButton}
            disabled={!password}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Admin Dashboard</h1>
          <div className={styles.headerActions}>
            <div className={styles.ga4Info}>
              GA4 ID:{" "}
              <code>{process.env.NEXT_PUBLIC_GA4_ID || "Not configured"}</code>
            </div>
            <button
              onClick={handleLogout}
              className={styles.logoutButton}
              title="Logout"
            >
              ↪ Logout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {saveMessage && (
        <div className={styles.successAlert}>{saveMessage}</div>
      )}

      <main className={styles.main}>
        <section className={styles.facilitiesSection}>
          <div className={styles.sectionHeader}>
            <h2>Facilities ({facilities.length})</h2>
            <button
              onClick={handleAddFacility}
              className={styles.addButton}
              title="Add new facility"
            >
              + Add Facility
            </button>
          </div>

          {loading ? (
            <p className={styles.loading}>Loading facilities...</p>
          ) : facilities.length === 0 ? (
            <p className={styles.empty}>No facilities loaded</p>
          ) : (
            <div className={styles.facilitiesTable}>
              <div className={styles.tableHeader}>
                <div className={styles.colId}>ID</div>
                <div className={styles.colName}>Name</div>
                <div className={styles.colPref}>Prefecture</div>
                <div className={styles.colDesc}>Description</div>
                <div className={styles.colActions}>Actions</div>
              </div>
              {facilities.map((facility) => (
                <div key={facility.id} className={styles.tableRow}>
                  <div className={styles.colId}>
                    <code>{facility.id}</code>
                  </div>
                  <div className={styles.colName}>{facility.name}</div>
                  <div className={styles.colPref}>{facility.prefecture}</div>
                  <div
                    className={
                      facility.description.length < 200
                        ? styles.colDescWarning
                        : styles.colDesc
                    }
                  >
                    {facility.description.length} chars
                  </div>
                  <div className={styles.colActions}>
                    <button
                      onClick={() => handleEditFacility(facility)}
                      className={styles.editButton}
                      title="Edit"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteFacility(facility.id)}
                      className={styles.deleteButton}
                      title="Delete"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* GA4 Analytics Section */}
        <section className={styles.analyticsSection}>
          <h2>Analytics Integration</h2>
          <p>
            GA4 measurement ID: <code>{process.env.NEXT_PUBLIC_GA4_ID}</code>
          </p>
          <p className={styles.analyticsNote}>
            Future analytics dashboard integration will be added here.
          </p>
        </section>
      </main>

      {/* Edit Modal */}
      {showEditModal && editingFacility && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>
                {facilities.find((f) => f.id === editingFacility.id)
                  ? "Edit Facility"
                  : "Add New Facility"}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                }}
                className={styles.closeButton}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {error && (
                <div className={styles.errorAlert}>
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className={styles.formGroup}>
                <label>ID (slug)</label>
                <input
                  type="text"
                  value={editingFacility.id}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      id: e.target.value,
                    })
                  }
                  placeholder="e.g., sannaimaruyama"
                  disabled={facilities.some(
                    (f) => f.id === editingFacility.id
                  )}
                />
              </div>

              <div className={styles.formGroup}>
                <label>
                  Name * <span className={styles.required}>(required)</span>
                </label>
                <input
                  type="text"
                  value={editingFacility.name}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      name: e.target.value,
                    })
                  }
                  placeholder="Facility name"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Region</label>
                  <select
                    value={editingFacility.region}
                    onChange={(e) =>
                      setEditingFacility({
                        ...editingFacility,
                        region: e.target.value,
                      })
                    }
                  >
                    <option value="Hokkaido">北海道</option>
                    <option value="Tohoku">東北</option>
                    <option value="Kanto">関東</option>
                    <option value="Chubu">中部</option>
                    <option value="Kinki">近畿</option>
                    <option value="Chugoku">中国</option>
                    <option value="Shikoku">四国</option>
                    <option value="Kyushu">九州</option>
                    <option value="Okinawa">沖縄</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Prefecture</label>
                  <input
                    type="text"
                    value={editingFacility.prefecture}
                    onChange={(e) =>
                      setEditingFacility({
                        ...editingFacility,
                        prefecture: e.target.value,
                      })
                    }
                    placeholder="e.g., 青森県"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Address</label>
                <input
                  type="text"
                  value={editingFacility.address}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      address: e.target.value,
                    })
                  }
                  placeholder="Full address"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingFacility.lat}
                    onChange={(e) =>
                      setEditingFacility({
                        ...editingFacility,
                        lat: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingFacility.lng}
                    onChange={(e) =>
                      setEditingFacility({
                        ...editingFacility,
                        lng: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>URL</label>
                <input
                  type="url"
                  value={editingFacility.url}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      url: e.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className={styles.formGroup}>
                <label>Copy (short tagline)</label>
                <input
                  type="text"
                  value={editingFacility.copy || ""}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      copy: e.target.value,
                    })
                  }
                  placeholder="e.g., 日本最大級縄文集落跡"
                />
              </div>

              <div className={styles.formGroup}>
                <label>
                  Description *{" "}
                  <span
                    className={
                      editingFacility.description.length < 200
                        ? styles.charCountWarning
                        : styles.charCount
                    }
                  >
                    {editingFacility.description.length} / 200 chars (min)
                  </span>
                </label>
                <textarea
                  value={editingFacility.description}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      description: e.target.value,
                    })
                  }
                  placeholder="Detailed description (minimum 200 characters)"
                  rows={6}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editingFacility.tags.join(", ")}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g., 世界遺産, 博物館"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Access - Train</label>
                <input
                  type="text"
                  value={editingFacility.access.train}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      access: { ...editingFacility.access, train: e.target.value },
                    })
                  }
                  placeholder="Train access info"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Access - Bus</label>
                <input
                  type="text"
                  value={editingFacility.access.bus}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      access: { ...editingFacility.access, bus: e.target.value },
                    })
                  }
                  placeholder="Bus access info"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Access - Car</label>
                <input
                  type="text"
                  value={editingFacility.access.car}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      access: { ...editingFacility.access, car: e.target.value },
                    })
                  }
                  placeholder="Car access info"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Access Difficulty Rank</label>
                <select
                  value={editingFacility.access.rank}
                  onChange={(e) =>
                    setEditingFacility({
                      ...editingFacility,
                      access: {
                        ...editingFacility.access,
                        rank: e.target.value,
                      },
                    })
                  }
                >
                  <option value="S">S (Very Easy)</option>
                  <option value="A">A (Easy)</option>
                  <option value="B">B (Moderate)</option>
                  <option value="C">C (Difficult)</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                  setError("");
                }}
                className={styles.cancelButton}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className={styles.saveButton}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save & Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

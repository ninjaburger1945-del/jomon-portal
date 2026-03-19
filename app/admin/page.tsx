"use client";

import { useState, useEffect } from "react";

interface Facility {
  id: string;
  name: string;
  prefecture: string;
  description: string;
  [key: string]: any;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleLogin = () => {
    const correctPassword = "jomon2026";
    if (password === correctPassword) {
      setIsAuthenticated(true);
      setPassword("");
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const response = await fetch("/facilities.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setFacilities(data);
      setError("");
    } catch (err) {
      console.error("Error loading facilities:", err);
      setError(err instanceof Error ? err.message : "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFacilities();
    }
  }, [isAuthenticated]);

  const loadAvailableImages = async () => {
    try {
      const response = await fetch("/api/images");
      if (response.ok) {
        const images = await response.json();
        setAvailableImages(images);
      }
    } catch (err) {
      console.error("Failed to load images:", err);
    }
  };

  const handleEditClick = (facility: Facility) => {
    console.log("Edit clicked for:", facility.id);
    setEditingFacility({ ...facility });
    setShowEditModal(true);
    loadAvailableImages();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setEditingFacility({
        ...editingFacility!,
        thumbnail: data.path
      });
      setError("✓ Image uploaded successfully");
      await loadAvailableImages();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    console.log("Delete clicked for:", id);
    if (confirm("Are you sure you want to delete this facility?")) {
      const updated = facilities.filter((f) => f.id !== id);
      try {
        await saveFacilitiesToGithub(updated);
        setFacilities(updated);
        setError("✓ Deleted and deployed!");
      } catch (err) {
        console.error("Delete error:", err);
        setError(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  };

  const saveFacilitiesToGithub = async (updatedFacilities: Facility[]) => {
    try {
      console.log("Calling save-facilities API...");
      const response = await fetch("/api/save-facilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ facilities: updatedFacilities }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      console.log("Successfully saved to GitHub!");
      return true;
    } catch (err) {
      console.error("GitHub save error:", err);
      throw err;
    }
  };

  const handleSaveEdit = async () => {
    if (!editingFacility) return;
    console.log("Saving facility:", editingFacility.id);

    const updated = facilities.map((f) =>
      f.id === editingFacility.id ? editingFacility : f
    );

    try {
      await saveFacilitiesToGithub(updated);
      setFacilities(updated);
      setShowEditModal(false);
      setEditingFacility(null);
      setError("✓ Saved and deployed! Changes pushed to GitHub.");
    } catch (err) {
      console.error("Save error:", err);
      setError(
        `Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc" }}>
        <h1>Admin Login</h1>
        {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleLogin()}
          placeholder="Enter password"
          style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box" }}
          autoFocus
        />
        <button onClick={handleLogin} style={{ width: "100%", padding: "10px", cursor: "pointer" }}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Admin Dashboard</h1>
          <button onClick={() => setIsAuthenticated(false)} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div style={{ backgroundColor: "#fee", padding: "10px", marginBottom: "20px", borderRadius: "4px", color: error.includes("✓") ? "green" : "red" }}>
          {error}
        </div>
      )}

      <section>
        <h2>Facilities ({facilities.length})</h2>

        {loading ? (
          <p>Loading...</p>
        ) : facilities.length === 0 ? (
          <p>No facilities loaded</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ccc" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Prefecture</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Description</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility) => (
                <tr key={facility.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}><code>{facility.id}</code></td>
                  <td style={{ padding: "10px" }}>{facility.name}</td>
                  <td style={{ padding: "10px" }}>{facility.prefecture}</td>
                  <td style={{ padding: "10px" }}>{facility.description.substring(0, 50)}...</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    <button onClick={() => handleEditClick(facility)} style={{ padding: "4px 8px", marginRight: "4px", cursor: "pointer", backgroundColor: "#0066cc", color: "white", border: "none", borderRadius: "4px" }}>
                      ✎ Edit
                    </button>
                    <button onClick={() => handleDeleteClick(facility.id)} style={{ padding: "4px 8px", cursor: "pointer", backgroundColor: "#cc0000", color: "white", border: "none", borderRadius: "4px" }}>
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Edit Modal */}
      {showEditModal && editingFacility && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto"
          }}>
            <h2>Edit Facility: {editingFacility.name}</h2>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Name:</strong>
                <input
                  type="text"
                  value={editingFacility.name}
                  onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Prefecture:</strong>
                <input
                  type="text"
                  value={editingFacility.prefecture}
                  onChange={(e) => setEditingFacility({ ...editingFacility, prefecture: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Description:</strong>
                <textarea
                  value={editingFacility.description}
                  onChange={(e) => setEditingFacility({ ...editingFacility, description: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "100px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Address:</strong>
                <input
                  type="text"
                  value={editingFacility.address || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, address: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>URL:</strong>
                <input
                  type="url"
                  value={editingFacility.url || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, url: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Copy (Tagline):</strong>
                <input
                  type="text"
                  value={editingFacility.copy || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, copy: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                  placeholder="e.g., 日本最大級縄文集落跡"
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Region:</strong>
                <select
                  value={editingFacility.region || "Tohoku"}
                  onChange={(e) => setEditingFacility({ ...editingFacility, region: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
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
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Tags (comma-separated):</strong>
                <input
                  type="text"
                  value={(editingFacility.tags || []).join(", ")}
                  onChange={(e) => setEditingFacility({
                    ...editingFacility,
                    tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                  })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                  placeholder="e.g., 世界遺産, 博物館"
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <label>
                <strong>Latitude:</strong>
                <input
                  type="number"
                  step="0.0001"
                  value={editingFacility.lat || 0}
                  onChange={(e) => setEditingFacility({ ...editingFacility, lat: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
              <label>
                <strong>Longitude:</strong>
                <input
                  type="number"
                  step="0.0001"
                  value={editingFacility.lng || 0}
                  onChange={(e) => setEditingFacility({ ...editingFacility, lng: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <hr style={{ margin: "20px 0" }} />

            <div style={{ marginBottom: "15px" }}>
              <strong>Thumbnail Image</strong>
              {editingFacility.thumbnail && (
                <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                  <img
                    src={editingFacility.thumbnail}
                    alt="Current thumbnail"
                    style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "4px" }}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <a
                      href={editingFacility.thumbnail}
                      download
                      style={{ color: "#0066cc", textDecoration: "none", marginRight: "10px" }}
                    >
                      ⬇ Download Current Image
                    </a>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                <label>
                  <strong>Select from existing images:</strong>
                  <select
                    value={editingFacility.thumbnail || ""}
                    onChange={(e) => setEditingFacility({ ...editingFacility, thumbnail: e.target.value })}
                    style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                  >
                    <option value="">-- None --</option>
                    {availableImages.map((img) => (
                      <option key={img} value={`/images/facilities/${img}`}>
                        {img}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block" }}>
                  <strong>Upload new image:</strong>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    style={{ marginTop: "5px" }}
                  />
                </label>
                {uploading && <p style={{ color: "#666", marginTop: "5px" }}>Uploading...</p>}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                }}
                style={{ padding: "8px 16px", cursor: "pointer", backgroundColor: "#ccc", border: "none", borderRadius: "4px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{ padding: "8px 16px", cursor: "pointer", backgroundColor: "#0066cc", color: "white", border: "none", borderRadius: "4px" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

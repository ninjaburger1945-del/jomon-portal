"use client";

import { useState, useEffect } from "react";

interface Facility {
  id: string;
  name: string;
  name_en?: string;
  prefecture: string;
  description: string;
  description_en?: string;
  location_en?: string;
  [key: string]: any;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [isNewFacility, setIsNewFacility] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [postToX, setPostToX] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch("/api/stats");
      if (response.ok) {
        const data = await response.json();
        setStatsData(data);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFacilities();
      loadStats();
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

  const generateIdFromName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleAddNewFacility = () => {
    const newFacility: Facility = {
      id: "",
      name: "",
      name_en: "",
      prefecture: "",
      description: "",
      description_en: "",
      location_en: "",
      address: "",
      url: "",
      thumbnail: "",
      region: "Tohoku",
      tags: [],
      lat: 0,
      lng: 0,
    };
    setEditingFacility(newFacility);
    setIsNewFacility(true);
    setShowEditModal(true);
    setPostToX(false);
    loadAvailableImages();
  };

  const handleEditClick = (facility: Facility) => {
    console.log("Edit clicked for:", facility.id);
    setEditingFacility({ ...facility });
    setIsNewFacility(false);
    setShowEditModal(true);
    setPostToX(false);
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

  const postToXApi = async (facility: Facility) => {
    try {
      const message = `${facility.name}を紹介しています | JOMON PORTAL #縄文`;
      const response = await fetch("/api/x-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facilityName: facility.name,
          facilityId: facility.id,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post to X");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error("X post error:", err);
      throw err;
    }
  };

  const handleSaveEdit = async () => {
    if (!editingFacility || !editingFacility.name) {
      setError("Please fill in the facility name");
      return;
    }

    const facilityToSave = { ...editingFacility };

    // If new facility, generate ID from name
    if (isNewFacility) {
      if (!facilityToSave.id) {
        facilityToSave.id = generateIdFromName(facilityToSave.name);
      }
      // Check if ID already exists
      if (facilities.some(f => f.id === facilityToSave.id)) {
        setError("A facility with this ID already exists. Please modify the ID.");
        return;
      }
    }

    console.log("Saving facility:", facilityToSave.id);

    const updated = isNewFacility
      ? [...facilities, facilityToSave]
      : facilities.map((f) =>
        f.id === facilityToSave.id ? facilityToSave : f
      );

    try {
      await saveFacilitiesToGithub(updated);
      setFacilities(updated);
      setShowEditModal(false);
      setEditingFacility(null);
      setIsNewFacility(false);

      // Post to X if checkbox is enabled
      if (postToX) {
        try {
          const xResponse = await postToXApi(facilityToSave);
          if (xResponse.posted) {
            setError("✓ Saved and deployed! 📱 Posted to X!");
          } else {
            setError(`✓ Saved and deployed! ${xResponse.reason}`);
          }
        } catch (xErr) {
          setError("✓ Saved and deployed! (X post failed)");
        }
      } else {
        setError("✓ Saved and deployed! Changes pushed to GitHub.");
      }
      setPostToX(false);
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

      {/* Analytics Section */}
      <section style={{ marginBottom: "30px", backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
        <h2>📊 分析 {statsLoading && <span style={{ fontSize: "12px", color: "#999" }}>(更新中...)</span>}</h2>

        {statsData?.error ? (
          // エラー状態
          <div style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "6px",
            padding: "15px",
            color: "#856404"
          }}>
            <strong>⚠️ {statsData.message}</strong>
            <p style={{ margin: "10px 0 0 0", fontSize: "12px" }}>
              {statsData.status === 'no_credentials' && (
                <>
                  環境変数 <code>VERCEL_AUTH_TOKEN</code> と <code>NEXT_PUBLIC_VERCEL_PROJECT_ID</code> を設定してください。
                </>
              )}
              {statsData.status === 'auth_failed' && (
                <>
                  Vercel API トークンが無効または期限切れです。新しいトークンを設定してください。
                </>
              )}
              {statsData.status === 'api_error' && (
                <>
                  Vercel API エラー。後でもう一度試してください。
                </>
              )}
            </p>
          </div>
        ) : statsLoading ? (
          // ローディング状態
          <div style={{
            backgroundColor: "#e7f3ff",
            border: "1px solid #2196f3",
            borderRadius: "6px",
            padding: "15px",
            color: "#0d47a1",
            textAlign: "center"
          }}>
            <strong>🔄 Vercel API からデータ取得中...</strong>
          </div>
        ) : statsData && !statsData.error && (
          // 成功状態
          <>
            <div style={{
              backgroundColor: "#d4edda",
              border: "1px solid #28a745",
              borderRadius: "4px",
              padding: "8px 12px",
              marginBottom: "15px",
              fontSize: "12px",
              color: "#155724"
            }}>
              ✓ Vercel Analytics API から取得した実データ
            </div>
            {/* PV Trend Mini Chart */}
            <div style={{ marginBottom: "20px" }}>
              <h3>過去7日間のPV推移</h3>
              <svg viewBox="0 0 400 150" style={{ width: "100%", maxWidth: "100%", height: "auto" }} xmlns="http://www.w3.org/2000/svg">
                {/* Background */}
                <rect width="400" height="150" fill="#fff" stroke="#ddd" strokeWidth="1" />

                {/* Grid lines */}
                <line x1="40" y1="20" x2="40" y2="120" stroke="#ddd" />
                <line x1="40" y1="120" x2="380" y2="120" stroke="#ddd" />

                {/* Dynamic bars from API data */}
                {statsData.daily && statsData.daily.map((day: any, idx: number) => {
                  const maxViews = Math.max(...statsData.daily.map((d: any) => d.views), 1);
                  const barHeight = (day.views / maxViews) * 100;
                  const x = 50 + idx * 48;
                  const y = 120 - barHeight;
                  return (
                    <rect key={idx} x={x} y={y} width="35" height={barHeight} fill="#4CAF50" />
                  );
                })}

                {/* Labels */}
                {statsData.daily && statsData.daily.map((day: any, idx: number) => {
                  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(day.date + 'T00:00:00').getDay()];
                  const x = 67 + idx * 48;
                  return (
                    <text key={`label-${idx}`} x={x} y="135" fontSize="12" textAnchor="middle">
                      {dayOfWeek}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
              <div style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "6px", border: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>7日間のPV</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "#2196f3" }}>
                  {statsData.summary?.totalViews?.toLocaleString() || '—'}
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>from Vercel Analytics</div>
              </div>
              <div style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "6px", border: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>ユニーク訪問者</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4CAF50" }}>
                  {statsData.summary?.totalVisitors?.toLocaleString() || '—'}
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>from Vercel Analytics</div>
              </div>
              <div style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "6px", border: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>平均滞在時間</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "#FF9800" }}>
                  {statsData.summary?.avgTimeOnPage || '—'}
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>estimated</div>
              </div>
            </div>

            {/* Popular Facilities */}
            <div style={{ marginTop: "20px" }}>
              <h3>🏆 人気施設 TOP 3</h3>
              <ol style={{ margin: 0, paddingLeft: "20px" }}>
                {statsData.topFacilities && statsData.topFacilities.map((facility: any, idx: number) => (
                  <li key={idx} style={{ padding: "8px 0", borderBottom: idx < 2 ? "1px solid #eee" : "none" }}>
                    {facility.name}
                    <span style={{ color: "#666", marginLeft: "10px" }}>
                      → {Math.round(facility.views).toLocaleString()} PV
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2>Facilities ({facilities.length})</h2>
          <button
            onClick={handleAddNewFacility}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            ➕ 新規追加
          </button>
        </div>

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

      {/* Edit/Create Modal */}
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
            <h2>{isNewFacility ? "新規施設追加" : "Edit Facility"}: {editingFacility.name || "(no name)"}</h2>

            {/* ID Field (editable only for new facilities) */}
            {isNewFacility && (
              <div style={{ marginBottom: "15px" }}>
                <label>
                  <strong>ID (English, alphanumeric & hyphens):</strong>
                  <input
                    type="text"
                    value={editingFacility.id}
                    onChange={(e) => setEditingFacility({ ...editingFacility, id: e.target.value })}
                    placeholder="Auto-generated from name"
                    style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                  />
                </label>
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Name (Japanese):</strong>
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
                <strong>Name (English):</strong>
                <input
                  type="text"
                  value={editingFacility.name_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, name_en: e.target.value })}
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
                <strong>Description (Japanese):</strong>
                <textarea
                  value={editingFacility.description}
                  onChange={(e) => setEditingFacility({ ...editingFacility, description: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "100px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Description (English):</strong>
                <textarea
                  value={editingFacility.description_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, description_en: e.target.value })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "100px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Location (English):</strong>
                <input
                  type="text"
                  value={editingFacility.location_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, location_en: e.target.value })}
                  placeholder="e.g., Aomori Prefecture, Tohoku"
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
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

            <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={postToX}
                  onChange={(e) => setPostToX(e.target.checked)}
                  style={{ marginRight: "10px", cursor: "pointer" }}
                />
                <span>📱 Xに投稿する (Post to X when saved)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                  setIsNewFacility(false);
                  setPostToX(false);
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

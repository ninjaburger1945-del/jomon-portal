"use client";

import { useState, useEffect, useMemo } from "react";

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

type SortKey = "id" | "name" | "prefecture" | "description";
type SortOrder = "asc" | "desc";

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
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Deep Remaster
  const [deepRemasterFacility, setDeepRemasterFacility] = useState<Facility | null>(null);
  const [showRemasterModal, setShowRemasterModal] = useState(false);
  const [remasterLoading, setRemasterLoading] = useState(false);
  const [remasterPrompts, setRemasterPrompts] = useState<{
    concept_a: string;
    concept_b: string;
    concept_c: string;
  } | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number>(-1);
  const [generatedImages, setGeneratedImages] = useState<(string | null)[]>([null, null, null]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [savingRemaster, setSavingRemaster] = useState(false);
  const [remasterError, setRemasterError] = useState("");

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new sort key and default to ascending
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // Compute filtered and sorted facilities using useMemo for performance
  const filteredAndSortedFacilities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query === ""
      ? facilities
      : facilities.filter((f) =>
          f.name.toLowerCase().includes(query) ||
          f.id.toLowerCase().includes(query) ||
          (f.prefecture || "").toLowerCase().includes(query)
        );

    const sorted = [...filtered].sort((a, b) => {
      const aValue = String(a[sortKey] || "").toLowerCase();
      const bValue = String(b[sortKey] || "").toLowerCase();
      const comparison = aValue.localeCompare(bValue, 'ja');
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [facilities, sortKey, sortOrder, searchQuery]);

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/facilities", { cache: 'no-store' });
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
      const response = await fetch("/api/stats", { cache: 'no-store' });
      const data = await response.json();
      setStatsData(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setStatsData({
        pageviews: 0,
        visitors: 0,
        daily: [],
        error: `API エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      });
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
      const response = await fetch("/api/images", { cache: 'no-store' });
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
      address_en: "",
      access_public: "",
      access_public_en: "",
      access_car: "",
      access_car_en: "",
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
    // facilities.json の access 情報を access_public/access_car に反映
    const facilityCopy = { ...facility };
    if (facility.access) {
      facilityCopy.access_public = `${facility.access.train}。${facility.access.bus}`;
      facilityCopy.access_car = facility.access.car;
    }
    setEditingFacility(facilityCopy);
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
        // API保存を最優先（UI更新の前）
        await saveFacilities(updated);

        // API成功時のみUIを更新
        setFacilities(updated);
        setError("✓ 削除完了！キャッシュ再生成中... ブラウザをリロードすると最新データが表示されます。");
      } catch (err) {
        console.error("Delete error:", err);
        setError(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
        // UIは更新しない（データ一貫性を保持）
      }
    }
  };

  const saveFacilities = async (updatedFacilities: Facility[], retryCount = 0) => {
    const maxRetries = 3;
    try {
      console.log("Calling save-facilities API...");
      console.log(`[saveFacilities] Facilities count: ${updatedFacilities.length}`);

      // Validate each facility can be stringified before sending
      for (let i = 0; i < updatedFacilities.length; i++) {
        const f = updatedFacilities[i];
        try {
          JSON.stringify(f);
        } catch (err) {
          console.error(`[saveFacilities] Facility ${i} (ID: ${f?.id}) is not JSON serializable:`, err);
          throw new Error(`Facility ${f?.id || i} contains non-serializable data. Check browser console for details.`);
        }
      }

      const requestBody = JSON.stringify({ facilities: updatedFacilities });
      console.log(`[saveFacilities] Request body size: ${requestBody.length} bytes`);

      const response = await fetch("/api/save-facilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      if (!response.ok) {
        const error = await response.json();
        // 409エラー（SHA競合）の場合はリトライ
        if (error.status === 409 && retryCount < maxRetries) {
          console.log(`SHA conflict, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
          // 少し待ってからリトライ
          await new Promise(r => setTimeout(r, 500));
          return saveFacilities(updatedFacilities, retryCount + 1);
        }
        throw new Error(error.error || error.message || "Failed to save");
      }

      console.log("Successfully saved to local file!");
      return true;
    } catch (err) {
      console.error("Save error:", err);
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

  const preloadImage = (src: string, timeoutMs: number = 120000): Promise<void> =>
    new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const img = new window.Image();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        resolve();
      };

      img.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load image`));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Image load timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      img.src = src;
    });

  const generateImagesSequentially = async (prompts: {
    concept_a: string;
    concept_b: string;
    concept_c: string;
  }) => {
    const keys = ['concept_a', 'concept_b', 'concept_c'] as const;
    const newImages: (string | null)[] = [null, null, null];

    for (let i = 0; i < keys.length; i++) {
      setGeneratingIndex(i);
      const prompt = prompts[keys[i]];

      let loadSuccess = false;
      const maxRetries = 2;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[generateImages] Imagen 4.0 生成中 concept_${String.fromCharCode(97 + i)} (${attempt + 1}/${maxRetries})`);

          const response = await fetch('/api/generate-image-imagen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }

          const result = await response.json();

          if (result.success && result.dataUrl) {
            newImages[i] = result.dataUrl;
            loadSuccess = true;
            console.log(`[generateImages] concept_${String.fromCharCode(97 + i)} 生成成功`);
            break;
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (err) {
          console.warn(
            `[generateImages] concept_${String.fromCharCode(97 + i)} attempt ${attempt + 1}/${maxRetries} failed:`,
            err
          );
          if (attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }

      if (!loadSuccess) {
        console.warn(
          `[generateImages] concept_${String.fromCharCode(97 + i)} 生成失敗`
        );
      }

      setGeneratedImages([...newImages]);
    }
    setGeneratingIndex(-1);
  };

  const handleDeepRemaster = async (facility: Facility) => {
    setDeepRemasterFacility(facility);
    setShowRemasterModal(true);
    setRemasterLoading(true);
    setRemasterPrompts(null);
    setGeneratingIndex(-1);
    setGeneratedImages([null, null, null]);
    setSelectedImageIndex(null);
    setSavingRemaster(false);
    setRemasterError("");

    try {
      const res = await fetch("/api/deep-remaster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: facility.id,
          url: facility.url || "",
          description: facility.description || "",
          name: facility.name,
          prefecture: facility.prefecture,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const prompts = await res.json();
      setRemasterPrompts(prompts);
      setRemasterLoading(false);

      await generateImagesSequentially(prompts);
    } catch (err) {
      console.error("[handleDeepRemaster]", err);
      setRemasterError(err instanceof Error ? err.message : "不明なエラーが発生しました");
      setRemasterLoading(false);
    }
  };

  const handleConfirmRemaster = async () => {
    if (selectedImageIndex === null || !deepRemasterFacility) return;
    const selectedUrl = generatedImages[selectedImageIndex];
    if (!selectedUrl) return;

    const conceptLabel = (['a', 'b', 'c'] as const)[selectedImageIndex];

    setSavingRemaster(true);
    setRemasterError("");

    try {
      const saveRes = await fetch("/api/save-remaster-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollinationsUrl: selectedUrl,
          facilityId: deepRemasterFacility.id,
          conceptLabel,
        }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || `HTTP ${saveRes.status}`);
      }

      const { localPath } = await saveRes.json();

      const updatedFacilities = facilities.map((f) =>
        f.id === deepRemasterFacility.id ? { ...f, thumbnail: localPath } : f
      );

      await saveFacilities(updatedFacilities);

      // Note: cleanup-images is temporarily disabled to prevent accidentally deleting
      // recently-generated remaster images when multiple facilities are processed in quick succession.
      // TODO: Re-enable cleanup-images after adding safer logic to track temporary vs permanent images.

      setFacilities(updatedFacilities);
      setShowRemasterModal(false);
      setDeepRemasterFacility(null);
      setError("✓ ディープリマスター完了！画像とデータをローカルに保存しました。キャッシュ再生成中...");
    } catch (err) {
      console.error("[handleConfirmRemaster]", err);
      setRemasterError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSavingRemaster(false);
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

    setSaving(true);
    try {
      // API保存を最優先（UI更新の前）
      await saveFacilities(updated);

      // API成功時のみUIを更新
      setFacilities(updated);
      setShowEditModal(false);
      setEditingFacility(null);
      setIsNewFacility(false);

      // Post to X if checkbox is enabled
      if (postToX) {
        try {
          const xResponse = await postToXApi(facilityToSave);
          if (xResponse.posted) {
            setError("✓ ローカル保存完了！キャッシュ再生成中... 📱 Posted to X!");
          } else {
            setError(`✓ ローカル保存完了！キャッシュ再生成中... ${xResponse.reason}`);
          }
        } catch (xErr) {
          console.warn("X post failed:", xErr);
          setError("✓ ローカル保存完了！キャッシュ再生成中... (X post failed)");
        }
      } else {
        setError("✓ ローカル保存完了！キャッシュ再生成中... ブラウザをリロードすると最新データが表示されます。");
      }
      setPostToX(false);
    } catch (err) {
      console.error("Save error:", err);
      setError(
        `Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      // UIは更新しない（データ一貫性を保持）
    } finally {
      setSaving(false);
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
    <div style={{ padding: "15px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>Admin Dashboard</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "14px",
                whiteSpace: "nowrap",
                backgroundColor: "#FF6B35",
                color: "white",
                border: "none",
                borderRadius: "4px",
                textDecoration: "none",
                fontWeight: "500",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              🌐 ポータルを開く
            </a>
            <button onClick={() => setIsAuthenticated(false)} style={{ padding: "8px 16px", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div style={{ backgroundColor: "#fee", padding: "10px", marginBottom: "20px", borderRadius: "4px", color: error.includes("✓") ? "green" : "red", fontSize: "14px", overflowWrap: "break-word" }}>
          {error}
        </div>
      )}

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(18px, 5vw, 24px)" }}>Facilities ({facilities.length})</h2>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={loadFacilities}
              title="キャッシュをクリアして最新データを再読み込み"
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: "500",
                whiteSpace: "nowrap"
              }}
            >
              🔄 更新
            </button>
            <button
              onClick={handleAddNewFacility}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: "500",
                whiteSpace: "nowrap"
              }}
            >
              ➕ 追加
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="施設名・都道府県・IDで検索..."
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
                boxSizing: "border-box"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: "#666",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  whiteSpace: "nowrap"
                }}
              >
                クリア
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>
              {filteredAndSortedFacilities.length} / {facilities.length} 件
            </p>
          )}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : facilities.length === 0 ? (
          <p>No facilities loaded</p>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: "8px", textAlign: "center", width: "45px", fontSize: "12px" }}>No.</th>
                  <th
                    onClick={() => handleSort("id")}
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: sortKey === "id" ? "#e0e0e0" : "#f5f5f5",
                      minWidth: "70px",
                      fontSize: "12px"
                    }}
                    title="Click to sort"
                  >
                    ID {sortKey === "id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: sortKey === "name" ? "#e0e0e0" : "#f5f5f5",
                      minWidth: "120px",
                      fontSize: "12px"
                    }}
                    title="Click to sort"
                  >
                    Name {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("prefecture")}
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: sortKey === "prefecture" ? "#e0e0e0" : "#f5f5f5",
                      minWidth: "80px",
                      fontSize: "12px"
                    }}
                    title="Click to sort"
                  >
                    Pref {sortKey === "prefecture" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center", minWidth: "90px", fontSize: "12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedFacilities.map((facility, index) => (
                  <tr key={facility.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: "bold", color: "#666", fontSize: "12px" }}>{index + 1}</td>
                    <td style={{ padding: "8px", fontSize: "12px" }}><code>{facility.id}</code></td>
                    <td style={{ padding: "8px", fontSize: "13px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {!facility.thumbnail && (
                        <span style={{
                          display: "inline-block",
                          backgroundColor: "#ff9800",
                          color: "white",
                          fontSize: "10px",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          marginRight: "4px",
                          verticalAlign: "middle",
                          whiteSpace: "nowrap"
                        }}>
                          画像未生成
                        </span>
                      )}
                      {!facility.url && (
                        <span style={{
                          display: "inline-block",
                          backgroundColor: "#cc0000",
                          color: "white",
                          fontSize: "10px",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          marginRight: "4px",
                          verticalAlign: "middle",
                          whiteSpace: "nowrap"
                        }}>
                          要確認URL
                        </span>
                      )}
                      {facility.name}
                    </td>
                    <td style={{ padding: "8px", fontSize: "12px" }}>{facility.prefecture}</td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <button onClick={() => handleEditClick(facility)} style={{ padding: "5px 8px", marginRight: "3px", cursor: "pointer", backgroundColor: "#0066cc", color: "white", border: "none", borderRadius: "3px", fontSize: "12px", whiteSpace: "nowrap" }}>
                        ✎ Edit
                      </button>
                      <button onClick={() => handleDeleteClick(facility.id)} style={{ padding: "5px 8px", marginRight: "3px", cursor: "pointer", backgroundColor: "#cc0000", color: "white", border: "none", borderRadius: "3px", fontSize: "12px", whiteSpace: "nowrap" }}>
                        🗑 Del
                      </button>
                      <button onClick={() => handleDeepRemaster(facility)} title="ディープリマスター" style={{ padding: "5px 8px", cursor: "pointer", backgroundColor: "#7B2FBE", color: "white", border: "none", borderRadius: "3px", fontSize: "12px", whiteSpace: "nowrap" }}>
                        🎨
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          zIndex: 1000,
          padding: "10px",
          boxSizing: "border-box"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "15px",
            borderRadius: "8px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "95vh",
            overflow: "auto",
            boxSizing: "border-box"
          }}>
            <h2 style={{ fontSize: "clamp(16px, 4vw, 20px)", margin: "0 0 15px 0" }}>{isNewFacility ? "新規施設追加" : "Edit Facility"}</h2>

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

            <hr style={{ margin: "20px 0" }} />

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>🚌 Access by Public Transport (Japanese):</strong>
                <textarea
                  value={editingFacility.access_public || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, access_public: e.target.value })}
                  placeholder="e.g., JR奥羽本線青森駅からバスで約35分。縄文時遊館前バス停から徒歩約2分"
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "60px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>🚌 Access by Public Transport (English):</strong>
                <textarea
                  value={editingFacility.access_public_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, access_public_en: e.target.value })}
                  placeholder="e.g., About 35 minutes by bus from JR Aomori Station. About 2 minutes on foot from Jomon Yūkan bus stop."
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "60px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>🚗 Access by Car (Japanese):</strong>
                <textarea
                  value={editingFacility.access_car || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, access_car: e.target.value })}
                  placeholder="e.g., 東北道青森ICから国道7号経由で約15分"
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "60px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>🚗 Access by Car (English):</strong>
                <textarea
                  value={editingFacility.access_car_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, access_car_en: e.target.value })}
                  placeholder="e.g., About 15 minutes via Route 7 from Aomori IC on the Tohoku Expressway"
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "60px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>Address (Japanese):</strong>
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
                <strong>Address (English):</strong>
                <input
                  type="text"
                  value={editingFacility.address_en || ""}
                  onChange={(e) => setEditingFacility({ ...editingFacility, address_en: e.target.value })}
                  placeholder="e.g., 1-1 Sannai, Aomori City, Aomori Prefecture"
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
                  onChange={(e) => setEditingFacility({ ...editingFacility, copy: e.target.value.substring(0, 14) })}
                  maxLength={14}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
                  placeholder="e.g., 日本最大級縄文集落跡 (max 14 chars)"
                />
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  {(editingFacility.copy || "").length}/14 characters
                </small>
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
                  <option value="ChugokuShikoku">中国・四国</option>
                  <option value="KyushuOkinawa">九州・沖縄</option>
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
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", fontSize: "16px" }}
                />
              </label>
              <label>
                <strong>Longitude:</strong>
                <input
                  type="number"
                  step="0.0001"
                  value={editingFacility.lng || 0}
                  onChange={(e) => setEditingFacility({ ...editingFacility, lng: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", fontSize: "16px" }}
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

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                  setIsNewFacility(false);
                  setPostToX(false);
                }}
                style={{ padding: "8px 14px", cursor: "pointer", backgroundColor: "#ccc", border: "none", borderRadius: "4px", fontSize: "14px" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Save button clicked");
                  handleSaveEdit();
                }}
                disabled={saving}
                style={{ padding: "8px 16px", cursor: saving ? "not-allowed" : "pointer", backgroundColor: saving ? "#666666" : "#0066cc", color: "white", border: "none", borderRadius: "4px", opacity: saving ? 0.6 : 1, fontSize: "14px" }}
              >
                {saving ? "💾 中..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Remaster Modal */}
      {showRemasterModal && deepRemasterFacility && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: '10px', boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '12px',
              maxWidth: '900px', width: '100%', maxHeight: '95vh',
              overflow: 'auto', boxSizing: 'border-box',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: 'clamp(16px, 4vw, 22px)', color: '#3d1a6e' }}>
              🎨 ディープリマスター: {deepRemasterFacility.url ? (
                <a
                  href={deepRemasterFacility.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#7B2FBE', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {deepRemasterFacility.name}
                </a>
              ) : (
                deepRemasterFacility.name
              )}
            </h2>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
              {deepRemasterFacility.description}
            </p>

            {remasterError && (
              <div style={{
                backgroundColor: '#fee', padding: '10px', marginBottom: '16px',
                borderRadius: '6px', color: '#cc0000', fontSize: '14px',
              }}>
                {remasterError}
              </div>
            )}

            {remasterLoading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                <div style={{
                  display: 'inline-block', width: '40px', height: '40px',
                  border: '4px solid #e0d0ff', borderTopColor: '#7B2FBE',
                  borderRadius: '50%', animation: 'spin 1s linear infinite',
                  marginBottom: '16px',
                }} />
                <p style={{ margin: 0, fontSize: '16px' }}>Geminiが遺跡情報を解析中...</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
                  {deepRemasterFacility.name} のビジュアルコンセプトを生成しています
                </p>
              </div>
            )}

            {remasterPrompts && (
              <>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  画像をクリックして選択し、「確定保存」でサムネイルを更新します。
                </p>
                <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
                  ※ 画像生成に30～60秒かかる場合があります。読み込み中でもしばらくお待ちください。
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}>
                  {(['a', 'b', 'c'] as const).map((label, i) => {
                    const conceptLabels = [
                      { icon: '🏺', text: 'コンセプトA：象徴的遺物' },
                      { icon: '🌿', text: 'コンセプトB：遺構/環境' },
                      { icon: '🏛️', text: 'コンセプトC：再現' },
                    ];
                    const isSelected = selectedImageIndex === i;
                    const isGenerating = generatingIndex === i;
                    const imgUrl = generatedImages[i];

                    return (
                      <div
                        key={label}
                        onClick={() => imgUrl && setSelectedImageIndex(i)}
                        style={{
                          border: isSelected ? '3px solid #FF6B35' : '2px solid #e0d0ff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: imgUrl ? 'pointer' : 'default',
                          boxShadow: isSelected ? '0 0 0 2px #FF6B35' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            paddingBottom: '56.25%',
                            backgroundColor: '#1a0a2e',
                            overflow: 'hidden',
                          }}
                        >
                          {isGenerating && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              color: '#c0a0ff',
                            }}>
                              <div style={{
                                width: '32px', height: '32px',
                                border: '3px solid #3d1a6e', borderTopColor: '#c0a0ff',
                                borderRadius: '50%', animation: 'spin 1s linear infinite',
                                marginBottom: '8px',
                              }} />
                              <span style={{ fontSize: '12px' }}>生成中...</span>
                            </div>
                          )}
                          {!isGenerating && !imgUrl && generatingIndex > i && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              color: '#999', fontSize: '12px',
                            }}>
                              <div style={{
                                width: '24px', height: '24px',
                                border: '2px solid #ddd', borderTopColor: '#999',
                                borderRadius: '50%', animation: 'spin 1s linear infinite',
                                marginBottom: '6px',
                              }} />
                              <span>読み込み中...</span>
                            </div>
                          )}
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={`concept_${label}`}
                              style={{
                                position: 'absolute', top: 0, left: 0,
                                width: '100%', height: '100%', objectFit: 'cover',
                              }}
                            />
                          )}
                          {isSelected && (
                            <div style={{
                              position: 'absolute', top: '6px', right: '6px',
                              backgroundColor: '#FF6B35', color: 'white',
                              borderRadius: '50%', width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', fontWeight: 'bold',
                            }}>
                              ✓
                            </div>
                          )}
                        </div>

                        <div style={{
                          padding: '8px 10px',
                          backgroundColor: isSelected ? '#fff4f0' : '#faf5ff',
                          fontSize: '12px', fontWeight: '600', color: '#3d1a6e',
                        }}>
                          {conceptLabels[i].icon} {conceptLabels[i].text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setShowRemasterModal(false);
                  setDeepRemasterFacility(null);
                  setRemasterPrompts(null);
                  setGeneratedImages([null, null, null]);
                  setSelectedImageIndex(null);
                }}
                style={{
                  padding: '10px 18px', cursor: 'pointer',
                  backgroundColor: '#ccc', border: 'none',
                  borderRadius: '6px', fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemaster}
                disabled={selectedImageIndex === null || savingRemaster || !generatedImages[selectedImageIndex ?? -1]}
                style={{
                  padding: '10px 18px', cursor: (selectedImageIndex === null || savingRemaster) ? 'not-allowed' : 'pointer',
                  backgroundColor: (selectedImageIndex === null || savingRemaster) ? '#999' : '#7B2FBE',
                  color: 'white', border: 'none', borderRadius: '6px',
                  fontSize: '14px', fontWeight: '600',
                  opacity: (selectedImageIndex === null || savingRemaster) ? 0.6 : 1,
                }}
              >
                {savingRemaster ? '⏳ 保存中...' : '✅ 確定保存'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

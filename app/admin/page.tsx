"use client";

import { useState, useEffect } from "react";

interface Facility {
  id: string;
  name: string;
  prefecture: string;
  description?: string;
  url?: string;
  thumbnail?: string;
  order?: number;
  [key: string]: any;
}

export default function AdminPage() {
  // 認証
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 施設管理
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 保存状態（文字列のみ：これでError #130を回避）
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [saveMessage, setSaveMessage] = useState("");

  // 自動発掘
  const [discoveryKeyword, setDiscoveryKeyword] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");

  // ディープリマスター
  const [remasteringFacility, setRemasteringFacility] = useState<Facility | null>(null);
  const [remasterImages, setRemasterImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [remasterLoading, setRemasterLoading] = useState(false);
  const [remasterError, setRemasterError] = useState("");

  // 編集機能
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState("");

  // ソート機能
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortingFacility, setSortingFacility] = useState<Facility | null>(null);
  const [newOrder, setNewOrder] = useState(0);
  const [sortError, setSortError] = useState("");

  // ログイン処理
  const handleLogin = () => {
    const correctPassword = "jomon2026";
    if (password === correctPassword) {
      setIsAuthenticated(true);
      setPassword("");
      setError("");
    } else {
      setError("パスワードが違います");
    }
  };

  // 施設一覧を読み込み
  const loadFacilities = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/facilities", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setFacilities(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 初回ログイン時に施設を読み込み
  useEffect(() => {
    if (isAuthenticated) {
      loadFacilities();
    }
  }, [isAuthenticated]);

  // 自動発掘（キーワードから新しい施設を探す）
  const handleDiscover = async () => {
    if (!discoveryKeyword.trim()) {
      setDiscoveryError("キーワードを入力してください");
      return;
    }

    setDiscovering(true);
    setDiscoveryError("");
    try {
      const response = await fetch("/api/auto-excavate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: discoveryKeyword }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      // 成功後、施設一覧をリロード
      await loadFacilities();
      setDiscoveryKeyword("");
      setError("✓ 新しい遺跡を発掘・保存しました！");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to discover";
      setDiscoveryError(msg);
    } finally {
      setDiscovering(false);
    }
  };

  // ディープリマスター：3案の画像を生成
  const handleGenerateRemaster = async (facility: Facility) => {
    setRemasteringFacility(facility);
    setRemasterLoading(true);
    setRemasterError("");
    setRemasterImages([]);
    setSelectedImageIndex(null);

    try {
      const response = await fetch("/api/deep-remaster", {
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // APIからプロンプトを取得
      const prompts = await response.json();

      // 3つの画像を順番に生成（API呼び出し）
      const images: string[] = [];
      const conceptKeys = ["concept_a", "concept_b", "concept_c"];

      for (const key of conceptKeys) {
        try {
          const prompt = prompts[key];
          const imgResponse = await fetch("/api/generate-image-imagen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            images.push(imgData.dataUrl || "");
          }
        } catch {
          images.push("");
        }
      }

      setRemasterImages(images);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      setRemasterError(msg);
    } finally {
      setRemasterLoading(false);
    }
  };

  // 選択した画像をサーバーに保存（concept フィールドを追加）
  const handleSaveRemaster = async () => {
    if (!remasteringFacility || selectedImageIndex === null || !remasterImages[selectedImageIndex]) {
      setRemasterError("画像を選択してください");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");
    setRemasterError("");

    try {
      // conceptラベルを"A", "B", "C"から選択
      const conceptLabels = ["A", "B", "C"];
      const concept = conceptLabels[selectedImageIndex];

      const response = await fetch("/api/save-remaster-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: remasteringFacility.id,
          imageUrl: remasterImages[selectedImageIndex],
          concept: concept, // ✅ concept フィールドを追加
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      // 成功時：施設一覧をリロード
      await loadFacilities();

      setSaveStatus("saved");
      setSaveMessage("✓ ディープリマスター画像を保存しました！");
      setTimeout(() => {
        setRemasteringFacility(null);
        setRemasterImages([]);
        setSelectedImageIndex(null);
        setSaveStatus("");
        setSaveMessage("");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to save";
      setSaveMessage(msg);
    }
  };

  // 施設情報を編集用モーダルで開く
  const handleEditClick = (facility: Facility) => {
    setEditingFacility({ ...facility });
    setShowEditModal(true);
    setEditError("");
  };

  // 編集内容をサーバーに保存
  const handleSaveEdit = async () => {
    if (!editingFacility || !editingFacility.name.trim()) {
      setEditError("施設名は必須です");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const response = await fetch(`/api/facilities/${editingFacility.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingFacility),
      });

      if (!response.ok) {
        // PUTが対応していない場合はPATCHを試す
        if (response.status === 405) {
          const patchResponse = await fetch(`/api/facilities/${editingFacility.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editingFacility),
          });
          if (!patchResponse.ok) throw new Error(`HTTP ${patchResponse.status}`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      // 成功時：施設一覧をリロード
      await loadFacilities();

      setSaveStatus("saved");
      setSaveMessage("✓ 施設情報を更新しました！");
      setShowEditModal(false);
      setEditingFacility(null);
      setTimeout(() => {
        setSaveStatus("");
        setSaveMessage("");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to save";
      setSaveMessage(msg);
    }
  };

  // 施設の順序を変更（上へ）
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newFacilities = [...facilities];
    [newFacilities[index], newFacilities[index - 1]] = [newFacilities[index - 1], newFacilities[index]];
    setFacilities(newFacilities);
  };

  // 施設の順序を変更（下へ）
  const handleMoveDown = (index: number) => {
    if (index === facilities.length - 1) return;
    const newFacilities = [...facilities];
    [newFacilities[index], newFacilities[index + 1]] = [newFacilities[index + 1], newFacilities[index]];
    setFacilities(newFacilities);
  };

  // ソート順序をサーバーに保存
  const handleSaveOrder = async () => {
    setSaveStatus("saving");
    setSaveMessage("");
    setSortError("");

    try {
      const response = await fetch("/api/facilities/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityIds: facilities.map((f) => f.id),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setSaveStatus("saved");
      setSaveMessage("✓ 施設の順序を保存しました！");
      setShowSortModal(false);
      setSortingFacility(null);
      setTimeout(() => {
        setSaveStatus("");
        setSaveMessage("");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to save order";
      setSaveMessage(msg);
    }
  };

  // ===== ログイン画面
  if (!isAuthenticated) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5"
      }}>
        <div style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px"
        }}>
          <h1 style={{ textAlign: "center", marginBottom: "30px", color: "#333" }}>Admin Login</h1>

          {error && (
            <div style={{
              backgroundColor: "#fee",
              color: "#c00",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "15px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter password"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "15px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "16px",
              boxSizing: "border-box"
            }}
            autoFocus
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // ===== メイン管理画面
  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "30px",
        paddingBottom: "15px",
        borderBottom: "2px solid #ddd"
      }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Admin Dashboard</h1>
        <button
          onClick={() => setIsAuthenticated(false)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#999",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Logout
        </button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div style={{
          backgroundColor: "#fee",
          color: "#c00",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "20px",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      {/* 保存メッセージ */}
      {saveMessage && (
        <div style={{
          backgroundColor: saveStatus === "error" ? "#fee" : "#efe",
          color: saveStatus === "error" ? "#c00" : "#060",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "20px",
          fontSize: "14px"
        }}>
          {saveStatus === "saving" ? "💾 保存中..." : saveMessage}
        </div>
      )}

      {/* ========== 自動発掘セクション ========== */}
      <section style={{
        backgroundColor: "#f9f5ff",
        border: "2px solid #e0d0ff",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "30px"
      }}>
        <h2 style={{ margin: "0 0 15px 0", fontSize: "20px", color: "#3d1a6e" }}>🔍 新しい遺跡を自動発掘</h2>

        {discoveryError && (
          <div style={{
            backgroundColor: "#fee",
            color: "#c00",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "15px",
            fontSize: "13px"
          }}>
            {discoveryError}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={discoveryKeyword}
            onChange={(e) => setDiscoveryKeyword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleDiscover()}
            placeholder="キーワード入力（例：北海道 縄文）"
            style={{
              flex: 1,
              padding: "10px",
              border: "1px solid #d0c0ff",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />
          <button
            onClick={handleDiscover}
            disabled={discovering || !discoveryKeyword.trim()}
            style={{
              padding: "10px 20px",
              backgroundColor: discovering ? "#ccc" : "#7B2FBE",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: discovering ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              whiteSpace: "nowrap"
            }}
          >
            {discovering ? "🔍 発掘中..." : "🔍 発掘"}
          </button>
        </div>
      </section>

      {/* ========== 施設一覧セクション ========== */}
      <section>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Facilities ({facilities.length})</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={loadFacilities}
              disabled={loading}
              style={{
                padding: "8px 12px",
                backgroundColor: loading ? "#ccc" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: "bold"
              }}
            >
              🔄 更新
            </button>
            <button
              onClick={() => setShowSortModal(true)}
              style={{
                padding: "8px 12px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "bold"
              }}
            >
              📋 ソート
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : facilities.length === 0 ? (
          <p>No facilities</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              backgroundColor: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "10px", textAlign: "left", width: "40px" }}>No.</th>
                  <th style={{ padding: "10px", textAlign: "left", minWidth: "60px" }}>ID</th>
                  <th style={{ padding: "10px", textAlign: "left", minWidth: "150px" }}>名称</th>
                  <th style={{ padding: "10px", textAlign: "left", minWidth: "100px" }}>都道府県</th>
                  <th style={{ padding: "10px", textAlign: "center", minWidth: "180px" }}>アクション</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((facility, index) => (
                  <tr key={facility.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px", textAlign: "center", color: "#999" }}>{index + 1}</td>
                    <td style={{ padding: "10px" }}><code style={{ fontSize: "12px" }}>{facility.id}</code></td>
                    <td style={{ padding: "10px" }}>{facility.name}</td>
                    <td style={{ padding: "10px" }}>{facility.prefecture}</td>
                    <td style={{ padding: "10px", textAlign: "center", display: "flex", gap: "5px", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleEditClick(facility)}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#0066cc",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }}
                      >
                        ✎ Edit
                      </button>
                      <button
                        onClick={() => handleGenerateRemaster(facility)}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#7B2FBE",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }}
                      >
                        🎨 Remaster
                      </button>
                      {index > 0 && (
                        <button
                          onClick={() => handleMoveUp(index)}
                          style={{
                            padding: "5px 8px",
                            backgroundColor: "#666",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "11px"
                          }}
                        >
                          ↑
                        </button>
                      )}
                      {index < facilities.length - 1 && (
                        <button
                          onClick={() => handleMoveDown(index)}
                          style={{
                            padding: "5px 8px",
                            backgroundColor: "#666",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "11px"
                          }}
                        >
                          ↓
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {facilities.length > 0 && (
              <div style={{ marginTop: "15px", textAlign: "right" }}>
                <button
                  onClick={handleSaveOrder}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "bold"
                  }}
                >
                  💾 順序を保存
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========== 編集モーダル ========== */}
      {showEditModal && editingFacility && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
          boxSizing: "border-box"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "95vh",
            overflow: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
          }}>
            <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", color: "#333" }}>
              施設を編集: {editingFacility.id}
            </h2>

            {editError && (
              <div style={{
                backgroundColor: "#fee",
                color: "#c00",
                padding: "10px",
                borderRadius: "4px",
                marginBottom: "15px",
                fontSize: "13px"
              }}>
                {editError}
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>
                施設名
              </label>
              <input
                type="text"
                value={editingFacility.name}
                onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>
                都道府県
              </label>
              <input
                type="text"
                value={editingFacility.prefecture}
                onChange={(e) => setEditingFacility({ ...editingFacility, prefecture: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>
                説明
              </label>
              <textarea
                value={editingFacility.description || ""}
                onChange={(e) => setEditingFacility({ ...editingFacility, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  minHeight: "100px"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>
                URL
              </label>
              <input
                type="url"
                value={editingFacility.url || ""}
                onChange={(e) => setEditingFacility({ ...editingFacility, url: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFacility(null);
                  setEditError("");
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0066cc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold"
                }}
              >
                💾 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ソートモーダル ========== */}
      {showSortModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
          boxSizing: "border-box"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "95vh",
            overflow: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
          }}>
            <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", color: "#333" }}>
              施設の順序を変更
            </h2>

            {sortError && (
              <div style={{
                backgroundColor: "#fee",
                color: "#c00",
                padding: "10px",
                borderRadius: "4px",
                marginBottom: "15px",
                fontSize: "13px"
              }}>
                {sortError}
              </div>
            )}

            <div style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "10px"
            }}>
              {facilities.map((facility, index) => (
                <div
                  key={facility.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px",
                    borderBottom: index < facilities.length - 1 ? "1px solid #eee" : "none",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ marginRight: "10px", color: "#999", minWidth: "25px" }}>
                    {index + 1}.
                  </span>
                  <span style={{ flex: 1 }}>{facility.name}</span>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {index > 0 && (
                      <button
                        onClick={() => handleMoveUp(index)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#666",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px"
                        }}
                      >
                        ↑
                      </button>
                    )}
                    {index < facilities.length - 1 && (
                      <button
                        onClick={() => handleMoveDown(index)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#666",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px"
                        }}
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                onClick={() => {
                  setShowSortModal(false);
                  setSortingFacility(null);
                  setSortError("");
                  loadFacilities(); // 元の順序に戻す
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrder}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold"
                }}
              >
                💾 順序を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ディープリマスター モーダル ========== */}
      {remasteringFacility && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
          boxSizing: "border-box"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "900px",
            width: "100%",
            maxHeight: "95vh",
            overflow: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
          }}>
            <h2 style={{
              margin: "0 0 15px 0",
              fontSize: "24px",
              color: "#3d1a6e"
            }}>
              🎨 ディープリマスター: {remasteringFacility.name}
            </h2>

            <p style={{
              margin: "0 0 20px 0",
              fontSize: "13px",
              color: "#666",
              lineHeight: 1.6
            }}>
              {remasteringFacility.description}
            </p>

            {remasterError && (
              <div style={{
                backgroundColor: "#fee",
                color: "#c00",
                padding: "12px",
                borderRadius: "4px",
                marginBottom: "20px",
                fontSize: "13px"
              }}>
                {remasterError}
              </div>
            )}

            {remasterLoading ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  display: "inline-block",
                  width: "40px",
                  height: "40px",
                  border: "4px solid #e0d0ff",
                  borderTopColor: "#7B2FBE",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }} />
                <p style={{ marginTop: "15px", color: "#666" }}>画像生成中...</p>
              </div>
            ) : remasterImages.length > 0 ? (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "15px",
                  marginBottom: "20px"
                }}>
                  {remasterImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => img && setSelectedImageIndex(idx)}
                      style={{
                        border: selectedImageIndex === idx ? "3px solid #FF6B35" : "2px solid #e0d0ff",
                        borderRadius: "8px",
                        overflow: "hidden",
                        cursor: img ? "pointer" : "default",
                        backgroundColor: "#f5f5f5"
                      }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={`concept-${idx}`}
                          style={{
                            width: "100%",
                            height: "200px",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "100%",
                          height: "200px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999"
                        }}>
                          Failed to load
                        </div>
                      )}
                      <div style={{
                        padding: "10px",
                        backgroundColor: selectedImageIndex === idx ? "#fff4f0" : "#faf5ff",
                        fontSize: "12px",
                        fontWeight: "bold",
                        textAlign: "center",
                        color: "#3d1a6e"
                      }}>
                        {["🏺 象徴的遺物(A)", "🌿 遺構/環境(B)", "🏛️ 再現(C)"][idx]}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      setRemasteringFacility(null);
                      setRemasterImages([]);
                      setSelectedImageIndex(null);
                      setRemasterError("");
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRemaster}
                    disabled={selectedImageIndex === null || saveStatus === "saving"}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: selectedImageIndex === null ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: selectedImageIndex === null ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}
                  >
                    {saveStatus === "saving" ? "💾 保存中..." : "✅ 保存"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

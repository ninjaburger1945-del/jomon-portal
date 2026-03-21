
// ========================
// ★【補足】URL マッピング読み込み
// ========================

function loadOfficialUrlMapping() {
  const mappingPath = path.join(__dirname, 'official-url-mapping.json');
  if (fs.existsSync(mappingPath)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
      return mapping;
    } catch (e) {
      console.warn('[MAPPING_LOAD] URL マッピングの読み込み失敗');
      return {};
    }
  }
  return {};
}


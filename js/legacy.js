  if (localStorage.getItem('wpulse-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
</script>

<!-- Drop Overlay -->
<div class="drop-overlay" id="dropOverlay">
  <div class="drop-overlay-icon">📄</div>
  <div class="drop-overlay-text">Drop WPScan Output File</div>
  <div class="drop-overlay-sub">Supports .txt and .log files</div>
</div>

<!-- ═══ NAVIGATION ═══ -->
<nav class="navbar" id="navbar">
  <div class="nav-brand">
    <div class="nav-logo">W</div>
    <div class="nav-title">WPULSE</div>
  </div>

  <div class="nav-links">
    <button class="nav-link active" id="navDashboard" onclick="showView('dashboard')">Dashboard</button>
    <button class="nav-link" id="navInput" onclick="showView('input')">New Scan</button>
    <button class="nav-link" id="navHistory" onclick="toggleSidebar()">History</button>
  </div>

  <div class="nav-sep"></div>

  <div class="nav-right">
    <button class="nav-link" id="themeToggle" onclick="toggleTheme()" style="font-size: 16px; padding: 4px 8px; margin-right: 8px;" title="Toggle Dark Mode">🌙</button>
    <div class="nav-status">
      <div class="status-dot"></div>
      <span id="status-text">Ready</span>
    </div>
    <button class="nav-cta" onclick="showView('input')">ANALYZE</button>
  </div>
</nav>

<!-- ═══ APP LAYOUT ═══ -->
<div class="app-layout">

  <!-- Sidebar -->
  <aside class="sidebar collapsed" id="sidebar">
    <!-- History Section -->
    <div class="sidebar-section" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <div class="sidebar-head">
        <span class="sidebar-label">Scan History</span>
        <button class="sidebar-action" onclick="clearHistory()">Clear</button>
      </div>
      <div class="sidebar-body" style="flex:1;overflow-y:auto">
        <div class="hist-list" id="histList">
          <div class="hist-empty">No scans yet.<br>Analyze a WPScan output to see history.</div>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <div class="main-content" id="mainContent">

    <!-- Input View (shown by default) -->
    <div id="viewInput">
      <div class="hero">
        <div class="hero-decorator">
          <div class="hero-dot"></div>
          <span class="hero-label">Security Intelligence</span>
        </div>
        <h1>SCAN<br><em>ANALYZER.</em></h1>
        <p class="hero-desc">Paste your WPScan output to get instant vulnerability analysis, CVE extraction, and security intelligence — all in your browser.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="openInputPanel()" style="height:44px;padding:0 28px;font-size:13px">
            <span>✏️</span>
            <span>Paste Output</span>
          </button>
          <button class="btn btn-secondary" onclick="loadExample()" style="height:44px;padding:0 28px;font-size:13px">
            Load Example
          </button>
        </div>
        <div class="hero-kbd">
          <span><kbd>Ctrl+Enter</kbd> to analyze</span>
          <span>·</span>
          <span>Drag & drop .txt files</span>
        </div>
      </div>
    </div>

    <!-- Input Panel (modal-like) -->
    <div id="viewInputPanel" style="display:none">
      <div style="max-width:800px;margin:40px auto;padding:0 32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div class="hero-dot"></div>
          <span class="sidebar-label">Paste WPScan Output</span>
          <button class="btn btn-ghost" onclick="showView('dashboard')" style="margin-left:auto">← Back</button>
        </div>
        <div style="background:var(--bg-white);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <textarea id="raw" spellcheck="false" autocomplete="off" style="width:100%;min-height:400px;background:var(--bg-input);border:none;color:var(--txt);font-family:var(--mono);font-size:12px;padding:20px;resize:vertical;outline:none;line-height:1.8" placeholder="Paste your WPScan output here...&#10;&#10;Example:&#10;wpscan --url http://target --enumerate vp --api-token TOKEN"></textarea>
          <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center">
            <button class="btn btn-accent" id="analyzeBtn" onclick="go()">
              <div class="spin"></div>
              <span class="btn-text">ANALYZE</span>
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('raw').value=''">Clear</button>
            <button class="btn btn-ghost" onclick="loadExample()">Load Example</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard View -->
    <div id="viewDashboard" style="display:none"></div>

  </div>
</div>

<script>
/* ═══════════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════════ */
if (document.documentElement.getAttribute('data-theme') === 'dark') {
  document.getElementById('themeToggle').textContent = '☀️';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('wpulse-theme', 'light');
    document.getElementById('themeToggle').textContent = '🌙';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('wpulse-theme', 'dark');
    document.getElementById('themeToggle').textContent = '☀️';
  }
}

/* ═══════════════════════════════════════════════════════════
   WPScan Parser — Client-Side JavaScript
═══════════════════════════════════════════════════════════ */

function classifySeverity(title) {
  const t = title.toLowerCase();
  if (['rce','remote code execution','unauthenticated sql injection','file upload','php file upload','deserialization','admin+ php','arbitrary file upload','phar'].some(kw => t.includes(kw))) return 'critical';
  if (['sql injection','sqli','sql in ','ssrf','arbitrary file read','arbitrary file delet','blind ssrf','price manipulation','unauthenticated shortcode','arbitrary shortcode execution','unauthenticated arbitrary'].some(kw => t.includes(kw))) return 'high';
  if (['xss','csrf','cross-site','open redirect','disclosure','exposure','traversal','missing authorization','injection','content injection','information exposure','broken access'].some(kw => t.includes(kw))) return 'medium';
  return 'low';
}

function extractCves(references) {
  const cveMap = {};
  const cvePattern = /CVE-\d{4}-\d+/gi;
  for (const ref of references) {
    const m = ref.match(cvePattern);
    if (m) { const id = m[0].toUpperCase(); if (!cveMap[id]) cveMap[id] = { cve_url: ref, poc_url: null }; }
    if (['exploit','poc','proof','github.com','exploit-db','packetstorm','rapid7'].some(kw => ref.toLowerCase().includes(kw))) {
      const keys = Object.keys(cveMap);
      for (let i = keys.length-1; i >= 0; i--) { if (!cveMap[keys[i]].poc_url) { cveMap[keys[i]].poc_url = ref; break; } }
    }
  }
  return Object.entries(cveMap).map(([id, d]) => ({ id, cve_url: d.cve_url, poc_url: d.poc_url }));
}

function parseWpscan(raw) {
  const result = { target:'', wordpress_version:'', plugins:[], users:[], interesting_findings:[], vulnerabilities:[], summary:{ total_vulns:0, critical:0, high:0, medium:0, low:0, plugins_found:0 } };
  const lines = raw.split(/\r?\n/);
  let i = 0, currentPlugin = null;
  while (i < lines.length) {
    const line = lines[i];
    if (/\[\+\] URL:/.test(line)) { const m = line.match(/https?:\/\/[^\s\]]+/); if (m) result.target = m[0].replace(/\/$/, ''); }
    if (line.includes('WordPress version')) { const m = line.match(/(\d+\.\d+[\.\d]*)/); if (m) result.wordpress_version = m[1]; }
    const pm = line.match(/^\[\+\]\s+([\w\-]+)\s*$/);
    if (pm) { currentPlugin = { name: pm[1], version:'', latestVersion:'', versionStatus:'unknown', vulns:[] }; result.plugins.push(currentPlugin); result.summary.plugins_found++; }
    if (currentPlugin) {
      let vm = line.match(/\|\s+Version:\s+([\d.]+)/); if (vm && !currentPlugin.version) currentPlugin.version = vm[1];
      vm = line.match(/\?ver=([\d.]+)/); if (vm && !currentPlugin.version) currentPlugin.version = vm[1];
      const lvm = line.match(/\|\s+Latest Version:\s+([\d.]+)\s*(\(up to date\))?/i);
      if (lvm) { currentPlugin.latestVersion = lvm[1]; if (lvm[2]) currentPlugin.versionStatus = 'uptodate'; }
      if (/\[!\]\s+The version is out of date/i.test(line)) currentPlugin.versionStatus = 'outdated';
    }
    if (/\[!\] Title:/.test(line)) {
      const tm = line.match(/\[!\] Title:\s*(.+)/);
      if (tm) {
        const title = tm[1].trim();
        const vuln = { title, severity: classifySeverity(title), fixed_in:'', references:[], cves:[], plugin: currentPlugin ? currentPlugin.name : 'WordPress Core' };
        let j = i + 1;
        while (j < lines.length && j < i + 30) {
          const sub = lines[j];
          if (/\[!\] Title:/.test(sub)) break;
          if (/^\[\+\]/.test(sub) && !/^\s*\|/.test(sub)) break;
          const fi = sub.match(/Fixed in:\s*([\d.]+)/); if (fi) vuln.fixed_in = fi[1];
          const ref = sub.match(/-\s*(https?:\/\/\S+)/); if (ref) vuln.references.push(ref[1]);
          j++;
        }
        vuln.cves = extractCves(vuln.references);
        result.vulnerabilities.push(vuln);
        result.summary[vuln.severity] = (result.summary[vuln.severity] || 0) + 1;
        if (currentPlugin) currentPlugin.vulns.push(vuln);
      }
    }
    if (line.includes('Login:')) { const um = line.match(/Login:\s*(\S+)/); if (um) result.users.push(um[1]); }
    if (/^\[\+\]/.test(line)) {
      const skip = ['URL:','Started:','Enumerating','Checking','Finished','WPScan DB','Requests','Data ','Memory','Elapsed'];
      if (!skip.some(s => line.includes(s)) && !/^\[\+\]\s+[\w\-]+\s*$/.test(line)) {
        const f = line.replace(/^\[\+\]\s*/, '').trim();
        if (f && f.length < 300) result.interesting_findings.push(f);
      }
    }
    i++;
  }
  result.summary.total_vulns = result.vulnerabilities.length;
  return result;
}

/* ═══════════════════════════════════════════
   VIEW MANAGEMENT
═══════════════════════════════════════════ */
function showView(view) {
  document.getElementById('viewInput').style.display = view === 'hero' ? '' : 'none';
  document.getElementById('viewInputPanel').style.display = view === 'input' ? '' : 'none';
  document.getElementById('viewDashboard').style.display = view === 'dashboard' && LAST_DATA ? '' : 'none';

  // If no data yet, show hero
  if (view === 'dashboard' && !LAST_DATA) {
    document.getElementById('viewInput').style.display = '';
  }

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (view === 'dashboard' || view === 'hero') document.getElementById('navDashboard').classList.add('active');
  if (view === 'input') document.getElementById('navInput').classList.add('active');
}

function openInputPanel() {
  showView('input');
  setTimeout(() => document.getElementById('raw').focus(), 100);
}

let sidebarOpen = false;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
  document.getElementById('navHistory').classList.toggle('active', sidebarOpen);
}

/* ═══════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════ */
const MAX_HISTORY = 25;
let history_items = JSON.parse(localStorage.getItem('wpulse-history') || '[]');
let LAST_DATA = null;

function saveHistory(data) {
  const key = Date.now();
  const entry = { id:key, target: data.target||'Unknown', time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), date: new Date().toLocaleDateString([],{month:'short',day:'numeric'}), total:data.summary.total_vulns, critical:data.summary.critical, high:data.summary.high, medium:data.summary.medium, low:data.summary.low, rawKey:key };
  try { sessionStorage.setItem('wpulse-'+key, JSON.stringify(data)); } catch(e) {}
  history_items.unshift(entry);
  if (history_items.length > MAX_HISTORY) history_items.pop();
  try { localStorage.setItem('wpulse-history', JSON.stringify(history_items)); } catch(e) {}
  renderHistoryList();
  if (!sidebarOpen) toggleSidebar();
}

function renderHistoryList() {
  const list = document.getElementById('histList');
  if (!history_items.length) { list.innerHTML = '<div class="hist-empty">No scans yet.<br>Analyze output to see history.</div>'; return; }
  list.innerHTML = history_items.map((e,i) => {
    const badges = [];
    if (e.critical) badges.push(`<span class="hist-badge hb-c">C:${e.critical}</span>`);
    if (e.high) badges.push(`<span class="hist-badge hb-h">H:${e.high}</span>`);
    if (e.medium) badges.push(`<span class="hist-badge hb-m">M:${e.medium}</span>`);
    if (e.low) badges.push(`<span class="hist-badge hb-l">L:${e.low}</span>`);
    if (!e.total) badges.push(`<span class="hist-badge hb-t">Clean</span>`);
    return `<div class="hist-item" onclick="loadHistoryItem(${i})"><div class="hist-item-url">${esc(e.target)}</div><div class="hist-item-meta">${badges.join('')}<span class="hist-time">${e.date} ${e.time}</span></div></div>`;
  }).join('');
}

function loadHistoryItem(idx) {
  const entry = history_items[idx];
  if (!entry) return;
  const raw = sessionStorage.getItem('wpulse-'+entry.rawKey);
  if (!raw) { setStatus('Session expired — re-analyze'); return; }
  LAST_DATA = JSON.parse(raw);
  render(LAST_DATA);
  showView('dashboard');
  setStatus('Loaded: ' + entry.target);
}

function clearHistory() {
  history_items = [];
  localStorage.removeItem('wpulse-history');
  renderHistoryList();
}
renderHistoryList();

/* ═══════════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════════ */
let ALL_VULNS = [];
let ACTIVE_SEVERITY = new Set();
let ACTIVE_SPECIAL = new Set();
let FILTER_PLUGIN = '';
let FILTER_FIX = '';
let SEARCH_TERM = '';
let debounceTimer = null;

/* ═══════════════════════════════════════════
   CORE ACTIONS
═══════════════════════════════════════════ */
function go() {
  const raw = document.getElementById('raw').value.trim();
  if (!raw) return;
  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');
  setStatus('Analyzing…');
  setTimeout(() => {
    try {
      if (raw.startsWith('Starting Nmap') || raw.includes('Nmap scan report for')) {
        const hosts = parseNmap(raw);
        window.LAST_NMAP_DATA = hosts;
        btn.classList.remove('loading');
        document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + renderNmapTable(hosts) + '</div>';
        showView('dashboard');
        setStatus('Analysis complete — ' + hosts.length + ' hosts found');
      } else {
        const data = parseWpscan(raw);
        btn.classList.remove('loading');
        LAST_DATA = data;
        render(data);
        saveHistory(data);
        showView('dashboard');
        setStatus('Analysis complete — ' + data.summary.total_vulns + ' vulnerabilities found');
      }
    } catch(err) {
      btn.classList.remove('loading');
      setStatus('Parse error — check console');
      console.error(err);
    }
  }, 60);
}

function loadExample() {
  setStatus('Loading example…');
  fetch('example-input.txt')
    .then(r => { if (!r.ok) throw new Error('Not found'); return r.text(); })
    .then(txt => { document.getElementById('raw').value = txt; showView('input'); go(); })
    .catch(() => setStatus('Could not load example file'));
}

function setStatus(msg) { document.getElementById('status-text').textContent = msg; }

/* ═══════════════════════════════════════════
   FILE DROP
═══════════════════════════════════════════ */
;(function() {
  const ov = document.getElementById('dropOverlay');
  let dc = 0;
  document.addEventListener('dragenter', e => { e.preventDefault(); dc++; ov.classList.add('active'); });
  document.addEventListener('dragleave', e => { e.preventDefault(); dc--; if (dc<=0){dc=0;ov.classList.remove('active');} });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dc=0; ov.classList.remove('active');
    const file = e.dataTransfer.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('raw').value = reader.result; go(); };
    reader.readAsText(file);
  });
})();

/* ═══════════════════════════════════════════
   KEYBOARD SHORTCUT
═══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') go();
});

/* ═══════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════ */
function toggleSev(sev, btn) {
  if (sev === 'all') {
    ACTIVE_SEVERITY.clear();
    document.querySelectorAll('.fbtn[data-sev]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelector('.fbtn[data-sev="all"]')?.classList.remove('active');
    if (ACTIVE_SEVERITY.has(sev)) { ACTIVE_SEVERITY.delete(sev); btn.classList.remove('active'); }
    else { ACTIVE_SEVERITY.add(sev); btn.classList.add('active'); }
    if (!ACTIVE_SEVERITY.size) document.querySelector('.fbtn[data-sev="all"]')?.classList.add('active');
  }
  applyFilters();
}

function toggleSpecial(key, btn) {
  if (ACTIVE_SPECIAL.has(key)) { ACTIVE_SPECIAL.delete(key); btn.classList.remove('active'); }
  else { ACTIVE_SPECIAL.add(key); btn.classList.add('active'); }
  applyFilters();
}

function setPluginFilter(val) {
  FILTER_PLUGIN = val;
  applyFilters();
}

function setFixFilter(val) {
  FILTER_FIX = val;
  applyFilters();
}

function applyFilters() {
  let f = ALL_VULNS;
  if (ACTIVE_SEVERITY.size) f = f.filter(v => ACTIVE_SEVERITY.has(v.severity));
  if (ACTIVE_SPECIAL.has('unauth')) f = f.filter(v => v.title.toLowerCase().includes('unauthenticated'));
  if (ACTIVE_SPECIAL.has('has-cve')) f = f.filter(v => v.cves && v.cves.length > 0);
  if (ACTIVE_SPECIAL.has('has-poc')) f = f.filter(v => v.cves && v.cves.some(c => c.poc_url));
  if (FILTER_PLUGIN) f = f.filter(v => v.plugin === FILTER_PLUGIN);
  if (FILTER_FIX === 'fixed') f = f.filter(v => v.fixed_in);
  else if (FILTER_FIX === 'unfixed') f = f.filter(v => !v.fixed_in);
  if (SEARCH_TERM) {
    const q = SEARCH_TERM.toLowerCase();
    f = f.filter(v => v.title.toLowerCase().includes(q) || (v.plugin && v.plugin.toLowerCase().includes(q)) || (v.cves && v.cves.some(c => c.id.toLowerCase().includes(q))));
  }
  const el = document.getElementById('vulnBody');
  if (el) el.innerHTML = renderVulnRows(f);
  const sc = document.getElementById('searchCount');
  if (sc) sc.textContent = f.length + ' of ' + ALL_VULNS.length;
}

/* ═══════════════════════════════════════════
   RENDER DASHBOARD
═══════════════════════════════════════════ */
function render(d) {
  ALL_VULNS = d.vulnerabilities || [];
  ACTIVE_SEVERITY.clear(); ACTIVE_SPECIAL.clear();
  FILTER_PLUGIN = ''; FILTER_FIX = ''; SEARCH_TERM = '';
  const s = d.summary;
  const plugins = d.plugins || [];
  const pluginNames = [...new Set(ALL_VULNS.map(v => v.plugin).filter(Boolean))];
  let h = '';

  // Target Header
  if (d.target) {
    h += `<div class="target-header">
      <div class="target-marker"></div>
      <div class="target-url">${esc(d.target)}</div>
      <div class="target-badges">
        ${d.wordpress_version ? `<span class="target-badge wp-ver">WP ${esc(d.wordpress_version)}</span>` : ''}
        <span class="target-badge">${s.plugins_found} Plugins</span>
        <span class="target-badge">${s.total_vulns} Vulns</span>
      </div>
    </div>`;
  }

  // Stat Grid
  h += `<div class="stat-grid">
    <div class="stat-card sc-total"><div class="stat-num">${s.total_vulns}</div><div class="stat-label">Total Vulns</div></div>
    <div class="stat-card sc-crit"><div class="stat-num">${s.critical}</div><div class="stat-label">Critical</div></div>
    <div class="stat-card sc-high"><div class="stat-num">${s.high}</div><div class="stat-label">High</div></div>
    <div class="stat-card sc-med"><div class="stat-num">${s.medium}</div><div class="stat-label">Medium</div></div>
    <div class="stat-card sc-low"><div class="stat-num">${s.low}</div><div class="stat-label">Low</div></div>
  </div>`;

  // Export bar
  h += `<div class="export-bar">
    <div class="export-left">Last analyzed: ${new Date().toLocaleString()}</div>
    <div class="export-right">
      <button class="export-btn" onclick="exportJSON()">Export JSON</button>
      <button class="export-btn" onclick="exportCSV()">Export CSV</button>
    </div>
  </div>`;

  // Vulnerabilities Section with Toolbar
  if (ALL_VULNS.length) {
    const pluginOpts = pluginNames.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    h += `<div class="toolbar">
      <div class="toolbar-search">
        <span class="search-icon">🔍</span>
        <input type="text" id="vulnSearch" placeholder="Search vulnerabilities by title, plugin, CVE…" oninput="SEARCH_TERM=this.value.trim();applyFilters()">
        <span class="search-count" id="searchCount">${ALL_VULNS.length} of ${ALL_VULNS.length}</span>
      </div>
      <div class="toolbar-filters">
        <div class="filter-group">
          <span class="filter-group-label">Severity</span>
          <button class="fbtn active" data-sev="all" onclick="toggleSev('all',this)">All</button>
          <button class="fbtn fbtn-critical" data-sev="critical" onclick="toggleSev('critical',this)">Critical</button>
          <button class="fbtn fbtn-high" data-sev="high" onclick="toggleSev('high',this)">High</button>
          <button class="fbtn fbtn-medium" data-sev="medium" onclick="toggleSev('medium',this)">Medium</button>
          <button class="fbtn fbtn-low" data-sev="low" onclick="toggleSev('low',this)">Low</button>
        </div>
        <div class="filter-sep"></div>
        <div class="filter-group">
          <span class="filter-group-label">Type</span>
          <button class="fbtn fbtn-accent" onclick="toggleSpecial('unauth',this)">Unauth</button>
          <button class="fbtn" onclick="toggleSpecial('has-cve',this)">Has CVE</button>
          <button class="fbtn" onclick="toggleSpecial('has-poc',this)">Has PoC</button>
        </div>
        <div class="filter-sep"></div>
        <div class="filter-group">
          <span class="filter-group-label">Fix</span>
          <select class="plugin-select" onchange="setFixFilter(this.value)">
            <option value="">All</option>
            <option value="fixed">Fixed</option>
            <option value="unfixed">No Fix</option>
          </select>
        </div>
        <div class="filter-sep"></div>
        <div class="filter-group">
          <span class="filter-group-label">Plugin</span>
          <select class="plugin-select" onchange="setPluginFilter(this.value)">
            <option value="">All Plugins</option>
            <option value="WordPress Core">WP Core</option>
            ${pluginOpts}
          </select>
        </div>
      </div>
    </div>`;

    h += `<div class="section">
      <div class="sec-header" onclick="tog('vulnBody','vulnChev')">
        <div class="sec-title">Vulnerabilities <span class="sec-count">${ALL_VULNS.length}</span></div>
        <div class="sec-chevron open" id="vulnChev">▾</div>
      </div>
      <div class="vuln-table-head">
        <div>Severity</div><div>Vulnerability</div><div>CVEs</div><div>References</div>
      </div>
      <div class="sec-body open" id="vulnBody">${renderVulnRows(ALL_VULNS)}</div>
    </div>`;
  }

  // Plugins Section
  if (plugins.length) {
    const plugHtml = plugins.map((p,idx) => {
      const pid = 'plg'+idx, vc = p.vulns ? p.vulns.length : 0;
      return `<div class="plugin-item">
        <div class="plugin-row" onclick="togP('${pid}')">
          <div class="plugin-info">
            <div class="plugin-icon">🧩</div>
            <div>
              <div class="plugin-name">${esc(p.name)}</div>
              ${(()=>{ const verParts = []; const cls = p.versionStatus==='uptodate'?'ver-uptodate':p.versionStatus==='outdated'?'ver-outdated':''; if(p.version) verParts.push('v'+esc(p.version)); if(p.latestVersion && p.versionStatus==='outdated') verParts.push('→ '+esc(p.latestVersion)); if(p.versionStatus==='uptodate') verParts.push('✓ up to date'); else if(p.versionStatus==='outdated') verParts.push('⚠ outdated'); return verParts.length?`<div class="plugin-ver ${cls}">${verParts.join(' ')}</div>`:p.latestVersion?`<div class="plugin-ver">latest: ${esc(p.latestVersion)}</div>`:''; })()}
            </div>
          </div>
          <div class="plugin-meta">
            <span class="plugin-vuln-count ${vc>0?'pvc-danger':'pvc-safe'}">${vc} vuln${vc!==1?'s':''}</span>
          </div>
        </div>
        <div class="plugin-body" id="${pid}">
          ${vc > 0 ? '<div class="vuln-table-head"><div>Severity</div><div>Vulnerability</div><div>CVEs</div><div>References</div></div>' + renderVulnRows(p.vulns) : '<div class="empty-msg">No known vulnerabilities.</div>'}
        </div>
      </div>`;
    }).join('');
    h += `<div class="section">
      <div class="sec-header" onclick="tog('plugBody','plugChev')">
        <div class="sec-title">Plugins <span class="sec-count">${plugins.length}</span></div>
        <div class="sec-chevron" id="plugChev">▾</div>
      </div>
      <div class="sec-body" id="plugBody">${plugHtml}</div>
    </div>`;
  }

  // Interesting Findings
  if (d.interesting_findings && d.interesting_findings.length) {
    h += `<div class="section">
      <div class="sec-header" onclick="tog('findBody','findChev')">
        <div class="sec-title">Interesting Findings <span class="sec-count">${d.interesting_findings.length}</span></div>
        <div class="sec-chevron" id="findChev">▾</div>
      </div>
      <div class="sec-body" id="findBody">
        ${d.interesting_findings.map(f => `<div class="finding-row"><div class="finding-marker"></div><div>${esc(f)}</div></div>`).join('')}
      </div>
    </div>`;
  }

  // Users
  if (d.users && d.users.length) {
    h += `<div class="section">
      <div class="sec-header" onclick="tog('usrBody','usrChev')">
        <div class="sec-title">Users Found <span class="sec-count">${d.users.length}</span></div>
        <div class="sec-chevron open" id="usrChev">▾</div>
      </div>
      <div class="sec-body open" id="usrBody">
        ${d.users.map(u => `<div class="user-row"><div class="user-icon">👤</div><div>${esc(u)}</div></div>`).join('')}
      </div>
    </div>`;
  }

  document.getElementById('viewDashboard').innerHTML = `<div class="dashboard">${h}</div>`;
}

function renderVulnRows(vulns) {
  if (!vulns || !vulns.length) return '<div class="empty-msg">No vulnerabilities match filters.</div>';
  return vulns.map(v => {
    const sev = v.severity || 'low';
    const isUnauth = v.title.toLowerCase().includes('unauthenticated');

    // CVEs
    const cves = (v.cves || []).slice(0,3).map(c =>
      `<a class="cve-tag" href="${esc(c.cve_url)}" target="_blank" rel="noopener">${esc(c.id)}</a>`
    ).join('');

    // References
    const refs = (v.references || []).slice(0,3).map(r => {
      const isPoc = r.includes('exploit') || r.includes('github') || r.includes('poc');
      const isWp = r.includes('wpscan');
      const label = isPoc ? '💥 PoC' : isWp ? 'WPScan' : 'Ref';
      return `<a class="ref-link${isPoc?' poc-link':''}" href="${esc(r)}" target="_blank" rel="noopener">${label}</a>`;
    }).join('');

    // Tags
    const tags = [];
    if (v.fixed_in) tags.push(`<span class="vtag vtag-fixed">✓ ${esc(v.fixed_in)}</span>`);
    if (v.plugin && v.plugin !== 'WordPress Core') tags.push(`<span class="vtag vtag-plugin">${esc(v.plugin)}</span>`);
    if (v.plugin === 'WordPress Core') tags.push(`<span class="vtag vtag-core">WP Core</span>`);
    if (isUnauth) tags.push(`<span class="vtag vtag-unauth">UNAUTH</span>`);

    return `<div class="vuln-row">
      <div><span class="sev-badge sev-${sev}">${sev}</span></div>
      <div class="vuln-info">
        <div class="vuln-title">${esc(v.title)}</div>
        <div class="vuln-tags">${tags.join('')}</div>
      </div>
      <div class="vuln-cves">${cves || '<span style="color:var(--txt-3);font-size:11px">—</span>'}</div>
      <div class="vuln-refs">${refs || '<span style="color:var(--txt-3);font-size:11px">—</span>'}</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════ */
function exportJSON() {
  if (!LAST_DATA) return;
  const blob = new Blob([JSON.stringify(LAST_DATA, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'wpscan-report.json'; a.click();
  URL.revokeObjectURL(url);
}
function exportCSV() {
  if (!LAST_DATA) return;
  const header = 'Severity,Title,Plugin,Fixed In,CVEs\n';
  const rows = (LAST_DATA.vulnerabilities||[]).map(v => {
    const cves = (v.cves||[]).map(c=>c.id).join('; ');
    return `"${v.severity}","${v.title.replace(/"/g,'""')}","${v.plugin||''}","${v.fixed_in||''}","${cves}"`;
  }).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'wpscan-report.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════
   ACCORDION HELPERS
═══════════════════════════════════════════ */
function tog(bid, cid) {
  const b = document.getElementById(bid), c = document.getElementById(cid);
  if (!b) return;
  b.classList.toggle('open'); if (c) c.classList.toggle('open');
}
function togP(pid) {
  const b = document.getElementById(pid); if (!b) return;
  b.classList.toggle('open');
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

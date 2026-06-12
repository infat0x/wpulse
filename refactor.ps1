$html = Get-Content 'index.html' -Raw -Encoding UTF8
$html = $html -replace '(?s)<style>.*?</style>', '<link rel="stylesheet" href="css/main.css">'
$html = $html -replace '(?s)<script>.*?</script>', ''
$html = $html -replace '<script src="nmap-parser.js"></script>', ''
$html = $html.Replace('</body>', "  <script src=`"js/app.js`"></script>`n  <script src=`"js/wpscan.js`"></script>`n  <script src=`"js/nmap.js`"></script>`n</body>")
Set-Content -Path 'index.html' -Value $html -Encoding UTF8

$appJs = @'
window.WPulseTools = [];
window.registerTool = function(tool) {
  window.WPulseTools.push(tool);
};

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

function showView(view) {
  document.getElementById('viewInput').style.display = view === 'hero' ? '' : 'none';
  document.getElementById('viewInputPanel').style.display = view === 'input' ? '' : 'none';
  document.getElementById('viewDashboard').style.display = view === 'dashboard' && window.LAST_DATA ? '' : 'none';

  if (view === 'dashboard' && !window.LAST_DATA) {
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

const MAX_HISTORY = 25;
let history_items = JSON.parse(localStorage.getItem('wpulse-history') || '[]');
window.LAST_DATA = null;
window.ACTIVE_TOOL = null;

function saveHistory(data, title, badges) {
  const key = Date.now();
  const entry = { id:key, target: title, time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), date: new Date().toLocaleDateString([],{month:'short',day:'numeric'}), badges: badges, rawKey:key, toolId: window.ACTIVE_TOOL.id };
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
    return \`<div class="hist-item" onclick="loadHistoryItem(\${i})"><div class="hist-item-url">\${esc(e.target)}</div><div class="hist-item-meta">\${e.badges||''}<span class="hist-time">\${e.date} \${e.time}</span></div></div>\`;
  }).join('');
}

function loadHistoryItem(idx) {
  const entry = history_items[idx];
  if (!entry) return;
  const raw = sessionStorage.getItem('wpulse-'+entry.rawKey);
  if (!raw) { setStatus('Session expired — re-analyze'); return; }
  window.LAST_DATA = JSON.parse(raw);
  window.ACTIVE_TOOL = window.WPulseTools.find(t => t.id === entry.toolId);
  if (window.ACTIVE_TOOL && window.ACTIVE_TOOL.onLoadHistory) {
      window.ACTIVE_TOOL.onLoadHistory(window.LAST_DATA);
  } else if (window.ACTIVE_TOOL) {
      document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + window.ACTIVE_TOOL.render(window.LAST_DATA) + '</div>';
  }
  showView('dashboard');
  setStatus('Loaded: ' + entry.target);
}

function clearHistory() {
  history_items = [];
  localStorage.removeItem('wpulse-history');
  renderHistoryList();
}

function go() {
  const raw = document.getElementById('raw').value.trim();
  if (!raw) return;
  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');
  setStatus('Analyzing…');
  setTimeout(() => {
    try {
      let matchedTool = window.WPulseTools.find(t => t.match(raw));
      if (!matchedTool) throw new Error('No compatible tool found for this output.');
      
      window.ACTIVE_TOOL = matchedTool;
      const data = matchedTool.parse(raw);
      window.LAST_DATA = data;
      btn.classList.remove('loading');
      
      const html = matchedTool.render(data);
      document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + html + '</div>';
      
      if (matchedTool.saveHistoryParams) {
          const params = matchedTool.saveHistoryParams(data);
          saveHistory(data, params.title, params.badges);
      } else {
          saveHistory(data, matchedTool.name + ' Scan', '');
      }
      
      showView('dashboard');
      if (matchedTool.getSummary) setStatus(matchedTool.getSummary(data));
      else setStatus('Analysis complete');
      
    } catch(err) {
      btn.classList.remove('loading');
      setStatus('Error — ' + err.message);
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

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') go();
});

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tog(bid, cid) {
  const b = document.getElementById(bid), c = document.getElementById(cid);
  if (!b) return;
  b.classList.toggle('open'); if (c) c.classList.toggle('open');
}
function togP(pid) {
  const b = document.getElementById(pid); if (!b) return;
  b.classList.toggle('open');
}

window.addEventListener('DOMContentLoaded', () => renderHistoryList());
'@
Set-Content -Path 'js\app.js' -Value $appJs -Encoding UTF8

$legacyJs = Get-Content 'js\legacy.js' -Raw -Encoding UTF8

# Start indices
$startIdx = $legacyJs.IndexOf('function classifySeverity')
$endIdx = $legacyJs.IndexOf("/* ═══════════════════════════════════════════`n   VIEW MANAGEMENT")
$wpscanLogic = $legacyJs.Substring($startIdx, $endIdx - $startIdx)

$filtersStart = $legacyJs.IndexOf("/* ═══════════════════════════════════════════`n   FILTERS")
$utilsStart = $legacyJs.IndexOf("/* ═══════════════════════════════════════════`n   UTILS")
$filtersLogic = $legacyJs.Substring($filtersStart, $utilsStart - $filtersStart).Replace('LAST_DATA', 'window.LAST_DATA')

$wpscanRegistry = @'

  window.registerTool({
    id: 'wpscan',
    name: 'WPScan',
    match: function(raw) {
      return raw.includes('[+] URL:') || raw.includes('WPScan');
    },
    parse: function(raw) {
      return parseWpscan(raw);
    },
    render: function(data) {
      ALL_VULNS = data.vulnerabilities || [];
      ACTIVE_SEVERITY.clear(); ACTIVE_SPECIAL.clear();
      FILTER_PLUGIN = ''; FILTER_FIX = ''; SEARCH_TERM = '';
      const s = data.summary;
      const plugins = data.plugins || [];
      const pluginNames = [...new Set(ALL_VULNS.map(v => v.plugin).filter(Boolean))];
      let h = '';

      if (data.target) {
        h += \`<div class="target-header">
          <div class="target-marker"></div>
          <div class="target-url">\${esc(data.target)}</div>
          <div class="target-badges">
            \${data.wordpress_version ? \`<span class="target-badge wp-ver">WP \${esc(data.wordpress_version)}</span>\` : ''}
            <span class="target-badge">\${s.plugins_found} Plugins</span>
            <span class="target-badge">\${s.total_vulns} Vulns</span>
          </div>
        </div>\`;
      }

      h += \`<div class="stat-grid">
        <div class="stat-card sc-total"><div class="stat-num">\${s.total_vulns}</div><div class="stat-label">Total Vulns</div></div>
        <div class="stat-card sc-crit"><div class="stat-num">\${s.critical}</div><div class="stat-label">Critical</div></div>
        <div class="stat-card sc-high"><div class="stat-num">\${s.high}</div><div class="stat-label">High</div></div>
        <div class="stat-card sc-med"><div class="stat-num">\${s.medium}</div><div class="stat-label">Medium</div></div>
        <div class="stat-card sc-low"><div class="stat-num">\${s.low}</div><div class="stat-label">Low</div></div>
      </div>\`;

      h += \`<div class="export-bar">
        <div class="export-left">Last analyzed: \${new Date().toLocaleString()}</div>
        <div class="export-right">
          <button class="export-btn" onclick="exportJSON()">Export JSON</button>
          <button class="export-btn" onclick="exportCSV()">Export CSV</button>
        </div>
      </div>\`;

      if (ALL_VULNS.length) {
        const pluginOpts = pluginNames.map(p => \`<option value="\${esc(p)}">\${esc(p)}</option>\`).join('');
        h += \`<div class="toolbar">
          <div class="toolbar-search">
            <span class="search-icon">🔍</span>
            <input type="text" id="vulnSearch" placeholder="Search vulnerabilities by title, plugin, CVE…" oninput="SEARCH_TERM=this.value.trim();applyFilters()">
            <span class="search-count" id="searchCount">\${ALL_VULNS.length} of \${ALL_VULNS.length}</span>
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
                \${pluginOpts}
              </select>
            </div>
          </div>
        </div>\`;

        h += \`<div class="section">
          <div class="sec-header" onclick="tog('vulnBody','vulnChev')">
            <div class="sec-title">Vulnerabilities <span class="sec-count">\${ALL_VULNS.length}</span></div>
            <div class="sec-chevron open" id="vulnChev">▾</div>
          </div>
          <div class="vuln-table-head">
            <div>Severity</div><div>Vulnerability</div><div>CVEs</div><div>References</div>
          </div>
          <div class="sec-body open" id="vulnBody">\${renderVulnRows(ALL_VULNS)}</div>
        </div>\`;
      }

      if (plugins.length) {
        const plugHtml = plugins.map((p,idx) => {
          const pid = 'plg'+idx, vc = p.vulns ? p.vulns.length : 0;
          return \`<div class="plugin-item">
            <div class="plugin-row" onclick="togP('\${pid}')">
              <div class="plugin-info">
                <div class="plugin-icon">🧩</div>
                <div>
                  <div class="plugin-name">\${esc(p.name)}</div>
                  \${(()=>{ const verParts = []; const cls = p.versionStatus==='uptodate'?'ver-uptodate':p.versionStatus==='outdated'?'ver-outdated':''; if(p.version) verParts.push('v'+esc(p.version)); if(p.latestVersion && p.versionStatus==='outdated') verParts.push('→ ' + esc(p.latestVersion)); if(p.versionStatus==='uptodate') verParts.push('✓ up to date'); else if(p.versionStatus==='outdated') verParts.push('⚠ outdated'); return verParts.length ? \`<div class="plugin-ver \${cls}">\${verParts.join(' ')}</div>\` : p.latestVersion ? \`<div class="plugin-ver">latest: \${esc(p.latestVersion)}</div>\` : ''; })()}
                </div>
              </div>
              <div class="plugin-meta">
                <span class="plugin-vuln-count \${vc>0?'pvc-danger':'pvc-safe'}">\${vc} vuln\${vc!==1?'s':''}</span>
              </div>
            </div>
            <div class="plugin-body" id="\${pid}">
              \${vc > 0 ? '<div class="vuln-table-head"><div>Severity</div><div>Vulnerability</div><div>CVEs</div><div>References</div></div>' + renderVulnRows(p.vulns) : '<div class="empty-msg">No known vulnerabilities.</div>'}
            </div>
          </div>\`;
        }).join('');
        h += \`<div class="section">
          <div class="sec-header" onclick="tog('plugBody','plugChev')">
            <div class="sec-title">Plugins <span class="sec-count">\${plugins.length}</span></div>
            <div class="sec-chevron" id="plugChev">▾</div>
          </div>
          <div class="sec-body" id="plugBody">\${plugHtml}</div>
        </div>\`;
      }

      if (data.interesting_findings && data.interesting_findings.length) {
        h += \`<div class="section">
          <div class="sec-header" onclick="tog('findBody','findChev')">
            <div class="sec-title">Interesting Findings <span class="sec-count">\${data.interesting_findings.length}</span></div>
            <div class="sec-chevron" id="findChev">▾</div>
          </div>
          <div class="sec-body" id="findBody">
            \${data.interesting_findings.map(f => \`<div class="finding-row"><div class="finding-marker"></div><div>\${esc(f)}</div></div>\`).join('')}
          </div>
        </div>\`;
      }

      if (data.users && data.users.length) {
        h += \`<div class="section">
          <div class="sec-header" onclick="tog('usrBody','usrChev')">
            <div class="sec-title">Users Found <span class="sec-count">\${data.users.length}</span></div>
            <div class="sec-chevron open" id="usrChev">▾</div>
          </div>
          <div class="sec-body open" id="usrBody">
            \${data.users.map(u => \`<div class="user-row"><div class="user-icon">👤</div><div>\${esc(u)}</div></div>\`).join('')}
          </div>
        </div>\`;
      }

      return h;
    },
    onLoadHistory: function(data) {
        ALL_VULNS = data.vulnerabilities || [];
        document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + this.render(data) + '</div>';
    },
    getSummary: function(data) {
      return 'Analysis complete — ' + data.summary.total_vulns + ' vulnerabilities found';
    },
    saveHistoryParams: function(data) {
      const e = data.summary;
      const badges = [];
      if (e.critical) badges.push(\`<span class="hist-badge hb-c">C:\${e.critical}</span>\`);
      if (e.high) badges.push(\`<span class="hist-badge hb-h">H:\${e.high}</span>\`);
      if (e.medium) badges.push(\`<span class="hist-badge hb-m">M:\${e.medium}</span>\`);
      if (e.low) badges.push(\`<span class="hist-badge hb-l">L:\${e.low}</span>\`);
      if (!e.total_vulns) badges.push(\`<span class="hist-badge hb-t">Clean</span>\`);
      return { title: data.target, badges: badges.join('') };
    }
  });

'@

$finalWpscan = "(function() {`n" + $wpscanLogic + "`n" + $filtersLogic + "`n" + $wpscanRegistry + "`n})();"
Set-Content -Path 'js\wpscan.js' -Value $finalWpscan -Encoding UTF8

$nmapJs = Get-Content 'nmap-parser.js' -Raw -Encoding UTF8
$nmapJs += @'

window.registerTool({
  id: 'nmap',
  name: 'Nmap',
  match: function(raw) {
    return raw.startsWith('Starting Nmap') || raw.includes('Nmap scan report for');
  },
  parse: function(raw) {
    return parseNmap(raw);
  },
  render: function(data) {
    window.LAST_NMAP_DATA = data;
    return renderNmapTable(data);
  },
  getSummary: function(data) {
    return 'Analysis complete — ' + data.length + ' hosts found';
  },
  saveHistoryParams: function(data) {
    const totalPorts = data.reduce((acc, host) => acc + host.ports.length, 0);
    const badges = \`<span class="hist-badge hb-h">\${totalPorts} Ports</span>\`;
    return { title: data[0] ? data[0].ip : 'Nmap Scan', badges: badges };
  }
});
'@
Set-Content -Path 'js\nmap.js' -Value $nmapJs -Encoding UTF8
Remove-Item 'nmap-parser.js' -ErrorAction SilentlyContinue
Remove-Item 'refactor.js' -ErrorAction SilentlyContinue

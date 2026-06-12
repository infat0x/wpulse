(function() {

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

let ALL_VULNS = [];
let ACTIVE_SEVERITY = new Set();
let ACTIVE_SPECIAL = new Set();
let FILTER_PLUGIN = '';
let FILTER_FIX = '';
let SEARCH_TERM = '';

window.toggleSev = function(sev, btn) {
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
};

window.toggleSpecial = function(key, btn) {
  if (ACTIVE_SPECIAL.has(key)) { ACTIVE_SPECIAL.delete(key); btn.classList.remove('active'); }
  else { ACTIVE_SPECIAL.add(key); btn.classList.add('active'); }
  applyFilters();
};

window.setPluginFilter = function(val) {
  FILTER_PLUGIN = val;
  applyFilters();
};

window.setFixFilter = function(val) {
  FILTER_FIX = val;
  applyFilters();
};

window.applyFilters = function() {
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
};

window.setSearchTerm = function(val) {
    SEARCH_TERM = val.trim();
    applyFilters();
};

function renderVulnRows(vulns) {
  if (!vulns || !vulns.length) return '<div class="empty-msg">No vulnerabilities match filters.</div>';
  return vulns.map(v => {
    const sev = v.severity || 'low';
    const isUnauth = v.title.toLowerCase().includes('unauthenticated');

    const cves = (v.cves || []).slice(0,3).map(c =>
      `<a class="cve-tag" href="${esc(c.cve_url)}" target="_blank" rel="noopener">${esc(c.id)}</a>`
    ).join('');

    const refs = (v.references || []).slice(0,3).map(r => {
      const isPoc = r.includes('exploit') || r.includes('github') || r.includes('poc');
      const isWp = r.includes('wpscan');
      const label = isPoc ? '💥 PoC' : isWp ? 'WPScan' : 'Ref';
      return `<a class="ref-link${isPoc?' poc-link':''}" href="${esc(r)}" target="_blank" rel="noopener">${label}</a>`;
    }).join('');

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

window.exportJSON = function() {
  if (!window.LAST_DATA) return;
  const blob = new Blob([JSON.stringify(window.LAST_DATA, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'wpscan-report.json'; a.click();
  URL.revokeObjectURL(url);
};

window.exportCSV = function() {
  if (!window.LAST_DATA) return;
  const header = 'Severity,Title,Plugin,Fixed In,CVEs\n';
  const rows = (window.LAST_DATA.vulnerabilities||[]).map(v => {
    const cves = (v.cves||[]).map(c=>c.id).join('; ');
    return `"${v.severity}","${v.title.replace(/"/g,'""')}","${v.plugin||''}","${v.fixed_in||''}","${cves}"`;
  }).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'wpscan-report.csv'; a.click();
  URL.revokeObjectURL(url);
};

window.registerTool({
  id: 'wpscan',
  name: 'WPScan',
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="40" height="40"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  description: 'Analyze WPScan vulnerabilities, CVEs, and outdated plugins.',
  placeholder: 'Paste your WPScan output here...\n\nExample:\nwpscan --url http://target --enumerate vp --api-token TOKEN',
  exampleFile: './example-input.txt',
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
      h += `<div class="target-header">
        <div class="target-marker"></div>
        <div class="target-url">${esc(data.target)}</div>
        <div class="target-badges">
          ${data.wordpress_version ? `<span class="target-badge wp-ver">WP ${esc(data.wordpress_version)}</span>` : ''}
          <span class="target-badge">${s.plugins_found} Plugins</span>
          <span class="target-badge">${s.total_vulns} Vulns</span>
        </div>
      </div>`;
    }

    h += `<div class="stat-grid">
      <div class="stat-card sc-total"><div class="stat-num">${s.total_vulns}</div><div class="stat-label">Total Vulns</div></div>
      <div class="stat-card sc-crit"><div class="stat-num">${s.critical}</div><div class="stat-label">Critical</div></div>
      <div class="stat-card sc-high"><div class="stat-num">${s.high}</div><div class="stat-label">High</div></div>
      <div class="stat-card sc-med"><div class="stat-num">${s.medium}</div><div class="stat-label">Medium</div></div>
      <div class="stat-card sc-low"><div class="stat-num">${s.low}</div><div class="stat-label">Low</div></div>
    </div>`;

    h += `<div class="export-bar">
      <div class="export-left">Last analyzed: ${new Date().toLocaleString()}</div>
      <div class="export-right">
        <button class="export-btn" onclick="exportJSON()">Export JSON</button>
        <button class="export-btn" onclick="exportCSV()">Export CSV</button>
      </div>
    </div>`;

    if (ALL_VULNS.length) {
      const pluginOpts = pluginNames.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
      h += `<div class="toolbar">
        <div class="toolbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" id="vulnSearch" placeholder="Search vulnerabilities by title, plugin, CVE…" oninput="setSearchTerm(this.value)">
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

    if (plugins.length) {
      const plugHtml = plugins.map((p,idx) => {
        const pid = 'plg'+idx, vc = p.vulns ? p.vulns.length : 0;
        return `<div class="plugin-item">
          <div class="plugin-row" onclick="togP('${pid}')">
            <div class="plugin-info">
              <div class="plugin-icon">🧩</div>
              <div>
                <div class="plugin-name">${esc(p.name)}</div>
                ${(()=>{ const verParts = []; const cls = p.versionStatus==='uptodate'?'ver-uptodate':p.versionStatus==='outdated'?'ver-outdated':''; if(p.version) verParts.push('v'+esc(p.version)); if(p.latestVersion && p.versionStatus==='outdated') verParts.push('→ ' + esc(p.latestVersion)); if(p.versionStatus==='uptodate') verParts.push('✓ up to date'); else if(p.versionStatus==='outdated') verParts.push('⚠ outdated'); return verParts.length ? `<div class="plugin-ver ${cls}">${verParts.join(' ')}</div>` : p.latestVersion ? `<div class="plugin-ver">latest: ${esc(p.latestVersion)}</div>` : ''; })()}
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

    if (data.interesting_findings && data.interesting_findings.length) {
      h += `<div class="section">
        <div class="sec-header" onclick="tog('findBody','findChev')">
          <div class="sec-title">Interesting Findings <span class="sec-count">${data.interesting_findings.length}</span></div>
          <div class="sec-chevron" id="findChev">▾</div>
        </div>
        <div class="sec-body" id="findBody">
          ${data.interesting_findings.map(f => `<div class="finding-row"><div class="finding-marker"></div><div>${esc(f)}</div></div>`).join('')}
        </div>
      </div>`;
    }

    if (data.users && data.users.length) {
      h += `<div class="section">
        <div class="sec-header" onclick="tog('usrBody','usrChev')">
          <div class="sec-title">Users Found <span class="sec-count">${data.users.length}</span></div>
          <div class="sec-chevron open" id="usrChev">▾</div>
        </div>
        <div class="sec-body open" id="usrBody">
          ${data.users.map(u => `<div class="user-row"><div class="user-icon">👤</div><div>${esc(u)}</div></div>`).join('')}
        </div>
      </div>`;
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
    if (e.critical) badges.push(`<span class="hist-badge hb-c">C:${e.critical}</span>`);
    if (e.high) badges.push(`<span class="hist-badge hb-h">H:${e.high}</span>`);
    if (e.medium) badges.push(`<span class="hist-badge hb-m">M:${e.medium}</span>`);
    if (e.low) badges.push(`<span class="hist-badge hb-l">L:${e.low}</span>`);
    if (!e.total_vulns) badges.push(`<span class="hist-badge hb-t">Clean</span>`);
    return { title: data.target, badges: badges.join('') };
  }
});

})();

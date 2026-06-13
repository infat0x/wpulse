
function parseNmap(raw) {
  const lines = raw.split(/\r?\n/);
  const hosts = [];
  let currentHost = null;
  let inPortSection = false;
  let inHostScriptSection = false;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('Nmap scan report for') || line.includes('Nmap scan report for')) {
      const match = line.match(/Nmap scan report for (.+)/);
      if (match) {
        currentHost = { ip: match[1], ports: [], os: null, info: null, hostScripts: [] };
        hosts.push(currentHost);
        inPortSection = false;
        inHostScriptSection = false;
      }
    } else if (currentHost) {
      if (line.startsWith('Service Info:')) {
        currentHost.info = line.replace('Service Info:', '').trim();
        const osMatch = currentHost.info.match(/OS:\s*([^;]+)/);
        if (osMatch) currentHost.os = osMatch[1].trim();
        inPortSection = false;
        inHostScriptSection = false;
      } else if (line.startsWith('Host script results:')) {
        inHostScriptSection = true;
        inPortSection = false;
      } else if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
        inPortSection = true;
        inHostScriptSection = false;
      } else if (inPortSection) {
        if (line === '') {
          inPortSection = false;
          continue;
        }
        
        const parts = line.split(/\s+/);
        if (parts.length >= 3 && /^\d+\/[a-z]+$/.test(parts[0])) {
          const port = parts[0];
          const state = parts[1];
          const service = parts[2];
          const version = parts.slice(3).join(' ');
          currentHost.ports.push({ port, state, service, version, scripts: [] });
        } else if (line.startsWith('|')) {
          if (currentHost.ports.length > 0) {
            let scriptLine = line.replace(/^\|_?\s*/, '');
            currentHost.ports[currentHost.ports.length - 1].scripts.push(scriptLine);
          }
        } else {
          if (!/^\d/.test(parts[0]) && !line.startsWith('|')) {
             inPortSection = false;
          }
        }
      } else if (inHostScriptSection) {
        if (line === '') {
          inHostScriptSection = false;
          continue;
        }
        if (line.startsWith('|')) {
          let scriptLine = line.replace(/^\|_?\s*/, '');
          currentHost.hostScripts.push(scriptLine);
        } else {
          inHostScriptSection = false;
        }
      }
    }
  }
  return hosts;
}

function renderNmapTable(hosts) {
  if (!hosts || !hosts.length) return '<div class="empty-msg">No hosts found in the scan.</div>';
  
  let html = `<div class="export-bar" style="margin-bottom:20px;">
    <div class="export-left">Last analyzed: ${new Date().toLocaleString()}</div>
    <div class="export-right">
      <button class="export-btn" onclick="toggleAllNmap(true)">Expand All</button>
      <button class="export-btn" onclick="toggleAllNmap(false)">Collapse All</button>
      <button class="export-btn" onclick="copyNmapIPs()">Copy IPs</button>
      <button class="export-btn" onclick="copyNmapMD()">Copy as MD</button>
      <button class="export-btn" onclick="exportNmapJSON()">Export JSON</button>
    </div>
  </div>`;
  
  for (const host of hosts) {
    let badgesHtml = `<span class="sec-count">${host.ports.length} ports</span>`;
    if (host.os) {
      badgesHtml += `<span class="sec-count" style="background:var(--accent-bg);color:var(--accent);border-color:var(--accent-bd);">${esc(host.os)}</span>`;
    }

    html += `
    <div class="section" style="margin-bottom: 20px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border);">
      <div class="sec-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none';" style="cursor: pointer; background-color: var(--bg-white); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; user-select: none;">
        <div class="sec-title" style="margin: 0; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--accent);">Host: <span onclick="window.copySingleIP('${esc(host.ip)}', event)" title="Click to copy IP" style="cursor: copy; text-decoration: underline dashed; text-underline-offset: 4px;">${esc(host.ip)}</span> ${badgesHtml}</div>
        <div style="font-size: 12px; color: var(--txt-3);">▼ Click to toggle</div>
      </div>
      <div class="sec-body" style="padding: 0; display: none; background: var(--bg-white);">`;
      
    if (host.info) {
      html += `
        <div style="padding: 12px 16px; background: var(--bg-hover); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--txt-2); display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 14px;">ℹ️</span> <strong>Service Info:</strong> ${esc(host.info)}
        </div>`;
    }

    if (host.hostScripts && host.hostScripts.length > 0) {
      let scriptLines = host.hostScripts.map(s => `<div style="padding-left: 12px; border-left: 2px solid var(--border); margin-bottom: 4px;">${esc(s)}</div>`).join('');
      html += `
        <div style="padding: 12px 16px; background: var(--bg-body); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--txt-2); font-family: monospace;">
          <div style="margin-bottom: 8px; color: var(--txt-1);"><strong>Host Scripts (${host.hostScripts.length})</strong></div>
          ${scriptLines}
        </div>`;
    }

    html += `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); background: var(--bg-white);">
              <th style="padding: 12px 16px; font-weight: 600;">Port</th>
              <th style="padding: 12px 16px; font-weight: 600;">State</th>
              <th style="padding: 12px 16px; font-weight: 600;">Service</th>
              <th style="padding: 12px 16px; font-weight: 600;">Version</th>
            </tr>
          </thead>
          <tbody>`;
          
    if (host.ports.length === 0) {
      html += `<tr><td colspan="4" style="padding: 16px; text-align: center; color: var(--txt-3);">No open ports found.</td></tr>`;
    } else {
      for (const port of host.ports) {
        let stateColor = port.state === 'open' ? 'var(--low)' : 'var(--medium)';
        
        let scriptBadge = '';
        let scriptsHtml = '';
        if (port.scripts && port.scripts.length > 0) {
          scriptBadge = `<span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px; cursor: pointer; border: 1px solid var(--border); color: var(--txt-1); display: inline-block; vertical-align: middle;" onclick="const next = this.closest('tr').nextElementSibling; next.style.display = next.style.display === 'none' ? 'table-row' : 'none';">📝 ${port.scripts.length} Info</span>`;
          let scriptLines = port.scripts.map(s => `<div style="padding-left: 8px; border-left: 2px solid var(--border); margin-bottom: 2px;">${esc(s)}</div>`).join('');
          scriptsHtml = `<tr style="display: none; background: var(--bg-body);"><td colspan="4" style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: var(--txt-2); white-space: pre-wrap; border-bottom: 1px solid var(--border);"><div style="margin-bottom: 6px; font-weight: 600; color: var(--txt-1);">Vulnerabilities / Info:</div>${scriptLines}</td></tr>`;
        }

        html += `
            <tr style="border-bottom: 1px solid var(--border); background: var(--bg-white);">
              <td style="padding: 12px 16px;"><strong>${esc(port.port)}</strong></td>
              <td style="padding: 12px 16px;"><span style="color:${stateColor}; font-weight:500">${esc(port.state)}</span></td>
              <td style="padding: 12px 16px; vertical-align: middle;">${esc(port.service)}${scriptBadge}</td>
              <td style="padding: 12px 16px; color: var(--txt-2);">${esc(port.version)}</td>
            </tr>
            ${scriptsHtml}`;
      }
    }
    html += `
          </tbody>
        </table>
      </div>
    </div>`;
  }
  return html;
}

window.copyNmapMD = function() {
  const hosts = window.LAST_NMAP_DATA;
  if (!hosts) return;
  
  let md = '### Nmap Scan Summary\n\n';
  md += '| IP Address | Open Ports | Services | OS / Info |\n';
  md += '|---|---|---|---|\n';
  
  for (const host of hosts) {
    let portList = host.ports.map(p => p.port).join(', ');
    let svcList = host.ports.map(p => p.service).join(', ');
    let osInfo = (host.os || host.info || '').replace(/\|/g, '\\|');
    md += `| **${host.ip}** | ${portList || 'None'} | ${svcList || '-'} | ${osInfo || '-'} |\n`;
  }
  
  md += '\n### Detailed Ports & Vulnerabilities\n\n';
  md += '| IP Address | Port | State | Service | Version | Scripts / Info |\n';
  md += '|---|---|---|---|---|---|\n';
  
  for (const host of hosts) {
    if (host.ports.length === 0) {
      md += `| **${host.ip}** | - | - | - | - | No open ports |\n`;
    } else {
      for (const port of host.ports) {
        let scriptsStr = port.scripts && port.scripts.length ? `${port.scripts.length} info` : '';
        let versionStr = port.version.replace(/\|/g, '\\|');
        let serviceStr = port.service.replace(/\|/g, '\\|');
        md += `| **${host.ip}** | ${port.port} | ${port.state} | ${serviceStr} | ${versionStr} | ${scriptsStr} |\n`;
      }
    }
  }

  navigator.clipboard.writeText(md).then(() => {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = 'Markdown copied to clipboard!';
      setTimeout(() => statusEl.textContent = 'Ready', 3000);
    }
  });
};

window.toggleAllNmap = function(open) {
  const bodies = document.querySelectorAll('#viewDashboard .sec-body');
  bodies.forEach(b => {
    b.style.display = open ? 'block' : 'none';
  });
};

window.copyNmapIPs = function() {
  const hosts = window.LAST_NMAP_DATA;
  if (!hosts) return;
  const ips = hosts.map(h => h.ip).join('\n');
  navigator.clipboard.writeText(ips).then(() => {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = 'IPs copied to clipboard!';
      setTimeout(() => statusEl.textContent = 'Ready', 3000);
    }
  });
};

window.copySingleIP = function(ip, event) {
  if (event) event.stopPropagation();
  navigator.clipboard.writeText(ip).then(() => {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = 'IP ' + ip + ' copied!';
      setTimeout(() => statusEl.textContent = 'Ready', 3000);
    }
  });
};

window.exportNmapJSON = function() {
  const hosts = window.LAST_NMAP_DATA;
  if (!hosts) return;
  const blob = new Blob([JSON.stringify(hosts, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'nmap-report.json'; a.click();
  URL.revokeObjectURL(url);
}

window.registerTool({
  id: 'nmap',
  name: 'Nmap',
  icon: `<svg viewBox="0 0 100 100" width="56" height="56">
  <path d="M 5,50 C 35,20 65,20 95,50 C 65,80 35,80 5,50 Z" fill="none" stroke="#6bb3d9" stroke-width="3" />
  <path d="M 12,50 C 35,30 65,30 88,50 C 65,70 35,70 12,50 Z" fill="none" stroke="#6bb3d9" stroke-width="1.5" />
  <path d="M 22,50 C 35,40 65,40 78,50 C 65,60 35,60 22,50 Z" fill="none" stroke="#6bb3d9" stroke-width="1" />
  <circle cx="50" cy="50" r="18" fill="#3b5668" />
  <circle cx="50" cy="50" r="12" fill="none" stroke="#89a8bc" stroke-width="1" />
  <circle cx="50" cy="50" r="4" fill="#ffffff" />
  <path d="M 32,50 L 68,50 M 50,32 L 50,68" stroke="#ffffff" stroke-width="1.5" />
</svg>`,
  description: 'Parse Nmap scan reports and view open ports, services, and versions.',
  placeholder: 'Paste your Nmap scan output here...\n\nExample:\nNmap scan report for 192.168.1.1\nPORT     STATE SERVICE\n80/tcp   open  http',
  exampleFile: './examples/example-nmap-input.txt',
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
    const badges = `<span class="hist-badge hb-h">${totalPorts} Ports</span>`;
    return { title: data[0] ? data[0].ip : 'Nmap Scan', badges: badges };
  }
});

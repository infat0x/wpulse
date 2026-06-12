function parseNmap(raw) {
  const lines = raw.split(/\r?\n/);
  const hosts = [];
  let currentHost = null;
  let inPortSection = false;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('Nmap scan report for') || line.includes('Nmap scan report for')) {
      const match = line.match(/Nmap scan report for (.+)/);
      if (match) {
        currentHost = { ip: match[1], ports: [] };
        hosts.push(currentHost);
        inPortSection = false;
      }
    } else if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
      inPortSection = true;
    } else if (inPortSection && currentHost) {
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
        currentHost.ports.push({ port, state, service, version });
      } else {
        if (!/^\d/.test(parts[0]) && !line.startsWith('|')) {
           inPortSection = false;
        }
      }
    }
  }
  return hosts;
}

function renderNmapTable(hosts) {
  if (!hosts || !hosts.length) return '<div class="empty-msg">No hosts found in the scan.</div>';
  
  let html = '<div class="export-bar" style="margin-bottom:20px;text-align:right;"><button class="btn btn-secondary" onclick="exportNmapMD()">Export Markdown</button></div>';
  
  for (const host of hosts) {
    html += `
    <div class="section" style="margin-bottom: 20px;">
      <div class="sec-header">
        <div class="sec-title">Host: ${host.ip} <span class="sec-count">${host.ports.length} ports</span></div>
      </div>
      <div class="sec-body open" style="padding: 0;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); background: var(--bg-hover);">
              <th style="padding: 12px; font-weight: 600;">Port</th>
              <th style="padding: 12px; font-weight: 600;">State</th>
              <th style="padding: 12px; font-weight: 600;">Service</th>
              <th style="padding: 12px; font-weight: 600;">Version</th>
            </tr>
          </thead>
          <tbody>`;
    if (host.ports.length === 0) {
      html += `<tr><td colspan="4" style="padding: 12px; text-align: center; color: var(--txt-3);">No open ports found.</td></tr>`;
    } else {
      for (const port of host.ports) {
        let stateColor = port.state === 'open' ? 'var(--low)' : 'var(--medium)';
        html += `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px;"><strong>${port.port}</strong></td>
              <td style="padding: 12px;"><span style="color:${stateColor}; font-weight:500">${port.state}</span></td>
              <td style="padding: 12px;">${port.service}</td>
              <td style="padding: 12px; color: var(--txt-2);">${port.version}</td>
            </tr>`;
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

function exportNmapMD() {
  const hosts = window.LAST_NMAP_DATA;
  if (!hosts) return;
  
  let md = '# Nmap Scan Report\n\n';
  for (const host of hosts) {
    md += `## Host: ${host.ip}\n`;
    if (host.ports.length === 0) {
      md += `*No open ports found.*\n\n`;
    } else {
      md += `| Port | State | Service | Version |\n`;
      md += `|---|---|---|---|\n`;
      for (const port of host.ports) {
        md += `| ${port.port} | ${port.state} | ${port.service} | ${port.version} |\n`;
      }
      md += `\n`;
    }
  }
  
  const blob = new Blob([md], {type:'text/markdown'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'nmap-report.md'; a.click();
  URL.revokeObjectURL(url);
}

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

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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
        currentHost = { ip: match[1], ports: [], os: null, info: null };
        hosts.push(currentHost);
        inPortSection = false;
      }
    } else if (currentHost) {
      if (line.startsWith('Service Info:')) {
        currentHost.info = line.replace('Service Info:', '').trim();
        const osMatch = currentHost.info.match(/OS:\s*([^;]+)/);
        if (osMatch) currentHost.os = osMatch[1].trim();
        inPortSection = false;
      } else if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
        inPortSection = true;
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
          currentHost.ports.push({ port, state, service, version });
        } else {
          if (!/^\d/.test(parts[0]) && !line.startsWith('|')) {
             inPortSection = false;
          }
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
    let badgesHtml = `<span class="sec-count">${host.ports.length} ports</span>`;
    if (host.os) {
      badgesHtml += `<span class="sec-count" style="background:var(--accent-bg);color:var(--accent);border-color:var(--accent-bd);">${esc(host.os)}</span>`;
    }

    html += `
    <div class="section" style="margin-bottom: 20px;">
      <div class="sec-header">
        <div class="sec-title">Host: ${esc(host.ip)} ${badgesHtml}</div>
      </div>
      <div class="sec-body open" style="padding: 0;">`;
      
    if (host.info) {
      html += `
        <div style="padding: 12px 16px; background: var(--bg-hover); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--txt-2); display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 14px;">ℹ️</span> <strong>Service Info:</strong> ${esc(host.info)}
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
        html += `
            <tr style="border-bottom: 1px solid var(--border); background: var(--bg-white);">
              <td style="padding: 12px 16px;"><strong>${esc(port.port)}</strong></td>
              <td style="padding: 12px 16px;"><span style="color:${stateColor}; font-weight:500">${esc(port.state)}</span></td>
              <td style="padding: 12px 16px;">${esc(port.service)}</td>
              <td style="padding: 12px 16px; color: var(--txt-2);">${esc(port.version)}</td>
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
  icon: '🌐',
  description: 'Parse Nmap scan reports and view open ports, services, and versions.',
  placeholder: 'Paste your Nmap scan output here...\n\nExample:\nNmap scan report for 192.168.1.1\nPORT     STATE SERVICE\n80/tcp   open  http',
  exampleText: 'Starting Nmap 7.92 ( https://nmap.org ) at 2023-10-27 10:00\nNmap scan report for scanme.nmap.org (45.33.32.156)\nHost is up (0.040s latency).\nNot shown: 996 closed tcp ports\nPORT      STATE SERVICE    VERSION\n22/tcp    open  ssh        OpenSSH 6.6.1p1\n80/tcp    open  http       Apache httpd 2.4.7\n9929/tcp  open  nping-echo Nping echo\n31337/tcp open  tcpwrapped\n\nNmap done: 1 IP address (1 host up) scanned in 12.08 seconds',
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

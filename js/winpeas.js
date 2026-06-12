(function() {

function esc(s) {
  if (!s) return '';
  return s.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

window.registerTool({
  id: 'winpeas',
  name: 'WinPEAS',
  icon: `<svg viewBox="0 0 88 88" width="56" height="56" fill="var(--accent)"><polygon points="0,12 35,7 35,42 0,42"/><polygon points="39,6 88,0 88,42 39,42"/><polygon points="0,46 35,46 35,80 0,75"/><polygon points="39,46 88,46 88,88 39,81"/></svg>`,
  description: 'Parse WinPEAS output to identify Windows privilege escalation paths and misconfigurations.',
  placeholder: 'Paste your WinPEAS output here...\n\nExample:\n=========|| SYSTEM INFORMATION ||=========\n...',
  exampleText: '=========|| SYSTEM INFORMATION ||=========\nHostname: WIN-SERVER\nOS: Windows Server 2019\n\n=========|| PRIVILEGES ||=========\nSeDebugPrivilege  Enabled\n\n=========|| USERS AND GROUPS ||=========\nAdministrator\nGuest\n\n=========|| UNQUOTED SERVICE PATHS ||=========\nUnquoted Service Path found!\nName: VulnerableService\nPathName: C:\\Program Files\\Vuln App\\service.exe',
  match: function(raw) {
    return /=========\|\||winpeas/i.test(raw);
  },
  parse: function(raw) {
    const lines = raw.split('\n');
    const sections = [];
    let currentSection = { title: 'General Info', lines: [], type: 'info' };
    
    let criticalCount = 0;
    let highCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      
      // Detect section headers
      let title = "";
      let headerMatch = line.match(/^(?:[?═▄█■]{6,}|={4,}\|\|)\s*(.*?)(?:\s*[?═▄█■]{6,}|\s*\|\|={4,})?\s*$/);
      if (headerMatch) {
          title = headerMatch[1].replace(/[?═▄█■=|\s]+$/, '').trim();
      } else if (line.includes('=========||')) {
          title = line.replace(/=+|\|+/g, '').trim();
      }
      
      if (title) {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: title, lines: [], type: 'info' };
      } else {
        currentSection.lines.push(line);
        
        // Very basic heuristic for highlighting
        let lower = line.toLowerCase();
        if (lower.includes('password') || lower.includes('credential') || lower.includes('unquoted service path') || lower.includes('vulnerable') || lower.includes('found:') || lower.includes('[critical]') || lower.includes('[!]')) {
           currentSection.type = 'critical';
           criticalCount++;
        } else if (lower.includes('permission') || lower.includes('denied') || lower.includes('enabled') || lower.includes('[important]')) {
           if (currentSection.type !== 'critical') currentSection.type = 'warning';
           highCount++;
        }
      }
    }
    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
    
    return {
      target: 'Windows Host',
      sections: sections,
      critical: criticalCount,
      high: highCount
    };
  },
  render: function(data) {
    window.LAST_WINPEAS_DATA = data;
    
    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
      <h2 style="font-family:var(--display); font-size:24px; color:var(--txt);">WinPEAS Report</h2>
      <div>
        <span style="display:inline-block; margin-right:10px; padding:6px 12px; background:var(--critical-bg); color:var(--critical); border:1px solid var(--critical-bd); border-radius:6px; font-weight:600; font-size:14px;">${data.critical} Alerts</span>
      </div>
    </div>`;
    
    html += `<div style="display:flex; flex-direction:column; gap:16px;">`;
    
    data.sections.forEach(sec => {
      let badge = '';
      if (sec.type === 'critical') {
        badge = `<span style="background:var(--critical-bg); color:var(--critical); padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; margin-left:12px;">Alerts Found</span>`;
      } else if (sec.type === 'warning') {
        badge = `<span style="background:var(--medium-bg); color:var(--medium); padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; margin-left:12px;">Warnings</span>`;
      }
      
      let secHtml = `<div class="tool-card" style="align-items:stretch; text-align:left; padding:0; overflow:hidden; background:var(--bg-white); background-image:none;">`;
      secHtml += `
        <div onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'block':'none';" style="cursor:pointer; background:var(--bg-warm); padding:16px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border);">
          <div style="font-weight:600; font-size:16px; color:var(--accent); display:flex; align-items:center;">
            ${esc(sec.title)} ${badge}
          </div>
          <span style="color:var(--txt-3); font-size:12px;">${sec.lines.length} lines</span>
        </div>
        <div style="display:none; padding:16px 20px; background:var(--bg-white);">
          <pre style="font-family:var(--mono); font-size:13px; color:var(--txt-2); white-space:pre-wrap; word-break:break-all; line-height:1.5;">${esc(sec.lines.join('\n'))}</pre>
        </div>
      `;
      secHtml += `</div>`;
      html += secHtml;
    });
    
    html += `</div>`;
    return html;
  },
  getSummary: function(data) {
    return {
      title: 'WinPEAS Result',
      badges: `<span class="hist-badge hb-c">${data.critical} Alerts</span>`
    };
  }
});

})();

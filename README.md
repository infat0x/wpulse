<div align="center">
  <img src="logo.png" alt="WPulse Logo" style="background: transparent;" width="175">
  
  <h1>WPulse</h1>
  
  <p>
    <img src="https://img.shields.io/badge/Language-JavaScript-yellow?style=flat&logo=javascript" alt="JS">
    <img src="https://img.shields.io/badge/Tool-WPScan-blue?style=flat&logo=shield" alt="WPScan">
    <img src="https://img.shields.io/badge/Tool-Nmap-blue?style=flat&logo=shield" alt="Nmap">
    <img src="https://img.shields.io/badge/Tool-WinPEAS-blue?style=flat&logo=shield" alt="WinPEAS">
    <img src="https://img.shields.io/badge/Category-Security-red?style=flat&logo=security" alt="Security">
  </p>
</div>

Browser-based Security Multi-Tool Analyzer. Select a tool from the dashboard, paste your scan results, and get an instant vulnerability and service dashboard with severity classification, CVE extraction, and advanced filtering. Runs entirely in the client browser.

**Live Demo:** https://infat0x.github.io/wpulse/

## Features

- Client-side execution: No backend required, data remains entirely within your browser.
- Multi-tool support: Modules for WPScan, Nmap, and WinPEAS.
- Severity classification: Organizes findings into Critical, High, Medium, and Low risk categories.
- CVE extraction: Automatically detects and links CVE references.
- Advanced Global Search: Custom traversal search algorithm that automatically expands hidden sections and highlights matched terms across the active view.
- Content filtering: Filter by severity, plugin, fix status, and authentication level.
- Export capabilities: Download reports in JSON and CSV formats.
- Drag and drop file support.
- Local storage-based scan history.
- Built-in examples integrated via local directory loading.

## File Structure

- `index.html`: Main application interface
- `css/main.css`: Core design system and styling rules
- `js/app.js`: Application logic, global search, and tool registry
- `js/wpscan.js`: WPScan parser and UI module
- `js/nmap.js`: Nmap parser and UI module
- `js/winpeas.js`: WinPEAS parser and UI module
- `examples/`: Directory containing example output files for testing

## License

MIT License

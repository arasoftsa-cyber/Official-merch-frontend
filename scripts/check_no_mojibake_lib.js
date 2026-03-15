const fs = require('fs');
const path = require('path');

const DEFAULT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const SUSPICIOUS_PATTERNS = [
  '\uFFFD',
  'â€™',
  'â€œ',
  'â€�',
  'â€”',
  'â€“',
  'â€¦',
  'Ã',
  'Â',
];

function scanDirectory(rootDir, options = {}) {
  const baseDir = options.baseDir || rootDir;
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  const findings = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!extensions.has(path.extname(entry.name))) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        SUSPICIOUS_PATTERNS.forEach((pattern) => {
          if (!line.includes(pattern)) return;
          findings.push({
            file: path.relative(baseDir, fullPath),
            line: index + 1,
            pattern,
          });
        });
      });
    }
  }

  walk(rootDir);
  return findings;
}

function formatFindings(findings) {
  return findings
    .map((finding) => `- ${finding.file}:${finding.line} [pattern: ${JSON.stringify(finding.pattern)}]`)
    .join('\n');
}

module.exports = {
  DEFAULT_EXTENSIONS,
  SUSPICIOUS_PATTERNS,
  formatFindings,
  scanDirectory,
};

const path = require('path');
const { formatFindings, scanDirectory } = require('./check_no_mojibake_lib');

const rootDir = path.resolve(__dirname, '..', 'src');
const findings = scanDirectory(rootDir, {
  baseDir: path.resolve(__dirname, '..'),
});

if (findings.length > 0) {
  console.error('Potential mojibake detected in frontend source:');
  console.error(formatFindings(findings));
  process.exit(1);
}

console.log('No mojibake signatures found in frontend source.');

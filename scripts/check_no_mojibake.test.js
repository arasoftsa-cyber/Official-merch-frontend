const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');

const { formatFindings, scanDirectory } = require('./check_no_mojibake_lib');

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojibake-guard-'));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testCleanContentPasses() {
  withTempDir((tempDir) => {
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'LoadingState.tsx'),
      "export default function LoadingState() { return 'Loading...'; }\n",
      'utf8'
    );

    const findings = scanDirectory(srcDir, { baseDir: tempDir });
    assert.deepEqual(findings, []);
  });
}

function testRepresentativePatternsFail() {
  withTempDir((tempDir) => {
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'BrokenCopy.tsx'),
      [
        "export const a = 'Itâ€™s broken here';",
        "export const b = 'Loadingâ€¦';",
        "export const c = 'Bad replacement � marker';",
      ].join('\n'),
      'utf8'
    );

    const findings = scanDirectory(srcDir, { baseDir: tempDir });
    assert.equal(findings.length, 3);
    assert.deepEqual(
      findings.map((finding) => ({ file: finding.file, line: finding.line, pattern: finding.pattern })),
      [
        { file: path.join('src', 'BrokenCopy.tsx'), line: 1, pattern: 'â€™' },
        { file: path.join('src', 'BrokenCopy.tsx'), line: 2, pattern: 'â€¦' },
        { file: path.join('src', 'BrokenCopy.tsx'), line: 3, pattern: '\uFFFD' },
      ]
    );
  });
}

function testActionableReporting() {
  const output = formatFindings([
    { file: path.join('src', 'BrokenCopy.tsx'), line: 4, pattern: 'â€œ' },
  ]);

  assert.match(output, /src[\\/]+BrokenCopy\.tsx:4/);
  assert.match(output, /\[pattern: "â€œ"\]/);
}

testCleanContentPasses();
testRepresentativePatternsFail();
testActionableReporting();

console.log('UTF-8 guard tests passed.');

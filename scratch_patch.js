const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'tests', 'coldstart_por.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace constants
content = content.replace(/const N_TASKS = 5;(.*?reduced from paper's 20)/, 'const N_TASKS = 20; // reverted to paper defaults for benchmarks');
content = content.replace(/const M_ROUNDS = 3;(.*?reduced from paper's 10)/, 'const M_ROUNDS = 10; // reverted to paper defaults for benchmarks');

// Replace ZERO_ROOT declaration with a real Merkle tree
content = content.replace(/const ZERO_ROOT = Array\(32\)\.fill\(0\) as number\[\];/, `// Benchmark-ready Merkle Tree Dataset
  const dummyDataset = Array.from({ length: N_TASKS }, (_, i) => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(i, 0);
    return buf;
  });
  const merkleTree = buildMerkleTree(dummyDataset);
  const REAL_ROOT = Array.from(merkleTree.root) as number[];`);

// In initializeNetwork, replace ZERO_ROOT and 0 depths
content = content.replace(/ZERO_ROOT,\s*\/\/\s*Fix 1A:(.*?)\n\s*0,\s*\/\/\s*merkle_depth = 0/, `REAL_ROOT, // Actually using real Merkle root now\n        Math.ceil(Math.log2(N_TASKS)), // real merkle depth`);

// Replace all dummyLeaf / emptyProof instances inside loops
const targetRegex = /const dummyLeaf = Array\(32\)\.fill\(0\) as number\[\];\s*const emptyProof: number\[\]\[\] = \[\];\s*for \((.*?)\) \{([\s\S]*?)await program\.methods\s*\.submitTaskProof\(i,\s*dummyLeaf,\s*emptyProof\)/g;

content = content.replace(targetRegex, (match, loopCond, preAwait) => {
    return `for (${loopCond}) {
      const leafData = Array.from(dummyDataset[i]);
      const proofBuf = getMerkleProof(merkleTree.layers, i);
      const proof = proofBuf.map(b => Array.from(b));${preAwait}await program.methods
        .submitTaskProof(i, leafData, proof)`;
});

// There is one edge case in `3b. Candidate submits...` where dummyLeaf is outside the loop and the loop isn't matched exactly:
content = content.replace(/const dummyLeaf = Array\(32\)\.fill\(0\) as number\[\];\n\s*const emptyProof: number\[\]\[\] = \[\];/g, '');

content = content.replace(/\.submitTaskProof\(i, dummyLeaf, emptyProof\)/g, `.submitTaskProof(i, Array.from(dummyDataset[i]), getMerkleProof(merkleTree.layers, i).map(b => Array.from(b)))`);


fs.writeFileSync(filePath, content, 'utf8');

console.log("Successfully rewrote tests to use N=20, M=10, and Real Merkle Trees.");

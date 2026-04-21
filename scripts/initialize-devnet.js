/**
 * scripts/initialize-devnet.js
 * 
 * Script to initialize the NetworkConfig on-chain on Devnet.
 * Run this after `anchor deploy`.
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Load the IDL
const idlPath = path.resolve(__dirname, "../target/idl/coldstart_por.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

async function main() {
  // Configure the provider to use the local wallet and devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const programId = new PublicKey("CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh");
  const program = new anchor.Program(idl, programId, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  console.log("Config PDA:", configPda.toBase58());

  // Constants (matching the ones in the implementation)
  const deltaBps = new anchor.BN(10);
  const alphaBps = new anchor.BN(500);
  const thetaPBps = new anchor.BN(100);
  const tauVBps = new anchor.BN(500);
  const lambdaBps = new anchor.BN(9000);
  const nTasks = 5;
  const mRounds = 3;

  // Derive the Merkle root from the canonical dataset (20 tasks)
  // We mirror the logic in merkle.js here to ensure consistency
  const crypto = require("crypto");
  function sha256(data) {
    return crypto.createHash("sha256").update(data).digest();
  }

  const taskDataset = Array.from({ length: 20 }, (_, i) => {
    const buf = Buffer.alloc(32);
    buf.write(`por-task-${i.toString().padStart(3, "0")}-slot-demo`, 0, "utf8");
    return buf;
  });

  const leaves = taskDataset.map((d) => sha256(d));
  let layer = [...leaves];
  while (layer.length & (layer.length - 1)) {
    layer.push(layer[layer.length - 1]);
  }

  const depth = Math.log2(layer.length);
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(Buffer.concat([layer[i], layer[i + 1]])));
    }
    layer = next;
  }
  const root = layer[0];

  console.log("Initialzing with Merkle Root:", root.toString("hex"));
  console.log("Merkle Depth:", depth);

  try {
    const tx = await program.methods
      .initializeNetwork(
        deltaBps,
        alphaBps,
        thetaPBps,
        tauVBps,
        lambdaBps,
        nTasks,
        mRounds,
        Array.from(root),
        depth
      )
      .accounts({
        authority: provider.wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialization TX:", tx);
  } catch (err) {
    if (err.message.includes("already in use")) {
      console.log("Network already initialized.");
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

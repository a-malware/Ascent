import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ColdstartPor } from "../target/types/coldstart_por";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import { Buffer } from "buffer";

describe("Initialize Devnet", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ColdstartPor as Program<ColdstartPor>;

  it("Initializes the network config", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    const deltaBps = new anchor.BN(10);
    const alphaBps = new anchor.BN(500);
    const thetaPBps = new anchor.BN(100);
    const tauVBps = new anchor.BN(500);
    const lambdaBps = new anchor.BN(9000);
    const nTasks = 5;
    const mRounds = 3;

    function sha256(data: Buffer): Buffer {
      return createHash("sha256").update(data).digest();
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
      const next: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(sha256(Buffer.concat([layer[i], layer[i + 1]])));
      }
      layer = next;
    }
    const root = layer[0];

    console.log("Root:", root.toString("hex"));
    console.log("Config PDA:", configPda.toBase58());

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
      console.log("Success Tx:", tx);
    } catch (err: any) {
      console.log("Error or already initialized:", err.message);
    }
  });
});

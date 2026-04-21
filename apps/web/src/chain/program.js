/**
 * chain/program.js
 *
 * Anchor Program singleton + PDA derivation helpers.
 * Using @coral-xyz/anchor directly with window.solana (Phantom native).
 */

import * as anchor from "@coral-xyz/anchor";
const { Program, AnchorProvider } = anchor;
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import IDL from "./idl/coldstart_por.json";

// ─── Program identity ────────────────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey(
  "CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh"
);

// ─── Network config ──────────────────────────────────────────────────────────
const CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet";
export const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC ?? clusterApiUrl(CLUSTER);

/** Shared Connection — reuse for all reads. */
export const connection = new Connection(RPC_ENDPOINT, "confirmed");

/**
 * Build an AnchorProvider from an injected wallet (window.solana / Phantom).
 * Also sets it as the global provider so Program can auto-discover it.
 */
export function getProvider(wallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  // Required for @coral-xyz/anchor v0.30+ — sets the global provider
  anchor.setProvider(provider);
  return provider;
}

/**
 * Return a Program instance.
 * In anchor v0.30+, Program(idl, provider) — program ID comes from idl.address.
 */
export function getProgram(provider) {
  return new Program(IDL, provider);
}

// ─── PDA derivation helpers ───────────────────────────────────────────────────

/** Global network config PDA — seeds: ["config"] */
export function configPda() {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("config")],
    PROGRAM_ID
  );
}

/** Per-node state PDA — seeds: ["node", owner] */
export function nodePda(ownerPubkey) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("node"), ownerPubkey.toBytes()],
    PROGRAM_ID
  );
}

/** Vouch record PDA — seeds: ["vouch", voucher, candidate] */
export function vouchPda(voucherPubkey, candidatePubkey) {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("vouch"),
      voucherPubkey.toBytes(),
      candidatePubkey.toBytes(),
    ],
    PROGRAM_ID
  );
}

/** Slash vote PDA — seeds: ["slash_vote", candidate] */
export function slashVotePda(candidatePubkey) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("slash_vote"), candidatePubkey.toBytes()],
    PROGRAM_ID
  );
}

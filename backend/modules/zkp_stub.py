"""
zkp_stub.py — ZKP-ready design stub.
CURRENT: returns eligibility flags (no raw scores).
FUTURE: replace with actual zk-SNARK/STARK proofs.
"""
from modules import reputation, registry


async def check_eligibility(node_id: str) -> dict:
    """
    ZKP-READY API. Returns only boolean flags.
    Raw reputation score is NEVER included in the response.

    FUTURE REPLACEMENT:
        proof = zkp_lib.generate_proof(
            private_value=reputation.get_score(node_id),
            threshold=config.FULL_NODE_REP_THRESHOLD,
        )
        return {"proof": proof, "threshold": config.FULL_NODE_REP_THRESHOLD}
    """
    flags = await reputation.eligibility_flags(node_id)
    phase = await registry.get_phase(node_id)
    return {
        "node_id": node_id,
        "phase": phase,
        **flags,
        "_zkp_note": "Eligibility proven without revealing raw reputation score.",
    }


async def verify_eligibility_proof(node_id: str, proof: dict) -> bool:
    """
    FUTURE: verify a ZKP proof from a peer node.
    CURRENT: trust our own local computation.
    """
    # Placeholder — in ZKP future:
    # return zkp_lib.verify(proof, threshold)
    flags = await reputation.eligibility_flags(node_id)
    return flags.get("eligible_to_propose", False)

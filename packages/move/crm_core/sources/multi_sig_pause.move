module crm_core::multi_sig_pause {
    use std::string::String;
    use crm_core::capabilities::{Self, GlobalConfig};

    const ENotAuthorized: u64 = 910;
    const EAlreadyVoted: u64 = 911;
    const EInvalidThreshold: u64 = 912;
    const EAlreadyResolved: u64 = 913;

    // Actions
    const ACTION_PAUSE: u8 = 0;
    const ACTION_UNPAUSE: u8 = 1;

    public struct PauseProposal has key {
        id: UID,
        action: u8,
        reason: String,
        voters: vector<address>,
        threshold: u64,
        signers: vector<address>,
        resolved: bool,
    }

    /// Create a proposal to pause or unpause the system.
    /// Only authorized voters can create proposals.
    public fun create_proposal(
        action: u8,
        reason: String,
        voters: vector<address>,
        threshold: u64,
        ctx: &mut TxContext,
    ): PauseProposal {
        let voter_count = voters.length();
        assert!(threshold >= 1 && threshold <= voter_count, EInvalidThreshold);

        // Creator must be in the voters list
        let sender = ctx.sender();
        assert!(is_voter(&voters, sender), ENotAuthorized);

        PauseProposal {
            id: object::new(ctx),
            action,
            reason,
            voters,
            threshold,
            signers: vector[],
            resolved: false,
        }
    }

    /// Vote on a pause proposal. When threshold is reached, config is paused/unpaused.
    public fun vote(
        proposal: &mut PauseProposal,
        config: &mut GlobalConfig,
        ctx: &mut TxContext,
    ) {
        assert!(!proposal.resolved, EAlreadyResolved);

        let sender = ctx.sender();
        assert!(is_voter(&proposal.voters, sender), ENotAuthorized);
        assert!(!is_voter(&proposal.signers, sender), EAlreadyVoted);

        proposal.signers.push_back(sender);

        // Check threshold
        if (proposal.signers.length() >= proposal.threshold) {
            proposal.resolved = true;
            if (proposal.action == ACTION_PAUSE) {
                capabilities::set_paused(config, true, option::some(proposal.reason));
            } else {
                capabilities::set_paused(config, false, option::none());
            };
        };
    }

    fun is_voter(list: &vector<address>, addr: address): bool {
        let mut i = 0;
        while (i < list.length()) {
            if (list[i] == addr) { return true };
            i = i + 1;
        };
        false
    }

    // Accessors
    public fun is_resolved(p: &PauseProposal): bool { p.resolved }
    public fun signer_count(p: &PauseProposal): u64 { p.signers.length() }
    public fun action_pause(): u8 { ACTION_PAUSE }
    public fun action_unpause(): u8 { ACTION_UNPAUSE }

    #[test_only]
    public fun test_destroy_proposal(p: PauseProposal) {
        let PauseProposal { id, .. } = p;
        object::delete(id);
    }
}

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

    /// @notice Creates a multi-sig proposal to pause or unpause the system
    /// @param action - ACTION_PAUSE (0) or ACTION_UNPAUSE (1)
    /// @param reason - human-readable reason for the proposal
    /// @param voters - list of authorized voter addresses
    /// @param threshold - number of votes required to execute
    /// @aborts EInvalidThreshold - threshold < 1 or > voter count
    /// @aborts ENotAuthorized - caller is not in the voters list
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

    /// @notice Casts a vote on a pause proposal; executes pause/unpause when threshold is reached
    /// @param proposal - the pause proposal to vote on
    /// @param config - global config (modified if threshold reached)
    /// @aborts EAlreadyResolved - proposal already resolved
    /// @aborts ENotAuthorized - caller is not in the voters list
    /// @aborts EAlreadyVoted - caller has already voted
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
    /// @notice Returns whether the proposal has been resolved
    public fun is_resolved(p: &PauseProposal): bool { p.resolved }
    /// @notice Returns the number of signers who have voted
    public fun signer_count(p: &PauseProposal): u64 { p.signers.length() }
    /// @notice Returns the PAUSE action constant (0)
    public fun action_pause(): u8 { ACTION_PAUSE }
    /// @notice Returns the UNPAUSE action constant (1)
    public fun action_unpause(): u8 { ACTION_UNPAUSE }

    #[test_only]
    public fun test_destroy_proposal(p: PauseProposal) {
        let PauseProposal { id, .. } = p;
        object::delete(id);
    }
}

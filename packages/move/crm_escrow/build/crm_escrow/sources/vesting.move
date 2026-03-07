module crm_escrow::vesting {
    // Vesting types
    const LINEAR: u8 = 0;
    const MILESTONE: u8 = 1;

    // Basis points total
    const BASIS_POINTS_TOTAL: u64 = 10000;

    public fun linear_type(): u8 { LINEAR }
    public fun milestone_type(): u8 { MILESTONE }
    public fun basis_points_total(): u64 { BASIS_POINTS_TOTAL }

    /// Calculate linearly vested amount using u128 intermediate math
    public fun calc_linear_vested(total: u64, elapsed_ms: u64, duration_ms: u64): u64 {
        if (elapsed_ms >= duration_ms) {
            return total
        };
        let total_128 = (total as u128);
        let elapsed_128 = (elapsed_ms as u128);
        let duration_128 = (duration_ms as u128);
        ((total_128 * elapsed_128 / duration_128) as u64)
    }

    /// Calculate milestone-vested amount from completed basis points
    public fun calc_milestone_vested_from_bp(total: u64, completed_bp: u64): u64 {
        let total_128 = (total as u128);
        let bp_128 = (completed_bp as u128);
        ((total_128 * bp_128 / (BASIS_POINTS_TOTAL as u128)) as u64)
    }
}

module crm_escrow::vesting {
    // Vesting types
    const LINEAR: u8 = 0;
    const MILESTONE: u8 = 1;

    // Basis points total
    const BASIS_POINTS_TOTAL: u64 = 10000;

    /// @notice Returns the LINEAR vesting type constant (0)
    public fun linear_type(): u8 { LINEAR }
    /// @notice Returns the MILESTONE vesting type constant (1)
    public fun milestone_type(): u8 { MILESTONE }
    /// @notice Returns the total basis points (10000)
    public fun basis_points_total(): u64 { BASIS_POINTS_TOTAL }

    /// @notice Calculates linearly vested amount using u128 intermediate math
    /// @param total - total funded amount
    /// @param elapsed_ms - time elapsed since vesting start
    /// @param duration_ms - total vesting duration
    public fun calc_linear_vested(total: u64, elapsed_ms: u64, duration_ms: u64): u64 {
        if (elapsed_ms >= duration_ms) {
            return total
        };
        let total_128 = (total as u128);
        let elapsed_128 = (elapsed_ms as u128);
        let duration_128 = (duration_ms as u128);
        ((total_128 * elapsed_128 / duration_128) as u64)
    }

    /// @notice Calculates milestone-vested amount from completed basis points
    /// @param total - total funded amount
    /// @param completed_bp - sum of completed milestone basis points
    public fun calc_milestone_vested_from_bp(total: u64, completed_bp: u64): u64 {
        let total_128 = (total as u128);
        let bp_128 = (completed_bp as u128);
        ((total_128 * bp_128 / (BASIS_POINTS_TOTAL as u128)) as u64)
    }
}

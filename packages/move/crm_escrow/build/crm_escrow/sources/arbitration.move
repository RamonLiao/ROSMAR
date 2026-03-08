module crm_escrow::arbitration {
    const DECISION_RELEASE: u8 = 0;
    const DECISION_REFUND: u8 = 1;

    /// @notice Returns the RELEASE decision constant (0)
    public fun decision_release(): u8 { DECISION_RELEASE }
    /// @notice Returns the REFUND decision constant (1)
    public fun decision_refund(): u8 { DECISION_REFUND }
}

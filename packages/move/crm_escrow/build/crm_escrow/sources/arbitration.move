module crm_escrow::arbitration {
    const DECISION_RELEASE: u8 = 0;
    const DECISION_REFUND: u8 = 1;

    public fun decision_release(): u8 { DECISION_RELEASE }
    public fun decision_refund(): u8 { DECISION_REFUND }
}

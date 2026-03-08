module crm_core::admin_recovery {
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    const ENotWorkspaceOwner: u64 = 900;

    /// Recovers a new WorkspaceAdminCap for the workspace owner.
    /// Only callable by the original workspace creator (owner field).
    public fun recover_admin_cap(
        config: &GlobalConfig,
        workspace: &Workspace,
        ctx: &mut TxContext,
    ): WorkspaceAdminCap {
        capabilities::assert_not_paused(config);
        assert!(workspace::owner(workspace) == ctx.sender(), ENotWorkspaceOwner);
        capabilities::create_admin_cap(workspace::id(workspace), ctx)
    }
}

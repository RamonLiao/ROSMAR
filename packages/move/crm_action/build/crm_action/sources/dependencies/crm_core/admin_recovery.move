module crm_core::admin_recovery {
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    const ENotWorkspaceOwner: u64 = 900;

    /// @notice Recovers a new WorkspaceAdminCap for the workspace owner
    /// @param config - global config (pause check)
    /// @param workspace - workspace to recover admin cap for
    /// @aborts EPaused - system is paused
    /// @aborts ENotWorkspaceOwner - caller is not the workspace owner
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

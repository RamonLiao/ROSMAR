module crm_data::ticket {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 1000;
    const EWorkspaceMismatch: u64 = 1001;
    const EInvalidTransition: u64 = 1002;

    // Status constants
    const STATUS_OPEN: u8 = 0;
    const STATUS_IN_PROGRESS: u8 = 1;
    const STATUS_WAITING: u8 = 2;
    const STATUS_RESOLVED: u8 = 3;
    const STATUS_CLOSED: u8 = 4;

    // Priority constants
    const PRIORITY_LOW: u8 = 0;
    const PRIORITY_MEDIUM: u8 = 1;
    const PRIORITY_HIGH: u8 = 2;
    const PRIORITY_URGENT: u8 = 3;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const OBJECT_TICKET: u8 = 6;

    // ===== Structs =====

    public struct Ticket has key, store {
        id: UID,
        workspace_id: ID,
        profile_id: ID,
        title: String,
        status: u8,
        priority: u8,
        assignee: Option<address>,
        sla_deadline: Option<u64>,
        first_response_at: Option<u64>,
        resolved_at: Option<u64>,
        version: u64,
        created_at: u64,
        updated_at: u64,
    }

    // ===== Events =====

    public struct AuditEventV1 has copy, drop {
        version: u8,
        workspace_id: ID,
        actor: address,
        action: u8,
        object_type: u8,
        object_id: ID,
        timestamp: u64,
    }

    public struct TicketStatusChanged has copy, drop {
        ticket_id: ID,
        workspace_id: ID,
        old_status: u8,
        new_status: u8,
    }

    // ===== Public functions =====

    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile_id: ID,
        title: String,
        priority: u8,
        assignee: Option<address>,
        sla_deadline: Option<u64>,
        ctx: &mut TxContext,
    ): Ticket {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let ticket = Ticket {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            profile_id,
            title,
            status: STATUS_OPEN,
            priority,
            assignee,
            sla_deadline,
            first_response_at: option::none(),
            resolved_at: option::none(),
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_TICKET,
            object_id: object::id(&ticket),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        ticket
    }

    /// Transition status with validation
    public fun transition_status(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        ticket: &mut Ticket,
        expected_version: u64,
        new_status: u8,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(ticket.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(ticket.version == expected_version, EVersionConflict);
        assert!(is_valid_transition(ticket.status, new_status), EInvalidTransition);

        let old_status = ticket.status;
        ticket.status = new_status;
        ticket.version = ticket.version + 1;
        ticket.updated_at = tx_context::epoch_timestamp_ms(ctx);

        // Track first response
        if (old_status == STATUS_OPEN && new_status == STATUS_IN_PROGRESS) {
            ticket.first_response_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        };

        // Track resolution
        if (new_status == STATUS_RESOLVED) {
            ticket.resolved_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        };

        event::emit(TicketStatusChanged {
            ticket_id: object::id(ticket),
            workspace_id: ticket.workspace_id,
            old_status,
            new_status,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_TICKET,
            object_id: object::id(ticket),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun assign(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        ticket: &mut Ticket,
        assignee: address,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(ticket.workspace_id == workspace::id(workspace), EWorkspaceMismatch);

        ticket.assignee = option::some(assignee);
        ticket.version = ticket.version + 1;
        ticket.updated_at = tx_context::epoch_timestamp_ms(ctx);
    }

    // ===== Internal helpers =====

    fun is_valid_transition(from: u8, to: u8): bool {
        if (from == STATUS_OPEN && to == STATUS_IN_PROGRESS) return true;
        if (from == STATUS_IN_PROGRESS && (to == STATUS_WAITING || to == STATUS_RESOLVED)) return true;
        if (from == STATUS_WAITING && (to == STATUS_IN_PROGRESS || to == STATUS_RESOLVED)) return true;
        if (from == STATUS_RESOLVED && to == STATUS_CLOSED) return true;
        // Allow re-opening from resolved
        if (from == STATUS_RESOLVED && to == STATUS_IN_PROGRESS) return true;
        false
    }

    // Accessors
    public fun workspace_id(t: &Ticket): ID { t.workspace_id }
    public fun profile_id(t: &Ticket): ID { t.profile_id }
    public fun title(t: &Ticket): &String { &t.title }
    public fun status(t: &Ticket): u8 { t.status }
    public fun priority(t: &Ticket): u8 { t.priority }
    public fun version(t: &Ticket): u64 { t.version }

    // Status constant accessors
    public fun status_open(): u8 { STATUS_OPEN }
    public fun status_in_progress(): u8 { STATUS_IN_PROGRESS }
    public fun status_waiting(): u8 { STATUS_WAITING }
    public fun status_resolved(): u8 { STATUS_RESOLVED }
    public fun status_closed(): u8 { STATUS_CLOSED }

    // Priority constant accessors
    public fun priority_low(): u8 { PRIORITY_LOW }
    public fun priority_medium(): u8 { PRIORITY_MEDIUM }
    public fun priority_high(): u8 { PRIORITY_HIGH }
    public fun priority_urgent(): u8 { PRIORITY_URGENT }
}

module crm_core::display_init {
    use sui::package;
    use sui::display;
    use crm_core::profile::Profile;
    use crm_core::workspace::Workspace;
    use crm_core::organization::Organization;
    use crm_core::deal::Deal;

    /// OTW for publisher claim
    public struct DISPLAY_INIT has drop {}

    fun init(otw: DISPLAY_INIT, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        // Profile Display
        let profile_keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"image_url".to_string(),
            b"project_url".to_string(),
        ];
        let profile_values = vector[
            b"CRM Profile #{id}".to_string(),
            b"Tier {tier} | Score {engagement_score}".to_string(),
            b"https://crm.rosmar.io/api/avatar/{id}".to_string(),
            b"https://crm.rosmar.io/profiles/{id}".to_string(),
        ];
        let mut profile_display = display::new_with_fields<Profile>(
            &publisher, profile_keys, profile_values, ctx,
        );
        display::update_version(&mut profile_display);
        transfer::public_transfer(profile_display, ctx.sender());

        // Workspace Display
        let ws_keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"project_url".to_string(),
        ];
        let ws_values = vector[
            b"{name}".to_string(),
            b"CRM Workspace | {member_count} members".to_string(),
            b"https://crm.rosmar.io/workspaces/{id}".to_string(),
        ];
        let mut ws_display = display::new_with_fields<Workspace>(
            &publisher, ws_keys, ws_values, ctx,
        );
        display::update_version(&mut ws_display);
        transfer::public_transfer(ws_display, ctx.sender());

        // Organization Display
        let org_keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"project_url".to_string(),
        ];
        let org_values = vector[
            b"{name}".to_string(),
            b"CRM Organization | Tier {tier}".to_string(),
            b"https://crm.rosmar.io/organizations/{id}".to_string(),
        ];
        let mut org_display = display::new_with_fields<Organization>(
            &publisher, org_keys, org_values, ctx,
        );
        display::update_version(&mut org_display);
        transfer::public_transfer(org_display, ctx.sender());

        // Deal Display
        let deal_keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"project_url".to_string(),
        ];
        let deal_values = vector[
            b"{title}".to_string(),
            b"CRM Deal | Stage {stage} | ${amount_usd}".to_string(),
            b"https://crm.rosmar.io/deals/{id}".to_string(),
        ];
        let mut deal_display = display::new_with_fields<Deal>(
            &publisher, deal_keys, deal_values, ctx,
        );
        display::update_version(&mut deal_display);
        transfer::public_transfer(deal_display, ctx.sender());

        transfer::public_transfer(publisher, ctx.sender());
    }
}

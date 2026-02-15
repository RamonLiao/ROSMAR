use crate::models::Profile;

pub struct ProfileService;

impl ProfileService {
    pub async fn list_profiles(workspace_id: &str) -> Result<Vec<Profile>, String> {
        Ok(vec![])
    }

    pub async fn get_profile(id: &str) -> Result<Profile, String> {
        Err("Not implemented".to_string())
    }
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Workspace {
  id: string;
  name: string;
  suiObjectId?: string | null;
}

interface Member {
  id: string;
  address: string;
  role: string;
  name?: string;
}

interface WorkspaceState {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: Member[];
  setActiveWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setMembers: (members: Member[]) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspace: null,
      workspaces: [],
      members: [],
      setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setMembers: (members) => set({ members }),
      reset: () => set({ activeWorkspace: null, workspaces: [], members: [] }),
    }),
    {
      name: 'workspace-storage',
    }
  )
);

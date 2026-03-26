import { create } from "zustand";
import { RecruitType } from "@/types";

interface AppState {
  /** 当前招聘类型：社招 | 校招 */
  recruitType: RecruitType;
  setRecruitType: (type: RecruitType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  recruitType: "social",
  setRecruitType: (type) => set({ recruitType: type }),
}));

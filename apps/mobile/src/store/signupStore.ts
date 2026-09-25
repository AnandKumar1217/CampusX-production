import { create } from "zustand";

type SignupDraft = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  college: string;
  department: string;
  academicYear: string;
  interests: string[];
};

const initialDraft: SignupDraft = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  college: "",
  department: "",
  academicYear: "",
  interests: [],
};

type SignupState = SignupDraft & {
  patch: (values: Partial<SignupDraft>) => void;
  toggleInterest: (interest: string) => void;
  reset: () => void;
};

export const useSignupStore = create<SignupState>((set) => ({
  ...initialDraft,
  patch: (values) => set(values),
  toggleInterest: (interest) =>
    set((state) => ({
      interests: state.interests.includes(interest)
        ? state.interests.filter((item) => item !== interest)
        : [...state.interests, interest],
    })),
  reset: () => set(initialDraft),
}));

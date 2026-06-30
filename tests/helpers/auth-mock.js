// Test helper: install a controllable mock for `@/lib/loggedin-user` so route
// handlers and server actions can be exercised with different roles without
// going through NextAuth. Import this file (or call `setLoggedInUser`) from a
// test file BEFORE importing any module that reads the logged-in user.
//
// Usage:
//   import { setLoggedInUser } from "./helpers/auth-mock.js";
//   setLoggedInUser({ id: instructorId, role: "instructor" });
//
// Call `setLoggedInUser(null)` to simulate an unauthenticated request.
import { vi } from "vitest";

const mockUser = { current: null };

vi.mock("@/lib/loggedin-user", () => ({
  getLoggedInUser: async () => mockUser.current
}));

vi.mock("@/auth", () => ({
  auth: async () =>
    mockUser.current
      ? {
          user: {
            id: mockUser.current.id,
            email: mockUser.current.email || "test@example.com",
            role: mockUser.current.role
          }
        }
      : null
}));

// `revalidatePath` from next/cache relies on the Next.js static-generation
// store, which isn't available in vitest. Stub it to a no-op so server
// actions that call it (e.g. adminUpdateQuizConfig) can be exercised.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {}
}));

export function setLoggedInUser(user) {
  mockUser.current = user ? { ...user } : null;
}

export function getMockUser() {
  return mockUser.current;
}

import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import App from "./App";

// Manual async-iterable builder instead of an async generator literal --
// Jest's mock-factory hoisting rejects the Babel helper an async generator
// needs when it's referenced from inside jest.mock() unless the variable
// name is prefixed with "mock". Plain Promise-based iterator sidesteps
// that entirely.
function mockMakeTokenStream(tokens: string[]) {
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (i < tokens.length) {
            return Promise.resolve({ value: tokens[i++], done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

// The native QVAC lifecycle (bare-rpc, react-native-bare-kit) doesn't run in
// Jest -- there's no physical device, no native module bridge. Mock the SDK
// boundary and test our own state machine (Descargando -> Cargando ->
// Corriendo -> Listo), same "mock the external boundary, test our logic"
// approach used throughout the backend services.
jest.mock("@qvac/sdk", () => ({
  downloadAsset: jest.fn().mockResolvedValue(undefined),
  loadModel: jest.fn().mockResolvedValue("model-1"),
  unloadModel: jest.fn().mockResolvedValue(undefined),
  completion: jest.fn(() => ({ tokenStream: mockMakeTokenStream(["Hola", " mundo"]) })),
  LLAMA_3_2_1B_INST_Q4_0: {},
  VERBOSITY: { ERROR: "error" },
}));

// SafeAreaProvider waits on native-module-supplied frame/inset metrics that
// don't exist in the Jest environment (no real device), so it never
// resolves and never renders its children -- this is the mock documented
// by react-native-safe-area-context itself for tests.
jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { frame, insets: inset },
  };
});

describe("App", () => {
  it("runs the QVAC lifecycle end to end and shows the streamed output", async () => {
    // @testing-library/react-native@14 made render() async.
    const { getByText } = await render(<App />);
    expect(getByText("QVAC Technician App")).toBeTruthy();

    await waitFor(() => {
      expect(getByText("Hola mundo")).toBeTruthy();
    });
    expect(getByText(/Listo/)).toBeTruthy();
  });
});

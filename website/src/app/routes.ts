import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/pages/Home";
import { Onboarding } from "./components/pages/Onboarding";
import { RecordingFlow } from "./components/pages/RecordingFlow";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "onboarding", Component: Onboarding },
      { path: "record", Component: RecordingFlow },
    ],
  },
]);

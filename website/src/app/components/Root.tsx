import { Outlet } from "react-router";
import { AppProvider } from "../AppContext";

export function Root() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-indigo-500/30 flex justify-center">
        <div className="w-full max-w-md bg-neutral-900 min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>
    </AppProvider>
  );
}

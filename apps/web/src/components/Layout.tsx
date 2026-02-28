import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col overflow-hidden bg-background">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full flex-1 flex-col">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}

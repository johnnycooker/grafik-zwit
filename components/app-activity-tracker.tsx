"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

function getPageLabel(pathname: string) {
  switch (pathname) {
    case "/":
      return "Strona główna";
    case "/users":
      return "Użytkownicy";
    case "/accounts":
      return "Konta";
    case "/logs":
      return "Logi";
    case "/edit":
      return "Edytor grafiku";
    case "/login":
      return "Logowanie";
    default:
      return pathname;
  }
}

export default function AppActivityTracker() {
  const pathname = usePathname();
  const { status } = useSession();
  const lastLoggedPathRef = useRef<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname) return;
    if (pathname === "/login") return;
    if (lastLoggedPathRef.current === pathname) return;

    lastLoggedPathRef.current = pathname;

    void fetch("/api/logs/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "navigation.enter",
        route: pathname,
        pageLabel: getPageLabel(pathname),
      }),
    }).catch(() => null);
  }, [pathname, status]);

  return null;
}

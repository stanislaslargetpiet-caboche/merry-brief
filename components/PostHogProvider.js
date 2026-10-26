"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export default function PostHogProvider({ children }) {
  useEffect(() => {
    initAnalytics();
  }, []);
  return children;
}

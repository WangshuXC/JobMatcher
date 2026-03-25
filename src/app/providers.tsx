"use client";

import { I18nProvider } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider locale="zh-CN">{children}</I18nProvider>;
}

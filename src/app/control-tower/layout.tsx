import React from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell channel="control-tower">{children}</AppShell>;
}

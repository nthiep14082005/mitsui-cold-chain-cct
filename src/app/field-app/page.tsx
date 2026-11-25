import { AppShell } from '@/components/layout/AppShell';
import { FieldAppPanel } from '@/components/modules/epod/FieldAppPanel';

export default function FieldAppPage() {
  return (
    <AppShell channel="field-app">
      <FieldAppPanel />
    </AppShell>
  );
}

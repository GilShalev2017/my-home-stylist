import { Suspense } from 'react';
import { Studio } from '@/components/Studio';

export default function HomePage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}

import dynamic from 'next/dynamic';

const PWAM3UManager = dynamic(() => import('../PWAM3UManager'), {
  ssr: false,
});

export default function Home() {
  return <PWAM3UManager />;
}

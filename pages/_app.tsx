import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>PWA M3U Manager</title>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;

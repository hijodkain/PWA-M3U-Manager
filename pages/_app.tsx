import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AppModeProvider } from '../AppModeContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppModeProvider>
      <Head>
        <title>PWA M3U Manager</title>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </Head>
      <Component {...pageProps} />
    </AppModeProvider>
  );
}

export default MyApp;

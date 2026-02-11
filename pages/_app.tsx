import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AppModeProvider } from '../AppModeContext';
import GenericErrorBoundary from '../GenericErrorBoundary';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <GenericErrorBoundary>
      <AppModeProvider>
        <Head>
          <title>PWA M3U Manager</title>
          <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        </Head>
        <Component {...pageProps} />
      </AppModeProvider>
    </GenericErrorBoundary>
  );
}

export default MyApp;

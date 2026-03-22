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
          <title>M3U Manager</title>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#000000" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="M3U Manager" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="icon" href="/icon-192.png" type="image/png" />
        </Head>
        <Component {...pageProps} />
      </AppModeProvider>
    </GenericErrorBoundary>
  );
}

export default MyApp;

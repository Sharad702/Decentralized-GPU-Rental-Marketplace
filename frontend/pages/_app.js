"use client";
import "../styles/globals.css";
import { Toaster } from 'react-hot-toast';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}

export default MyApp;

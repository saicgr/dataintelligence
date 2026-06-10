import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only HTML shell for static output (Expo Router convention; native ignores this file).
 * Gives the web build a real <title> + meta description — the page previously shipped
 * with an empty title, which hurt tabs, SEO, and assistive tech.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>FieldNotes — Data &amp; AI interview prep</title>
        <meta
          name="description"
          content="Daily interview prep for Data & AI engineers: role-based tracks, spaced review, and fresh cards on what just shipped."
        />
        {/* Disable body scrolling on web so ScrollView components behave like native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

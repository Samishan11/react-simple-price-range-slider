import "react-multi-input-rangeslider/style.css";

export const metadata = { title: "Consumer smoke test" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

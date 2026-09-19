import { Archivo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const archivo = Archivo({ subsets: ["latin"], variable: "--font" });

export const metadata = {
  title: "Sensor dashboard",
  description: "Live readings from an ESP32 over GSM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={archivo.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

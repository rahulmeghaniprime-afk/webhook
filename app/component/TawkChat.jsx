import { useEffect } from "react";

export default function TawkChat() {
  useEffect(() => {
    if (window.Tawk_API) return;

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    const s1 = document.createElement("script");
    s1.async = true;
    s1.src =
      "https://embed.tawk.to/6a3e59bb4d21e11d45404a0e/1js1ot2bs";
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");

    document.body.appendChild(s1);
  }, []);

  return null;
}
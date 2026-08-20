import { useEffect } from "react";

function Crispt() {
  useEffect(() => {
    // Prevent loading Crisp more than once
    if (window.$crisp) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = "7d7d11ae-e63f-4f74-bce1-b5a2c635e362";

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;

    document.head.appendChild(script);

    return () => {
      // Usually don't remove Crisp when navigating React routes.
      // Crisp should remain available throughout the app.
    };
  }, []);

  return null;
}

export default Crispt;
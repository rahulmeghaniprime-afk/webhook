import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

function Crispt() {
  useEffect(() => {
    Crisp.configure("7d7d11ae-e63f-4f74-bce1-b5a2c635e362");

    // Keep the chat minimized
    Crisp.chat.close();
  }, []);

  return null;
}

export default Crispt;
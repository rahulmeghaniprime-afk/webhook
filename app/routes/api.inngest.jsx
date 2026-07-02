import { serve } from "inngest/react";

import { inngest } from "../inngest/client";
import { functions } from "../inngest";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
});
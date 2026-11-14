import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TierLab from "./TierLab";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.hash === "#tierlab" ? <TierLab /> : <App />}
  </React.StrictMode>,
);

// The tier lab is a hash route; switching to or from it re-renders the whole page.
window.addEventListener("hashchange", () => window.location.reload());

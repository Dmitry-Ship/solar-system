import { createRoot } from "react-dom/client";
import "../styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Missing root element with id "root".');
}

async function bootstrap() {
  try {
    const { default: App } = await import("./App");
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error(error);
    rootElement.innerHTML = `<pre class="app-error">Application bootstrap failed.</pre>`;
    throw error;
  }
}

void bootstrap();

import { createRoot } from "react-dom/client";
import "../styles.css";

async function bootstrap() {
  const rootElement = document.getElementById("root");
  if (!(rootElement instanceof HTMLElement)) {
    throw new Error('Missing root element with id "root".');
  }

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

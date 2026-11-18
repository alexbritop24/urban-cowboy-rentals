export async function postAutomationWebhook(url: string | undefined, payload: unknown): Promise<void> {
  if (!url) {
    throw new Error("Automation webhook URL is missing.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Automation webhook rejected the request (HTTP ${response.status}).`);
  }
}

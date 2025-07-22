/* eslint-disable no-undef */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateComment") {
    const apiKey = request.apiKey;
    (async () => {
      try {
        const result = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-nano",
            messages: [
              { role: "system", content: "Bạn là một trợ lý AI giúp tạo nhận xét học tập." },
              { role: "user", content: request.prompt },
            ],
            temperature: 0.7,
          }),
        });

        const data = await result.json();
        const message = data?.choices?.[0]?.message?.content?.trim();

        if (message) {
          sendResponse({ comment: message });

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "insertCommentToEditor",
              comment: message,
            });
          });
        } else {
          console.warn("GPT không trả về nội dung.");
          sendResponse({ comment: null });
        }
      } catch (error) {
        console.error("GPT API error:", error);
        sendResponse({ comment: null });
      }
    })();

    return true; 
  }
});
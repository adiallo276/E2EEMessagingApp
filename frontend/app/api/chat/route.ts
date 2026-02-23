import { NextRequest, NextResponse } from "next/server";

type MessageContent = 
  | string 
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: MessageContent;
};

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey, hasImages } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is required" },
        { status: 400 }
      );
    }

    // Use GPT-4o if there are images, otherwise use GPT-3.5-turbo
    const model = hasImages ? "gpt-4o" : "gpt-3.5-turbo";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant in a secure messaging app. Keep responses concise and friendly. You are being used to test end-to-end encryption features. When analyzing images, describe what you see clearly and helpfully.",
          },
          ...messages,
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: errorData.error?.message || `OpenAI API error (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    return NextResponse.json({ reply, model });
  } catch (error: any) {
    console.error("ChatGPT API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

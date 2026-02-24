import { NextRequest, NextResponse } from "next/server";
import {
  generateAIResponse,
  parseAICommand,
  handleAICommand,
  isAICommand,
} from "@/lib/ai-integration";

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid message" },
        { status: 400 }
      );
    }

    let response: string;

    // Check if message is an AI command
    if (isAICommand(message)) {
      const parsed = parseAICommand(message);
      if (parsed) {
        response = await handleAICommand(parsed.command, parsed.args);
      } else {
        response = "Could not parse command";
      }
    } else {
      // Regular AI conversation
      response = await generateAIResponse(message, conversationHistory);
    }

    return NextResponse.json(
      {
        response,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI response" },
      { status: 500 }
    );
  }
}

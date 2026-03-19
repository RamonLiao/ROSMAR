"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Send, Bot, User } from "lucide-react";
import { useAnalystQuery, type AnalystResult } from "@/lib/hooks/use-analyst";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: AnalystResult;
  timestamp: Date;
}

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]).filter(
    (k) => typeof data[0][k] !== "object" || data[0][k] === null
  );
  if (columns.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border overflow-auto max-h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="text-xs font-medium">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 50).map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="text-xs py-1.5">
                  {String(row[col] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChartConfigDisplay({
  config,
}: {
  config: { type: string; xKey: string; yKey: string };
}) {
  return (
    <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs font-mono">
      <span className="text-muted-foreground">Chart suggestion: </span>
      {config.type} chart — X: {config.xKey}, Y: {config.yKey}
    </div>
  );
}

export function AnalystChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const analyst = useAnalystQuery();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || analyst.isPending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const result = await analyst.mutateAsync(query);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.summary,
        result,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to process query"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    inputRef.current?.focus();
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardContent className="flex flex-col flex-1 p-0 gap-0">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-20">
              <Bot className="h-10 w-10" />
              <div className="text-center">
                <p className="font-medium">AI Analyst</p>
                <p className="text-sm mt-1">
                  Ask questions about your CRM data in natural language
                </p>
                <div className="mt-4 space-y-1 text-xs text-left max-w-sm mx-auto">
                  <p>&quot;Show me all tier 3 profiles&quot;</p>
                  <p>&quot;What is the average engagement score?&quot;</p>
                  <p>&quot;Group wallet events by type&quot;</p>
                  <p>&quot;How many profiles were created this month?&quot;</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2"
                        : "space-y-1"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        {msg.result?.data && msg.result.data.length > 0 && (
                          <DataTable data={msg.result.data} />
                        )}
                        {msg.result?.chartConfig && (
                          <ChartConfigDisplay config={msg.result.chartConfig} />
                        )}
                      </>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {analyst.isPending && (
                <div className="flex gap-3 items-center">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input bar */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your CRM data..."
              disabled={analyst.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || analyst.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

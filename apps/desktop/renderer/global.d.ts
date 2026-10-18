export {};

declare global {
  interface JarvisSettings {
    profileId: string;
    textModel: string;
    realtimeModel: string;
    voice: string;
    maxSessionMinutes: number;
    workspaceRoot: string;
    apps: Array<{ id: string; label: string }>;
    hasKey: boolean;
    startupGreeting?: boolean;
    weatherLocation?: { name: string; latitude: number; longitude: number } | null;
    elevenVoiceId?: string;
    hasElevenKey?: boolean;
  }
  interface JarvisRecord { id: string; text?: string; summary?: string; name?: string; status?: string; createdAt?: string; updatedAt?: string; profileId?: string; [key: string]: unknown; }
  interface JarvisSnapshot { memories: JarvisRecord[]; tasks: JarvisRecord[]; procedures: JarvisRecord[]; }
  interface JarvisCapabilities { desktop: boolean; vision: boolean; localTest?: boolean; ephemeralBiometrics?: boolean; }
  interface JarvisWeatherAttribution { name: string; url: string; license: string; licenseUrl: string; text: string; }
  interface JarvisEvent { type: string; id?: string; runId?: string; text?: string; delta?: string; state?: string; status?: string; name?: string; summary?: string; message?: string; approvalId?: string; args?: unknown; [key: string]: any; }
  interface JarvisBridge {
    boot(): Promise<{ settings: JarvisSettings; snapshot: JarvisSnapshot; capabilities: JarvisCapabilities }>;
    saveSettings(settings: Partial<JarvisSettings> & { apiKey?: string; elevenApiKey?: string }): Promise<unknown>;
    startupGreeting?(input: { hour: number; timezone: string }): Promise<{ text: string; weatherStatus: string; locationLabel?: string; audioBase64: string | null; mime: string; reason?: string; attribution?: JarvisWeatherAttribution | string }>;
    chooseWorkspace(): Promise<string | null>;
    chooseApp(): Promise<{ id: string; label: string } | null>;
    text(input: { text: string; history: Array<{ role: string; content: string }>; profileId: string; runId: string }): Promise<any>;
    cancel(runId: string): Promise<unknown>;
    callTool(input: { id: string; name: string; args: unknown; profileId: string; runId: string }): Promise<any>;
    approve(input: { approvalId: string; allow: boolean }): Promise<unknown>;
    memorySave(input: { profileId: string; text: string; id?: string }): Promise<any>;
    memoryDelete(input: { profileId: string; id: string }): Promise<unknown>;
    realtimeSession(input: { sdp: string; profileId: string }): Promise<{ sdp: string; tools?: unknown[]; sessionId?: string }>;
    onEvent(callback: (event: JarvisEvent) => void): () => void;
    vision?(input: Record<string, unknown>): Promise<any>;
    openExternal?(url: string): Promise<unknown>;
  }
  interface Window { jarvis?: JarvisBridge; }
}

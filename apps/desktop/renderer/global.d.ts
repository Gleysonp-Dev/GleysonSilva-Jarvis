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
    startAtLogin?: boolean;
    standbyEnabled?: boolean;
    wakeClapEnabled?: boolean;
    wakeVoiceEnabled?: boolean;
    greetingMusicEnabled?: boolean;
    hasGreetingMusic?: boolean;
    receptionOutfitEnabled?: boolean;
    receptionVoiceEnabled?: boolean;
    continuousVoiceEnabled?: boolean;
  }
  interface JarvisRecord { id: string; text?: string; summary?: string; name?: string; status?: string; createdAt?: string; updatedAt?: string; profileId?: string; [key: string]: unknown; }
  interface JarvisSnapshot { memories: JarvisRecord[]; tasks: JarvisRecord[]; procedures: JarvisRecord[]; }
  interface JarvisCapabilities { desktop: boolean; vision: boolean; localTest?: boolean; ephemeralBiometrics?: boolean; startup?: boolean; voiceWake?: boolean; jarvisSpeech?: boolean; outfitObservation?: boolean; }
  interface JarvisWeatherAttribution { name: string; url: string; license: string; licenseUrl: string; text: string; }
  interface JarvisToolSource { url: string; title: string; }
  interface JarvisContext {
    generatedAt: number;
    weather: {
      status: 'ok' | 'not_configured' | 'unavailable';
      timezone: string;
      locationLabel: string;
      weather: null | { date: string; observedAt: number; currentTemperature: number; weatherCode: number; condition: string; minimum: number; maximum: number; precipitationProbability?: number };
      attribution: JarvisWeatherAttribution | null;
      fetchedAt: number | null;
      cache: { hit: boolean; expiresAt: number | null };
    };
    activity: {
      status: 'ok' | 'unavailable';
      observedAt: number;
      total: number;
      observedCount: number;
      limit: number;
      counts: { running: number; awaitingApproval: number; completed: number; unverified: number; failed: number; cancelled: number; interrupted: number };
      tasks: Array<{ runId: string; status: string; tool?: string; updatedAt?: string }>;
      truncated: boolean;
    };
    sources: Array<{ id: 'weather' | 'local_activity'; label: string; status: string; observedAt: number | null; attribution?: JarvisWeatherAttribution }>;
  }
  interface JarvisEvent { type: string; id?: string; profileId?: string; runId?: string; tool?: string; sources?: JarvisToolSource[]; retrievedAt?: number | string; text?: string; delta?: string; state?: string; status?: string; name?: string; summary?: string; message?: string; approvalId?: string; args?: unknown; [key: string]: any; }
  interface JarvisBridge {
    boot(): Promise<{ settings: JarvisSettings; snapshot: JarvisSnapshot; capabilities: JarvisCapabilities; startup?: { available: boolean; requested?: boolean; enabled: boolean; reason?: string } }>;
    saveSettings(settings: Partial<JarvisSettings> & { apiKey?: string; elevenApiKey?: string }): Promise<unknown>;
    startupGreeting?(input: { hour: number; timezone: string }): Promise<{ text: string; weatherStatus: string; locationLabel?: string; audioBase64: string | null; mime: string; reason?: string; attribution?: JarvisWeatherAttribution | string }>;
    cancelGreeting?(): Promise<{ cancelled: boolean }>;
    observeOutfit?(input: { imageDataUrl: string }): Promise<{ text: string; observedAt: number }>;
    cancelOutfit?(): Promise<unknown>;
    readContext?(input: { timezone?: string }): Promise<JarvisContext>;
    cancelContext?(): Promise<unknown>;
    chooseWorkspace(): Promise<string | null>;
    chooseApp(): Promise<{ id: string; label: string } | null>;
    text(input: { text: string; history: Array<{ role: string; content: string }>; profileId: string; runId: string }): Promise<any>;
    cancel(runId: string): Promise<unknown>;
    callTool(input: { id: string; name: string; args: unknown; profileId: string; runId: string }): Promise<any>;
    approve(input: { approvalId: string; allow: boolean }): Promise<unknown>;
    memorySave(input: { profileId: string; text: string; id?: string }): Promise<any>;
    memoryDelete(input: { profileId: string; id: string }): Promise<unknown>;
    realtimeSession(input: { sdp: string; profileId: string }): Promise<{ sdp: string; tools?: unknown[]; sessionId?: string }>;
    speak(input: { text: string; profileId: string; runId: string; utteranceId: string }): Promise<{ audioBase64: string; mime: string; runId: string; utteranceId: string }>;
    cancelSpeech(input: { runId: string }): Promise<unknown>;
    wakeStart?(): Promise<{ available: boolean; running: boolean; state: string; reason?: string }>;
    wakeStop?(): Promise<unknown>;
    chooseGreetingMusic?(): Promise<{ hasGreetingMusic: boolean }>;
    onEvent(callback: (event: JarvisEvent) => void): () => void;
    vision?(input: Record<string, unknown>): Promise<any>;
    openExternal?(url: string): Promise<unknown>;
  }
  interface Window { jarvis?: JarvisBridge; }
}

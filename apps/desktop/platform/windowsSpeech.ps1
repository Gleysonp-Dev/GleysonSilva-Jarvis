$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName System.Speech
  # Event handlers run in managed code so they do not depend on a PowerShell runspace.
  $wakeReferences = @([System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location, [Console].Assembly.Location, [System.Threading.Monitor].Assembly.Location, [System.Diagnostics.Stopwatch].Assembly.Location) | Select-Object -Unique
  Add-Type -ReferencedAssemblies $wakeReferences -TypeDefinition @'
using System;
using System.Globalization;
using System.Diagnostics;
using System.Speech.Recognition;

public static class JarvisLocalWake {
  private static readonly object OutputLock = new object();
  private static readonly Stopwatch Clock = Stopwatch.StartNew();
  private static long lastWake = -10000;
  private static long listeningAt;
  // No recognizer/registry configuration is changed. Rejection stays local to this worker.
  public static bool IsWakeCandidate(string text, float confidence, float wordConfidence, int wordCount, double durationMs) {
    return String.Equals(text, "Jarvis", StringComparison.OrdinalIgnoreCase)
      && !Single.IsNaN(confidence) && confidence >= 0.92f && confidence <= 1f
      && !Single.IsNaN(wordConfidence) && wordConfidence >= 0.90f && wordConfidence <= 1f
      && wordCount == 1 && !Double.IsNaN(durationMs) && durationMs >= 250 && durationMs <= 1500;
  }
  private static void Emit(string value) {
    lock (OutputLock) { Console.WriteLine(value); Console.Out.Flush(); }
  }
  public static void Run() {
    var installed = SpeechRecognitionEngine.InstalledRecognizers();
    if (installed.Count == 0) { Emit("{\"type\":\"unavailable\",\"reason\":\"speech_engine_missing\"}"); return; }
    RecognizerInfo selected = installed[0];
    foreach (var engine in installed) {
      if (engine.Culture.Name.Equals("en-US", StringComparison.OrdinalIgnoreCase)) selected = engine;
    }
    foreach (var engine in installed) {
      if (engine.Culture.Name.Equals("pt-BR", StringComparison.OrdinalIgnoreCase)) { selected = engine; break; }
    }
    using (var recognizer = new SpeechRecognitionEngine(selected.Id)) {
      var builder = new GrammarBuilder();
      builder.Culture = selected.Culture;
      builder.Append("Jarvis");
      var grammar = new Grammar(builder);
      grammar.Name = "JarvisWakeWord";
      recognizer.LoadGrammar(grammar);
      recognizer.SpeechRecognized += delegate(object sender, SpeechRecognizedEventArgs e) {
        if (e.Result == null || e.Result.Grammar == null || e.Result.Grammar.Name != "JarvisWakeWord" || e.Result.Audio == null || e.Result.Words.Count != 1) return;
        var word = e.Result.Words[0];
        var durationMs = e.Result.Audio.Duration.TotalMilliseconds;
        if (!String.Equals(word.Text, "Jarvis", StringComparison.OrdinalIgnoreCase) || !IsWakeCandidate(e.Result.Text, e.Result.Confidence, word.Confidence, e.Result.Words.Count, durationMs)) return;
        var now = Clock.ElapsedMilliseconds;
        lock (OutputLock) {
          if (now - listeningAt < 1200 || now - lastWake < 10000) return;
          lastWake = now;
          Emit("{\"type\":\"wake\",\"keyword\":\"Jarvis\",\"wordCount\":1,\"confidence\":" + e.Result.Confidence.ToString("0.0000", CultureInfo.InvariantCulture)
            + ",\"wordConfidence\":" + word.Confidence.ToString("0.0000", CultureInfo.InvariantCulture) + ",\"durationMs\":" + durationMs.ToString("0.0", CultureInfo.InvariantCulture) + "}");
        }
      };
      try { recognizer.SetInputToDefaultAudioDevice(); }
      catch { Emit("{\"type\":\"unavailable\",\"reason\":\"microphone_unavailable\"}"); return; }
      try {
        listeningAt = Clock.ElapsedMilliseconds;
        recognizer.RecognizeAsync(RecognizeMode.Multiple);
        Emit("{\"type\":\"ready\",\"culture\":\"" + selected.Culture.Name + "\"}");
        string command;
        while ((command = Console.ReadLine()) != null) { if (command == "STOP") break; }
      } finally {
        recognizer.RecognizeAsyncCancel();
        recognizer.SetInputToNull();
      }
    }
  }
}
'@
  [JarvisLocalWake]::Run()
} catch {
  [Console]::WriteLine('{"type":"unavailable","reason":"speech_initialization_failed"}')
  [Console]::Out.Flush()
  exit 1
}
